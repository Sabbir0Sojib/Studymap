// Automatic placement of the north arrow, scale bar and legend when they sit on the map, so they never cover
// the study area or each other (the way a cartographer moves them by hand in QGIS or ArcGIS).
import type { Doc, Item, MapItem } from './store.svelte';
import type { MainScene } from './scene';

type Rect = { x: number; y: number; w: number; h: number };

const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

const inside = (it: Rect, m: MapItem) => {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  return cx > m.x && cx < m.x + m.w && cy > m.y && cy < m.y + m.h;
};

let ctx: CanvasRenderingContext2D | null = null;
function context() {
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
  return ctx;
}

/** Share of the rectangle (page mm) that lies over the study area, sampled on a 7 × 5 grid. */
function coverage(r: Rect, m: MapItem, areas: Path2D[]): number {
  const c = context();
  if (!c || !areas.length) return 0;
  let hit = 0, n = 0;
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 5; j++) {
      const x = r.x + (r.w * (i + 0.5)) / 7 - m.x, y = r.y + (r.h * (j + 0.5)) / 5 - m.y;
      n++;
      if (areas.some((p) => c.isPointInPath(p, x, y))) hit++;
    }
  }
  return hit / n;
}

/** How much of a page box (mm) lies over the study area, 0 to 1: used to drop new parts where they hide the least. */
export function studyCover(doc: Doc, main: MainScene | null): ((r: Rect) => number) | null {
  const m = doc.items.find((i) => i.kind === 'map' && i.visible) as MapItem | undefined;
  if (!m || !main || doc.study.source === 'none') return null;
  const study = doc.layers.find((l) => l.kind === 'study');
  const areas = (study && main.byId[study.id]?.paths.filter((p) => p.kind === 'area' && p.d).map((p) => new Path2D(p.d))) ?? [];
  if (!areas.length) return null;
  return (r) => coverage(r, m, areas);
}

/** Candidate spots inside the map frame, in order of preference: corners first, then along the edges. */
function spots(kind: Item['kind'], w: number, h: number, m: MapItem): [number, number][] {
  const g = 3; // gap from the frame
  const L = m.x + g, R = m.x + m.w - w - g, T = m.y + g, B = m.y + m.h - h - g;
  const T2 = T + 8; // just below a panel letter such as (c)
  const midX = m.x + (m.w - w) / 2, midY = m.y + (m.h - h) / 2;
  const corners: [number, number][] = kind === 'north' ? [[R, T], [L, T], [R, T2], [L, T2], [R, B], [L, B]]
    : kind === 'scale' ? [[L, B], [R, B], [midX, B], [L, T2], [R, T2]]
    : [[R, B], [L, B], [R, T], [L, T], [L, T2], [R, T2], [L, midY], [R, midY], [midX, B], [midX, T]];
  return corners.filter(([x, y]) => x >= m.x && y >= m.y && x + w <= m.x + m.w && y + h <= m.y + m.h);
}

/**
 * Move unpinned north arrow, scale bar and legend that sit on the map to the corner where they cover the least of
 * the study area and nothing else. Returns true when something moved.
 */
export function autoPlace(doc: Doc, main: MainScene | null): boolean {
  const m = doc.items.find((i) => i.kind === 'map' && i.visible) as MapItem | undefined;
  if (!m || !main || doc.study.source === 'none') return false;
  const study = doc.layers.find((l) => l.kind === 'study');
  const areas = (study && main.byId[study.id]?.paths.filter((p) => p.kind === 'area' && p.d).map((p) => new Path2D(p.d))) ?? [];
  let moved = false;
  const order: Item['kind'][] = ['north', 'scale', 'legend'];
  const placed: Rect[] = doc.items.filter((i) => i.visible && i.kind !== 'map' && !order.includes(i.kind)).map((i) => ({ x: i.x, y: i.y, w: i.w, h: i.h }));
  for (const kind of order) {
    const it = doc.items.find((i) => i.kind === kind && i.visible);
    if (!it) continue;
    if (it.pinned || !inside(it, m) || it.w > m.w * 0.6 || it.h > m.h * 0.6) { placed.push(it); continue; }
    let best: [number, number] = [it.x, it.y];
    let bestScore = Infinity;
    spots(kind, it.w, it.h, m).forEach(([x, y], rank) => {
      const r = { x, y, w: it.w, h: it.h };
      const clash = placed.reduce((s, p) => s + overlap(r, p), 0);
      const score = coverage(r, m, areas) * 10 + clash * 5 + rank * 0.05;
      if (score < bestScore) { bestScore = score; best = [x, y]; }
    });
    const [x, y] = best.map((v) => Math.round(v * 10) / 10);
    if (Math.abs(x - it.x) > 0.05 || Math.abs(y - it.y) > 0.05) { it.x = x; it.y = y; moved = true; }
    placed.push({ x: it.x, y: it.y, w: it.w, h: it.h });
  }
  return moved;
}

/** Problems for the checker: parts of the figure on top of each other, or the legend over the study area. */
export function overlaps(doc: Doc, main: MainScene | null): { text: string; ids: string[] }[] {
  const m = doc.items.find((i) => i.kind === 'map' && i.visible) as MapItem | undefined;
  const items = doc.items.filter((i) => i.visible && i.kind !== 'map' && !(i.kind === 'title' && i.w < 12));
  const NAME: Record<string, string> = { north: 'North arrow', scale: 'Scale bar', legend: 'Legend', credits: 'Credits', inset: 'Locator map', detail: 'Detail map', title: 'Text', shape: 'Shape', table: 'Table of sites', profile: 'Elevation profile' };
  // two locators overlapping must say which is which
  const LOCATOR: Record<string, string> = { globe: 'Globe locator', country: 'Country locator', region: 'Region locator', parent: 'Surroundings locator' };
  const name = (it: Item) => (it.kind === 'inset' ? LOCATOR[it.context] : undefined) ?? NAME[it.kind] ?? it.kind;
  const out: { text: string; ids: string[] }[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.kind === 'shape' || b.kind === 'shape') continue;
      if (overlap(a, b) > 4) out.push({ text: `${name(a)} and ${name(b)} overlap. Drag one of them, or choose a layout again.`, ids: [a.id, b.id] });
    }
  }
  const lg = doc.items.find((i) => i.kind === 'legend' && i.visible);
  const study = doc.layers.find((l) => l.kind === 'study');
  if (m && lg && main && study && inside(lg, m)) {
    const areas = main.byId[study.id]?.paths.filter((p) => p.kind === 'area' && p.d).map((p) => new Path2D(p.d)) ?? [];
    if (coverage(lg, m, areas) > 0.2) out.push({ text: 'The legend covers part of the study area. Click the legend and choose "Place automatically", or drag it.', ids: [lg.id] });
  }
  return out;
}
