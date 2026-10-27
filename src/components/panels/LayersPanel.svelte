<script lang="ts">
  import Eye from 'phosphor-svelte/lib/Eye';
  import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
  import CaretUp from 'phosphor-svelte/lib/CaretUp';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import MagnifyingGlassPlus from 'phosphor-svelte/lib/MagnifyingGlassPlus';
  import DotsThree from 'phosphor-svelte/lib/DotsThree';
  import { store } from '../../lib/store.svelte';
  import Trash from 'phosphor-svelte/lib/Trash';
  import Plus from 'phosphor-svelte/lib/Plus';
  import { zoomToLayer, layerFeatures, deleteLayer, addBoundaryLayer, addStandardLayer, addOsmLayer, addCustomLayer, addBasemapLayer, addTownsLayer, addContours, addRingsAuto } from '../../lib/actions';
  import { openParts } from '../shell.svelte';
  import { availableLevels } from '../../lib/data';
  import { kindName } from '../../lib/adminsearch';
  import { t } from '../../lib/i18n.svelte';

  let levels = $state<{ level: number; kind: string; count: number }[]>([]);
  $effect(() => {
    const iso = store.doc.study.iso;
    if (!iso) { levels = []; return; }
    availableLevels(iso).then((ls) => { if (store.doc.study.iso === iso) levels = ls.map((m) => ({ level: m.level, kind: kindName(m.canonical, m.level), count: m.count })); });
  });
  const has = (k: string) => store.doc.layers.some((l) => l.kind === k);
  function onAdd(e: Event) {
    const sel = e.target as HTMLSelectElement;
    const v = sel.value;
    sel.value = '';
    if (v.startsWith('admin:')) { const lv = Number(v.slice(6)); addBoundaryLayer(lv, levels.find((x) => x.level === lv)?.kind ?? `Level ${lv}`); }
    else if (v === 'osm-water') addOsmLayer('water');
    else if (v === 'osm-roads') addOsmLayer('roads');
    else if (v === 'custom') addCustomLayer();
    else if (v === 'basemap') addBasemapLayer();
    else if (v === 'basemap-hls') addBasemapLayer('hls');
    else if (v === 'basemap-viirs') addBasemapLayer('viirs');
    else if (v === 'towns') addTownsLayer();
    else if (v === 'contours') addContours(0);
    else if (v === 'rings-centre') addRingsAuto('centre');
    else if (v.startsWith('rings:')) addRingsAuto(v.slice(6));
    else if (v === 'file') {
      // the upload buttons live in Map parts, Add, in a folded group: open it and bring it into view
      store.select(null); store.tab = 'elements'; store.panelOpen = true;
      openParts('add', true);
      setTimeout(() => { const t = document.querySelector<HTMLElement>('.side .uploads-anchor'), b = document.querySelector<HTMLElement>('.side .body'); if (t && b) b.scrollTo({ top: b.scrollTop + t.getBoundingClientRect().top - b.getBoundingClientRect().top - 8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, 80);
    }
    else if (v) addStandardLayer(v as Layer['kind']);
  }
  import type { Layer } from '../../lib/store.svelte';

  const layers = $derived(store.doc.layers.slice().reverse());
  /** touch screens: the row whose move, zoom and delete buttons are open on a line of their own (one at a time) */
  let openRow = $state<string | null>(null);

  /** Move a layer up or down past the next layer that is on show, so every click changes the map
   *  (stepping past a hidden neighbour used to look like the button did nothing). The sea stays at the bottom. */
  function move(l: Layer, dir: 1 | -1) {
    const arr = store.doc.layers;
    const i = arr.indexOf(l);
    let j = i + dir;
    while (j >= 1 && j < arr.length && !arr[j].visible) j += dir;
    if (j < 1 || j >= arr.length) j = dir > 0 ? arr.length - 1 : 1; // only hidden layers beyond: go to that end
    if (j === i) return;
    const [it] = arr.splice(i, 1);
    arr.splice(j, 0, it);
    store.commit();
  }
  /** layers drawn by the detailed OpenStreetMap water instead: their eye would change nothing, so they say why */
  const osmWaterOn = $derived(store.doc.layers.some((x) => x.kind === 'osm' && x.osmTheme === 'water' && x.visible));
  const replaced = (l: Layer) => osmWaterOn && (l.kind === 'rivers' || l.kind === 'lakes');
  /** Delete a layer and say so, with an Undo button. */
  function remove(l: Layer) {
    const name = l.name;
    deleteLayer(l);
    store.told(t('Layer removed: {name}.', { name: t(name) }));
  }
</script>

<div class="stack">
  <section>
    <label class="add" data-label={t('Add a layer')}>
      <Plus size={16} weight="bold" />
      <span class="sr-only">{t('Add a layer')}</span>
      <select onchange={onAdd} aria-label={t('Add a layer')}>
        <option value="">{t('Add a layer…')}</option>
        {#if levels.length}
          <optgroup label={t('Official boundaries')}>
            {#each levels as lv}<option value="admin:{lv.level}">{t('{kind} boundaries ({count})', { kind: t(lv.kind), count: lv.count.toLocaleString() })}</option>{/each}
          </optgroup>
        {/if}
        <optgroup label={t('Water and roads')}>
          {#if !has('rivers')}<option value="rivers">{t('Main rivers (Natural Earth)')}</option>{/if}
          {#if !has('lakes')}<option value="lakes">{t('Lakes (Natural Earth)')}</option>{/if}
          <option value="osm-water">{t('Detailed rivers and water (OpenStreetMap)')}</option>
          <option value="osm-roads">{t('Roads (OpenStreetMap)')}</option>
        </optgroup>
        <optgroup label={t('Places, relief and distance')}>
          {#if !store.doc.layers.some((l) => l.osmTheme === 'places')}<option value="towns">{t('Towns and cities (OpenStreetMap)')}</option>{/if}
          {#if !store.doc.layers.some((l) => l.contour)}<option value="contours">{t('Contour lines')}</option>{/if}
          <option value="rings-centre">{t('Distance rings round the area')}</option>
          {#each store.doc.layers.filter((l) => l.kind === 'points') as pl}<option value="rings:{pl.id}">{t('Distance rings round {name}', { name: t(pl.name) })}</option>{/each}
        </optgroup>
        <optgroup label={t('Other')}>
          {#if !has('countries')}<option value="countries">{t('Countries')}</option>{/if}
          {#if !has('subunits')}<option value="subunits">{t('Sub-areas of your area')}</option>{/if}
          {#if !has('terrain')}<option value="terrain">{t('Shaded relief')}</option>{/if}
          {#if !has('disputed')}<option value="disputed">{t('Disputed areas')}</option>{/if}
          <option value="custom">{t('Draw your own layer (points, lines, areas)…')}</option>
          <option value="basemap">{t('Satellite base map (Sentinel-2, 2016)')}</option>
          <option value="basemap-hls">{t('Satellite, recent dry season (NASA, 30 m)')}</option>
          <option value="basemap-viirs">{t('Satellite on a chosen day (NASA, 375 m)')}</option>
          <option value="file">{t('Your own file or points…')}</option>
        </optgroup>
      </select>
    </label>
    <!-- the north arrow, scale bar, legend and credits are switched in Map parts, Essentials and on the page; here are the map's own layers -->
    <ul aria-label={t('Layers')}>
      {#each layers as l (l.id)}
        <li class:off={!l.visible || replaced(l)} class:sel={store.selected === l.id} class:open={openRow === l.id}>
          <span class="sw" aria-hidden="true" style="--f:{l.style.fill === 'none' ? 'transparent' : l.style.fill};--s:{l.style.stroke === 'none' ? 'transparent' : l.style.stroke}" class:line={l.style.fill === 'none'}></span>
          <span class="nm">
            <button class="name" title={t(l.name)} aria-current={store.selected === l.id ? 'true' : undefined} onclick={() => store.select(l.id, true)}>{t(l.name)}</button>
            <!-- why the eye does nothing: said in words under the name, not only in a tooltip -->
            {#if replaced(l)}<small class="why" id="why-{l.id}">{t('Drawn by Rivers and water')}</small>{/if}
          </span>
          <!-- the row's actions sit over the end of the name, only while the row is hovered, focused or picked (on touch: on a line of their own, opened by the dots) -->
          {#if l.kind !== 'sea'}
            <span class="acts">
              <button class="mini" disabled={store.doc.layers.indexOf(l) >= store.doc.layers.length - 1} onclick={() => move(l, 1)} aria-label={t('Move {name} up', { name: t(l.name) })} title={t('Move up')}><CaretUp size={13} weight="bold" /></button>
              <button class="mini" disabled={store.doc.layers.indexOf(l) <= 1} onclick={() => move(l, -1)} aria-label={t('Move {name} down', { name: t(l.name) })} title={t('Move down')}><CaretDown size={13} weight="bold" /></button>
              {#if !['rivers', 'lakes', 'disputed', 'terrain', 'basemap'].includes(l.kind)}<button class="mini" disabled={!layerFeatures(l).length} onclick={() => zoomToLayer(l)} aria-label={t('Zoom to {name}', { name: t(l.name) })} title={t('Zoom to layer')}><MagnifyingGlassPlus size={15} /></button>{/if}
              {#if l.kind !== 'study'}<button class="mini del" onclick={() => remove(l)} aria-label={t('Delete {name}', { name: t(l.name) })} title={t('Delete layer')}><Trash size={15} /></button>{/if}
            </span>
            <button class="mini more" aria-expanded={openRow === l.id} onclick={() => (openRow = openRow === l.id ? null : l.id)} aria-label={t('More for {name}', { name: t(l.name) })} title={t('Move, zoom or delete')}><DotsThree size={18} weight="bold" /></button>
          {/if}
          <!-- aria-disabled, not disabled: it stays reachable by keyboard and says why; a layer that is not drawn is never "pressed" -->
          <button class="mini eye" aria-disabled={replaced(l) ? 'true' : undefined} aria-describedby={replaced(l) ? `why-${l.id}` : undefined} onclick={() => { if (replaced(l)) return; l.visible = !l.visible; store.commit(); }} aria-label={t('Show {name}', { name: t(l.name) })} aria-pressed={l.visible && !replaced(l)} title={replaced(l) ? t('Hide Rivers and water to use this layer') : l.visible ? t('Hide') : t('Show')}>
            {#if l.visible && !replaced(l)}<Eye size={16} />{:else}<EyeSlash size={16} />{/if}
          </button>
        </li>
      {/each}
    </ul>
  </section>
</div>

<style>
  /* one size for the small round-cornered icon buttons; a finger needs more */
  ul { --mini: 28px; list-style: none; margin: 0; padding: 0; display: grid; }
  @media (pointer: coarse) { ul { --mini: 44px; } }
  /* a row is swatch | name | eye, so the name gets the whole width; the other actions come in over its end on hover */
  li { --show: 0; --row: var(--panel); position: relative; display: grid; grid-template-columns: 22px minmax(0, 1fr) var(--mini); align-items: center; gap: 2px; padding: 1px 6px; border-radius: 0; background: var(--row); }
  li + li { border-top: 1px solid var(--line); }
  li:hover { --row: var(--panel-2); }
  li.open { --row: var(--panel-2); }
  li.sel { --row: var(--accent-wash); }
  li:hover, li:focus-within, li.sel { --show: 1; }
  li.off .name { color: var(--ink-3); }
  .sw { width: 20px; height: 14px; border-radius: 3px; background: var(--f); box-shadow: inset 0 0 0 1.5px var(--s); }
  .sw.line { background: transparent; box-shadow: none; position: relative; }
  .sw.line::after { content: ''; position: absolute; left: 0; right: 0; top: 6px; height: 2px; background: var(--s); }
  /* the name, and under it (when there is one) a short note saying why the row is as it is */
  .nm { display: grid; min-width: 0; }
  .name { border: 0; background: transparent; text-align: left; padding: 5px 2px; font-size: 14px; font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nm:has(.why) .name { padding-bottom: 1px; }
  .why { padding: 0 2px 5px; font-size: 12.5px; line-height: 1.3; color: var(--ink-3); text-wrap: pretty; }
  li.sel .name { font-weight: 600; }
  .mini { width: var(--mini); height: max(28px, var(--mini)); display: grid; place-items: center; border: 0; border-radius: var(--r-chip); background: transparent; color: var(--ink-3); }
  .mini:hover { background: var(--panel); color: var(--ink); }
  .mini:disabled, .mini[aria-disabled='true'] { cursor: default; opacity: 0.3; }
  .mini:disabled:hover, .mini[aria-disabled='true']:hover { background: transparent; color: var(--ink-3); }
  .mini.del:hover { color: var(--err); }
  .eye { grid-column: -2; }
  .more { display: none; }
  /* up, down, zoom, delete: out of the way until the row is hovered, focused or picked; their background fades in so they cover the end of a long name */
  .acts { position: absolute; top: 0; bottom: 0; right: calc(6px + var(--mini)); display: flex; align-items: center; padding-left: 18px; background: linear-gradient(90deg, transparent, var(--row) 18px); opacity: var(--show); pointer-events: none; transition: opacity 120ms ease; }
  /* only the action buttons take clicks: the faded strip around them lets a click through to the name, which selects */
  li:hover .acts > *, li:focus-within .acts > *, li.sel .acts > * { pointer-events: auto; }
  /* touch screens cannot hover, and four 44 px buttons would squeeze every name to a few letters: a row is swatch | name | dots | eye,
     and the dots open the move, zoom and delete buttons on a line of their own under that row */
  @media (hover: none), (pointer: coarse) {
    li { grid-template-columns: 22px minmax(0, 1fr) var(--mini) var(--mini); }
    .more { display: grid; }
    .more[aria-expanded='true'] { background: var(--panel); color: var(--ink); }
    .acts { position: static; display: none; grid-column: 1 / -1; grid-row: 2; align-items: center; justify-content: flex-end; padding-left: 0; background: none; opacity: 1; pointer-events: auto; }
    li.open > .acts { display: flex; }
  }
  /* a calm dashed outline: the layer you have not added yet */
  .add { position: relative; display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 38px; padding: 0 12px; box-sizing: border-box; border: 1px dashed var(--line-input); border-radius: var(--r-ctl); color: var(--ink-2); font-size: 14px; font-weight: 600; cursor: pointer; }
  @media (pointer: coarse) { .add { height: 44px; } }
  .add:hover { border-color: var(--accent); color: var(--ink); background: var(--accent-wash); }
  .add select { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
  .add:has(select:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; } /* the select is invisible, so the label shows the focus */
  .add::after { content: attr(data-label); }
</style>
