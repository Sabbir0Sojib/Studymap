<script lang="ts">
  // The box round any page part (background, border, rounding, padding), how see-through it is and how far it is
  // turned: the same few settings for a legend, a text, a scale bar or a picture, as a layout program's item properties.
  import { store } from '../lib/store.svelte';
  import type { BoxLook, Item } from '../lib/store.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import { t } from '../lib/i18n.svelte';

  let { it }: { it: Item } = $props();
  const c = () => store.commit();
  const lk = $derived<BoxLook>(it.look ?? {});
  const BG: [string, string][] = [['#ffffff', 'white'], ['#F4F3EE', 'paper grey'], ['#E9F1F9', 'pale blue'], ['#1B1F1D', 'black']];
  const LINE: [string, string][] = [['#1B1F1D', 'black'], ['#86867F', 'grey'], ['#0072B2', 'blue'], ['#D55E00', 'vermillion']];

  /** Change the look; a setting back to "none" is dropped, so an untouched part stores nothing. */
  function set(patch: Partial<BoxLook>) {
    const next: BoxLook = { ...(it.look ?? {}), ...patch };
    for (const k of Object.keys(next) as (keyof BoxLook)[]) if (next[k] === undefined) delete next[k];
    it.look = Object.keys(next).length ? next : undefined;
    c();
  }
  const turn = (v: number) => set({ rotate: ((Math.round(v) % 360) + 540) % 360 - 180 || undefined });
</script>

<details class="acc quiet" open={!!it.look}>
  <summary>{t('Box, see-through and turn')}</summary>
  <div class="acc-body">
    <label class="row-switch"><span>{t('Background')}</span><input type="checkbox" role="switch" checked={!!lk.bg} onchange={() => set({ bg: lk.bg ? undefined : '#ffffff', bgOpacity: undefined })} /></label>
    {#if lk.bg}
      <div class="colours" role="group" aria-label={t('Background colour')}>
        {#each BG as [col, name]}<button class="dot" class:on={lk.bg === col} style="background:{col}" aria-label={t('Background {name}', { name: t(name) })} aria-pressed={lk.bg === col} onclick={() => set({ bg: col })}></button>{/each}
        <ColorPicker value={lk.bg} label={t('Any background colour')} size={28} onchange={(v) => set({ bg: v })} />
      </div>
      <label class="field slider"><span>{t('Background strength')} <span class="val" aria-hidden="true">{Math.round((lk.bgOpacity ?? 1) * 100)}%</span></span><input type="range" min="0.1" max="1" step="0.05" value={lk.bgOpacity ?? 1} aria-valuetext="{Math.round((lk.bgOpacity ?? 1) * 100)}%" oninput={(e) => set({ bgOpacity: +(e.target as HTMLInputElement).value >= 1 ? undefined : +(e.target as HTMLInputElement).value })} /></label>
    {/if}
    <label class="row-switch"><span>{t('Border')}</span><input type="checkbox" role="switch" checked={!!lk.border} onchange={() => set({ border: lk.border ? undefined : '#1B1F1D', borderPt: undefined })} /></label>
    {#if lk.border}
      <div class="colours" role="group" aria-label={t('Border colour')}>
        {#each LINE as [col, name]}<button class="dot" class:on={lk.border === col} style="background:{col}" aria-label={t('Border {name}', { name: t(name) })} aria-pressed={lk.border === col} onclick={() => set({ border: col })}></button>{/each}
        <ColorPicker value={lk.border} label={t('Any border colour')} size={28} onchange={(v) => set({ border: v })} />
      </div>
      <label class="field slider"><span>{t('Border width')} <span class="val" aria-hidden="true">{lk.borderPt ?? 0.5} pt</span></span><input type="range" min="0.25" max="3" step="0.25" value={lk.borderPt ?? 0.5} aria-valuetext="{lk.borderPt ?? 0.5} pt" oninput={(e) => set({ borderPt: +(e.target as HTMLInputElement).value })} /></label>
    {/if}
    {#if lk.bg || lk.border}
      <label class="field slider"><span>{t('Room inside')} <span class="val" aria-hidden="true">{lk.pad ?? 1} mm</span></span><input type="range" min="0" max="6" step="0.5" value={lk.pad ?? 1} aria-valuetext="{lk.pad ?? 1} mm" oninput={(e) => set({ pad: +(e.target as HTMLInputElement).value === 1 ? undefined : +(e.target as HTMLInputElement).value })} /></label>
      <label class="field slider"><span>{t('Rounded corners')} <span class="val" aria-hidden="true">{lk.radius ?? 0} mm</span></span><input type="range" min="0" max="6" step="0.5" value={lk.radius ?? 0} aria-valuetext="{lk.radius ?? 0} mm" oninput={(e) => set({ radius: +(e.target as HTMLInputElement).value || undefined })} /></label>
    {/if}
    <label class="field slider"><span>{t('See-through')} <span class="val" aria-hidden="true">{Math.round((1 - (lk.opacity ?? 1)) * 100)}%</span></span><input type="range" min="0" max="0.8" step="0.05" value={1 - (lk.opacity ?? 1)} aria-valuetext={t('{n}% see-through', { n: Math.round((1 - (lk.opacity ?? 1)) * 100) })} oninput={(e) => { const v = 1 - +(e.target as HTMLInputElement).value; set({ opacity: v >= 1 ? undefined : Math.round(v * 100) / 100 }); }} /></label>
    {#if it.kind !== 'map'}
      <div class="turn" role="group" aria-label={t('Turn')}>
        <label class="field slider"><span>{t('Turn')} <span class="val" aria-hidden="true">{lk.rotate ?? 0}°</span></span><input type="range" min="-180" max="180" step="1" value={lk.rotate ?? 0} aria-valuetext={t('{n} degrees', { n: lk.rotate ?? 0 })} oninput={(e) => turn(+(e.target as HTMLInputElement).value)} /></label>
        <div class="quick">
          {#each [-90, -45, 0, 45, 90] as d}<button class="chip" aria-pressed={(lk.rotate ?? 0) === d} onclick={() => turn(d)}>{d}°</button>{/each}
        </div>
      </div>
    {/if}
  </div>
</details>

<style>
  .colours { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  .dot:hover { box-shadow: 0 0 0 2px var(--ink-2); }
  .dot.on { box-shadow: 0 0 0 2px var(--accent); }
  .turn { display: grid; gap: 8px; }
  .quick { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip { min-width: 44px; height: 28px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); background: var(--panel); }
  .chip:hover { border-color: var(--line-strong); color: var(--ink); }
  .chip[aria-pressed='true'] { background: var(--accent-wash); border-color: var(--accent); color: var(--accent-ink); }
  @media (pointer: coarse) { .chip { height: 44px; } }
</style>
