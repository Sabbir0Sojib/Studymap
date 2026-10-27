// Map grid in the manner of the QGIS map grid properties: grid type, units, frame style and per-side coordinates.
import type { FrameProjection } from './projection';
import type { Graticule, GraticuleLabel } from './carto';
import type { MapItem } from './store.svelte';

export type GridType = 'lines' | 'crosses' | 'frame';
export type FrameStyle = 'none' | 'zebra' | 'ticks-out' | 'ticks-in' | 'ticks-both' | 'line';
export type Side = 'left' | 'right' | 'top' | 'bottom';
/** what each side shows: all values, latitude/northing only, longitude/easting only, nothing */
export interface SideAnn { show: 'all' | 'lat' | 'lon' | 'none'; pos: 'out' | 'in'; dir: 'h' | 'v' }

export interface GridSettings {
  type: GridType;
  units: 'degrees' | 'metres';
  stepM: number | 'auto';
  linePt: number;
  dash: boolean;
  frame: FrameStyle;
  frameSize: number; // mm: zebra band width or tick length
  gap: number; // mm between frame (or zebra) and the coordinates
  ann: Record<Side, SideAnn>;
}

/** The grid's effective settings, filling in defaults for maps made before these options existed. */
export function gridSettings(g: MapItem['grid']): GridSettings {
  const all = g.sides === 'all';
  return {
    type: g.type ?? (g.lines ? 'lines' : 'frame'),
    units: g.units ?? 'degrees',
    stepM: g.stepM ?? 'auto',
    linePt: g.linePt ?? 0.25,
    dash: g.dash ?? false,
    frame: g.frame ?? 'ticks-out',
    frameSize: g.frameSize ?? 1,
    gap: g.gap ?? 0.4,
    ann: g.ann ?? {
      left: { show: 'lat', pos: 'out', dir: 'v' },
      bottom: { show: 'lon', pos: 'out', dir: 'h' },
      top: { show: all ? 'lon' : 'none', pos: 'out', dir: 'h' },
      right: { show: all ? 'lat' : 'none', pos: 'out', dir: 'v' },
    },
  };
}

const NICE_M = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];

/** A grid of map units (metres): Easting/Northing lines of the map's own projected CRS, e.g. UTM. */
export function buildProjectedGrid(fp: FrameProjection, step: number | 'auto'): Graticule | null {
  if (/\+proj=(longlat|latlong|lonlat|latlon)\b/.test(fp.crs.proj4)) return null;
  const w = fp.widthMm, h = fp.heightMm;
  // CRS box covering the (possibly rotated) frame
  const corners = [[0, 0], [w, 0], [0, h], [w, h]].map((p) => fp.toCrs(p as [number, number]));
  const X0 = Math.min(...corners.map((c) => c[0])), X1 = Math.max(...corners.map((c) => c[0]));
  const Y0 = Math.min(...corners.map((c) => c[1])), Y1 = Math.max(...corners.map((c) => c[1]));
  const span = Math.max(X1 - X0, Y1 - Y0);
  // The lines run a little beyond the frame (clipped by the map frame when drawn). On an unrotated map the CRS box
  // is exactly the frame, so the line ends would sit on the edges and floating-point noise could make a line miss
  // the left or top edge (no label there); with the overshoot every line clearly crosses both of its edges.
  const over = 5 / (fp.k > 0 ? fp.k : 1);
  const auto = NICE_M.find((v) => span / v <= 5) ?? 2000000;
  // a fixed interval too fine for this view (more than about 60 lines) or wider than the whole view (no lines at all)
  // is replaced by the automatic one
  const s = step === 'auto' || !(step > 0) || span / step > 60 || span / step < 1 ? auto : step;
  const fmt = (v: number, axis: 'lat' | 'lon') => `${Math.round(v).toLocaleString('en-US').replace(/,/g, ' ')} ${axis === 'lon' ? 'E' : 'N'}`;
  const segs: string[] = [];
  const labels: GraticuleLabel[] = [];
  const crosses: [number, number][] = [];
  const line = (a: [number, number], b: [number, number], axis: 'lat' | 'lon', value: number) => {
    const p = fp.fromCrs(a), q = fp.fromCrs(b);
    segs.push(`M${p[0].toFixed(3)},${p[1].toFixed(3)}L${q[0].toFixed(3)},${q[1].toFixed(3)}`);
    edgeHits(p, q, w, h, (x, y, side) => labels.push({ x, y, side, axis, text: fmt(value, axis) }));
  };
  for (let X = Math.ceil(X0 / s) * s; X <= X1; X += s) line([X, Y0 - over], [X, Y1 + over], 'lon', X);
  for (let Y = Math.ceil(Y0 / s) * s; Y <= Y1; Y += s) line([X0 - over, Y], [X1 + over, Y], 'lat', Y);
  for (let X = Math.ceil(X0 / s) * s; X <= X1; X += s) {
    for (let Y = Math.ceil(Y0 / s) * s; Y <= Y1; Y += s) {
      const p = fp.fromCrs([X, Y]);
      if (p[0] > 0 && p[0] < w && p[1] > 0 && p[1] < h) crosses.push(p);
    }
  }
  return { lines: segs.join(''), labels, step: s, crosses };
}

/** Where the segment p-q crosses the frame edges. */
export function edgeHits(p: [number, number], q: [number, number], w: number, h: number, hit: (x: number, y: number, side: Side) => void) {
  for (const [edge, side, horiz] of [[0, 'top', true], [h, 'bottom', true], [0, 'left', false], [w, 'right', false]] as const) {
    const a = horiz ? p[1] : p[0], b = horiz ? q[1] : q[0];
    if ((a - edge) * (b - edge) > 0 || a === b) continue;
    const t = (edge - a) / (b - a);
    const x = horiz ? p[0] + t * (q[0] - p[0]) : edge, y = horiz ? edge : p[1] + t * (q[1] - p[1]);
    if (horiz ? x > 0.5 && x < w - 0.5 : y > 0.5 && y < h - 0.5) hit(x, y, side);
  }
}

export interface GridDecor {
  ticks: string; // path
  zebra: { x: number; y: number; w: number; h: number; dark: boolean }[];
  texts: { x: number; y: number; text: string; anchor: 'start' | 'middle' | 'end'; rotate: number }[];
  crosses: string; // path
}

/** Frame ticks, zebra bands, crosses and placed coordinate texts, in map-frame mm. */
export function gridDecor(gr: Graticule, st: GridSettings, w: number, h: number, fontMm: number): GridDecor {
  const fs = fontMm;
  const size = st.frameSize;
  let ticks = '';
  const zebra: GridDecor['zebra'] = [];
  const texts: GridDecor['texts'] = [];

  // ticks where a grid line meets the frame, only on the sides that carry coordinates (a tick with no number beside
  // it is a mark nobody can read; the grid lines themselves still run to every edge)
  if (st.frame.startsWith('ticks')) {
    const out = st.frame !== 'ticks-in', inn = st.frame !== 'ticks-out';
    for (const l of gr.labels) {
      const an = st.ann[l.side];
      if (!an || an.show === 'none' || (an.show !== 'all' && an.show !== l.axis)) continue;
      const [nx, ny] = l.side === 'top' ? [0, -1] : l.side === 'bottom' ? [0, 1] : l.side === 'left' ? [-1, 0] : [1, 0];
      const a = inn ? -size : 0, b = out ? size : 0;
      ticks += `M${(l.x + nx * a).toFixed(3)},${(l.y + ny * a).toFixed(3)}L${(l.x + nx * b).toFixed(3)},${(l.y + ny * b).toFixed(3)}`;
    }
  }
  // zebra: alternate black and white between crossings, outside the frame
  if (st.frame === 'zebra') {
    for (const side of ['top', 'bottom', 'left', 'right'] as Side[]) {
      const horiz = side === 'top' || side === 'bottom';
      const len = horiz ? w : h;
      // the lines of one axis only (on a rotated map both kinds can meet a side), at least 0.5 mm apart
      const own = gr.labels.filter((l) => l.side === side);
      const axis = horiz ? 'lon' : 'lat';
      const pick = own.some((l) => l.axis === axis) ? own.filter((l) => l.axis === axis) : own;
      const hits = pick.map((l) => (horiz ? l.x : l.y)).sort((a, b) => a - b).filter((v, i, arr) => i === 0 || v - arr[i - 1] > 0.5);
      // Each grid interval is split into bars about 4-6 mm long, so the frame reads as a zebra and still
      // changes colour exactly at every grid line.
      const spacing = hits.length > 1 ? (hits[hits.length - 1] - hits[0]) / (hits.length - 1) : len;
      const n = Math.max(1, Math.round(spacing / 5));
      const part = Math.max(0.5, spacing / n);
      const cuts: number[] = [];
      if (hits.length) {
        for (let v = hits[0]; v > 0; v -= part) cuts.unshift(v);
        for (let v = hits[0] + part; v < len; v += part) cuts.push(v);
      }
      const all = [0, ...cuts.filter((v) => v > 0.05 && v < len - 0.05), len];
      const uniq = all.filter((v, i) => i === 0 || v - all[i - 1] > 0.05);
      for (let i = 0; i + 1 < uniq.length; i++) {
        const a = uniq[i], b = uniq[i + 1];
        const dark = i % 2 === 0;
        if (side === 'top') zebra.push({ x: a, y: -size, w: b - a, h: size, dark });
        if (side === 'bottom') zebra.push({ x: a, y: h, w: b - a, h: size, dark });
        if (side === 'left') zebra.push({ x: -size, y: a, w: size, h: b - a, dark });
        if (side === 'right') zebra.push({ x: w, y: a, w: size, h: b - a, dark });
      }
    }
    for (const [x, y] of [[-size, -size], [w, -size], [-size, h], [w, h]]) zebra.push({ x, y, w: size, h: size, dark: true });
  }

  // coordinates, side by side
  const outset = (st.frame === 'zebra' || st.frame === 'ticks-out' || st.frame === 'ticks-both' ? size : 0) + st.gap;
  const inset = (st.frame === 'ticks-in' || st.frame === 'ticks-both' ? size : 0) + st.gap;
  const used: Record<Side, { a: number; b: number }[]> = { left: [], right: [], top: [], bottom: [] };
  for (const l of gr.labels) {
    const a = st.ann[l.side];
    if (a.show === 'none' || (a.show !== 'all' && a.show !== l.axis)) continue;
    // skip a label that would overlap the previous one on the same side
    const along = l.side === 'top' || l.side === 'bottom' ? l.x : l.y;
    const half = (a.dir === 'h') === (l.side === 'top' || l.side === 'bottom') ? l.text.length * fs * 0.28 : fs * 0.6;
    if (used[l.side].some((u) => along + half > u.a && along - half < u.b)) continue;
    used[l.side].push({ a: along - half - 0.6, b: along + half + 0.6 });
    const o = a.pos === 'out' ? outset : inset;
    const t = l.text;
    switch (l.side) {
      case 'bottom':
        if (a.pos === 'out') texts.push(a.dir === 'h' ? { x: l.x, y: h + o + fs * 0.75, text: t, anchor: 'middle', rotate: 0 } : { x: l.x + fs * 0.35, y: h + o, text: t, anchor: 'end', rotate: -90 });
        else texts.push(a.dir === 'h' ? { x: l.x, y: h - o - fs * 0.2, text: t, anchor: 'middle', rotate: 0 } : { x: l.x + fs * 0.35, y: h - o, text: t, anchor: 'start', rotate: -90 });
        break;
      case 'top':
        if (a.pos === 'out') texts.push(a.dir === 'h' ? { x: l.x, y: -o - fs * 0.2, text: t, anchor: 'middle', rotate: 0 } : { x: l.x + fs * 0.35, y: -o, text: t, anchor: 'start', rotate: -90 });
        else texts.push(a.dir === 'h' ? { x: l.x, y: o + fs * 0.75, text: t, anchor: 'middle', rotate: 0 } : { x: l.x + fs * 0.35, y: o, text: t, anchor: 'end', rotate: -90 });
        break;
      case 'left':
        if (a.pos === 'out') texts.push(a.dir === 'v' ? { x: -o - fs * 0.2, y: l.y, text: t, anchor: 'middle', rotate: -90 } : { x: -o, y: l.y + fs * 0.35, text: t, anchor: 'end', rotate: 0 });
        else texts.push(a.dir === 'v' ? { x: o + fs * 0.75, y: l.y, text: t, anchor: 'middle', rotate: -90 } : { x: o, y: l.y + fs * 0.35, text: t, anchor: 'start', rotate: 0 });
        break;
      case 'right':
        if (a.pos === 'out') texts.push(a.dir === 'v' ? { x: w + o + fs * 0.2, y: l.y, text: t, anchor: 'middle', rotate: 90 } : { x: w + o, y: l.y + fs * 0.35, text: t, anchor: 'start', rotate: 0 });
        else texts.push(a.dir === 'v' ? { x: w - o - fs * 0.75, y: l.y, text: t, anchor: 'middle', rotate: 90 } : { x: w - o, y: l.y + fs * 0.35, text: t, anchor: 'end', rotate: 0 });
        break;
    }
  }

  const c = 0.9; // half cross size, mm
  const crosses = st.type === 'crosses' ? (gr.crosses ?? []).map(([x, y]) => `M${(x - c).toFixed(2)},${y.toFixed(2)}h${2 * c}M${x.toFixed(2)},${(y - c).toFixed(2)}v${2 * c}`).join('') : '';
  return { ticks, zebra, texts, crosses };
}
