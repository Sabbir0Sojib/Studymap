<script lang="ts">
  // Map furniture and shapes, each drawn as it will appear in the figure.
  import { store, defaultItems } from '../../lib/store.svelte';
  import type { DetailItem, MapItem, NorthItem } from '../../lib/store.svelte';
  import CaretRight from 'phosphor-svelte/lib/CaretRight';
  import { addDetail, addInset, addNorth, addShape, addText, detailName, showItem, keepOnPage, drawOnMap, addTable, addProfile, togglePart } from '../../lib/actions';
  import { drawnLines, sitesLayers } from '../../lib/figparts';
  import { t } from '../../lib/i18n.svelte';

  // `part` picks which part of Map parts shows: the panel draws one tab at a time.
  interface Props { part?: 'essentials' | 'onmap' | 'insets' | 'add' }
  let { part = 'essentials' }: Props = $props();

  const map = $derived(store.map as MapItem);
  // a table needs sample points on the map; a profile needs a line drawn on it
  const hasSites = $derived(sitesLayers(store.doc, store.geoms).length > 0);
  const hasLine = $derived(drawnLines(store.doc, store.geoms).length > 0);
  const chartHint = $derived(t(!hasSites && !hasLine ? 'A table needs sample points, and a profile needs a line drawn on the map.' : !hasSites ? 'Add sample points first (Add your own, below) to make a table of them.' : !hasLine ? 'Draw a line on the map first (Draw on the map, Line) to make a profile of it.' : 'The table lists your sample sites. The profile shows the ground height along a line you drew.'));
  // the north arrow on the page, so its style tiles can show which one is current
  const north = $derived(store.doc.items.find((i) => i.kind === 'north') as NorthItem | undefined);

  // Quick on/off for everything on the figure, like ticking layers in QGIS.
  type Sw = { label: string; hint?: string; on: boolean; flip: () => void };
  const itemSw = (label: string, find: (i: any) => boolean, make: () => void, hint?: string): Sw => {
    const it = store.doc.items.find(find);
    return { label, hint, on: !!it?.visible, flip: () => { if (it?.visible) { it.visible = false; store.commit(); } else if (it && it.kind !== 'inset') { it.visible = true; keepOnPage(); store.commit(); } else make(); } };
  };
  /** Put back a default part the user deleted earlier. */
  const restore = (kind: string) => () => {
    const it = defaultItems(store.doc.widthMm, store.doc.heightMm).find((i) => i.kind === kind);
    if (it) { store.doc.items.push(it); store.commit(); }
  };
  const layerSw = (label: string, kind: string, part: 'layer' | 'labels' = 'layer', theme?: string): Sw | null => {
    const l = store.doc.layers.find((x) => x.kind === kind && (!theme || x.osmTheme === theme));
    if (!l) return null;
    if (part === 'labels') {
      const on = l.visible && !!l.style.labelField;
      return { label, on, flip: () => { if (on) l.style.labelField = ''; else { l.visible = true; l.style.labelField = '__name'; } store.commit(); } };
    }
    return { label, on: l.visible, flip: () => { l.visible = !l.visible; store.commit(); } };
  };
  const only = (sw: (Sw | null)[]) => sw.filter((x): x is Sw => !!x);
  // what a reader of the figure needs to read the map
  const furniture = $derived(only([
    itemSw('North arrow', (i) => i.kind === 'north', () => addNorth('arrow'), 'Most reviewers expect one'),
    itemSw('Scale bar', (i) => i.kind === 'scale', restore('scale'), 'Shows real distances'),
    itemSw('Legend', (i) => i.kind === 'legend', restore('legend'), 'Explains every colour and line'),
    { label: 'Coordinate grid', hint: 'Latitude and longitude around the map', on: map.grid.show, flip: () => { map.grid.show = !map.grid.show; store.commit(); } },
    itemSw('Credits on the map', (i) => i.kind === 'credits', restore('credits'), 'Off: the credits go in the figure caption'),
  ]));
  const insets = $derived(only([
    itemSw('Country inset', (i) => i.kind === 'inset' && i.context === 'country', () => addInset('country'), 'Where the area lies in its country'),
    itemSw('Globe inset', (i) => i.kind === 'inset' && i.context === 'globe', () => addInset('globe'), 'Where the country lies in the world'),
  ]));
  // each detail map on the page, so a hidden one comes back from here
  const details = $derived(only(store.doc.items.filter((i): i is DetailItem => i.kind === 'detail').map((it) => ({ label: detailName(it), hint: `1:${Math.round(it.scale).toLocaleString('en-US')}`, on: it.visible, flip: () => togglePart(it) }))));
  // the same five north arrows, with the same names, as the north arrow's own settings
  const ARROWS: [NorthItem['style'], string][] = [['arrow', 'Arrow'], ['rose', 'Rose'], ['star', 'Star'], ['compass', 'Compass'], ['simple', 'Simple']];
  // what is drawn inside the map
  const content = $derived(only([
    { label: 'Highlight the study area', on: store.doc.study.highlight, flip: () => { store.doc.study.highlight = !store.doc.study.highlight; store.commit(); } },
    layerSw('Names inside the area', 'subunits', 'labels'),
    layerSw('Boundaries inside the area', 'subunits'),
    layerSw('Names of neighbouring areas', 'admin', 'labels'),
    layerSw('Neighbouring boundaries', 'admin'),
    layerSw('Rivers', 'rivers'),
    layerSw('Detailed rivers and water', 'osm', 'layer', 'water'),
    layerSw('Roads', 'osm', 'layer', 'roads'),
    layerSw('Shaded relief', 'terrain'),
  ]));
</script>

<div class="stack">
  {#snippet detailIcon()}
    <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="7" width="26" height="24" fill="#F4F3EE" stroke="#1B1F1D" stroke-width="1.2" /><rect x="11" y="13" width="7" height="6" fill="#D55E00" fill-opacity=".15" stroke="#D55E00" stroke-width="1.3" /><rect x="26" y="26" width="17" height="15" fill="#F4F3EE" stroke="#1B1F1D" stroke-width="1.2" /><path d="M18 13L26 26M18 19L26 41" stroke="#D55E00" stroke-width="0.9" fill="none" /></svg>
  {/snippet}
  {#snippet switchList(list: Sw[])}
    <div class="switches">
      {#each list as s (s.label)}
        <label class="row-switch"><span>{t(s.label)}{#if s.hint}<small>{t(s.hint)}</small>{/if}</span><input type="checkbox" role="switch" checked={s.on} onchange={s.flip} /></label>
      {/each}
    </div>
  {/snippet}
  <!-- the tab already names its group, so a title is given only when it says something new -->
  {#snippet group(title: string | undefined, list: Sw[])}
    <section>
      {#if title}<h3 class="group-title">{t(title)}</h3>{/if}
      {@render switchList(list)}
    </section>
  {/snippet}
  {#if part === 'essentials'}
    <section>
      <div class="switches">
        {#each furniture as s (s.label)}
          <label class="row-switch"><span>{t(s.label)}{#if s.hint}<small>{t(s.hint)}</small>{/if}</span><input type="checkbox" role="switch" checked={s.on} onchange={s.flip} /></label>
        {/each}
        <!-- the page's main map has no switch: its scale, turn and frame are one click from here -->
        <button class="row-link" onclick={() => store.select(map.id, true)}><span>{t('Main map settings')}<small>{t('Scale, turn, frame and grid of the map')}</small></span><CaretRight size={14} weight="bold" /></button>
      </div>
    </section>
  {:else if part === 'onmap'}
    {@render group(undefined, content)}
  {/if}

  {#if part === 'insets'}
  <section>
    {@render switchList([...insets, ...details])}
    <p class="hint">{t('Add another, then drag it where you want it:')}</p>
    <div class="tiles four">
      <button class="tile" onclick={() => addInset('globe')} aria-label={t('Add a globe inset map')} title={t('Add a globe inset map')}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="19" fill="#DCEAF1" stroke="#1B1F1D" stroke-width="1.2" /><path d="M14 17c5-4 13-3 15 2s-3 6-1 10 6 3 4 7c-6 3-15 1-19-5s-3-10 1-14z" fill="#F4F3EE" stroke="#8C8C86" stroke-width=".8" /><circle cx="25" cy="25" r="2.6" fill="none" stroke="#D55E00" stroke-width="1.6" /></svg>
        <span aria-hidden="true">{t('Globe')}</span>
      </button>
      <button class="tile" onclick={() => addInset('country')} aria-label={t('Add a country inset map')} title={t('Add a country inset map')}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="7" width="38" height="34" fill="#F4F3EE" stroke="#1B1F1D" stroke-width="1.2" /><path d="M13 13l9-2 7 4 6-1 2 9-3 8-6 4-5-3-7 2-3-8z" fill="#D9D7CC" stroke="#4A4A46" stroke-width=".9" /><rect x="25" y="16" width="7" height="6" fill="#D55E00" fill-opacity=".15" stroke="#D55E00" stroke-width="1.4" /></svg>
        <span aria-hidden="true">{t('Country')}</span>
      </button>
      <button class="tile" onclick={() => addInset('region')} aria-label={t('Add a region inset map')} title={t('Add a region inset map')}>
        <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="7" width="38" height="34" fill="#F4F3EE" stroke="#1B1F1D" stroke-width="1.2" /><path d="M5 28c8-3 12 2 19-1s10-8 19-6V41H5z" fill="#E8E6DE" /><rect x="20" y="18" width="9" height="8" fill="#D55E00" fill-opacity=".15" stroke="#D55E00" stroke-width="1.4" /></svg>
        <span aria-hidden="true">{t('Region')}</span>
      </button>
      <button class="tile" onclick={() => addDetail()} aria-label={t('Add a detail map')} title={t('Add a detail map: a zoomed-in part of the study area')}>
        {@render detailIcon()}
        <span aria-hidden="true">{t('Detail')}</span>
      </button>
    </div>
  </section>
  {/if}

  {#if part === 'essentials'}
  <section>
    <h3 class="group-title">{t('North arrow style')}</h3>
    <div class="tiles five">
      {#each ARROWS as [st, name]}
        <button class="tile" onclick={() => addNorth(st)} aria-label={t('North arrow, {name}', { name: t(name) })} title={t('North arrow, {name}', { name: t(name) })} aria-pressed={!!north?.visible && north.style === st}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <text x="24" y="12" font-size="9" font-weight="700" text-anchor="middle" font-family="Arimo, Arial">N</text>
            {#if st === 'arrow'}<path d="M24 15l7 26-7-4z" fill="#1B1F1D" /><path d="M24 15l-7 26 7-4z" fill="#fff" stroke="#1B1F1D" stroke-width="1" />
            {:else if st === 'star'}<path d="M24 15l3 14-3 13-3-13z" fill="#fff" stroke="#1B1F1D" /><path d="M24 15l3 14h-3z" fill="#1B1F1D" /><path d="M14 29l10-2 10 2-10 2z" fill="#fff" stroke="#1B1F1D" stroke-width=".8" />
            {:else if st === 'rose'}<path d="M24 16l2.4 11.6L38 30l-11.6 2.4L24 44l-2.4-11.6L10 30l11.6-2.4z" fill="#fff" stroke="#1B1F1D" stroke-width=".9" /><path d="M24 16l2.4 11.6H24zM38 30l-11.6 2.4V30zM24 44l-2.4-11.6H24zM10 30l11.6-2.4V30z" fill="#1B1F1D" />
            {:else if st === 'compass'}<circle cx="24" cy="30" r="10" fill="#fff" stroke="#1B1F1D" /><path d="M24 17l3 13-3 13-3-13z" fill="#fff" stroke="#1B1F1D" stroke-width=".8" /><path d="M24 17l3 13h-3z" fill="#1B1F1D" />
            {:else}<line x1="24" y1="42" x2="24" y2="27" stroke="#1B1F1D" stroke-width="2" /><path d="M24 16l6.5 12h-13z" fill="#1B1F1D" />{/if}
          </svg>
          <span aria-hidden="true">{t(name)}</span>
        </button>
      {/each}
    </div>
  </section>
  {/if}

  {#if part === 'add'}
  <!-- a second map frame: a zoomed-in part of the study area, with a zoom box and lines on the main map -->
  <section>
    <h3 class="group-title">{t('More maps')}</h3>
    <div class="tiles three">
      <button class="tile" disabled={store.doc.study.source === 'none'} onclick={() => addDetail()} aria-label={t('Add a detail map')} title={store.doc.study.source === 'none' ? t('Choose a place first') : t('Add a detail map: a zoomed-in part of the study area')}>
        {@render detailIcon()}
        <span class="tile-name">{t('Detail map')}</span>
      </button>
    </div>
    <p class="hint">{store.doc.study.source === 'none' ? t('Choose a place first.') : t('A zoomed-in part of the study area in a frame of its own, with a zoom box and lines from the main map. Pick a place or area on the map first to start there.')}</p>
  </section>

  <section>
    <h3 class="group-title">{t('Text')}</h3>
    <div class="tiles three">
      <button class="tile" onclick={() => addText('title')}><b class="tt big" aria-hidden="true">Aa</b><span>{t('Title')}</span></button>
      <button class="tile" onclick={() => addText('label')}><b class="tt" aria-hidden="true">(a)</b><span>{t('Panel letter')}</span></button>
      <button class="tile" onclick={() => addText('note')}><i class="tt small" aria-hidden="true">note</i><span>{t('Small note')}</span></button>
    </div>
  </section>

  <section>
    <h3 class="group-title">{t('Shapes and arrows')}</h3>
    <div class="tiles four">
      <button class="tile" onclick={() => addShape('rect')} aria-label={t('Add a rectangle')} title={t('Add a rectangle')}><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="9" y="13" width="30" height="22" fill="#D55E00" fill-opacity=".12" stroke="#D55E00" stroke-width="2" /></svg><span class="tile-name">{t('Rectangle')}</span></button>
      <button class="tile" onclick={() => addShape('ellipse')} aria-label={t('Add a circle')} title={t('Add a circle')}><svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="24" rx="15" ry="12" fill="#D55E00" fill-opacity=".12" stroke="#D55E00" stroke-width="2" /></svg><span class="tile-name">{t('Circle')}</span></button>
      <button class="tile" onclick={() => addShape('line')} aria-label={t('Add a line')} title={t('Add a line')}><svg viewBox="0 0 48 48" aria-hidden="true"><line x1="10" y1="34" x2="38" y2="14" stroke="#D55E00" stroke-width="2.2" stroke-linecap="round" /></svg><span class="tile-name">{t('Line')}</span></button>
      <button class="tile" onclick={() => addShape('arrow')} aria-label={t('Add an arrow')} title={t('Add an arrow')}><svg viewBox="0 0 48 48" aria-hidden="true"><line x1="10" y1="34" x2="36" y2="15" stroke="#D55E00" stroke-width="2.2" stroke-linecap="round" /><path d="M39 13l-10 1 5 7z" fill="#D55E00" /></svg><span class="tile-name">{t('Arrow')}</span></button>
    </div>
  </section>

  <!-- drawing on the map itself: shapes keep their place on the ground and get their own legend line -->
  <section>
    <h3 class="group-title">{t('Draw on the map')}</h3>
    <div class="tiles four">
      <button class="tile" disabled={store.doc.study.source === 'none'} onclick={() => drawOnMap('point')} aria-label={t('Draw points on the map')} title={t('Draw points on the map')}><svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="17" cy="30" r="3.4" fill="#0072B2" /><circle cx="29" cy="18" r="3.4" fill="#0072B2" /><circle cx="33" cy="32" r="3.4" fill="#0072B2" /></svg><span class="tile-name">{t('Points')}</span></button>
      <button class="tile" disabled={store.doc.study.source === 'none'} onclick={() => drawOnMap('line')} aria-label={t('Draw a line on the map')} title={t('Draw a line on the map')}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 33 L19 19 L28 27 L39 13" fill="none" stroke="#0072B2" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" /></svg><span class="tile-name">{t('Line')}</span></button>
      <button class="tile" disabled={store.doc.study.source === 'none'} onclick={() => drawOnMap('polygon')} aria-label={t('Draw an area on the map')} title={t('Draw an area on the map')}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 30 L17 13 L33 12 L38 27 L24 36 Z" fill="#0072B2" fill-opacity=".14" stroke="#0072B2" stroke-width="2" stroke-linejoin="round" /></svg><span class="tile-name">{t('Area')}</span></button>
      <button class="tile" disabled={store.doc.study.source === 'none'} onclick={() => drawOnMap('freehand')} aria-label={t('Draw freehand on the map')} title={t('Draw freehand on the map')}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 30c4-9 8-13 12-9s1 11 6 11 7-12 11-15" fill="none" stroke="#0072B2" stroke-width="2.2" stroke-linecap="round" /></svg><span class="tile-name">{t('Freehand')}</span></button>
    </div>
    <p class="hint">{store.doc.study.source === 'none' ? t('Choose a place first.') : t('Shapes go into the layer “My drawing”, with its own legend line and colours.')}</p>
  </section>

  <!-- a table of the sample sites, and a chart of the ground along a drawn line: each waits for what it is made from -->
  <section>
    <h3 class="group-title">{t('Tables and charts')}</h3>
    <div class="tiles three">
      <button class="tile" disabled={!hasSites} onclick={() => addTable()} aria-label={t('Add a table of the sample sites')} title={hasSites ? t('Add a table of the sample sites') : t('Add sample points first to make a table of them')}><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="11" width="32" height="26" fill="#fff" stroke="#1B1F1D" stroke-width="1.4" /><path d="M8 18h32" stroke="#1B1F1D" stroke-width="1.8" /><path d="M8 24.5h32M8 31h32" stroke="#B4B4AE" stroke-width="1" /><path d="M19 11v26M30 11v26" stroke="#B4B4AE" stroke-width="1" /></svg><span class="tile-name">{t('Table of sites')}</span></button>
      <button class="tile" disabled={!hasLine} onclick={() => addProfile()} aria-label={t('Add an elevation profile of a line you drew')} title={hasLine ? t('Add an elevation profile of a line you drew') : t('Draw a line on the map first to make a profile of it')}><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 10v28h31" fill="none" stroke="#1B1F1D" stroke-width="1.4" /><path d="M11 34 L17 26 L22 30 L29 17 L35 24 L39 20 V37 H11Z" fill="#0072B2" fill-opacity=".2" /><path d="M11 34 L17 26 L22 30 L29 17 L35 24 L39 20" fill="none" stroke="#0072B2" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" /></svg><span class="tile-name">{t('Elevation profile')}</span></button>
    </div>
    <p class="hint">{chartHint}</p>
  </section>
  {/if}
</div>

<style>
  /* a rule-separated list: a hairline above every row but the first, no outer box (the switch itself is the global one) */
  .switches { display: grid; }
  .row-switch { padding: 8px 4px; font-weight: 500; }
  .switches > * + * { border-top: 1px solid var(--line); }
  .row-switch:hover { background: var(--panel-2); }
  .row-switch small { font-weight: 400; }
  /* a row in that list that opens something instead of switching: the same name-and-hint look, a caret at the end */
  .row-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; padding: 8px 4px; border: 0; border-radius: 0; background: transparent; text-align: left; font-size: 14px; font-weight: 500; color: var(--ink); }
  .row-link > span { display: grid; gap: 1px; min-width: 0; }
  .row-link small { font-size: 12.5px; font-weight: 400; color: var(--ink-3); line-height: 1.35; }
  .row-link:hover { background: var(--panel-2); }
  .row-link :global(svg) { flex: none; color: var(--ink-3); }
  .row-link:focus-visible { outline-offset: -2px; }
  @media (pointer: coarse) { .row-link { min-height: 44px; } }
  .tiles { display: grid; gap: 8px; }
  .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  /* five named north arrows: one row on a wide panel and on phones, 3 + 2 on the narrower 300 px panel */
  .five { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
  .five .tile { padding-inline: 0; letter-spacing: -0.02em; }
  .five .tile span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (max-width: 1100px) and (min-width: 761px) { .five { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } }
  /* picture tiles: a hairline border; the chosen one gets the 2 px blue ring */
  .tile {
    display: grid; justify-items: center; align-content: center; gap: 4px; padding: 8px 4px;
    border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel);
    font-size: 11.5px; font-weight: 500; color: var(--ink-2);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .tile svg { width: 100%; max-width: 56px; aspect-ratio: 1; }
  .tile:hover:not(:disabled) { border-color: var(--line-strong); }
  .tile:disabled { opacity: 0.45; cursor: not-allowed; }
  .tile:focus-visible { outline-offset: 0; }
  .tile[aria-pressed='true'] { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
  /* the text tiles show the glyph as the figure will draw it */
  .tt { display: grid; place-items: center; height: 40px; font-family: Arimo, Arial, sans-serif; font-size: 16px; font-weight: 600; color: var(--ink); }
  .tt.big { font-size: 20px; }
  .tt.small { font-size: 12.5px; font-weight: 400; color: var(--ink-2); }
</style>
