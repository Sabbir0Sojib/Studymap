<script lang="ts">
  // The coordinate grid of any map frame (the main map or a locator), in the manner of the QGIS map grid properties.
  import { store } from '../../lib/store.svelte';
  import type { MapItem } from '../../lib/store.svelte';
  import { gridSettings } from '../../lib/grid';
  import type { Side } from '../../lib/grid';
  import SidePicker from './SidePicker.svelte';
  import TextStyleRow from './TextStyleRow.svelte';
  import ColorPicker from '../ColorPicker.svelte';
  import { TEXT } from '../../lib/textstyle';
  import { t } from '../../lib/i18n.svelte';

  interface Props { grid: MapItem['grid']; allowMetres?: boolean; metresName?: string }
  let { grid, allowMetres = false, metresName = 'map units' }: Props = $props();
  const c = () => store.commit();
  const m = { get grid() { return grid; } };
  const geographic = $derived(!allowMetres);
  const gs = $derived(gridSettings(m.grid));
  function setGrid<K extends keyof MapItem['grid']>(k: K, v: MapItem['grid'][K]) { m.grid[k] = v; c(); }
  function setAnn(side: Side, k: 'show' | 'pos' | 'dir', v: string) {
    m.grid.ann = { ...gs.ann, [side]: { ...gs.ann[side], [k]: v } };
    c();
  }
  const SIDES: [Side, string][] = [['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom']];
  const DEG_STEPS = [10, 5, 2, 1, 0.5, 0.25, 1 / 6, 1 / 12, 1 / 30, 1 / 60, 30 / 3600, 10 / 3600];
  const M_STEPS = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const fmtStep = (s: number) => (s >= 1 ? `${s}°` : s >= 1 / 60 ? `${Math.round(s * 60)}′` : `${Math.round(s * 3600)}″`);
  const fmtM = (s: number) => (s >= 1000 ? `${s / 1000} km` : `${s} m`);

  /* one-click looks seen in journals */
  function preset(id: 'journal' | 'zebra' | 'four' | 'utm' | 'clean') {
    const g = m.grid;
    g.show = true;
    if (id === 'journal') Object.assign(g, { type: 'lines', units: 'degrees', frame: 'ticks-out', frameSize: 1, ann: undefined, sides: 'two', lineColor: '#B4B4AE' });
    if (id === 'four') Object.assign(g, { type: 'lines', units: 'degrees', frame: 'ticks-out', frameSize: 1, ann: undefined, sides: 'all' });
    if (id === 'zebra') Object.assign(g, { type: 'frame', units: 'degrees', frame: 'zebra', frameSize: 1.2, ann: undefined, sides: 'all' });
    if (id === 'clean') Object.assign(g, { type: 'crosses', units: 'degrees', frame: 'ticks-in', frameSize: 1.2, ann: undefined, sides: 'two', lineColor: '#77776F' });
    if (id === 'utm') Object.assign(g, { type: 'lines', units: 'metres', stepM: 'auto', frame: 'ticks-out', frameSize: 1, ann: undefined, sides: 'two' });
    c();
  }
</script>

<!-- No wrapper element: these are children of the panel's .stack, so they share its spacing and hairlines.
     The switch and the quick looks come first; everything else is in the closed "Fine-tune the grid". -->
<section>
  <h3 class="group-title">{t('Coordinate grid')}</h3>
  <label class="row-switch"><span>{t('Show the coordinate grid')}</span><input type="checkbox" role="switch" checked={m.grid.show} onchange={() => setGrid('show', !m.grid.show)} /></label>
  {#if m.grid.show}
    <div class="field"><span>{t('Quick looks')}</span>
      <div class="presets" role="group" aria-label={t('Grid looks')}>
        <button class="chip" onclick={() => preset('journal')}>{t('Journal')}</button>
        <button class="chip" onclick={() => preset('four')}>{t('All four sides')}</button>
        <button class="chip" onclick={() => preset('zebra')}>{t('Zebra frame')}</button>
        <button class="chip" onclick={() => preset('clean')}>{t('Crosses')}</button>
        <button class="chip" onclick={() => preset('utm')} disabled={geographic}>{t('UTM metres')}</button>
      </div>
      <p class="hint">{t('Zebra frame draws black and white blocks along the edge of the map, like the markings of a ruler.')}</p>
    </div>
  {/if}
</section>

{#if m.grid.show}
  <details class="acc">
    <summary>{t('Fine-tune the grid')}</summary>
    <div class="acc-body">
      <div class="field"><span>{t('Coordinates on these sides (click a side)')}</span><SidePicker {grid} /></div>
      <div class="field"><span>{t('Grid type')}</span>
        <div class="seg" role="group" aria-label={t('Grid type')}>
          <button aria-pressed={gs.type === 'lines'} onclick={() => { setGrid('type', 'lines'); m.grid.lines = true; }}>{t('Lines')}</button>
          <button aria-pressed={gs.type === 'crosses'} onclick={() => setGrid('type', 'crosses')}>{t('Crosses')}</button>
          <button aria-pressed={gs.type === 'frame'} onclick={() => { setGrid('type', 'frame'); m.grid.lines = false; }}>{t('Frame only')}</button>
        </div>
      </div>
      <div class="field"><span>{t('Units')}</span>
        <div class="seg wrap" role="group" aria-label={t('Grid units')}>
          <button aria-pressed={gs.units === 'degrees'} onclick={() => setGrid('units', 'degrees')}>{t('Latitude / longitude')}</button>
          <button aria-pressed={gs.units === 'metres'} disabled={geographic} title={geographic ? t('Needs a projected map: pick a projection in Main properties') : metresName} onclick={() => setGrid('units', 'metres')}>{t('Metres')}</button>
        </div>
        {#if gs.units === 'metres'}<p class="hint">{t('Metres in {name}.', { name: metresName })}</p>{/if}
      </div>
      <div class="grid2">
        <label class="field"><span>{t('Interval')}</span>
          {#if gs.units === 'metres'}
            <select class="input" value={String(gs.stepM)} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; setGrid('stepM', v === 'auto' ? 'auto' : Number(v)); }}>
              <option value="auto">{t('Automatic')}</option>
              {#each M_STEPS as s}<option value={String(s)}>{fmtM(s)}</option>{/each}
            </select>
          {:else}
            <select class="input" value={String(m.grid.step)} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; setGrid('step', v === 'auto' ? 'auto' : Number(v)); }}>
              <option value="auto">{t('Automatic')}</option>
              {#each DEG_STEPS as s}<option value={String(s)}>{fmtStep(s)}</option>{/each}
            </select>
          {/if}
        </label>
        <div class="field"><span>{t('Line colour')}</span><ColorPicker value={m.grid.lineColor} label={t('Grid line colour')} onchange={(v) => setGrid('lineColor', v)} /></div>
      </div>
      {#if gs.type !== 'frame'}
        <label class="field slider"><span>{t('Line width')} <span class="val" aria-hidden="true">{gs.linePt} pt</span></span><input type="range" min="0.1" max="1.5" step="0.05" value={gs.linePt} aria-valuetext="{gs.linePt} pt" oninput={(e) => { m.grid.linePt = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
        {#if gs.type === 'lines'}<label class="row-switch"><span>{t('Dashed lines')}</span><input type="checkbox" role="switch" checked={gs.dash} onchange={() => setGrid('dash', !gs.dash)} /></label>{/if}
      {/if}

      <details class="acc quiet">
        <summary>{t('Frame round the map')}</summary>
        <div class="acc-body">
          <label class="field"><span>{t('Frame style')}</span>
            <select class="input" value={gs.frame} onchange={(e) => setGrid('frame', (e.target as HTMLSelectElement).value as typeof gs.frame)}>
              <option value="ticks-out">{t('Ticks outside')}</option>
              <option value="ticks-in">{t('Ticks inside')}</option>
              <option value="ticks-both">{t('Ticks inside and outside')}</option>
              <option value="zebra">{t('Zebra (black and white blocks)')}</option>
              <option value="line">{t('Line only')}</option>
              <option value="none">{t('No frame')}</option>
            </select>
          </label>
          {#if gs.frame !== 'none' && gs.frame !== 'line'}
            <label class="field slider"><span>{gs.frame === 'zebra' ? t('Zebra width') : t('Tick length')} <span class="val" aria-hidden="true">{gs.frameSize} mm</span></span><input type="range" min="0.5" max="4" step="0.1" value={gs.frameSize} aria-valuetext="{gs.frameSize} mm" oninput={(e) => { m.grid.frameSize = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
          {/if}
        </div>
      </details>

      <details class="acc quiet">
        <summary>{t('Coordinate labels')}</summary>
        <div class="acc-body">
          <div class="grid2">
            <label class="field"><span>{t('Format')}</span>
              <select class="input" value={m.grid.format} onchange={(e) => setGrid('format', (e.target as HTMLSelectElement).value as MapItem['grid']['format'])} disabled={gs.units === 'metres'}>
                <option value="dm">24°50′N</option>
                <option value="dms">24°50′30″N</option>
                <option value="dd">24.84°N</option>
              </select>
            </label>
            <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{m.grid.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" value={m.grid.labelPt} aria-valuetext="{m.grid.labelPt} pt" oninput={(e) => { m.grid.labelPt = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
          </div>
          <TextStyleRow label={t('Coordinate style')} value={m.grid.text} defaults={TEXT.grid} onchange={(v) => { m.grid.text = v; c(); }} />
          <label class="field slider"><span>{t('Distance from the frame')} <span class="val" aria-hidden="true">{gs.gap} mm</span></span><input type="range" min="0" max="4" step="0.1" value={gs.gap} aria-valuetext="{gs.gap} mm" oninput={(e) => { m.grid.gap = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
          <div class="sides" role="table" aria-label={t('Coordinates on each side')}>
            <div class="srow head" role="row"><span role="columnheader">{t('Side')}</span><span role="columnheader">{t('Show')}</span><span role="columnheader">{t('Where')}</span><span role="columnheader">{t('Text')}</span></div>
            {#each SIDES as [side, name]}
              {@const a = gs.ann[side]}
              <div class="srow" role="row">
                <span role="rowheader">{t(name)}</span>
                <select class="input" value={a.show} onchange={(e) => setAnn(side, 'show', (e.target as HTMLSelectElement).value)} aria-label={t('{side}: show', { side: t(name) })}>
                  <option value="all">{t('All')}</option>
                  <option value="lat">{gs.units === 'metres' ? t('Northing') : t('Latitude')}</option>
                  <option value="lon">{gs.units === 'metres' ? t('Easting') : t('Longitude')}</option>
                  <option value="none">{t('None')}</option>
                </select>
                <select class="input" value={a.pos} onchange={(e) => setAnn(side, 'pos', (e.target as HTMLSelectElement).value)} aria-label={t('{side}: where', { side: t(name) })} disabled={a.show === 'none'}>
                  <option value="out">{t('Outside')}</option>
                  <option value="in">{t('Inside')}</option>
                </select>
                <select class="input" value={a.dir} onchange={(e) => setAnn(side, 'dir', (e.target as HTMLSelectElement).value)} aria-label={t('{side}: text direction', { side: t(name) })} disabled={a.show === 'none'}>
                  <option value="h">{t('Across')}</option>
                  <option value="v">{t('Along')}</option>
                </select>
              </div>
            {/each}
          </div>
        </div>
      </details>
    </div>
  </details>
{/if}

<style>
  .presets { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { border: 1px solid var(--line-strong); background: var(--panel); border-radius: var(--r-chip); padding: 4px 11px; font-size: 12.5px; color: var(--ink-2); }
  .chip:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
  .chip:disabled { opacity: 0.4; cursor: not-allowed; }
  /* two even columns; minmax(0, 1fr) so a wide select can never push a column past the panel */
  .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .sides { display: grid; gap: 4px; }
  .srow { display: grid; grid-template-columns: 42px minmax(0, 1.4fr) repeat(2, minmax(0, 1fr)); gap: 4px; align-items: center; font-size: 12.5px; }
  /* the compact drop-downs of the table: a smaller caret so the words keep their room */
  .srow select.input { min-height: 34px; height: 34px; padding: 0 20px 0 6px; font-size: 12.5px; background-position: right 5px center; background-size: 12px; }
  .srow.head { color: var(--ink-3); font-size: 11.5px; }
  @media (pointer: coarse) {
    .chip { min-height: 44px; padding: 4px 14px; }
    .srow select.input { min-height: 44px; height: 44px; }
  }
</style>
