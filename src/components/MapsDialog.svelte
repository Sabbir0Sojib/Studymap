<script lang="ts">
  // My maps: every map kept in this browser as a card with its picture, to open, copy or delete, and the named
  // versions of the map on screen ("Before reviewer 2"), to keep a stage of the work and go back to it.
  import X from 'phosphor-svelte/lib/X';
  import { store, uid } from '../lib/store.svelte';
  import { t, i18n } from '../lib/i18n.svelte';
  import { deleteMap, deleteVersion, getMap, listMaps, listVersions, putMap, putVersion } from '../lib/library';
  import type { MapEntry, VersionEntry } from '../lib/library';
  import { startNewMap, ago } from './shell.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dlg = $state<HTMLDialogElement>();
  let maps = $state<Omit<MapEntry, 'data'>[]>([]);
  let versions = $state<VersionEntry[]>([]);
  let label = $state('');
  let asking = $state<string | null>(null); // the card asking "Delete?"
  let error = $state('');

  async function refresh() {
    error = '';
    try { maps = await listMaps(); versions = await listVersions(store.mapId); }
    catch (e) { error = (e as Error).message; }
  }
  $effect(() => {
    if (!dlg) return;
    if (open && !dlg.open) { dlg.showModal(); refresh(); }
    else if (!open && dlg.open) dlg.close();
  });

  const when = ago; // "just now", "5 min ago", or the date

  /** Keep the map on screen first, so switching never loses an edit made a moment ago. */
  async function keepCurrent() {
    store.flush();
    if (store.doc.study.source === 'none') return;
    const old = maps.find((m) => m.id === store.mapId);
    await putMap({ id: store.mapId, name: store.doc.title || 'Untitled map', updated: Date.now(), thumb: old?.thumb, data: store.serialize(true, false) });
  }
  async function openMap(id: string) {
    if (id === store.mapId) { open = false; return; }
    try {
      await keepCurrent();
      const m = await getMap(id);
      if (!m) { error = t('That map is no longer in this browser.'); await refresh(); return; }
      store.load(m.data, true);
      store.setMapId(id);
      open = false;
      store.told(t('Opened {name}. Your other maps are in File, My maps.', { name: m.name }));
    } catch (e) { error = t('Could not open that map: {reason}', { reason: (e as Error).message }); }
  }
  async function copyMap(id: string) {
    try {
      const m = id === store.mapId ? { ...(await getMap(id)), data: store.serialize(true, false), name: store.doc.title } : await getMap(id);
      if (!m?.data) return;
      await putMap({ id: uid('map'), name: t('{name} (copy)', { name: m.name }), updated: Date.now(), thumb: (m as MapEntry).thumb, data: m.data });
      await refresh();
    } catch (e) { error = (e as Error).message; }
  }
  async function removeMap(id: string) {
    asking = null;
    await deleteMap(id).catch((e) => (error = (e as Error).message));
    await refresh();
  }
  async function newMap() {
    open = false;
    await startNewMap(); // the same as File, New map: keeps this one, starts in the default style
  }
  async function saveVersion() {
    const name = label.trim() || t('Version of {when}', { when: new Date().toLocaleString(i18n.lang === 'bn' ? 'bn-BD' : undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) });
    store.flush();
    const cur = maps.find((m) => m.id === store.mapId);
    try {
      await putVersion({ id: uid('ver'), mapId: store.mapId, label: name, created: Date.now(), thumb: cur?.thumb, data: store.serialize(true, false) });
      label = '';
      await refresh();
    } catch (e) { error = (e as Error).message; }
  }
  async function restore(v: VersionEntry) {
    try {
      await keepCurrent();
      store.load(v.data, true);
      open = false;
      store.told(t('Back to "{label}". Undo brings back what you had.', { label: v.label }));
    } catch (e) { error = (e as Error).message; }
  }
</script>

<dialog bind:this={dlg} class="maps" aria-labelledby="maps-title" onclose={() => (open = false)} onclick={(e) => { if (e.target === dlg) open = false; }}>
  <div class="inner">
    <header>
      <h2 id="maps-title">{t('My maps')}</h2>
      <button class="close" onclick={() => (open = false)} aria-label={t('Close My maps')}><X size={18} /></button>
    </header>
    <p class="note">{t('Kept in this browser on this computer only. For another computer, use File, Download project file.')}</p>
    {#if error}<p class="err" role="alert">{error}</p>{/if}

    <div class="grid">
      <button class="card new" onclick={newMap}><span class="plus" aria-hidden="true">+</span><span>{t('New map')}</span></button>
      {#each maps as m (m.id)}
        <article class="card" class:current={m.id === store.mapId}>
          <button class="pic" onclick={() => openMap(m.id)} aria-label={t('Open {name}', { name: m.name })}>
            {#if m.thumb}<img src={m.thumb} alt="" />{:else}<span class="nopic">{t('No picture yet')}</span>{/if}
          </button>
          <div class="meta">
            <strong title={m.name}>{m.name}</strong>
            <small>{m.id === store.mapId ? t('Open now') : when(m.updated)}</small>
          </div>
          <div class="acts">
            {#if asking === m.id}
              <span class="ask">{t('Delete this map?')}</span>
              <button class="btn small danger" onclick={() => removeMap(m.id)}>{t('Delete')}</button>
              <button class="btn small" onclick={() => (asking = null)}>{t('Keep')}</button>
            {:else}
              <button class="btn small" onclick={() => copyMap(m.id)} aria-label={t('Make a copy of {name}', { name: m.name })}>{t('Copy')}</button>
              {#if m.id !== store.mapId}<button class="btn small" onclick={() => (asking = m.id)} aria-label={t('Delete {name}', { name: m.name })}>{t('Delete')}</button>{/if}
            {/if}
          </div>
        </article>
      {/each}
    </div>

    {#if store.doc.study.source !== 'none'}
      <section class="versions">
        <h3>{t('Versions of this map')}</h3>
        <p class="note">{t('Keep a stage of your work, for example before you send it to a co-author or a reviewer.')}</p>
        <form class="row" onsubmit={(e) => { e.preventDefault(); saveVersion(); }}>
          <input class="input" type="text" placeholder={t('Name, e.g. Before reviewer 2')} bind:value={label} aria-label={t('Version name')} />
          <button class="btn" type="submit">{t('Keep this version')}</button>
        </form>
        {#if versions.length}
          <ul class="vlist">
            {#each versions as v (v.id)}
              <li>
                <div class="vname"><strong>{v.label}</strong><small>{when(v.created)}</small></div>
                <button class="btn small" onclick={() => restore(v)}>{t('Go back to it')}</button>
                <button class="btn small" onclick={async () => { await deleteVersion(v.id); await refresh(); }} aria-label={t('Delete version {label}', { label: v.label })}>{t('Delete')}</button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}
  </div>
</dialog>

<style>
  .maps { border: 0; padding: 0; border-radius: 14px; width: min(860px, calc(100vw - 32px)); max-height: min(88dvh, 860px); background: var(--panel); color: var(--ink); box-shadow: var(--shadow-page); }
  .maps::backdrop { background: rgb(27 31 29 / 0.32); }
  .inner { display: grid; gap: 14px; padding: 20px; overflow: auto; max-height: inherit; box-sizing: border-box; }
  header { display: flex; align-items: center; justify-content: space-between; }
  h2 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  h3 { margin: 0; font-size: 14px; font-weight: 600; }
  .close { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 8px; color: var(--ink-2); }
  .close:hover { background: var(--panel-2); color: var(--ink); }
  .note { margin: 0; font-size: 12.5px; color: var(--ink-3); text-wrap: pretty; }
  .err { margin: 0; font-size: 12.5px; color: var(--err); }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .card { display: grid; grid-template-rows: auto auto auto; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); min-width: 0; }
  .card.current { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .card.new { place-items: center; align-content: center; min-height: 190px; color: var(--ink-2); font-size: 14px; font-weight: 500; border-style: dashed; border-color: var(--line-input); }
  .card.new:hover { border-color: var(--ink-3); color: var(--ink); background: var(--panel-2); }
  .plus { font-size: 28px; line-height: 1; }
  .pic { display: grid; place-items: center; aspect-ratio: 4 / 3; border-radius: 6px; background: var(--panel-2); overflow: hidden; padding: 0; border: 1px solid var(--line); }
  .pic:hover { border-color: var(--line-strong); }
  .pic img { width: 100%; height: 100%; object-fit: contain; background: #fff; }
  .nopic { font-size: 12.5px; color: var(--ink-3); }
  .meta { display: grid; min-width: 0; }
  .meta strong { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta small { font-size: 11.5px; color: var(--ink-3); }
  .acts { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .ask { font-size: 12.5px; color: var(--ink-2); width: 100%; }
  .versions { display: grid; gap: 10px; padding-top: 14px; border-top: 1px solid var(--line); }
  .row { display: flex; gap: 8px; }
  .row .input { flex: 1; min-width: 0; }
  .vlist { list-style: none; margin: 0; padding: 0; display: grid; }
  .vlist li { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .vname { flex: 1; min-width: 0; display: grid; }
  .vname strong { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .vname small { font-size: 11.5px; color: var(--ink-3); }
  @media (max-width: 760px) { .inner { padding: 16px; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .row { flex-direction: column; } }
  @media (pointer: coarse) { .close { width: 44px; height: 44px; } }
</style>
