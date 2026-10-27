<script lang="ts">
  // Settings for whatever is selected: a page element or a map layer.
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import Trash from 'phosphor-svelte/lib/Trash';
  import { store, OKABE_ITO } from '../../lib/store.svelte';
  import type { DetailItem, InsetItem, Item, Layer, LegendItem, MapItem, NorthItem, ProfileItem, ScaleItem, CreditsItem, TableItem, TitleItem, ShapeItem } from '../../lib/store.svelte';
  import type { MainScene } from '../../lib/scene';
  import type { ScaleBarSpec } from '../../lib/carto';
  import { fmtNumber } from '../../lib/carto';
  import { fetchEpsg } from '../../lib/projection';
  import { areaDeg2, fetchOsm, MAX_AREA_DEG2 } from '../../lib/osm';
  import { rewind } from '../../lib/scene';
  import DataPanel from '../DataPanel.svelte';
  import MapPanel from './MapPanel.svelte';
  import GridPanel from './GridPanel.svelte';
  import { availableLevels } from '../../lib/data';
  import { kindName } from '../../lib/adminsearch';
  import { deleteLayer, detailName, firstArea, readPicture, syncPlaceholderTitle } from '../../lib/actions';
  import { BUILTIN_FONTS, ensureFont, fontLabel, fonts, fontStack } from '../../lib/fonts.svelte';
  import { TEXT, look } from '../../lib/textstyle';
  import { luminance } from '../../lib/palettes';
  import TextStyleRow from './TextStyleRow.svelte';
  import EntryList from './EntryList.svelte';
  import type { EntryRow } from './EntryList.svelte';
  import SpecialChars from './SpecialChars.svelte';
  import PointsStylePanel from './PointsStylePanel.svelte';
  import ChoroplethPanel from './ChoroplethPanel.svelte';
  import ColorPicker from '../ColorPicker.svelte';
  import FeaturePanel from '../FeaturePanel.svelte';
  import AppearanceSection from '../AppearanceSection.svelte';
  import ShapeSection from '../ShapeSection.svelte';
  import TableSection from './TableSection.svelte';
  import ProfileSection from './ProfileSection.svelte';
  import DetailPanel from './DetailPanel.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { main, scale }: { main: MainScene | null; scale: ScaleBarSpec | null } = $props();
  const selItem = $derived<Item | undefined>(store.doc.items.find((i) => i.id === store.selected));
  const selLayer = $derived<Layer | undefined>(store.doc.layers.find((l) => l.id === store.selected));
  const c = () => store.commit();
  // the visible letter comes first, so the name of each box starts with what is written beside it
  const EDGE: Record<string, string> = { x: 'X, Left edge (mm)', y: 'Y, Top edge (mm)', w: 'W, Width (mm)', h: 'H, Height (mm)' };
  // Keep keyboard focus in the panel: clicking a layer row removes that button, which would drop focus to the page.
  let heading = $state<HTMLElement>();
  // the head stays on show while the body scrolls under it, with a hairline once something has scrolled beneath
  let headEl = $state<HTMLElement>();
  let scrolled = $state(false);
  $effect(() => {
    const body = headEl?.closest('.body');
    if (!body) return;
    const on = () => (scrolled = body.scrollTop > 2);
    on();
    body.addEventListener('scroll', on, { passive: true });
    return () => body.removeEventListener('scroll', on);
  });
  $effect(() => {
    store.selected; // run again when another part or layer is picked
    const h = heading;
    queueMicrotask(() => {
      const a = document.activeElement;
      if (h && (!a || a === document.body)) h.focus({ preventScroll: true });
    });
  });
  const COLOURS: [string, string][] = [['#D55E00', 'vermillion'], ['#0072B2', 'blue'], ['#009E73', 'bluish green'], ['#E69F00', 'orange'], ['#56B4E9', 'sky blue'], ['#CC79A7', 'reddish purple'], ['#1B1F1D', 'black']];
  // a text's halo: white or dark (or any colour)
  const HALO: [string, string][] = [['#ffffff', 'white'], ['#1B1F1D', 'dark']];
  let textBox = $state<HTMLTextAreaElement>();
  const TITLE: Record<string, string> = { map: 'Main map', detail: 'Detail map', inset: 'Locator map', north: 'North arrow', scale: 'Scale bar', legend: 'Legend', credits: 'Credits', title: 'Text', shape: 'Shape', image: 'Picture', table: 'Table of sites', profile: 'Elevation profile' };
  /** a detail map's name in the chosen language ("Detail map", "Detail map 2") */
  const detailLabel = (d: DetailItem) => { const m = /^Detail map (\d+)$/.exec(detailName(d)); return m ? t('Detail map {n}', { n: Number(m[1]) }) : t(detailName(d)); };

  /* projection */
  let epsgInput = $state('');
  let epsgMsg = $state('');
  async function useEpsg() {
    const n = parseInt(epsgInput.replace(/\D/g, ''), 10);
    if (!n) { epsgMsg = t('Type an EPSG number, for example 32646.'); return; }
    epsgMsg = t('Looking it up…');
    try {
      store.doc.crs = await fetchEpsg(n);
      store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
      epsgMsg = '';
      c();
    } catch (e) { epsgMsg = (e as Error).message; }
  }
  function pickCrs(code: string) {
    if (code === 'auto') store.doc.crs = null;
    else {
      const opt = main?.crsSuggestions.find((s) => s.code === code);
      if (opt) store.doc.crs = { ...opt };
    }
    store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
    c();
  }

  /* OpenStreetMap */
  let osmMsg = $state('');
  let osmBusy = $state(false);
  async function loadOsm(l: Layer) {
    if (!main || !l.osmTheme) return;
    const v = main.lonLatView;
    const padX = (v[1][0] - v[0][0]) * 0.05, padY = (v[1][1] - v[0][1]) * 0.05;
    const b: [[number, number], [number, number]] = [[v[0][0] - padX, v[0][1] - padY], [v[1][0] + padX, v[1][1] + padY]];
    osmBusy = true;
    osmMsg = t('Asking OpenStreetMap…');
    try {
      const fc = await fetchOsm(l.osmTheme, b, (host) => (osmMsg = t('Asking {host}…', { host })));
      rewind(fc);
      store.geoms = { ...store.geoms, [l.id]: fc };
      l.osmBBox = b;
      osmMsg = t('Loaded {n} features.', { n: fc.features.length.toLocaleString() });
      c();
    } catch (e) { osmMsg = (e as Error).message; }
    finally { osmBusy = false; }
  }
  const viewTooBig = $derived(main ? areaDeg2(main.lonLatView) > MAX_AREA_DEG2 : false);
  const osmTried = new Set<string>(); // each new layer loads once by itself; after a failure, "Reload" tries again
  $effect(() => {
    // New OpenStreetMap layers load straight away.
    const l = selLayer;
    if (l && l.kind === 'osm' && !store.geoms[l.id] && !osmTried.has(l.id) && main && !viewTooBig) { osmTried.add(l.id); loadOsm(l); }
  });

  function setNum(it: Item, key: 'x' | 'y' | 'w' | 'h', raw: string) {
    const v = parseFloat(raw);
    if (!isFinite(v)) return;
    it[key] = key === 'w' || key === 'h' ? Math.max(2, v) : v;
    if (it.kind === 'table' && (key === 'w' || key === 'h')) it.fit = false; // sized by hand: the box no longer follows the table
    c();
  }
  function remove() {
    if (selItem && selItem.kind !== 'map') store.doc.items = store.doc.items.filter((i) => i !== selItem);
    if (selLayer) { const name = selLayer.name; deleteLayer(selLayer); store.told(t('Layer removed: {name}.', { name })); return; }
    const what = selItem ? t(TITLE[selItem.kind]) : t('Part');
    store.select(null);
    c();
    store.told(t('{what} removed.', { what }));
  }
  // What a locator draws for a colour that was not chosen (the same rules as Figure.svelte), so the pickers show it.
  const seaColour = $derived(store.doc.layers.find((l) => l.kind === 'sea')?.style.fill ?? '#DCEAF1');
  function insetDefault(ins: InsetItem, key: 'sea' | 'land' | 'focus' | 'lines'): string {
    if (key === 'sea') return seaColour;
    if (key === 'land') return '#F4F3EE';
    if (key === 'lines') return '#9A9A94';
    // the highlighted area is paler when boundaries are drawn inside the locator
    const bounds = ins.adminLevel === undefined ? !!store.adminFc : ins.adminLevel ? !!store.adminLevels[ins.adminLevel] : false;
    return bounds ? '#F4F3EE' : '#D9D7CC';
  }
  /** The rows of "Legend entries": the layers on show, top first, each with its swatch, its legend text and whether it is listed. */
  const legendRows = $derived<EntryRow[]>(
    store.doc.layers.slice().reverse().filter((x) => x.visible && x.kind !== 'sea').map((ly) => ({
      id: ly.id, value: ly.legendLabel, shown: ly.inLegend,
      eyeLabel: t('Show {name} in the legend', { name: ly.name }), textLabel: t('Legend text for {name}', { name: ly.name }), swatch: { fill: ly.style.fill, stroke: ly.style.stroke },
    })),
  );
  /** The rows of "Change or hide names on the map": every name this layer prints, with the text it prints now. */
  function nameRows(l: Layer): EntryRow[] {
    const names = [...new Set([...(main?.byId[l.id]?.labels.map((x) => x.orig ?? x.text) ?? []), ...Object.keys(l.labelText ?? {})])].sort();
    return names.map((name) => ({ id: name, value: l.labelText?.[name] || name, shown: l.labelText?.[name] !== '', eyeLabel: t('Show {name}', { name }), textLabel: t('Name for {name}', { name }) }));
  }
  function toggleName(l: Layer, name: string) {
    const texts = { ...(l.labelText ?? {}) };
    if (texts[name] === '') delete texts[name]; else texts[name] = '';
    l.labelText = texts;
    c();
  }
  function renameName(l: Layer, name: string, v: string) {
    const texts = { ...(l.labelText ?? {}) };
    if (v === name || !v) delete texts[name]; else texts[name] = v;
    l.labelText = texts;
    c();
  }
  /** The halo a layer's names get when none was chosen (the same rule as Figure.svelte), so the picker shows it. */
  function autoHalo(l: Layer): string {
    return luminance(look(l.style.labelStyle, TEXT.layerLabel(l.kind)).fill) > 0.5 ? '#1B1F1D' : '#ffffff';
  }
  /** Bar height in mm as drawn now (the same rule as Figure.svelte when none was chosen), to one decimal. */
  const barNow = (s: ScaleItem) => Math.round((s.barH ?? Math.max(0.9, Math.min(1.6, s.h * 0.16))) * 10) / 10;
  /** Halo width in pt as drawn now (the same rule as Figure.svelte when none was chosen). */
  const haloNow = (ti: TitleItem) => ti.haloPt ?? Math.round(ti.labelPt * 0.22 * 4) / 4;
  /** a layer with points on the map (a points layer, or a file or drawing that holds points): symbol and size apply */
  const hasPoints = (l: Layer) => l.kind === 'points' || (l.kind === 'vector' && !!store.geoms[l.id]?.features.some((f) => f.geometry && /Point/.test(f.geometry.type)));
  /** the legend lines come from the table's columns, so the layer's own legend text is not what is shown */
  const legendFromTable = (l: Layer) => !!l.choro || !!(l.pointsBy && (l.pointsBy.colorField || l.pointsBy.symbolField || (l.pointsBy.sizeField && !l.pointsBy.number && l.pointsBy.sizeLegend !== false)));
  /** shapes from this place on are gone: the looks picked for them (kept under #0, #1…) go too, so a new shape starts plain */
  function forgetShapes(l: Layer, from: number) {
    if (!l.featureStyle) return;
    const keep = { ...l.featureStyle };
    for (const k of Object.keys(keep)) if (k[0] === '#' && Number(k.slice(1)) >= from) delete keep[k];
    l.featureStyle = keep;
  }
  const removable = $derived((selItem && selItem.kind !== 'map') || (selLayer && selLayer.kind !== 'study' && selLayer.kind !== 'sea'));

  // Levels that exist for the study country (division, district, upazila...)
  let levels = $state<{ level: number; kind: string; count: number }[]>([]);
  $effect(() => {
    const iso = store.doc.study.iso;
    if (!iso) { levels = []; return; }
    availableLevels(iso).then((ls) => { if (store.doc.study.iso === iso) levels = ls.map((m) => ({ level: m.level, kind: kindName(m.canonical, m.level), count: m.count })); });
  });
</script>

<!-- the rarer settings of the names a layer prints on the map: their halo and the space between their letters -->
{#snippet nameOptions(l: Layer)}
  {#if l.style.labelField}
    <details class="acc quiet">
      <summary>{t('More options')}</summary>
      <div class="acc-body">
        <label class="row-switch"><span>{t('Halo')}<small>{t('An outline round the names, so they stay readable over lines and colour')}</small></span><input type="checkbox" role="switch" checked={l.style.labelHalo !== false} onchange={() => { l.style.labelHalo = l.style.labelHalo === false ? undefined : false; c(); }} /></label>
        {#if l.style.labelHalo !== false}
          <div class="field inline"><span>{t('Halo colour')}</span>
            <div class="row">
              {#if l.style.labelHaloColor}<button class="btn small ghost" onclick={() => { l.style.labelHaloColor = undefined; c(); }}>{t('Automatic')}</button>{/if}
              <ColorPicker value={l.style.labelHaloColor ?? autoHalo(l)} label={t('Halo colour of the names')} onchange={(v) => { l.style.labelHaloColor = v; c(); }} />
            </div>
          </div>
        {/if}
        {#if l.kind !== 'points'}
          <label class="field slider"><span>{t('Letter spacing')} <span class="val" aria-hidden="true">{Math.round((l.style.labelSpacing ?? 0) * 100)}%</span></span><input type="range" min="0" max="0.5" step="0.02" value={l.style.labelSpacing ?? 0} aria-valuetext={t('{n} percent', { n: Math.round((l.style.labelSpacing ?? 0) * 100) })} oninput={(e) => { l.style.labelSpacing = +(e.target as HTMLInputElement).value || undefined; }} onchange={c} /></label>
          <p class="hint">{t('Opens the gaps between the letters, as on spaced capitals. A wide name may need more room on the map.')}</p>
        {/if}
      </div>
    </details>
  {/if}
{/snippet}

<div class="head" class:scrolled bind:this={headEl}>
  <button class="back" onclick={() => store.select(null)} aria-label={t('Back to the map parts')}><ArrowLeft size={18} /></button>
  <h2 class="panel-title" tabindex="-1" bind:this={heading}>{selItem?.kind === 'detail' ? detailLabel(selItem) : selItem ? t(TITLE[selItem.kind]) : selLayer ? selLayer.name : t('Settings')}</h2>
  {#if removable}<button class="back" onclick={remove} aria-label={selItem ? t('Delete {name}', { name: t(TITLE[selItem.kind]) }) : selLayer ? t('Delete {name}', { name: selLayer.name }) : t('Delete this')}><Trash size={18} /></button>{/if}
</div>

<div class="stack">
  {#if selLayer}
    {@const l = selLayer}
    {#if store.picked?.layerId === l.id}<FeaturePanel />{/if}
    {#if l.kind === 'points' || l.kind === 'vector'}
      <section>
        <h3 class="group-title">{t('Layer')}</h3>
        <label class="field"><span>{t('Name')}</span><input class="input" bind:value={l.name} oninput={c} /></label>
      </section>
      <DataPanel layer={l} />
      {#if l.kind === 'vector' && store.geoms[l.id]}
        <section>
          <h3 class="group-title">{t('Study area')}</h3>
          <button class="btn" onclick={() => { firstArea(); store.doc.study.source = 'layer'; store.doc.study.fromLayer = l.id; store.doc.study.name = l.name; syncPlaceholderTitle(); store.doc.view = { padding: 0.12, panX: 0, panY: 0, zoom: 1 }; c(); }}>{t('Use this as my study area')}</button>
        </section>
      {/if}
    {/if}
    {#if l.kind === 'basemap' && l.basemap}
      {@const bm = l.basemap}
      <section>
        <h3 class="group-title">{t('Show the image')}</h3>
        <div class="seg wrap" role="group" aria-label={t('Where the image shows')}>
          <button aria-pressed={bm.clip === 'all'} onclick={() => { bm.clip = 'all'; c(); }}>{t('Everywhere')}</button>
          <button aria-pressed={bm.clip === 'inside'} onclick={() => { bm.clip = 'inside'; c(); }}>{t('Inside my area')}</button>
          <button aria-pressed={bm.clip === 'outside'} onclick={() => { bm.clip = 'outside'; c(); }}>{t('Outside my area')}</button>
        </div>
        <label class="field slider"><span>{t('Strength')} <span class="val" aria-hidden="true">{Math.round(bm.opacity * 100)}%</span></span><input type="range" min="0.1" max="1" step="0.05" bind:value={bm.opacity} aria-valuetext="{Math.round(bm.opacity * 100)}%" oninput={c} /></label>
        <p class="hint">{t('Sentinel-2 cloudless 2016 by EOX, free to publish with the credit (added automatically). For a clear map, turn the area fill down in Design.')}</p>
      </section>
    {/if}
    {#if l.kind === 'vector' && (l.custom || (!l.source && !l.auto))}
      <section>
        <h3 class="group-title">{t('Draw into this layer')}</h3>
        <div class="draw-tools">
          {#each [['point', 'Point'], ['line', 'Line'], ['polygon', 'Area'], ['freehand', 'Freehand'], ['rect', 'Rectangle'], ['circle', 'Circle']] as [tool, label]}
            <button class="btn small" aria-pressed={store.drawTarget === l.id && store.tool === tool} onclick={() => { store.drawTarget = l.id; store.tool = tool as 'point'; }}>{t(label)}</button>
          {/each}
        </div>
        <p class="hint">{(store.geoms[l.id]?.features.length ?? 0) === 1 ? t('1 shape.') : t('{n} shapes.', { n: (store.geoms[l.id]?.features.length ?? 0).toLocaleString() })}{store.drawTarget === l.id ? ' ' + t('Press Done on the map when finished.') : ''}</p>
        {#if store.geoms[l.id]?.features.length}
          <div class="row">
            <button class="btn small ghost" onclick={() => { const fc = store.geoms[l.id]; forgetShapes(l, fc.features.length - 1); store.geoms = { ...store.geoms, [l.id]: { ...fc, features: fc.features.slice(0, -1) } }; c(); store.autosave(); }}>{t('Remove last shape')}</button>
            <button class="btn small ghost" onclick={() => { forgetShapes(l, 0); store.geoms = { ...store.geoms, [l.id]: { type: 'FeatureCollection', features: [] } }; c(); store.autosave(); store.told(t('All shapes cleared from this layer.')); }}>{t('Clear all')}</button>
          </div>
        {/if}
      </section>
    {/if}
    {#if l.kind === 'admin'}
      <section>
        <h3 class="group-title">{t('Boundaries')}</h3>
        <label class="field"><span>{t('Which boundaries')}</span>
          <select class="input" value={l.adminLevel ?? 0} onchange={(e) => { const v = Number((e.target as HTMLSelectElement).value); l.adminLevel = v || undefined; const k = levels.find((x) => x.level === v)?.kind; if (k) { l.name = `${k} boundaries`; l.legendLabel = `${k} boundary`; } c(); }}>
            <option value={0}>{t('Automatic (suits the map)')}</option>
            {#each levels as lv}<option value={lv.level}>{t(lv.kind)} ({lv.count.toLocaleString()})</option>{/each}
          </select>
        </label>
      </section>
    {/if}
    {#if l.kind === 'osm'}
      <section>
        <h3 class="group-title">OpenStreetMap</h3>
        <p class="hint">{l.osmTheme === 'water' ? t('Rivers, canals, lakes and ponds from OpenStreetMap for the area your map shows. Credit is added automatically.') : t('Main roads from OpenStreetMap for the area your map shows. Credit is added automatically.')}</p>
        <button class="btn" onclick={() => loadOsm(l)} disabled={osmBusy || viewTooBig || !main}>{osmBusy ? t('Loading…') : t('Reload for the current view')}</button>
        {#if viewTooBig}<p class="hint warn">{t('The map covers too large an area for this detail. Zoom in first.')}</p>{/if}
        <p class="msg" role="status">{osmMsg}</p>
      </section>
    {/if}
    {#if l.kind === 'terrain' && l.terrain}
      {@const tr = l.terrain}
      <section>
        <h3 class="group-title">{t('Relief')}</h3>
        <div class="seg" role="group" aria-label={t('Terrain style')}>
          <button aria-pressed={!tr.tint} onclick={() => { tr.tint = false; c(); }}>{t('Shading')}</button>
          <button aria-pressed={tr.tint} onclick={() => { tr.tint = true; c(); }}>{t('Elevation colours')}</button>
        </div>
        <label class="field slider"><span>{t('Relief strength')} <span class="val" aria-hidden="true">{tr.exaggeration}×</span></span><input type="range" min="1" max="8" step="0.5" bind:value={tr.exaggeration} aria-valuetext={t('{n} times', { n: tr.exaggeration })} onchange={c} /></label>
        <label class="field slider"><span>{t('Light from')} <span class="val" aria-hidden="true">{tr.azimuth}°</span></span><input type="range" min="0" max="355" step="5" bind:value={tr.azimuth} aria-valuetext="{tr.azimuth}°" onchange={c} /></label>
        <label class="field slider"><span>{t('Opacity')} <span class="val" aria-hidden="true">{Math.round(tr.opacity * 100)}%</span></span><input type="range" min="0.1" max="1" step="0.05" bind:value={tr.opacity} aria-valuetext="{Math.round(tr.opacity * 100)}%" oninput={c} /></label>
        <label class="row-switch"><span>{t('Always show')}<small>{t('On flat land (under 60 m from lowest to highest) relief only adds noise, so it is left out unless this is on.')}</small></span><input type="checkbox" role="switch" checked={tr.auto === false} onchange={() => { tr.auto = tr.auto === false ? true : false; c(); }} /></label>
        <p class="msg" role="status">{store.terrainMsg}</p>
      </section>
    {:else if l.kind !== 'basemap'}
      <section>
        <h3 class="group-title">{t('Colours')}</h3>
        <div class="colours" role="group" aria-label={t('Colourblind-safe colours')}>
          {#each COLOURS as [col, name]}
            <button class="dot" style="background:{col}" aria-label={t('Use {name}', { name: t(name) })} onclick={() => { if (l.style.fill === 'none' || l.kind === 'rivers') l.style.stroke = col; else { l.style.fill = col; l.style.stroke = col; } c(); }}></button>
          {/each}
        </div>
        <div class="grid2">
          {#if l.kind !== 'rivers'}
            <div class="field"><span>{t('Fill')}</span>
              <div class="row"><ColorPicker value={l.style.fill} allowNone noneLabel={t('No fill')} label={t('Fill colour')} onchange={(v) => { l.style.fill = v; c(); }} />
              <span class="cname">{l.style.fill === 'none' ? t('No fill') : l.style.fill}</span></div>
            </div>
          {/if}
          <div class="field"><span>{t('Line')}</span>
            <div class="row"><ColorPicker value={l.style.stroke} allowNone noneLabel={t('No line')} label={t('Line colour')} onchange={(v) => { l.style.stroke = v; c(); }} />
            <span class="cname">{l.style.stroke === 'none' ? t('No line') : l.style.stroke}</span></div>
          </div>
        </div>
        {#if l.choro}<p class="hint">{t('The areas are coloured from your table (Colour areas by a value, below), so Fill is not used.')}</p>{/if}
        {#if l.kind !== 'rivers' && l.style.fill !== 'none'}
          <label class="field slider"><span>{t('Fill opacity')} <span class="val" aria-hidden="true">{Math.round(l.style.fillOpacity * 100)}%</span></span><input type="range" min="0" max="1" step="0.05" bind:value={l.style.fillOpacity} aria-valuetext="{Math.round(l.style.fillOpacity * 100)}%" oninput={c} /></label>
        {/if}
        <label class="field slider"><span>{t('Line width')} <span class="val" aria-hidden="true">{l.style.strokePt} pt</span></span><input type="range" min="0" max="3" step="0.05" bind:value={l.style.strokePt} aria-valuetext="{l.style.strokePt} pt" oninput={c} /></label>
        <label class="row-switch"><span>{t('Dashed line')}</span><input type="checkbox" role="switch" checked={l.style.dash} onchange={(e) => { l.style.dash = (e.target as HTMLInputElement).checked; c(); }} /></label>
      </section>
      {#if l.kind === 'subunits' || l.kind === 'admin'}
        <ChoroplethPanel layer={l} names={main?.byId[l.id]?.allNames ?? []} />
      {/if}
      {#if hasPoints(l)}
        <section>
          <h3 class="group-title">{t('Symbols')}</h3>
          {#if l.pointsBy?.number}
            <p class="hint">{t('Numbered markers are circles (Style by a column, below).')}</p>
          {:else if l.pointsBy?.symbolField}
            <p class="hint">{t('The symbols follow the column {col} (Style by a column, below).', { col: l.pointsBy.symbolField })}</p>
          {:else}
            <div class="seg" role="group" aria-label={t('Symbol')}>
              {#each ['circle', 'triangle', 'square', 'diamond'] as sy}
                <button aria-pressed={l.style.symbol === sy} onclick={() => { l.style.symbol = sy as typeof l.style.symbol; c(); }}>{t(sy)}</button>
              {/each}
            </div>
          {/if}
          {#if l.pointsBy?.sizeField && !l.pointsBy.number}
            <p class="hint">{t('The sizes follow the column {col} (Style by a column, below).', { col: l.pointsBy.sizeField })}</p>
          {:else}
            <label class="field slider"><span>{l.pointsBy?.number ? t('Smallest marker') : t('Symbol size')} <span class="val" aria-hidden="true">{l.style.sizePt} pt</span></span><input type="range" min="2" max="14" step="0.5" bind:value={l.style.sizePt} aria-valuetext="{l.style.sizePt} pt" oninput={c} /></label>
          {/if}
          {#if l.kind === 'vector'}
            <label class="field slider"><span>{t('Symbol opacity')} <span class="val" aria-hidden="true">{Math.round((l.style.symbolOpacity ?? 1) * 100)}%</span></span><input type="range" min="0.1" max="1" step="0.05" value={l.style.symbolOpacity ?? 1} aria-valuetext="{Math.round((l.style.symbolOpacity ?? 1) * 100)}%" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; l.style.symbolOpacity = v === 1 ? undefined : v; c(); }} /></label>
          {/if}
          {#if l.kind === 'points' && l.style.labelField}
            <label class="field slider"><span>{t('Label size')} <span class="val" aria-hidden="true">{l.style.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={l.style.labelPt} aria-valuetext="{l.style.labelPt} pt" oninput={c} /></label>
            <TextStyleRow label={t('Label style')} value={l.style.labelStyle} defaults={TEXT.layerLabel(l.kind)} onchange={(v) => { l.style.labelStyle = v; c(); }} />
          {/if}
        </section>
        {#if l.kind === 'points' || (l.kind === 'vector' && !l.custom)}<PointsStylePanel layer={l} />{/if}
        {#if l.kind === 'points'}{@render nameOptions(l)}{/if}
      {/if}
    {/if}
    {#if l.kind === 'study'}
      <section>
        <h3 class="group-title">{t('Fill')}</h3>
        <div class="seg" role="group" aria-label={t('Area fill')}>
          <button aria-pressed={!l.style.hatch && !l.style.byUnit} onclick={() => { l.style.hatch = false; l.style.byUnit = false; c(); }}>{t('Solid')}</button>
          <button aria-pressed={!!l.style.hatch} onclick={() => { l.style.hatch = true; l.style.byUnit = false; c(); }}>{t('Hatched')}</button>
          <button aria-pressed={!!l.style.byUnit} onclick={() => { l.style.byUnit = true; l.style.hatch = false; c(); }}>{t('Per area')}</button>
        </div>
      </section>
    {/if}
    {#if l.kind === 'study' || l.kind === 'admin' || l.kind === 'countries' || l.kind === 'vector' || l.kind === 'subunits'}
      <section>
        <h3 class="group-title">{t('Names on the map')}</h3>
        <label class="row-switch"><span>{l.kind === 'admin' ? t('Name the neighbouring areas') : l.kind === 'countries' ? t('Show country names') : t('Show area names')}</span><input type="checkbox" role="switch" checked={!!l.style.labelField} onchange={(e) => { l.style.labelField = (e.target as HTMLInputElement).checked ? (l.kind === 'countries' ? 'name' : l.kind === 'vector' ? Object.keys(store.geoms[l.id]?.features[0]?.properties ?? {})[0] ?? 'name' : '__name') : ''; c(); }} /></label>
        {#if l.style.labelField}
          <label class="field slider"><span>{t('Size')} <span class="val" aria-hidden="true">{l.style.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={l.style.labelPt} aria-valuetext="{l.style.labelPt} pt" oninput={c} /></label>
          <TextStyleRow label={t('Name style')} value={l.style.labelStyle} defaults={TEXT.layerLabel(l.kind)} onchange={(v) => { l.style.labelStyle = v; c(); }} />
        {/if}
      </section>
      {@render nameOptions(l)}
    {/if}
    {#if l.style.labelField && (main?.byId[l.id]?.labels.length || Object.keys(l.labelText ?? {}).length)}
      <details class="acc quiet">
        <summary>{t('Change or hide names on the map')}</summary>
        <div class="acc-body">
          <EntryList rows={nameRows(l)} ontoggle={(name) => toggleName(l, name)} onedit={(name, v) => renameName(l, name, v)} />
          <p class="hint">{t('Click a name to change it. The eye hides it. Only names that fit on the map are listed.')}</p>
        </div>
      </details>
    {/if}
    <section>
      <h3 class="group-title">{t('Legend')}</h3>
      <label class="row-switch"><span>{t('Show in legend')}</span><input type="checkbox" role="switch" bind:checked={l.inLegend} onchange={c} /></label>
      {#if l.inLegend && legendFromTable(l)}
        <p class="hint">{l.choro ? t('The entries come from your table. Change the title under Colour areas by a value.') : t('The entries come from the columns of the table. Change their text under Style by a column.')}</p>
      {:else if l.inLegend}<label class="field"><span>{t('Legend text')}</span><input class="input" bind:value={l.legendLabel} oninput={c} /></label>{/if}
    </section>
  {:else if selItem}
    {@const it = selItem}
    {#if it.kind === 'map'}
      {@const m = it as MapItem}
      <MapPanel {m} {main}>
        {#snippet projection()}
          <details class="acc quiet">
            <summary>{t('Projection')}</summary>
            <div class="acc-body">
              <p class="hint">{t('How the round Earth is flattened onto the page. The automatic choice suits most places.')}</p>
              <select class="input" value={store.doc.crs ? store.doc.crs.code : 'auto'} onchange={(e) => pickCrs((e.target as HTMLSelectElement).value)} aria-label={t('Projection')}>
                <option value="auto">{t('Best for this place: {name}', { name: main?.crsSuggestions[0]?.name ?? '…' })}</option>
                {#each main?.crsSuggestions ?? [] as s}<option value={s.code}>{s.name}{s.code.startsWith('EPSG') ? ` (${s.code})` : ''}</option>{/each}
                {#if store.doc.crs && !main?.crsSuggestions.some((s) => s.code === store.doc.crs?.code)}<option value={store.doc.crs.code}>{store.doc.crs.name} ({store.doc.crs.code})</option>{/if}
              </select>
              <div class="row">
                <input class="input" inputmode="numeric" placeholder={t('EPSG code, e.g. 32646')} bind:value={epsgInput} aria-label={t('EPSG code')} aria-describedby="epsg-msg" onkeydown={(e) => e.key === 'Enter' && useEpsg()} />
                <button class="btn" onclick={useEpsg}>{t('Use')}</button>
              </div>
              <p class="hint" id="epsg-msg" role="alert">{epsgMsg}</p>
            </div>
          </details>
        {/snippet}
      </MapPanel>
    {:else if it.kind === 'detail'}
      <DetailPanel d={it as DetailItem} {main} />
    {:else if it.kind === 'inset'}
      {@const ins = it as InsetItem}
      <section>
        <h3 class="group-title">{t('What it shows')}</h3>
        <div class="seg" role="group" aria-label={t('Locator shows')}>
          <button aria-pressed={ins.context === 'globe'} onclick={() => { ins.context = 'globe'; ins.h = ins.w; c(); }}>{t('Globe')}</button>
          <button aria-pressed={ins.context === 'country'} onclick={() => { ins.context = 'country'; c(); }}>{t('Country')}</button>
          <button aria-pressed={ins.context === 'region'} onclick={() => { ins.context = 'region'; c(); }}>{t('Region')}</button>
          <button aria-pressed={ins.context === 'parent'} onclick={() => { ins.context = 'parent'; ins.frameLevel ??= 2; c(); }}>{t('Around it')}</button>
        </div>
        {#if ins.context === 'parent' && levels.length}
          <label class="field"><span>{t('Show the whole')}</span>
            <select class="input" value={ins.frameLevel ?? 2} onchange={(e) => { ins.frameLevel = Number((e.target as HTMLSelectElement).value); c(); }}>
              {#each levels as lv}<option value={lv.level}>{t('{kind} around the study area', { kind: t(lv.kind) })}</option>{/each}
            </select>
          </label>
        {/if}
        {#if ins.context !== 'globe' && levels.length}
          <label class="field"><span>{t('Boundaries inside')}</span>
            <select class="input" value={ins.adminLevel === undefined ? -1 : ins.adminLevel} onchange={(e) => { const v = Number((e.target as HTMLSelectElement).value); ins.adminLevel = v < 0 ? undefined : v; c(); }}>
              <option value={-1}>{t('Same as the main map')}</option>
              <option value={0}>{t('None, country outline only')}</option>
              {#each levels as lv}<option value={lv.level}>{t(lv.kind)} ({lv.count.toLocaleString()})</option>{/each}
            </select>
          </label>
        {/if}
        <div class="row">
          <button class="btn small" onclick={() => { ins.zoom = Math.min(200, (ins.zoom ?? 1) * 1.25); c(); }}>{t('Zoom in')}</button>
          <button class="btn small" onclick={() => { ins.zoom = Math.max(0.2, (ins.zoom ?? 1) / 1.25); c(); }}>{t('Zoom out')}</button>
          <button class="btn small ghost" onclick={() => { ins.zoom = 1; ins.panX = 0; ins.panY = 0; c(); }}>{t('Reset')}</button>
        </div>
        <p class="hint">{t('Scroll over the locator to zoom it. Click it once, then drag inside to move what it shows.')}</p>
      </section>
      <section>
        <h3 class="group-title">{t('Main map marker')}</h3>
        <label class="row-switch"><span>{t('Mark where the main map is')}</span><input type="checkbox" role="switch" bind:checked={ins.showExtent} onchange={c} /></label>
        {#if ins.showExtent && ins.context !== 'globe'}<label class="row-switch"><span>{t('Lines to the main map')}</span><input type="checkbox" role="switch" bind:checked={ins.connect} onchange={c} /></label>{/if}
        {#if ins.showExtent}<div class="field inline"><span>{t('Marker colour')}</span><ColorPicker value={ins.extentColor} label={t('Marker colour')} onchange={(v) => { ins.extentColor = v; c(); }} /></div>{/if}
      </section>
      <section>
        <h3 class="group-title">{t('Label')}</h3>
        <label class="field"><span>{t('Label inside (optional)')}</span><input class="input" bind:value={ins.label} oninput={c} placeholder={t('e.g. (b)')} /></label>
        {#if ins.label}
          <label class="field slider"><span>{t('Label size')} <span class="val" aria-hidden="true">{ins.labelPt} pt</span></span><input type="range" min="5" max="14" step="0.5" bind:value={ins.labelPt} aria-valuetext="{ins.labelPt} pt" oninput={c} /></label>
          <TextStyleRow label={t('Label style')} value={ins.text} defaults={TEXT.insetLabel} onchange={(v) => { ins.text = v; c(); }} />
        {/if}
      </section>
      {#if ins.context !== 'globe'}
        <details class="acc quiet">
          <summary>{t('Frame and colours')}</summary>
          <div class="acc-body">
            <label class="field slider"><span>{t('Frame')} <span class="val" aria-hidden="true">{ins.framePt ?? 0.5} pt</span></span><input type="range" min="0" max="2" step="0.05" value={ins.framePt ?? 0.5} aria-valuetext="{ins.framePt ?? 0.5} pt" oninput={(e) => { ins.framePt = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
            <div class="field inline"><span>{t('Frame colour')}</span><ColorPicker value={ins.frameColor ?? '#1B1F1D'} label={t('Frame colour')} onchange={(v) => { ins.frameColor = v.toUpperCase() === '#1B1F1D' ? undefined : v; c(); }} /></div>
            <div class="swatches">
              {#each [['sea', 'Sea'], ['land', 'Land'], ['focus', 'Highlighted area'], ['lines', 'Lines']] as [k, label]}
                <div class="sw"><ColorPicker value={ins.colours?.[k as 'sea'] ?? insetDefault(ins, k as 'sea')} label={t('{name} colour', { name: t(label) })} size={28} onchange={(v) => { ins.colours = { ...(ins.colours ?? {}), [k]: v }; c(); }} /><span>{t(label)}</span></div>
              {/each}
            </div>
            <button class="btn small ghost" onclick={() => { ins.colours = undefined; ins.framePt = undefined; ins.frameColor = undefined; c(); }}>{t('Reset colours')}</button>
          </div>
        </details>
      {/if}
      {#if ins.showExtent}
        <details class="acc quiet">
          <summary>{t('More options')}</summary>
          <div class="acc-body">
            <label class="field slider"><span>{t('Zoom box line')} <span class="val" aria-hidden="true">{ins.extentPt ?? 0.8} pt</span></span><input type="range" min="0.25" max="2.5" step="0.05" value={ins.extentPt ?? 0.8} aria-valuetext="{ins.extentPt ?? 0.8} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; ins.extentPt = v === 0.8 ? undefined : v; }} onchange={c} /></label>
            <label class="field slider"><span>{t('Zoom box fill')} <span class="val" aria-hidden="true">{Math.round((ins.extentFill ?? 0.07) * 100)}%</span></span><input type="range" min="0" max="0.6" step="0.01" value={ins.extentFill ?? 0.07} aria-valuetext={t('{n} percent', { n: Math.round((ins.extentFill ?? 0.07) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; ins.extentFill = v === 0.07 ? undefined : v; }} onchange={c} /></label>
            {#if ins.connect && ins.context !== 'globe'}
              <label class="field slider"><span>{t('Zoom lines')} <span class="val" aria-hidden="true">{ins.connectPt ?? 0.5} pt</span></span><input type="range" min="0.1" max="2" step="0.05" value={ins.connectPt ?? 0.5} aria-valuetext="{ins.connectPt ?? 0.5} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; ins.connectPt = v === 0.5 ? undefined : v; }} onchange={c} /></label>
              <label class="row-switch"><span>{t('Dashed zoom lines')}</span><input type="checkbox" role="switch" checked={!!ins.connectDash} onchange={() => { ins.connectDash = ins.connectDash ? undefined : true; c(); }} /></label>
            {/if}
          </div>
        </details>
      {/if}
      {#if ins.context !== 'globe'}
        {#if ins.grid}
          <GridPanel grid={ins.grid} />
        {:else}
          <section>
            <h3 class="group-title">{t('Coordinate grid')}</h3>
            <button class="btn" onclick={() => { ins.grid = { show: true, lines: true, step: 'auto', format: 'dm', labelPt: 7, lineColor: '#B4B4AE', sides: 'two' }; c(); }}>{t('Add a coordinate grid to this map')}</button>
          </section>
        {/if}
      {/if}
    {:else if it.kind === 'north'}
      {@const nt = it as NorthItem}
      <section>
        <h3 class="group-title">{t('North arrow')}</h3>
        <div class="seg wrap five" role="group" aria-label={t('North arrow style')}>
          {#each ['arrow', 'rose', 'star', 'compass', 'simple'] as st}<button aria-pressed={nt.style === st} onclick={() => { nt.style = st as NorthItem['style']; c(); }}>{t(st)}</button>{/each}
        </div>
        <label class="row-switch"><span>{t('Point to true north')}<small>{t('Turns the arrow {angle} on this map', { angle: main ? `${main.northAngle.toFixed(1)}°` : '…' })}</small></span><input type="checkbox" role="switch" bind:checked={nt.trueNorth} onchange={c} /></label>
        <label class="row-switch"><span>{t('White backing')}</span><input type="checkbox" role="switch" bind:checked={nt.backdrop} onchange={c} /></label>
      </section>
      <section>
        <h3 class="group-title">{t('Text')}</h3>
        <TextStyleRow label={t('Letter style (N)')} value={nt.text} defaults={TEXT.north} onchange={(v) => { nt.text = v; c(); }} />
      </section>
      <details class="acc quiet">
        <summary>{t('More options')}</summary>
        <div class="acc-body">
          <div class="field inline"><span>{t('Arrow colour')}</span>
            <div class="row">
              {#if nt.color}<button class="btn small ghost" onclick={() => { nt.color = undefined; c(); }}>{t('Reset')}</button>{/if}
              <ColorPicker value={nt.color ?? '#1B1F1D'} label={t('Arrow colour')} onchange={(v) => { nt.color = v; c(); }} />
            </div>
          </div>
          <label class="row-switch"><span>{t('Show the N')}{#if nt.style === 'rose'}<small>{t('With E, S and W on a rose')}</small>{/if}</span><input type="checkbox" role="switch" checked={!nt.hideN} onchange={() => { nt.hideN = nt.hideN ? undefined : true; c(); }} /></label>
          {#if !nt.hideN}
            <label class="field slider"><span>{t('Letter size')} <span class="val" aria-hidden="true">{Math.round((nt.nSize ?? 1) * 100)}%</span></span><input type="range" min="0.5" max="1.4" step="0.05" value={nt.nSize ?? 1} aria-valuetext={t('{n} percent', { n: Math.round((nt.nSize ?? 1) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; nt.nSize = v === 1 ? undefined : v; }} onchange={c} /></label>
          {/if}
        </div>
      </details>
    {:else if it.kind === 'scale'}
      {@const s = it as ScaleItem}
      {@const SCALE_DESIGNS = [{ id: 'alternating', label: 'Blocks' }, { id: 'line', label: 'Line' }, { id: 'ticks', label: 'Ticks' }, { id: 'double', label: 'Double' }, { id: 'hollow', label: 'Hollow' }] as const}
      <section>
        <h3 class="group-title">{t('Scale bar')}</h3>
        <div class="seg" role="group" aria-label={t('Units')}>
          <button aria-pressed={s.units === 'metric'} onclick={() => { s.units = 'metric'; c(); }}>{t('Kilometres')}</button>
          <button aria-pressed={s.units === 'imperial'} onclick={() => { s.units = 'imperial'; c(); }}>{t('Miles')}</button>
        </div>
        {#if store.doc.items.some((i) => i.kind === 'detail')}
          <label class="field"><span>{t('Measures')}</span>
            <select class="input" value={store.doc.items.some((i) => i.kind === 'detail' && i.id === s.of) ? s.of : ''} onchange={(e) => { s.of = (e.target as HTMLSelectElement).value || undefined; c(); }}>
              <option value="">{t('The main map')}</option>
              {#each store.doc.items.filter((i): i is DetailItem => i.kind === 'detail') as dm (dm.id)}<option value={dm.id}>{detailLabel(dm)}{dm.visible ? '' : t(' (hidden)')}</option>{/each}
            </select>
          </label>
        {/if}
        <div class="field"><span>{t('Bar design')}</span>
          <div class="sbpick" role="group" aria-label={t('Bar design')}>
            {#each SCALE_DESIGNS as d}
              <button class="sbd" aria-label={t('Scale bar design: {name}', { name: t(d.label) })} title={t(d.label)} aria-pressed={s.style === d.id} onclick={() => { s.style = d.id; c(); }}>
                <svg viewBox="0 0 40 14" width="40" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1">
                  {#if d.id === 'alternating'}
                    <rect x="2" y="5" width="9" height="4" fill="currentColor" /><rect x="11" y="5" width="9" height="4" /><rect x="20" y="5" width="9" height="4" fill="currentColor" /><rect x="29" y="5" width="9" height="4" />
                  {:else if d.id === 'line'}
                    <path d="M2 5V10H38V5" /><path d="M11 7V10M20 7V10M29 7V10" />
                  {:else if d.id === 'ticks'}
                    <path d="M2 10H38" /><path d="M2 3V10M38 3V10" /><path d="M11 6V10M20 6V10M29 6V10" />
                  {:else if d.id === 'double'}
                    <rect x="2" y="3" width="9" height="4" fill="currentColor" /><rect x="11" y="3" width="9" height="4" /><rect x="20" y="3" width="9" height="4" fill="currentColor" /><rect x="29" y="3" width="9" height="4" />
                    <rect x="2" y="7" width="9" height="4" /><rect x="11" y="7" width="9" height="4" fill="currentColor" /><rect x="20" y="7" width="9" height="4" /><rect x="29" y="7" width="9" height="4" fill="currentColor" />
                  {:else}
                    <rect x="2" y="5" width="9" height="4" /><rect x="11" y="5" width="9" height="4" /><rect x="20" y="5" width="9" height="4" /><rect x="29" y="5" width="9" height="4" />
                  {/if}
                </svg>
                <span>{t(d.label)}</span>
              </button>
            {/each}
          </div>
        </div>
        <div class="field"><span>{t('Numbers')}</span>
          <div class="seg" role="group" aria-label={t('Numbers position')}>
            <button aria-pressed={s.labelPos !== 'below'} onclick={() => { s.labelPos = 'above'; c(); }}>{t('Above')}</button>
            <button aria-pressed={s.labelPos === 'below'} onclick={() => { s.labelPos = 'below'; c(); }}>{t('Below')}</button>
          </div>
        </div>
        <div class="field"><span>{t('Scale text')}</span>
          <div class="seg" role="group" aria-label={t('Scale text')}>
            <button aria-pressed={!s.ratio || s.ratio === 'none'} onclick={() => { s.ratio = 'none'; c(); }}>{t('None')}</button>
            <button aria-pressed={s.ratio === 'cm'} onclick={() => { s.ratio = 'cm'; c(); }}>1 cm = km</button>
            <button aria-pressed={s.ratio === 'fraction'} onclick={() => { s.ratio = 'fraction'; c(); }}>1:250,000</button>
          </div>
        </div>
        <label class="field slider"><span>{t('Segments')} <span class="val" aria-hidden="true">{s.segments}</span></span><input type="range" min="1" max="6" step="1" bind:value={s.segments} aria-valuetext={s.segments === 1 ? t('1 segment') : t('{n} segments', { n: s.segments })} oninput={c} /></label>
        <label class="row-switch"><span>{t('White backing')}</span><input type="checkbox" role="switch" bind:checked={s.backdrop} onchange={c} /></label>
        {#if scale}<p class="hint">{t('Measured at the map centre: {value} {unit}. Widen the box for a longer bar.', { value: fmtNumber(scale.segments * scale.segmentValue), unit: scale.unit })}</p>{/if}
      </section>
      <section>
        <h3 class="group-title">{t('Text')}</h3>
        <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{s.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={s.labelPt} aria-valuetext="{s.labelPt} pt" oninput={c} /></label>
        <TextStyleRow label={t('Number style')} value={s.text} defaults={TEXT.scale} onchange={(v) => { s.text = v; c(); }} />
      </section>
      <details class="acc quiet">
        <summary>{t('More options')}</summary>
        <div class="acc-body">
          <div class="swatches">
            <div class="sw"><ColorPicker value={s.barDark ?? '#1B1F1D'} label={t('Dark blocks colour')} size={28} onchange={(v) => { s.barDark = v; c(); }} /><span>{t('Dark blocks')}</span></div>
            {#if s.style === 'alternating' || s.style === 'double' || s.style === 'hollow'}
              <div class="sw"><ColorPicker value={s.barLight ?? '#ffffff'} label={t('Light blocks colour')} size={28} onchange={(v) => { s.barLight = v; c(); }} /><span>{t('Light blocks')}</span></div>
            {/if}
          </div>
          <label class="field slider"><span>{t('Bar height')} <span class="val" aria-hidden="true">{barNow(s)} mm</span></span><input type="range" min="0.5" max="4" step="0.1" value={barNow(s)} aria-valuetext={t('{n} millimetres', { n: barNow(s) })} oninput={(e) => { s.barH = +(e.target as HTMLInputElement).value; }} onchange={c} /></label>
          {#if s.barDark || s.barLight || s.barH !== undefined}<button class="btn small ghost" onclick={() => { s.barDark = undefined; s.barLight = undefined; s.barH = undefined; c(); }}>{t('Back to the usual bar')}</button>{/if}
          <label class="field"><span>{t('Unit as written')}</span><input class="input" bind:value={s.unitText} oninput={() => { if (!s.unitText?.trim()) s.unitText = undefined; c(); }} placeholder={scale?.unit ?? 'km'} /></label>
          <p class="hint">{t('For example "kilometres". Empty keeps km, m or mi. The numbers keep their own colour in Number style above.')}</p>
        </div>
      </details>
    {:else if it.kind === 'legend'}
      {@const lg = it as LegendItem}
      <section>
        <h3 class="group-title">{t('Legend')}</h3>
        <label class="field"><span>{t('Title')}</span><input class="input" bind:value={lg.title} oninput={c} placeholder={t('e.g. Legend')} /></label>
        <label class="row-switch"><span>{t('Frame')}</span><input type="checkbox" role="switch" bind:checked={lg.frame} onchange={c} /></label>
      </section>
      <section>
        <h3 class="group-title">{t('Text')}</h3>
        <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{lg.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={lg.labelPt} aria-valuetext="{lg.labelPt} pt" oninput={c} /></label>
        {#if lg.title}<TextStyleRow label={t('Title style')} value={lg.titleText} defaults={TEXT.legendTitle} onchange={(v) => { lg.titleText = v; c(); }} />{/if}
        <TextStyleRow label={t('Entry style')} value={lg.text} defaults={TEXT.legend} onchange={(v) => { lg.text = v; c(); }} />
      </section>
      <details class="acc quiet">
        <summary>{t('More options')}</summary>
        <div class="acc-body">
          <div class="field"><span>{t('Columns')}</span>
            <div class="seg" role="group" aria-label={t('Legend columns')}>
              <button aria-pressed={!lg.cols} onclick={() => { lg.cols = undefined; c(); }}>{t('Automatic')}</button>
              {#each [1, 2, 3] as n}<button aria-pressed={lg.cols === n} onclick={() => { lg.cols = n as 1 | 2 | 3; c(); }}>{n}</button>{/each}
            </div>
          </div>
          <label class="field slider"><span>{t('Symbol size')} <span class="val" aria-hidden="true">{Math.round((lg.symbolSize ?? 1) * 100)}%</span></span><input type="range" min="0.5" max="2" step="0.05" value={lg.symbolSize ?? 1} aria-valuetext={t('{n} percent', { n: Math.round((lg.symbolSize ?? 1) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; lg.symbolSize = v === 1 ? undefined : v; }} onchange={c} /></label>
          <label class="field slider"><span>{t('Row spacing')} <span class="val" aria-hidden="true">{Math.round((lg.rowGap ?? 1) * 100)}%</span></span><input type="range" min="0.7" max="2" step="0.05" value={lg.rowGap ?? 1} aria-valuetext={t('{n} percent', { n: Math.round((lg.rowGap ?? 1) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; lg.rowGap = v === 1 ? undefined : v; }} onchange={c} /></label>
          {#if lg.title}
            <div class="field"><span>{t('Title position')}</span>
              <div class="seg" role="group" aria-label={t('Legend title position')}>
                <button aria-pressed={lg.titleAlign !== 'middle'} onclick={() => { lg.titleAlign = undefined; c(); }}>{t('Left')}</button>
                <button aria-pressed={lg.titleAlign === 'middle'} onclick={() => { lg.titleAlign = 'middle'; c(); }}>{t('Centre')}</button>
              </div>
            </div>
          {/if}
        </div>
      </details>
      <section>
        <h3 class="group-title">{t('Entries')}</h3>
        <p class="hint">{t('Click a name to rename it. The eye hides it from the legend.')}</p>
        <EntryList rows={legendRows} ontoggle={(id) => { const ly = store.doc.layers.find((x) => x.id === id); if (ly) { ly.inLegend = !ly.inLegend; c(); } }} onedit={(id, v) => { const ly = store.doc.layers.find((x) => x.id === id); if (ly) { ly.legendLabel = v; c(); } }} />
        <!-- a layer coloured from a table writes one legend line per class or value: those lines are set in the layer itself -->
        {#each store.doc.layers.filter((x) => x.visible && x.inLegend && (x.choro || x.pointsBy?.colorField || x.pointsBy?.sizeField)) as ly (ly.id)}
          <p class="hint">{t('The lines of {name} come from its table.', { name: ly.name })} <button class="link" onclick={() => store.select(ly.id, true)}>{t('Change them in {name}', { name: ly.name })}</button></p>
        {/each}
      </section>
    {:else if it.kind === 'credits'}
      {@const cr = it as CreditsItem}
      <section>
        <h3 class="group-title">{t('Credits')}</h3>
        <label class="row-switch"><span>{t('Projection name')}</span><input type="checkbox" role="switch" bind:checked={cr.showProjection} onchange={c} /></label>
        <label class="row-switch"><span>{t('Boundary disclaimer')}</span><input type="checkbox" role="switch" bind:checked={cr.showDisclaimer} onchange={c} /></label>
        <label class="field"><span>{t('Extra line')}</span><input class="input" bind:value={cr.extra} oninput={c} placeholder={t('e.g. Sampling: March 2025')} /></label>
        <p class="hint">{t('Data sources are added automatically.')}</p>
      </section>
      <section>
        <h3 class="group-title">{t('Text')}</h3>
        <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{cr.labelPt} pt</span></span><input type="range" min="5" max="10" step="0.5" bind:value={cr.labelPt} aria-valuetext="{cr.labelPt} pt" oninput={c} /></label>
        <TextStyleRow label={t('Text style')} value={cr.text} defaults={TEXT.credits} onchange={(v) => { cr.text = v; c(); }} />
        <div class="seg" role="group" aria-label={t('Alignment')}>
          {#each [['start', 'Left'], ['middle', 'Centre'], ['end', 'Right']] as [v, label]}<button aria-pressed={(cr.align ?? 'start') === v} onclick={() => { cr.align = v === 'start' ? undefined : (v as CreditsItem['align']); c(); }}>{t(label)}</button>{/each}
        </div>
      </section>
    {:else if it.kind === 'title'}
      {@const tt = it as TitleItem}
      <section>
        <h3 class="group-title">{t('Wording')}</h3>
        <label class="field"><span>{t('Text')}</span><textarea class="input" rows="2" bind:this={textBox} bind:value={tt.text} oninput={c} style="font-family:{fontStack(tt.font || store.doc.font)}"></textarea></label>
        <SpecialChars target={textBox} />
        <p class="hint">{t('Long text wraps at the box width; press Enter for a new line here (Shift+Enter on the page).')}</p>
        <label class="field"><span>{t('Font')}</span>
          <select class="input" value={tt.font ?? ''} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; tt.font = v || undefined; if (v) ensureFont(v); c(); }}>
            <option value="">{t('Same as the map: {font}', { font: fontLabel(store.doc.font) })}</option>
            {#each BUILTIN_FONTS as f}<option value={f.family}>{f.like} ({f.family})</option>{/each}
            {#each fonts.custom as f}<option value={f.family}>{t('{font} (your font)', { font: f.family })}</option>{/each}
          </select>
        </label>
      </section>
      <section>
        <h3 class="group-title">{t('Style')}</h3>
        <label class="field slider"><span>{t('Size')} <span class="val" aria-hidden="true">{tt.labelPt} pt</span></span><input type="range" min="5" max="36" step="0.5" bind:value={tt.labelPt} aria-valuetext="{tt.labelPt} pt" oninput={c} /></label>
        <TextStyleRow label={t('Style')} value={{ bold: tt.bold, italic: tt.italic, color: tt.color }} defaults={{ color: '#1B1F1D' }} reset={false} onchange={(v) => { tt.bold = !!v?.bold; tt.italic = !!v?.italic; tt.color = v?.color; c(); }} />
        <div class="seg" role="group" aria-label={t('Alignment')}>
          {#each [['start', 'Left'], ['middle', 'Centre'], ['end', 'Right']] as [v, label]}<button aria-pressed={(tt.align ?? 'start') === v} onclick={() => { tt.align = v as TitleItem['align']; c(); }}>{t(label)}</button>{/each}
        </div>
        <label class="row-switch"><span>{t('Capital letters')}<small>{t('Shows every letter as a capital; the text stays as you typed it')}</small></span><input type="checkbox" role="switch" checked={!!tt.upper} onchange={() => { tt.upper = tt.upper ? undefined : true; c(); }} /></label>
      </section>
      <details class="acc quiet">
        <summary>{t('More options')}</summary>
        <div class="acc-body">
          <label class="field slider"><span>{t('Line spacing')} <span class="val" aria-hidden="true">{tt.lineGap ?? 1.25}</span></span><input type="range" min="0.9" max="2" step="0.05" value={tt.lineGap ?? 1.25} aria-valuetext={t('{n} times the letter size', { n: tt.lineGap ?? 1.25 })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; tt.lineGap = v === 1.25 ? undefined : v; }} onchange={c} /></label>
          <label class="row-switch"><span>{t('Halo')}<small>{t('An outline round the letters, for text over a map')}</small></span><input type="checkbox" role="switch" checked={!!tt.halo} onchange={() => { tt.halo = tt.halo ? undefined : '#ffffff'; if (!tt.halo) tt.haloPt = undefined; c(); }} /></label>
          {#if tt.halo}
            {@const halo = tt.halo}
            <div class="colours" role="group" aria-label={t('Halo colour')}>
              {#each HALO as [col, name]}<button class="dot" class:on={halo.toLowerCase() === col.toLowerCase()} style="background:{col}" aria-label={t('Halo {name}', { name: t(name) })} aria-pressed={halo.toLowerCase() === col.toLowerCase()} onclick={() => { tt.halo = col; c(); }}></button>{/each}
              <ColorPicker value={halo} label={t('Any halo colour')} size={28} onchange={(v) => { tt.halo = v; c(); }} />
            </div>
            <label class="field slider"><span>{t('Halo width')} <span class="val" aria-hidden="true">{haloNow(tt)} pt</span></span><input type="range" min="0.5" max="8" step="0.25" value={haloNow(tt)} aria-valuetext="{haloNow(tt)} pt" oninput={(e) => { tt.haloPt = +(e.target as HTMLInputElement).value; }} onchange={c} /></label>
          {/if}
        </div>
      </details>
    {:else if it.kind === 'image'}
      <section>
        <h3 class="group-title">{t('Fit and frame')}</h3>
        <div class="seg" role="group" aria-label={t('Fit')}>
          <button aria-pressed={it.fit === 'contain'} onclick={() => { if (it.kind === 'image') { it.fit = 'contain'; c(); } }}>{t('Whole picture')}</button>
          <button aria-pressed={it.fit === 'cover'} onclick={() => { if (it.kind === 'image') { it.fit = 'cover'; c(); } }}>{t('Fill the box')}</button>
        </div>
        <label class="row-switch"><span>{t('Frame')}</span><input type="checkbox" role="switch" checked={it.frame} onchange={() => { if (it.kind === 'image') { it.frame = !it.frame; c(); } }} /></label>
      </section>
      <section>
        <h3 class="group-title">{t('Picture file')}</h3>
        <label class="btn small">{t('Replace picture')}
          <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="sr-only" onchange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f && it.kind === 'image') { it.href = (await readPicture(f)).href; c(); } }} />
        </label>
      </section>
    {:else if it.kind === 'shape'}
      <ShapeSection sh={it as ShapeItem} />
    {:else if it.kind === 'table'}
      <TableSection tb={it as TableItem} />
    {:else if it.kind === 'profile'}
      <ProfileSection pr={it as ProfileItem} />
    {/if}
    {#if it.kind !== 'map' && it.kind !== 'detail'}<AppearanceSection {it} />{/if}
    <details class="acc quiet" open>
      <summary>{t('Position and size (mm)')}</summary>
      <div class="acc-body">
        {#if it.kind === 'north' || it.kind === 'scale' || it.kind === 'legend'}
          <label class="row-switch"><span>{t('Place automatically')}<small>{t('Keeps clear of the study area')}</small></span><input type="checkbox" role="switch" checked={!it.pinned} onchange={() => { it.pinned = !it.pinned; c(); }} /></label>
        {/if}
        <div class="grid4">
          {#each [['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H']] as [k, label]}
            <label class="field"><span>{label}</span><input class="input" type="number" step="0.5" aria-label={t(EDGE[k])} value={it[k as 'x']} onchange={(e) => setNum(it, k as 'x', (e.target as HTMLInputElement).value)} /></label>
          {/each}
        </div>
      </div>
    </details>
  {:else}
    <p class="hint">{t('Click something on the page to change it.')}</p>
  {/if}
</div>

<style>
  .link { padding: 0; border: 0; background: none; color: var(--accent-ink); text-decoration: underline; text-underline-offset: 2px; font: inherit; cursor: pointer; }
  /* the head stays on show while the body scrolls under it. The leaf body has 8 px (6 on phones) of padding above it, so the head pulls up over it
     (the title sits where it does on the other steps, and does not move when the body scrolls); its own white reaches the leaf's side gutters,
     and a hairline appears once something has scrolled beneath */
  .head { position: sticky; top: 0; z-index: 3; display: grid; grid-template-columns: 32px 1fr 32px; align-items: center; gap: 8px; margin: -8px -20px 8px; padding: 8px 20px; background: var(--panel); box-shadow: 0 1px 0 transparent; transition: box-shadow 120ms ease; }
  .head.scrolled { box-shadow: 0 1px 0 var(--line); }
  @media (max-width: 760px) { .head { margin: -6px -16px 8px; padding-inline: 16px; } }
  .head .panel-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .back { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: var(--r-ctl); background: transparent; color: var(--ink-2); }
  .back:hover { background: var(--panel-2); color: var(--ink); }
  /* phones and tablets: back and delete are 44 px to the finger */
  @media (pointer: coarse) {
    .head { grid-template-columns: 44px 1fr 44px; }
    .back { width: 44px; height: 44px; }
  }
  .stack :global(.btn) { white-space: normal; max-width: 100%; } /* long button labels wrap instead of widening the panel */
  .colours { display: flex; gap: 8px; flex-wrap: wrap; }
  .dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  .dot:hover { box-shadow: 0 0 0 2px var(--ink-2); }
  .dot.on { box-shadow: 0 0 0 2px var(--accent); }
  /* two even columns; minmax(0, 1fr) so a wide child can never push a column past the panel */
  .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .grid4 .input { padding: 6px 4px; font-size: 12.5px; }
  .seg button::first-letter { text-transform: uppercase; }
  /* five choices: three on the first line, two on the second, so none is left alone across the whole row */
  .seg.five { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .seg.five button { grid-column: span 2; }
  .seg.five.wrap button:nth-child(n + 4) { grid-column: span 3; }
  .draw-tools { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 6px; }
  .draw-tools .btn { min-width: 0; }
  .draw-tools .btn[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-wash); color: var(--accent-ink); }
  .swatches { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .sw { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
  .cname { font-size: 12.5px; color: var(--ink-3); font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; }
  /* the five scale bar drawings sit on one line */
  .sbpick { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
  .sbd { display: grid; justify-items: center; gap: 3px; min-width: 0; padding: 6px 2px 4px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel); color: var(--ink-2); font-size: 11.5px; }
  .sbd:hover { border-color: var(--line-strong); color: var(--ink); }
  .sbd[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-wash); color: var(--accent-ink); }
  @media (pointer: coarse) { .sbd { min-height: 44px; } }
  .field.inline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
</style>
