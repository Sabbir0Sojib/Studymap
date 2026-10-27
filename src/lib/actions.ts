// Things the panels and the canvas do to the document.
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import { geoArea, geoBounds, geoCentroid } from 'd3-geo';
import { store, STUDY_GEOM, uid, defaultStyle, defaultItems, defaultLayers, detailGrid, makeLayer } from './store.svelte';
import type { DetailItem, Item, ShapeItem, TitleItem, InsetItem, NorthItem, Layer, LayerStyle, ProfileItem, TableItem } from './store.svelte';
import { frames } from './frames.svelte';
import { haversine } from './carto';
import { outline, pointExtent } from './place';
import type { PlaceHit } from './place';
import { detailFor, detailForBox, detailStart, featureBBox, mapScale, rewind, samplePoints } from './scene';
import type { DetailView } from './scene';
import { fitBounds, projectedBounds } from './projection';
import type { FrameProjection } from './projection';
import { boundaryMeta, countryList, featureName, loadBoundaries } from './data';
import type { AdminHit } from './adminsearch';
import { genericKind, kindName } from './adminsearch';
import { geoContains } from 'd3-geo';
import { applyTheme, THEMES, osmStyle, insetColour } from './themes';
import { applyDefaultStyle } from './mystyles';
import { applyTemplate } from './templates';
import { CUSTOM_PRESET, findPreset } from './journals';
import { textWidthMm } from './measure';
import { gridSettings } from './grid';
import { lastDrySeason, recentDay } from './imagery';
import { defaultCols, drawnLines, sitesLayers, tableData, tableLayout } from './figparts';

type CountryAt = (lon: number, lat: number) => { iso: string; name: string } | null;
const countryAt: CountryAt = (lon, lat) => ((globalThis as any).__countryAt?.(lon, lat) ?? null);

/** The first area of a new map gets the map style, then the user's own default style (My styles) on top. */
function freshLook() {
  // the empty page shows the world across the whole sheet; now the chosen layout arranges the real figure
  applyTemplate(store.doc, store.doc.templateId, true, true);
  applyTheme(store.doc, store.doc.themeId);
  applyDefaultStyle(store.doc, true);
}

function resetView() {
  store.doc.view = { padding: 0.12, panX: 0, panY: 0, zoom: 1 };
  store.doc.crs = null;
}

/** First area of a fresh map: turn terrain and the theme's look on. */
export function firstArea() {
  if (store.doc.study.source === 'none') freshLook();
}

/**
 * A layout's title line is made before the first area is chosen, so it says "Study area".
 * Call this once the study name is set: a title still holding that placeholder takes the name.
 */
export function syncPlaceholderTitle() {
  const name = store.doc.study.name;
  if (!name) return;
  const t = store.doc.items.find((i) => i.kind === 'title' && i.role === 'title');
  if (t && t.kind === 'title' && t.text === 'Study area') t.text = name;
}

/** Bumped by every way of choosing an area, so a slow lookup that finishes late is dropped. */
let placeSeq = 0;

/** The official unit that is the same area as an outline (it holds the outline's centre and is within 15% of its size). */
async function officialMatch(f: Feature<Geometry>): Promise<AdminHit | null> {
  f = rewind(JSON.parse(JSON.stringify(f))) as Feature<Geometry>; // d3 reads the winding: the wrong way round is the rest of the globe
  const c = geoCentroid(f as any) as [number, number];
  const ctry = countryAt(c[0], c[1]);
  if (!ctry) return null;
  let a0 = geoArea(f as any); if (a0 > 2 * Math.PI) a0 = 4 * Math.PI - a0;
  if (!a0) return null;
  for (const lvl of [1, 2, 3, 4]) {
    const meta = await boundaryMeta(ctry.iso, lvl).catch(() => null);
    if (!meta || meta.count > 6000) continue; // too many units to load for a match
    const fc = await loadBoundaries(meta).catch(() => null);
    if (!fc) continue;
    rewind(fc);
    const u = fc.features.find((x) => { if (!x.geometry) return false; const b = featureBBox(x); return c[0] >= b[0][0] && c[0] <= b[1][0] && c[1] >= b[0][1] && c[1] <= b[1][1] && geoContains(x as any, c); });
    if (!u) continue;
    let a = geoArea(u as any); if (a > 2 * Math.PI) a = 4 * Math.PI - a;
    const r = a / a0;
    if (r > 0.85 && r < 1.15) return { iso: ctry.iso, level: lvl, kind: kindName(meta.canonical, lvl), generic: genericKind(meta.canonical), id: String(u.properties?.__id), name: featureName(u) };
    if (r < 0.85) break; // the units are already smaller than the area: no finer level will match
  }
  return null;
}

export async function choosePlace(hit: PlaceHit) {
  let my = ++placeSeq;
  // Whole countries: the official land outline, not the OpenStreetMap border, which includes territorial sea.
  if (hit.kind === 'Country') {
    // an island country's centre is often at sea (Fiji): then it is found by its name
    const ctry = countryAt(hit.center[0], hit.center[1])
      ?? (await countryList().catch(() => [])).find((c) => c.name.toLowerCase() === hit.name.toLowerCase());
    if (my !== placeSeq) return;
    if (ctry) { wholeCountry(ctry.iso, ctry.name); return; }
  }
  store.busy = `Finding the outline of ${hit.name}…`;
  try {
    let f = await outline(hit);
    let level = 0;
    let name = hit.name;
    let note = '';
    // An OpenStreetMap outline that is an official area (a district, an upazila) is drawn from the official boundaries
    // instead, so it lines up exactly with the district and upazila lines around and inside it (two sources never do).
    if (f.geometry.type !== 'Point') {
      // at most a few seconds: a country with large boundary files keeps the OpenStreetMap outline instead of waiting
      const same = await Promise.race([officialMatch(f as Feature<Geometry>).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 3500))]);
      if (my !== placeSeq) return;
      if (same) {
        const picking = pickAdmin(same).catch(() => {});
        my = placeSeq; // pickAdmin starts its own turn at once; this search carries on as that turn
        await picking;
        if (my !== placeSeq) return;
        if (store.doc.study.source === 'admin' && store.doc.study.unitIds.includes(same.id)) {
          store.status = `Using the official outline of ${same.name}, so it lines up with the boundary lines around it.`;
          return;
        }
        // the official area could not be used: keep the OpenStreetMap outline
      }
    }
    if (f.geometry.type === 'Point') {
      // OpenStreetMap often maps a place as a point. Use the official area that contains it instead: the district
      // round a city, the smaller subdistrict (upazila) round a town or a village, so the map is about the right size.
      const [lon, lat] = f.geometry.coordinates as [number, number];
      const ctry = countryAt(lon, lat);
      if (ctry) {
        const small = !/city|capital|state|province|region|division|county|district/i.test(hit.kind);
        store.busy = `Finding the ${small ? 'area' : 'district'} around ${hit.name}…`;
        for (const lvl of small ? [3, 2, 1] : [2, 1]) {
          const meta = await boundaryMeta(ctry.iso, lvl).catch(() => null);
          if (!meta) continue;
          const fc = await loadBoundaries(meta).catch(() => null);
          if (fc) rewind(fc); // point-in-polygon needs the winding d3 expects
          const unit = fc?.features.find((u) => {
            if (!u.geometry) return false;
            const b = featureBBox(u);
            return lon >= b[0][0] && lon <= b[1][0] && lat >= b[0][1] && lat <= b[1][1] && geoContains(u as any, [lon, lat]);
          });
          if (unit) {
            rewind(unit);
            const unitName = String(unit.properties?.__name ?? unit.properties?.shapeName ?? hit.name);
            const kind = genericKind(meta.canonical) ? '' : meta.canonical.split(/[\/,]/)[0].trim().replace(/ies$/i, 'y').replace(/s$/i, '').toLowerCase();
            f = { type: 'Feature', properties: { name: unitName }, geometry: unit.geometry as Geometry };
            level = lvl;
            name = !kind || unitName.toLowerCase().includes(kind) ? unitName : `${unitName} ${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
            note = `Showing ${name}, the official area around ${hit.name}. Search again or draw if you need a different area.`;
            break;
          }
        }
      }
    }
    if (my !== placeSeq) return; // the user chose something else meanwhile
    const feats: Feature<Geometry>[] = [f];
    if (f.geometry.type === 'Point') feats.push(pointExtent(hit) as Feature<Geometry>);
    const fc: FeatureCollection = { type: 'FeatureCollection', features: feats };
    rewind(fc);
    firstArea();
    store.geoms = { ...store.geoms, [STUDY_GEOM]: fc };
    const c = f.geometry.type === 'Point' ? (f.geometry.coordinates as [number, number]) : (geoCentroid(f as any) as [number, number]);
    const ctry = countryAt(c[0], c[1]);
    const s = store.doc.study;
    store.doc.layers = store.doc.layers.filter((l) => !(l.kind === 'vector' && l.auto));
    s.within = undefined;
    s.source = 'place';
    s.name = name;
    syncPlaceholderTitle();
    s.osm = hit.osm;
    s.highlight = true;
    s.iso = ctry?.iso ?? '';
    s.countryName = ctry?.name ?? hit.detail.split(', ').pop() ?? '';
    s.level = level; s.unitIds = []; s.unitNames = [name]; s.fromLayer = undefined;
    const study = store.doc.layers.find((l) => l.kind === 'study');
    if (study) study.legendLabel = f.geometry.type === 'Point' ? name : 'Study area';
    if (!store.doc.title || store.doc.title === 'Untitled map' || store.doc.title.endsWith(' study area')) store.doc.title = `${name} study area`;
    resetView();
    store.commit();
    if (note) store.status = note;
    else if (f.geometry.type === 'Point') store.status = `No outline exists for ${hit.name}, so it is marked with a point. Draw an area if you need one.`;
  } catch (e) {
    store.status = (e as Error).message;
  } finally {
    if (my === placeSeq) store.busy = '';
  }
}

/**
 * A shape the user drew on the map, in lon/lat. The map stays exactly as the user saw it while drawing (as in QGIS);
 * "Zoom to it" frames the shape. On the empty world map the view goes to the new shape instead.
 * When it is drawn inside the place chosen before (a district, a park...), that place stays on the map as an outline.
 */
export function setDrawnArea(ring: [number, number][], add: boolean, seen: FrameProjection | null) {
  placeSeq++;
  if (ring.length < 4) return;
  const poly: Feature<Polygon> = { type: 'Feature', properties: { name: 'Study area' }, geometry: { type: 'Polygon', coordinates: [ring] } };
  rewind(poly);
  firstArea();
  const s = store.doc.study;
  const c = geoCentroid(poly as any) as [number, number];

  // Keep the place chosen before as context when the new shape sits inside it.
  if (s.source === 'place' || s.source === 'admin' || s.source === 'layer') {
    const before = (store.studyFeatures as Feature[]).filter((f) => f.geometry && !f.properties?.__extentOnly && f.geometry.type !== 'Point');
    const inside = before.some((f) => { try { return geoContains(f as any, c); } catch { return false; } });
    store.doc.layers = store.doc.layers.filter((l) => !(l.kind === 'vector' && l.auto));
    if (inside && s.name) {
      const id = uid('vector');
      store.geoms = { ...store.geoms, [id]: { type: 'FeatureCollection', features: before } };
      const studyIdx = store.doc.layers.findIndex((l) => l.kind === 'study');
      store.doc.layers.splice(studyIdx + 1, 0, {
        id, kind: 'vector', name: s.name, visible: true, inLegend: true, legendLabel: `${s.name} boundary`, auto: true,
        style: defaultStyle({ fill: 'none', stroke: '#26292B', strokePt: 1 }),
      });
      s.within = s.name;
    } else s.within = undefined;
  }

  const prev = add && s.source === 'drawn' ? (store.geoms[STUDY_GEOM]?.features ?? []) : [];
  store.geoms = { ...store.geoms, [STUDY_GEOM]: { type: 'FeatureCollection', features: [...prev, poly] } };
  const ctry = countryAt(c[0], c[1]);
  const step = Math.max(1, Math.floor(ring.length / 8));
  const many = new Set(ring.filter((_, i) => i % step === 0).map((p) => countryAt(p[0], p[1])?.iso).filter(Boolean)).size > 1;
  s.source = 'drawn';
  s.name = s.within ? `Study area in ${s.within}` : ctry && !many ? `Study area in ${ctry.name}` : 'Custom study area';
  syncPlaceholderTitle();
  s.highlight = true;
  s.iso = ctry?.iso ?? s.iso;
  s.countryName = ctry?.name ?? s.countryName;
  s.fromLayer = undefined;
  s.unitNames = []; s.unitIds = []; s.level = 0; s.osm = undefined;
  const study = store.doc.layers.find((l) => l.kind === 'study');
  if (study) study.legendLabel = 'Study area';
  resetView();
  if (seen) holdView(seen);
  const t = store.doc.title;
  if (!t || t === 'Untitled map' || t === 'Study area' || t.endsWith(' study area') || t.startsWith('Study area in ') || t === 'Custom study area') store.doc.title = s.name;
  store.commit();
}

/** Set zoom and pan so the map, now fitted to the new study area, shows the same frame as `seen`. */
function holdView(seen: FrameProjection) {
  const feats = (store.geoms[STUDY_GEOM]?.features ?? []) as Feature[];
  const b = projectedBounds(seen.crs, samplePoints(feats));
  if (!b) return;
  const v = store.doc.view;
  const fit = fitBounds(b, seen.widthMm, seen.heightMm, v.padding);
  const k = seen.k;
  store.doc.crs = seen.crs;
  v.zoom = k / fit.k;
  v.panX = (fit.center[0] - seen.center[0]) * k;
  v.panY = (seen.center[1] - fit.center[1]) * k;
}

export function fitToArea() {
  resetView();
  store.commit();
}

/** Lon/lat ring for a circle on the ground (radius in metres). */
export function circleRing(center: [number, number], radiusM: number, n = 96): [number, number][] {
  const R = 6371008.8;
  const [lon0, lat0] = center.map((v) => (v * Math.PI) / 180);
  const d = radiusM / R;
  const ring: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const brg = (2 * Math.PI * i) / n;
    const lat = Math.asin(Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(brg));
    const lon = lon0 + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(lat0), Math.cos(d) - Math.sin(lat0) * Math.sin(lat));
    ring.push([(lon * 180) / Math.PI, (lat * 180) / Math.PI]);
  }
  return ring;
}

/* ---------- adding elements ---------- */

function centreBox(w: number, h: number) {
  const m = store.map;
  return { x: Math.round((m.x + m.w / 2 - w / 2) * 10) / 10, y: Math.round((m.y + m.h / 2 - h / 2) * 10) / 10, w, h };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * A spot for a new part: the first of `tries` that is on the page and clear of other parts (the map itself
 * does not count), otherwise the first one stepped down and right until it no longer sits exactly on another.
 */
function freeBox(w: number, h: number, tries: [number, number][], skip?: Item) {
  const W = store.doc.widthMm, H = store.doc.heightMm;
  const others = store.doc.items.filter((i) => i.visible && i !== skip && i.kind !== 'map').map((i) => ({ x: Math.min(i.x, i.x + i.w), y: Math.min(i.y, i.y + i.h), w: Math.abs(i.w), h: Math.abs(i.h) }));
  const inPage = (x: number, y: number) => x >= 0 && y >= 0 && x + w <= W && y + h <= H;
  // the first free spot that leaves the study area clear; if none is clear, the free spot hiding the least of it
  const cover = store.cover;
  let best: { x: number; y: number; w: number; h: number } | null = null, bestCover = Infinity;
  for (const [x, y] of tries) {
    if (!inPage(x, y) || others.some((o) => overlaps({ x, y, w, h }, o))) continue;
    const c = cover ? cover({ x, y, w, h }) : 0;
    if (c < 0.02) return { x: r1(x), y: r1(y), w, h };
    if (c < bestCover) { bestCover = c; best = { x: r1(x), y: r1(y), w, h }; }
  }
  if (best) return best;
  let [x, y] = tries[0];
  for (let k = 0; k < 12 && others.some((o) => Math.abs(o.x - x) < 2 && Math.abs(o.y - y) < 2); k++) { x += 5; y += 5; }
  return { x: r1(Math.min(Math.max(0, x), W - w)), y: r1(Math.min(Math.max(0, y), H - h)), w, h };
}

/** Candidate spots beside the map (when the page has room) and in its corners, 3 mm in. */
function cornerTries(w: number, h: number): [number, number][] {
  const m = store.map, W = store.doc.widthMm, H = store.doc.heightMm, g = 3;
  const beside: [number, number][] = [];
  if (W - (m.x + m.w) >= w + 4) beside.push([m.x + m.w + 3, m.y], [m.x + m.w + 3, m.y + m.h - h]);
  if (H - (m.y + m.h) >= h + 4) beside.push([m.x, m.y + m.h + 3], [m.x + m.w - w, m.y + m.h + 3]);
  // in a side column or bottom strip: just under (or beside) a part already there, filling the gap
  for (const o of store.doc.items) {
    if (!o.visible || o.kind === 'map' || o.kind === 'shape') continue;
    if (o.x >= m.x + m.w && W - (m.x + m.w) >= w + 4) beside.push([o.x, o.y + o.h + 3]);
    if (o.y >= m.y + m.h && H - (m.y + m.h) >= h + 4) beside.push([o.x + o.w + 3, o.y]);
  }
  const midX = m.x + (m.w - w) / 2, midY = m.y + (m.h - h) / 2;
  // corners first, then the middle of each edge (when every corner is taken)
  return [...beside, [m.x + m.w - w - g, m.y + g], [m.x + g, m.y + g], [m.x + m.w - w - g, m.y + m.h - h - g], [m.x + g, m.y + m.h - h - g],
    [m.x + g, midY], [m.x + m.w - w - g, midY], [midX, m.y + g], [midX, m.y + m.h - h - g]];
}

function add(it: Item) {
  store.doc.items.push(it);
  store.select(it.id);
  store.commit();
}

export function addText(kind: 'title' | 'subtitle' | 'label' | 'note' | 'text') {
  const presets: Record<string, Partial<TitleItem>> = {
    title: { text: store.doc.study.name || 'Study area', labelPt: 12, bold: true },
    subtitle: { text: 'Location of sampling sites', labelPt: 9, bold: false },
    label: { text: '(a)', labelPt: 9, bold: true },
    note: { text: 'Note', labelPt: 7, bold: false, italic: true },
    text: { text: 'Text', labelPt: 9, bold: false },
  };
  const p = presets[kind];
  const fs = (p.labelPt! * 25.4) / 72;
  const w = r1(Math.max(kind === 'label' ? 6 : 24, textWidthMm(p.text!, p.labelPt!, !!p.bold) + 2));
  const h = r1(fs * 1.1 + 0.6);
  const m = store.map, c = centreBox(w, h);
  // coordinates written outside the map frame take room above and below it, which new text must keep clear of
  const g = m.grid?.show ? gridSettings(m.grid) : null;
  const band = (side: 'top' | 'bottom') => (g && g.ann[side].show !== 'none' && g.ann[side].pos === 'out' ? (g.ann[side].dir === 'v' ? 9 : (m.grid.labelPt * 25.4) / 72 + g.gap + 1.5) : 0);
  // a title goes above the map: with no room there, the map moves down to make it (as a "titled" layout does)
  if (kind === 'title') {
    const need = h + 2 + band('top') - m.y;
    if (need > 0 && m.h - need >= 40) { m.y = r1(m.y + need); m.h = r1(m.h - need); }
  }
  // a title above the map, a panel letter in its top-left corner, a note under it; anything else in the middle
  const tries: [number, number][] =
    kind === 'title' ? [[m.x, m.y - band('top') - h - 1], [m.x + 3, m.y + 3]]
    : kind === 'label' ? [[m.x + 2, m.y + 1.5], [m.x + m.w - w - 2, m.y + 1.5]]
    : kind === 'note' ? [[m.x, m.y + m.h + band('bottom') + 1], [m.x + 3, m.y + m.h - h - 3]]
    : [[c.x, c.y], [c.x, c.y + h + 2], [c.x, c.y - h - 2]];
  add({ id: uid('title'), kind: 'title', ...freeBox(w, h, tries), visible: true, text: p.text!, labelPt: p.labelPt!, bold: !!p.bold, italic: p.italic, color: '#1B1F1D', align: 'start', autoW: true });
}

export function addShape(shape: ShapeItem['shape']) {
  const line = shape === 'line' || shape === 'arrow';
  const c = centreBox(line ? 24 : 20, line ? 12 : 14);
  add({ id: uid('shape'), kind: 'shape', shape, ...freeBox(c.w, c.h, [[c.x, c.y]]), visible: true, stroke: '#D55E00', strokePt: 1, fill: '#D55E00', fillOpacity: line ? 0 : 0.12, dash: false });
}

export function addInset(context: InsetItem['context']) {
  const existing = store.doc.items.find((i) => i.kind === 'inset' && i.context === context && !i.visible);
  if (existing) {
    // shown again where it was, unless something else now sits there
    const clash = store.doc.items.some((i) => i.visible && i !== existing && i.kind !== 'map' && overlaps(existing, i));
    if (clash) Object.assign(existing, freeBox(existing.w, existing.h, cornerTries(existing.w, existing.h), existing));
    existing.visible = true; keepOnPage(); store.select(existing.id); store.commit(); return;
  }
  const size = context === 'globe' ? 34 : 40;
  const h = context === 'globe' ? size : 34;
  add({ id: uid('inset'), kind: 'inset', context, ...freeBox(size, h, cornerTries(size, h)), visible: true, showExtent: true, extentColor: insetColour(store.doc), label: '', labelPt: 7 });
}

/* ---------- detail maps (a second map frame: a zoomed-in part of the study area, or another panel of it) ---------- */

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** the scales a detail map can be given: 1:50 (a plot) to 1:500,000,000 (the world on a page) */
const SCALE_MIN = 50, SCALE_MAX = 5e8;

/** "Detail map", or "Detail map 2" when the page has more than one. */
export function detailName(it: DetailItem): string {
  const all = store.doc.items.filter((i) => i.kind === 'detail');
  return all.length > 1 ? `Detail map ${all.findIndex((i) => i.id === it.id) + 1}` : 'Detail map';
}

/** The feature picked on the map (a name, an area, a point, a line) as a GeoJSON feature, or null. */
function pickedFeature(): Feature | null {
  const p = store.picked;
  const l = p && store.doc.layers.find((x) => x.id === p.layerId);
  if (!p || !l) return null;
  const feats = l.kind === 'admin' && l.adminLevel ? ((store.adminLevels[l.adminLevel]?.features ?? []) as Feature[]) : layerFeatures(l);
  const nameOf = (f: Feature) => String(f.properties?.name ?? f.properties?.__name ?? '');
  // a shape drawn by hand without a name is told apart by its place in its layer (#0, #1…)
  const hit = p.name[0] === '#' ? feats[Number(p.name.slice(1))] : feats.find((f) => nameOf(f) === p.name);
  return hit?.geometry ? hit : null;
}

/**
 * Add a detail map: a second frame on the page with the same layers, at 3 times the scale of the main map and the study area's
 * middle (or round the feature picked on the map), with a zoom box on the main map and lines from it to the new frame.
 * It is put right after the main map in the stacking order, so the parts on the main map (legend, north arrow) stay above its lines.
 */
export function addDetail(): DetailItem | null {
  const main = frames.main;
  if (!main || store.doc.study.source === 'none') { store.status = 'Choose a place first, then add a detail map.'; return null; }
  const W = store.doc.widthMm, H = store.doc.heightMm;
  const w = r1(Math.min(50, W * 0.4)), h = r1(Math.min(46, H * 0.4));
  const feat = pickedFeature();
  const onePoint = feat?.geometry && /Point/.test(feat.geometry.type) && !/Multi/.test(feat.geometry.type);
  const start = detailStart(main);
  const view = feat ? (onePoint && start ? { centre: [round6((feat.geometry as any).coordinates[0]), round6((feat.geometry as any).coordinates[1])] as [number, number], scale: start.scale } : detailFor(main, w, h, [feat], 0.15)) ?? start : start;
  if (!view) { store.status = 'The detail map needs the main map on show.'; return null; }
  const it: DetailItem = {
    id: uid('detail'), kind: 'detail', ...freeBox(w, h, cornerTries(w, h)), visible: true,
    centre: view.centre, scale: view.scale, grid: detailGrid(), framePt: 0.6, label: '', labelPt: 8,
    showBox: true, boxColor: insetColour(store.doc), connect: true,
  };
  const at = store.doc.items.findIndex((i) => i.kind === 'map');
  store.doc.items.splice(at + 1, 0, it);
  store.select(it.id);
  keepOnPage();
  store.commit();
  return it;
}

/** The frame projection a detail map is drawn with now (null while it cannot be drawn). */
const detailFp = (d: DetailItem) => frames.details[d.id]?.scene.fp ?? null;

/** Show another view in a detail map. */
export function setDetailView(d: DetailItem, v: DetailView) {
  d.centre = v.centre;
  d.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, v.scale));
  store.commit();
}

/** Move what a detail map shows by (dx, dy) mm on the page, as when its content is dragged. */
export function panDetail(d: DetailItem, dx: number, dy: number) {
  const c = detailFp(d)?.inverse([d.w / 2 - dx, d.h / 2 - dy]);
  if (!c) return;
  d.centre = [round6(c[0]), round6(c[1])];
  store.commit();
}

/** Zoom a detail map by factor f (2 = twice as close) about a point of its frame (mm; unset = its middle), which stays where it is. */
export function zoomDetail(d: DetailItem, f: number, at?: [number, number]) {
  const fp = detailFp(d);
  if (!fp || !(f > 0)) return;
  const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, d.scale / f));
  const real = d.scale / scale;
  const g = fp.toCrs(at ?? [d.w / 2, d.h / 2]), c = fp.center;
  const c2: [number, number] = [g[0] + (c[0] - g[0]) / real, g[1] + (c[1] - g[1]) / real];
  const ll = fp.inverse(fp.fromCrs(c2));
  if (ll) d.centre = [round6(ll[0]), round6(ll[1])];
  d.scale = scale;
  store.commit();
}

/** Zoom a detail map, about its middle, so it prints at exactly 1:denominator. */
export function setDetailScale(d: DetailItem, denominator: number) {
  if (!(denominator > 0)) return;
  d.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(denominator)));
  store.commit();
}

/** Show the whole study area in a detail map (a second panel of the same ground), or round the study area's middle. */
export function fitDetailToArea(d: DetailItem) {
  const main = frames.main;
  const feats = store.studyFeatures.filter((f) => !f.properties?.__extentOnly) as Feature[];
  const v = main && feats.length ? detailFor(main, d.w, d.h, feats) : null;
  if (v) setDetailView(d, v);
  else store.status = 'The detail map needs a study area to fit to.';
}

/** The box dragged on the main map (main mm) becomes what the detail map shows. */
export function setDetailBox(d: DetailItem, box: { x0: number; y0: number; x1: number; y1: number }) {
  const main = frames.main;
  const v = main ? detailForBox(main, d.w, d.h, box) : null;
  if (v) setDetailView(d, v);
  else store.status = 'Drag a bigger box on the main map to choose what the detail map shows.';
}

/** A table or chart that lands on the map gets a white backing, so the map's lines do not run through its numbers. */
function whiteOnMap(it: Item) {
  const m = store.map, cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  if (cx > m.x && cx < m.x + m.w && cy > m.y && cy < m.y + m.h) it.look = { bg: '#ffffff' };
}

/** The smallest text size the journal in use asks for, but never under 7 pt: what a table or chart starts with. */
const startPt = () => Math.max(7, findPreset(store.doc.presetId).minFontPt);

/**
 * Add a table of the sample sites of a points layer (the given one, else the first on show): the label column, latitude and
 * longitude, as wide and tall as its rows. Returns null, with a word on the status line, when there are no sample points yet.
 */
export function addTable(layerId?: string): TableItem | null {
  const layers = sitesLayers(store.doc, store.geoms);
  const l = layers.find((x) => x.id === layerId) ?? layers.find((x) => x.visible) ?? layers[0];
  if (!l) { store.status = 'Add sample points first (Add, Add your own), then make a table of them.'; return null; }
  const it: TableItem = { id: uid('table'), kind: 'table', x: 0, y: 0, w: 60, h: 30, visible: true, layer: l.id, cols: defaultCols(l, store.geoms[l.id]), coord: 'dms', labelPt: startPt(), zebra: false, frame: false, title: '' };
  const d = tableData(it, store.doc, store.geoms);
  if (d) {
    const lay = tableLayout({ ...it, w: 0, h: 0 }, d);
    it.w = Math.ceil(Math.min(lay.natW, store.doc.widthMm - 4) * 10 - 1e-6) / 10;
    it.h = Math.ceil(Math.min(lay.natH, store.doc.heightMm - 4) * 10 - 1e-6) / 10;
  }
  Object.assign(it, freeBox(it.w, it.h, cornerTries(it.w, it.h)));
  whiteOnMap(it);
  add(it);
  keepOnPage();
  return it;
}

/**
 * Add an elevation profile: a chart of the ground along a line drawn on the map (the given one, else the one drawn last).
 * Its heights are read from the terrain tiles by the desk (figparts.svelte.ts) as soon as the part is on the page.
 */
export function addProfile(ref?: string): ProfileItem | null {
  const lines = drawnLines(store.doc, store.geoms);
  const ln = lines.find((x) => x.ref === ref) ?? lines[lines.length - 1];
  if (!ln) { store.status = 'Draw a line on the map first (the tool strip, Draw on the map, Line), then make a profile of it.'; return null; }
  const w = r1(Math.min(70, store.doc.widthMm - 12)), h = r1(Math.min(40, store.doc.heightMm - 12));
  const stroke = ln.layer.style.stroke;
  const it: ProfileItem = { id: uid('profile'), kind: 'profile', ...freeBox(w, h, cornerTries(w, h)), visible: true, line: ln.ref, color: /^#[0-9a-f]{6}$/i.test(stroke) ? stroke : '#0072B2', labelPt: startPt(), ends: true, extremes: false, exag: true };
  whiteOnMap(it);
  add(it);
  keepOnPage();
  return it;
}

/** Group parts so they are picked, moved and aligned as one (Ctrl+G). A part is in one group at a time. */
export function groupParts(ids: string[]): boolean {
  const its = store.doc.items.filter((i) => ids.includes(i.id) && i.kind !== 'map');
  if (its.length < 2) return false;
  const g = uid('grp');
  for (const i of its) i.group = g;
  store.commit();
  store.told(`${its.length} parts grouped. Click one to pick the group; click again to pick only that part.`);
  return true;
}

/** Take the groups of these parts apart again (Ctrl+Shift+G). */
export function ungroupParts(ids: string[]): boolean {
  const gs = new Set(store.doc.items.filter((i) => ids.includes(i.id) && i.group).map((i) => i.group));
  if (!gs.size) return false;
  for (const i of store.doc.items) if (i.group && gs.has(i.group)) delete i.group;
  store.commit();
  store.told('Ungrouped.');
  return true;
}

/** Show or hide a part. One shown again moves to a free place if something else now covers its old one
 *  (a globe locator switched on under the country locator would show nothing). */
export function togglePart(it: Item) {
  it.visible = !it.visible;
  if (it.visible && it.kind !== 'map') {
    const clash = store.doc.items.some((i) => i.visible && i !== it && i.kind !== 'map' && overlaps(it, i));
    if (clash) Object.assign(it, freeBox(it.w, it.h, cornerTries(it.w, it.h), it));
    keepOnPage();
  }
  if (!it.visible && store.extra.length && store.selection.includes(it.id)) store.toggleExtra(it.id);
  store.commit();
}

export function addNorth(style: NorthItem['style']) {
  const n = store.doc.items.find((i) => i.kind === 'north') as NorthItem | undefined;
  if (n) { n.style = style; n.visible = true; store.select(n.id); store.commit(); return; }
  add({ id: uid('north'), kind: 'north', ...freeBox(8, 14, cornerTries(8, 14).slice(-4)), visible: true, style, trueNorth: true, backdrop: true });
}

export function showItem(kind: 'scale' | 'legend' | 'credits') {
  let it = store.doc.items.find((i) => i.kind === kind);
  if (!it) {
    // deleted earlier: put the default one back
    it = defaultItems(store.doc.widthMm, store.doc.heightMm).find((i) => i.kind === kind);
    if (!it) return;
    store.doc.items.push(it);
  }
  it.visible = true;
  keepOnPage(); // a part hidden while the page shrank comes back on the page
  store.select(it.id);
  store.commit();
}

export function lonLatBoundsOf(fc: FeatureCollection): [[number, number], [number, number]] {
  return geoBounds(fc as any) as [[number, number], [number, number]];
}

/** An official boundary picked from the instant search. `add` keeps earlier picks of the same level (several districts). */
export async function pickAdmin(h: AdminHit, add = false) {
  const s = store.doc.study;
  placeSeq++;
  const countryName = (await countryList().catch(() => [])).find((c) => c.iso === h.iso)?.name ?? s.countryName;
  const same = add && s.source === 'admin' && s.iso === h.iso && s.level === h.level;
  if (!same) {
    if (s.source === 'none') freshLook();
    s.unitIds = []; s.unitNames = [];
  }
  if (s.unitIds.includes(h.id)) return;
  const full = h.generic || h.name.toLowerCase().includes(h.kind.toLowerCase()) ? h.name : `${h.name} ${h.kind}`;
  s.source = 'admin';
  s.iso = h.iso;
  s.countryName = countryName;
  s.level = h.level;
  s.unitIds.push(h.id);
  s.unitNames.push(full);
  s.name = joinNames(s.unitNames);
  syncPlaceholderTitle();
  s.highlight = true;
  s.fromLayer = undefined;
  s.within = undefined;
  const study = store.doc.layers.find((l) => l.kind === 'study');
  if (study) study.legendLabel = 'Study area';
  const t = store.doc.title;
  if (!t || t === 'Untitled map' || t.endsWith(' study area') || t.startsWith('Study area')) store.doc.title = `${s.name} study area`;
  resetView();
  store.commit();
}

/* ---------- map scale (as in the QGIS status bar) ---------- */

// the scale of a frame lives with the scenes (a detail map is made from it); the panels and the scale box ask for it here
export { mapScale };

/** Zoom the map, about its centre, so it prints at exactly 1:denominator. */
export function setMapScale(fp: FrameProjection, denominator: number) {
  const now = mapScale(fp);
  if (!now || !(denominator > 0)) return;
  const f = now / denominator;
  const v = store.doc.view;
  const zoom = Math.min(5000, Math.max(0.01, v.zoom * f));
  const g = zoom / v.zoom;
  v.zoom = zoom;
  v.panX *= g; v.panY *= g;
  store.commit();
}

/* ---------- zoom to layer ---------- */

/** The features a layer draws, when they can be framed (world-wide layers such as rivers cannot). */
export function layerFeatures(l: Layer): Feature[] {
  switch (l.kind) {
    case 'study': return store.studyFeatures.filter((f) => !f.properties?.__extentOnly) as Feature[];
    case 'admin': return (store.adminFc?.features ?? []) as Feature[];
    case 'subunits': return (store.subFc?.features ?? []) as Feature[];
    case 'countries': return store.countryFeature ? [store.countryFeature as Feature] : [];
    case 'vector': case 'points': case 'osm': return (store.geoms[l.id]?.features ?? []) as Feature[];
    default: return [];
  }
}

/** Frame the map on one layer (QGIS "Zoom to layer"). "Zoom to it" on the Place panel goes back to the study area. */
export function zoomToLayer(l: Layer) {
  const feats = layerFeatures(l).filter((f) => f.geometry);
  if (!feats.length) { store.status = `${l.name} has nothing to zoom to yet.`; return; }
  const b = geoBounds({ type: 'FeatureCollection', features: feats } as any) as [[number, number], [number, number]];
  if (!b.flat().every(Number.isFinite)) return;
  // a single point or a tiny layer still gets a sensible window of about 2 km
  const padX = Math.max((b[1][0] - b[0][0]) * 0.06, 0.01), padY = Math.max((b[1][1] - b[0][1]) * 0.06, 0.01);
  store.doc.view = { padding: 0, panX: 0, panY: 0, zoom: 1, extent: [[b[0][0] - padX, b[0][1] - padY], [b[1][0] + padX, b[1][1] + padY]] };
  store.doc.crs = null;
  store.commit();
}

/* ---------- adding and deleting layers ---------- */

/** A boundaries layer at one level (1 division/state, 2 district, 3 sub-district...), drawn above the area. */
export function addBoundaryLayer(level: number, kind: string) {
  const same = store.doc.layers.find((x) => x.kind === 'admin' && (x.adminLevel === level || x.legendLabel === `${kind} boundary` || x.name === `${kind} boundaries`));
  if (same) { same.visible = true; store.select(same.id, true); store.status = `${kind} boundaries are already on the map; here are their settings.`; store.commit(); return; }
  const look = level <= 1 ? { stroke: '#4A4A46', strokePt: 0.7, dash: false } : level === 2 ? { stroke: '#77776F', strokePt: 0.45, dash: true } : { stroke: '#A3A39C', strokePt: 0.3, dash: false };
  const l = makeLayer('admin', `${kind} boundaries`, { fill: 'none', labelField: '', labelPt: 7, ...look }, { legendLabel: `${kind} boundary`, adminLevel: level });
  const i = store.doc.layers.findIndex((x) => x.kind === 'study');
  store.doc.layers.splice(i + 1, 0, l);
  store.commit();
}

/** Put back one of the standard layers (rivers, lakes, countries...) after it was deleted. */
export function addStandardLayer(kind: Layer['kind']) {
  const l = defaultLayers().find((x) => x.kind === kind);
  if (!l) return;
  l.visible = true;
  // it comes back in the colours of the map style in use, not the original defaults
  const ts = THEMES.find((t) => t.id === store.doc.themeId)?.styles[kind];
  if (ts) Object.assign(l.style, ts);
  const i = store.doc.layers.findIndex((x) => x.kind === 'study');
  store.doc.layers.splice(kind === 'countries' || kind === 'terrain' ? 1 : i + 1, 0, l);
  store.commit();
}

/** The look of a new OpenStreetMap layer: the colours of the map style in use, over plain blue and tan. */
export function osmLayerStyle(theme: 'water' | 'roads'): LayerStyle {
  const plain = theme === 'water' ? { fill: '#CFE3EE', stroke: '#4F8FB3', strokePt: 0.6 } : { fill: 'none', stroke: '#B3A58F', strokePt: 0.45 };
  return defaultStyle({ ...plain, ...osmStyle(store.doc.themeId, theme) });
}

/** OpenStreetMap rivers and water, or roads, for the current view. */
export function addOsmLayer(theme: 'water' | 'roads') {
  // small areas already get this layer automatically: show that one rather than draw the same data twice
  const same = store.doc.layers.find((x) => x.kind === 'osm' && x.osmTheme === theme);
  if (same) { same.visible = true; store.select(same.id, true); store.status = `${same.name} is already on the map; here are its settings.`; store.commit(); return; }
  const water = theme === 'water';
  const l = makeLayer('osm', water ? 'Rivers and water (detailed)' : 'Roads', osmLayerStyle(theme), { osmTheme: theme, legendLabel: water ? 'River and water body' : 'Road' });
  const i = store.doc.layers.findIndex((x) => x.kind === 'study');
  store.doc.layers.splice(i + 1, 0, l);
  store.commit();
}

/** Contour lines traced from the elevation data for the map on the page (interval 0: chosen from the relief in view). */
export function addContours(interval = 0) {
  const have = store.doc.layers.find((l) => l.contour);
  if (have) { have.visible = true; have.contour = { ...have.contour!, interval }; store.select(have.id, true); store.commit(); return have.id; }
  const l = makeLayer('vector', 'Contours', { fill: 'none', fillOpacity: 0, stroke: '#9C7A54', strokePt: 0.25, symbol: 'circle', sizePt: 4, labelField: '' }, { contour: { interval }, legendLabel: 'Contour' });
  // above the land and terrain, under the boundaries and the study area outline
  const i = store.doc.layers.findIndex((x) => x.kind === 'admin' || x.kind === 'subunits' || x.kind === 'study');
  store.doc.layers.splice(i < 0 ? store.doc.layers.length : i, 0, l);
  store.select(l.id, true);
  store.commit();
  return l.id;
}

/** Towns and cities with their names, from OpenStreetMap, loaded for the area on the map (and again when it moves). */
export function addTownsLayer() {
  const have = store.doc.layers.find((l) => l.kind === 'points' && l.osmTheme === 'places');
  if (have) { have.visible = true; store.select(have.id, true); store.commit(); return have.id; }
  const l = makeLayer('points', 'Towns and cities', { fill: '#1B1F1D', stroke: '#ffffff', strokePt: 0.4, fillOpacity: 1, symbol: 'circle', sizePt: 3.5, labelField: 'name', labelPt: 7 }, { osmTheme: 'places', legendLabel: 'Town', source: '© OpenStreetMap contributors (openstreetmap.org/copyright)' });
  store.doc.layers.push(l);
  store.select(l.id, true);
  store.commit();
  return l.id;
}

export function deleteLayer(l: Layer) {
  if (l.kind === 'study' || l.kind === 'sea') return;
  if (l.kind === 'osm' && l.auto) store.doc.noAutoDetail = true;
  store.doc.layers = store.doc.layers.filter((x) => x !== l);
  if (store.doc.study.fromLayer === l.id) { store.doc.study.fromLayer = undefined; store.doc.study.source = 'none'; }
  if (store.selected === l.id) store.select(null);
  // drawing into it: stop, or clicks would go on adding to a layer that is gone
  if (store.drawTarget === l.id) { store.drawTarget = null; store.tool = 'select'; }
  store.commit();
}

/* ---------- your own layer, drawn by hand ---------- */

const CUSTOM_COLOURS = ['#0072B2', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#D55E00'];

/** A new empty layer to draw points, lines and areas into (like a new shapefile layer in QGIS). */
export function addCustomLayer(): string {
  const n = store.doc.layers.filter((l) => l.kind === 'vector' && l.source === undefined && !l.auto).length + 1;
  const col = CUSTOM_COLOURS[(n - 1) % CUSTOM_COLOURS.length];
  const l = makeLayer('vector', `My layer ${n}`, { fill: col, fillOpacity: 0.2, stroke: col, strokePt: 0.8, symbol: 'circle', sizePt: 5 }, { legendLabel: `My layer ${n}`, custom: true });
  store.geoms = { ...store.geoms, [l.id]: { type: 'FeatureCollection', features: [] } };
  // above the study area and the boundary layers, so areas coloured from a table never cover the drawing
  const i = Math.max(...(['study', 'admin', 'subunits'] as const).map((k) => store.doc.layers.findIndex((x) => x.kind === k)));
  store.doc.layers.splice(i + 1, 0, l);
  store.commit();
  store.select(l.id, true);
  return l.id;
}

/**
 * Distance rings (a buffer, as in QGIS) round sample sites or round the centre of the study area: one dashed circle per
 * distance, each named "5 km", in their own layer with a legend line. Up to 60 sites, so the map stays readable.
 */
/** Distance rings at round distances that suit the size of the study area (or the spacing of a few sites). */
export function addRingsAuto(around: string | 'centre'): string | null {
  const b = store.studyFeatures.length ? geoBounds({ type: 'FeatureCollection', features: store.studyFeatures } as any) : null;
  // half the larger side of the area, km: rings up to that size stay on a map of the area
  const R = b ? Math.max(haversine([b[0][0], b[0][1]], [b[1][0], b[0][1]]), haversine([b[0][0], b[0][1]], [b[0][0], b[1][1]])) / 2000 : 20;
  // the largest round distance not above v: 1, 2, 2.5, 5, 10, 20, 25, 50…
  const nice = (v: number) => { const p = 10 ** Math.floor(Math.log10(v)); return [10, 5, 2.5, 2, 1].map((m) => m * p).find((x) => x <= v * 1.05) ?? p; };
  const radii = around === 'centre' ? [nice(R * 0.35), nice(R * 0.7), nice(R)] : [nice(R / 10), nice(R / 5)];
  return addRings(radii, around);
}

export function addRings(radiiKm: number[], around: string | 'centre'): string | null {
  const km = [...new Set(radiiKm.filter((r) => r > 0 && r <= 2000))].sort((a, b) => a - b);
  if (!km.length) return null;
  let centres: [number, number][] = [];
  if (around === 'centre') {
    if (!store.studyFeatures.length) { store.status = 'Choose a place first.'; return null; }
    centres = [geoCentroid({ type: 'FeatureCollection', features: store.studyFeatures } as any) as [number, number]];
  } else {
    const fc = store.geoms[around];
    for (const f of fc?.features ?? []) if (f.geometry?.type === 'Point') centres.push(f.geometry.coordinates as [number, number]);
    if (!centres.length) { store.status = 'That layer has no points to draw rings round.'; return null; }
    if (centres.length > 60) { store.status = 'Rings round more than 60 sites would cover the map. Pick fewer sites, or rings round the centre.'; return null; }
  }
  const features: Feature[] = [];
  for (const c of centres) for (const r of km) features.push({ type: 'Feature', properties: { name: `${r} km` }, geometry: { type: 'LineString', coordinates: circleRing(c, r * 1000) } });
  const name = `Distance rings (${km.join(', ')} km)`;
  const l = makeLayer('vector', name, { fill: 'none', fillOpacity: 0, stroke: '#1B1F1D', strokePt: 0.5, dash: true, symbol: 'circle', sizePt: 4 }, { legendLabel: `Distance from ${around === 'centre' ? 'the centre' : 'the sites'}`, custom: true });
  store.geoms = { ...store.geoms, [l.id]: { type: 'FeatureCollection', features } };
  store.doc.layers.push(l);
  store.select(l.id, true);
  store.commit();
  store.autosave();
  return l.id;
}

/**
 * Start drawing on the map itself (points, lines, areas, freehand), like the drawing tools of a GIS:
 * the shapes go into one "My drawing" layer, made the first time, so they move with the map, get a legend line
 * and can be restyled in that layer's settings. Returns false when there is no map to draw on yet.
 */
export function drawOnMap(tool: 'point' | 'line' | 'polygon' | 'freehand'): boolean {
  if (store.doc.study.source === 'none') { store.status = 'Choose a place first, then draw on its map.'; return false; }
  let l = store.doc.layers.find((x) => x.kind === 'vector' && x.custom && x.name === 'My drawing');
  if (!l) {
    const id = addCustomLayer();
    l = store.doc.layers.find((x) => x.id === id);
    if (!l) return false;
    l.name = 'My drawing';
    l.legendLabel = 'My drawing';
  }
  if (!l.visible) l.visible = true;
  store.addKind = null;
  store.select(l.id, true);
  store.drawTarget = l.id;
  store.tool = tool;
  store.status = ({
    point: 'Click on the map to place points. Press Done when finished.',
    line: 'Click each point of the line. Double-click, Enter or Esc finishes it.',
    polygon: 'Click each corner of the area. Double-click, Enter or Esc finishes it.',
    freehand: 'Hold the mouse down and draw. Each stroke is one shape.',
  } as const)[tool];
  return true;
}

/** Add one drawn shape (page mm already turned into lon/lat) to a layer. */
export function addToLayer(id: string, geometry: Geometry) {
  const fc = store.geoms[id] ?? { type: 'FeatureCollection', features: [] };
  const f: Feature = { type: 'Feature', properties: { name: '' }, geometry };
  rewind(f as any);
  store.geoms = { ...store.geoms, [id]: { ...fc, features: [...fc.features, f] } };
  store.commit();
  store.autosave(); // the shapes live outside the document, so save them now
}

/** Satellite base map, drawn below your area and boundaries. */
export function addBasemapLayer(id: 's2cloudless' | 'viirs' | 'modis' | 'hls' = 's2cloudless') {
  // the dated NASA pictures start on a recent day, or (HLS, 30 m) the last dry season, which has the clearest sky
  const date = id === 'hls' ? lastDrySeason() : id === 'viirs' || id === 'modis' ? recentDay() : undefined;
  const l = makeLayer('basemap', 'Satellite base map', { fill: 'none', stroke: 'none' }, { inLegend: false, legendLabel: 'Satellite image', basemap: { id, clip: 'all', opacity: 1, date } });
  const i = store.doc.layers.findIndex((x) => x.kind === 'study');
  store.doc.layers.splice(Math.max(1, i), 0, l);
  store.commit();
  store.select(l.id, true);
}

/* ---------- study-type recipes ---------- */

export type RecipeId = 'sites' | 'river' | 'coast' | 'urban' | 'terrain';
/** What each kind of study usually shows on its location map, set up in one click (each part can still be changed). */
export const RECIPES: { id: RecipeId; name: string; note: string }[] = [
  { id: 'sites', name: 'Sampling sites', note: 'A plain map that makes your sites stand out; add your table next.' },
  { id: 'river', name: 'River or catchment', note: 'Rivers and water bodies, with the relief that shapes them.' },
  { id: 'coast', name: 'Coastal area', note: 'Detailed water and coastline, the sea named.' },
  { id: 'urban', name: 'Urban area', note: 'Main roads and town names around the area.' },
  { id: 'terrain', name: 'Hills and land cover', note: 'Shaded relief with contour lines.' },
];

export function applyRecipe(id: RecipeId) {
  if (store.doc.study.source === 'none') { store.status = 'Choose a place first, then a recipe.'; return; }
  const L = store.doc.layers;
  const show = (kind: Layer['kind'], on: boolean) => { for (const l of L) if (l.kind === kind) l.visible = on; if (on && !L.some((l) => l.kind === kind)) addStandardLayer(kind); };
  const terrain = (on: boolean, auto = true) => { show('terrain', on); const t = L.find((l) => l.kind === 'terrain'); if (t?.terrain) t.terrain.auto = auto; };
  const osm = (theme: 'water' | 'roads', on: boolean) => {
    const l = L.find((x) => x.kind === 'osm' && x.osmTheme === theme);
    if (on && !l) addOsmLayer(theme); else if (l) l.visible = on;
  };
  if (id === 'sites') {
    show('rivers', false); osm('water', false); osm('roads', false); terrain(false);
    store.status = 'Set up for sampling sites. Next: Map parts, Add, Sample points, and paste or open your table.';
  } else if (id === 'river') {
    show('rivers', true); show('lakes', true); osm('water', true); terrain(true, false);
    store.status = 'Set up for a river or catchment: rivers, water bodies and shaded relief.';
  } else if (id === 'coast') {
    show('sea', true); osm('water', true); terrain(false);
    store.status = 'Set up for a coastal area: detailed water and coastline.';
  } else if (id === 'urban') {
    osm('roads', true); addTownsLayer(); terrain(false);
    store.status = 'Set up for an urban area: main roads and town names.';
  } else if (id === 'terrain') {
    terrain(true, false); addContours(0);
    store.status = 'Set up for hills and land cover: shaded relief and contour lines.';
  }
  store.select(null);
  store.commit();
}

/* ---------- layout (QGIS layout manager style) ---------- */

/** Bring an item one step forward (+1) or back (-1) in the drawing order. */
export function restack(id: string, dir: 1 | -1 | 'front' | 'back') {
  const a = store.doc.items;
  const i = a.findIndex((x) => x.id === id);
  if (i < 0) return;
  let j: number;
  if (dir === 'front') j = a.length - 1;
  else if (dir === 'back') j = 0;
  else {
    // one step means past the next part that is on show: stepping past a hidden one changes nothing you can see
    j = i + dir;
    while (j >= 0 && j < a.length && !a[j].visible) j += dir;
    j = Math.max(0, Math.min(a.length - 1, j));
  }
  if (j === i) return;
  const [it] = a.splice(i, 1);
  a.splice(j, 0, it);
  store.commit();
}

/** Align an item to the page margins (5 mm), or to the map frame when it sits on the map. */
export function alignItem(id: string, how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
  const it = store.doc.items.find((x) => x.id === id);
  if (!it || it.locked) return;
  const m = store.doc.items.find((x) => x.kind === 'map' && x.visible);
  const x0 = Math.min(it.x, it.x + it.w), y0 = Math.min(it.y, it.y + it.h);
  const onMap = m && it !== m && x0 >= m.x && y0 >= m.y && x0 + Math.abs(it.w) <= m.x + m.w && y0 + Math.abs(it.h) <= m.y + m.h;
  const g = onMap ? 3 : 5;
  const box = onMap ? { x: m!.x, y: m!.y, w: m!.w, h: m!.h } : { x: 0, y: 0, w: store.doc.widthMm, h: store.doc.heightMm };
  const r = (v: number) => Math.round(v * 10) / 10;
  if (how === 'left') it.x = r(box.x + g);
  if (how === 'right') it.x = r(box.x + box.w - g - it.w);
  if (how === 'hcenter') it.x = r(box.x + (box.w - it.w) / 2);
  if (how === 'top') it.y = r(box.y + g);
  if (how === 'bottom') it.y = r(box.y + box.h - g - it.h);
  if (how === 'vcenter') it.y = r(box.y + (box.h - it.h) / 2);
  it.pinned = true;
  store.commit();
}

/** Read a picture file, scaled down to at most 1600 px so the project stays small. */
export async function readPicture(file: File): Promise<{ href: string; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    let nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) {
      // an SVG with only a viewBox has no size of its own in some browsers (Firefox): take its shape from the viewBox
      const vb = file.type === 'image/svg+xml' ? new DOMParser().parseFromString(await file.text(), 'image/svg+xml').documentElement.getAttribute('viewBox') : null;
      const [, , vw, vh] = (vb ?? '').split(/[\s,]+/).map(Number);
      const ratio = vw > 0 && vh > 0 ? vh / vw : 1;
      nw = 1600; nh = Math.round(1600 * ratio);
    }
    const s = Math.min(1, 1600 / Math.max(nw, nh));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(nw * s));
    c.height = Math.max(1, Math.round(nh * s));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const png = file.type === 'image/png' || file.type === 'image/svg+xml';
    return { href: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), ratio: nh / nw };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Put a new item from the layout palette into the box the user dragged (or centred on a click). */
export function addInBox(kind: NonNullable<typeof store.addKind>, box: { x: number; y: number; w: number; h: number } | null, at: [number, number]) {
  const before = store.selected;
  const had = (kind === 'legend' || kind === 'scale' || kind === 'north') && store.doc.items.some((i) => i.kind === kind && i.visible);
  if (kind === 'text') addText('text');
  else if (kind === 'legend') showItem('legend');
  else if (kind === 'scale') showItem('scale');
  else if (kind === 'north') addNorth('arrow');
  else if (kind === 'locator') addInset('country');
  else if (kind === 'detail') addDetail();
  else if (kind === 'rect' || kind === 'ellipse' || kind === 'line' || kind === 'arrow') addShape(kind);
  else if (kind === 'table') addTable();
  else if (kind === 'profile') addProfile();
  else if (kind === 'image') {
    if (!store.pendingImage) return;
    const dragged = box && (Math.abs(box.w) > 3 || Math.abs(box.h) > 3);
    add({ id: uid('image'), kind: 'image', x: 0, y: 0, w: dragged ? Math.abs(box!.w) : 30, h: dragged ? Math.abs(box!.h) : 20, visible: true, href: store.pendingImage, fit: 'contain', frame: false });
    store.pendingImage = null;
  }
  const it = store.doc.items.find((i) => i.id === store.selected);
  if (!it || (it.id === before && kind !== 'legend' && kind !== 'scale' && kind !== 'north')) return;
  const r = (v: number) => Math.round(v * 10) / 10;
  if (box && (Math.abs(box.w) > 3 || Math.abs(box.h) > 3)) {
    const line = it.kind === 'shape' && (it.shape === 'line' || it.shape === 'arrow');
    if (line) { it.x = r(at[0] - box.w); it.y = r(at[1] - box.h); it.w = r(box.w); it.h = r(box.h); }
    else { it.x = r(Math.min(box.x, box.x + box.w)); it.y = r(Math.min(box.y, box.y + box.h)); it.w = r(Math.abs(box.w)); it.h = r(Math.abs(box.h)); }
    if (it.kind === 'title') it.autoW = false; // a box dragged out keeps its width; the text wraps inside it
    if (it.kind === 'north') it.h = r(it.w * 1.75);
  } else {
    it.x = r(at[0] - it.w / 2); it.y = r(at[1] - it.h / 2);
  }
  const W = store.doc.widthMm, H = store.doc.heightMm;
  if (it.w > 0 && it.w <= W) it.x = r(Math.min(Math.max(0, it.x), W - it.w));
  if (it.h > 0 && it.h <= H) it.y = r(Math.min(Math.max(0, it.y), H - it.h));
  if (had)
    store.status = `Moved the ${kind === 'legend' ? 'legend' : kind === 'scale' ? 'scale bar' : 'north arrow'} here (a map has one).`;
  it.pinned = true;
  store.commit();
}

/* ---------- duplicate, copy and paste ---------- */

/** What Ctrl+C took: each part as JSON, in stacking order, and which of them led the selection. */
let clipboard: string[] = [];
let clipboardLead = 0;
/** A new part made from a part's JSON, moved `offset` mm down and right, placed by hand and unlocked. */
function cloneItem(json: string, offset: number): Item {
  const copy = JSON.parse(json) as Item;
  copy.id = uid(copy.kind);
  copy.x = r1(copy.x + offset); copy.y = r1(copy.y + offset);
  copy.pinned = true;
  copy.locked = false;
  return copy;
}
/** Put copies on the page and select them as a group led by `lead` (one part is a group of one). */
function addCopies(copies: Item[], lead: Item) {
  store.doc.items.push(...copies);
  store.select(lead.id);
  store.extra = copies.filter((c) => c !== lead).map((c) => c.id);
  store.commit();
}
/** The parts in the order they are painted, lowest first, whatever order they were picked in. */
function stacked(its: Item[]): Item[] {
  const z = (i: Item) => store.doc.items.findIndex((x) => x.id === i.id);
  return [...its].sort((a, b) => z(a) - z(b));
}
/** A copy of a part, 4 mm down and right (the main map is never copied). */
export function duplicateItem(id: string) {
  const it = store.doc.items.find((i) => i.id === id);
  if (!it || it.kind === 'map') return;
  const copy = cloneItem(JSON.stringify(it), 4);
  addCopies([copy], copy);
}
export function copyItem(id: string) {
  const it = store.doc.items.find((i) => i.id === id);
  if (!it || it.kind === 'map') return;
  clipboard = [JSON.stringify(it)];
  clipboardLead = 0;
  store.status = 'Copied. Press Ctrl+V to paste.';
}
/** Copy all the selected parts at once (Shift+click group). */
export function copyItems(ids: string[]) {
  const picked = groupItems(ids);
  if (!picked.length) return;
  const its = stacked(picked);
  clipboard = its.map((i) => JSON.stringify(i));
  clipboardLead = Math.max(0, its.indexOf(picked[0]));
  store.status = its.length > 1 ? `Copied ${its.length} parts. Press Ctrl+V to paste.` : 'Copied. Press Ctrl+V to paste.';
}
/** Paste what was copied, 6 mm down and right; several parts come back as a selected group. */
export function pasteItem(): boolean {
  if (!clipboard.length) return false;
  const copies = clipboard.map((json) => cloneItem(json, 6));
  addCopies(copies, copies[clipboardLead] ?? copies[0]);
  return true;
}

/** Make a whole country the study area, drawn from its official (land) boundary. */
export function wholeCountry(iso: string, name: string) {
  placeSeq++;
  const s = store.doc.study;
  if (s.source === 'none') freshLook();
  s.source = 'admin'; s.iso = iso; s.countryName = name; s.name = name; s.level = 0;
  syncPlaceholderTitle();
  s.unitIds = []; s.unitNames = []; s.highlight = true; s.fromLayer = undefined; s.within = undefined;
  const study = store.doc.layers.find((l) => l.kind === 'study');
  if (study) study.legendLabel = 'Study area';
  const t = store.doc.title;
  if (!t || t === 'Untitled map' || t.endsWith(' study area') || t.startsWith('Study area')) store.doc.title = `${name} study area`;
  resetView();
  store.commit();
}

/** Read a typed scale: "1:50,000", "50000", "50.000" or "50 000" all mean 50000. Null when it is not a usable scale. */
export function parseScale(text: string): number | null {
  let s = text.trim().replace(/^1\s*:\s*/, '').replace(/\s+/g, '');
  s = s.replace(/[.,](?=\d{3}(\D|$))/g, ''); // thousands separators
  s = s.replace(',', '.');
  const d = Number(s);
  return isFinite(d) && d >= 1 && d <= 1e9 ? d : null;
}

/** Size the figure for a journal column (or 'custom'), keeping the chosen layout and a dpi the journal accepts. */
export function setJournal(id: string) {
  const p = id === 'custom' ? CUSTOM_PRESET : findPreset(id);
  store.doc.presetId = p.id;
  if (p.id !== 'custom') store.doc.widthMm = p.widthMm;
  applyTemplate(store.doc, store.doc.templateId);
  if (store.doc.heightMm > p.maxHeightMm) store.doc.heightMm = p.maxHeightMm;
  if (!p.formats.includes(store.doc.exportFormat)) store.doc.exportFormat = p.formats[0];
  if (store.doc.exportDpi < p.minDpi) store.doc.exportDpi = [300, 600, 1000, 1200].find((v) => v >= p.minDpi) ?? 1200;
  keepOnPage(); // parts the layout does not arrange (your texts, shapes, pictures) stay on the new page
  store.commit();
}

/* ---------- the page itself: extend or shrink any side ---------- */

export const PAGE_MIN = 50, PAGE_MAX = 1000;
export type PageSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Move one edge of the page by `delta` mm (whole mm, within 50 to 1000). Everything on the page keeps its place
 * on the paper: moving the left or top edge shifts the parts so they stay where they were. Returns the change made.
 */
export function resizePage(side: PageSide, delta: number): number {
  const d = store.doc;
  const horiz = side === 'left' || side === 'right';
  const cur = horiz ? d.widthMm : d.heightMm;
  const next = Math.min(PAGE_MAX, Math.max(PAGE_MIN, Math.round(cur + delta)));
  const real = next - cur;
  if (!real) return 0;
  if (horiz) { d.widthMm = next; d.presetId = 'custom'; } else d.heightMm = next;
  if (side === 'left') { for (const it of d.items) it.x = r1(it.x + real); if (d.guides) d.guides.x = d.guides.x.map((g) => g + real); }
  if (side === 'top') { for (const it of d.items) it.y = r1(it.y + real); if (d.guides) d.guides.y = d.guides.y.map((g) => g + real); }
  return real;
}

/** Bring parts that stick out of the page back onto it (made smaller only if larger than the page). Returns how many. */
export function keepOnPage(): number {
  const d = store.doc, W = d.widthMm, H = d.heightMm;
  let moved = 0;
  for (const it of d.items) {
    if (!it.visible) continue;
    const before = `${it.x},${it.y},${it.w},${it.h}`;
    const line = it.kind === 'shape' && (it.shape === 'line' || it.shape === 'arrow');
    if (line) {
      // lines may run either way: shift the pair of end points as one
      const x0 = Math.min(it.x, it.x + it.w), x1 = Math.max(it.x, it.x + it.w), y0 = Math.min(it.y, it.y + it.h), y1 = Math.max(it.y, it.y + it.h);
      if (x1 > W) it.x = r1(it.x - Math.min(x1 - W, x0)); else if (x0 < 0) it.x = r1(it.x - x0);
      if (y1 > H) it.y = r1(it.y - Math.min(y1 - H, y0)); else if (y0 < 0) it.y = r1(it.y - y0);
    } else {
      if (it.w > W) it.w = W;
      if (it.h > H) it.h = H;
      if (it.x + it.w > W) it.x = r1(W - it.w);
      if (it.y + it.h > H) it.y = r1(H - it.h);
      if (it.x < 0) it.x = 0;
      if (it.y < 0) it.y = 0;
    }
    if (`${it.x},${it.y},${it.w},${it.h}` !== before) { it.pinned = true; moved++; }
  }
  return moved;
}

/** Shrink the page to what is on it, with an even margin all round. */
/** Mm box of what is drawn outside the parts' own boxes: grid numbers beside a map frame, labels under a locator.
 *  Read from the drawn page (text that is not clipped inside a map), so the trim never cuts them off. */
export function drawnTextBox(): { x0: number; y0: number; x1: number; y1: number } | null {
  const svg = document.querySelector<SVGSVGElement>('svg.figure');
  if (!svg) return null;
  const r = svg.getBoundingClientRect();
  if (!r.width) return null;
  const k = store.doc.widthMm / r.width;
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  for (const t of svg.querySelectorAll('text')) {
    if (t.closest('[clip-path]') || !t.textContent?.trim()) continue;
    const b = t.getBoundingClientRect();
    if (!b.width) continue;
    const x0 = (b.left - r.left) * k, x1 = (b.right - r.left) * k, y0 = (b.top - r.top) * k, y1 = (b.bottom - r.top) * k;
    box = box ? { x0: Math.min(box.x0, x0), y0: Math.min(box.y0, y0), x1: Math.max(box.x1, x1), y1: Math.max(box.y1, y1) } : { x0, y0, x1, y1 };
  }
  return box;
}

export function trimPage(margin = 3) {
  const d = store.doc;
  const vis = d.items.filter((i) => i.visible && (d.study.source !== 'none' || i.kind === 'map'));
  if (!vis.length) return;
  const ink = drawnTextBox();
  const x0 = Math.min(...vis.map((i) => Math.min(i.x, i.x + i.w)), ink?.x0 ?? Infinity), x1 = Math.max(...vis.map((i) => Math.max(i.x, i.x + i.w)), ink?.x1 ?? -Infinity);
  const y0 = Math.min(...vis.map((i) => Math.min(i.y, i.y + i.h)), ink?.y0 ?? Infinity), y1 = Math.max(...vis.map((i) => Math.max(i.y, i.y + i.h)), ink?.y1 ?? -Infinity);
  resizePage('left', margin - x0);
  resizePage('top', margin - y0);
  resizePage('right', x1 + (margin - x0) + margin - d.widthMm);
  resizePage('bottom', y1 + (margin - y0) + margin - d.heightMm);
  keepOnPage();
  store.commit();
}

/* ---------- text style from the toolbar: bold, italic and size of the part's main text ---------- */

/** The main text of a part (its title, entries, numbers or label), or null when it has none to style. */
export function itemText(it: Item): { bold: boolean; italic: boolean; size: number | null } | null {
  switch (it.kind) {
    case 'title': return { bold: it.bold, italic: !!it.italic, size: it.labelPt };
    case 'legend': return { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt };
    case 'scale': return { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt };
    case 'credits': return { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt };
    case 'table': return { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt };
    case 'profile': return { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt };
    case 'inset': return it.label ? { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt } : null;
    case 'detail': return it.label || it.scaleText ? { bold: !!it.text?.bold, italic: !!it.text?.italic, size: it.labelPt } : null;
    case 'north': return { bold: it.text?.bold ?? true, italic: !!it.text?.italic, size: null };
    default: return null;
  }
}

type TextPatch = { bold?: boolean; italic?: boolean; size?: number };

/** Change a part's main text without committing, so several parts can share one undo step. */
function applyText(it: Item, patch: TextPatch) {
  const size = patch.size === undefined ? undefined : Math.round(Math.min(48, Math.max(4, patch.size)) * 2) / 2;
  if (it.kind === 'title') {
    if (patch.bold !== undefined) it.bold = patch.bold;
    if (patch.italic !== undefined) it.italic = patch.italic;
    if (size !== undefined) it.labelPt = size;
  } else if (it.kind === 'legend' || it.kind === 'scale' || it.kind === 'credits' || it.kind === 'inset' || it.kind === 'detail' || it.kind === 'north' || it.kind === 'table' || it.kind === 'profile') {
    const t = { ...(it.text ?? {}) };
    if (patch.bold !== undefined) t.bold = patch.bold;
    if (patch.italic !== undefined) t.italic = patch.italic;
    it.text = t;
    if (size !== undefined && it.kind !== 'north') it.labelPt = size;
  }
}

export function setItemText(it: Item, patch: TextPatch) {
  applyText(it, patch);
  store.commit();
}

/** The same change for every part that has text (a Shift+click group), as one undo step. */
export function setItemTexts(items: Item[], patch: TextPatch) {
  let n = 0;
  for (const it of items) if (itemText(it)) { applyText(it, patch); n++; }
  if (n) store.commit();
}

/** Every text on the figure regular, bold or italic at once (Design, Text). */
export function setAllText(how: 'regular' | 'bold' | 'italic') {
  const t = { bold: how === 'bold', italic: how === 'italic' };
  const d = store.doc;
  // every layer, also those with names off: the names take this look when they are turned on later
  for (const l of d.layers) l.style.labelStyle = { ...(l.style.labelStyle ?? {}), ...t };
  for (const it of d.items) {
    if (it.kind === 'title') { it.bold = t.bold; it.italic = t.italic; }
    else if (it.kind === 'legend') { it.text = { ...(it.text ?? {}), ...t }; it.titleText = { ...(it.titleText ?? {}), ...t }; }
    else if (it.kind === 'scale' || it.kind === 'credits' || it.kind === 'north' || it.kind === 'inset' || it.kind === 'detail' || it.kind === 'table' || it.kind === 'profile') it.text = { ...(it.text ?? {}), ...t };
    if ((it.kind === 'map' || it.kind === 'inset' || it.kind === 'detail') && it.grid) it.grid.text = { ...(it.grid.text ?? {}), ...t };
  }
  store.status = how === 'regular' ? 'All text is regular now.' : `All text is ${how} now.`;
  store.commit();
}

/* ---------- several parts at once (Shift+click) ---------- */

/** The parts of a group: never the main map, and never a part that was hidden after it joined the group. */
const groupItems = (ids: string[]) => ids.map((id) => store.doc.items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.kind !== 'map' && i.visible);
const boxOf = (i: Item) => ({ x0: Math.min(i.x, i.x + i.w), y0: Math.min(i.y, i.y + i.h), x1: Math.max(i.x, i.x + i.w), y1: Math.max(i.y, i.y + i.h) });

/** Line the parts up with each other: their shared left, centre, right, top, middle or bottom. */
export function alignGroup(ids: string[], how: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom') {
  const its = groupItems(ids);
  if (its.length < 2) return;
  const bs = its.map(boxOf);
  const X0 = Math.min(...bs.map((b) => b.x0)), X1 = Math.max(...bs.map((b) => b.x1)), Y0 = Math.min(...bs.map((b) => b.y0)), Y1 = Math.max(...bs.map((b) => b.y1));
  its.forEach((it, k) => {
    if (it.locked) return;
    const b = bs[k], w = b.x1 - b.x0, h = b.y1 - b.y0;
    let dx = 0, dy = 0;
    if (how === 'left') dx = X0 - b.x0;
    if (how === 'right') dx = X1 - b.x1;
    if (how === 'hcenter') dx = (X0 + X1) / 2 - (b.x0 + w / 2);
    if (how === 'top') dy = Y0 - b.y0;
    if (how === 'bottom') dy = Y1 - b.y1;
    if (how === 'vcenter') dy = (Y0 + Y1) / 2 - (b.y0 + h / 2);
    it.x = r1(it.x + dx); it.y = r1(it.y + dy); it.pinned = true;
  });
  store.commit();
}

/** Equal gaps between three or more parts, across or down. */
export function distributeGroup(ids: string[], axis: 'x' | 'y') {
  const all = groupItems(ids);
  const its = all.filter((i) => !i.locked);
  if (its.length < 3) { store.status = 'Spacing needs 3 or more parts that are not locked. Select a locked part on its own and unlock it with the padlock in the toolbar.'; return; }
  const list = its.map((it) => ({ it, b: boxOf(it) })).sort((a, b) => (axis === 'x' ? a.b.x0 - b.b.x0 : a.b.y0 - b.b.y0));
  const start = axis === 'x' ? list[0].b.x0 : list[0].b.y0;
  const end = Math.max(...list.map((l) => (axis === 'x' ? l.b.x1 : l.b.y1)));
  const sizes = list.reduce((t, l) => t + (axis === 'x' ? l.b.x1 - l.b.x0 : l.b.y1 - l.b.y0), 0);
  const gap = (end - start - sizes) / (list.length - 1);
  // a part that spans or holds the others leaves no room: moving them would stack parts on top of each other
  if (gap < -0.05) { store.status = 'These parts overlap too much to be spaced evenly. Select only the parts you want spread out.'; return; }
  let at = start;
  for (const { it, b } of list) {
    const d = at - (axis === 'x' ? b.x0 : b.y0);
    if (axis === 'x') it.x = r1(it.x + d); else it.y = r1(it.y + d);
    it.pinned = true;
    at += (axis === 'x' ? b.x1 - b.x0 : b.y1 - b.y0) + gap;
  }
  const left = all.length - its.length;
  if (left) store.status = `${left} locked part${left > 1 ? 's were' : ' was'} left in place.`;
  store.commit();
}

export function deleteItems(ids: string[]) {
  const all = groupItems(ids);
  const gone = new Set(all.filter((i) => !i.locked).map((i) => i.id));
  const left = all.length - gone.size;
  if (left) store.status = `${left} locked part${left > 1 ? 's were' : ' was'} left in place. To delete ${left > 1 ? 'them' : 'it'}, select ${left > 1 ? 'each' : 'it'} on its own and unlock it with the padlock in the toolbar.`;
  if (!gone.size) return;
  store.doc.items = store.doc.items.filter((i) => !gone.has(i.id));
  store.select(null);
  store.commit();
}

/** Copies of all the selected parts, 4 mm down and right, selected as a group. They keep the originals' stacking order. */
export function duplicateItems(ids: string[]) {
  const src = groupItems(ids);
  if (!src.length) return;
  const copyOf = new Map<string, Item>();
  const copies = stacked(src).map((it) => {
    const c = cloneItem(JSON.stringify(it), 4);
    copyOf.set(it.id, c);
    return c;
  });
  addCopies(copies, copyOf.get(src[0].id)!);
}

/* ---------- several areas on one map (Dhaka and Gazipur together) ---------- */

/** "Dhaka", "Dhaka and Gazipur", "Dhaka, Gazipur and Narsingdi". */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The areas the map shows now, each with its own name (before any merging). */
export function currentAreas(): Feature<Geometry>[] {
  const s = store.doc.study;
  const parts = (store.studyParts.length ? store.studyParts : store.studyFeatures)
    .filter((f) => f.geometry && !f.properties?.__extentOnly && f.geometry.type !== 'Point' && f.geometry.type !== 'MultiPoint');
  return parts.map((f, i) => {
    const id = String(f.properties?.__id ?? '');
    const idx = s.unitIds.indexOf(id);
    const name = (idx >= 0 ? s.unitNames[idx] : '') || String(f.properties?.name ?? '') || (parts.length === 1 ? s.name : '') || String(f.properties?.__name ?? `Area ${i + 1}`);
    return { type: 'Feature', properties: { name, __name: name }, geometry: JSON.parse(JSON.stringify(f.geometry)) } as Feature<Geometry>;
  });
}

/** Names of the areas on the map, for the list in Place. */
export function areaNames(): string[] {
  const s = store.doc.study;
  if (s.source === 'none') return [];
  if (s.unitNames.length > 1) return s.unitNames;
  return [s.name];
}

/**
 * Add another area to the map: any search result (an official unit of any level or country, a city, a lake,
 * a park...). Units of the same country and level stay official units; anything else is joined as shapes.
 */
export async function addArea(r: { admin?: AdminHit; place?: PlaceHit }) {
  const s = store.doc.study;
  if (s.source === 'none') { if (r.admin) await pickAdmin(r.admin); else if (r.place) await choosePlace(r.place); return; }
  if (r.admin && s.source === 'admin' && s.iso === r.admin.iso && s.level === r.admin.level) {
    if (s.merge === undefined) s.merge = true;
    await pickAdmin(r.admin, true);
    store.status = `Added ${r.admin.name}. The areas are shown as one; change it under "Show as" in Place.`;
    return;
  }
  const my = ++placeSeq;
  let f: Feature<Geometry> | null = null;
  let name = '';
  if (r.admin) {
    const h = r.admin;
    name = h.name.toLowerCase().includes(h.kind.toLowerCase()) ? h.name : `${h.name} ${h.kind}`;
    if (h.feat?.geometry) f = { type: 'Feature', properties: {}, geometry: JSON.parse(JSON.stringify(h.feat.geometry)) };
  } else if (r.place) {
    name = r.place.name;
    store.busy = `Finding the outline of ${name}…`;
    try { f = await outline(r.place); } catch (e) { store.status = (e as Error).message; } finally { if (my === placeSeq) store.busy = ''; }
    if (f && (f.geometry.type === 'Point' || f.geometry.type === 'MultiPoint')) {
      store.status = `${name} has no outline to join. Search for its district instead, or draw it.`;
      return;
    }
  }
  if (!f || my !== placeSeq) return;
  const parts = currentAreas();
  if (parts.some((p) => p.properties?.name === name)) { store.status = `${name} is already on your map.`; return; }
  f.properties = { name, __name: name };
  const fc: FeatureCollection = { type: 'FeatureCollection', features: [...parts, f] };
  rewind(fc);
  store.geoms = { ...store.geoms, [STUDY_GEOM]: fc };
  const names = fc.features.map((p) => String(p.properties?.name ?? ''));
  const before = s.name;
  s.source = 'place';
  s.unitIds = []; s.unitNames = names; s.level = 0;
  s.osm = undefined; s.fromLayer = undefined; s.within = undefined;
  s.name = joinNames(names);
  if (s.merge === undefined) s.merge = true;
  const study = store.doc.layers.find((l) => l.kind === 'study');
  if (study) study.legendLabel = 'Study area';
  const t = store.doc.title;
  if (!t || t === 'Untitled map' || t === `${before} study area` || t.endsWith(' study area')) store.doc.title = `${s.name} study area`;
  syncPlaceholderTitle();
  resetView();
  store.commit();
  store.status = `Added ${name}. ${s.merge ? 'The areas are shown as one' : 'Each area is shown on its own'}; change it under "Show as" in Place.`;
}

/** Take one area off the map (the last one stays: use Start over for that). */
export function removeArea(index: number) {
  const s = store.doc.study;
  if (s.source === 'admin' && s.unitIds.length > 1) {
    s.unitIds.splice(index, 1);
    s.unitNames.splice(index, 1);
  } else {
    const fc = store.geoms[STUDY_GEOM];
    const parts = (fc?.features ?? []).filter((f) => !f.properties?.__extentOnly);
    if (parts.length < 2) return;
    parts.splice(index, 1);
    store.geoms = { ...store.geoms, [STUDY_GEOM]: { type: 'FeatureCollection', features: parts } };
    s.unitNames = parts.map((p) => String(p.properties?.name ?? ''));
  }
  const old = s.name;
  s.name = joinNames(s.unitNames);
  if (store.doc.title === `${old} study area`) store.doc.title = `${s.name} study area`;
  resetView();
  store.commit();
}

/** How several areas are drawn: one merged area, separate outlines, or each in its own colour with its own legend line. */
export function setAreaDisplay(mode: 'one' | 'separate' | 'colours') {
  store.doc.study.merge = mode === 'one';
  const study = store.doc.layers.find((l) => l.kind === 'study');
  if (study) { study.style.byUnit = mode === 'colours'; if (mode === 'colours') study.style.hatch = false; }
  store.commit();
}
