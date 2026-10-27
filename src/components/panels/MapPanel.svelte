<script lang="ts">
  // Settings of the main map frame: main properties (scale, rotation, frame, projection), the area shown, and the grid.
  import { store } from '../../lib/store.svelte';
  import type { MapItem } from '../../lib/store.svelte';
  import type { MainScene } from '../../lib/scene';
  import { mapScale, setMapScale, fitToArea, parseScale } from '../../lib/actions';
  import { frameLonLatBounds } from '../../lib/projection';
  import GridPanel from './GridPanel.svelte';
  import ColorPicker from '../ColorPicker.svelte';
  import { t } from '../../lib/i18n.svelte';

  interface Props { m: MapItem; main: MainScene | null; projection: import('svelte').Snippet }
  let { m, main, projection }: Props = $props();
  const c = () => store.commit();

  /* scale */
  const scaleNow = $derived(main ? mapScale(main.fp) : null);
  const nice = (d: number) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(d)) - 2); return Math.round(d / p) * p; };
  function setScale(v: string) { const d = parseScale(v); if (d && main) setMapScale(main.fp, d); }

  /* extent (degrees) */
  const ext = $derived(main ? frameLonLatBounds(main.fp) : null);
  let draftExt = $state<{ w: string; e: string; s: string; n: string } | null>(null);
  const shown = $derived(draftExt ?? (ext ? { w: ext[0][0].toFixed(4), e: ext[1][0].toFixed(4), s: ext[0][1].toFixed(4), n: ext[1][1].toFixed(4) } : { w: '', e: '', s: '', n: '' }));
  // Check the typed edges: each must be a number, east larger than west, north larger than south.
  let tried = $state(false);
  type Edge = 'w' | 'e' | 's' | 'n';
  const num = (s: string) => (/^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$/.test(s) ? Number(s) : NaN);
  const extErrors = $derived.by(() => {
    const out: Partial<Record<Edge, string>> = {};
    const v = draftExt;
    if (!v) return out;
    const x = { w: num(v.w), e: num(v.e), s: num(v.s), n: num(v.n) };
    for (const k of ['w', 'e', 's', 'n'] as Edge[]) {
      if (!Number.isFinite(x[k])) out[k] = t('Use a number such as 90.25.');
    }
    if (!out.w && !out.e && x.e <= x.w) out.e = t('East must be larger than West.');
    if (!out.s && !out.n && x.n <= x.s) out.n = t('North must be larger than South.');
    return out;
  });
  const shownErr = (k: Edge) => (tried ? extErrors[k] : undefined);
  function typeEdge(k: Edge, value: string) { draftExt = { ...shown, [k]: value }; }
  function applyExtent() {
    const v = draftExt;
    if (!v) return;
    tried = true;
    if (Object.keys(extErrors).length) return;
    const [w, e, s, n] = [v.w, v.e, v.s, v.n].map(num);
    store.doc.view = { padding: 0, panX: 0, panY: 0, zoom: 1, extent: [[w, s], [e, n]] };
    c();
    draftExt = null;
    tried = false;
  }
  function resetExtent() { draftExt = null; tried = false; fitToArea(); }
</script>

<!-- No wrapper element: these accordions are children of the panel's .stack, so they share its spacing and hairlines. -->
<details class="acc" open>
  <summary>{t('Main properties')}</summary>
  <div class="acc-body">
    <div class="field" role="group" aria-labelledby="scale-l"><span id="scale-l">{t('Scale')}</span>
      <div class="inline">
        <span class="pre">1 :</span>
        <input class="input" inputmode="numeric" value={scaleNow ? nice(scaleNow).toLocaleString('en-US') : ''} onchange={(e) => setScale((e.target as HTMLInputElement).value)} aria-label={t('Map scale')} />
        <select class="input narrow" aria-label={t('Common scales')} onchange={(e) => { setScale((e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = ''; }}>
          <option value="">{t('Pick')}</option>
          {#each [10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000] as d}<option value={d}>1:{d.toLocaleString('en-US')}</option>{/each}
        </select>
      </div>
    </div>
    <div class="field" role="group" aria-labelledby="rot-l"><span id="rot-l">{t('Map rotation')}</span>
      <div class="inline">
        <label class="rng"><span class="sr-only">{t('Map rotation')}</span><input type="range" min="-180" max="180" step="1" value={m.rotation ?? 0} aria-valuetext="{m.rotation ?? 0}°" oninput={(e) => { m.rotation = Number((e.target as HTMLInputElement).value); }} onchange={c} /></label>
        <input class="input num" type="number" min="-180" max="180" step="0.5" value={m.rotation ?? 0} onchange={(e) => { m.rotation = Math.max(-180, Math.min(180, Number((e.target as HTMLInputElement).value) || 0)); c(); }} aria-label={t('Map rotation in degrees')} />
        <button class="btn small ghost" onclick={() => { m.rotation = 0; c(); }} disabled={!m.rotation}>{t('Reset')}</button>
      </div>
    </div>
    <label class="field slider"><span>{t('Frame line')} <span class="val" aria-hidden="true">{m.framePt} pt</span></span><input type="range" min="0" max="2" step="0.05" bind:value={m.framePt} aria-valuetext="{m.framePt} pt" oninput={c} /></label>
    <div class="field inline"><span>{t('Frame colour')}</span>
      <div class="row">
        {#if m.frameColor}<button class="btn small ghost" onclick={() => { m.frameColor = undefined; c(); }}>{t('Reset')}</button>{/if}
        <ColorPicker value={m.frameColor ?? '#1B1F1D'} label={t('Frame colour')} onchange={(v) => { m.frameColor = v.toUpperCase() === '#1B1F1D' ? undefined : v; c(); }} />
      </div>
    </div>
    {@render projection()}
  </div>
</details>

<details class="acc">
  <summary>{t('Area shown')}</summary>
  <div class="acc-body">
    <div class="field"><span class="lbl">{t('Round the study area')}</span>
      <div class="seg" role="group" aria-label={t('Round the study area')}>
        <button aria-pressed={!m.around} onclick={() => { m.around = undefined; c(); }}>{t('Show all')}</button>
        <button aria-pressed={m.around === 'fade'} onclick={() => { m.around = 'fade'; c(); }}>{t('Fade')}</button>
        <button aria-pressed={m.around === 'hide'} onclick={() => { m.around = 'hide'; c(); }}>{t('Only the area')}</button>
      </div>
    </div>
    <div class="ext">
      <label class="field"><span>{t('North (°)')}</span><input class="input" inputmode="decimal" autocomplete="off" value={shown.n} oninput={(e) => typeEdge('n', (e.target as HTMLInputElement).value)} aria-invalid={shownErr('n') ? 'true' : undefined} aria-describedby={shownErr('n') ? 'ext-err-n' : undefined} /></label>
      <label class="field"><span>{t('West (°)')}</span><input class="input" inputmode="decimal" autocomplete="off" value={shown.w} oninput={(e) => typeEdge('w', (e.target as HTMLInputElement).value)} aria-invalid={shownErr('w') ? 'true' : undefined} aria-describedby={shownErr('w') ? 'ext-err-w' : undefined} /></label>
      <label class="field"><span>{t('East (°)')}</span><input class="input" inputmode="decimal" autocomplete="off" value={shown.e} oninput={(e) => typeEdge('e', (e.target as HTMLInputElement).value)} aria-invalid={shownErr('e') ? 'true' : undefined} aria-describedby={shownErr('e') ? 'ext-err-e' : undefined} /></label>
      <label class="field"><span>{t('South (°)')}</span><input class="input" inputmode="decimal" autocomplete="off" value={shown.s} oninput={(e) => typeEdge('s', (e.target as HTMLInputElement).value)} aria-invalid={shownErr('s') ? 'true' : undefined} aria-describedby={shownErr('s') ? 'ext-err-s' : undefined} /></label>
    </div>
    {#each ['n', 'w', 'e', 's'] as const as k}
      {#if shownErr(k)}<p class="msg err" id="ext-err-{k}" role="alert">{shownErr(k)}</p>{/if}
    {/each}
    <div class="row">
      <button class="btn small" onclick={applyExtent} disabled={!draftExt}>{t('Apply')}</button>
      <button class="btn small ghost" onclick={resetExtent}>{t('Fit to my area')}</button>
    </div>
    <p class="hint">{t('The edges of the map as longitude and latitude. Type new numbers and press Apply.')}</p>
  </div>
</details>

<GridPanel grid={m.grid} allowMetres={!!main && !/\+proj=(longlat|latlong|lonlat|latlon)\b/.test(main.crs.proj4)} metresName={main?.crs.name.split(' / ').pop() ?? t('map units')} />

<style>
  .inline { display: flex; align-items: center; gap: 6px; }
  .inline .input { flex: 1; min-width: 0; }
  /* the slider sits in a label of its own (hidden words), so it has a name of its own beside the number box */
  .inline .rng { flex: 1; min-width: 0; display: block; position: relative; }
  /* the small number box and the "Pick" list keep a fixed width (this rule comes after .inline .input, so it wins on order) */
  .inline .narrow { flex: 0 0 80px; }
  /* rotation: the number box is just wide enough for -180.5 */
  .inline .num { flex: 0 0 68px; padding-inline: 8px; }
  /* a label at the left and its colour button at the right */
  .field.inline { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .pre { color: var(--ink-3); font-size: 12.5px; }
  /* north on top, west and east side by side, south below: two even columns that can never pass the panel edge */
  .ext { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .ext .field:first-child { grid-column: 1 / -1; width: 50%; justify-self: center; }
  .ext .field:last-child { grid-column: 1 / -1; width: 50%; justify-self: center; }
</style>
