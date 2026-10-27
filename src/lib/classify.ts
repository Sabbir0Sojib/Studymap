// Colouring areas from a table (a choropleth): reading the table, matching its names to the areas on the map, grouping
// the values into classes (equal intervals, quantiles, natural breaks, typed limits, or one colour per value),
// colour ramps that stay readable for colour-blind readers, and the numbers as written in the legend.
import Papa from 'papaparse';
import type { ChoroConfig } from './store.svelte';
import { t } from './i18n.svelte';

/* ---------- colours ---------- */

/** Colour-blind-safe colours for categories: Okabe-Ito without its yellow, then Tol's "bright" set. */
export const CAT_COLOURS = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#000000', '#EE6677', '#228833', '#AA3377', '#66CCEE', '#BBBBBB'];

export const PALETTES: { id: ChoroConfig['palette']; label: string; stops: string[]; from: number }[] = [
  { id: 'viridis', label: 'Viridis', from: 0, stops: ['#440154', '#482878', '#3E4989', '#31688E', '#26828E', '#1F9E89', '#35B779', '#6DCD59', '#B4DE2C', '#FDE725'] },
  { id: 'blues', label: 'Blues', from: 0.12, stops: ['#F7FBFF', '#DEEBF7', '#C6DBEF', '#9ECAE1', '#6BAED6', '#4292C6', '#2171B5', '#08519C', '#08306B'] },
  { id: 'greens', label: 'Greens', from: 0.12, stops: ['#F7FCF5', '#E5F5E0', '#C7E9C0', '#A1D99B', '#74C476', '#41AB5D', '#238B45', '#006D2C', '#00441B'] },
  { id: 'oranges', label: 'Oranges', from: 0.12, stops: ['#FFF5EB', '#FEE6CE', '#FDD0A2', '#FDAE6B', '#FD8D3C', '#F16913', '#D94801', '#A63603', '#7F2704'] },
  { id: 'diverging', label: 'Orange to purple', from: 0, stops: ['#7F3B08', '#B35806', '#E08214', '#FDB863', '#FEE0B6', '#F7F7F7', '#D8DAEB', '#B2ABD2', '#8073AC', '#542788', '#2D004B'] },
];

const hex2rgb = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const rgb2hex = (c: number[]) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** The colour at position t (0 to 1) along a ramp. */
function along(stops: string[], t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x));
  const f = x - i;
  const a = hex2rgb(stops[i]), b = hex2rgb(stops[i + 1]);
  return rgb2hex(a.map((v, k) => v + (b[k] - v) * f));
}

/** n colours from a palette, lightest (or first) to darkest; `reverse` turns the ramp round. */
export function rampColours(id: ChoroConfig['palette'], n: number, reverse = false): string[] {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const out = Array.from({ length: n }, (_, i) => along(p.stops, p.from + (1 - p.from) * (n === 1 ? 0.5 : i / (n - 1))));
  return reverse ? out.reverse() : out;
}

/** A strip of the whole ramp as a CSS gradient, for the palette picker. */
export function rampCss(id: ChoroConfig['palette'], reverse = false): string {
  const p = PALETTES.find((x) => x.id === id) ?? PALETTES[0];
  const cols = Array.from({ length: 6 }, (_, i) => along(p.stops, p.from + (1 - p.from) * (i / 5)));
  return `linear-gradient(90deg, ${(reverse ? cols.reverse() : cols).join(', ')})`;
}

/* ---------- numbers ---------- */

/** A number as it is typed in a table: "1,234", "12.5%", "3 400", "−7" are read; anything else is not a number. */
export function toNumber(raw: unknown): number | null {
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  if (raw == null) return null;
  let s = String(raw).trim().replace(/−/g, '-').replace(/[\s ]/g, '');
  if (!s) return null;
  s = s.replace(/%$/, '');
  // "1,234" and "1,234,567" are thousands; "12,5" is a decimal comma
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const fmtCache = new Map<number, Intl.NumberFormat>();
/** A number with thousands separators and a fixed number of decimals ("1,200", "0.25"). */
export function fmtNum(v: number, decimals = 0): string {
  let f = fmtCache.get(decimals);
  if (!f) { f = new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }); fmtCache.set(decimals, f); }
  return f.format(Math.abs(v) < 0.5 * 10 ** -decimals ? 0 : v).replace('-', '−');
}

/** The fewest decimals that keep the class limits apart and true to within about a hundredth of a class. */
export function decimalsFor(breaks: number[]): number {
  if (breaks.length < 2) return 0;
  const range = breaks[breaks.length - 1] - breaks[0];
  const tol = range / ((breaks.length - 1) * 100);
  for (let d = 0; d <= 4; d++) {
    const q = 10 ** d;
    const r = breaks.map((b) => Math.round(b * q) / q);
    const apart = r.every((v, i) => i === 0 || v > r[i - 1]);
    const near = breaks.every((b, i) => Math.abs(b - r[i]) <= tol + 1e-12);
    if (apart && near) return d;
  }
  return 4;
}

/** "0–1,200", "1,200–2,500", …: the first starts at the smallest value rounded down, the last ends at the largest rounded up. */
export function classLabels(breaks: number[], dec = decimalsFor(breaks)): string[] {
  const q = 10 ** dec;
  const n = breaks.length - 1;
  const edge = (i: number) => (i === 0 ? Math.floor(breaks[0] * q + 1e-9) / q : i === n ? Math.ceil(breaks[n] * q - 1e-9) / q : Math.round(breaks[i] * q) / q);
  return Array.from({ length: n }, (_, i) => {
    const lo = edge(i), hi = edge(i + 1);
    const a = fmtNum(lo, dec), b = fmtNum(hi, dec);
    return a.includes('−') || b.includes('−') ? `${a} – ${b}` : `${a}–${b}`;
  });
}

/* ---------- classes ---------- */

/** Natural breaks (Fisher–Jenks): class limits that make the values inside each class as alike as they can be. Returns k+1 limits, lowest first. */
export function jenks(data: number[], k: number): number[] {
  const v = data.slice().sort((a, b) => a - b);
  const n = v.length;
  if (n === 0) return [];
  k = Math.max(1, Math.min(k, new Set(v).size));
  if (k === 1) return [v[0], v[n - 1]];
  const lower = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(0));
  const vc = Array.from({ length: n + 1 }, () => new Array<number>(k + 1).fill(Infinity));
  for (let j = 1; j <= k; j++) { lower[1][j] = 1; vc[1][j] = 0; }
  for (let l = 2; l <= n; l++) {
    let sum = 0, sq = 0, w = 0, variance = 0;
    for (let m = 1; m <= l; m++) {
      const lc = l - m + 1;
      const val = v[lc - 1];
      w++; sum += val; sq += val * val;
      variance = sq - (sum * sum) / w;
      const prev = lc - 1;
      if (prev !== 0) {
        for (let j = 2; j <= k; j++) {
          if (vc[l][j] >= variance + vc[prev][j - 1]) { lower[l][j] = lc; vc[l][j] = variance + vc[prev][j - 1]; }
        }
      }
    }
    lower[l][1] = 1;
    vc[l][1] = variance;
  }
  const out = new Array<number>(k + 1);
  out[k] = v[n - 1];
  out[0] = v[0];
  let c = k, at = n;
  while (c > 1) {
    out[c - 1] = v[lower[at][c] - 2];
    at = lower[at][c] - 1;
    c--;
  }
  return out;
}

/** Class limits for the numbers, lowest first (k+1 of them; fewer when the values cannot fill k classes). A value belongs to the first class whose upper limit it does not pass. */
export function breaksFor(values: number[], method: ChoroConfig['method'], k: number, custom?: number[]): number[] {
  if (!values.length) return [];
  const v = values.slice().sort((a, b) => a - b);
  const lo = v[0], hi = v[v.length - 1];
  let b: number[];
  if (method === 'custom' && custom && custom.length >= 2) {
    b = custom.slice().sort((a, c) => a - c);
    // the typed limits are kept; the outer ones stretch to cover every value
    if (b[0] > lo) b[0] = lo;
    if (b[b.length - 1] < hi) b[b.length - 1] = hi;
  } else if (method === 'jenks') b = jenks(v, k);
  else if (method === 'quantile') {
    b = [lo];
    for (let i = 1; i < k; i++) {
      const pos = (i / k) * (v.length - 1);
      const f = Math.floor(pos);
      b.push(v[f] + (v[Math.min(f + 1, v.length - 1)] - v[f]) * (pos - f));
    }
    b.push(hi);
  } else {
    b = Array.from({ length: k + 1 }, (_, i) => lo + ((hi - lo) * i) / k);
  }
  // limits that coincide make an empty class: leave it out
  const out = [b[0]];
  for (let i = 1; i < b.length; i++) if (b[i] > out[out.length - 1]) out.push(b[i]);
  if (out.length < 2) out.push(out[0]);
  return out;
}

export function classOf(v: number, breaks: number[]): number {
  const n = breaks.length - 1;
  for (let i = 0; i < n; i++) if (v <= breaks[i + 1]) return i;
  return Math.max(0, n - 1);
}

/* ---------- names ---------- */

// Spellings that differ between sources (the official name, an older one, a transliteration).
const ALIAS: Record<string, string> = {
  chittagong: 'chattogram', comilla: 'cumilla', barisal: 'barishal', bogra: 'bogura', jessore: 'jashore', dacca: 'dhaka',
  maimensingh: 'mymensingh', mymensing: 'mymensingh', netrokona: 'netrakona', jhenaidah: 'jhenidah',
  coxbazar: 'coxsbazar', moulvibazar: 'maulvibazar', maulavibazar: 'maulvibazar',
  narshingdi: 'narsingdi', narsinghdi: 'narsingdi', munsiganj: 'munshiganj', shavar: 'savar', sileth: 'sylhet',
};

/** The name with case, accents, spaces and punctuation taken away ("Cox's Bazar" and "COXS-BAZAR" are the same). */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9ঀ-৿]+/g, '');
}
const loose = (s: string): string => {
  let n = norm(s).replace(/gonj/g, 'ganj').replace(/(.)\1+/g, '$1');
  const a = ALIAS[n] ?? ALIAS[norm(s)];
  if (a) n = a.replace(/gonj/g, 'ganj').replace(/(.)\1+/g, '$1');
  return n;
};
// "Savar Upazila", "Mirpur Thana", "Dhaka District": the kind of unit written after the name
const bare = (s: string): string => loose(s.toLowerCase().replace(/\b(upazila|upazilla|upozila|thana|district|zila|zilla|city corporation|city|metropolitan|pourashava|municipality|division)\b/g, ' '));

/**
 * Match the names in a table to the names of the areas. Exact (ignoring case, spaces and punctuation) first, then known
 * variant spellings, then the name without "Upazila", "Thana" or "District". `fix` holds the pairs chosen by hand.
 * Returns table name -> area name (or null when nothing fits).
 */
export function matchNames(tableNames: string[], areaNames: string[], fix: Record<string, string> = {}): Map<string, string | null> {
  const out = new Map<string, string | null>();
  const taken = new Set<string>();
  const areas = [...new Set(areaNames)];
  const todo = [...new Set(tableNames)];
  for (const t of todo) {
    const f = fix[t];
    if (f !== undefined) { out.set(t, f && areas.includes(f) ? f : null); if (f) taken.add(f); }
  }
  for (const key of [norm, loose, bare]) {
    const byKey = new Map<string, string[]>();
    for (const a of areas) { if (taken.has(a)) continue; const k = key(a); if (k) byKey.set(k, [...(byKey.get(k) ?? []), a]); }
    for (const t of todo) {
      if (out.has(t)) continue;
      const hit = byKey.get(key(t));
      // two areas with the same name cannot be told apart by a table: the first takes it
      if (hit?.length) { out.set(t, hit[0]); if (hit.length === 1) taken.add(hit[0]); }
    }
  }
  for (const t of todo) if (!out.has(t)) out.set(t, null);
  return out;
}

/* ---------- the table ---------- */

export interface Table { head: string[]; rows: string[][] }

/** A pasted or opened table: the first row is the headers. Commas, tabs (pasted from Excel) and semicolons are all read. */
export function parseTable(text: string): Table {
  const res = Papa.parse<string[]>(text.replace(/^﻿/, '').trim(), { header: false, skipEmptyLines: 'greedy' });
  const all = (res.data as string[][]).map((r) => r.map((c) => String(c ?? '').trim()));
  const width = Math.max(0, ...all.map((r) => r.length));
  if (all.length > 6001) throw new Error(t('This table has more than 6,000 rows. Keep the rows for the areas on the map.'));
  if (all.length < 2 || width < 2) throw new Error(t('Need a table with a row of column names and at least one more row, with a name column and a value column.'));
  const head = Array.from({ length: width }, (_, i) => all[0][i] || `Column ${i + 1}`);
  // two columns with the same heading would be one: number the later one
  const seen = new Map<string, number>();
  const uniq = head.map((h) => { const n = (seen.get(h) ?? 0) + 1; seen.set(h, n); return n === 1 ? h : `${h} (${n})`; });
  return { head: uniq, rows: all.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')) };
}

/** Which columns most likely hold the names and the values. */
export function guessColumns(t: Table): { name: string; value: string } {
  const numeric = t.head.map((_, i) => {
    const cells = t.rows.map((r) => r[i]).filter((c) => c !== '');
    return cells.length > 0 && cells.filter((c) => toNumber(c) !== null).length / cells.length > 0.6;
  });
  const byWord = t.head.findIndex((h, i) => !numeric[i] && /name|upazila|thana|district|zila|area|unit|place|region|division|ward/i.test(h));
  const firstText = numeric.findIndex((x) => !x);
  const ni = byWord >= 0 ? byWord : firstText >= 0 ? firstText : 0;
  let vi = t.head.findIndex((_, i) => i !== ni && numeric[i]);
  if (vi < 0) vi = t.head.findIndex((_, i) => i !== ni);
  return { name: t.head[ni], value: t.head[Math.max(0, vi)] };
}

/* ---------- the result ---------- */

export interface ChoroResult {
  /** area name -> its colour (areas with a value) */
  colours: Map<string, string>;
  /** the legend: one entry per class, or per value */
  legend: { label: string; colour: string; key?: string }[];
  /** areas of the layer with no value */
  noData: Set<string>;
  /** the table's rows: how many, how many matched, the names that did not, and the values that are not numbers */
  rows: number;
  matched: number;
  unmatched: string[];
  notNumbers: number;
  /** each table name and the area it went to (null = none) */
  pairs: Map<string, string | null>;
  breaks: number[];
  categories: boolean;
}

const memo = new Map<string, ChoroResult>();
// a table is replaced as a whole when new data is loaded, never changed in place, so the object itself names it
const tableIds = new WeakMap<object, number>();
let tableSeq = 0;
const tableId = (t: object) => { let id = tableIds.get(t); if (id === undefined) { id = ++tableSeq; tableIds.set(t, id); } return id; };

/** Work out the colours of every area for a table (cached: the legend, the figure and the checks all ask). */
export function resolveChoro(c: ChoroConfig, areaNames: string[]): ChoroResult {
  const key = JSON.stringify([tableId(c.table), c.nameCol, c.field, c.fix, c.method, c.classes, c.palette, c.reverse, c.breaks, c.cats]) + '|' + areaNames.join('\u0001');
  const hit = memo.get(key);
  if (hit) return hit;
  const ni = c.table.head.indexOf(c.nameCol), vi = c.table.head.indexOf(c.field);
  const rows = c.table.rows.map((r) => ({ name: (r[ni] ?? '').trim(), raw: (r[vi] ?? '').trim() })).filter((r) => r.name);
  const pairs = matchNames(rows.map((r) => r.name), areaNames, c.fix);
  const byArea = new Map<string, string>();
  for (const r of rows) { const a = pairs.get(r.name); if (a && r.raw !== '') byArea.set(a, r.raw); }
  const categories = c.method === 'categories';
  const colours = new Map<string, string>();
  const legend: ChoroResult['legend'] = [];
  let breaks: number[] = [];
  let notNumbers = 0;
  if (categories) {
    const vals = [...new Set([...byArea.values()])];
    vals.forEach((v, i) => {
      const own = c.cats?.[v];
      legend.push({ label: own?.label?.trim() || v, colour: own?.color ?? CAT_COLOURS[i % CAT_COLOURS.length], key: v });
    });
    for (const [a, v] of byArea) colours.set(a, legend[vals.indexOf(v)].colour);
  } else {
    const nums = new Map<string, number>();
    for (const [a, raw] of byArea) { const n = toNumber(raw); if (n === null) notNumbers++; else nums.set(a, n); }
    const k = Math.max(1, Math.min(7, Math.round(c.classes)));
    breaks = breaksFor([...nums.values()], c.method, k, c.breaks);
    if (breaks.length >= 2) {
      const n = breaks.length - 1;
      const cols = rampColours(c.palette, n, !!c.reverse);
      const labels = classLabels(breaks);
      for (let i = 0; i < n; i++) legend.push({ label: labels[i], colour: cols[i] });
      for (const [a, v] of nums) colours.set(a, cols[classOf(v, breaks)]);
    }
  }
  const noData = new Set(areaNames.filter((a) => !colours.has(a)));
  const matched = rows.filter((r) => pairs.get(r.name)).length;
  const res: ChoroResult = { colours, legend, noData, rows: rows.length, matched, unmatched: [...pairs].filter(([, a]) => !a).map(([t]) => t), notNumbers, pairs, breaks, categories };
  if (memo.size > 40) memo.clear();
  memo.set(key, res);
  return res;
}
