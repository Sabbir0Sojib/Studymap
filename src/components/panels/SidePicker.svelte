<script lang="ts">
  // A small picture of the map frame: click a side to show or hide its coordinates.
  import { store } from '../../lib/store.svelte';
  import type { MapItem } from '../../lib/store.svelte';
  import { gridSettings } from '../../lib/grid';
  import type { Side } from '../../lib/grid';
  import { t, i18n } from '../../lib/i18n.svelte';

  let { grid }: { grid: MapItem['grid'] } = $props();
  const gs = $derived(gridSettings(grid));
  const NAME: Record<Side, string> = { top: 'Top', left: 'Left', right: 'Right', bottom: 'Bottom' };
  // the side as it reads before a noun: "Top coordinates" in English, "ওপরের স্থানাঙ্ক" in Bangla (the lower-case keys)
  const before = (s: Side) => (i18n.lang === 'bn' ? t(s) : NAME[s]);
  function flip(side: Side) {
    const a = gs.ann[side];
    const on = a.show !== 'none';
    // a side turned on shows the values that naturally meet it: latitude left/right, longitude top/bottom
    const show = on ? 'none' : side === 'left' || side === 'right' ? 'lat' : 'lon';
    grid.ann = { ...gs.ann, [side]: { ...a, show } };
    grid.show = true;
    store.commit();
  }
  const on = (s: Side) => gs.ann[s].show !== 'none';
  const metres = $derived(gs.units === 'metres');
  // sample coordinate in the grid's own units: easting along top/bottom, northing along left/right
  const sample = (s: Side) => (s === 'top' || s === 'bottom' ? (metres ? '230 000 E' : '90°E') : metres ? '2 660 000 N' : '24°N');
</script>

<div class="pick" role="group" aria-label={t('Coordinates on each side of the map')}>
  {#each ['top', 'left', 'right', 'bottom'] as const as s}
    <button class="side {s}" aria-pressed={on(s)} onclick={() => flip(s)} title={on(s) ? t('{side}: showing coordinates, click to hide', { side: t(NAME[s]) }) : t('{side}: no coordinates, click to show', { side: t(NAME[s]) })}>
      <span class="sr-only">{t('{side} coordinates', { side: before(s) })}</span>
      <span class="txt" class:small={metres && on(s)} aria-hidden="true">{on(s) ? sample(s) : t('none')}</span>
    </button>
  {/each}
  <div class="frame" aria-hidden="true"><span>{t('Map')}</span></div>
</div>

<style>
  .pick { display: grid; grid-template-columns: 34px 1fr 34px; grid-template-rows: 28px 64px 28px; gap: 4px; width: 210px; max-width: 100%; justify-self: center; }
  .frame { grid-area: 2 / 2; border: 2px solid var(--ink); border-radius: 2px; display: grid; place-items: center; font-size: 11.5px; color: var(--ink-3); background: var(--panel-2); }
  .side { border: 1px dashed var(--line-input); border-radius: var(--r-chip); background: var(--panel); color: var(--ink-3); font-size: 11.5px; font-weight: 600; display: grid; place-items: center; padding: 0; transition: background-color 120ms ease, border-color 120ms ease; }
  .side:hover { border-color: var(--accent); }
  .side[aria-pressed='true'] { border-style: solid; border-color: var(--accent); background: var(--accent-wash); color: var(--accent-ink); }
  .top { grid-area: 1 / 2; }
  .bottom { grid-area: 3 / 2; }
  .left { grid-area: 2 / 1; }
  .right { grid-area: 2 / 3; }
  .left .txt, .right .txt { writing-mode: vertical-rl; transform: rotate(180deg); }
  .right .txt { transform: none; }
  .txt { white-space: nowrap; }
  /* metre samples are longer, so the vertical ones on the left and right shrink to fit the 64px side */
  .left .txt.small, .right .txt.small { font-size: 11.5px; letter-spacing: -0.02em; }
</style>
