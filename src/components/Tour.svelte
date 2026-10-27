<script lang="ts">
  // A short tour on the first visit: five steps, each pointing at the place on screen it is about, with the option of
  // opening a finished example map instead. It never comes back once closed (kept in this browser).
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { t } from '../lib/i18n.svelte';

  const KEY = 'studymap.toured';
  const STEPS = [
    { at: 'input[aria-label="Search for a place"], input[role="combobox"]', title: 'Start with your study area', text: 'Type a district, upazila, park or city. Official boundaries come first. You can also draw the area or open your own file.' },
    { at: '.rail button:nth-of-type(2)', title: 'Design', text: 'Pick a layout (classic, drill-down, side by side…), a map style and the journal page size.' },
    { at: '.rail button:nth-of-type(3)', title: 'Map parts', text: 'Legend, scale bar, north arrow, inset maps, text, arrows, your sample sites and drawings, and the layers.' },
    { at: '.desk', title: 'Click anything to change it', text: 'Click a part of the page to edit it. Click the map, then any name, river or area on it, to change that one thing. Right-click for more.' },
    { at: 'header button.export, header .export, button[aria-label^="Export"]', title: 'Export for the journal', text: 'The check at the top says what the journal would ask you to fix. Download PDF, TIFF or PNG, with the caption and credits ready to paste.' },
  ];
  let step = $state(-1);
  let box = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  let examples = $state<{ id: string; title: string; note: string; file: string }[]>([]);
  let card = $state<HTMLElement>();

  onMount(() => {
    let seen = true;
    try { seen = !!localStorage.getItem(KEY); } catch { /* private window: no tour */ }
    // not for automated browsers (the test suites): a card over the page would catch their clicks
    if (seen || navigator.webdriver || /Headless/.test(navigator.userAgent) || store.doc.study.source !== 'none') return;
    fetch('./examples/index.json').then((r) => (r.ok ? r.json() : [])).then((l) => (examples = l)).catch(() => {});
    setTimeout(() => (step = 0), 900); // after the page has settled
  });

  function place() {
    const s = STEPS[step];
    const el = s ? (s.at.split(', ').map((q) => document.querySelector<HTMLElement>(q)).find(Boolean) ?? null) : null;
    const r = el?.getBoundingClientRect();
    box = r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }
  $effect(() => {
    if (step < 0) return;
    place();
    const on = () => place();
    // starting to work (a click or a key anywhere else) ends the tour: it never stands in the way
    // (moving focus with Tab is not starting to work: it is how a keyboard user reaches the card's buttons)
    const away = (e: Event) => {
      if (e instanceof KeyboardEvent && (e.key === 'Tab' || e.key === 'Shift')) return;
      if (!card?.contains(e.target as Node)) close();
    };
    addEventListener('resize', on);
    addEventListener('pointerdown', away, true);
    addEventListener('keydown', away, true);
    return () => { removeEventListener('resize', on); removeEventListener('pointerdown', away, true); removeEventListener('keydown', away, true); };
  });

  function close() {
    step = -1;
    try { localStorage.setItem(KEY, '1'); } catch { /* fine */ }
  }
  async function openExample(file: string, title: string) {
    try {
      const text = await (await fetch(`./examples/${file}`)).text();
      store.load(text);
      close();
      store.told(t('Opened the example "{title}". Change anything; your own maps are in File, My maps.', { title }));
    } catch {
      store.status = t('The example could not be opened. Check your connection and try again.');
    }
  }
  // the card sits beside what it points at, inside the window
  const at = $derived.by(() => {
    const W = typeof innerWidth === 'number' ? innerWidth : 1200, H = typeof innerHeight === 'number' ? innerHeight : 800, cw = 340;
    if (!box) return { left: (W - cw) / 2, top: H / 3 };
    const right = box.x + box.w + 14;
    if (right + cw < W - 8) return { left: right, top: Math.min(Math.max(8, box.y), H - 260) };
    return { left: Math.min(Math.max(8, box.x), W - cw - 8), top: Math.min(box.y + box.h + 12, H - 260) };
  });
</script>

{#if step >= 0}
  <div class="veil" aria-hidden="true">
    {#if box}<div class="ring" style="left:{box.x - 6}px;top:{box.y - 6}px;width:{box.w + 12}px;height:{box.h + 12}px"></div>{/if}
  </div>
  <div class="card" bind:this={card} role="dialog" aria-modal="false" aria-labelledby="tour-title" tabindex="-1" style="left:{at.left}px;top:{at.top}px" onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
    <p class="count">{t('{n} of {total}', { n: step + 1, total: STEPS.length })}</p>
    <h2 id="tour-title">{t(STEPS[step].title)}</h2>
    <p>{t(STEPS[step].text)}</p>
    {#if step === 0 && examples.length}
      <div class="ex">
        <p class="exhead">{t('Or open a finished example and change it:')}</p>
        {#each examples as e}<button class="exbtn" onclick={() => openExample(e.file, e.title)}><strong>{e.title}</strong><small>{e.note}</small></button>{/each}
      </div>
    {/if}
    <div class="row">
      <button class="btn small" onclick={close}>{t('Skip the tour')}</button>
      {#if step > 0}<button class="btn small" onclick={() => step--}>{t('Back')}</button>{/if}
      <button class="btn small primary go" onclick={() => (step < STEPS.length - 1 ? step++ : close())}>{step < STEPS.length - 1 ? t('Next') : t('Start')}</button>
    </div>
  </div>
{/if}

<style>
  .veil { position: fixed; inset: 0; z-index: 60; pointer-events: none; }
  .ring { position: absolute; border-radius: 10px; box-shadow: 0 0 0 2px var(--accent), 0 0 0 9999px rgb(27 31 29 / 0.22); transition: all 200ms ease; }
  .card { position: fixed; z-index: 61; width: 340px; max-width: calc(100vw - 16px); box-sizing: border-box; padding: 16px; border-radius: 12px; background: var(--panel); color: var(--ink); box-shadow: var(--shadow-page); border: 1px solid var(--line); display: grid; gap: 8px; }
  .count { margin: 0; font-size: 11.5px; color: var(--ink-3); font-weight: 500; }
  h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; font-size: 12.5px; line-height: 1.5; color: var(--ink-2); text-wrap: pretty; }
  .ex { display: grid; gap: 6px; padding-top: 4px; }
  .exhead { font-weight: 500; color: var(--ink); }
  .exbtn { display: grid; gap: 2px; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
  .exbtn:hover { border-color: var(--line-strong); background: var(--panel-2); }
  .exbtn strong { font-size: 12.5px; font-weight: 600; }
  .exbtn small { font-size: 11.5px; color: var(--ink-3); }
  .row { display: flex; gap: 8px; justify-content: flex-end; padding-top: 4px; }
  .row .btn:first-child { margin-right: auto; }
  @media (prefers-reduced-motion: reduce) { .ring { transition: none; } }
</style>
