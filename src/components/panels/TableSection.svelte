<script lang="ts">
  // Settings of a table of sample sites: which points layer, its columns (switches, in the order they print), how latitude and
  // longitude are written, the look (zebra rows, frame, caption) and the text size.
  import ArrowUp from 'phosphor-svelte/lib/ArrowUp';
  import ArrowDown from 'phosphor-svelte/lib/ArrowDown';
  import { store } from '../../lib/store.svelte';
  import type { TableItem } from '../../lib/store.svelte';
  import { SPECIAL, defaultCols, fmtCoord, sitesLayers, tableColumns } from '../../lib/figparts';
  import { TEXT } from '../../lib/textstyle';
  import TextStyleRow from './TextStyleRow.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { tb }: { tb: TableItem } = $props();
  const c = () => store.commit();

  const layers = $derived(sitesLayers(store.doc, store.geoms));
  const layer = $derived(store.doc.layers.find((l) => l.id === tb.layer));
  const fc = $derived(layer ? store.geoms[layer.id] : undefined);
  // every column that can be shown: the special ones first, then the table's own, in the order the table has them
  const all = $derived(['#no', '#lat', '#lon', ...tableColumns(fc)]);
  const shown = $derived(tb.cols.filter((k) => all.includes(k)));
  // the columns on show, in their order, then the ones that are off
  const rows = $derived([...shown, ...all.filter((k) => !shown.includes(k))]);
  const name = (k: string) => SPECIAL[k] ?? k;
  const hint = (k: string) => (k === '#no' ? (layer?.pointsBy?.number ? t('The numbers on the markers') : t('1, 2, 3 in table order')) : '');
  const showsCoords = $derived(shown.includes('#lat') || shown.includes('#lon'));

  function setLayer(id: string) {
    const l = store.doc.layers.find((x) => x.id === id);
    if (!l) return;
    tb.layer = id;
    tb.cols = defaultCols(l, store.geoms[id]);
    c();
  }
  function toggle(k: string) {
    if (shown.includes(k)) { if (shown.length > 1) tb.cols = shown.filter((x) => x !== k); }
    else tb.cols = [...shown, k];
    c();
  }
  function move(k: string, d: -1 | 1) {
    const i = shown.indexOf(k), j = i + d;
    if (i < 0 || j < 0 || j >= shown.length) return;
    const next = [...shown];
    [next[i], next[j]] = [next[j], next[i]];
    tb.cols = next;
    c();
  }
  // an example of each way to write a coordinate, from the first site (so "23°45′12″N" is not a made-up place)
  const sample = $derived.by(() => {
    const f = fc?.features.find((x) => x.geometry?.type === 'Point');
    const g = f?.geometry;
    return g && g.type === 'Point' ? ([g.coordinates[0], g.coordinates[1]] as [number, number]) : ([91.8687, 24.8949] as [number, number]);
  });
</script>

<section>
  <h3 class="group-title">{t('Table of sites')}</h3>
  {#if layers.length}
    <label class="field"><span>{t('Sample points')}</span>
      <select class="input" value={tb.layer} onchange={(e) => setLayer((e.target as HTMLSelectElement).value)}>
        {#each layers as l}<option value={l.id}>{l.name}</option>{/each}
        {#if !layers.some((l) => l.id === tb.layer)}<option value={tb.layer} disabled>{t('(removed layer)')}</option>{/if}
      </select>
    </label>
  {:else}
    <p class="hint warn">{t('There are no sample points on the map. Add them in Map parts, Add, Add your own.')}</p>
  {/if}
  <label class="field"><span>{t('Caption above the table (optional)')}</span><input class="input" bind:value={tb.title} oninput={c} placeholder={t('e.g. Table 1. Sampling sites')} /></label>
</section>

<section>
  <h3 class="group-title">{t('Columns')}</h3>
  <ul class="cols" aria-label={t('Columns of the table')}>
    {#each rows as k (k)}
      {@const on = shown.includes(k)}
      {@const i = shown.indexOf(k)}
      <li class:off={!on}>
        <label class="row-switch"><span>{name(k)}{#if hint(k)}<small>{hint(k)}</small>{/if}</span><input type="checkbox" role="switch" checked={on} disabled={on && shown.length === 1} onchange={() => toggle(k)} aria-label={t('Show the column {name}', { name: name(k) })} /></label>
        <span class="mv">
          {#if on}
            <button class="ic" onclick={() => move(k, -1)} disabled={i === 0} aria-label={t('Move {name} left', { name: name(k) })} title={t('Move left')}><ArrowUp size={14} /></button>
            <button class="ic" onclick={() => move(k, 1)} disabled={i === shown.length - 1} aria-label={t('Move {name} right', { name: name(k) })} title={t('Move right')}><ArrowDown size={14} /></button>
          {/if}
        </span>
      </li>
    {/each}
  </ul>
  <p class="hint">{t('Switch on the columns to print. They run left to right in the order above; use the arrows to change it.')}</p>
</section>

{#if showsCoords}
  <section>
    <h3 class="group-title">{t('Latitude and longitude')}</h3>
    <div class="seg" role="group" aria-label={t('How latitude and longitude are written')}>
      <button aria-pressed={tb.coord === 'dms'} onclick={() => { tb.coord = 'dms'; c(); }}>{fmtCoord(sample[1], 'lat', 'dms')}</button>
      <button aria-pressed={tb.coord === 'dec'} onclick={() => { tb.coord = 'dec'; c(); }}>{fmtCoord(sample[1], 'lat', 'dec')}</button>
    </div>
    <p class="hint">{t('Degrees, minutes and seconds, or decimal degrees with four places.')}</p>
  </section>
{/if}

<section>
  <h3 class="group-title">{t('Look')}</h3>
  <label class="row-switch"><span>{t('Light bands on every second row')}<small>{t('Helps the eye follow a long row')}</small></span><input type="checkbox" role="switch" checked={tb.zebra} onchange={() => { tb.zebra = !tb.zebra; c(); }} /></label>
  <label class="row-switch"><span>{t('Frame')}<small>{t('A hairline round the table')}</small></span><input type="checkbox" role="switch" checked={tb.frame} onchange={() => { tb.frame = !tb.frame; c(); }} /></label>
</section>

<section>
  <h3 class="group-title">{t('Text')}</h3>
  <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{tb.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={tb.labelPt} aria-valuetext="{tb.labelPt} pt" oninput={c} /></label>
  <TextStyleRow label={t('Text style')} value={tb.text} defaults={TEXT.legend} onchange={(v) => { tb.text = v; c(); }} />
  <p class="hint">{t('The header row is always bold. Numbers line up against the right edge of their column.')}</p>
</section>

<details class="acc quiet">
  <summary>{t('More options')}</summary>
  <div class="acc-body">
    <label class="row-switch"><span>{t('Fit the box to the table')}<small>{t('The box is as wide as the columns and as tall as the rows. Switch off to size it by hand; rows that do not fit are left out.')}</small></span><input type="checkbox" role="switch" checked={tb.fit !== false} onchange={() => { tb.fit = tb.fit === false ? undefined : false; c(); }} /></label>
  </div>
</details>

<style>
  /* the columns: ruled rows, a switch and the name at the left, the order arrows at the right */
  .cols { list-style: none; margin: 0; padding: 0; display: grid; max-height: 320px; overflow-y: auto; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  li { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px; padding: 0 4px; }
  li + li { border-top: 1px solid var(--line); }
  li:hover { background: var(--panel-2); }
  li.off .row-switch > span { color: var(--ink-3); }
  .row-switch { font-weight: 500; min-height: 38px; }
  .row-switch small { font-weight: 400; }
  .mv { display: flex; gap: 2px; min-width: 60px; justify-content: flex-end; }
  .ic { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: var(--r-chip); background: transparent; color: var(--ink-3); }
  .ic:hover:not(:disabled) { background: var(--panel); color: var(--ink); }
  .ic:disabled { opacity: 0.35; cursor: default; }
  @media (pointer: coarse) { .ic { width: 44px; height: 44px; } .mv { min-width: 92px; } }
  .seg button { font-variant-numeric: tabular-nums; }
</style>
