// Cartographic furniture: graticule, DMS labels, scale bar maths, north direction.
import type { FrameProjection } from './projection';
import { frameLonLatBounds } from './projection';
import { edgeHits } from './grid';

export type LabelFormat = 'dms' | 'dm' | 'dd';

const STEPS_DEG = [90, 45, 30, 20, 15, 10, 5, 2, 1, 30 / 60, 20 / 60, 15 / 60, 10 / 60, 5 / 60, 2 / 60, 1 / 60, 30 / 3600, 15 / 3600, 10 / 3600, 5 / 3600, 2 / 3600, 1 / 3600];

/** Pick a graticule step that gives about `target` lines across the larger span. */
export function autoInterval(spanDeg: number, target = 4): number {
  for (const s of STEPS_DEG) if (spanDeg / s >= target - 1) return s;
  return STEPS_DEG[STEPS_DEG.length - 1];
}

export function formatCoord(value: number, axis: 'lat' | 'lon', fmt: LabelFormat, step: number): string {
  const hemi = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const v = Math.abs(value);
  // 0° and the 180° meridian are neither east nor west
  const zero = Math.abs(value) < 1e-9 || (axis === 'lon' && Math.abs(v - 180) < 1e-9);
  const h = zero ? '' : hemi;
  if (fmt === 'dd') {
    // enough decimals to tell neighbouring lines apart: 0.25° → 2, 10″ → 4
    let decimals = 0;
    while (decimals < 4 && Math.abs(step * 10 ** decimals - Math.round(step * 10 ** decimals)) > 1e-6) decimals++;
    return `${v.toFixed(decimals)}°${h}`;
  }
  let d = Math.floor(v + 1e-9);
  let mFloat = (v - d) * 60;
  // Steps finer than a minute need seconds whatever the chosen format, or every label reads the same.
  if (step >= 1 / 60 - 1e-12) {
    let m = Math.round(mFloat);
    if (m === 60) { d += 1; m = 0; }
    if (step >= 1 && m === 0) return `${d}°${h}`;
    return `${d}°${String(m).padStart(2, '0')}′${h}`;
  }
  let m = Math.floor(mFloat + 1e-9);
  let s = Math.round((mFloat - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  if (m === 60) { d += 1; m = 0; }
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${h}`;
}

export interface GraticuleLabel {
  x: number;
  y: number;
  text: string;
  side: 'top' | 'bottom' | 'left' | 'right';
  /** lat = a parallel (or northing) line, lon = a meridian (or easting) line */
  axis: 'lat' | 'lon';
}

export interface Graticule {
  lines: string; // SVG path in frame mm
  labels: GraticuleLabel[];
  step: number;
  /** grid intersections inside the frame (for a crosses grid) */
  crosses?: [number, number][];
}

/** Build a graticule clipped to the frame, with labels where lines cross the frame edges. */
export function buildGraticule(fp: FrameProjection, stepDeg: number | 'auto', fmt: LabelFormat): Graticule | null {
  const b = frameLonLatBounds(fp);
  if (!b) return null;
  // With a pole inside the frame every meridian meets there: the interval follows the latitudes, and the meridians
  // are kept at least 30° apart so they do not crowd into a black star at the pole.
  const polar = b[1][1] >= 90 || b[0][1] <= -90;
  const span = polar ? b[1][1] - b[0][1] : Math.max(b[1][0] - b[0][0], b[1][1] - b[0][1]);
  // A fixed interval kept from another view is replaced by the automatic one when it would mean thousands of lines
  // (more than about 60 per axis) or none at all (wider than the whole view).
  const step = stepDeg === 'auto' || !(stepDeg > 0) || span / stepDeg > 60 || span / stepDeg < 1 ? autoInterval(span) : stepDeg;
  const lonStep = polar ? Math.max(step, 30) : step;
  const w = fp.widthMm, h = fp.heightMm;
  const segs: string[] = [];
  const labels: GraticuleLabel[] = [];
  const dens = Math.max(step / 40, span / 400);

  const lon0 = Math.ceil(b[0][0] / lonStep - 1e-9) * lonStep;
  const lonEnd = polar ? b[1][0] - lonStep / 2 : b[1][0]; // -180 and 180 are the same meridian
  const lat0 = Math.ceil(b[0][1] / step - 1e-9) * step;

  const trace = (pts: [number, number][], axis: 'lat' | 'lon', value: number) => {
    let d = '';
    let prev: [number, number] | null = null;
    for (const p of pts) {
      const q = fp.forward(p);
      if (!q) { prev = null; continue; }
      if (prev) {
        // where this line meets any edge of the frame (any edge, so a rotated map is labelled too)
        edgeHits(prev, q, w, h, (x, y, side) => {
          if (!labels.some((l) => l.side === side && Math.abs(l.x - x) < 0.01 && Math.abs(l.y - y) < 0.01)) labels.push({ x, y, text: formatCoord(value, axis, fmt, step), side, axis });
        });
      }
      d += `${prev ? 'L' : 'M'}${q[0].toFixed(3)},${q[1].toFixed(3)}`;
      prev = q;
    }
    segs.push(d);
  };

  const latMin = Math.max(-89.9, b[0][1] - step), latMax = Math.min(89.9, b[1][1] + step);
  const lonMin = b[0][0] - step, lonMax = b[1][0] + step;
  for (let lon = lon0; lon <= lonEnd + 1e-9; lon += lonStep) {
    const pts: [number, number][] = [];
    for (let lat = latMin; lat <= latMax; lat += dens) pts.push([lon, lat]);
    pts.push([lon, latMax]);
    trace(pts, 'lon', round(lonLabel(lon)));
  }
  for (let lat = lat0; lat <= b[1][1] + 1e-9; lat += step) {
    const pts: [number, number][] = [];
    for (let lon = lonMin; lon <= lonMax; lon += dens) pts.push([lon, lat]);
    pts.push([lonMax, lat]);
    trace(pts, 'lat', round(lat));
  }
  const crosses: [number, number][] = [];
  for (let lon = lon0; lon <= lonEnd + 1e-9; lon += lonStep) {
    for (let lat = lat0; lat <= b[1][1] + 1e-9; lat += step) {
      const q = fp.forward([lon, lat]);
      if (q && q[0] > 0 && q[0] < w && q[1] > 0 && q[1] < h) crosses.push(q);
    }
  }
  return { lines: segs.join(''), labels, step, crosses };
}

const round = (v: number) => Math.round(v * 1e8) / 1e8;
/** A meridian east of 180° (a map across the 180° line) is labelled by its real longitude: 181° is 179°W. */
const lonLabel = (lon: number) => (lon > 180 + 1e-9 ? lon - 360 : lon < -180 - 1e-9 ? lon + 360 : lon);

const R = 6371008.8;
export function haversine(a: [number, number], b: [number, number]): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Distance in metres on the WGS 84 ellipsoid (Vincenty), the shape the map's CRS uses: a sphere is up to 0.5 % off,
 * which a scale bar shows. Falls back to the sphere for nearly opposite points, where the method does not settle.
 */
export function geodesic(a: [number, number], b: [number, number]): number {
  const A = 6378137, F = 1 / 298.257223563, B = A * (1 - F);
  const toRad = Math.PI / 180;
  const L = (b[0] - a[0]) * toRad;
  const U1 = Math.atan((1 - F) * Math.tan(a[1] * toRad)), U2 = Math.atan((1 - F) * Math.tan(b[1] * toRad));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1), sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
  let lambda = L;
  for (let i = 0; i < 100; i++) {
    const sinL = Math.sin(lambda), cosL = Math.cos(lambda);
    const sinSigma = Math.hypot(cosU2 * sinL, cosU1 * sinU2 - sinU1 * cosU2 * cosL);
    if (sinSigma === 0) return 0;
    const cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosL;
    const sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinL) / sinSigma;
    const cos2Alpha = 1 - sinAlpha * sinAlpha;
    const cos2SigmaM = cos2Alpha ? cosSigma - (2 * sinU1 * sinU2) / cos2Alpha : 0;
    const C = (F / 16) * cos2Alpha * (4 + F * (4 - 3 * cos2Alpha));
    const prev = lambda;
    lambda = L + (1 - C) * F * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    if (Math.abs(lambda - prev) < 1e-12) {
      const u2 = (cos2Alpha * (A * A - B * B)) / (B * B);
      const AA = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
      const BB = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
      const dSigma = BB * sinSigma * (cos2SigmaM + (BB / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - (BB / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)));
      return B * AA * (sigma - dSigma);
    }
  }
  return haversine(a, b);
}

/** Ground metres per mm on the page, measured horizontally at a point in the frame. */
export function metresPerMm(fp: FrameProjection, at: [number, number]): number | null {
  const a = fp.inverse([at[0] - 0.5, at[1]]);
  const b = fp.inverse([at[0] + 0.5, at[1]]);
  if (!a || !b) return null;
  return geodesic(a, b);
}

export interface ScaleBarSpec {
  totalMm: number;
  segments: number;
  segmentValue: number; // in display units
  unit: 'km' | 'm' | 'mi';
  /** relative scale variation across the frame, 0 = constant */
  variation: number;
}

// round steps only (1, 2, 5 x 10^n): readers and reviewers find 2.5 km ticks odd
const NICE = [1, 2, 5];
function niceBelow(v: number): number {
  const p = 10 ** Math.floor(Math.log10(v));
  let best = p;
  for (const n of NICE) if (n * p <= v) best = n * p;
  return best;
}

export function scaleBar(fp: FrameProjection, targetMm: number, unitPref: 'metric' | 'imperial', segmentsWanted: number): ScaleBarSpec | null {
  const centre: [number, number] = [fp.widthMm / 2, fp.heightMm / 2];
  const mpm = metresPerMm(fp, centre);
  if (!mpm) return null;
  // Variation: compare top and bottom of frame.
  const top = metresPerMm(fp, [fp.widthMm / 2, fp.heightMm * 0.05]);
  const bot = metresPerMm(fp, [fp.widthMm / 2, fp.heightMm * 0.95]);
  const variation = top && bot ? Math.abs(top - bot) / mpm : 0;

  const groundTarget = mpm * targetMm; // metres
  let unit: ScaleBarSpec['unit'];
  let perUnit: number;
  if (unitPref === 'imperial') { unit = 'mi'; perUnit = 1609.344; }
  else if (groundTarget < 2000) { unit = 'm'; perUnit = 1; }
  else { unit = 'km'; perUnit = 1000; }
  const segs = Math.max(1, segmentsWanted);
  const segValue = niceBelow(groundTarget / perUnit / segs);
  const totalMm = (segValue * segs * perUnit) / mpm;
  return { totalMm, segments: segs, segmentValue: segValue, unit, variation };
}

/** Angle (degrees, clockwise from page-up) of true north at a point in the frame. */
export function trueNorthAngle(fp: FrameProjection, at: [number, number]): number {
  const ll = fp.inverse(at);
  if (!ll) return 0;
  const a = fp.forward(ll);
  // a step north along the meridian; right by the North Pole there is no room, so a step south read backwards
  const up = ll[1] < 89.98;
  const b = fp.forward([ll[0], up ? ll[1] + 0.01 : ll[1] - 0.01]);
  if (!a || !b) return 0;
  const dx = up ? b[0] - a[0] : a[0] - b[0], dy = up ? a[1] - b[1] : b[1] - a[1];
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

export function fmtNumber(v: number): string {
  if (Number.isInteger(v)) return v.toLocaleString('en-US');
  return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
