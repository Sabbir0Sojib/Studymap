// Map projection: proj4 forward/inverse wrapped as a planar fit into a frame measured in mm.
import proj4 from 'proj4';
import { geoClipRectangle, geoPath, geoTransform } from 'd3-geo';
import { simplifyFor, toleranceStep } from './simplify';
import type { GeoPermissibleObjects } from 'd3-geo';

export interface CrsOption {
  code: string; // e.g. "EPSG:32646"
  name: string;
  proj4: string;
  geographic?: boolean;
}

// Well-known definitions so the common cases work offline.
const BUILTIN: Record<string, { name: string; def: string; geographic?: boolean }> = {
  'EPSG:4326': { name: 'WGS 84 (latitude/longitude)', def: '+proj=longlat +datum=WGS84 +no_defs', geographic: true },
  'EPSG:3857': { name: 'WGS 84 / Pseudo-Mercator (web maps)', def: '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +no_defs' },
  'EPSG:9678': { name: 'Gulshan 303 / Bangladesh Transverse Mercator (BTM)', def: '+proj=tmerc +lat_0=0 +lon_0=90 +k=0.9996 +x_0=500000 +y_0=-2000000 +ellps=evrst30 +towgs84=283.729,735.942,261.143,0,0,0,0 +units=m +no_defs' },
  'EPSG:3106': { name: 'Gulshan 303 / TM 90 NE', def: '+proj=tmerc +lat_0=0 +lon_0=90 +k=0.9996 +x_0=500000 +y_0=0 +ellps=evrst30 +towgs84=283.729,735.942,261.143,0,0,0,0 +units=m +no_defs' },
  'EPSG:7755': { name: 'WGS 84 / India NSF LCC', def: '+proj=lcc +lat_0=24 +lon_0=80 +lat_1=12.472955 +lat_2=35.1728044444444 +x_0=4000000 +y_0=4000000 +datum=WGS84 +units=m +no_defs' },
  'EPSG:5070': { name: 'NAD83 / Conus Albers', def: '+proj=aea +lat_0=23 +lon_0=-96 +lat_1=29.5 +lat_2=45.5 +x_0=0 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  'EPSG:3035': { name: 'ETRS89 / LAEA Europe', def: '+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs' },
  'EPSG:8857': { name: 'WGS 84 / Equal Earth Greenwich', def: '+proj=eqearth +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs' },
};

export function utmFor(lon: number, lat: number): CrsOption {
  // UTM stops at 84°N and 80°S: the poles use Universal Polar Stereographic
  if (lat >= 84) return { code: 'EPSG:32661', name: 'WGS 84 / UPS North (N,E)', proj4: '+proj=stere +lat_0=90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs' };
  if (lat < -80) return { code: 'EPSG:32761', name: 'WGS 84 / UPS South (N,E)', proj4: '+proj=stere +lat_0=-90 +lon_0=0 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs' };
  lon = wrapLon(lon);
  let zone = Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
  // the standard exceptions: south-west Norway is in 32V, and Svalbard uses only zones 31, 33, 35 and 37
  if (lat >= 56 && lat < 64 && lon >= 3 && lon < 12) zone = 32;
  if (lat >= 72 && lat < 84 && lon >= 0 && lon < 42) zone = lon < 9 ? 31 : lon < 21 ? 33 : lon < 33 ? 35 : 37;
  const south = lat < 0;
  const code = `EPSG:${south ? 32700 + zone : 32600 + zone}`;
  return {
    code,
    name: `WGS 84 / UTM zone ${zone}${south ? 'S' : 'N'}`,
    proj4: `+proj=utm +zone=${zone}${south ? ' +south' : ''} +datum=WGS84 +units=m +no_defs`,
  };
}

/** Projection suggestions for a study area centred at lon/lat, best first. */
export function suggestCrs(lon: number, lat: number, spanDeg: number): CrsOption[] {
  const out: CrsOption[] = [];
  if (spanDeg > 100) out.push(builtin('EPSG:8857'));
  if (spanDeg < 6) out.push(utmFor(lon, lat));
  // Local Lambert azimuthal equal-area works for any size and keeps areas true.
  out.push(localLaea(lon, lat));
  if (lon > 88 && lon < 93 && lat > 20 && lat < 27) out.push(builtin('EPSG:9678'));
  if (lon > 68 && lon < 98 && lat > 6 && lat < 38) out.push(builtin('EPSG:7755'));
  if (lon > -125 && lon < -66 && lat > 24 && lat < 50) out.push(builtin('EPSG:5070'));
  if (lon > -25 && lon < 45 && lat > 34 && lat < 72) out.push(builtin('EPSG:3035'));
  if (spanDeg >= 6) out.push(utmFor(lon, lat));
  out.push(builtin('EPSG:4326'), builtin('EPSG:3857'));
  const seen = new Set<string>();
  return out.filter((c) => (seen.has(c.code) ? false : (seen.add(c.code), true)));
}

export function localLaea(lon: number, lat: number): CrsOption {
  const lo = Math.round(lon * 10) / 10;
  const la = Math.round(lat * 10) / 10;
  return {
    code: `LAEA:${la},${lo}`,
    name: `Lambert azimuthal equal-area, centred ${la}°, ${lo}°`,
    proj4: `+proj=laea +lat_0=${la} +lon_0=${lo} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`,
  };
}

export function builtin(code: string): CrsOption {
  const b = BUILTIN[code];
  return { code, name: b.name, proj4: b.def, geographic: b.geographic };
}

export function isBuiltin(code: string) {
  return code in BUILTIN;
}

/** Look up any EPSG code from epsg.io (needs a connection the first time). */
export async function fetchEpsg(code: number): Promise<CrsOption> {
  const key = `EPSG:${code}`;
  if (BUILTIN[key]) return builtin(key);
  const [defRes, metaRes] = await Promise.all([
    fetch(`https://epsg.io/${code}.proj4`),
    fetch(`https://epsg.io/${code}.json`).catch(() => null),
  ]);
  if (!defRes.ok) throw new Error(`EPSG:${code} was not found.`);
  const def = (await defRes.text()).trim();
  if (!def.startsWith('+')) throw new Error(`EPSG:${code} has no usable definition.`);
  let name = key;
  try {
    const meta = metaRes && metaRes.ok ? await metaRes.json() : null;
    name = meta?.name ?? key;
  } catch {
    /* name stays the code */
  }
  return { code: key, name, proj4: def, geographic: /\+proj=(longlat|latlong|lonlat|latlon)\b/.test(def) };
}

export type Bounds = [[number, number], [number, number]]; // [[x0,y0],[x1,y1]]

export interface FrameProjection {
  crs: CrsOption;
  widthMm: number;
  heightMm: number;
  /** projected coordinates (CRS units) of the frame's centre */
  center: [number, number];
  /** mm per CRS unit */
  k: number;
  /** map rotation, degrees clockwise on the page */
  rot: number;
  /** CRS coordinates -> frame mm (rotation included), and back */
  fromCrs: (xy: [number, number]) => [number, number];
  toCrs: (xy: [number, number]) => [number, number];
  forward: (lonlat: [number, number]) => [number, number] | null;
  inverse: (xyMm: [number, number]) => [number, number] | null;
  path: (obj: GeoPermissibleObjects | null | undefined) => string;
  pathUnclipped: (obj: GeoPermissibleObjects | null | undefined) => string;
  /** label anchor in frame mm (area-weighted centroid of the projected shape) */
  centroid: (obj: GeoPermissibleObjects) => [number, number] | null;
  /** area of the part inside the frame, mm² */
  areaVisible: (obj: GeoPermissibleObjects) => number;
  /** label anchor of the part inside the frame (for neighbours that are only partly on the map) */
  centroidVisible: (obj: GeoPermissibleObjects) => [number, number] | null;
  /** projected area on the page in mm² */
  area: (obj: GeoPermissibleObjects) => number;
}

const converterCache = new Map<string, proj4.Converter>();
function converter(def: string) {
  let c = converterCache.get(def);
  if (!c) {
    c = proj4('EPSG:4326', def);
    converterCache.set(def, c);
  }
  return c;
}

/** Projected bounding box (CRS units) of a list of lon/lat points. */
export function projectedBounds(crs: CrsOption, pts: [number, number][]): Bounds | null {
  const c = converter(crs.proj4);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    const q = c.forward(p);
    if (!isFinite(q[0]) || !isFinite(q[1])) continue;
    if (q[0] < x0) x0 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[0] > x1) x1 = q[0];
    if (q[1] > y1) y1 = q[1];
  }
  return isFinite(x0) ? [[x0, y0], [x1, y1]] : null;
}

/**
 * Fit a CRS into a frame of w x h mm.
 * `center` is in CRS units; `k` is mm per CRS unit.
 */
export function makeFrameProjection(crs: CrsOption, widthMm: number, heightMm: number, center: [number, number], k: number, rot = 0): FrameProjection {
  const c = converter(crs.proj4);
  // Map rotation turns the content about the frame centre (clockwise on the page, as in QGIS).
  const a = (rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
  const cx = widthMm / 2, cy = heightMm / 2;
  const fromCrs = (q: [number, number]): [number, number] => {
    const x = (q[0] - center[0]) * k, y = -(q[1] - center[1]) * k;
    return rot ? [cx + x * cos - y * sin, cy + x * sin + y * cos] : [cx + x, cy + y];
  };
  const toCrs = (xy: [number, number]): [number, number] => {
    let x = xy[0] - cx, y = xy[1] - cy;
    if (rot) { const ux = x * cos + y * sin, uy = -x * sin + y * cos; x = ux; y = uy; }
    return [center[0] + x / k, center[1] - y / k];
  };
  const fwd = (ll: [number, number]): [number, number] | null => {
    const q = c.forward(ll);
    if (!isFinite(q[0]) || !isFinite(q[1])) return null;
    return fromCrs(q as [number, number]);
  };
  const inv = (xy: [number, number]): [number, number] | null => {
    const [X, Y] = toCrs(xy);
    const q = c.inverse([X, Y]);
    if (!isFinite(q[0]) || !isFinite(q[1])) return null;
    return [q[0], q[1]];
  };
  const transform = geoTransform({
    point(this: { stream: { point(x: number, y: number): void } }, lon: number, lat: number) {
      const q = fwd([lon, lat]);
      if (q) this.stream.point(q[0], q[1]);
    },
  });
  const pad = Math.max(widthMm, heightMm) * 0.5;
  const clip = geoClipRectangle(-pad, -pad, widthMm + pad, heightMm + pad);
  // Vertices closer than 0.05 mm on paper are invisible even at 1200 dpi; dropping them keeps the SVG light and fast.
  const clipped = { stream: (s: any) => transform.stream(thin(clip(s), 0.05)) };
  const p0 = geoPath(clipped as any).digits(2);
  // Outlines already turned into this CRS (see crsGeometry) only need the page placement: pan and zoom reuse them
  const placeOnPage = geoTransform({
    point(this: { stream: { point(x: number, y: number): void } }, x: number, y: number) {
      const q = fromCrs([x, y]);
      this.stream.point(q[0], q[1]);
    },
  });
  const pc = geoPath({ stream: (s: any) => placeOnPage.stream(thin(clip(s), 0.05)) } as any).digits(2);
  // converted once per CRS, then thinned in flat CRS units: panning and zooming never call proj4 again
  const stepCrs = toleranceStep(0.04 / k);
  const p = (o: any) => {
    const g = inCrs(o, crs.proj4, c);
    return g ? pc(simplifyFor(g, stepCrs, true)) : p0(simplifyFor(o, step));
  };
  // how many degrees 0.04 mm on the page is here: outlines are thinned to that before they are projected
  const mid = inv([widthMm / 2, heightMm / 2]);
  const near = mid && fwd([mid[0] + 0.01, mid[1]]), here = mid && fwd(mid);
  const mmPerDeg = near && here ? Math.hypot(near[0] - here[0], near[1] - here[1]) / 0.01 : 0;
  const step = mmPerDeg > 0 ? toleranceStep(0.04 / mmPerDeg) : 0;
  const pu0 = geoPath(transform as any).digits(3);
  const tight = geoClipRectangle(0, 0, widthMm, heightMm);
  const pv0 = geoPath({ stream: (s: any) => transform.stream(tight(s)) } as any);
  // label sizes and centres use the stored CRS outlines too (placing labels was re-projecting every outline on each pan)
  const puc = geoPath(placeOnPage as any);
  const pvc = geoPath({ stream: (s: any) => placeOnPage.stream(tight(s)) } as any);
  const via = <R>(o: any, onCrs: (g: any) => R, onLonLat: (o: any) => R): R => {
    const g = inCrs(o, crs.proj4, c);
    return g ? onCrs(simplifyFor(g, stepCrs, true)) : onLonLat(o);
  };
  // a whole outline's area and centre do not move when the map pans: kept in CRS units, only scaled and placed here
  const pu = {
    area: (o: any) => { const m = crsMeasure(o, crs.proj4, c); return m ? m.area * k * k : pu0.area(o); },
    centroid: (o: any) => { const m = crsMeasure(o, crs.proj4, c); return m ? (isFinite(m.centroid[0]) ? fromCrs(m.centroid) : [NaN, NaN]) : pu0.centroid(o); },
  };
  const pv = { area: (o: any) => via(o, (g) => pvc.area(g), (x) => pv0.area(x)), centroid: (o: any) => via(o, (g) => pvc.centroid(g), (x) => pv0.centroid(x)) };
  return {
    crs, widthMm, heightMm, center, k, rot, fromCrs, toCrs,
    forward: fwd,
    inverse: inv,
    path: (o) => (o ? p(o) ?? '' : ''),
    pathUnclipped: (o) => (o ? pu0(o) ?? '' : ''),
    area: (o) => pu.area(o),
    centroid: (o) => {
      const c = pu.centroid(o);
      return isFinite(c[0]) && isFinite(c[1]) ? [c[0], c[1]] : null;
    },
    areaVisible: (o) => pv.area(o),
    centroidVisible: (o) => {
      const c = pv.centroid(o);
      return isFinite(c[0]) && isFinite(c[1]) ? [c[0], c[1]] : null;
    },
  };
}

/* ---------- outlines in CRS units, kept between redraws ---------- */
// Turning lon/lat into a projected CRS (proj4) is the costly step of every redraw. Panning and zooming never change
// those CRS coordinates, only where they land on the page, so each outline is converted once per CRS and kept.
const crsCache = new WeakMap<object, Map<string, unknown>>();

function crsLine(pts: number[][], c: proj4.Converter, minPts: number): number[][] | null {
  const out: number[][] = [];
  for (const p of pts) {
    const q = c.forward(p as [number, number]);
    if (isFinite(q[0]) && isFinite(q[1])) out.push([q[0], q[1]]);
  }
  return out.length >= minPts ? out : null;
}
function crsGeom(g: any, c: proj4.Converter): any {
  switch (g?.type) {
    case 'Point': { const q = c.forward(g.coordinates); return isFinite(q[0]) && isFinite(q[1]) ? { type: 'Point', coordinates: [q[0], q[1]] } : null; }
    case 'MultiPoint': return { type: 'MultiPoint', coordinates: g.coordinates.map((p: any) => c.forward(p)).filter((q: number[]) => isFinite(q[0]) && isFinite(q[1])) };
    case 'LineString': return { type: 'LineString', coordinates: crsLine(g.coordinates, c, 2) ?? [] };
    case 'MultiLineString': return { type: 'MultiLineString', coordinates: g.coordinates.map((l: any) => crsLine(l, c, 2)).filter(Boolean) };
    case 'Polygon': return { type: 'Polygon', coordinates: g.coordinates.map((r: any) => crsLine(r, c, 4)).filter(Boolean) };
    case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: g.coordinates.map((p: any) => p.map((r: any) => crsLine(r, c, 4)).filter(Boolean)).filter((p: any) => p.length) };
    case 'GeometryCollection': return { type: 'GeometryCollection', geometries: g.geometries.map((x: any) => crsGeom(x, c)).filter(Boolean) };
    default: return undefined;
  }
}
function cached<T>(o: object, def: string, make: () => T): T {
  let m = crsCache.get(o);
  if (!m) { m = new Map(); crsCache.set(o, m); }
  if (!m.has(def)) { if (m.size > 4) m.clear(); m.set(def, make()); }
  return m.get(def) as T;
}
const planar = geoPath();
const measureCache = new WeakMap<object, Map<string, { area: number; centroid: [number, number] }>>();
/** Area (CRS units squared) and centre (CRS units) of one feature, kept per CRS; null for anything but a single feature. */
function crsMeasure(o: any, def: string, c: proj4.Converter): { area: number; centroid: [number, number] } | null {
  if (!o || o.type !== 'Feature' || !o.geometry) return null;
  let m = measureCache.get(o);
  if (!m) { m = new Map(); measureCache.set(o, m); }
  let r = m.get(def);
  if (!r) {
    const g = inCrs(o, def, c);
    r = g ? { area: planar.area(g), centroid: planar.centroid(g) as [number, number] } : { area: 0, centroid: [NaN, NaN] };
    if (m.size > 4) m.clear();
    m.set(def, r);
  }
  return r;
}

/** The object in CRS units, or undefined when it is not plain GeoJSON (the sphere, for one), which then takes the lon/lat path. */
function inCrs(o: any, def: string, c: proj4.Converter): any {
  if (!o || typeof o !== 'object') return undefined;
  if (o.type === 'FeatureCollection') return { type: 'FeatureCollection', features: o.features.map((f: any) => inCrs(f, def, c)).filter(Boolean) };
  if (o.type === 'Feature') return o.geometry ? cached(o, def, () => ({ type: 'Feature', properties: null, geometry: crsGeom(o.geometry, c) ?? null })) : null;
  const g = crsGeom(o, c);
  return g === undefined ? undefined : g;
}

/** Stream filter: skips points within `tol` (planar units) of the last kept point, always keeping each line's last point. */
export function thin(s: any, tol: number) {
  let inLine = false, has = false, pending = false;
  let px = 0, py = 0, lx = 0, ly = 0;
  return {
    point(x: number, y: number) {
      if (!inLine) return s.point(x, y);
      if (has && Math.abs(x - px) + Math.abs(y - py) < tol) { lx = x; ly = y; pending = true; return; }
      s.point(x, y);
      px = x; py = y; has = true; pending = false;
    },
    lineStart() { inLine = true; has = false; pending = false; s.lineStart(); },
    lineEnd() { if (pending) s.point(lx, ly); inLine = false; s.lineEnd(); },
    polygonStart() { s.polygonStart(); },
    polygonEnd() { s.polygonEnd(); },
    sphere() { s.sphere?.(); },
  };
}

/** Choose centre and scale so `b` (CRS units) fills the frame with `padding` (0..1) margin. */
export function fitBounds(b: Bounds, widthMm: number, heightMm: number, padding: number): { center: [number, number]; k: number } {
  const bw = Math.max(b[1][0] - b[0][0], 1e-9);
  const bh = Math.max(b[1][1] - b[0][1], 1e-9);
  const k = Math.min(widthMm / bw, heightMm / bh) * (1 - padding);
  return { center: [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2], k };
}

/**
 * Lon/lat bounds of the visible frame, sampled along its edges.
 * West is always in [-180, 180); a frame across the 180° meridian keeps going east past 180 (Fiji: 176.5 to 182.5),
 * so east − west is always the real width. A frame with a pole inside it covers every longitude up to that pole.
 */
export function frameLonLatBounds(fp: FrameProjection): [[number, number], [number, number]] | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const mid = fp.inverse([fp.widthMm / 2, fp.heightMm / 2]);
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const p of [[t * fp.widthMm, 0], [t * fp.widthMm, fp.heightMm], [0, t * fp.heightMm], [fp.widthMm, t * fp.heightMm]] as [number, number][]) {
      const q = fp.inverse(p);
      if (!q) continue;
      // longitudes measured from the frame's centre, so the two sides of 180° stay next to each other
      const lon = mid ? mid[0] + wrapLon(q[0] - mid[0]) : q[0];
      x0 = Math.min(x0, lon); x1 = Math.max(x1, lon);
      y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]);
    }
  }
  if (!isFinite(x0)) return null;
  const inside = (pole: number) => {
    const q = fp.forward([0, pole]);
    if (!q || q[0] < 0 || q[0] > fp.widthMm || q[1] < 0 || q[1] > fp.heightMm) return false;
    // and on the visible side (a globe also places the far pole inside its disc)
    const back = fp.inverse(q);
    return !!back && Math.abs(back[1] - pole) < 0.1;
  };
  if (inside(90)) return [[-180, y0], [180, 90]];
  if (inside(-90)) return [[-180, -90], [180, y1]];
  if (x1 - x0 >= 360) return [[-180, y0], [180, y1]];
  const shift = x0 < -180 ? 360 : x0 >= 180 ? -360 : 0;
  return [[x0 + shift, y0], [x1 + shift, y1]];
}

/** A longitude difference brought into [-180, 180). */
export function wrapLon(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

/** Frame outline as a lon/lat ring (for the extent box drawn in inset maps). */
export function frameOutline(fp: FrameProjection): [number, number][] {
  const ring: [number, number][] = [];
  const n = 20;
  const edge = (a: [number, number], b: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const q = fp.inverse([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      if (q) ring.push(q);
    }
  };
  const w = fp.widthMm, h = fp.heightMm;
  edge([0, 0], [w, 0]); edge([w, 0], [w, h]); edge([w, h], [0, h]); edge([0, h], [0, 0]);
  if (ring.length) ring.push(ring[0]);
  return ring;
}
