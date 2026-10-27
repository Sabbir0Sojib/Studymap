<script lang="ts">
  // "My styles": keep the look of one map in this browser and use it on the next, so a series of figures matches.
  // Nothing leaves the browser; a style can be shared as a small file.
  import { tick } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { t } from '../../lib/i18n.svelte';
  import {
    applyStyle, captureStyle, deleteStyle, getDefaultId, listStyles, readStyleFile, saveStyle, setDefaultId,
    styleFileName, styleToFile, swatchOf,
  } from '../../lib/mystyles';
  import type { MyStyle } from '../../lib/mystyles';
  import Star from 'phosphor-svelte/lib/Star';
  import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
  import Trash from 'phosphor-svelte/lib/Trash';
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';

  const NO_STORAGE = 'This browser could not keep the style (storage is full or switched off). Use Share to keep it as a file.';

  let styles = $state.raw<MyStyle[]>([]);
  let defaultId = $state<string | null>(null);
  let name = $state('');
  let withLayout = $state(false);
  let nameEl = $state<HTMLInputElement>();
  // a second step is asked in place, never in a pop-up: the name of the style that would be replaced, the id of the one to delete
  let replacing = $state<string | null>(null);
  let deleting = $state<string | null>(null);

  // the saved list is read from the browser after every change, so it is never out of step with the storage
  function reload() {
    styles = listStyles();
    defaultId = getDefaultId();
  }
  reload();

  function save(confirmed = false) {
    const n = name.trim();
    if (!n) return;
    let s = captureStyle(store.doc, n, withLayout);
    const same = styles.find((x) => x.name.toLowerCase() === s.name.toLowerCase());
    if (same) {
      if (!confirmed) { replacing = same.name; return; }
      s = { ...s, id: same.id, created: same.created };
    }
    replacing = null;
    if (!saveStyle(s)) { store.status = t(NO_STORAGE); return; }
    name = '';
    reload();
    store.status = t('Saved “{name}”.', { name: s.name });
  }

  function apply(s: MyStyle) {
    const r = applyStyle(store.doc, s);
    store.commit();
    let msg = t('Applied “{name}”.', { name: s.name });
    if (r.keptLayers.length) {
      const list = r.keptLayers.join(', ');
      msg += ' ' + (r.keptLayers.length > 1 ? t('Left as they were: {list} (the style has no look for those boundary levels).', { list }) : t('Left as they were: {list} (the style has no look for that boundary level).', { list }));
    }
    if (r.missingFonts.length) msg += ' ' + t('The font {list} is not in this browser yet, so text shows in a stand-in. Add it in Design, Text.', { list: r.missingFonts.join(', ') });
    store.status = msg;
  }

  function toggleDefault(s: MyStyle) {
    const on = defaultId !== s.id;
    if (!setDefaultId(on ? s.id : null)) { store.status = t(NO_STORAGE); return; }
    reload();
    store.status = on ? t('New maps will start with “{name}”.', { name: s.name }) : t('New maps will start with the standard look.');
  }

  function share(s: MyStyle) {
    const url = URL.createObjectURL(styleToFile(s));
    const a = document.createElement('a');
    a.href = url;
    a.download = styleFileName(s);
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    store.status = t('Downloaded {file}. Send it to a co-author, who can open it here with “Open a style file”.', { file: a.download });
  }

  // the trash button of each row, so focus can go back to it when "Keep" is chosen
  const trashes: Record<string, HTMLElement> = {};
  function track(node: HTMLElement, id: string) {
    trashes[id] = node;
    return { destroy() { if (trashes[id] === node) delete trashes[id]; } };
  }
  function focusNow(node: HTMLElement) { node.focus(); }
  async function keep(id: string) {
    deleting = null;
    await tick();
    trashes[id]?.focus();
  }
  async function remove(s: MyStyle) {
    deleting = null;
    if (!deleteStyle(s.id)) { store.status = t(NO_STORAGE); return; }
    reload();
    store.status = t('Deleted “{name}”. Maps that already use it keep their look.', { name: s.name });
    await tick();
    nameEl?.focus();
  }
  function askKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Escape') { e.stopPropagation(); keep(id); }
  }

  async function open(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const s = await readStyleFile(file);
      if (!saveStyle(s)) { store.status = t(NO_STORAGE); return; }
      reload();
      store.status = t('Added “{name}” to your styles.', { name: s.name });
    } catch (err) {
      store.status = t(err instanceof Error ? err.message : 'This is not a StudyMap style file.');
    }
  }
</script>

<div class="stack">
  <section>
    <h3 class="group-title sr-only" id="mystyles-title">{t('My styles')}</h3>
    <form class="save" aria-labelledby="mystyles-title" onsubmit={(e) => { e.preventDefault(); save(); }}>
      <label class="field"><span>{t('Name for this look')}</span>
        <input class="input" bind:this={nameEl} bind:value={name} oninput={() => (replacing = null)} placeholder={t('e.g. Thesis maps')} maxlength="60" autocomplete="off" />
      </label>
      <label class="check"><input type="checkbox" bind:checked={withLayout} /> {t('Include page size and layout')}</label>
      <p class="hint">{t('Off: other maps keep their own layout.')}</p>
      <button class="btn small primary" type="submit" disabled={!name.trim()}>{t('Save this look')}</button>
      {#if replacing}
        <div class="msg" role="alert">
          <span>{t('A style called “{name}” already exists. Replace it with this look?', { name: replacing })}</span>
          <span class="ask">
            <button class="btn small danger" type="button" onclick={() => save(true)}>{t('Replace')}</button>
            <button class="btn small ghost" type="button" onclick={() => (replacing = null)}>{t('Cancel')}</button>
          </span>
        </div>
      {/if}
    </form>
  </section>

  <section>
    {#if styles.length}
      <ul class="list" aria-label={t('Your saved styles')}>
        {#each styles as s (s.id)}
          {@const isDefault = s.id === defaultId}
          <li class="row" class:default={isDefault}>
            <span class="chips" aria-hidden="true">
              {#each swatchOf(s) as c}<i style="background:{c}"></i>{/each}
            </span>
            <span class="who">
              <span class="nm" title={s.name}>{s.name}</span>
              {#if isDefault}<span class="badge">{t('Default for new maps')}</span>{/if}
            </span>
            {#if deleting === s.id}
              <span class="acts ask" role="group" aria-label={t('Delete {name}?', { name: s.name })}>
                <span class="q">{t('Delete this style?')}</span>
                <button class="btn small danger" aria-label={t('Delete {name}', { name: s.name })} onkeydown={(e) => askKey(e, s.id)} onclick={() => remove(s)}>{t('Delete')}</button>
                <button class="btn small ghost" aria-label={t('Keep {name}', { name: s.name })} use:focusNow onkeydown={(e) => askKey(e, s.id)} onclick={() => keep(s.id)}>{t('Keep')}</button>
              </span>
            {:else}
              <span class="acts">
                <button class="btn small apply" onclick={() => apply(s)} aria-label={t('Apply {name} to this map', { name: s.name })}>{t('Apply')}</button>
                <button class="icon" class:on={isDefault} aria-pressed={isDefault} aria-label={t('Use {name} for new maps', { name: s.name })} title={t('Use for new maps')} onclick={() => toggleDefault(s)}><Star size={16} weight={isDefault ? 'fill' : 'regular'} /></button>
                <button class="icon" aria-label={t('Share {name} as a file', { name: s.name })} title={t('Share as a file')} onclick={() => share(s)}><ShareNetwork size={16} /></button>
                <button class="icon" use:track={s.id} aria-label={t('Delete {name}', { name: s.name })} title={t('Delete')} onclick={() => (deleting = s.id)}><Trash size={16} /></button>
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="hint empty">{t('No saved styles yet. Style one map the way you like it, then save its look here.')}</p>
    {/if}

    <label class="btn small import">
      <UploadSimple size={16} weight="bold" /> {t('Open a style file…')}
      <input type="file" accept=".json,application/json" class="sr-only" onchange={open} />
    </label>
  </section>
</div>

<style>
  .save { display: grid; gap: 10px; }
  .save .btn { justify-self: start; }
  /* the in-place "replace?" question */
  .msg { display: grid; gap: 8px; }
  .ask { display: flex; align-items: center; gap: 6px; }

  /* saved styles: rows told apart by hairlines; the default one is washed in blue */
  .list { list-style: none; margin: 0; padding: 0; display: grid; }
  .row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6px 10px; padding: 10px 8px; }
  .row + .row { border-top: 1px solid var(--line); }
  .row.default { background: var(--accent-wash); }
  .chips { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; width: 30px; height: 30px; padding: 2px; border: 1px solid var(--line-strong); border-radius: var(--r-chip); background: #fff; }
  .chips i { border-radius: 3px; box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.12); }
  .who { display: grid; gap: 2px; min-width: 0; }
  .nm { font-size: 14px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { justify-self: start; font-size: 11.5px; font-weight: 600; color: var(--accent-ink); }
  .acts { grid-column: 1 / -1; display: flex; align-items: center; gap: 4px; }
  .acts.ask { gap: 6px; }
  .q { margin-right: auto; font-size: 12.5px; color: var(--ink-2); }
  .apply { margin-right: auto; }

  .icon { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid transparent; background: transparent; border-radius: var(--r-chip); color: var(--ink-2); transition: background-color 120ms ease, color 120ms ease; }
  .icon:hover { background: var(--panel-2); color: var(--ink); }
  .icon[aria-pressed='true'] { color: var(--accent-ink); }
  @media (pointer: coarse) { .icon { width: 44px; height: 44px; } }

  /* nothing saved yet: plain words, no box */
  .empty { padding: 0; border: 0; }
  .import { justify-self: start; cursor: pointer; }
</style>
