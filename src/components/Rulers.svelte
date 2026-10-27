<script lang="ts">
  // Millimetre rulers along the top and left of the page, as in the QGIS layout manager.
  // Drag from a ruler onto the page to make a guide; drag a guide's marker back onto its ruler to remove it.
  import { store } from '../lib/store.svelte';

  interface Props { pxPerMm: number; offX: number; offY: number; width: number; height: number; left: number; top: number; hover: [number, number] | null }
  let { pxPerMm, offX, offY, width, height, left, top, hover }: Props = $props();
  const T = 20; // ruler thickness, px

  const step = $derived([1, 2, 5, 10, 20, 50, 100, 200].find((s) => s * pxPerMm >= 46) ?? 500);
  const minor = $derived(step / (step === 2 || step === 20 || step === 200 ? 4 : 5));
  function ticks(len: number, off: number) {
    const out: { px: number; mm: number; major: boolean }[] = [];
    const a = Math.floor(-off / pxPerMm / minor) * minor, b = (len - off) / pxPerMm;
    for (let mm = a; mm <= b; mm += minor) {
      const r = Math.round(mm * 1000) / 1000;
      out.push({ px: off + r * pxPerMm, mm: r, major: Math.abs(r / step - Math.round(r / step)) < 1e-6 });
    }
    return out;
  }
  const xt = $derived(ticks(width - left, offX - left));
  const yt = $derived(ticks(height - top, offY - top));
  const guides = $derived(store.doc.guides ?? { x: [], y: [] });

  // dragging a guide: axis x = vertical guide (from the left ruler), y = horizontal guide (from the top ruler)
  let dragging: { axis: 'x' | 'y'; i: number } | null = null;
  let fresh = false;
  function start(axis: 'x' | 'y', i: number | null, e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    fresh = i == null;
    const g = (store.doc.guides ??= { x: [], y: [] });
    const at = axis === 'x' ? (e.clientX - host.getBoundingClientRect().left - offX) / pxPerMm : (e.clientY - host.getBoundingClientRect().top - offY) / pxPerMm;
    if (i == null) { g[axis].push(Math.round(at * 10) / 10); i = g[axis].length - 1; }
    dragging = { axis, i };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  }
  function move(e: PointerEvent) {
    if (!dragging || !store.doc.guides) return;
    const r = host.getBoundingClientRect();
    const v = dragging.axis === 'x' ? (e.clientX - r.left - offX) / pxPerMm : (e.clientY - r.top - offY) / pxPerMm;
    store.doc.guides[dragging.axis][dragging.i] = Math.round(v * 10) / 10;
  }
  function cancel() {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    if (dragging && fresh && store.doc.guides) store.doc.guides[dragging.axis].splice(dragging.i, 1);
    dragging = null;
  }
  function end(e: PointerEvent) {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointercancel', cancel);
    if (dragging && store.doc.guides) {
      const r = host.getBoundingClientRect();
      // released back over its own ruler: the guide goes away
      const back = dragging.axis === 'x' ? e.clientX - r.left < left : e.clientY - r.top < top;
      if (back) store.doc.guides[dragging.axis].splice(dragging.i, 1);
      store.commit();
    }
    dragging = null;
  }
  let host: HTMLDivElement;
  const label = (mm: number) => String(Math.round(mm));
</script>

<div class="rulers" bind:this={host} aria-hidden="true">
  <!-- top ruler (pointer-only aid for guides; the page itself is keyboard accessible) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg class="top" style="left:{left}px;top:{top - T}px;width:{width - left}px;height:{T}px" onpointerdown={(e) => start('y', null, e)}>
    <rect width="100%" height={T} class="bg" />
    {#each xt as t}
      <line x1={t.px} x2={t.px} y1={t.major ? 6 : 14} y2={T} class="tick" />
      {#if t.major}<text x={t.px + 3} y="10" class="num">{label(t.mm)}</text>{/if}
    {/each}
    {#if hover}<line x1={offX - left + hover[0] * pxPerMm} x2={offX - left + hover[0] * pxPerMm} y1="0" y2={T} class="cursor" />{/if}
    {#each guides.x as g, i}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <path d="M{offX - left + g * pxPerMm - 5},{T - 8} h10 l-5,8 z" class="marker" onpointerdown={(e) => { e.stopPropagation(); start('x', i, e); }} />
    {/each}
    <line x1="0" x2="100%" y1={T - 0.5} y2={T - 0.5} class="edge" />
  </svg>
  <!-- left ruler -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg class="left" style="left:{left - T}px;top:{top}px;width:{T}px;height:{height - top}px" onpointerdown={(e) => start('x', null, e)}>
    <rect width={T} height="100%" class="bg" />
    {#each yt as t}
      <line y1={t.px} y2={t.px} x1={t.major ? 6 : 14} x2={T} class="tick" />
      {#if t.major}<text transform="translate(10,{t.px + 3}) rotate(-90)" class="num" text-anchor="end">{label(t.mm)}</text>{/if}
    {/each}
    {#if hover}<line y1={offY - top + hover[1] * pxPerMm} y2={offY - top + hover[1] * pxPerMm} x1="0" x2={T} class="cursor" />{/if}
    {#each guides.y as g, i}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <path d="M{T - 8},{offY - top + g * pxPerMm - 5} v10 l8,-5 z" class="marker" onpointerdown={(e) => { e.stopPropagation(); start('y', i, e); }} />
    {/each}
    <line y1="0" y2="100%" x1={T - 0.5} x2={T - 0.5} class="edge" />
  </svg>
  <div class="corner" style="left:{left - T}px;top:{top - T}px;width:{T}px;height:{T}px"></div>
</div>

<style>
  .rulers { position: absolute; inset: 0; pointer-events: none; z-index: 4; }
  svg { position: absolute; pointer-events: auto; overflow: hidden; }
  .top { cursor: s-resize; }
  .left { cursor: e-resize; }
  .bg { fill: var(--panel); }
  .tick { stroke: var(--ink-3); stroke-width: 1; shape-rendering: crispEdges; }
  .edge { stroke: var(--line-strong); stroke-width: 1; }
  .num { font-size: 11.5px; fill: var(--ink-2); font-variant-numeric: tabular-nums; font-family: inherit; }
  .cursor { stroke: var(--accent); stroke-width: 1; }
  .marker { fill: var(--accent); cursor: grab; }
  .corner { position: absolute; background: var(--panel); border-right: 1px solid var(--line-strong); border-bottom: 1px solid var(--line-strong); }
</style>
