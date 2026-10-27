<script lang="ts">
  import { untrack } from 'svelte';
  import { onMount, tick } from 'svelte';
  import type { Feature, Geometry } from 'geojson';
  import { geoArea, geoCentroid, geoContains } from 'd3-geo';
  import { store, STUDY_GEOM } from './lib/store.svelte';
  import type { DetailItem, InsetItem, Item, ScaleItem } from './lib/store.svelte';
  import { boundaryMeta, loadBoundaries, loadCountries, loadCountriesLow, loadDisputed, loadLakes, loadRivers } from './lib/data';
  import { buildDetail, buildInset, buildMain, buildScale, creditsText, detailStart, featureBBox, parentLevel, placeLabels, rewind } from './lib/scene';
  import type { Data, InsetScene, MainScene } from './lib/scene';
  import { checkFigure } from './lib/check';
  import { terrainImage, contourLines } from './lib/terrain';
  import { guessNameField } from './lib/importers';
  import { kindName } from './lib/adminsearch';
  import { areaDeg2, fetchOsm, MAX_AREA_DEG2 } from './lib/osm';
  import { uid, makeClean } from './lib/store.svelte';
  import { applyTemplate } from './lib/templates';
  import { autoPlace, studyCover } from './lib/placement';
  import { imageryImage, BASEMAPS, basemapUrl, basemapComposite } from './lib/imagery';
  import { textWidthMm, wrapText } from './lib/measure';
  import { shownText } from './lib/textstyle';
import { legendNeed, legendPlan, legendRows } from './lib/legend';
  import { dissolve, joinAcross180 } from './lib/dissolve';
  import { DEFAULT_FONT, ensureFont, fonts, fontsUsed, restoreFonts } from './lib/fonts.svelte';
  import { copyItem, copyItems, duplicateItem, pasteItem, itemText, setItemTexts, deleteItems, duplicateItems, osmLayerStyle, groupParts, ungroupParts } from './lib/actions';
  import TopBar from './components/TopBar.svelte';
  import Rail from './components/Rail.svelte';
  import SidePanel from './components/SidePanel.svelte';
  import Canvas from './components/Canvas.svelte';
  import Tour from './components/Tour.svelte';
  import { isProblem } from './components/shell.svelte';
  import { t } from './lib/i18n.svelte';
  import IconContext from 'phosphor-svelte/lib/IconContext';
  import { putMap, thumbnail } from './lib/library';
  import { profilesReady } from './lib/figparts.svelte';
  import { frames } from './lib/frames.svelte';
  import type { DetailDraw } from './lib/frames.svelte';
  import { readSharedLink } from './lib/share';

  let base = $state.raw<Pick<Data, 'countries' | 'countriesLow' | 'rivers' | 'lakes' | 'disputed'>>({ countries: null, countriesLow: null, rivers: null, lakes: null, disputed: null });
  let svgEl = $state<SVGSVGElement>();
  let loadError = $state('');

  onMount(() => {
    store.onLoaded = () => {
      if (store.doc.clean) return;
      makeClean(store.doc);
      if (store.doc.templateId === 'classic') applyTemplate(store.doc, 'classic');
    };
    if (!store.restore()) store.snapshot();
    // a share link (#m=…) opens the map it carries; the map that was open is kept in My maps first
    readSharedLink(location.hash).then(async (text) => {
      if (!text) return;
      history.replaceState(null, '', location.pathname + location.search);
      try {
        if (store.doc.study.source !== 'none') await putMap({ id: store.mapId, name: store.doc.title || 'Untitled map', updated: Date.now(), data: store.serialize(true, false) }).catch(() => {});
        store.load(text);
        store.told(t('Opened the shared map. Your own map is in File, My maps.'));
      } catch {
        store.status = t('This share link could not be opened: it may be cut short. Ask for the link again.');
      }
    });
    // A fresh map starts on the Place panel.
    if (store.doc.study.source === 'none') { store.tab = 'place'; store.panelOpen = true; }
    // labels are measured with the map font: once it has loaded they are measured again (the canvas stays as it is,
    // so a search being typed or a drag in progress is not lost)
    document.fonts.load('10px Arimo').then(() => { fonts.tick++; });
    restoreFonts(); // fonts added on earlier visits
    // a phone works, but placing parts to the millimetre is easier with a mouse: said once, on the first small screen
    if (matchMedia('(max-width: 760px)').matches) {
      try {
        if (!localStorage.getItem('studymap.phoneTip')) {
          localStorage.setItem('studymap.phoneTip', '1');
          setTimeout(() => { if (!store.status) store.status = t('Tip: StudyMap works on a phone, but fine-tuning a figure is easier on a laptop or desktop.'); }, 2500);
        }
      } catch { /* private window: no tip */ }
    }
    // The light world outline first, so the page is usable at once; detail follows in the background.
    loadCountriesLow()
      .then((low) => {
        rewind(low);
        base = { ...base, countriesLow: low };
        // rivers and lakes are the big files: they follow when their layer is first shown (see below).
        // The detailed outlines (about 400 KB) wait until a place is chosen, or until the page has been quiet for a
        // few seconds, so on a slow connection they do not hold up the app or the first search.
        detailTimer = setTimeout(loadDetail, 6000);
      })
      .catch((e) => (loadError = e.message));
  });

  let detailTimer: ReturnType<typeof setTimeout> | undefined;
  let detailAsked = false;
  function loadDetail() {
    if (detailAsked) return;
    detailAsked = true;
    clearTimeout(detailTimer);
    Promise.all([loadCountries(), loadDisputed()])
      .then(([countries, disputed]) => {
        [countries, disputed].forEach((fc) => rewind(fc));
        base = { ...base, countries, disputed };
        store.countriesFc = countries;
      })
      .catch(() => { detailAsked = false; }); // tried again with the next place
  }
  $effect(() => { if (store.doc.study.source !== 'none' && base.countriesLow) loadDetail(); });

  // Rivers (off at the start) and lakes are fetched the first time their layer is on, not on every visit.
  const waterAsked = new Set<string>();
  $effect(() => {
    // the empty world page shows no lakes worth 160 KB on a slow connection: they come with the first place
    if (!base.countriesLow || store.doc.study.source === 'none') return;
    for (const [kind, load] of [['rivers', loadRivers], ['lakes', loadLakes]] as const) {
      if (base[kind] || waterAsked.has(kind) || !store.doc.layers.some((l) => l.kind === kind && l.visible)) continue;
      waterAsked.add(kind);
      load()
        .then((fc) => { rewind(fc); base = { ...base, [kind]: fc }; })
        .catch(() => waterAsked.delete(kind));
    }
  });

  /** ISO code of the country that contains a point, from the bundled world outline. */
  function countryAt(lon: number, lat: number): { iso: string; name: string } | null {
    const fc = base.countriesLow;
    if (!fc) return null;
    for (const f of fc.features) {
      const b = featureBBox(f);
      if (lon < b[0][0] || lon > b[1][0] || lat < b[0][1] || lat > b[1][1]) continue;
      if (geoContains(f as any, [lon, lat])) return { iso: String(f.properties?.iso), name: String(f.properties?.name) };
    }
    return null;
  }
  // Used by panels that set a new area.
  (globalThis as any).__countryAt = countryAt;

  // Resolve the study area for the current source.
  let resolveToken = 0;
  let boundaryBusy = ''; // the busy words of the boundary download in progress (told apart from other busy notes by being equal to them)
  // what the study area depends on, compared by value: a point drawn in another layer, roads loading or an undo that
  // brings back the same area replace store.geoms or doc.study, and must not resolve the area all over again
  const studyKey = $derived(JSON.stringify(store.doc.study));
  const studyGeomNow = $derived(store.geoms[STUDY_GEOM]);
  const studyLayerGeom = $derived(store.doc.study.fromLayer ? store.geoms[store.doc.study.fromLayer] : null);
  $effect(() => {
    void studyKey;
    const st = untrack(() => store.doc.study);
    const studyGeom = studyGeomNow;
    const layerGeom = studyLayerGeom;
    const countries = base.countriesLow;
    const detailed = base.countries; // 1:10m, when loaded: a whole-country study area keeps its small islands
    const token = ++resolveToken;
    const merge = !!st.merge;
    // several areas shown as one: their shared borders are dissolved into a single outline
    const setStudy = (raw: Feature<Geometry>[]) => {
      // an area cut at the 180° meridian is joined back, or its outline draws a line down 180°
      const feats = raw.map((f) => joinAcross180(f));
      store.studyParts = feats;
      const polys = feats.filter((f) => !f.properties?.__extentOnly && (f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'));
      store.studyFeatures = merge && polys.length > 1 ? [rewind(dissolve(polys, st.name)) as Feature<Geometry>, ...feats.filter((f) => !polys.includes(f))] : feats;
    };
    // a newer choice takes over: clear the previous run's message (read untracked, or this effect would re-run on it)
    untrack(() => { if (boundaryBusy && store.busy === boundaryBusy) store.busy = ''; });
    (async () => {
      if (st.source === 'none') { setStudy([]); return; }
      if (st.source === 'place' || st.source === 'drawn') {
        setStudy((studyGeom?.features ?? []).filter((f) => f.geometry) as Feature<Geometry>[]);
        return;
      }
      if (st.source === 'layer') {
        const all = (layerGeom?.features ?? []).filter((f) => f.geometry) as Feature<Geometry>[];
        const nameField = st.field || (layerGeom ? guessNameField(layerGeom) : '');
        if (nameField) for (const f of all) if (f.properties) f.properties.__name = String(f.properties[nameField] ?? '');
        const pick = st.field && st.values?.length ? new Set(st.values) : null;
        setStudy(pick ? all.filter((f) => pick.has(String(f.properties?.[st.field!] ?? ''))) : all);
        return;
      }
      // admin units
      if (!countries) return;
      const country = (store.countryFeature ?? detailed?.features.find((f) => f.properties?.iso === st.iso) ?? countries.features.find((f) => f.properties?.iso === st.iso)) as Feature<Geometry> | undefined;
      if (st.level === 0) { setStudy(country ? [country] : []); return; }
      try {
        boundaryBusy = t('Loading {country} boundaries…', { country: st.countryName });
        store.busy = boundaryBusy;
        const meta = await boundaryMeta(st.iso, st.level);
        if (token !== resolveToken) return;
        if (!meta) { setStudy(country ? [country] : []); return; }
        const fc = rewind(await loadBoundaries(meta));
        if (token !== resolveToken) return;
        let picked = fc.features.filter((f) => st.unitIds.includes(String(f.properties?.__id)));
        if (!picked.length && st.unitNames.length) {
          const names = st.unitNames.map((n) => n.toLowerCase());
          picked = fc.features.filter((f) => names.includes(String(f.properties?.__name).toLowerCase()));
        }
        setStudy((picked.length ? picked : country ? [country] : []) as Feature<Geometry>[]);
      } catch (e) {
        if (token === resolveToken) store.status = (e as Error).message + ' ' + t('Check your connection.');
      } finally {
        if (token === resolveToken) store.busy = '';
      }
    })();
  });

  // Boundaries layer: admin lines of the study country, at a level that suits the country's size.
  let adminToken = 0;
  $effect(() => {
    const iso = store.doc.study.iso;
    const adminLayer = store.doc.layers.find((l) => l.kind === 'admin' && !l.adminLevel);
    const want = store.doc.study.source === 'admin' && store.doc.study.level > 0 ? store.doc.study.level : null;
    const visible = !!adminLayer?.visible;
    const token = ++adminToken;
    if (!iso || !visible) { store.adminFc = null; store.adminMeta = null; return; }
    untrack(() => { if (store.adminFc && store.adminFc.features[0]?.properties?.shapeGroup && store.adminFc.features[0].properties.shapeGroup !== iso) { store.adminFc = null; store.adminMeta = null; } });
    (async () => {
      const levels = want ? [want] : [2, 1];
      for (const lvl of levels) {
        const meta = await boundaryMeta(iso, lvl).catch(() => null);
        if (!meta || meta.count > 1200) continue;
        const fc = await loadBoundaries(meta).catch(() => null);
        if (token !== adminToken || !fc) return;
        rewind(fc);
        store.adminFc = fc;
        store.adminMeta = { canonical: meta.canonical, license: meta.license, source: meta.source };
        const al = store.doc.layers.find((x) => x.kind === 'admin' && !x.adminLevel);
        if (al && / boundary$/.test(al.legendLabel)) al.legendLabel = `${kindName(meta.canonical, meta.level)} boundary`;
        return;
      }
    })();
  });

  // Boundaries at fixed levels: extra boundary layers and locator maps that name a level.
  let levelsIso = '';
  const levelLoading = new Set<string>();
  $effect(() => {
    const iso = store.doc.study.iso;
    if (iso !== levelsIso) { levelsIso = iso; store.adminLevels = {}; }
    if (!iso) return;
    const need = new Set<number>();
    for (const l of store.doc.layers) if (l.kind === 'admin' && l.visible && l.adminLevel) need.add(l.adminLevel);
    for (const it of store.doc.items) {
      if (it.kind !== 'inset' || !it.visible) continue;
      // the study area's own level: the locators merge their division or country outline from it
      if (store.doc.study.source === 'admin' && store.doc.study.level > 0) need.add(store.doc.study.level);
      if (it.adminLevel) need.add(it.adminLevel);
      // the surroundings locator looks from its level up to the coarsest for a unit clearly larger than the area
      if (it.context === 'parent') for (let lv = parentLevel(it.frameLevel, store.doc.study.source === 'admin' ? store.doc.study.level : undefined); lv >= 1; lv--) need.add(lv);
      // a country locator of an upazila map draws district lines
      if (it.context === 'country' && it.adminLevel === undefined && store.doc.study.source === 'admin' && store.doc.study.level > 2) need.add(2);
    }
    for (const lvl of need) {
      const k = `${iso}:${lvl}`;
      if (store.adminLevels[lvl] || levelLoading.has(k)) continue;
      levelLoading.add(k);
      boundaryMeta(iso, lvl)
        .then((meta) => (meta ? loadBoundaries(meta) : null))
        .then((fc) => { if (fc && store.doc.study.iso === iso) store.adminLevels = { ...store.adminLevels, [lvl]: rewind(fc) }; })
        .catch(() => { store.status = t('Could not load those boundaries. Check your connection.'); })
        .finally(() => levelLoading.delete(k));
    }
  });

  // The study country's own outline from geoBoundaries, so it lines up with the admin lines.
  let countryToken = 0;
  $effect(() => {
    const iso = store.doc.study.iso;
    const token = ++countryToken;
    store.countryFeature = null;
    if (!iso) return;
    boundaryMeta(iso, 0)
      // A country outline taken from OpenStreetMap runs out to sea (12 nautical miles of territorial water), so the
      // land would be drawn far past the coast: those countries keep the Natural Earth land outline.
      .then((meta) => (meta && !/OpenStreetMap/i.test(meta.source) ? loadBoundaries(meta) : null))
      .then((fc) => {
        if (token !== countryToken || !fc || !fc.features.length) return;
        rewind(fc);
        store.countryFeature = fc.features[0] as Feature<Geometry>;
      })
      .catch(() => {});
  });

  let subToken = 0;
  $effect(() => {
    const st = store.doc.study;
    const drawnFeats = store.studyFeatures.filter((f) => f.geometry && f.geometry.type !== 'Point' && !f.properties?.__extentOnly);
    // A shape drawn inside a district shows that district's sub-areas, so the map keeps its upazila (thana, ward...) names.
    const ctxLayer = st.source === 'drawn' ? store.doc.layers.find((l) => l.kind === 'vector' && l.auto) : undefined;
    const ctxFeats = ctxLayer ? store.geoms[ctxLayer.id]?.features : undefined;
    const feats = ctxFeats?.length ? ctxFeats : drawnFeats;
    const touching = st.source === 'drawn' && !ctxFeats?.length;
    const subLayer = store.doc.layers.find((l) => l.kind === 'subunits');
    const token = ++subToken;
    if (!st.iso || !feats.length || !subLayer?.visible) { store.subFc = null; return; }
    // How fine: one level below the study area; for a drawn or searched area, judged from its size.
    let span = 0;
    for (const f of feats) { const b = featureBBox(f); span = Math.max(span, b[1][0] - b[0][0], b[1][1] - b[0][1]); }
    const want = st.level > 0 ? st.level + 1 : span < 0.9 ? 3 : span < 3 ? 2 : 1;
    (async () => {
      for (const lvl of [want, want - 1]) {
        if (lvl < 1) continue;
        const meta = await boundaryMeta(st.iso, lvl).catch(() => null);
        if (!meta || meta.count > 6000) continue;
        const fc = await loadBoundaries(meta).catch(() => null);
        if (token !== subToken || !fc) return;
        rewind(fc);
        const inside = fc.features.filter((u) => {
          if (!u.geometry) return false;
          // a hand-drawn area: every unit it touches
          if (touching) { const ub = featureBBox(u); return feats.some((s) => { const b = featureBBox(s); return ub[0][0] <= b[1][0] && ub[1][0] >= b[0][0] && ub[0][1] <= b[1][1] && ub[1][1] >= b[0][1]; }); }
          const c = geoCentroid(u as any) as [number, number];
          return feats.some((s) => { const b = featureBBox(s); return c[0] >= b[0][0] && c[0] <= b[1][0] && c[1] >= b[0][1] && c[1] <= b[1][1] && geoContains(s as any, c); });
        });
        // A unit that is the study area itself (same level) is not a sub-area.
        if (inside.length < (touching ? 1 : 2)) continue;
        store.subFc = { type: 'FeatureCollection', features: inside };
        store.subMeta = { canonical: meta.canonical, license: meta.license };
        const l = store.doc.layers.find((x) => x.kind === 'subunits');
        if (l && /^(Sub-district boundary|.* boundary)$/.test(l.legendLabel)) l.legendLabel = `${kindName(meta.canonical, meta.level)} boundary`;
        return;
      }
      if (token === subToken) store.subFc = null;
    })();
  });

  // An official area is drawn from its own official sub-areas when they come from another file: the outline and the
  // lines inside it then meet exactly (two boundary files never share the same border points)
  const alignedStudy = $derived.by(() => {
    const st = store.doc.study, sub = store.subFc;
    if (st.source !== 'admin' || st.unitIds.length !== 1 || !sub || sub.features.length < 2) return null;
    const polys = store.studyFeatures.filter((f) => !f.properties?.__extentOnly && f.geometry && /Polygon/.test(f.geometry.type));
    const area = (f: Feature) => { const a = geoArea(f as any); return a > 2 * Math.PI ? 4 * Math.PI - a : a; };
    const own = polys.reduce((s, f) => s + area(f), 0);
    const merged = rewind(joinAcross180(dissolve(sub.features as Feature[], st.name))) as Feature<Geometry>;
    merged.properties = { ...(polys[0]?.properties ?? {}), ...merged.properties };
    if (!own || Math.abs(area(merged) / own - 1) > 0.08) return null; // the sub-areas do not make up the area: keep its own outline
    return [merged, ...store.studyFeatures.filter((f) => !polys.includes(f))];
  });
  const data = $derived<Data>({ ...base, country: store.countryFeature, admin: store.adminFc, adminLevels: store.adminLevels, sub: store.subFc, study: alignedStudy ?? store.studyFeatures, geoms: store.geoms, studyLevel: store.doc.study.source === 'admin' ? store.doc.study.level : undefined });
  const main = $derived(buildMain(store.doc, store.map, data));
  const labels = $derived(placeLabels(main, store.doc, store.map));
  const insets = $derived.by(() => {
    const out: Record<string, InsetScene | null> = {};
    if (!main) return out;
    for (const it of store.doc.items) {
      if (it.kind !== 'inset' || !it.visible) continue;
      const marks = it.marks ? (store.doc.items.find((o) => o.id === it.marks && o.kind === 'inset' && o.visible) as InsetItem | undefined) : undefined;
      // the small maps draw district lines from the district file, so the study area there comes from that file too
      out[it.id] = buildInset(it as InsetItem, main, alignedStudy ? { ...data, study: store.studyFeatures } : data, store.doc.study.iso, marks);
    }
    return out;
  });
  // Detail maps: each is another frame with the same layers, drawn in the same projection at its own place and scale, and places its own names
  const details = $derived.by(() => {
    const out: Record<string, DetailDraw | null> = {};
    if (!main) return out;
    for (const it of store.doc.items) {
      if (it.kind !== 'detail' || !it.visible) continue;
      const scene = buildDetail(store.doc, it as DetailItem, main, data);
      out[it.id] = scene ? { scene, labels: placeLabels(scene, store.doc, it, false) } : null;
    }
    return out;
  });
  // the panels and actions read the frames' scenes from here (a detail map's settings show its scale, a new one starts from the main map's)
  $effect.pre(() => { frames.main = main; frames.details = details; });
  // A new place: a detail map still looking at the old one looks at the middle of the new area (the same 3 times as close as the main map).
  // One that points anywhere within the study area, or a file opened with its own details, is left as it is.
  let lastCentre: [number, number] | null = null;
  $effect(() => {
    const m = main, feats = data.study;
    if (!m || !feats.length) return;
    const c = m.studyCentroid;
    untrack(() => {
      if (lastCentre && (Math.abs(c[0] - lastCentre[0]) > 1e-3 || Math.abs(c[1] - lastCentre[1]) > 1e-3)) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const f of feats) { const b = featureBBox(f); x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]); x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]); }
        const gx = (x1 - x0) * 0.25, gy = (y1 - y0) * 0.25;
        const start = detailStart(m);
        let moved = false;
        for (const it of store.doc.items) {
          if (it.kind !== 'detail' || !start) continue;
          const [lon, lat] = it.centre;
          if (lon < x0 - gx || lon > x1 + gx || lat < y0 - gy || lat > y1 + gy) { it.centre = start.centre; it.scale = start.scale; moved = true; }
        }
        if (moved) store.commit();
      }
      lastCentre = c;
    });
  });
  const scaleItem = $derived(store.doc.items.find((i) => i.kind === 'scale') as ScaleItem | undefined);
  // the scale bar measures the main map, or the detail map it was tied to (if that is still on the page)
  const scale = $derived.by(() => {
    const frame = (scaleItem?.of && details[scaleItem.of]?.scene) || main;
    return frame && scaleItem ? buildScale(scaleItem, frame) : null;
  });

  // Terrain: screen resolution while editing, print resolution only when exporting.
  const terrainLayer = $derived(store.doc.layers.find((l) => l.kind === 'terrain' && l.visible));
  const terrainOn = $derived(!!terrainLayer && store.doc.study.source !== 'none');
  const terrainKey = $derived.by(() => {
    if (!main || !terrainOn || !terrainLayer?.terrain) return '';
    const fp = main.fp;
    const t = terrainLayer.terrain;
    return JSON.stringify([main.crs.proj4, fp.widthMm, fp.heightMm, fp.center.map((v) => +v.toPrecision(7)), +fp.k.toPrecision(6), fp.rot, t.tint, t.exaggeration, t.azimuth]);
  });
  let printTerrain = $state<string | null>(null);

  function terrainRequest(pxPerMm: number, sc: MainScene = main!) {
    const fp = sc.fp, t = terrainLayer!.terrain!, view = sc.lonLatView;
    const padX = (view[1][0] - view[0][0]) * 0.03, padY = (view[1][1] - view[0][1]) * 0.03;
    return {
      proj4: sc.crs.proj4, widthMm: fp.widthMm, heightMm: fp.heightMm, center: fp.center, k: fp.k, rot: fp.rot, pxPerMm,
      lonLat: [[view[0][0] - padX, view[0][1] - padY], [view[1][0] + padX, view[1][1] + padY]] as [[number, number], [number, number]],
      azimuth: t.azimuth, altitude: 45, exaggeration: t.exaggeration, tint: t.tint, shade: true,
    };
  }

  // Contour lines from the same elevation tiles, traced for the frame on the page (again when the frame changes)
  const contourLayer = $derived(store.doc.layers.find((l) => l.contour && l.visible));
  let contourKey = '';
  let contourTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const l = contourLayer;
    if (!l?.contour || !main || store.doc.study.source === 'none') return;
    const fp = main.fp, view = main.lonLatView;
    const key = [l.id, main.crs.code, fp.widthMm, fp.heightMm, fp.center.map((v) => v.toFixed(3)).join(','), fp.k.toPrecision(6), fp.rot, l.contour.interval].join('|');
    if (key === contourKey && store.geoms[l.id]) return;
    clearTimeout(contourTimer);
    contourTimer = setTimeout(() => {
      contourKey = key;
      const contourBusy = t('Drawing contour lines…');
      const padX = (view[1][0] - view[0][0]) * 0.03, padY = (view[1][1] - view[0][1]) * 0.03;
      const req = {
        proj4: main!.crs.proj4, widthMm: fp.widthMm, heightMm: fp.heightMm, center: fp.center, k: fp.k, rot: fp.rot,
        pxPerMm: Math.min(4, 1100 / Math.max(fp.widthMm, fp.heightMm)),
        lonLat: [[view[0][0] - padX, view[0][1] - padY], [view[1][0] + padX, view[1][1] + padY]] as [[number, number], [number, number]],
        azimuth: 315, altitude: 45, exaggeration: 1, tint: false, shade: false,
      };
      store.busy = contourBusy;
      contourLines(req, l.contour!.interval)
        .then(({ fc, interval }) => {
          if (contourKey !== key) return;
          store.geoms = { ...store.geoms, [l.id]: fc };
          if (l.contour && l.contour.shown !== interval) { l.contour.shown = interval; l.legendLabel = `Contour (${interval} m interval)`; }
          if (!fc.features.length) store.status = t('This area is too flat for contour lines at this interval. Try a smaller interval.');
        })
        .catch((e) => (store.status = (e as Error).message))
        .finally(() => { if (store.busy === contourBusy) store.busy = ''; });
    }, 600);
  });

  let terrainTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const key = terrainKey;
    clearTimeout(terrainTimer);
    if (!key || !main) return;
    terrainTimer = setTimeout(() => {
      const fp = main!.fp;
      const pxPerMm = Math.min(5, 1400 / Math.max(fp.widthMm, fp.heightMm));
      store.terrainMsg = t('Building terrain…');
      terrainImage(terrainRequest(pxPerMm))
        .then((img) => { if (terrainKey === key) { store.terrain = { key, ...img }; store.terrainMsg = ''; } })
        .catch((e) => { if (terrainKey === key) store.terrainMsg = (e as Error).message; });
    }, 250);
  });
  // On flat ground (less than 60 m of relief in view) shading only shows noise, so the automatic setting leaves it out.
  const terrainFlat = $derived(!!store.terrain && store.terrain.key === terrainKey && store.terrain.maxElev - Math.max(0, store.terrain.minElev) < 60 && terrainLayer?.terrain?.auto !== false);
  let flatTold = '';
  $effect(() => {
    if (terrainFlat && terrainKey && flatTold !== store.doc.study.name) {
      flatTold = store.doc.study.name;
      store.status = t('This area is nearly flat, so shaded relief is hidden. To show it anyway: Layers, Terrain, Always show.');
    }
  });
  const terrainHref = $derived(terrainFlat ? null : printTerrain ?? (store.terrain && store.terrain.key === terrainKey ? store.terrain.href : null));

  // The outline of the place a shape was drawn inside belongs to that drawing only.
  $effect(() => {
    if (store.doc.study.source !== 'drawn' && store.doc.layers.some((l) => l.kind === 'vector' && l.auto)) {
      store.doc.layers = store.doc.layers.filter((l) => !(l.kind === 'vector' && l.auto));
      store.doc.study.within = undefined;
    }
  });

  // Detailed OpenStreetMap rivers, water and roads for small areas, loaded and refreshed automatically.
  const loadingOsm = new Set<string>();
  let osmTimer: ReturnType<typeof setTimeout> | undefined;
  // the free OpenStreetMap servers are sometimes all busy at once: a layer the user asked for is tried again
  // (three times, half a minute apart) instead of staying empty until the map is moved
  let osmRetry = $state(0);
  let osmBusy = ''; // the busy words of a layer the user added, loading now
  const osmTries = new Map<string, number>();
  $effect(() => {
    void osmRetry;
    if (!main || store.doc.study.source === 'none') return;
    const v = main.lonLatView;
    const span = Math.max(v[1][0] - v[0][0], v[1][1] - v[0][1]);
    const layers = store.doc.layers;
    // Town-sized maps would be empty without detail, so streets come in under 0.15°. Rivers and water never come in
    // on their own (the user asked for a clean start); Map parts, Add, Rivers and water adds them. Deleting stops a return.
    const want: ('water' | 'roads')[] = store.doc.noAutoDetail ? [] : span < 0.15 ? ['roads'] : [];
    for (const theme of ['water', 'roads'] as const) {
      const existing = layers.find((l) => l.kind === 'osm' && l.osmTheme === theme);
      if (want.includes(theme) && !existing) {
        const water = theme === 'water';
        // in the colours of the map style in use
        const l = { id: uid('osm'), kind: 'osm' as const, osmTheme: theme, auto: true, name: water ? 'Rivers and water' : 'Roads', visible: true, inLegend: true,
          legendLabel: water ? 'River and water body' : 'Road',
          style: osmLayerStyle(theme) };
        const studyIdx = layers.findIndex((x) => x.kind === 'study');
        layers.splice(studyIdx + 1, 0, l);
      } else if (!want.includes(theme) && existing?.auto) {
        store.doc.layers = store.doc.layers.filter((x) => x !== existing);
      }
    }
    clearTimeout(osmTimer);
    osmTimer = setTimeout(() => {
      for (const l of store.doc.layers) {
        if ((l.kind !== 'osm' && !(l.kind === 'points' && l.osmTheme === 'places')) || !l.visible || !l.osmTheme || loadingOsm.has(l.id)) continue;
        const b = l.osmBBox;
        const covered = b && v[0][0] >= b[0][0] && v[0][1] >= b[0][1] && v[1][0] <= b[1][0] && v[1][1] <= b[1][1];
        if (store.geoms[l.id] && covered) continue;
        if (areaDeg2(v) > MAX_AREA_DEG2) continue;
        const padX = (v[1][0] - v[0][0]) * 0.15, padY = (v[1][1] - v[0][1]) * 0.15;
        const bb: [[number, number], [number, number]] = [[v[0][0] - padX, v[0][1] - padY], [v[1][0] + padX, v[1][1] + padY]];
        loadingOsm.add(l.id);
        // Automatic detail loads quietly in the background; only a layer the user added shows the busy pill.
        if (!l.auto) { osmBusy = l.osmTheme === 'water' ? t('Adding rivers and water…') : l.osmTheme === 'places' ? t('Adding towns and cities…') : t('Adding roads…'); store.busy = osmBusy; }
        // the free servers can take half a minute when busy: say so after a few seconds, so nobody thinks it froze
        const slow = l.auto ? undefined : setTimeout(() => {
          if (!osmBusy || store.busy !== osmBusy) return;
          osmBusy = `${osmBusy} ${t('OpenStreetMap is slow right now, still trying.')}`;
          store.busy = osmBusy;
        }, 5000);
        fetchOsm(l.osmTheme, bb)
          .then((fc) => { rewind(fc); store.geoms = { ...store.geoms, [l.id]: fc }; l.osmBBox = bb; })
          .catch(() => {
            if (l.auto) return;
            const n = (osmTries.get(l.id) ?? 0) + 1;
            osmTries.set(l.id, n);
            store.status = n < 3 ? t('OpenStreetMap is busy. {name} will be tried again in half a minute.', { name: l.name }) : t('OpenStreetMap is still busy. {name} will load when you move or zoom the map later.', { name: l.name });
            if (n < 3) setTimeout(() => osmRetry++, 30000);
          })
          .finally(() => { clearTimeout(slow); loadingOsm.delete(l.id); if (!l.auto && osmBusy && store.busy === osmBusy) store.busy = ''; });
      }
    }, 700);
  });

  // Satellite base map for the current frame, reprojected like the terrain.
  const basemapLayer = $derived(store.doc.layers.find((l) => l.kind === 'basemap' && l.visible));
  const basemapKey = $derived.by(() => {
    if (!basemapLayer || !main) return '';
    const fp = main.fp;
    return [main.crs.code, fp.widthMm, fp.heightMm, fp.center.map((v) => v.toFixed(2)).join(','), fp.k.toPrecision(6), fp.rot, basemapLayer.basemap?.id, basemapLayer.basemap?.date].join('|');
  });
  let basemapImg = $state<{ key: string; href: string } | null>(null);
  let printBasemap = $state<string | null>(null);
  function basemapRequest(pxPerMm: number, sc: MainScene = main!) {
    const fp = sc.fp, view = sc.lonLatView, b = BASEMAPS[basemapLayer!.basemap?.id ?? 's2cloudless'];
    const padX = (view[1][0] - view[0][0]) * 0.03, padY = (view[1][1] - view[0][1]) * 0.03;
    return {
      url: basemapUrl(basemapLayer!.basemap?.id ?? 's2cloudless', basemapLayer!.basemap?.date), maxZoom: b.maxZoom, proj4: sc.crs.proj4,
      composite: basemapComposite(basemapLayer!.basemap?.id ?? 's2cloudless', basemapLayer!.basemap?.date), widthMm: fp.widthMm, heightMm: fp.heightMm, center: fp.center, k: fp.k, rot: fp.rot, pxPerMm,
      lonLat: [[view[0][0] - padX, view[0][1] - padY], [view[1][0] + padX, view[1][1] + padY]] as [[number, number], [number, number]],
    };
  }
  let basemapTimer: ReturnType<typeof setTimeout> | undefined;
  let satBusy = ''; // the busy words of the satellite picture being made (they change as it progresses)
  $effect(() => {
    const key = basemapKey;
    clearTimeout(basemapTimer);
    if (!key || !main) return;
    basemapTimer = setTimeout(() => {
      const fp = main!.fp;
      const pxPerMm = Math.min(5, 1600 / Math.max(fp.widthMm, fp.heightMm));
      satBusy = t('Loading the satellite image…');
      store.busy = satBusy;
      // a season's picture is put together from many days and takes a while: say how far it has got
      imageryImage(basemapRequest(pxPerMm), (f) => { if (basemapKey === key) { satBusy = t('Putting together the satellite picture… {pct}%', { pct: String(Math.round(f * 100)) }); store.busy = satBusy; } })
        .then((href) => { if (basemapKey === key) basemapImg = { key, href }; })
        .catch((e) => { if (basemapKey === key) store.status = (e as Error).message; })
        .finally(() => { if (satBusy && store.busy === satBusy) store.busy = ''; });
    }, 300);
  });
  const basemapHref = $derived(printBasemap ?? (basemapImg && basemapImg.key === basemapKey ? basemapImg.href : null));

  // Relief and satellite pictures of the detail maps: made for each frame the way the main map's are, and kept while the frame stays the same.
  const frameKey = (sc: MainScene) => [sc.crs.code, sc.fp.widthMm, sc.fp.heightMm, sc.fp.center.map((v) => +v.toPrecision(7)).join(','), +sc.fp.k.toPrecision(6), sc.fp.rot].join('|');
  const pictureKeys = $derived.by(() => {
    const out: Record<string, { t: string; b: string }> = {};
    const t = terrainOn ? terrainLayer?.terrain : undefined, bm = basemapLayer?.basemap;
    for (const [id, dd] of Object.entries(details)) {
      if (!dd || (!t && !basemapLayer)) continue;
      const fk = frameKey(dd.scene);
      out[id] = { t: t ? [fk, t.tint, t.exaggeration, t.azimuth].join('|') : '', b: basemapLayer ? [fk, bm?.id, bm?.date].join('|') : '' };
    }
    return out;
  });
  let detailPics = $state.raw<Record<string, { t?: { key: string; href: string }; b?: { key: string; href: string } }>>({});
  let printPics = $state.raw<Record<string, { t?: string; b?: string }>>({});
  let picTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const keys = pictureKeys;
    clearTimeout(picTimer);
    picTimer = setTimeout(() => {
      for (const [id, k] of Object.entries(keys)) {
        const sc = untrack(() => details[id]?.scene);
        if (!sc) continue;
        const have = untrack(() => detailPics[id]);
        const px = Math.min(5, 1400 / Math.max(sc.fp.widthMm, sc.fp.heightMm));
        const put = (kind: 't' | 'b', href: string) => { if (pictureKeys[id]?.[kind] === k[kind]) detailPics = { ...detailPics, [id]: { ...detailPics[id], [kind]: { key: k[kind], href } } }; };
        if (k.t && have?.t?.key !== k.t) terrainImage(terrainRequest(px, sc)).then((img) => put('t', img.href)).catch(() => {});
        if (k.b && have?.b?.key !== k.b) imageryImage(basemapRequest(px, sc)).then((href) => put('b', href)).catch(() => {});
      }
    }, 350);
  });
  /** the detail maps ready to draw: their geometry and names, with the pictures that belong to their frame now */
  const detailsDrawn = $derived.by(() => {
    const out: Record<string, DetailDraw | null> = {};
    for (const [id, dd] of Object.entries(details)) {
      const k = pictureKeys[id], p = detailPics[id];
      out[id] = dd && {
        ...dd,
        terrainHref: terrainFlat ? null : printPics[id]?.t ?? (k?.t && p?.t?.key === k.t ? p.t.href : null),
        basemapHref: printPics[id]?.b ?? (k?.b && p?.b?.key === k.b ? p.b.href : null),
      };
    }
    return out;
  });

  store.beforeExport = async () => {
    await profilesReady(); // an elevation profile still reading the ground would print "Reading the ground height…"
    if (basemapKey && main) {
      const fp = main.fp;
      store.busy = t('Rendering the satellite image at print quality…');
      try {
        printBasemap = await imageryImage(basemapRequest(Math.min(10, 3000 / Math.max(fp.widthMm, fp.heightMm))));
        await tick();
      } catch { /* keep the screen image */ } finally { store.busy = ''; }
    }
    // the detail maps' pictures at print quality too (a frame is small, so each is quick)
    if (main && Object.keys(pictureKeys).length) {
      store.busy = t('Rendering the detail maps at print quality…');
      const next: Record<string, { t?: string; b?: string }> = {};
      for (const [id, k] of Object.entries(pictureKeys)) {
        const sc = details[id]?.scene;
        if (!sc) continue;
        next[id] = {};
        try {
          if (k.t) next[id].t = (await terrainImage(terrainRequest(Math.min(12, 3200 / Math.max(sc.fp.widthMm, sc.fp.heightMm)), sc))).href;
          if (k.b) next[id].b = await imageryImage(basemapRequest(Math.min(10, 3000 / Math.max(sc.fp.widthMm, sc.fp.heightMm)), sc));
        } catch { /* the screen picture of that frame is kept */ }
      }
      printPics = next;
      store.busy = '';
      await tick();
    }
    if (!terrainKey || !main) return;
    const fp = main.fp;
    const pxPerMm = Math.min(12, 3200 / Math.max(fp.widthMm, fp.heightMm));
    store.busy = t('Rendering terrain at print quality…');
    try {
      const img = await terrainImage(terrainRequest(pxPerMm));
      printTerrain = img.href;
      await tick();
    } catch {
      /* the screen-resolution relief is kept rather than failing the whole export */
    } finally {
      store.busy = '';
    }
  };
  $effect(() => { if (!terrainKey && store.terrainMsg) store.terrainMsg = ''; });
  store.afterExport = () => { printTerrain = null; printBasemap = null; printPics = {}; };

  const elevation = $derived(terrainHref && store.terrain ? { min: Math.round(Math.max(0, store.terrain.minElev)), max: Math.round(store.terrain.maxElev) } : null);
  const credits = $derived(creditsText(store.doc, main, store.adminMeta, !!terrainHref));

  // The legend box fits its entries; credits sitting just below it move with it.
  $effect(() => {
    const lg = store.doc.items.find((i) => i.kind === 'legend' && i.visible);
    if (!lg || lg.kind !== 'legend' || !main || lg.w > 70) return;
    // the same lines, rows and columns the figure draws (lib/legend, which builds on lib/textstyle legendLayout); the elevation text is measured at its longest
    const rows = legendRows(store.doc, main, { terrain: !!(terrainHref && terrainLayer), elevation: elevation ? { min: 0, max: 9999 } : null }, lg);
    const n = rows.length;
    const plan = legendPlan(lg, rows);
    const need = Math.round(plan.fit * 10) / 10;
    const cols = lg.cols ? (rows.every((r) => r.h === 1) ? Math.min(lg.cols, Math.max(1, n)) : plan.cols) : 1;
    // A legend sitting on the map is only as wide as its longest line, so it hides as little as possible.
    const m = store.doc.items.find((i) => i.kind === 'map' && i.visible);
    const onMap = !!m && lg.x + lg.w / 2 > m.x && lg.x + lg.w / 2 < m.x + m.w && lg.y + lg.h / 2 > m.y && lg.y + lg.h / 2 < m.y + m.h;
    if (onMap || cols > 1) {
      // the title starts 1 mm in, the entries after their swatch (headings from the left edge), so the box must hold whichever reaches further;
      // with columns, each column holds its widest entry
      const need2 = legendNeed(lg, rows, plan.textX);
      const titleW = lg.title ? textWidthMm(lg.title, lg.labelPt * 1.1, lg.titleText?.bold ?? true) : 0;
      const wNeed = Math.round((Math.max(cols * need2.entryW, 1 + titleW, need2.widest) + 2) * 10) / 10;
      // on the map the box fits its lines exactly; beside it, columns only ever make it wider (the column stays aligned)
      if (onMap ? Math.abs(lg.w - wNeed) > 0.3 : wNeed > lg.w + 0.3) {
        // an automatic legend in the right half keeps its right edge; one placed by hand keeps its left edge (alignment)
        const right = lg.x + lg.w; lg.w = wNeed;
        if (lg.x + lg.w / 2 > m!.x + m!.w / 2) lg.x = Math.round((right - wNeed) * 10) / 10;
      }
    }
    if (Math.abs(lg.h - need) < 0.3) return;
    const cr = store.doc.items.find((i) => i.kind === 'credits' && i.visible);
    const oldBottom = lg.y + lg.h;
    // beside the map, a legend whose foot sits on the map's bottom line or just above the scale bar grows upwards,
    // so the column stays lined up with the map frame
    const sc = store.doc.items.find((i) => i.kind === 'scale' && i.visible);
    const footed = !onMap && !lg.pinned && !!m && (Math.abs(oldBottom - (m.y + m.h)) < 0.6 || (!!sc && sc.y - oldBottom > 1 && sc.y - oldBottom < 5 && Math.abs(sc.x - lg.x) < 4));
    if (footed) lg.y = Math.max(0, Math.round((oldBottom - need) * 10) / 10);
    lg.h = need;
    if (cr && cr.y >= oldBottom - 2 && cr.y <= oldBottom + 8 && Math.abs(cr.x - lg.x) < 4) {
      const bottom = cr.y + cr.h;
      cr.y = Math.round((lg.y + need + 2) * 10) / 10;
      cr.h = Math.max(10, Math.round((bottom - cr.y) * 10) / 10);
    }
  });
  // The figure's fonts: measure with the map font, and load every font the figure uses.
  $effect(() => {
    fonts.current = store.doc.font || DEFAULT_FONT;
    for (const f of fontsUsed(store.doc)) ensureFont(f);
  });
  // A text box fits its text: a new box grows sideways as you type (up to the page edge), a box sized by hand
  // wraps inside its width, and either grows downwards for more lines (Shift+Enter starts a new line).
  $effect(() => {
    for (const it of store.doc.items) {
      if (it.kind !== 'title' || !it.visible) continue;
      const fs = (it.labelPt * 25.4) / 72;
      if (it.autoW) {
        const widest = Math.max(...shownText(it).split('\n').map((l) => textWidthMm(l, it.labelPt, it.bold, it.font || undefined)), 2);
        const room = store.doc.widthMm - (it.align === 'end' ? 2 : it.x) - 2;
        const want = Math.round(Math.min(Math.max(widest + 2, 6), Math.max(room, 6)) * 10) / 10;
        if (Math.abs(it.w - want) > 0.3) {
          // the side the text is aligned to stays put
          if (it.align === 'middle') it.x = Math.round((it.x + (it.w - want) / 2) * 10) / 10;
          else if (it.align === 'end') it.x = Math.round((it.x + it.w - want) * 10) / 10;
          it.w = want;
        }
      }
      const n = Math.max(1, wrapText(shownText(it), it.labelPt, Math.max(it.w, 4), it.bold, it.font || undefined).length);
      const need = Math.round((fs * (1.1 + (it.lineGap ?? 1.25) * (n - 1)) + 0.6) * 10) / 10;
      if (it.h < need - 0.2) it.h = need;
    }
  });
  // North arrow, scale bar and legend on the map move to the corner where they hide the least of the study area.
  $effect(() => {
    if (autoPlace(store.doc, main)) store.commit();
  });
  // a part switched off (or removed) is no longer selected, so no empty selection box stays on the page
  $effect(() => {
    const id = store.selected;
    if (id && store.tab !== 'edit' && !store.doc.items.some((i) => i.id === id && i.visible) && !store.doc.layers.some((l) => l.id === id)) store.select(null);
  });
  // read only when a part is added, so it costs nothing while editing
  $effect(() => { const mn = main; store.cover = (r) => studyCover(store.doc, mn)?.(r) ?? 0; });
  const findings = $derived(checkFigure(store.doc, main, scale?.variation ?? null, credits));

  // My maps: the map on screen is kept in the browser's map library too, with a small picture of the page,
  // a few seconds after each save (the picture at most every 20 s), so starting a new map never loses this one.
  let keepTimer: ReturnType<typeof setTimeout> | undefined;
  let thumb: { id: string; at: number; url?: string } = { id: '', at: 0 };
  store.onSaved = () => {
    clearTimeout(keepTimer);
    if (store.doc.study.source === 'none') return;
    keepTimer = setTimeout(async () => {
      if (store.doc.study.source === 'none') return; // a new map was started meanwhile: nothing to keep yet
      // the map's id, name and contents are read together, before the picture is drawn: another map opened while
      // it is being drawn must not be saved under this one's id
      const id = store.mapId;
      const name = store.doc.title || store.doc.study.name || 'Untitled map';
      const data = store.serialize(true, false);
      if (svgEl && (thumb.id !== id || Date.now() - thumb.at > 20000)) {
        const url = await thumbnail(svgEl, store.doc.widthMm, store.doc.heightMm);
        if (store.mapId !== id) return; // the picture shows the other map now
        thumb = { id, at: Date.now(), url };
      }
      await putMap({ id, name, updated: Date.now(), thumb: thumb.id === id ? thumb.url : undefined, data }).catch(() => {});
    }, 2500);
  };

  // The last edit is saved at once when the page is closed, reloaded or put in the background.
  $effect(() => {
    const keep = () => store.flush();
    const hidden = () => { if (document.visibilityState === 'hidden') keep(); };
    window.addEventListener('pagehide', keep);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pagehide', keep); document.removeEventListener('visibilitychange', hidden); };
  });

  // Messages clear themselves after a while.
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const msg = store.status;
    clearTimeout(statusTimer);
    // Problems stay until the user dismisses them; plain notes go after a while.
    const problem = isProblem(msg);
    // a hint is read in a few seconds and should not keep covering the map
    if (msg && !problem) statusTimer = setTimeout(() => { if (store.status === msg) store.status = ''; }, Math.min(9000, 3500 + msg.length * 25));
  });

  function onKey(e: KeyboardEvent) {
    const tg = e.target as HTMLElement;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
    else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); }
    else if (e.key === 'Escape') { store.tool = 'select'; store.select(null);  store.addKind = null; store.pendingImage = null; store.drawTarget = null; store.detailPick = null; }
    else if (mod && e.key.toLowerCase() === 'g' && store.selected) { e.preventDefault(); if (e.shiftKey) ungroupParts(store.selection); else groupParts(store.selection); }
    else if (mod && e.key.toLowerCase() === 'd' && store.selected) { e.preventDefault(); if (store.extra.length) duplicateItems(store.selection); else duplicateItem(store.selected); }
    // Ctrl+B and Ctrl+I only: Ctrl+Shift+I and Ctrl+Shift+B belong to the browser. Every selected part with text is styled,
    // all taking the new value from the leading one, so a mixed group ends up all bold (or all regular).
    else if (mod && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i') && store.selected) {
      const withText = store.selection.map((id) => store.doc.items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.visible && !!itemText(i));
      if (withText.length) {
        e.preventDefault();
        if (!e.repeat) { // a held key does not flicker the style
          const lead = itemText(withText[0])!;
          setItemTexts(withText, e.key.toLowerCase() === 'b' ? { bold: !lead.bold } : { italic: !lead.italic });
        }
      }
    }
    else if (mod && e.key.toLowerCase() === 'c' && store.selected && !window.getSelection()?.toString()) { if (store.extra.length) copyItems(store.selection); else copyItem(store.selected); }
    else if (mod && e.key.toLowerCase() === 'v') { if (pasteItem()) e.preventDefault(); }
    // Delete and Backspace remove a part only when the keyboard is on the page (not on a panel button: Backspace there means "back")
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !(tg === document.body || tg?.closest?.('main'))) return;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected && store.extra.length) { e.preventDefault(); const n = store.selection.length, before = store.status; deleteItems(store.selection); if (store.status === before) store.told(t('{n} parts deleted.', { n })); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && store.selected) {
      const it = store.doc.items.find((i) => i.id === store.selected);
      if (it?.locked) { e.preventDefault(); store.status = t('This part is locked. Unlock it first (the padlock in the toolbar).'); return; }
      if (it && it.kind !== 'map') { e.preventDefault(); store.doc.items = store.doc.items.filter((i) => i !== it); store.select(null); store.commit(); store.told(t('Deleted. Undo brings it back.')); }
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<!-- every icon sits next to a visible word or inside a button with an aria-label, so screen readers skip the icons -->
<IconContext values={{ 'aria-hidden': 'true' }}>
<a class="skip" href="#map-page">{t('Skip to the map')}</a>
<div class="app" class:closed={!store.panelOpen}>
  <TopBar {svgEl} {findings} />
  <Rail />
  {#if store.panelOpen}<SidePanel {main} {scale} {svgEl} {findings} {credits} terrainOn={!!terrainHref} />{/if}
  <main class="center" id="map-page" tabindex="-1">
    {#if loadError}
      <p class="load-error" role="alert">{loadError} <button onclick={() => location.reload()}>{t('Reload the page')}</button></p>
    {/if}
    <Canvas {main} {insets} details={detailsDrawn} {scale} {credits} {labels} {terrainHref} {elevation} {basemapHref} bind:svgEl />
  </main>
</div>
<Tour />
</IconContext>

<style>
  .app {
    height: 100dvh;
    display: grid;
    grid-template-columns: 76px 340px minmax(0, 1fr);
    grid-template-rows: 56px minmax(0, 1fr);
    grid-template-areas: 'top top top' 'rail panel canvas';
  }
  .app.closed { grid-template-columns: 76px 0 minmax(0, 1fr); }
  .center { grid-area: canvas; position: relative; min-width: 0; min-height: 0; }
  .center:focus { outline: none; }
  .load-error button { margin-left: 6px; border: 1px solid currentColor; background: var(--panel); color: inherit; border-radius: 6px; padding: 3px 9px; font-weight: 600; }
  .load-error { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 3; background: var(--err-wash); color: var(--err); padding: 8px 12px; border-radius: var(--r-ctl); margin: 0; }
  @media (max-width: 1100px) {
    .app { grid-template-columns: 68px 300px minmax(0, 1fr); }
    .app.closed { grid-template-columns: 68px 0 minmax(0, 1fr); }
  }
  /* phones: the panel becomes a sheet under the map,
     and the map always keeps at least 160 px so it never disappears (also a short window, such as 200% zoom) */
  @media (max-width: 760px) {
    .app, .app.closed {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 56px minmax(160px, 1fr) auto 64px;
      grid-template-areas: 'top' 'canvas' 'panel' 'rail';
    }
  }
</style>
