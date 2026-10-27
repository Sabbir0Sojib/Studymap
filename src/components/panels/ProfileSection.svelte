<script lang="ts">
  // Settings of an elevation profile: the line it follows, its colours, what is written on it and the text size.
  import { store } from '../../lib/store.svelte';
  import type { ProfileItem } from '../../lib/store.svelte';
  import { drawnLines, lineCoords, lineKey, profileLayout } from '../../lib/figparts';
  import { profileState, retryProfile } from '../../lib/figparts.svelte';
  import { fmtNumber } from '../../lib/carto';
  import { TEXT } from '../../lib/textstyle';
  import ColorPicker from '../ColorPicker.svelte';
  import TextStyleRow from './TextStyleRow.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { pr }: { pr: ProfileItem } = $props();
  const c = () => store.commit();

  const lines = $derived(drawnLines(store.doc, store.geoms));
  const here = $derived(lines.some((l) => l.ref === pr.line));
  // the chart as drawn now: its heights, if they belong to the line that is chosen
  const coords = $derived(lineCoords(pr.line, store.geoms));
  const ready = $derived(!!pr.data && !!coords && pr.data.key === lineKey(coords));
  const P = $derived(pr.data ? profileLayout(pr, pr.data) : null);
  const state = $derived(profileState[pr.id] ?? '');
  // the sentence in the chosen language (the state itself stays English: the figure's placeholder shows it as it is)
  const tail = ' Check your connection, then try again.';
  const stateText = $derived(state.endsWith(tail) ? `${t(state.slice(0, -tail.length))} ${t(tail.trim())}` : t(state));
  const failed = $derived(!!state && !/^Reading/.test(state) && !/not on the map/.test(state));
  const COLOURS: [string, string][] = [['#0072B2', 'blue'], ['#D55E00', 'vermillion'], ['#009E73', 'bluish green'], ['#E69F00', 'orange'], ['#CC79A7', 'reddish purple'], ['#1B1F1D', 'black']];
  const fillOn = $derived(pr.fillOpacity !== 0);
  // the data, in words: how far, how high, how fine
  const summary = $derived.by(() => {
    const d = pr.data;
    if (!d) return '';
    const lo = Math.round(Math.min(...d.m)), hi = Math.round(Math.max(...d.m));
    const res = Math.round((40075016 * Math.cos((coordsLat() * Math.PI) / 180)) / (512 * 2 ** d.z));
    return t('{n} heights along {len} km, from {lo} to {hi} m. The terrain tiles give a ground point about every {res} m here.', { n: String(d.km.length), len: d.lenKm.toLocaleString('en-US', { maximumFractionDigits: 1 }), lo: fmtNumber(lo), hi: fmtNumber(hi), res: String(res) });
  });
  function coordsLat(): number {
    const mid = coords ? coords[Math.floor(coords.length / 2)] : null;
    return mid ? mid[1] : 0;
  }
  function setLine(ref: string) {
    pr.line = ref;
    pr.data = undefined; // the heights belong to the old line; the desk reads the new ones
    c();
  }
</script>

<section>
  <h3 class="group-title">{t('Elevation profile')}</h3>
  {#if lines.length}
    <label class="field"><span>{t('Line')}</span>
      <select class="input" value={pr.line} onchange={(e) => setLine((e.target as HTMLSelectElement).value)}>
        {#each lines as l}<option value={l.ref}>{l.name} ({l.lenKm.toLocaleString('en-US', { maximumFractionDigits: 1 })} km)</option>{/each}
        {#if !here}<option value={pr.line} disabled>{t('(line removed)')}</option>{/if}
      </select>
    </label>
    {#if !here}<p class="hint warn">{t('The line this profile followed is not on the map any more. Choose another.')}</p>{/if}
  {:else}
    <p class="hint warn">{t('There is no line on the map. Draw one with the tool strip: Draw on the map, Line.')}</p>
  {/if}
  {#if ready}
    <p class="hint">{summary}</p>
  {:else if failed}
    <p class="hint warn" role="alert">{stateText}</p>
    <button class="btn small" onclick={() => retryProfile(pr.id)}>{t('Try again')}</button>
  {:else if state}
    <p class="hint" role="status">{stateText}</p>
  {/if}
</section>

<section>
  <h3 class="group-title">{t('Colours')}</h3>
  <div class="field"><span>{t('Line')}</span>
    <div class="colours" role="group" aria-label={t('Profile line colour')}>
      {#each COLOURS as [col, name]}<button class="dot" class:on={pr.color.toLowerCase() === col.toLowerCase()} style="background:{col}" aria-label={t('Use {name}', { name: t(name) })} aria-pressed={pr.color.toLowerCase() === col.toLowerCase()} onclick={() => { pr.color = col; c(); }}></button>{/each}
      <ColorPicker value={pr.color} label={t('Any line colour')} size={28} onchange={(v) => { pr.color = v; c(); }} />
    </div>
  </div>
  <label class="row-switch"><span>{t('Fill under the line')}</span><input type="checkbox" role="switch" checked={fillOn} onchange={() => { pr.fillOpacity = fillOn ? 0 : undefined; c(); }} /></label>
  {#if fillOn}
    <div class="field inline"><span>{t('Fill colour')}</span>
      <div class="row">
        {#if pr.fill}<button class="btn small ghost" onclick={() => { pr.fill = undefined; c(); }}>{t('Same as the line')}</button>{/if}
        <ColorPicker value={pr.fill ?? pr.color} label={t('Fill colour')} size={28} onchange={(v) => { pr.fill = v; c(); }} />
      </div>
    </div>
    <label class="field slider"><span>{t('Fill strength')} <span class="val" aria-hidden="true">{Math.round((pr.fillOpacity ?? 0.22) * 100)}%</span></span><input type="range" min="0.05" max="0.8" step="0.05" value={pr.fillOpacity ?? 0.22} aria-valuetext="{Math.round((pr.fillOpacity ?? 0.22) * 100)}%" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; pr.fillOpacity = Math.abs(v - 0.22) < 0.001 ? undefined : v; }} onchange={c} /></label>
  {/if}
</section>

<section>
  <h3 class="group-title">{t('On the chart')}</h3>
  <label class="row-switch"><span>{t('Mark the ends A and B')}<small>{t('Written at the two ends of the chart and at the ends of the line on the map')}</small></span><input type="checkbox" role="switch" bind:checked={pr.ends} onchange={c} /></label>
  <label class="row-switch"><span>{t('Show the lowest and highest points')}<small>{t('A dot and the height in metres')}</small></span><input type="checkbox" role="switch" bind:checked={pr.extremes} onchange={c} /></label>
  <label class="row-switch"><span>{t('Show the vertical exaggeration')}<small>{P && ready ? t('Now {x}: the chart always fits its box, so the height is stretched by this much', { x: P.exagText.replace('Vertical exaggeration ', '') }) : t('Written on the chart; the chart always fits its box')}</small></span><input type="checkbox" role="switch" bind:checked={pr.exag} onchange={c} /></label>
  {#if pr.exag && P && ready && !P.exagFits}<p class="hint warn">{t('The box is too narrow for that text. Make it wider.')}</p>{/if}
</section>

<section>
  <h3 class="group-title">{t('Text')}</h3>
  <label class="field slider"><span>{t('Text size')} <span class="val" aria-hidden="true">{pr.labelPt} pt</span></span><input type="range" min="5" max="12" step="0.5" bind:value={pr.labelPt} aria-valuetext="{pr.labelPt} pt" oninput={c} /></label>
  <TextStyleRow label={t('Text style')} value={pr.text} defaults={TEXT.legend} onchange={(v) => { pr.text = v; c(); }} />
</section>

<details class="acc quiet">
  <summary>{t('More options')}</summary>
  <div class="acc-body">
    <label class="field slider"><span>{t('Line width')} <span class="val" aria-hidden="true">{pr.linePt ?? 0.8} pt</span></span><input type="range" min="0.25" max="3" step="0.05" value={pr.linePt ?? 0.8} aria-valuetext="{pr.linePt ?? 0.8} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; pr.linePt = Math.abs(v - 0.8) < 0.001 ? undefined : v; }} onchange={c} /></label>
    <label class="row-switch"><span>{t('Axis titles')}<small>Distance (km) and Elevation (m)</small></span><input type="checkbox" role="switch" checked={pr.axisTitles !== false} onchange={() => { pr.axisTitles = pr.axisTitles === false ? undefined : false; c(); }} /></label>
    <label class="row-switch"><span>{t('Light grid lines')}</span><input type="checkbox" role="switch" checked={pr.grid !== false} onchange={() => { pr.grid = pr.grid === false ? undefined : false; c(); }} /></label>
  </div>
</details>

<style>
  .colours { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  .dot:hover { box-shadow: 0 0 0 2px var(--ink-2); }
  .dot.on { box-shadow: 0 0 0 2px var(--accent); }
  .field.inline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
</style>
