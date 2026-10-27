// Small drawing helpers shared by the figure's parts (the map frames and the legend).
import type { Doc, Layer } from './store.svelte';
import type { MainScene } from './scene';
import { detailBox } from './scene';
import type { DetailDraw } from './frames.svelte';
import { ptToMm } from './journals';
import { textWidthMm } from './measure';

const mm = ptToMm;
export const n3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * A name with extra space between its letters. The PDF writer ignores CSS letter-spacing, so the spacing is written as
 * a text length (which every output understands) and the name is set from its left end, so it still sits on its point.
 */
export function spaced(text: string, x: number, anchor: string, pt: number, bold: boolean, em: number): { x: number; len: number } {
  const len = textWidthMm(text, pt, bold) + (Array.from(text).length - 1) * mm(pt) * em;
  return { x: anchor === 'middle' ? x - len / 2 : x, len };
}

export function dashFor(l: Layer) {
  return l.style.dash ? `${n3(mm(l.style.strokePt) * 4)} ${n3(mm(l.style.strokePt) * 2.5)}` : undefined;
}

export function symbolPath(shape: string, r: number): string {
  switch (shape) {
    case 'triangle': return `M0,${n3(-r * 1.15)}L${n3(r)},${n3(r * 0.7)}L${n3(-r)},${n3(r * 0.7)}Z`;
    case 'square': return `M${-r * 0.88},${-r * 0.88}h${r * 1.76}v${r * 1.76}h${-r * 1.76}Z`;
    case 'diamond': return `M0,${-r * 1.2}L${r * 1.2},0L0,${r * 1.2}L${-r * 1.2},0Z`;
    default: return `M${-r},0a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
  }
}

/** Diagonal hatching, 1.2 mm apart, to be clipped to an area. */
export function hatchLines(w: number, h: number): string {
  let d = '';
  for (let x = -h; x < w + h; x += 1.2) d += `M${n3(x)},${n3(h)}L${n3(x + h)},0`;
  return d;
}

type Rect = { x: number; y: number; w: number; h: number };

/** Does the segment p→q pass through the rectangle r (shrunk by 0.3 mm so touching edges do not count)? */
export function crosses(p: [number, number], q: [number, number], r: Rect): boolean {
  const x0 = r.x + 0.3, y0 = r.y + 0.3, x1 = r.x + r.w - 0.3, y1 = r.y + r.h - 0.3;
  let t0 = 0, t1 = 1;
  const dx = q[0] - p[0], dy = q[1] - p[1];
  for (const [pp, qq] of [[-dx, p[0] - x0], [dx, x1 - p[0]], [-dy, p[1] - y0], [dy, y1 - p[1]]] as [number, number][]) {
    if (pp === 0) { if (qq < 0) return false; continue; }
    const t = qq / pp;
    if (pp < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return t0 < t1;
}

/**
 * The two zoom lines between a zoom box (page mm) lying in the frame `from` and the frame `to` it marks or is marked by: they leave the corners
 * of the box that face `to` and end on the stretch of `to`'s edge that faces `from` (not always its corners), so in a stacked layout such as
 * (a)(b)(c) they run straight across and never cut through the panel beside them. Frames that overlap have no lines.
 */
export function facingSegs(box: { x0: number; y0: number; x1: number; y1: number }, from: Rect, to: Rect): [[number, number], [number, number]][] {
  const tr = to.x + to.w, tb = to.y + to.h;
  const top = Math.max(to.y, from.y), bot = Math.min(tb, from.y + from.h), left = Math.max(to.x, from.x), right = Math.min(tr, from.x + from.w);
  const ty = bot - top > 4 ? [top, bot] : [to.y, tb], tx = right - left > 4 ? [left, right] : [to.x, tr];
  if (from.x >= tr - 1) return [[[box.x0, box.y0], [tr, ty[0]]], [[box.x0, box.y1], [tr, ty[1]]]];
  if (from.x + from.w <= to.x + 1) return [[[box.x1, box.y0], [to.x, ty[0]]], [[box.x1, box.y1], [to.x, ty[1]]]];
  if (from.y >= tb - 1) return [[[box.x0, box.y0], [tx[0], tb]], [[box.x1, box.y0], [tx[1], tb]]];
  if (from.y + from.h <= to.y + 1) return [[[box.x0, box.y1], [tx[0], to.y]], [[box.x1, box.y1], [tx[1], to.y]]];
  return [];
}

/** A zoom box on the main map for one detail map, and the lines from it to that map. */
export interface ZoomBox {
  id: string;
  /** the box as a path in the main map's mm */
  d: string;
  color: string;
  pt: number;
  fill: number;
  /** the two lines as a path in page mm ('' = none) */
  lines: string;
  /** lines were asked for but something lies across them, so they are left out */
  blocked: boolean;
}

/**
 * The detail maps' ground as boxes on the main map, and the two lines from each box to its detail map. The lines run behind the parts
 * that sit on the main map (they are drawn in the detail map's place, right after the map), and are left out when they would cross a
 * part that is not on it (a locator, a note), as the zoom lines of a locator are.
 */
export function detailZoom(doc: Doc, main: MainScene | null, details: Record<string, DetailDraw | null>): ZoomBox[] {
  const out: ZoomBox[] = [];
  const m = doc.items.find((i) => i.kind === 'map' && i.visible);
  if (!main || !m) return out;
  const from = { x: m.x, y: m.y, w: m.w, h: m.h };
  const onMain = (o: Rect) => o.x + o.w / 2 > from.x && o.x + o.w / 2 < from.x + from.w && o.y + o.h / 2 > from.y && o.y + o.h / 2 < from.y + from.h;
  for (const it of doc.items) {
    const dd = it.kind === 'detail' && it.visible && it.showBox ? details[it.id] : null;
    if (it.kind !== 'detail' || !dd) continue;
    const pts = detailBox(main, dd.scene);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const box = { x0: from.x + Math.min(...xs), y0: from.y + Math.min(...ys), x1: from.x + Math.max(...xs), y1: from.y + Math.max(...ys) };
    let lines = '', blocked = false;
    if (it.connect) {
      const segs = facingSegs(box, from, it);
      const others = doc.items.filter((o) => o.visible && o.id !== it.id && o.kind !== 'map' && o.kind !== 'shape' && !(o.kind === 'title' && Math.abs(o.w) < 14 && Math.abs(o.h) < 9) && !onMain(o));
      if (segs.length && segs.some(([p, q]) => others.some((o) => crosses(p, q, o)))) blocked = true;
      else lines = segs.map(([p, q]) => `M${n3(p[0])},${n3(p[1])}L${n3(q[0])},${n3(q[1])}`).join('');
    }
    out.push({ id: it.id, d: `M${pts.map((p) => `${n3(p[0])},${n3(p[1])}`).join('L')}Z`, color: it.boxColor, pt: it.boxPt ?? 0.8, fill: it.boxFill ?? 0.07, lines, blocked });
  }
  return out;
}
