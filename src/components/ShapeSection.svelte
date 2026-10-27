<script lang="ts">
  // A rectangle, circle, line or arrow: its outline and fill (each its own colour), line width and pattern,
  // corner rounding and, for an arrow, which ends carry a head, how big and in what style.
  import { store } from '../lib/store.svelte';
  import type { ShapeItem } from '../lib/store.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import { t } from '../lib/i18n.svelte';

  let { sh }: { sh: ShapeItem } = $props();
  const c = () => store.commit();
  const COLOURS: [string, string][] = [['#D55E00', 'vermillion'], ['#0072B2', 'blue'], ['#009E73', 'bluish green'], ['#E69F00', 'orange'], ['#56B4E9', 'sky blue'], ['#CC79A7', 'reddish purple'], ['#1B1F1D', 'black'], ['#ffffff', 'white']];
  const line = $derived(sh.shape === 'line' || sh.shape === 'arrow');
  // a fill that follows the outline colour until it is chosen on its own
  const sameFill = $derived(sh.fill === sh.stroke);
</script>

<section>
  <h3 class="group-title">{line ? t('Colour') : t('Outline')}</h3>
  <div class="colours" role="group" aria-label={line ? t('Line colour') : t('Outline colour')}>
    {#each COLOURS as [col, name]}<button class="dot" class:on={sh.stroke === col} style="background:{col}" aria-label={t('Use {name}', { name: t(name) })} aria-pressed={sh.stroke === col} onclick={() => { if (sameFill) sh.fill = col; sh.stroke = col; c(); }}></button>{/each}
    <ColorPicker value={sh.stroke} label={t('Shape colour')} size={28} onchange={(v) => { if (sameFill) sh.fill = v; sh.stroke = v; c(); }} />
  </div>
  <label class="field slider"><span>{t('Line width')} <span class="val" aria-hidden="true">{sh.strokePt} pt</span></span><input type="range" min="0.25" max="6" step="0.25" bind:value={sh.strokePt} aria-valuetext="{sh.strokePt} pt" oninput={c} /></label>
  <div class="field"><span class="lbl">{t('Line pattern')}</span>
    <div class="seg" role="group" aria-label={t('Line pattern')}>
      <button aria-pressed={!sh.dash} onclick={() => { sh.dash = false; c(); }}>{t('Solid')}</button>
      <button aria-pressed={sh.dash && sh.dashStyle !== 'dot'} onclick={() => { sh.dash = true; sh.dashStyle = undefined; c(); }}>{t('Dashed')}</button>
      <button aria-pressed={sh.dash && sh.dashStyle === 'dot'} onclick={() => { sh.dash = true; sh.dashStyle = 'dot'; c(); }}>{t('Dotted')}</button>
    </div>
  </div>
</section>

{#if !line}
  <section>
    <h3 class="group-title">{t('Fill')}</h3>
    <div class="colours" role="group" aria-label={t('Fill colour')}>
      {#each COLOURS as [col, name]}<button class="dot" class:on={sh.fill === col && !sameFill} style="background:{col}" aria-label={t('Fill {name}', { name: t(name) })} aria-pressed={sh.fill === col && !sameFill} onclick={() => { sh.fill = col; if (sh.fillOpacity === 0) sh.fillOpacity = 0.25; c(); }}></button>{/each}
      <ColorPicker value={sh.fill} label={t('Any fill colour')} size={28} onchange={(v) => { sh.fill = v; if (sh.fillOpacity === 0) sh.fillOpacity = 0.25; c(); }} />
    </div>
    <label class="field slider"><span>{t('Fill strength')} <span class="val" aria-hidden="true">{Math.round(sh.fillOpacity * 100)}%</span></span><input type="range" min="0" max="1" step="0.05" bind:value={sh.fillOpacity} aria-valuetext="{Math.round(sh.fillOpacity * 100)}%" oninput={c} /></label>
    {#if sh.shape === 'rect'}
      <label class="field slider"><span>{t('Rounded corners')} <span class="val" aria-hidden="true">{sh.radius ?? 0} mm</span></span><input type="range" min="0" max="10" step="0.5" value={sh.radius ?? 0} aria-valuetext="{sh.radius ?? 0} mm" oninput={(e) => { sh.radius = +(e.target as HTMLInputElement).value || undefined; c(); }} /></label>
    {/if}
  </section>
{/if}

{#if sh.shape === 'arrow' || sh.shape === 'line'}
  <section>
    <h3 class="group-title">{t('Arrow heads')}</h3>
    <div class="seg" role="group" aria-label={t('Arrow heads')}>
      <button aria-pressed={sh.shape === 'line'} onclick={() => { sh.shape = 'line'; c(); }}>{t('None')}</button>
      <button aria-pressed={sh.shape === 'arrow' && (sh.heads ?? 'end') === 'end'} onclick={() => { sh.shape = 'arrow'; sh.heads = undefined; c(); }}>{t('End')}</button>
      <button aria-pressed={sh.shape === 'arrow' && sh.heads === 'start'} onclick={() => { sh.shape = 'arrow'; sh.heads = 'start'; c(); }}>{t('Start')}</button>
      <button aria-pressed={sh.shape === 'arrow' && sh.heads === 'both'} onclick={() => { sh.shape = 'arrow'; sh.heads = 'both'; c(); }}>{t('Both')}</button>
    </div>
    {#if sh.shape === 'arrow'}
      <div class="seg" role="group" aria-label={t('Head style')}>
        <button aria-pressed={sh.headStyle !== 'open'} onclick={() => { sh.headStyle = undefined; c(); }}>{t('Filled')}</button>
        <button aria-pressed={sh.headStyle === 'open'} onclick={() => { sh.headStyle = 'open'; c(); }}>{t('Open')}</button>
      </div>
      <label class="field slider"><span>{t('Head size')} <span class="val" aria-hidden="true">{Math.round((sh.headSize ?? 1) * 100)}%</span></span><input type="range" min="0.5" max="3" step="0.1" value={sh.headSize ?? 1} aria-valuetext="{Math.round((sh.headSize ?? 1) * 100)}%" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; sh.headSize = v === 1 ? undefined : v; c(); }} /></label>
    {/if}
    <p class="hint">{t('Drag either end handle to point the {shape} where you want.', { shape: t(sh.shape) })}</p>
  </section>
{/if}

<style>
  .colours { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  .dot:hover { box-shadow: 0 0 0 2px var(--ink-2); }
  .dot.on { box-shadow: 0 0 0 2px var(--accent); }
  .lbl { display: block; font-size: 12.5px; color: var(--ink-2); margin-bottom: 6px; }
  section { display: grid; gap: 10px; }
</style>
