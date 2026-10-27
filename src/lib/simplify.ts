// Outlines with more detail than the page can show are thinned in lon/lat before they are projected.
// A district or road file can hold a vertex every few metres; on a map at 1:500,000 that is far below what
// any print shows. Dropping those vertices before projection (instead of after) saves the projection work and
// the garbage it leaves, which is what made every pan and zoom pause on slower laptops.
// Results are cached per feature and per tolerance step, so panning at one zoom reuses them.
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

const cache = new WeakMap<object, Map<number, unknown>>();

/** Snap a tolerance (degrees) down to a power of two, so nearby zooms share one cached result. */
export function toleranceStep(tolDeg: number): number {
  if (!(tolDeg > 0) || !isFinite(tolDeg)) return 0;
  return 2 ** Math.floor(Math.log2(tolDeg));
}

/** true while thinning outlines already in flat CRS units (set by simplifyFor) */
let flat = false;

/** Keep points at least `tol` apart (in degrees, longitude scaled by latitude; or in flat CRS units); first and last always stay. */
function line(pts: Position[], tol: number, minPts: number): Position[] {
  if (pts.length <= minPts) return pts;
  const out: Position[] = [pts[0]];
  let [px, py] = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const c = flat ? 1 : Math.cos((y * Math.PI) / 180);
    if (Math.abs(x - px) * c + Math.abs(y - py) >= tol) { out.push(pts[i]); px = x; py = y; }
  }
  out.push(pts[pts.length - 1]);
  // a ring thinned below a triangle keeps its original shape (small islands and lakes do not vanish)
  return out.length >= minPts ? out : pts;
}

function geometry(g: Geometry, tol: number): Geometry {
  switch (g.type) {
    case 'LineString': return { type: 'LineString', coordinates: line(g.coordinates, tol, 2) };
    case 'MultiLineString': return { type: 'MultiLineString', coordinates: g.coordinates.map((l) => line(l, tol, 2)) };
    case 'Polygon': return { type: 'Polygon', coordinates: g.coordinates.map((r) => line(r, tol, 4)) };
    case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: g.coordinates.map((p) => p.map((r) => line(r, tol, 4))) };
    case 'GeometryCollection': return { type: 'GeometryCollection', geometries: g.geometries.map((x) => geometry(x, tol)) };
    default: return g;
  }
}

function vertexCount(g: Geometry | null): number {
  if (!g) return 0;
  switch (g.type) {
    case 'LineString': return g.coordinates.length;
    case 'MultiLineString': case 'Polygon': return g.coordinates.reduce((s, l) => s + l.length, 0);
    case 'MultiPolygon': return g.coordinates.reduce((s, p) => s + p.reduce((t, r) => t + r.length, 0), 0);
    case 'GeometryCollection': return g.geometries.reduce((s, x) => s + vertexCount(x), 0);
    default: return 1;
  }
}

function feature(f: Feature, step: number): Feature {
  if (!f.geometry || vertexCount(f.geometry) < 64) return f; // small shapes are not worth it
  let m = cache.get(f);
  if (!m) { m = new Map(); cache.set(f, m); }
  const key = flat ? -step : step;
  let s = m.get(key) as Feature | undefined;
  if (!s) {
    s = { ...f, geometry: geometry(f.geometry, step) };
    if (m.size > 6) m.clear();
    m.set(key, s);
  }
  return s;
}

/** The same object type back, with heavy outlines thinned to `step` (degrees, or flat units with planar: true; 0 leaves it). */
export function simplifyFor<T>(o: T, step: number, planar = false): T {
  if (!step || !o || typeof o !== 'object') return o;
  flat = planar;
  const x = o as unknown as { type?: string };
  if (x.type === 'FeatureCollection') {
    const fc = o as unknown as FeatureCollection;
    let m = cache.get(fc);
    if (!m) { m = new Map(); cache.set(fc, m); }
    const key = planar ? -step : step;
    let s = m.get(key) as FeatureCollection | undefined;
    if (!s) {
      s = { ...fc, features: fc.features.map((f) => feature(f, step)) };
      if (m.size > 6) m.clear();
      m.set(key, s);
    }
    return s as unknown as T;
  }
  if (x.type === 'Feature') return feature(o as unknown as Feature, step) as unknown as T;
  return o;
}
