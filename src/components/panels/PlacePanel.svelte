<script lang="ts">
  import Square from 'phosphor-svelte/lib/Square';
  import Circle from 'phosphor-svelte/lib/Circle';
  import Polygon from 'phosphor-svelte/lib/Polygon';
  import Scribble from 'phosphor-svelte/lib/Scribble';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import { tick, untrack } from 'svelte';
  import PlaceSearch from '../PlaceSearch.svelte';
  import StudyPanel from '../StudyPanel.svelte';
  import FileAreaPanel from '../FileAreaPanel.svelte';
  import { store, STUDY_GEOM } from '../../lib/store.svelte';
  import type { Tool } from '../../lib/store.svelte';
  import { fitToArea, areaNames, removeArea, setAreaDisplay, RECIPES, applyRecipe } from '../../lib/actions';
  import { listMaps } from '../../lib/library';
  import type { MapEntry } from '../../lib/library';
  import { ago, mapsUi, openKeptMap } from '../shell.svelte';
  import { t } from '../../lib/i18n.svelte';
  import Plus from 'phosphor-svelte/lib/Plus';
  import X from 'phosphor-svelte/lib/X';
  import CaretRight from 'phosphor-svelte/lib/CaretRight';

  type Way = 'search' | 'official' | 'file' | 'draw';
  // Official boundaries are found through Search, so an area picked that way reopens on Search.
  let way = $state<Way>(store.doc.study.source === 'layer' ? 'file' : store.doc.study.source === 'drawn' ? 'draw' : 'search');
  const WAYS: { id: Way; label: string }[] = [
    { id: 'search', label: 'Search' },
    { id: 'file', label: 'Your file' },
    { id: 'draw', label: 'Draw' },
  ];
  const s = $derived(store.doc.study);
  // several areas on one map: their names, and how they are drawn
  const names = $derived(s.source === 'none' ? [] : areaNames());
  const display = $derived(store.doc.layers.find((l) => l.kind === 'study')?.style.byUnit ? 'colours' : s.merge === false ? 'separate' : 'one');
  let addingArea = $state(false);
  // Once an area exists the choosing part folds away behind "Change area"; with no area it is always open.
  let changing = $state(false);
  let changeBtn = $state<HTMLButtonElement>();
  let choose = $state<HTMLElement>();
  $effect(() => { if (s.source === 'none') changing = false; });
  // the three newest maps kept in My maps, offered on the empty panel (looked up again whenever My maps closes)
  let kept = $state<Omit<MapEntry, 'data'>[]>([]);
  $effect(() => {
    if (s.source !== 'none' || mapsUi.open) return;
    let alive = true;
    listMaps().then((m) => { if (alive) kept = m.slice(0, 3); }).catch(() => { if (alive) kept = []; });
    return () => { alive = false; };
  });
  // the first shape drawn makes an area: keep the drawing tools open so Shift can add more shapes
  let prevSource = untrack(() => store.doc.study.source);
  $effect(() => {
    const src = s.source;
    if (prevSource === 'none' && src === 'drawn' && way === 'draw') changing = true;
    prevSource = src;
  });

  function toggleChange() {
    if (changing && way === 'draw') store.tool = 'select'; // do not leave a drawing tool on while its buttons are hidden
    changing = !changing;
  }
  // a new area was chosen: fold the choosing part away and keep the keyboard where the person was
  // Was the last thing the person did a key press? Then focus moves to "Change area"; after a mouse pick it stays put, so no ring shows.
  let byKeyboard = false;
  $effect(() => {
    const key = () => (byKeyboard = true), pointer = () => (byKeyboard = false);
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => { document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', pointer, true); };
  });
  async function chosen() {
    const here = !document.activeElement || document.activeElement === document.body || !!choose?.contains(document.activeElement);
    changing = false;
    if (here && byKeyboard) { await tick(); changeBtn?.focus(); }
  }
  const tools: { id: Tool; label: string; icon: typeof Square; how: string }[] = [
    { id: 'rect', label: 'Rectangle', icon: Square, how: 'Drag on the map.' },
    { id: 'circle', label: 'Circle', icon: Circle, how: 'Drag from the centre outwards.' },
    { id: 'polygon', label: 'Polygon', icon: Polygon, how: 'Click each corner, double-click to finish.' },
    { id: 'freehand', label: 'Freehand', icon: Scribble, how: 'Hold and draw around the area.' },
  ];
  const how = $derived(tools.find((tl) => tl.id === store.tool)?.how ?? '');

  function useTool(tl: Tool) {
    store.drawTarget = null;
    store.tool = store.tool === tl ? 'select' : tl;
    store.select(null);
  }

  function clearArea() {
    const { [STUDY_GEOM]: _gone, ...rest } = store.geoms;
    store.geoms = rest;
    store.doc.study.source = 'none';
    store.doc.study.name = '';
    store.doc.study.iso = '';
    store.doc.title = 'Untitled map';
    store.doc.exportName = undefined;
    store.doc.view = { padding: 0.12, panX: 0, panY: 0, zoom: 1 };
    store.doc.crs = null;
    // back to the empty page: the world across the whole sheet (the layout returns with the next area)
    const m = store.doc.items.find((i) => i.kind === 'map');
    if (m) { m.x = 6; m.y = 5; m.w = store.doc.widthMm - 12; m.h = store.doc.heightMm - 10; }
    store.commit();
    store.told(t('Map cleared. Undo brings your area back.'));
  }
</script>

<div class="stack">
  <!-- the choosing part: which way, then that way's own controls. With no area it is the whole panel; with one it opens under "Change area". -->
  {#snippet chooser()}
    <h3 class="group-title">{s.source === 'none' ? t('Which place is your map about?') : t('Choose a different area')}</h3>
    <div class="seg ways" role="group" aria-label={t('How to choose the area')}>
      {#each WAYS as w}
        <button aria-pressed={way === w.id} onclick={() => { way = w.id; if (w.id !== 'draw') store.tool = 'select'; }}>{t(w.label)}</button>
      {/each}
    </div>
    {#if way === 'search'}
      <PlaceSearch showExamples={s.source === 'none'} autofocus={matchMedia('(pointer: fine)').matches} onpick={chosen} />
    {:else if way === 'official'}
      <div class="adv"><StudyPanel /></div>
    {:else if way === 'file'}
      <FileAreaPanel ondone={chosen} />
    {:else}
      <div class="tools" role="group" aria-label={t('Drawing tools')}>
        {#each tools as tl}
          <button class="tool" aria-pressed={store.tool === tl.id} onclick={() => useTool(tl.id)}>
            <tl.icon size={22} />
            <span>{t(tl.label)}</span>
          </button>
        {/each}
      </div>
      {#if how}<p class="msg" role="status">{t(how)} {t('Hold Shift to add another shape. Esc cancels.')}</p>{:else}<p class="hint">{t('Pick a shape, then draw on the map.')}</p>{/if}
    {/if}
  {/snippet}

  {#if s.source !== 'none'}
    <section class="current">
      <div class="cur-text">
        <span class="label">{t('Your map shows')}</span>
        <input class="area-name" aria-label={t('Name of your area')} bind:value={store.doc.study.name} oninput={() => store.commit()} spellcheck={false} />
        {#if s.countryName && s.countryName !== s.name}<span class="hint">{s.countryName}</span>{/if}
      </div>
      {#if names.length > 1}
        <ul class="areas" aria-label={t('Areas on the map')}>
          {#each names as n, i (n + i)}
            <li><span>{n}</span><button class="x" onclick={() => removeArea(i)} aria-label={t('Take {n} off the map', { n })} title={t('Take it off the map')}><X size={14} weight="bold" /></button></li>
          {/each}
        </ul>
        <div class="field">
          <span class="label">{t('Show as')}</span>
          <div class="seg" role="group" aria-label={t('Show the areas as')}>
            <button aria-pressed={display === 'one'} onclick={() => setAreaDisplay('one')} title={t('One outline, shared borders removed')}>{t('One area')}</button>
            <button aria-pressed={display === 'separate'} onclick={() => setAreaDisplay('separate')} title={t('Each area keeps its own outline')}>{t('Separate')}</button>
            <button aria-pressed={display === 'colours'} onclick={() => setAreaDisplay('colours')} title={t('Each area in its own colour, with its own legend line')}>{t('Coloured')}</button>
          </div>
        </div>
      {/if}
      <!-- what can be done with the area: one ruled list; the two that open something show it right under their row -->
      <div class="rows">
        <button class="act" onclick={fitToArea}>{t('Zoom to it')}</button>
        <!-- show Dhaka and Gazipur together: any search result joins the areas already on the map -->
        <button class="act" aria-expanded={addingArea} onclick={() => { addingArea = !addingArea; if (addingArea) changing = false; }}>
          {t('Add another area')} <span class="end"><Plus size={14} weight="bold" /></span>
        </button>
        {#if addingArea}
          <div class="adding">
            <p class="hint">{t('Search a place to add it next to {name}: a district, city, lake, park, even in another country.', { name: s.name || t('your area') })}</p>
            <PlaceSearch adding showExamples={false} autofocus={matchMedia('(pointer: fine)').matches} onpick={() => (addingArea = false)} />
          </div>
        {/if}
        <!-- the old search text and the three ways are tucked away until the person asks to change the area -->
        <button class="act" bind:this={changeBtn} aria-expanded={changing} aria-controls="choose-area" onclick={toggleChange}>
          {t('Change area')} <span class="end caret" class:open={changing}><CaretDown size={14} weight="bold" /></span>
        </button>
        {#if changing}
          <div class="choose inset" id="choose-area" bind:this={choose}>{@render chooser()}</div>
        {/if}
        <button class="act reset" onclick={clearArea}>{t('Start over')}</button>
      </div>
    </section>
    <!-- one click sets up the layers a kind of study usually shows; each can be changed afterwards -->
    <section class="recipes" aria-labelledby="recipe-title">
      <h3 class="group-title" id="recipe-title">{t('What is the map about?')}</h3>
      <div class="chips">
        {#each RECIPES as r}<button class="chip" title={t(r.note)} onclick={() => applyRecipe(r.id)}>{t(r.name)}</button>{/each}
      </div>
      <p class="hint">{t('Sets up the layers for that kind of study. Change anything afterwards in Map parts, Layers.')}</p>
    </section>
  {:else}
    <section class="choose" id="choose-area" bind:this={choose}>{@render chooser()}</section>
    {#if kept.length}
      <!-- someone who has made maps here before: pick one up where they left it -->
      <section>
        <h3 class="group-title">{t('Your maps')}</h3>
        <ul class="kept" aria-label={t('Your most recent maps')}>
          {#each kept as m (m.id)}
            <li>
              <span class="pic" aria-hidden="true">{#if m.thumb}<img src={m.thumb} alt="" />{/if}</span>
              <span class="nm"><strong title={m.name}>{m.name}</strong><small>{ago(m.updated)}</small></span>
              <button class="btn small" onclick={() => openKeptMap(m.id)} aria-label={t('Open {name}', { name: m.name })}>{t('Open')}</button>
            </li>
          {/each}
        </ul>
        <div class="rows"><button class="act" onclick={() => (mapsUi.open = true)}>{t('All my maps')} <span class="end"><CaretRight size={14} weight="bold" /></span></button></div>
      </section>
    {:else}
      <!-- the first question people ask about a free map tool: what is the catch? -->
      <section>
        <ul class="promise" aria-label={t('About StudyMap')}>
          <li>{t('Free, with no sign-up')}</li>
          <li>{t('No watermark on any file')}</li>
          <li>{t('Vector PDF at the exact journal size')}</li>
          <li>{t('Your files stay on your computer')}</li>
        </ul>
      </section>
    {/if}
  {/if}
</div>

<style>
  .recipes { display: grid; gap: 10px; }
  .recipes .group-title { margin: 0; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid var(--line); background: var(--panel); font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
  .chip:hover { border-color: var(--line-strong); color: var(--ink); background: var(--panel-2); }
  @media (pointer: coarse) { .chip { height: 44px; border-radius: 22px; } }
  .choose, .adding { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
  .choose > .group-title { margin: 0; }
  /* opened under its row: air above, a hairline closing it */
  .inset, .adding { padding: 4px 0 16px; border-bottom: 1px solid var(--line); }
  /* the actions: one ruled list of full-width rows */
  .rows { display: grid; border-top: 1px solid var(--line); }
  .kept + .rows { border-top: 0; }
  .act {
    display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px;
    padding: 10px 4px; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent;
    text-align: left; font-weight: 500; color: var(--ink);
  }
  .act:hover { background: var(--panel-2); }
  .act:focus-visible { outline-offset: -2px; }
  /* a row that has opened something hands its hairline to what it opened */
  .act[aria-expanded='true'] { border-bottom-color: transparent; }
  .act.reset:hover { color: var(--err); }
  .end { display: inline-flex; color: var(--ink-3); }
  .caret { transition: transform 160ms ease; }
  .caret.open { transform: rotate(180deg); }
  /* the areas on the map: ruled rows, no boxes */
  .areas { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .areas li { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 36px; padding: 0 0 0 4px; border-bottom: 1px solid var(--line); font-size: 14px; font-weight: 500; }
  .areas .x { width: 28px; height: 28px; display: grid; place-items: center; border: 0; border-radius: var(--r-chip); background: transparent; color: var(--ink-3); }
  @media (pointer: coarse) { .areas .x { width: 44px; height: 44px; } }
  .areas .x:hover { background: var(--err-wash); color: var(--err); }
  /* maps kept in My maps: a picture, the name, when, and Open; ruled rows, no cards */
  .kept { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .kept li { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 0 8px 4px; border-bottom: 1px solid var(--line); }
  .kept .pic { width: 52px; height: 39px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: var(--r-chip); background: var(--panel-2); }
  .kept .pic img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .kept .nm { display: grid; min-width: 0; }
  .kept .nm strong { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kept .nm small { font-size: 12.5px; color: var(--ink-3); }
  /* what the tool promises: not a result, so plain quiet rows with a small graphite tick */
  .promise { list-style: none; margin: 0; padding: 0; display: grid; gap: 7px; font-size: 12.5px; color: var(--ink-3); }
  .promise li { display: flex; align-items: center; gap: 8px; }
  .promise li::before { content: ''; width: 14px; height: 14px; flex: none; background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.3l3 3 6-6.4' fill='none' stroke='%232b2d2f' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat; }
  .cur-text { display: grid; gap: 2px; }
  .area-name { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; border: 1px solid transparent; border-radius: var(--r-chip); background: transparent; padding: 2px 6px; margin-left: -7px; width: calc(100% + 7px); }
  .area-name:hover { border-color: var(--line-strong); background: var(--panel); }
  .area-name:focus-visible { outline: none; border-color: var(--accent); background: var(--panel); box-shadow: 0 0 0 3px var(--accent-ring); }
  .label { font-size: 11.5px; color: var(--ink-3); font-weight: 500; }
  .tools { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .tool {
    display: grid; justify-items: center; gap: 6px; padding: 12px 4px 10px;
    border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel);
    font-size: 11.5px; font-weight: 500; color: var(--ink-2);
    transition: border-color 120ms ease, background-color 120ms ease, box-shadow 120ms ease;
  }
  .tool:hover { border-color: var(--line-strong); color: var(--ink); }
  /* chosen: washed blue with the blue ring; its text is the dark blue, never the plain accent */
  .tool[aria-pressed='true'] { border-color: transparent; background: var(--accent-wash); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--accent-ink); }
  .ways button { font-size: 12.5px; padding: 6px 2px; }
  .adv { display: grid; gap: 18px; padding-top: 4px; }
</style>
