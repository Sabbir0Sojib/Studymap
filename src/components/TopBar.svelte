<script lang="ts">
  import ArrowCounterClockwise from 'phosphor-svelte/lib/ArrowCounterClockwise';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import Warning from 'phosphor-svelte/lib/Warning';
  import WarningOctagon from 'phosphor-svelte/lib/WarningOctagon';
  import { tick } from 'svelte';
  import { store, STUDY_GEOM } from '../lib/store.svelte';
  import { shareLink } from '../lib/share';
  import { t } from '../lib/i18n.svelte';
  import { packFonts, unpackFonts } from '../lib/fonts.svelte';
  import { setJournal, PAGE_MIN, PAGE_MAX } from '../lib/actions';
  import { download } from '../lib/export';
  import { PRESETS, CUSTOM_PRESET, findPreset } from '../lib/journals';
  import { applyTemplate } from '../lib/templates';
  import type { Finding } from '../lib/check';
  import MapsDialog from './MapsDialog.svelte';
  import { keepCurrent, mapsUi, startNewMap } from './shell.svelte';

  interface Props { svgEl?: SVGSVGElement; findings: Finding[] }
  let { findings }: Props = $props();
  let fileInput: HTMLInputElement;
  let open = $state<'' | 'file' | 'size' | 'check'>('');
  /** Close the open menu and put keyboard focus back on the button that opened it. */
  function closeMenu() {
    const trigger = wrap?.querySelector<HTMLElement>('[aria-expanded="true"]');
    open = '';
    trigger?.focus();
  }
  let wrap: HTMLElement;
  /** open a menu; opened from the keyboard (a click with no pointer: detail 0), the keyboard moves to its first choice */
  async function toggle(m: 'file' | 'size' | 'check', e?: MouseEvent) {
    open = open === m ? '' : m;
    if (!open || (e && e.detail > 0)) return;
    await tick();
    [...(wrap?.querySelectorAll<HTMLElement>('.pop button') ?? [])].find((b) => b.offsetParent)?.focus({ preventScroll: true });
  }
  /** Tab out of a menu closes it (a click elsewhere is handled by the pointer listener) */
  function leave(e: FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (to && !(e.currentTarget as HTMLElement).contains(to)) open = '';
  }
  /** a width or height outside what the page allows is set to the nearest allowed value, and the person is told */
  function sizeValue(raw: string, min: number, max: number, was: number, what: string) {
    const n = Math.round(+raw || was);
    const v = Math.min(max, Math.max(min, n));
    if (v !== n) store.status = t('{what} can be {min} to {max} mm, so it is set to {v} mm.', { what, min: String(min), max: String(max), v: String(v) });
    return v;
  }

  const worst = $derived(findings.some((f) => f.level === 'error') ? 'error' : findings.some((f) => f.level === 'warn') ? 'warn' : 'ok');
  const issues = $derived(findings.filter((f) => f.level === 'warn' || f.level === 'error').length);
  const preset = $derived(findPreset(store.doc.presetId));
  const publishers = [...new Set(PRESETS.map((p) => p.publisher))];
  /** what the journal check measures against */
  const rules = $derived(preset.id === 'custom' ? t('general journal rules') : t('{publisher} figure rules', { publisher: preset.publisher }));

  $effect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!wrap.contains(e.target as Node)) open = ''; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) { e.stopImmediatePropagation(); closeMenu(); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  });

  const fileBase = () => (store.doc.title || 'Study area map').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'Study_area_map';

  function saveProject() {
    closeMenu();
    const fontsIn = packFonts(store.doc);
    const json = Object.keys(fontsIn).length ? store.serialize(true).replace(/\}$/, `,"fonts":${JSON.stringify(fontsIn)}}`) : store.serialize(true);
    download(new Blob([json], { type: 'application/json' }), `${fileBase()}.studymap.json`);
    store.status = t('Project file downloaded. Open it here any time (File, Open a project file) to keep editing.');
  }
  async function openProject(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      const text = await f.text();
      try { unpackFonts(JSON.parse(text).fonts); } catch { /* a damaged file is reported by load below */ }
      await keepCurrent(); // the map on screen goes to My maps first, with its latest edits
      store.load(text);
      store.status = t('Opened {name}.', { name: f.name });
    }
    catch (err) { store.status = (err as Error).message; }
  }
  /** the map on screen is already kept in My maps, so a new map needs no question */
  function newMap() {
    closeMenu();
    startNewMap();
  }
  function myMaps() {
    closeMenu(); // the keyboard returns to File when My maps closes
    mapsUi.open = true;
  }
  /** the colour-blind preview: on screen only, shown by the page itself with a Turn off button */
  const CVD = [['', 'Normal vision'], ['deutan', 'Red-green (deuteranopia)'], ['protan', 'Red-weak (protanopia)'], ['tritan', 'Blue-yellow (tritanopia)'], ['grey', 'Printed in black and white']] as const;
  /** File, Copy a share link: the map travels inside the link (nothing is uploaded); what cannot go with it is named */
  async function shareMap() {
    closeMenu();
    const own = store.doc.layers.filter((l) => (l.kind === 'vector' || l.kind === 'points') && !l.source).map((l) => l.id);
    try {
      const { url, left } = await shareLink(store.doc, store.geoms, [...own, STUDY_GEOM]);
      await navigator.clipboard.writeText(url);
      store.told(t('Share link copied. Anyone who opens it gets this map in their own browser; nothing is uploaded.') + (left.length ? ' ' + t('Not in the link: {list}.', { list: left.join(', ') }) : ''));
    } catch {
      store.status = t('Could not copy the link. Try again, or use File, Download project file.');
    }
  }
  function pickSize(id: string) {
    setJournal(id);
    closeMenu();
  }
</script>

<header class="top" bind:this={wrap}>
  <div class="brand">
    <svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--cover-mark)" />
      <path d="M7 18.5c3-6 7.5-8.8 14-8.2" fill="none" stroke="var(--cover-mark-ink)" stroke-width="2.2" stroke-linecap="round" />
      <circle cx="9.5" cy="9.5" r="2.2" fill="var(--cover-mark-dot)" />
    </svg>
    <h1 class="wordmark" translate="no">StudyMap</h1>
  </div>

  <div class="menu-wrap" onfocusout={leave}>
    <button class="tbtn" aria-expanded={open === 'file'} aria-controls="menu-file" onclick={(e) => toggle('file', e)}>{t('File')} <CaretDown size={12} weight="bold" /></button>
    {#if open === 'file'}
      <div class="pop" id="menu-file" role="group" aria-label={t('File')}>
        <!-- small screens have no room for the name in the bar: it is renamed here -->
        <label class="pop-title"><span>{t('Map name')}</span><input class="input" bind:value={store.doc.title} oninput={() => store.commit()} spellcheck={false} autocomplete="off" name="map-name-menu" /></label>
        <button onclick={myMaps}>{t('My maps…')}</button>
        <button onclick={newMap}>{t('New map')}</button>
        <button onclick={() => { open = ''; fileInput.click(); }}>{t('Open a project file…')}</button>
        <button onclick={saveProject}>{t('Download project file')}</button>
        <button onclick={shareMap} disabled={store.doc.study.source === 'none'}>{t('Copy a share link')}</button>
      </div>
    {/if}
  </div>
  <input bind:this={fileInput} type="file" accept=".json" class="sr-only" onchange={openProject} tabindex="-1" aria-hidden="true" />

  <div class="undo">
    <button class="ibtn" onclick={() => store.undo()} disabled={!store.canUndo} aria-label={t('Undo')} title={t('Undo (Ctrl+Z)')}><ArrowCounterClockwise size={18} /></button>
    <button class="ibtn" onclick={() => store.redo()} disabled={!store.canRedo} aria-label={t('Redo')} title={t('Redo (Ctrl+Y)')}><ArrowClockwise size={18} /></button>
  </div>

  <label class="title">
    <span class="sr-only">{t('Map name')}</span>
    <input bind:value={store.doc.title} oninput={() => store.commit()} spellcheck={false} autocomplete="off" name="map-name" title={t('Rename the map (used for the file name)')} />
  </label>

  <div class="right">
    {#if store.doc.study.source !== 'none' && store.savedAt}
      <span class="saved" class:bad={store.savedAt < 0} class:busy={store.saving && store.savedAt >= 0} title={store.savedAt < 0 ? t('This browser could not keep your map. Use File, Download project file.') : t('Your map is kept in this browser between visits. File, Download project file keeps a copy for another computer.')}>
        <span class="saved-text">{store.savedAt < 0 ? t('Not saved') : store.saving ? t('Saving…') : t('Saved in this browser')}</span>
      </span>
    {/if}
    <div class="menu-wrap" onfocusout={leave}>
      <button class="tbtn size" aria-expanded={open === 'size'} aria-controls="menu-size" onclick={(e) => toggle('size', e)}>
        <span class="size-name">{preset.id === 'custom' ? t('Custom size') : `${preset.publisher}, ${t(preset.label).toLowerCase()}`}</span>
        <span class="size-mm">{store.doc.widthMm}&nbsp;×&nbsp;{store.doc.heightMm}&nbsp;mm</span>
        <CaretDown size={12} weight="bold" />
      </button>
      {#if open === 'size'}
        <div class="pop wide" id="menu-size" role="group" aria-label={t('Figure size')}>
          <p class="pop-note">{t('Pick the journal you are submitting to. The figure is sized to its column width.')}</p>
          <div class="sizes">
            {#each publishers as pub}
              <!-- one row per publisher: the name in its own column, its sizes lined up beside it -->
              <div class="pub" role="group" aria-label={pub}>
                <span class="pub-name">{pub}</span>
                <div class="pub-sizes">
                  {#each PRESETS.filter((p) => p.publisher === pub) as p}
                    <button class="chip" aria-pressed={store.doc.presetId === p.id} onclick={() => pickSize(p.id)}>{t(p.label)}<small>{p.widthMm}&nbsp;mm</small></button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
          <div class="custom">
            <label>{t('Width')} <input type="number" inputmode="numeric" min={PAGE_MIN} max={PAGE_MAX} value={store.doc.widthMm} aria-describedby="size-range" onchange={(e) => { const v = sizeValue((e.target as HTMLInputElement).value, PAGE_MIN, PAGE_MAX, store.doc.widthMm, t('Width')); (e.target as HTMLInputElement).value = String(v); store.doc.presetId = 'custom'; store.doc.widthMm = v; applyTemplate(store.doc, store.doc.templateId); store.commit(); }} /> mm</label>
            <label>{t('Height')} <input type="number" inputmode="numeric" min={PAGE_MIN} max={PAGE_MAX} value={store.doc.heightMm} aria-describedby="size-range" onchange={(e) => { store.doc.heightMm = sizeValue((e.target as HTMLInputElement).value, PAGE_MIN, PAGE_MAX, store.doc.heightMm, t('Height')); (e.target as HTMLInputElement).value = String(store.doc.heightMm); const tid = store.doc.templateId; const h = store.doc.heightMm; applyTemplate(store.doc, tid); store.doc.heightMm = h; store.commit(); }} /> mm</label>
          </div>
          <p class="pop-note" id="size-range">{t('Width and height can each be {min} to {max} mm.', { min: String(PAGE_MIN), max: String(PAGE_MAX) })}</p>
        </div>
      {/if}
    </div>
    <div class="menu-wrap" onfocusout={leave}>
      <button class="check {store.busy ? 'is-loading' : store.doc.study.source === 'none' ? 'idle' : worst}" aria-expanded={open === 'check'} aria-controls="menu-check" onclick={(e) => toggle('check', e)}>
        {#if store.busy}<span class="spin" aria-hidden="true"></span> <span><span class="long">{store.busy}</span><span class="short">{t('Loading')}</span></span>
        {:else if store.doc.study.source === 'none'}<CheckCircle size={16} /> <span class="ctext">{t('Journal check')}</span>
        {:else if worst === 'ok'}<CheckCircle size={16} weight="fill" /> <span class="ctext">{t('Ready')}</span>{:else if worst === 'warn'}<Warning size={16} weight="fill" /> <span class="ctext">{t('{n} to check', { n: issues })}</span>{:else}<WarningOctagon size={16} weight="fill" /> <span class="ctext">{t('{n} to fix', { n: issues })}</span>{/if}
        {#if !store.busy}<CaretDown size={11} weight="bold" class="chev" />{/if}
      </button>
      {#if open === 'check'}
        <div class="pop wide" id="menu-check" role="group" aria-label={t('Journal check')}>
          <p class="pop-note">{store.doc.study.source === 'none' ? t('Pick a place first; the map is then checked against {rules} (size, fonts, line widths, dpi, format, overlaps).', { rules }) : t('Checked against {rules} (size, fonts, line widths, dpi, format, overlaps).', { rules })}</p>
          <ul class="findings" role="list">
            {#each findings as f}<li class={f.level}><span class="sr-only">{f.level === 'error' ? t('Must fix:') + ' ' : f.level === 'warn' ? t('Check:') + ' ' : f.level === 'ok' ? t('Passed:') + ' ' : ''}</span>{f.text}{#if f.fix || f.ids?.length}<span class="fixrow">{#if f.fix}<button class="fixbtn" onclick={() => { f.fix!.run(); store.commit(); }}>{f.fix.label}</button>{/if}{#if f.ids?.length}<button class="fixbtn ghost" onclick={() => { store.select(f.ids![0]); open = ''; }}>{t('Show me')}</button>{/if}</span>{/if}</li>{/each}
          </ul>
          {#if store.doc.study.source !== 'none'}
            <!-- a check made on the finished figure, so it lives with the other checks -->
            <div class="cvd">
              <span class="cvd-title">{t('Colour-blind readers and grey print')}</span>
              <label class="cvd-field"><span>{t('Show the page as seen with')}</span>
                <select class="input" value={store.cvd} onchange={(e) => (store.cvd = (e.target as HTMLSelectElement).value as typeof store.cvd)}>
                  {#each CVD as [v, label]}<option value={v}>{t(label)}</option>{/each}
                </select>
              </label>
              <p class="pop-note">{t('On screen only. Your exported files are not changed.')}</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <button class="btn primary export" onclick={() => { store.select(null); store.tab = 'export'; store.panelOpen = true; }}><DownloadSimple size={17} weight="bold" /> <span class="export-text">{t('Export')}</span></button>
  </div>
  <!-- one lasting live region outside the buttons: loading news is read out once, not inside a control -->
  <span class="sr-only" role="status">{store.busy}</span>
  <MapsDialog bind:open={mapsUi.open} />
</header>

<style>
  .top {
    grid-area: top;
    display: flex; align-items: center; gap: 6px;
    padding: 0 12px 0 14px;
    background: var(--cover);
    border-bottom: 1px solid var(--cover-edge);
    color: var(--cover-ink);
    min-width: 0;
    position: relative;
    z-index: 20;
  }
  .brand { display: flex; align-items: center; gap: 9px; margin-right: 10px; }
  .wordmark { margin: 0; font-size: 16px; font-weight: 700; letter-spacing: -0.02em; }
  .tbtn, .ibtn {
    display: inline-flex; align-items: center; gap: 6px;
    height: 36px; padding: 0 10px; border: 0; border-radius: var(--r-ctl);
    background: transparent; font-weight: 500; color: var(--cover-ink);
  }
  .ibtn { width: 36px; justify-content: center; padding: 0; color: var(--cover-ink); }
  .tbtn:hover, .ibtn:hover:not(:disabled) { background: var(--cover-hover); }
  .tbtn:active, .ibtn:active:not(:disabled), .check:active { transform: scale(0.97); }
  .tbtn, .ibtn, .check { transition: background-color 120ms ease, transform 80ms ease; }
  .ibtn:disabled { opacity: 0.35; cursor: default; }
  .undo { display: flex; gap: 2px; padding-right: 8px; margin-right: 4px; border-right: 1px solid var(--cover-edge); }
  /* the map name takes all the room between the left tools and the right ones, so the bar has no empty stretch;
     a plain line of text until pointed at, as in a design program */
  .title { flex: 1 1 auto; min-width: 80px; }
  .title input { width: 100%; height: 36px; border: 1px solid transparent; border-radius: var(--r-ctl); background: transparent; padding: 0 10px; font-weight: 600; color: var(--cover-ink); text-overflow: ellipsis; transition: border-color 120ms ease, background-color 120ms ease; }
  .title input:hover { background: var(--cover-hover); }
  .title input:focus-visible { outline: none; border-radius: var(--r-ctl); border: 1px solid var(--graphite); background: var(--panel); color: var(--ink); box-shadow: 0 0 0 3px var(--accent-ring); }
  .right { flex: none; display: flex; align-items: center; gap: 8px; min-width: 0; }
  .size { border: 1px solid var(--cover-chip-edge); background: var(--cover-chip); color: var(--cover-chip-ink); gap: 8px; }
  .size:hover { background: var(--cover-chip-hover) !important; }
  .size-name { font-weight: 500; }
  .size-mm { color: var(--cover-ink-2); }
  .saved { font-size: 12.5px; color: var(--cover-ink-2); white-space: nowrap; padding: 0 4px; }
  .saved::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--ok); margin-right: 6px; vertical-align: 1px; }
  .saved.bad { color: var(--err); } .saved.bad::before { background: var(--err); }
  /* an edit not yet kept: a hollow dot until it is */
  .saved.busy::before { background: transparent; box-shadow: inset 0 0 0 1.5px var(--ink-3); }
  .check, .size, .tbtn { white-space: nowrap; }
  .check { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: var(--r-ctl); border: 0; font-weight: 600; font-size: 14px; }
  .check.idle { background: var(--cover-chip); color: var(--cover-chip-ink); font-weight: 500; box-shadow: inset 0 0 0 1px var(--cover-chip-edge); }
  .check.ok { background: var(--panel); color: var(--graphite); box-shadow: inset 0 0 0 1px var(--cover-chip-edge); }
  .check.ok :global(svg:first-child) { color: var(--ok); }
  .check.ok:hover { background: var(--panel-2); }
  .check.warn { background: var(--warn-wash); color: var(--warn); }
  .check.idle:hover, .check.is-loading:hover { background: var(--cover-chip-hover); }
  .check.warn:hover { background: color-mix(in srgb, var(--warn) 10%, var(--warn-wash)); }
  .check.error:hover { background: color-mix(in srgb, var(--err) 10%, var(--err-wash)); }
  .check.error { background: var(--err-wash); color: var(--err); }
  .check.is-loading { background: var(--cover-chip); color: var(--cover-chip-ink); font-weight: 500; max-width: 240px; overflow: hidden; text-overflow: ellipsis; }
  .spin { width: 13px; height: 13px; flex: none; border-radius: 50%; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: spin 700ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  /* the one main action on the cover, in the cover's own action colour */
  .export { height: 38px; background: var(--cover-action) !important; border-color: var(--cover-action) !important; color: var(--cover-action-ink) !important; }
  .export:hover { background: var(--cover-action-hover) !important; }
  /* on the cover the focus ring takes the cover's focus colour; inside the white menus it is ruling blue again */
  .top :focus-visible { outline-color: var(--cover-focus); }
  .top .pop :focus-visible { outline-color: var(--accent); }
  .menu-wrap { position: relative; }
  .pop {
    position: absolute; top: 42px; left: 0; z-index: 30;
    min-width: 200px; padding: 6px;
    background: var(--panel); border-radius: var(--r-panel);
    box-shadow: var(--shadow-2), 0 0 0 1px var(--line);
    color: var(--ink);
    display: grid;
  }
  .right .pop { left: auto; right: 0; }
  .pop > button { text-align: left; border: 0; background: transparent; padding: 9px 12px; border-radius: var(--r-chip); }
  .pop > button:hover { background: var(--panel-2); }
  .pop-title { display: none; gap: 4px; padding: 4px 6px 10px; margin-bottom: 4px; border-bottom: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); font-weight: 500; }
  .pop.wide { width: 480px; padding: 14px; gap: 12px; }
  .pop-note { margin: 0; font-size: 12.5px; color: var(--ink-3); }
  .sizes { display: grid; gap: 0; max-height: min(420px, calc(100dvh - 260px)); overflow: auto; padding-right: 4px; }
  .pub { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; align-items: start; padding: 6px 0; }
  .pub + .pub { border-top: 1px solid var(--line); }
  .pub-name { font-size: 12.5px; font-weight: 600; padding-top: 6px; }
  .pub-sizes { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; gap: 6px; align-items: baseline; border: 1px solid var(--line); background: var(--panel); border-radius: var(--r-chip); padding: 5px 9px; font-size: 12.5px; }
  .chip small { color: var(--ink-3); }
  .chip:hover { border-color: var(--line-strong); }
  .chip[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-wash); color: var(--accent-ink); }
  .custom { display: flex; gap: 16px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); }
  .custom input { width: 64px; height: 30px; border: 1px solid var(--line-strong); border-radius: var(--r-chip); padding: 0 6px; margin: 0 4px; }
  .findings { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-height: min(380px, calc(100dvh - 360px)); overflow: auto; }
  /* the colour-blind preview: one labelled select under a hairline, the note under it */
  .cvd { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
  .cvd-title { font-size: 12.5px; font-weight: 600; color: var(--ink); }
  .cvd-field { display: grid; gap: 6px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
  .findings li { font-size: 12.5px; padding: 8px 10px; border-radius: var(--r-ctl); line-height: 1.4; }
  .fixrow { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
  .fixbtn { display: inline-block; border: 1px solid currentColor; background: var(--panel); color: inherit; border-radius: var(--r-chip); padding: 4px 10px; font-size: 12.5px; font-weight: 600; }
  .fixbtn:hover { background: color-mix(in srgb, currentColor 10%, var(--panel)); }
  .fixbtn:active { transform: translateY(1px); }
  .fixbtn.ghost { border-color: transparent; background: transparent; text-decoration: underline; text-underline-offset: 2px; }
  .findings li.ok { background: var(--ok-wash); color: var(--ok); }
  .findings li.info { background: var(--panel-2); color: var(--ink-2); }
  .check :global(.chev) { opacity: 0.7; margin-left: -2px; }
  .findings li.warn { background: var(--warn-wash); color: var(--warn-ink); }
  .findings li.error { background: var(--err-wash); color: var(--err); }
  @media (max-width: 1240px) { .size-mm { display: none; } }
  @media (max-width: 1100px) and (min-width: 881px) { .saved { display: none; } }
  @media (max-width: 980px) { .size-name { display: none; } .size-mm { display: inline; } }
  .short { display: none; }
  @media (max-width: 880px) {
    .long { display: none; }
    .short { display: inline; }
    .check { padding: 0 10px; }
    .title, .wordmark, .size { display: none; }
    .pop-title { display: grid; }
    /* the saved dot stays as a quiet sign; its words stay for screen readers */
    .saved { padding: 0 2px; }
    .saved::before { margin-right: 0; }
    .saved-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .undo { padding-right: 4px; margin-right: 0; }
    .pop.wide { position: fixed; top: 60px; left: 12px; right: 12px; width: auto; max-height: calc(100dvh - 140px); overflow: auto; }
  }
  /* narrow phones: the check pill keeps only its icon (the words stay for screen readers) */
  @media (max-width: 440px) {
    .ctext, .check .short { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .check { padding: 0 10px; }
    .check :global(.chev) { display: none; }
  }
  /* the smallest phones: the mark and the word Export give way so every button stays on screen */
  @media (max-width: 360px) {
    .brand { display: none; }
    .export { padding: 0 10px; }
    .export-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  }
  @media (pointer: coarse) {
    .tbtn, .ibtn, .check, .export { min-height: 44px; }
    .ibtn { width: 44px; }
  }
</style>
