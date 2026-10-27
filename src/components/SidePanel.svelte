<script module lang="ts">
  // The page toolbar opens one part of Design (the page settings) from outside the panel.
  export { openDesign } from './shell.svelte';
</script>

<script lang="ts">
  import X from 'phosphor-svelte/lib/X';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import { store } from '../lib/store.svelte';
  import { t } from '../lib/i18n.svelte';
  import type { MainScene } from '../lib/scene';
  import type { ScaleBarSpec } from '../lib/carto';
  import type { Finding } from '../lib/check';
  import PlacePanel from './panels/PlacePanel.svelte';
  import TemplatesPanel from './panels/TemplatesPanel.svelte';
  import ElementsPanel from './panels/ElementsPanel.svelte';
  import UploadsPanel from './panels/UploadsPanel.svelte';
  import StylePanel from './panels/StylePanel.svelte';
  import LayersPanel from './panels/LayersPanel.svelte';
  import EditPanel from './panels/EditPanel.svelte';
  import ExportPanel from './panels/ExportPanel.svelte';
  import HelpPanel from './panels/HelpPanel.svelte';
  import PagePanel from './panels/PagePanel.svelte';
  import FontPanel from './panels/FontPanel.svelte';
  import MyStylesPanel from './panels/MyStylesPanel.svelte';
  import SubTabs from './panels/SubTabs.svelte';
  import { memo, stepOf } from './shell.svelte';

  interface Props { main: MainScene | null; scale: ScaleBarSpec | null; svgEl?: SVGSVGElement; findings: Finding[]; credits: string[]; terrainOn: boolean }
  let { main, scale, svgEl, findings, credits, terrainOn }: Props = $props();

  const TITLES: Record<string, string> = {
    place: 'Place', templates: 'Design', elements: 'Map parts', text: 'Map parts', uploads: 'Map parts',
    style: 'Design', export: 'Export', help: 'Help', edit: '',
  };
  // the rail is the navigation, so the panel only says how far along you are
  const stepNo = $derived(['place', 'templates', 'elements', 'export'].indexOf(stepOf(store.tab) ?? '') + 1);
  // The next step, shown as one clear button at the bottom of the panel.
  const next = $derived.by((): { label: string; tab: 'templates' | 'elements' | 'export'; needArea?: boolean } | null => {
    const tab = store.tab;
    if (tab === 'place') return { label: store.doc.study.source === 'none' ? t('Choose a place first') : t('Next: layout and colours'), tab: 'templates', needArea: true };
    if (tab === 'templates' || tab === 'style') return { label: t('Next: what is on the map'), tab: 'elements' };
    if (tab === 'elements' || tab === 'uploads' || tab === 'text') return { label: t('Next: check and download'), tab: 'export' };
    return null;
  });
  let headEl = $state<HTMLHeadingElement>();
  /** phones: the bottom sheet can be pulled up to nearly full height */
  let tall = $state(false);
  // Design and Map parts are split into short tabs: one part on screen at a time
  let bodyEl = $state<HTMLDivElement>();
  // A one-line note only where the tab's name does not explain itself (the tab, a note and a heading saying the same
  // thing three times was the clutter). Layout comes before Text: arrangement first, then the type on it.
  const DESIGN = [
    { id: 'colours', label: 'Colours', about: '' },
    { id: 'layout', label: 'Layout', about: 'Same map, new arrangement. Everything stays editable.' },
    { id: 'text', label: 'Text', about: '' },
    { id: 'page', label: 'Page', about: '' },
    { id: 'mine', label: 'My styles', about: 'Save this look and reuse it, so a series of figures matches. Saves colours, fonts, grid, legend and scale bar.' },
  ];
  // Layers comes last: the first three are the quick switches most people need, Add makes new things, and Layers is the
  // full list for order and fine settings (it sits next to Add, where a new layer lands)
  const PARTS = [
    { id: 'essentials', label: 'Essentials', about: '' },
    { id: 'onmap', label: 'On the map', about: '' },
    { id: 'insets', label: 'Inset maps', about: 'Small maps that show where your area lies.' },
    { id: 'add', label: 'Add', about: '' },
    { id: 'layers', label: 'Layers', about: 'The top layer is drawn on top. Click a name for its settings.' },
  ];
  const isDesign = $derived(store.tab === 'templates' || store.tab === 'style');
  const isParts = $derived(store.tab === 'elements' || store.tab === 'uploads' || store.tab === 'text');
  const aboutDesign = $derived(t(DESIGN.find((d) => d.id === memo.design)?.about ?? ''));
  const aboutParts = $derived(t(PARTS.find((p) => p.id === memo.parts)?.about ?? ''));
  // the labels in the language of the editor, for the tab bars
  const designTabs = $derived(DESIGN.map((d) => ({ id: d.id, label: t(d.label) })));
  const partsTabs = $derived(PARTS.map((p) => ({ id: p.id, label: t(p.label) })));

  // arriving at the old Text or Uploads tabs opens the Add tab
  $effect(() => { if (store.tab === 'text' || store.tab === 'uploads') memo.parts = 'add'; });
  // a new tab starts at its top
  $effect(() => { void store.tab; void memo.design; void memo.parts; bodyEl?.scrollTo({ top: 0 }); });
  let last = '';
  $effect(() => {
    const view = store.tab + ':' + store.selected;
    if (!last) { last = view; return; }
    if (view === last) return;
    last = view;
    queueMicrotask(() => { if (document.activeElement === document.body) headEl?.focus(); });
  });
  /** hide the panel; the keyboard goes back to the rail button of the step that was open */
  function closePanel() {
    const id = stepOf(store.tab);
    store.panelOpen = false;
    queueMicrotask(() => (document.querySelector<HTMLElement>(`.rail [data-step="${id}"]`) ?? document.querySelector<HTMLElement>('.rail .tab'))?.focus());
  }
</script>

<aside class="side" class:tall class:placed={store.doc.study.source !== 'none'} aria-label={t(TITLES[store.tab]) || t('Element settings')}>
  <button class="grab" onclick={() => (tall = !tall)} aria-label={tall ? t('Show more of the map') : t('Make the panel taller')} aria-expanded={tall}><span></span></button>
  {#if store.tab !== 'edit'}
    <!-- the rail names the step you are on; here the panel keeps its title and says how far along you are (phones: screen readers only) -->
    <div class="head">
      <h2 class="panel-title" tabindex="-1" bind:this={headEl}>{t(TITLES[store.tab])}</h2>
      {#if stepNo}<span class="stepnote">{t('Step {n} of 4', { n: stepNo })}</span>{/if}
      <button class="close" onclick={closePanel} aria-label={t('Close panel')}><X size={16} /></button>
    </div>
  {/if}
  {#if isDesign}
    <SubTabs tabs={designTabs} bind:value={memo.design} label={t('Parts of Design')} prefix="design" />
  {:else if isParts}
    <SubTabs tabs={partsTabs} bind:value={memo.parts} label={t('Parts of the map')} prefix="parts" />
  {/if}
  <div class="body" bind:this={bodyEl}>
    {#if store.tab === 'place'}<PlacePanel />
    {:else if isDesign}
      <div role="tabpanel" id="design-panel" aria-labelledby="design-tab-{memo.design}" class="tabpanel">
        {#if aboutDesign}<p class="about">{aboutDesign}</p>{/if}
        {#if memo.design === 'colours'}<StylePanel />
        {:else if memo.design === 'text'}<FontPanel />
        {:else if memo.design === 'layout'}<TemplatesPanel />
        {:else if memo.design === 'page'}<PagePanel />
        {:else}<div data-jump="mine"><MyStylesPanel /></div>
        {/if}
      </div>
    {:else if isParts}
      <div role="tabpanel" id="parts-panel" aria-labelledby="parts-tab-{memo.parts}" class="tabpanel">
        {#if aboutParts}<p class="about">{aboutParts}</p>{/if}
        {#if memo.parts === 'add'}
          <div class="sections">
            <ElementsPanel part="add" />
            <div class="uploads-anchor"><UploadsPanel /></div>
          </div>
        {:else if memo.parts === 'layers'}<LayersPanel />
        {:else}<ElementsPanel part={memo.parts as 'essentials' | 'onmap' | 'insets'} />
        {/if}
      </div>
    {:else if store.tab === 'export'}<ExportPanel {svgEl} {main} {findings} {credits} {terrainOn} />
    {:else if store.tab === 'help'}<HelpPanel />
    {:else}<EditPanel {main} {scale} />
    {/if}
  </div>
  {#if next}
    {@const blocked = !!next.needArea && store.doc.study.source === 'none'}
    <div class="foot">
      <button class="btn primary block" disabled={blocked} title={blocked ? t('Search or draw your area first') : undefined} onclick={() => { const to = next!.tab; store.select(null); store.tab = to; store.panelOpen = true; }}>{next.label}{#if !blocked} <ArrowRight size={16} weight="bold" />{/if}</button>
    </div>
  {:else if store.tab === 'export' && store.exportRun}
    <div class="foot">
      <button class="btn primary block" disabled={store.exportDisabled} onclick={() => store.exportRun?.()}>{#if !store.exportDisabled}<DownloadSimple size={17} weight="bold" /> {/if}{t(store.exportLabel)}</button>
    </div>
  {/if}
</aside>

<style>
  .side {
    grid-area: panel;
    display: flex; flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--line);
    min-width: 0; min-height: 0;
    z-index: 4;
    position: relative;
  }
  /* title at the left, how far along you are at the right, then the close button */
  .head { display: flex; align-items: center; gap: 8px; padding: 6px 6px 0 20px; }
  .head .panel-title { flex: none; }
  .stepnote { margin-left: auto; font-size: 12.5px; font-weight: 500; color: var(--ink-3); white-space: nowrap; }
  .close { flex: none; width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: var(--r-ctl); background: transparent; color: var(--ink-3); }
  .head .panel-title + .close { margin-left: auto; }
  .close:hover { background: var(--panel-2); color: var(--ink); }
  @media (pointer: coarse) { .close { width: 44px; height: 44px; } }
  .body { flex: 1; overflow-y: auto; padding: 8px 20px 20px; min-height: 0; }
  /* the foot keeps a soft edge above it, so content scrolling under it reads as more to come: 56 px with a 40 px button */
  .foot { padding: 7px 20px 8px; border-top: 1px solid var(--line); background: var(--panel); position: relative; z-index: 1; box-shadow: 0 -10px 14px -12px rgb(43 45 47 / 0.16); }
  .foot :global(.btn.primary) { min-height: 40px; height: 40px; padding-block: 0; }
  @media (pointer: coarse) { .foot :global(.btn.primary) { min-height: 44px; height: 44px; } }
  /* the Add tab joins two panels: the same hairline-and-space rhythm between them as inside them */
  .sections { display: grid; gap: 16px; }
  .sections > :global(* + *) { border-top: 1px solid var(--line); padding-top: 16px; }
  /* its two folded groups bring their own hairline above the title */
  .sections > :global(.uploads-anchor) { border-top: 0; padding-top: 0; }
  .about { margin: 0 0 12px; font-size: 12.5px; line-height: 1.45; color: var(--ink-3); text-wrap: pretty; }
  .grab { display: none; }
  @media (max-width: 760px) {
    /* a bottom sheet: about half the screen while there is no place yet (the search needs room), then about 40 %, so the map stays big.
       It grows when asked (the handle), and while searching, so results are never hidden */
    .side { max-height: min(54dvh, calc(100dvh - 280px)); border-right: 0; border-top: 1px solid var(--line); border-radius: var(--r-panel) var(--r-panel) 0 0; box-shadow: 0 -6px 20px -10px rgb(43 45 47 / 0.25); transition: max-height 220ms var(--ease); }
    .side.placed { max-height: min(40dvh, calc(100dvh - 280px)); }
    .side.tall, .side:has(:global(.box:focus-within)), .side:has(:global([role='option'])) { max-height: calc(100dvh - 280px); }
    .grab { display: grid; place-items: center; border: 0; background: transparent; padding: 0; flex: none; height: 44px; margin-bottom: -6px; }
    .grab span { width: 40px; height: 4px; border-radius: 2px; background: var(--line-strong); }
    /* the rail below names the step, so the head folds into the handle's row: only the close button stays on show */
    .head { display: contents; }
    .head .panel-title, .stepnote { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .close { position: absolute; top: 0; right: 6px; z-index: 2; width: 44px; height: 44px; }
    .body { padding: 6px 16px 16px; }
    .foot { padding: 7px 16px 8px; }
    .about { display: none; }
  }
</style>
