<script lang="ts">
  // The study area in numbers, and the sentences a paper needs around its map (where it lies, how the map was made,
  // the figure's alt text), each ready to copy, so nobody has to measure or write them by hand.
  import { store } from '../lib/store.svelte';
  import type { MainScene } from '../lib/scene';
  import { addText } from '../lib/actions';
  import { dms, fmtArea, fmtKm, paperText, studyFacts } from '../lib/facts';
  import { t } from '../lib/i18n.svelte';

  let { main, credits = [] }: { main: MainScene | null; credits?: string[] } = $props();
  const facts = $derived(studyFacts(store.studyFeatures));
  const text = $derived(facts ? paperText(store.doc, main, facts, credits) : null);
  let copied = $state('');

  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); copied = key; setTimeout(() => { if (copied === key) copied = ''; }, 2000); }
    catch { copied = ''; store.status = t('Could not copy. Select the text and press Ctrl+C.'); }
  }
  /** A small note on the page with the area and centre (a reader often wants the size at a glance). */
  function onMap() {
    if (!facts) return;
    addText('note');
    const it = store.doc.items.find((i) => i.id === store.selected);
    if (it?.kind === 'title') { it.text = `Area ${fmtArea(facts.areaKm2)} · centre ${dms(facts.centre[1], 'lat')}, ${dms(facts.centre[0], 'lon')}`; store.commit(); }
  }
</script>

{#if facts && text}
  <section class="pack">
    <h3 class="group-title">{t('The study area in numbers')}</h3>
    <dl class="facts">
      <dt>{t('Area')}</dt><dd>{fmtArea(facts.areaKm2)}</dd>
      <dt>{t('Boundary')}</dt><dd>{fmtKm(facts.perimeterKm)}</dd>
      <dt>{t('Centre')}</dt><dd>{dms(facts.centre[1], 'lat')}, {dms(facts.centre[0], 'lon')}</dd>
      <dt>{t('Latitude')}</dt><dd>{t('{from} to {to}', { from: dms(facts.bounds[0][1], 'lat'), to: dms(facts.bounds[1][1], 'lat') })}</dd>
      <dt>{t('Longitude')}</dt><dd>{t('{from} to {to}', { from: dms(facts.bounds[0][0], 'lon'), to: dms(facts.bounds[1][0], 'lon') })}</dd>
    </dl>
    <button class="btn small" onclick={onMap}>{t('Put the area and centre on the map')}</button>

    {#each [['where', 'For the study area section', `${text.location} ${text.facts}`], ['methods', 'For the methods', text.methods], ['alt', 'Alt text for the figure', text.alt]] as [key, title, value]}
      <div class="para">
        <div class="para-head"><h4>{t(title)}</h4><button class="btn small" onclick={() => copy(key, value)}>{copied === key ? t('Copied') : t('Copy')}</button></div>
        <p class="ready">{value}</p>
      </div>
    {/each}
    <p class="hint">{t('Worked out from the outline on the map. Check the numbers against your own sources before you publish.')}</p>
  </section>
{/if}

<style>
  .pack { display: grid; gap: 10px; }
  .facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; margin: 0; font-size: 12.5px; }
  .facts dt { color: var(--ink-3); }
  .facts dd { margin: 0; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .para { display: grid; gap: 6px; }
  .para-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .para-head h4 { margin: 0; font-size: 12.5px; font-weight: 600; color: var(--ink-2); }
  .ready { margin: 0; padding: 10px 12px; border-radius: var(--r-ctl); background: var(--panel-2); font-size: 12.5px; line-height: 1.5; user-select: all; overflow-wrap: anywhere; }
</style>
