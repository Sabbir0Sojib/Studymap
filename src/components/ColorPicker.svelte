<script lang="ts">
  // A colour button that opens a small popover: colour-blind safe, map and soft swatches, recent colours,
  // a hex box, the system colour picker and (where the browser has one) an eyedropper.
  import { untrack } from 'svelte';
  import Check from 'phosphor-svelte/lib/Check';
  import Eyedropper from 'phosphor-svelte/lib/Eyedropper';
  import { t } from '../lib/i18n.svelte';
  import { PALETTES, colourName, luminance, normalizeHex, pushRecent, recentColours } from '../lib/palettes';
  import type { Palette } from '../lib/palettes';

  interface Props {
    /** the colour as '#RRGGBB', or 'none' when allowNone is on */
    value: string;
    /** told the colour that was picked: uppercase '#RRGGBB', or 'none' */
    onchange: (hex: string) => void;
    /** what the colour is for, e.g. 'Text colour' (screen readers read it with the colour) */
    label: string;
    allowNone?: boolean;
    noneLabel?: string;
    /** width and height of the button in px (never under 24, the smallest comfortable tap target) */
    size?: number;
  }
  let { value, onchange, label, allowNone = false, noneLabel = 'None', size = 30 }: Props = $props();
  const uid = $props.id();

  const COLS = 8; // swatches per line; the popover is sized for exactly this
  const GAP = 8; // space between the button and the popover
  const EDGE = 12; // the popover never gets closer than this to the window edge

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let pop = $state<HTMLDivElement>();
  let recent = $state<string[]>([]);
  let draft = $state(''); // what is typed in the hex box
  let bad = $state(false); // the hex box holds something that is not a colour
  let stop = $state(''); // the one swatch that Tab lands on; the arrow keys move between the others
  let nativeStart = $state('#ffffff'); // the colour the system picker starts from

  const none = $derived(value === 'none');
  const current = $derived(none ? 'none' : (normalizeHex(value) ?? ''));
  const px = $derived(Math.max(24, size));
  const pale = $derived(!none && current !== '' && luminance(current) > 0.6);
  const canDrop = typeof window !== 'undefined' && 'EyeDropper' in window;
  const rows = $derived<Palette[]>(
    recent.length ? [...PALETTES, { name: 'Recent', colours: recent.map((hex) => ({ hex, name: colourName(hex) })) }] : PALETTES,
  );

  // ---- opening and closing ----
  function show() {
    recent = recentColours();
    draft = none ? '' : current;
    bad = false;
    nativeStart = current && !none ? current.toLowerCase() : '#ffffff';
    stop = startId();
    open = true;
  }
  function close(refocus: boolean) {
    open = false;
    if (refocus) trigger?.focus({ preventScroll: true });
  }
  function toggle() {
    if (open) close(true);
    else show();
  }
  /** The swatch that starts with focus: the one showing the current colour, else the first. */
  function startId(): string {
    if (none && allowNone) return 'none';
    for (let r = 0; r < rows.length; r++) {
      const i = rows[r].colours.findIndex((c) => c.hex === current);
      if (i >= 0) return `${r}.${i}`;
    }
    return '0.0';
  }

  // ---- picking ----
  /** A final pick: tell the caller, remember the colour (not 'none') and close. */
  function choose(hex: string, tell = true) {
    if (tell) onchange(hex);
    pushRecent(hex);
    close(true);
  }
  /** The hex box: on Enter (final) it picks the colour; when it loses focus the colour is applied and the popover stays. */
  function typed(final: boolean) {
    const text = draft.trim();
    if (!text) {
      draft = none ? '' : current;
      bad = false;
      return;
    }
    const hex = normalizeHex(text);
    if (!hex) {
      bad = true;
      return;
    }
    bad = false;
    draft = hex;
    if (final) choose(hex);
    else if (hex !== current) {
      onchange(hex);
      pushRecent(hex);
    }
  }
  // the system colour picker: shown live while it is dragged, picked when it is closed
  function dragging(e: Event) {
    const hex = normalizeHex((e.currentTarget as HTMLInputElement).value);
    if (hex) onchange(hex);
  }
  function picked(e: Event) {
    const hex = normalizeHex((e.currentTarget as HTMLInputElement).value);
    if (hex) choose(hex, hex !== current);
  }
  async function dropper() {
    try {
      const r = await new (window as any).EyeDropper().open();
      const hex = normalizeHex(r?.sRGBHex);
      if (hex && open) choose(hex);
    } catch {
      /* closed with Esc (AbortError) or not allowed just now: nothing to pick */
    }
  }

  // ---- keyboard ----
  /** The swatches as they sit on screen, line by line: the arrow keys move along these lines. */
  function lines(): string[][] {
    const out: string[][] = [];
    rows.forEach((row, r) => {
      for (let i = 0; i < row.colours.length; i += COLS) out.push(row.colours.slice(i, i + COLS).map((_, k) => `${r}.${i + k}`));
    });
    if (allowNone) out.push(['none']);
    return out;
  }
  function onPopKey(e: KeyboardEvent) {
    const node = pop;
    if (!node) return;
    if (e.key === 'Tab') {
      // leaving the popover with Tab closes it and puts focus back on the button
      const stops = [...node.querySelectorAll<HTMLElement>('button, input')].filter((el) => el.tabIndex >= 0);
      const at = document.activeElement;
      if (e.shiftKey ? at === stops[0] || at === node : at === stops[stops.length - 1]) {
        e.preventDefault();
        close(true);
      }
      return;
    }
    // Delete must not reach the editor's shortcuts: it would remove the selected part of the map
    if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement)) {
      e.stopPropagation();
      return;
    }
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-id]')?.dataset.id;
    if (!id) return;
    const ls = lines();
    const li = ls.findIndex((l) => l.includes(id));
    if (li < 0) return;
    const col = ls[li].indexOf(id);
    const flat = ls.flat();
    let to: string | undefined;
    if (e.key === 'ArrowRight') to = flat[flat.indexOf(id) + 1];
    else if (e.key === 'ArrowLeft') to = flat[flat.indexOf(id) - 1];
    else if (e.key === 'ArrowDown') to = ls[li + 1]?.[Math.min(col, ls[li + 1].length - 1)];
    else if (e.key === 'ArrowUp') to = ls[li - 1]?.[Math.min(col, ls[li - 1].length - 1)];
    else if (e.key === 'Home') to = ls[li][0];
    else if (e.key === 'End') to = ls[li][ls[li].length - 1];
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (to) node.querySelector<HTMLElement>(`[data-id="${to}"]`)?.focus();
  }
  function onEsc(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation(); // the editor must not also deselect the part being edited
    close(true);
  }
  function onOutside(e: PointerEvent) {
    const t = e.target as Node;
    // the button toggles itself, and so does a <label> around it (its click is passed on to the button)
    if (pop?.contains(t) || trigger?.contains(t) || trigger?.closest('label')?.contains(t)) return;
    typed(false); // a colour typed but not confirmed still counts when you click away
    close(true);
  }

  // ---- placement: fixed to the window, under the button or above it, always inside the window ----
  function place() {
    const node = pop;
    const btn = trigger;
    if (!node || !btn) return;
    const r = btn.getBoundingClientRect();
    if (!r.width && !r.height) return close(false); // the button is no longer shown
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = node.offsetWidth;
    const want = node.scrollHeight; // the height it would like to have
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const up = want > below && above > below;
    const room = Math.min(Math.max(up ? above : below, 120), vh - 2 * EDGE);
    const h = Math.min(want, room);
    let left = r.left + w > vw - EDGE ? r.right - w : r.left; // too far right: line up with the button's right edge
    left = Math.min(Math.max(left, EDGE), Math.max(EDGE, vw - w - EDGE));
    const top = Math.min(Math.max(up ? r.top - GAP - h : r.bottom + GAP, EDGE), vh - EDGE - h);
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
    node.style.maxHeight = want > room ? `${room}px` : ''; // a short window: the popover scrolls inside
    node.dataset.side = up ? 'up' : 'down';
  }
  /** Is the button still on screen? Its panel may have scrolled it out of sight. */
  function seen(r: DOMRect): boolean {
    const inside = (c: DOMRect) => r.bottom > c.top && r.top < c.bottom && r.right > c.left && r.left < c.right;
    if (!inside(new DOMRect(0, 0, window.innerWidth, window.innerHeight))) return false;
    for (let el = trigger?.parentElement; el && el !== document.body; el = el.parentElement) {
      const s = getComputedStyle(el);
      if ((s.overflowX !== 'visible' || s.overflowY !== 'visible') && !inside(el.getBoundingClientRect())) return false;
    }
    return true;
  }
  function onScroll(e: Event) {
    if (pop?.contains(e.target as Node)) return; // the popover's own scrolling
    if (trigger && seen(trigger.getBoundingClientRect())) place();
    else close(false);
  }

  /** While open: move the popover to <body> (so no panel can clip or cover it), place it, listen, and focus a swatch. */
  function attach(node: HTMLDivElement) {
    (trigger?.closest('dialog') ?? document.body).appendChild(node);
    const watch = new ResizeObserver(place);
    watch.observe(node);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onEsc, true);
    node.addEventListener('keydown', onPopKey);
    place();
    (node.querySelector<HTMLElement>(`[data-id="${stop}"]`) ?? node).focus();
    return () => {
      watch.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onEsc, true);
      node.removeEventListener('keydown', onPopKey);
      node.remove(); // it lives outside the component now: if the whole picker goes away while open, Svelte would leave it behind
    };
  }
  $effect(() => {
    if (!open || !pop) return;
    const node = pop;
    return untrack(() => attach(node));
  });

  // the hex box follows the colour (a swatch, the system picker, undo...) unless it is being typed in
  $effect(() => {
    draft = current === 'none' ? '' : current;
    bad = false;
  });
  // e.g. "Fill colour: Vermilion (#D55E00)"; a colour with no name keeps just its code
  const triggerName = $derived.by(() => { const n = colourName(value); return n ? `${label}: ${t(n)} (${value})` : `${label}: ${value}`; });
</script>

<button
  type="button"
  class="trigger"
  bind:this={trigger}
  style:--s="{px}px"
  aria-label={triggerName}
  aria-haspopup="dialog"
  aria-expanded={open}
  aria-controls={open ? `${uid}-pop` : undefined}
  onclick={toggle}
>
  <span class="chip" class:cb={none} class:pale style:background-color={none ? undefined : current || value}></span>
</button>

{#if open}
  <div class="pop" id="{uid}-pop" role="dialog" aria-label={label} tabindex="-1" bind:this={pop}>
    {#each rows as row, r (row.name)}
      <div class="group" role="group" aria-labelledby="{uid}-h{r}">
        <div class="gh" id="{uid}-h{r}">{t(row.name)}</div>
        <div class="grid">
          {#each row.colours as c, i (i)}
            {@const id = `${r}.${i}`}
            {@const sel = c.hex === current}
            {@const lum = luminance(c.hex)}
            <button
              type="button"
              class="sw"
              class:light={lum > 0.6}
              class:sel
              data-id={id}
              style:background-color={c.hex}
              aria-label={c.name ? t(c.name) : c.hex}
              aria-pressed={sel}
              title={c.name ? t(c.name) : c.hex}
              tabindex={stop === id ? 0 : -1}
              onfocus={() => (stop = id)}
              onclick={() => choose(c.hex)}
            >{#if sel}<Check size={14} weight="bold" color={lum > 0.25 ? '#17191c' : '#ffffff'} aria-hidden="true" />{/if}</button>
          {/each}
        </div>
      </div>
    {/each}

    <div class="custom">
      <input
        class="input hex"
        type="text"
        bind:value={draft}
        maxlength="9"
        placeholder="#RRGGBB"
        autocomplete="off"
        autocapitalize="off"
        spellcheck={false}
        aria-label={t('Hex colour code')}
        aria-invalid={bad}
        aria-describedby={bad ? `${uid}-err` : undefined}
        oninput={() => (bad = false)}
        onfocus={(e) => e.currentTarget.select()}
        onblur={() => open && typed(false)}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            typed(true);
          }
        }}
      />
      <label class="btn small more" title={t('Pick any colour')}>
        {t('More…')}
        <input type="color" class="sr-only" value={nativeStart} aria-label={t('More colours')} oninput={dragging} onchange={picked} />
      </label>
      {#if canDrop}
        <button type="button" class="btn small drop" aria-label={t('Pick a colour from the screen')} title={t('Pick a colour from the screen')} onclick={dropper}>
          <Eyedropper size={18} aria-hidden="true" />
        </button>
      {/if}
    </div>
    {#if bad}<p class="err" id="{uid}-err" role="alert">{t('Use a hex code like #D55E00.')}</p>{/if}

    {#if allowNone}
      <button
        type="button"
        class="none"
        data-id="none"
        aria-pressed={none}
        tabindex={stop === 'none' ? 0 : -1}
        onfocus={() => (stop = 'none')}
        onclick={() => choose('none')}
      >
        <span class="nsw cb" aria-hidden="true"></span>
        {t(noneLabel)}
        {#if none}<span class="tick"><Check size={14} weight="bold" aria-hidden="true" /></span>{/if}
      </button>
    {/if}
  </div>
{/if}

<style>
  /* the button */
  .trigger {
    position: relative; flex: none;
    display: inline-block; vertical-align: middle;
    width: var(--s); height: var(--s);
    padding: 0; border: 0; border-radius: var(--r-chip);
    background: transparent;
    touch-action: manipulation;
    forced-color-adjust: none;
  }
  .chip {
    position: absolute; inset: 0; overflow: hidden;
    border-radius: inherit;
    box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.18);
    transition: box-shadow 120ms ease;
  }
  .chip.pale { box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.28); }
  .trigger:hover .chip { box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.4), 0 0 0 3px rgb(43 45 47 / 0.08); }
  .trigger[aria-expanded='true'] .chip { box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.4), 0 0 0 3px var(--accent-ring); }

  /* "none": a checkerboard with a grey slash through it (red is kept for errors) */
  .cb { background: repeating-conic-gradient(#d9dcda 0 25%, #fff 0 50%) 0 0 / 8px 8px; }
  .cb::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(to bottom right, transparent calc(50% - 0.75px), var(--ink-3) calc(50% - 0.75px), var(--ink-3) calc(50% + 0.75px), transparent calc(50% + 0.75px));
  }

  /* the popover */
  .pop {
    --sw: 22px;
    position: fixed; left: 0; top: 0; z-index: 1000;
    width: min(244px, calc(100vw - 24px));
    max-height: calc(100dvh - 24px);
    overflow-y: auto; overscroll-behavior: contain;
    display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px;
    padding: 12px;
    background: var(--panel); color: var(--ink);
    border-radius: var(--r-panel);
    box-shadow: var(--shadow-2), 0 0 0 1px var(--line);
    font-size: 14px; line-height: 1.45;
    outline: none;
    transform-origin: 20px 0;
    animation: pop-in 120ms var(--ease);
  }
  .pop:global([data-side='up']) { transform-origin: 20px 100%; --dy: 4px; }
  @keyframes pop-in { from { opacity: 0; transform: translateY(var(--dy, -4px)) scale(0.98); } }
  @media (prefers-reduced-motion: reduce) { .pop { animation: none; } }
  /* touch screens get bigger swatches and a wider popover (the same eight to a line) */
  @media (pointer: coarse) { .pop { --sw: 24px; width: min(258px, calc(100vw - 24px)); } }

  .pop > * { min-width: 0; } /* a wide row must shrink, not push the popover wider */
  .group { display: grid; gap: 5px; }
  .gh { font-size: 11.5px; font-weight: 600; line-height: 1.2; color: var(--ink-3); }
  .grid { display: grid; grid-template-columns: repeat(8, minmax(0, var(--sw))); justify-content: space-between; row-gap: 6px; }

  .sw {
    position: relative; display: grid; place-items: center;
    width: 100%; aspect-ratio: 1; padding: 0;
    border: 0; border-radius: var(--r-chip);
    box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.16);
    transition: transform 100ms var(--ease), box-shadow 120ms ease;
    touch-action: manipulation;
    forced-color-adjust: none;
  }
  .sw.light { box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.3); }
  .sw:hover { transform: scale(1.12); }
  .sw:active { transform: scale(0.96); }
  .sw.sel { box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.16), 0 0 0 1.5px var(--panel), 0 0 0 3.5px var(--ink); }

  /* hex box, system picker and eyedropper */
  .custom { display: flex; align-items: center; gap: 6px; padding-top: 12px; border-top: 1px solid var(--line); }
  .hex {
    flex: 1; min-width: 0; width: auto; min-height: 32px; padding: 3px 8px;
    font-size: 12.5px; font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace; letter-spacing: 0.02em; text-transform: uppercase;
  }
  .hex[aria-invalid='true'] { border-color: var(--err); }
  .hex[aria-invalid='true']:focus-visible { border-color: var(--err); box-shadow: 0 0 0 3px rgb(180 35 24 / 0.2); }
  .more, .drop { flex: none; min-height: 32px; }
  .more { position: relative; padding: 3px 10px; }
  .more:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
  .drop { width: 32px; padding: 0; }
  .err { margin: -6px 0 0; font-size: 11.5px; line-height: 1.35; color: var(--err); }

  /* "None" */
  .none {
    display: flex; align-items: center; gap: 8px;
    width: 100%; min-height: 32px; padding: 3px 8px 3px 5px;
    border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel);
    font-size: 12.5px; font-weight: 500; text-align: left; color: var(--ink);
  }
  .none:hover { background: var(--panel-2); border-color: var(--line-strong); }
  .none[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
  .nsw { position: relative; flex: none; width: 22px; height: 22px; overflow: hidden; border-radius: var(--r-chip); box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.2); }
  .tick { margin-left: auto; display: grid; }
</style>
