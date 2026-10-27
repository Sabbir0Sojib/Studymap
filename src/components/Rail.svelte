<script lang="ts">
  // The one navigation: the four steps from nothing to a finished figure, in order, and Help at the bottom.
  // The step you are on is the washed tab; a step you have finished carries a small graphite tick.
  import MapPinArea from 'phosphor-svelte/lib/MapPinArea';
  import SquaresFour from 'phosphor-svelte/lib/SquaresFour';
  import Palette from 'phosphor-svelte/lib/Palette';
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import Question from 'phosphor-svelte/lib/Question';
  import Check from 'phosphor-svelte/lib/Check';
  import { untrack } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { t } from '../lib/i18n.svelte';
  import { stepOf } from './shell.svelte';
  import type { Step } from './shell.svelte';

  const STEPS: { id: Step; label: string; hint: string; icon: typeof MapPinArea }[] = [
    { id: 'place', label: 'Place', hint: 'choose your study area', icon: MapPinArea },
    { id: 'templates', label: 'Design', hint: 'style, colours, layout, fonts and page', icon: Palette },
    { id: 'elements', label: 'Map parts', hint: 'north arrow, scale bar, legend, layers', icon: SquaresFour },
    { id: 'export', label: 'Export', hint: 'check and download', icon: DownloadSimple },
  ];
  // a step counts as done once the area exists, the step has been looked at and you have moved on past it
  // (Help and element settings keep the step you were last on, so the ticks stay while you are there)
  const seen = $state<Record<string, boolean>>({});
  let at = $state(0);
  let seenFor = '';
  $effect(() => {
    const i = STEPS.findIndex((s) => s.id === stepOf(store.tab));
    const key = store.mapId + (store.doc.study.source === 'none' ? ':none' : '');
    untrack(() => {
      if (key !== seenFor) { seenFor = key; for (const k of Object.keys(seen)) delete seen[k]; } // another map, or none yet: start the ticks again
      if (i >= 0) { at = i; seen[STEPS[i].id] = true; }
    });
  });
  const hasPlace = $derived(store.doc.study.source !== 'none');
  const done = (i: number) => hasPlace && (i === 0 || (!!seen[STEPS[i].id] && at > i));
  const helpOn = $derived(store.panelOpen && store.tab === 'help');
</script>

<nav class="rail" aria-label={t('Steps to make your map')}>
  {#each STEPS as s, i (s.id)}
    {@const active = store.panelOpen && stepOf(store.tab) === s.id}
    {@const tick = done(i) && !active}
    <button class="tab" class:active data-step={s.id} aria-pressed={active} aria-current={active ? 'step' : undefined}
      title="{t(s.label)}: {t(s.hint)}{tick ? ' ' + t('(done)') : ''}" onclick={() => store.openTab(s.id)}>
      <span class="ic">
        <s.icon size={22} weight={active ? 'fill' : 'regular'} />
        {#if tick}<span class="badge" aria-hidden="true"><Check size={9} weight="bold" /></span>{/if}
      </span>
      <span class="lbl">{t(s.label)}</span>
    </button>
  {/each}
  <button class="tab help" class:active={helpOn} data-step="help" aria-pressed={helpOn} aria-current={helpOn ? 'page' : undefined} title={t('Help: how to use StudyMap')} onclick={() => store.openTab('help')}>
    <span class="ic"><Question size={22} weight={helpOn ? 'fill' : 'regular'} /></span>
    <span class="lbl">{t('Help')}</span>
  </button>
</nav>

<style>
  .rail {
    grid-area: rail;
    display: flex; flex-direction: column; align-items: stretch; gap: 2px;
    padding: 10px 6px;
    background: var(--cover);
    border-right: 1px solid var(--cover-edge);
    overflow-y: auto;
    z-index: 5;
  }
  .tab {
    display: grid; justify-items: center; gap: 4px;
    min-height: 58px; padding: 8px 2px 7px;
    border: 0; border-radius: var(--r-card); background: transparent;
    color: var(--cover-ink);
    font-size: 11.5px; font-weight: 500;
    transition: background-color 120ms ease, color 120ms ease, transform 100ms ease;
  }
  .tab:active { transform: scale(0.97); }
  .tab:hover { background: var(--cover-hover); }
  .tab.active { background: var(--cover-deep); color: var(--cover-active-ink); font-weight: 600; box-shadow: inset 0 0 0 1px var(--cover-edge); }
  .tab:focus-visible { outline-color: var(--cover-focus); }
  .ic { position: relative; display: grid; place-items: center; }
  /* done: a small graphite disc with a white tick at the corner of the icon (the current step shows the wash instead) */
  .badge { position: absolute; top: -4px; right: -8px; width: 14px; height: 14px; border-radius: 50%; display: grid; place-items: center; background: var(--cover-mark); color: var(--cover-mark-ink); box-shadow: 0 0 0 1.5px var(--cover); }
  .help { margin-top: auto; }
  /* the narrower rail (68 px): labels stay on one line */
  @media (max-width: 1100px) and (min-width: 761px) {
    .rail { padding: 10px 4px; }
    .tab { padding-inline: 0; }
    .lbl { white-space: nowrap; letter-spacing: -0.015em; }
  }
  @media (max-width: 760px) {
    .rail { flex-direction: row; padding: 4px; border-right: 0; border-top: 1px solid var(--cover-edge); overflow-x: auto; overflow-y: hidden; }
    .tab { flex: 1 1 0; min-width: 0; min-height: 54px; font-size: 11.5px; padding: 6px 0; }
    .lbl { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .help { margin-top: 0; }
  }
  @media (forced-colors: active) {
    .badge { forced-color-adjust: none; background: ButtonText; color: ButtonFace; }
  }
</style>
