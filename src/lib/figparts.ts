// The table of sample sites and the elevation profile: what they list, how big they are and where each mark goes.
// The figure draws from these, the box fitting (figparts.svelte.ts) and the journal check measure with them, so all three agree.
// Everything is in millimetres on the page; text is placed with plain y offsets (no dominant-baseline), as the PDF needs.
import type { Feature, FeatureCollection } from 'geojson';
import type { Doc, Layer, ProfileData, ProfileItem, TableItem } from './store.svelte';
import { formatCoord, fmtNumber, geodesic } from './carto';
import { textWidthMm } from './measure';
import { ptToMm } from './journals';
import { numberText } from './marks';
import { toNumber } from './classify';
import { t } from './i18n.svelte';

type Geoms = Record<string, FeatureCollection>;

/* ---------- lines drawn on the map ---------- */

/** The path of a line shape (a MultiLineString is joined end to end), or null for anything else or a line with no length. */
function lineOf(f: Feature): [number, number][] | null {
  const g = f.geometry;
  if (!g) return null;
  const raw = g.type === 'LineString' ? g.coordinates : g.type === 'MultiLineString' ? g.coordinates.flat() : null;
  if (!raw) return null;
  const c = raw.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p) => [p[0], p[1]] as [number, number]);
  return c.length >= 2 && c.some((p) => p[0] !== c[0][0] || p[1] !== c[0][1]) ? c : null;
}

export interface DrawnLine {
  /** "layerId|n": the layer and the shape's place in it (a shape is never renumbered when another is added) */
  ref: string;
  /** how the list names it: the layer, then the shape's own name or its number among the layer's lines */
  name: string;
  layer: Layer;
  coords: [number, number][];
  lenKm: number;
}

const lengthKm = (c: [number, number][]) => c.slice(1).reduce((s, p, i) => s + geodesic(c[i], p), 0) / 1000;

/** Every line drawn by hand or read from a file (contour lines and distance rings are not lines to walk along). */
export function drawnLines(doc: Doc, geoms: Geoms): DrawnLine[] {
  const out: DrawnLine[] = [];
  for (const l of doc.layers) {
    if (l.kind !== 'vector' || l.contour || l.auto || /^Distance rings/.test(l.name)) continue;
    const fc = geoms[l.id];
    if (!fc) continue;
    let n = 0;
    fc.features.forEach((f, fi) => {
      const coords = lineOf(f);
      if (!coords) return;
      n++;
      const own = String(f.properties?.name ?? '').trim();
      out.push({ ref: `${l.id}|${fi}`, name: `${l.name}, ${own || t('line {n}', { n })}`, layer: l, coords, lenKm: lengthKm(coords) });
    });
  }
  return out;
}

/** The path a profile follows, or null when its line is gone. */
export function lineCoords(ref: string, geoms: Geoms): [number, number][] | null {
  const at = ref.lastIndexOf('|');
  if (at < 1) return null;
  const f = geoms[ref.slice(0, at)]?.features[Number(ref.slice(at + 1))];
  return f ? lineOf(f) : null;
}

/** A short name for a line's shape, so a changed line is told from the same line (the sampled heights belong to it). */
export function lineKey(c: [number, number][]): string {
  let h = 5381;
  const s = c.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${c.length}.${(h >>> 0).toString(36)}`;
}

/* ---------- the table of sample sites ---------- */

export const SPECIAL: Record<string, string> = { '#no': 'No.', '#lat': 'Latitude', '#lon': 'Longitude' };

const isPoint = (f: Feature) => !!f.geometry && /Point/.test(f.geometry.type);
const pointOf = (f: Feature): [number, number] | null => {
  const g = f.geometry;
  if (!g) return null;
  const c = g.type === 'Point' ? g.coordinates : g.type === 'MultiPoint' ? g.coordinates[0] : null;
  return c && Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : null;
};

/** The layers a table can list: those that hold points (a points layer, or a file or drawing with points in it). */
export function sitesLayers(doc: Doc, geoms: Geoms): Layer[] {
  return doc.layers.filter((l) => (l.kind === 'points' || (l.kind === 'vector' && !l.contour && !l.auto)) && !!geoms[l.id]?.features.some((f) => isPoint(f) && pointOf(f)));
}

/** The columns of a points table, in the order they come (the same list the style panels show). */
export function tableColumns(fc: FeatureCollection | undefined): string[] {
  const seen = new Set<string>();
  for (const f of (fc?.features ?? []).slice(0, 500)) if (isPoint(f)) for (const k of Object.keys(f.properties ?? {})) if (!k.startsWith('__')) seen.add(k);
  return [...seen];
}

/** What a new table shows: the numbers when the markers carry them, the label column (or the first text column), then latitude and longitude. */
export function defaultCols(layer: Layer, fc: FeatureCollection | undefined): string[] {
  const props = tableColumns(fc);
  const feats = (fc?.features ?? []).filter(isPoint);
  const textual = (c: string) => feats.some((f) => { const v = (f.properties as Record<string, unknown> | null)?.[c]; return v != null && String(v).trim() !== '' && toNumber(v) === null; });
  const label = layer.style.labelField && props.includes(layer.style.labelField) ? layer.style.labelField : props.find(textual) ?? props[0];
  return [...(layer.pointsBy?.number ? ['#no'] : []), ...(label ? [label] : []), '#lat', '#lon'];
}

/** Latitude or longitude as 23°45′12″N, or as decimal degrees with four places (23.7534°N). */
export function fmtCoord(v: number, axis: 'lat' | 'lon', how: 'dms' | 'dec'): string {
  if (how === 'dms') return formatCoord(v, axis, 'dms', 1 / 3600);
  const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W';
  return `${Math.abs(v).toFixed(4)}°${Math.abs(v) < 1e-9 ? '' : hemi}`;
}

export interface TableData {
  /** the columns shown (the ones that exist in the layer now) and their header words */
  cols: string[];
  head: string[];
  /** numbers sit against the right edge of their column */
  right: boolean[];
  rows: string[][];
}

const cellText = (v: unknown) => (v == null ? '' : String(v).trim());

/** The words of the table: one row per site of the layer, in the order of its table. Null when the layer is gone or has no points. */
export function tableData(it: TableItem, doc: Doc, geoms: Geoms): TableData | null {
  const layer = doc.layers.find((l) => l.id === it.layer);
  const fc = layer && geoms[layer.id];
  if (!layer || !fc) return null;
  const props = tableColumns(fc);
  const cols = it.cols.filter((c) => c in SPECIAL || props.includes(c));
  const pb = layer.pointsBy ?? {};
  const rows: string[][] = [];
  fc.features.forEach((f, fi) => {
    const pt = isPoint(f) ? pointOf(f) : null;
    if (!pt) return;
    const p = (f.properties ?? {}) as Record<string, unknown>;
    rows.push(cols.map((c) => (c === '#no' ? (pb.number ? numberText(pb, p, fi) : String(rows.length + 1)) : c === '#lat' ? fmtCoord(pt[1], 'lat', it.coord) : c === '#lon' ? fmtCoord(pt[0], 'lon', it.coord) : cellText(p[c]))));
  });
  if (!rows.length) return null;
  const right = cols.map((c, i) => c in SPECIAL || (rows.some((r) => r[i] !== '') && rows.every((r) => r[i] === '' || toNumber(r[i]) !== null)));
  return { cols, head: cols.map((c) => SPECIAL[c] ?? c), right, rows };
}

/** The text cut short with "…" to fit `max` mm. */
export function clipText(text: string, pt: number, bold: boolean, max: number): string {
  if (textWidthMm(text, pt, bold) <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidthMm(text.slice(0, mid) + '…', pt, bold) <= max) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? text.slice(0, lo) + '…' : '';
}

export interface TableLayout {
  fs: number;
  rowH: number;
  padX: number;
  /** height of the caption line (0 = none) */
  titleH: number;
  /** each column as wide as its widest word, and the box that holds all of it */
  widths: number[];
  natW: number;
  natH: number;
  /** the columns as drawn in this box: wider when the box is, narrower (words cut short) when it is not */
  cw: number[];
  squeezed: boolean;
  /** how many rows fit under the header in this box */
  shown: number;
  /** the table's bottom edge (mm from the top of the box) with the rows that are shown */
  bottom: number;
}

export function tableLayout(it: TableItem, d: TableData): TableLayout {
  const pt = it.labelPt, fs = ptToMm(pt);
  const rowH = fs * 1.55, padX = fs * 0.55;
  const body = !!it.text?.bold;
  const widths = d.head.map((h, c) => Math.max(textWidthMm(h, pt, true), ...d.rows.map((r) => textWidthMm(r[c], pt, body))) + 2 * padX);
  const sum = widths.reduce((a, b) => a + b, 0);
  const has = !!it.title.trim();
  const titleH = has ? rowH * 1.4 : 0; // the caption in the first row, then a little air before the table
  const natW = Math.max(sum, has ? textWidthMm(it.title, pt, true) + 0.6 : 0);
  const natH = titleH + rowH * (1 + d.rows.length) + 0.4;
  const extra = it.w - sum;
  const cw = extra >= 0 ? widths.map((w) => w + extra / widths.length) : widths.map((w) => (w * it.w) / sum);
  const shown = Math.max(0, Math.min(d.rows.length, Math.floor((it.h + 0.15 - titleH - rowH - 0.4) / rowH)));
  return { fs, rowH, padX, titleH, widths, natW, natH, cw, squeezed: extra < -0.05, shown, bottom: titleH + rowH * (1 + shown) + 0.4 };
}

/* ---------- the elevation profile ---------- */

/** A round step (1, 2, 5 or 10 times a power of ten) giving about `n` divisions of `span`. */
export function niceStep(span: number, n: number): number {
  const raw = span / Math.max(1, n);
  const mag = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * mag >= raw * 0.999) return m * mag;
  return 10 * mag;
}

const dp = (v: number) => Math.round(v * 100) / 100;

export interface ProfileMark { x: number; y: number; m: number; label: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end' } | null }

export interface ProfileLayout {
  /** false when the box is too small to hold a chart */
  ok: boolean;
  fs: number;
  x0: number; y0: number; x1: number; y1: number;
  xt: { v: number; x: number; text: string }[];
  yt: { v: number; y: number; text: string }[];
  tick: number;
  /** baselines of the tick numbers and of the axis titles; the top row's baseline */
  xNumY: number; xTitleY: number; topY: number;
  yNumX: number; yTitleX: number;
  line: string;
  area: string;
  /** the lowest and highest point, each with the words beside it (null: not written, as on flat ground) */
  lo: ProfileMark;
  hi: ProfileMark;
  /** the vertical exaggeration of the chart (how much steeper than true it is drawn) and its words */
  exag: number;
  exagText: string;
  /** the top row has room for the exaggeration text between A and B */
  exagFits: boolean;
}

export function exagWords(v: number): string {
  return `Vertical exaggeration ${v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10).toString()}×`;
}

export function profileLayout(it: ProfileItem, d: ProfileData): ProfileLayout {
  const pt = it.labelPt, fs = ptToMm(pt), bold = !!it.text?.bold;
  const titles = it.axisTitles !== false;
  const tick = 0.8, gap = 0.8;
  const topRow = it.ends || it.exag || it.extremes ? fs * 1.55 : fs * 0.75;
  const bottom = tick + gap + fs * 0.8 + (titles ? fs * 1.35 : 0) + fs * 0.35;
  const y0 = topRow, y1 = it.h - bottom;
  const plotH = y1 - y0;
  // the height axis: round limits round the data, about one number every 3 letter heights
  const lo = Math.min(...d.m), hi = Math.max(...d.m);
  const span = hi - lo > 0.5 ? hi - lo : Math.max(10, Math.abs(hi) * 0.1);
  const yStep = niceStep(span, Math.max(2, Math.min(6, Math.round(plotH / (fs * 3.2)))));
  let yMin = Math.floor(lo / yStep + 1e-9) * yStep, yMax = Math.ceil(hi / yStep - 1e-9) * yStep;
  if (yMax - yMin < yStep) yMax = yMin + yStep;
  const yLabels: { v: number; text: string }[] = [];
  for (let v = yMin; v <= yMax + yStep * 1e-6; v += yStep) yLabels.push({ v: Math.round(v * 1e6) / 1e6, text: fmtNumber(Math.round(v * 1e6) / 1e6) });
  const yw = Math.max(...yLabels.map((l) => textWidthMm(l.text, pt, bold)));
  const x0 = yw + tick + gap + (titles ? fs * 1.4 : 0) + 0.6;
  const x1 = it.w - Math.max(1.5, fs * 1.4);
  const plotW = x1 - x0;
  const lenKm = d.lenKm > 0 ? d.lenKm : Math.max(...d.km, 0.001);
  const xStep = niceStep(lenKm, Math.max(2, Math.min(8, Math.round(plotW / (textWidthMm('000', pt, bold) + 7)))));
  const dec = xStep >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(xStep) - 1e-9));
  const X = (km: number) => x0 + (km / lenKm) * plotW;
  const Y = (m: number) => y1 - ((m - yMin) / (yMax - yMin)) * plotH;
  const xt: ProfileLayout['xt'] = [];
  for (let v = 0; v <= lenKm + xStep * 1e-6; v += xStep) xt.push({ v, x: dp(X(v)), text: v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) });
  const yt = yLabels.map((l) => ({ v: l.v, y: dp(Y(l.v)), text: l.text }));
  const pts = d.km.map((k, i) => [dp(X(Math.min(k, lenKm))), dp(Y(d.m[i]))]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
  const area = `${line}L${pts[pts.length - 1][0]},${dp(y1)}L${pts[0][0]},${dp(y1)}Z`;
  const iLo = d.m.indexOf(lo), iHi = d.m.indexOf(hi);
  // the words of the lowest and highest point: above the highest and below the lowest when there is room inside the chart, else beside the point
  const mark = (i: number, up: boolean, written: boolean): ProfileMark => {
    const [px, py] = pts[i], m = d.m[i];
    if (!written) return { x: dp(px), y: dp(py), m, label: null };
    const text = `${fmtNumber(Math.round(m))} m`;
    const w = textWidthMm(text, pt, bold);
    const room = up ? py - 1.1 - fs * 0.8 >= y0 + 0.2 : py + 1.1 + fs * 0.8 + fs * 0.2 <= y1 - 0.1;
    if (room) return { x: dp(px), y: dp(py), m, label: { x: dp(Math.max(x0 + w / 2, Math.min(x1 - w / 2, px))), y: dp(up ? py - 1.1 : py + 1.1 + fs * 0.8), text, anchor: 'middle' } };
    const right = px + 1.2 + w <= x1;
    return { x: dp(px), y: dp(py), m, label: { x: dp(right ? px + 1.2 : px - 1.2), y: dp(py + fs * 0.35), text, anchor: right ? 'start' : 'end' } };
  };
  const ve = lenKm * 1000 / plotW / ((yMax - yMin) / plotH);
  const exagText = exagWords(ve);
  const ends = it.ends ? 2 * (textWidthMm('B', pt, true) + 2) : 0;
  return {
    ok: plotW >= 8 && plotH >= 6, fs, x0: dp(x0), y0: dp(y0), x1: dp(x1), y1: dp(y1), xt, yt, tick,
    xNumY: dp(y1 + tick + gap + fs * 0.8), xTitleY: dp(y1 + tick + gap + fs * 0.8 + fs * 1.35), topY: dp(topRow - fs * 0.35),
    yNumX: dp(x0 - tick - gap), yTitleX: dp(fs * 0.85),
    line, area,
    lo: mark(iLo, false, it.extremes && hi - lo >= 0.5), hi: mark(iHi, true, it.extremes),
    exag: ve, exagText, exagFits: textWidthMm(exagText, pt, bold) + ends <= plotW,
  };
}
