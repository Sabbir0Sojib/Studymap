<script lang="ts">
  // Settings of a detail map: what it shows (scale, zoom, area), the zoom box that marks it on the main map, its label, frame and grid.
  import { store } from '../../lib/store.svelte';
  import type { DetailItem } from '../../lib/store.svelte';
  import type { MainScene } from '../../lib/scene';
  import { niceScale } from '../../lib/scene';
  import { frames } from '../../lib/frames.svelte';
  import { detailZoom } from '../../lib/figdraw';
  import { fitDetailToArea, parseScale, setDetailScale, zoomDetail } from '../../lib/actions';
  import { TEXT } from '../../lib/textstyle';
  import GridPanel from './GridPanel.svelte';
  import TextStyleRow from './TextStyleRow.svelte';
  import ColorPicker from '../ColorPicker.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { d, main }: { d: DetailItem; main: MainScene | null } = $props();
  const c = () => store.commit();
  /** the lines to the main map are wanted but something lies across them (Figure leaves them out) */
  const blocked = $derived(d.showBox && d.connect && !!detailZoom(store.doc, main, frames.details).find((b) => b.id === d.id)?.blocked);
  function setScale(v: string) { const n = parseScale(v); if (n) setDetailScale(d, n); }
</script>

<section>
  <h3 class="group-title">{t('What it shows')}</h3>
  <div class="field" role="group" aria-labelledby="dscale-l"><span id="dscale-l">{t('Scale')}</span>
    <div class="inline">
      <span class="pre">1 :</span>
      <input class="input" inputmode="numeric" value={niceScale(d.scale).toLocaleString('en-US')} onchange={(e) => setScale((e.target as HTMLInputElement).value)} aria-label={t('Detail map scale')} />
      <select class="input narrow" aria-label={t('Common scales')} onchange={(e) => { setScale((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}>
        <option value="">{t('Pick')}</option>
        {#each [2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000] as n}<option value={n}>1:{n.toLocaleString('en-US')}</option>{/each}
      </select>
    </div>
  </div>
  <div class="row">
    <button class="btn small" onclick={() => zoomDetail(d, 1.25)}>{t('Zoom in')}</button>
    <button class="btn small" onclick={() => zoomDetail(d, 1 / 1.25)}>{t('Zoom out')}</button>
  </div>
  <div class="row">
    <button class="btn small" onclick={() => fitDetailToArea(d)}>{t('Fit to the study area')}</button>
    <button class="btn small" onclick={() => { store.detailPick = d.id; store.status = ''; }} aria-pressed={store.detailPick === d.id}>{t('Choose on the main map')}</button>
  </div>
  <p class="hint">{t('Scroll over the detail map to zoom it. Click it once, then drag inside to move what it shows. Or choose its area by dragging a box on the main map.')}</p>
  <p class="hint">{t('It draws the same layers and styles as the main map (one layer list for the whole figure: change them in Layers), in the same projection.')}</p>
</section>

<section>
  <h3 class="group-title">{t('Zoom box on the main map')}</h3>
  <label class="row-switch"><span>{t('Mark this area on the main map')}</span><input type="checkbox" role="switch" bind:checked={d.showBox} onchange={c} /></label>
  {#if d.showBox}
    <label class="row-switch"><span>{t('Lines to this map')}</span><input type="checkbox" role="switch" bind:checked={d.connect} onchange={c} /></label>
    {#if blocked}<p class="hint warn">{t('The lines are left out because another part of the figure lies across them. Move that part, or keep the lines off.')}</p>{/if}
    <div class="field inline"><span>{t('Box colour')}</span><ColorPicker value={d.boxColor} label={t('Zoom box colour')} onchange={(v) => { d.boxColor = v; c(); }} /></div>
  {/if}
</section>
{#if d.showBox}
  <details class="acc quiet">
    <summary>{t('More options')}</summary>
    <div class="acc-body">
      <label class="field slider"><span>{t('Zoom box line')} <span class="val" aria-hidden="true">{d.boxPt ?? 0.8} pt</span></span><input type="range" min="0.25" max="2.5" step="0.05" value={d.boxPt ?? 0.8} aria-valuetext="{d.boxPt ?? 0.8} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; d.boxPt = v === 0.8 ? undefined : v; }} onchange={c} /></label>
      <label class="field slider"><span>{t('Zoom box fill')} <span class="val" aria-hidden="true">{Math.round((d.boxFill ?? 0.07) * 100)}%</span></span><input type="range" min="0" max="0.6" step="0.01" value={d.boxFill ?? 0.07} aria-valuetext={t('{n} percent', { n: Math.round((d.boxFill ?? 0.07) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; d.boxFill = v === 0.07 ? undefined : v; }} onchange={c} /></label>
      {#if d.connect}
        <label class="field slider"><span>{t('Zoom lines')} <span class="val" aria-hidden="true">{d.connectPt ?? 0.5} pt</span></span><input type="range" min="0.1" max="2" step="0.05" value={d.connectPt ?? 0.5} aria-valuetext="{d.connectPt ?? 0.5} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; d.connectPt = v === 0.5 ? undefined : v; }} onchange={c} /></label>
        <label class="row-switch"><span>{t('Dashed zoom lines')}</span><input type="checkbox" role="switch" checked={!!d.connectDash} onchange={() => { d.connectDash = d.connectDash ? undefined : true; c(); }} /></label>
      {/if}
    </div>
  </details>
{/if}

<section>
  <h3 class="group-title">{t('Label')}</h3>
  <label class="field"><span>{t('Letter or caption (optional)')}</span><input class="input" bind:value={d.label} oninput={c} placeholder={t('e.g. (b)')} /></label>
  <label class="row-switch"><span>{t('Write the scale in the corner')}<small>{t('For example 1:25,000')}</small></span><input type="checkbox" role="switch" checked={!!d.scaleText} onchange={() => { d.scaleText = d.scaleText ? undefined : true; c(); }} /></label>
  {#if d.label || d.scaleText}
    <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{d.labelPt} pt</span></span><input type="range" min="5" max="14" step="0.5" bind:value={d.labelPt} aria-valuetext="{d.labelPt} pt" oninput={c} /></label>
    <TextStyleRow label={t('Text style')} value={d.text} defaults={TEXT.insetLabel} onchange={(v) => { d.text = v; c(); }} />
  {/if}
</section>

<details class="acc quiet">
  <summary>{t('Frame')}</summary>
  <div class="acc-body">
    <label class="field slider"><span>{t('Frame')} <span class="val" aria-hidden="true">{d.framePt} pt</span></span><input type="range" min="0" max="2" step="0.05" bind:value={d.framePt} aria-valuetext="{d.framePt} pt" oninput={c} /></label>
    <div class="field inline"><span>{t('Frame colour')}</span>
      <div class="row">
        {#if d.frameColor}<button class="btn small ghost" onclick={() => { d.frameColor = undefined; c(); }}>{t('Reset')}</button>{/if}
        <ColorPicker value={d.frameColor ?? '#1B1F1D'} label={t('Frame colour')} onchange={(v) => { d.frameColor = v.toUpperCase() === '#1B1F1D' ? undefined : v; c(); }} />
      </div>
    </div>
  </div>
</details>

<GridPanel grid={d.grid} allowMetres={!!main && !/\+proj=(longlat|latlong|lonlat|latlon)\b/.test(main.crs.proj4)} metresName={main?.crs.name.split(' / ').pop() ?? t('map units')} />

<style>
  .inline { display: flex; align-items: center; gap: 6px; }
  .inline .input { flex: 1; min-width: 0; }
  .inline .narrow { flex: 0 0 80px; }
  .pre { color: var(--ink-3); font-size: 12.5px; }
  /* a label at the left and its colour button at the right */
  .field.inline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
</style>
