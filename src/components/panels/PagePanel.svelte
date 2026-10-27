<script lang="ts">
  // Page (canvas) size and colour. Every side can be extended or shrunk; parts keep their place on the paper,
  // and anything a smaller page would cut off is moved back onto it. The page edges can also be dragged.
  import { store } from '../../lib/store.svelte';
  import { applyTemplate } from '../../lib/templates';
  import { PRESETS } from '../../lib/journals';
  import { setJournal, resizePage, keepOnPage, trimPage, PAGE_MIN, PAGE_MAX } from '../../lib/actions';
  import type { PageSide } from '../../lib/actions';
  import ColorPicker from '../ColorPicker.svelte';
  import { t, i18n } from '../../lib/i18n.svelte';
  import Minus from 'phosphor-svelte/lib/Minus';
  import Plus from 'phosphor-svelte/lib/Plus';
  // the small page drawing keeps the real proportions, fitted in 150 x 100 px
  const paperBox = $derived.by(() => { const s = Math.min(150 / store.doc.widthMm, 100 / store.doc.heightMm); return [Math.round(store.doc.widthMm * s), Math.round(store.doc.heightMm * s)]; });
  const publishers = [...new Set(PRESETS.map((p) => p.publisher))];
  // "Single column" reads "single column" after the publisher in English; Bangla has no capitals
  const lcLabel = (l: string) => (i18n.lang === 'bn' ? t(l) : l.toLowerCase());

  let step = $state(10);
  function done(changed: number) {
    if (!changed) return;
    const moved = keepOnPage();
    const now = t('Page is now {w} × {h} mm.', { w: store.doc.widthMm, h: store.doc.heightMm });
    store.status = moved ? `${now} ${moved === 1 ? t('One part was moved back onto the page.') : t('{n} parts were moved back onto the page.', { n: moved })}` : now;
    store.commit();
  }
  // a side already at its limit does nothing: say so instead of staying silent
  function side(s: PageSide, d: number) {
    const changed = resizePage(s, d);
    if (!changed) { store.status = d < 0 ? t('The page is already as small as it can be ({min} / {max} mm).', { min: PAGE_MIN, max: PAGE_MAX }) : t('The page is already as large as it can be ({min} / {max} mm).', { min: PAGE_MIN, max: PAGE_MAX }); return; }
    done(changed);
  }
  const atLimit = (s: PageSide, d: number) => {
    const cur = s === 'left' || s === 'right' ? store.doc.widthMm : store.doc.heightMm;
    return d < 0 ? cur <= PAGE_MIN : cur >= PAGE_MAX;
  };
  function setSize(w: number, h: number) {
    let c = resizePage('right', w - store.doc.widthMm);
    c += resizePage('bottom', h - store.doc.heightMm);
    done(c);
  }
  function rearrange() {
    applyTemplate(store.doc, store.doc.templateId, true);
    store.commit();
    store.status = t('Layout arranged to fill the page.');
  }
  function trim() {
    trimPage(3);
    store.status = t('Page trimmed to {w} × {h} mm.', { w: store.doc.widthMm, h: store.doc.heightMm });
  }
  // A typed width or height is rounded and kept within the limits; say so when it had to be changed.
  function setDim(which: 'w' | 'h', input: HTMLInputElement) {
    const d = store.doc;
    const raw = Math.round(Number(input.value));
    if (!input.value.trim() || !Number.isFinite(raw)) { input.value = String(which === 'w' ? d.widthMm : d.heightMm); return; }
    const v = Math.min(PAGE_MAX, Math.max(PAGE_MIN, raw));
    const [w0, h0] = [d.widthMm, d.heightMm];
    if (which === 'w') setSize(v, h0); else setSize(w0, v);
    input.value = String(which === 'w' ? d.widthMm : d.heightMm);
    if (v !== raw) {
      const vars = { min: PAGE_MIN, max: PAGE_MAX, v };
      const note = which === 'w' ? t('Width can be {min} to {max} mm, so it is set to {v} mm.', vars) : t('Height can be {min} to {max} mm, so it is set to {v} mm.', vars);
      store.status = d.widthMm !== w0 || d.heightMm !== h0 ? `${note} ${store.status}` : note;
    }
  }
  // Radio pattern for the page colour buttons: arrows move and select, Home and End jump, only one is in the tab order.
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
  const SIDES: [PageSide, string][] = [['left', 'Left'], ['right', 'Right'], ['top', 'Top'], ['bottom', 'Bottom']];
  const colour = $derived(store.doc.pageColor ?? '#ffffff');
  function setColour(c: string) { store.doc.pageColor = c === '#ffffff' ? undefined : c; store.commit(); }
</script>

<div class="stack">
  <section>
    <h3 class="group-title">{t('Size')}</h3>
    <label class="field"><span>{t('Journal')}</span>
      <select class="input" value={store.doc.presetId} onchange={(e) => setJournal((e.target as HTMLSelectElement).value)} aria-label={t('Journal size')}>
        {#each publishers as pub}
          <optgroup label={pub}>
            {#each PRESETS.filter((p) => p.publisher === pub) as p}<option value={p.id}>{p.publisher}, {lcLabel(p.label)} ({p.widthMm} mm)</option>{/each}
          </optgroup>
        {/each}
        <option value="custom">{t('Custom size')}</option>
      </select>
    </label>
    <div class="wh">
      <label class="field"><span>{t('Width (mm)')}</span>
        <input class="input" type="number" inputmode="numeric" min={PAGE_MIN} max={PAGE_MAX} value={store.doc.widthMm} aria-describedby="size-hint" onchange={(e) => setDim('w', e.target as HTMLInputElement)} />
      </label>
      <label class="field"><span>{t('Height (mm)')}</span>
        <input class="input" type="number" inputmode="numeric" min={PAGE_MIN} max={PAGE_MAX} value={store.doc.heightMm} aria-describedby="size-hint" onchange={(e) => setDim('h', e.target as HTMLInputElement)} />
      </label>
    </div>
    <span class="sr-only" id="size-hint">{t('Width and height can each be {min} to {max} mm.', { min: PAGE_MIN, max: PAGE_MAX })}</span>

    <div class="actions">
      <button class="btn small" onclick={trim} aria-label={t('Trim page to its contents')} title={t('Shrink the page to fit everything on it, with a small even margin')}>{t('Trim to contents')}</button>
      <button class="btn small" onclick={rearrange} aria-label={t('Arrange the layout to fill the page')} title={t('Re-arrange the chosen layout so it fills the page at its current size')}>{t('Fill the page')}</button>
    </div>

    <!-- the page drawn small, with a minus and a plus on each of its edges: you change the side you can see -->
    <details class="acc quiet">
      <summary>{t('Fine-tune one side')}</summary>
      <div class="acc-body">
        <div class="sides" role="group" aria-label={t('Grow or shrink one side')}>
          <label class="stephead"><span>{t('Amount per click')}</span>
            <select class="input stepsel" bind:value={step}>
              <option value={1}>1 mm</option><option value={5}>5 mm</option><option value={10}>10 mm</option><option value={25}>25 mm</option>
            </select>
          </label>
          <div class="pagebox">
            {#each SIDES as [s, label]}
              <div class="pmz {s}">
                <button class="pmb" aria-disabled={atLimit(s, -1)} onclick={() => side(s, -step)} aria-label={t('Shrink {side} side by {step} mm', { side: t(label.toLowerCase()), step })} title={t('{side}: {step} mm less', { side: t(label), step })}><Minus size={14} weight="bold" /></button>
                <button class="pmb" aria-disabled={atLimit(s, 1)} onclick={() => side(s, step)} aria-label={t('Extend {side} side by {step} mm', { side: t(label.toLowerCase()), step })} title={t('{side}: {step} mm more', { side: t(label), step })}><Plus size={14} weight="bold" /></button>
              </div>
            {/each}
            <div class="paper" style="width:{paperBox[0]}px;height:{paperBox[1]}px" aria-hidden="true"><span>{store.doc.widthMm}&nbsp;×&nbsp;{store.doc.heightMm}&nbsp;mm</span></div>
          </div>
        </div>
      </div>
    </details>
  </section>

  <section>
    <h3 class="group-title">{t('Colour')}</h3>
    <div class="colours">
      <div class="rg" role="radiogroup" aria-label={t('Page colour')}>
        <button class="pc" role="radio" aria-checked={colour === '#ffffff'} tabindex={colour === 'none' ? -1 : 0} onkeydown={radioKey} onclick={() => setColour('#ffffff')}><i style="background:#fff"></i>{t('White')}</button>
        <button class="pc" role="radio" aria-checked={colour === 'none'} tabindex={colour === 'none' ? 0 : -1} onkeydown={radioKey} onclick={() => setColour('none')} title={t('None makes PNG and SVG files see-through (TIFF stays white)')}><i class="clear"></i>{t('None')}</button>
      </div>
      <!-- a label, so a click anywhere on the pill (not only on the swatch) opens the picker -->
      <label class="pc" class:on={colour !== '#ffffff' && colour !== 'none'}>
        <ColorPicker value={colour !== 'none' ? colour : '#FFFFFF'} label={t('Choose a page colour')} size={20} onchange={(v) => setColour(v.toLowerCase() === '#ffffff' ? '#ffffff' : v)} />{t('Colour')}
      </label>
    </div>
  </section>
</div>

<style>
  .wh { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sides { display: grid; gap: 8px; }
  .stephead { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
  .stepsel { width: auto; flex: none; min-height: 30px; padding: 2px 34px 2px 8px; font-size: 12.5px; }
  /* the page in the middle, one minus/plus pair on each edge */
  .pagebox {
    display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); grid-template-rows: auto auto auto;
    grid-template-areas: '. top .' 'left paper right' '. bottom .';
    align-items: center; justify-items: center; gap: 6px; padding: 8px 4px;
  }
  .pmz { display: inline-flex; border: 1px solid var(--line-strong); border-radius: var(--r-ctl); background: var(--panel); overflow: hidden; }
  .pmz.top { grid-area: top; } .pmz.bottom { grid-area: bottom; }
  .pmz.left { grid-area: left; flex-direction: column; justify-self: end; } .pmz.right { grid-area: right; flex-direction: column; justify-self: start; }
  .pmb { width: 30px; height: 28px; display: grid; place-items: center; border: 0; background: transparent; color: var(--ink-2); transition: background-color 120ms ease, color 120ms ease; }
  .pmb + .pmb { border-left: 1px solid var(--line); }
  .pmz.left .pmb + .pmb, .pmz.right .pmb + .pmb { border-left: 0; border-top: 1px solid var(--line); }
  .pmb:hover:not([aria-disabled='true']) { background: var(--accent-wash); color: var(--accent-ink); }
  .pmb:active:not([aria-disabled='true']) { transform: scale(0.95); }
  .pmb:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .pmb[aria-disabled='true'] { opacity: .4; cursor: not-allowed; }
  .paper {
    grid-area: paper; min-width: 64px; min-height: 44px;
    display: grid; place-items: center; background: var(--panel);
    border: 1px solid var(--line-strong); border-radius: 2px; box-shadow: var(--shadow-1);
    font-size: 12.5px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums;
  }
  @media (pointer: coarse) { .pmb { width: 44px; height: 44px; } }
  /* the two actions share one style and one row */
  .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .actions .btn { white-space: nowrap; }
  /* page colour: White and None are a radio group; Colour (the picker) sits beside it in the same row */
  .colours { display: flex; flex-wrap: wrap; gap: 6px; }
  .rg { display: flex; flex-wrap: wrap; gap: 6px; }
  .pc { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 10px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel); color: var(--ink); font-size: 12.5px; cursor: pointer; }
  .pc:hover { border-color: var(--line-strong); }
  /* chosen: washed and ringed, the ring standing in for the hairline */
  .pc[aria-checked='true'], .pc.on { background: var(--accent-wash); border-color: transparent; box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--ink); }
  label.pc:has(:global(:focus-visible)) { outline: 2px solid var(--accent); outline-offset: 2px; }
  label.pc :global(.trigger:focus-visible) { outline: none; }
  .pc i { width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--line-strong); }
  .pc i.clear { background: repeating-conic-gradient(#d9dcda 0 25%, #fff 0 50%) 0 0 / 8px 8px; }
  @media (pointer: coarse) { .pc { min-height: 44px; } }
</style>
