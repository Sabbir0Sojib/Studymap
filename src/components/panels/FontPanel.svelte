<script lang="ts">
  // The figure's font: free look-alikes of the fonts journals ask for, or the user's own font files.
  import { tick } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { BUILTIN_FONTS, DEFAULT_FONT, addFontFiles, ensureFont, fonts, fontStack, journalFamily, removeFont } from '../../lib/fonts.svelte';
  import { findPreset } from '../../lib/journals';
  import { setAllText } from '../../lib/actions';
  import X from 'phosphor-svelte/lib/X';
  import { t } from '../../lib/i18n.svelte';

  const preset = $derived(findPreset(store.doc.presetId));
  const current = $derived(store.doc.font || DEFAULT_FONT);
  const accepted = (family: string) => !!preset.fonts?.includes(journalFamily(family));
  const STYLE_NAMES: Record<string, string> = { normal: 'regular', bold: 'bold', italic: 'italic', bolditalic: 'bold italic' };

  // Radio pattern: only the chosen font is in the tab order (the first if none is); arrows move and select, Home and End jump.
  const families = $derived([...BUILTIN_FONTS.map((f) => f.family), ...fonts.custom.map((f) => f.family)]);
  const stop = $derived(families.includes(current) ? current : families[0]);
  function radioKey(e: KeyboardEvent) {
    const cur = e.currentTarget as HTMLElement;
    const radios = Array.from(cur.closest('[role="radiogroup"]')!.querySelectorAll<HTMLElement>('[role="radio"]'));
    const i = radios.indexOf(cur);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % radios.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + radios.length) % radios.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = radios.length - 1;
    if (n < 0) return;
    e.preventDefault();
    radios[n].focus();
    radios[n].click();
  }
  function choose(family: string) {
    store.doc.font = family;
    ensureFont(family);
    store.commit();
  }
  let adding = $state(false);
  async function pick(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length) return;
    adding = true;
    try {
      const r = await addFontFiles(files);
      store.status = r.message;
      if (r.families.length) choose(r.families[0]);
    } finally { adding = false; }
  }

  // Removing your own font takes two steps, in place: the first click swaps the x for Delete / Keep.
  let asking = $state<string | null>(null);
  const crosses: Record<string, HTMLElement> = {};
  function track(node: HTMLElement, family: string) {
    crosses[family] = node;
    return { destroy() { if (crosses[family] === node) delete crosses[family]; } };
  }
  function focusNow(node: HTMLElement) { node.focus(); }
  async function keep(family: string) {
    asking = null;
    await tick();
    crosses[family]?.focus();
  }
  async function remove(family: string) {
    asking = null;
    if (store.doc.font === family) store.doc.font = DEFAULT_FONT;
    for (const it of store.doc.items) if (it.kind === 'title' && it.font === family) it.font = undefined;
    removeFont(family);
    store.commit();
    store.status = t('Removed {family} from this browser. Text that used it is back in {font}.', { family, font: BUILTIN_FONTS[0].like });
    await tick();
    document.querySelector<HTMLElement>('.fontpanel [role="radio"][tabindex="0"]')?.focus();
  }
  function askKey(e: KeyboardEvent, family: string) {
    if (e.key === 'Escape') { e.stopPropagation(); keep(family); }
  }
</script>

<div class="fontpanel stack">
  <section>
    <h3 class="group-title sr-only">{t('Font')}</h3>
    <div class="list" role="radiogroup" aria-label={t('Font for all text on the map')}>
      {#each BUILTIN_FONTS as f (f.family)}
        <button class="font" role="radio" aria-checked={current === f.family} tabindex={stop === f.family ? 0 : -1} onkeydown={radioKey} onclick={() => choose(f.family)}>
          <span class="sample" style="font-family:{fontStack(f.family)}">{f.like}</span>
          <span class="meta">{f.family}{#if accepted(f.family)}<span class="ok">{` · ${t('{publisher} accepts', { publisher: preset.publisher })}`}</span>{/if}</span>
        </button>
      {/each}
      {#each fonts.custom as f (f.family)}
        <div class="font custom" class:on={current === f.family}>
          <button class="pickcustom" role="radio" aria-checked={current === f.family} tabindex={stop === f.family ? 0 : -1} onkeydown={radioKey} onclick={() => choose(f.family)}>
            <span class="sample" style="font-family:{fontStack(f.family)}">{f.family}</span>
            <span class="meta">
              {#if asking === f.family}{t('Text that uses it goes back to {font}.', { font: BUILTIN_FONTS[0].like })}
              {:else}{t('Your font')} · {f.styles.map((s) => t(STYLE_NAMES[s])).join(', ')}{#if accepted(f.family)}<span class="ok">{` · ${t('{publisher} accepts', { publisher: preset.publisher })}`}</span>{/if}{/if}
            </span>
          </button>
          {#if asking === f.family}
            <span class="ask" role="group" aria-label={t('Remove {family} from this browser?', { family: f.family })}>
              <button class="btn small danger" aria-label={t('Delete {family}', { family: f.family })} onkeydown={(e) => askKey(e, f.family)} onclick={() => remove(f.family)}>{t('Delete')}</button>
              <button class="btn small ghost" aria-label={t('Keep {family}', { family: f.family })} use:focusNow onkeydown={(e) => askKey(e, f.family)} onclick={() => keep(f.family)}>{t('Keep')}</button>
            </span>
          {:else}
            <button class="x" use:track={f.family} onclick={() => (asking = f.family)} aria-label={t('Remove {family}', { family: f.family })} title={t('Remove from this browser')}><X size={14} /></button>
          {/if}
        </div>
      {/each}
    </div>
    <p class="hint">{t('Free look-alikes of journal fonts, embedded in your PDF.')}</p>
    <label class="btn small add" aria-busy={adding}>
      {adding ? t('Reading the font…') : t('Add your own font (.ttf)…')}
      <input type="file" accept=".ttf,.otf,font/ttf,font/otf,font/sfnt" multiple class="sr-only" onchange={pick} disabled={adding} />
    </label>
    <details class="acc quiet">
      <summary>{t('About these fonts')}</summary>
      <div class="acc-body">
        <p class="hint">{t('Used for every label, the legend, scale bar and grid; a text can have its own font in its settings.')}</p>
        <p class="hint">{t('The first five have the same letter widths as the fonts journals name, so a figure fits the same space.')}</p>
        <p class="hint">{t('For your own font, choose its regular, bold and italic files together. It stays in this browser and inside saved projects.')}</p>
      </div>
    </details>
  </section>

  <section class="alltext" role="group" aria-labelledby="alltext-label">
    <span class="label" id="alltext-label">{t('Set all text to')}</span>
    <div class="three">
      <button class="btn small" onclick={() => setAllText('regular')}>{t('Regular')}</button>
      <button class="btn small" onclick={() => setAllText('bold')}><b>{t('Bold')}</b></button>
      <button class="btn small" onclick={() => setAllText('italic')}><i>{t('Italic')}</i></button>
    </div>
  </section>
</div>

<style>
  /* the font list is ruled rows, not cards; the chosen one is washed and ringed */
  .list { display: grid; gap: 0; border-top: 1px solid var(--line); }
  .font { display: grid; gap: 1px; text-align: left; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; padding: 9px 4px; color: var(--ink); transition: background-color 120ms ease; }
  .font:hover { background: var(--panel-2); }
  .font[aria-checked='true'], .font.custom.on {
    background: var(--accent-wash); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--ink);
    border-radius: var(--r-ctl); border-bottom-color: transparent; background-clip: padding-box;
  }
  .sample { font-size: 16px; line-height: 1.3; }
  .meta { font-size: 11.5px; color: var(--ink-3); }
  .ok { color: var(--ok); }
  .font.custom { grid-template-columns: minmax(0, 1fr) auto; align-items: center; padding: 0; }
  .pickcustom { display: grid; gap: 1px; text-align: left; border: 0; background: transparent; padding: 9px 4px; color: inherit; border-radius: inherit; min-width: 0; }
  .pickcustom .sample { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { width: 32px; height: 32px; display: grid; place-items: center; border: 0; background: transparent; color: var(--ink-2); border-radius: var(--r-ctl); margin-right: 4px; }
  .x:hover { background: var(--panel-2); color: var(--ink); }
  .ask { display: flex; align-items: center; gap: 4px; padding-right: 6px; }
  @media (pointer: coarse) { .x { width: 44px; height: 44px; } }
  .add { justify-self: start; }
  .three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .three b { font-weight: 600; }
</style>
