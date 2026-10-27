// Points styled by the columns of their table: a colour (and symbol) for each value of a column, a size that follows a
// number column, and a number inside each marker. Used by the map scene, the figure and the legend, so all three agree.
import type { FeatureCollection } from 'geojson';
import type { Layer, LayerStyle, PointsBy } from './store.svelte';
import { CAT_COLOURS, decimalsFor, fmtNum, toNumber } from './classify';
import { luminance } from './palettes';
import { ptToMm } from './journals';
import { textWidthMm } from './measure';

type Shape = LayerStyle['symbol'];
export const SHAPES: Shape[] = ['circle', 'triangle', 'square', 'diamond'];
/** the most different values one colour column may have, and one symbol column */
export const MAX_CATS = 10;
export const MAX_SYMS = 4;

const DEFAULT_MIN_PT = 3;
const DEFAULT_MAX_PT = 12;
const DEFAULT_NUMBER_PT = 6;

const text = (v: unknown): string => (v == null ? '' : String(v).trim());

/** What the table holds, found once per table and column choice. */
export interface MarksInfo {
  /** the different values of the colour column, in the order they first appear (blank is '') */
  cats: string[];
  /** the same for the symbol column */
  syms: string[];
  /** smallest and largest number in the size column, and how many rows have none */
  domain: [number, number] | null;
  noNumber: number;
  /** the markers, and the first and last number they carry */
  count: number;
  first: string;
  last: string;
}

const memo = new WeakMap<object, Map<string, MarksInfo>>();

export function scanMarks(layer: Layer, fc: FeatureCollection): MarksInfo {
  const pb = layer.pointsBy ?? {};
  const numbered = !!pb.number;
  const key = JSON.stringify([pb.colorField, pb.symbolField, numbered ? '' : pb.sizeField, pb.number, pb.numberField]);
  let m = memo.get(fc);
  if (!m) { m = new Map(); memo.set(fc, m); }
  const hit = m.get(key);
  if (hit) return hit;
  const cats: string[] = [], syms: string[] = [];
  const catSet = new Set<string>(), symSet = new Set<string>();
  let lo = Infinity, hi = -Infinity, noNumber = 0, count = 0, first = '', last = '';
  fc.features.forEach((f, i) => {
    if (!f.geometry || !/Point/.test(f.geometry.type)) return;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    count++;
    if (pb.colorField) { const v = text(p[pb.colorField]); if (!catSet.has(v)) { catSet.add(v); cats.push(v); } }
    if (pb.symbolField) { const v = text(p[pb.symbolField]); if (!symSet.has(v)) { symSet.add(v); syms.push(v); } }
    if (pb.sizeField && !numbered) { const n = toNumber(p[pb.sizeField]); if (n === null) noNumber++; else { lo = Math.min(lo, n); hi = Math.max(hi, n); } }
    if (numbered) { const t = numberText(pb, p, i); if (count === 1) first = t; last = t; }
  });
  const info: MarksInfo = { cats, syms, domain: lo <= hi ? [lo, hi] : null, noNumber, count, first, last };
  m.set(key, info);
  return info;
}

/** How many different values each column of the table has (blank counts as one), for the pickers; also whether every value is a number. */
export function columnFacts(fc: FeatureCollection | undefined, columns: string[]): Record<string, { distinct: number; numeric: boolean }> {
  const out: Record<string, { distinct: number; numeric: boolean }> = {};
  const feats = (fc?.features ?? []).filter((f) => f.geometry && /Point/.test(f.geometry.type));
  for (const c of columns) {
    const set = new Set<string>();
    let numeric = feats.length > 0, any = false;
    for (const f of feats) {
      const v = text((f.properties as Record<string, unknown> | null)?.[c]);
      set.add(v);
      if (v !== '') { any = true; if (toNumber(v) === null) numeric = false; }
    }
    out[c] = { distinct: set.size, numeric: numeric && any };
  }
  return out;
}

export function numberText(pb: PointsBy, props: Record<string, unknown>, idx: number): string {
  if (pb.number === 'column' && pb.numberField) return text(props[pb.numberField]);
  return String(idx + 1);
}

export const catColour = (pb: PointsBy, cats: string[], v: string): string => pb.cats?.[v]?.color ?? CAT_COLOURS[Math.max(0, cats.indexOf(v)) % CAT_COLOURS.length];
export const catLabel = (pb: PointsBy, v: string): string => pb.cats?.[v]?.label?.trim() || (v === '' ? 'No value' : v);
export const symShape = (pb: PointsBy, syms: string[], v: string): Shape => pb.symbols?.[v] ?? SHAPES[Math.max(0, syms.indexOf(v)) % SHAPES.length];

/** Symbol width (pt) for a number: the smallest at the lowest value, the largest at the highest; 'sqrt' makes the AREA follow the number. */
export function sizeFor(pb: PointsBy, domain: [number, number] | null, value: number | null): number {
  const lo = pb.sizeMin ?? DEFAULT_MIN_PT, hi = Math.max(lo, pb.sizeMax ?? DEFAULT_MAX_PT);
  if (!domain || value === null) return lo;
  const span = domain[1] - domain[0];
  const t = span > 0 ? Math.max(0, Math.min(1, (value - domain[0]) / span)) : 0.5;
  return (pb.sizeScale ?? 'linear') === 'sqrt' ? Math.sqrt(lo * lo + t * (hi * hi - lo * lo)) : lo + t * (hi - lo);
}

export interface PointLook {
  /** colour from the colour column (unset = the layer's fill) */
  fill?: string;
  shape: Shape;
  /** width of the marker, mm */
  dMm: number;
  /** the number inside it, and its size (mm) */
  num?: string;
  numMm?: number;
}

/** The look of one point: its colour, symbol, size and number. `idx` is its row in the table. */
export function pointLook(layer: Layer, info: MarksInfo, props: Record<string, unknown>, idx: number): PointLook {
  const pb = layer.pointsBy ?? {};
  const style = layer.style;
  const fill = pb.colorField ? catColour(pb, info.cats, text(props[pb.colorField])) : undefined;
  const shape = pb.symbolField ? symShape(pb, info.syms, text(props[pb.symbolField])) : style.symbol;
  if (pb.number) {
    // a number inside: the marker is a ring round it, never smaller than the symbol size
    const num = numberText(pb, props, idx);
    const pt = pb.numberPt ?? DEFAULT_NUMBER_PT;
    const fs = ptToMm(pt);
    const w = num ? textWidthMm(num, pt, true) : 0;
    return { fill, shape: 'circle', dMm: Math.max(ptToMm(style.sizePt), w + 1.0, fs * 1.45), num, numMm: fs };
  }
  if (pb.sizeField) return { fill, shape, dMm: ptToMm(sizeFor(pb, info.domain, toNumber(props[pb.sizeField]))) };
  return { fill, shape, dMm: ptToMm(style.sizePt) };
}

/** How solid a layer's point symbols are: a points layer follows its fill opacity; a file or drawing keeps that for its areas and has its own. */
export const markOpacity = (l: Layer): number => (l.kind === 'vector' ? l.style.symbolOpacity ?? 1 : l.style.fillOpacity);

/** Text colour that reads on a marker of this colour. */
export const inkOn = (fill: string): string => (luminance(fill) > 0.42 ? '#1B1F1D' : '#FFFFFF');

/** The smallest round number (1, 2 or 5 times a power of ten) that is not below v, and the largest that is not above it. */
function niceUp(v: number): number {
  if (!(v > 0)) return v;
  const e = Math.floor(Math.log10(v));
  for (const x of [e - 1, e, e + 1]) for (const m of [1, 2, 5]) if (m * 10 ** x >= v * (1 - 1e-9)) return m * 10 ** x;
  return v;
}
function niceDown(v: number): number {
  if (!(v > 0)) return v;
  const e = Math.floor(Math.log10(v));
  for (const x of [e + 1, e, e - 1]) for (const m of [5, 2, 1]) if (m * 10 ** x <= v * (1 + 1e-9)) return m * 10 ** x;
  return v;
}

/** Three example values for the size key: round numbers inside the range of the data (the smallest, one between, the largest). */
export function sizeKey(domain: [number, number]): number[] {
  const [lo, hi] = domain;
  if (!(hi > lo)) return [lo];
  const top = niceDown(hi), bottom = niceUp(lo);
  // a narrow range has no round numbers inside it: show its two ends as they are
  if (!(top > bottom * 1.0001 || (bottom <= 0 && top > bottom))) return [lo, (lo + hi) / 2, hi];
  const mid0 = (bottom + top) / 2;
  const e = 10 ** Math.floor(Math.log10(Math.abs(mid0) || 1));
  const mid = Math.round(mid0 / e) * e;
  return mid > bottom && mid < top ? [bottom, mid, top] : [bottom, top];
}

/** The size-key values written the same way ("5", "50", "1,200"). */
export function fmtKey(values: number[]): string[] {
  const d = decimalsFor([...values].sort((a, b) => a - b));
  return values.map((v) => fmtNum(v, d));
}
