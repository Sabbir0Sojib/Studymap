// Merge neighbouring areas into one outline, as GIS "dissolve" does: every edge two areas share is dropped and
// the edges left over are chained back into rings. Official boundary files give neighbours exactly the same
// border points, so their shared border disappears; areas that only overlap or touch loosely keep their lines.
import { geoArea } from 'd3-geo';
import type { Feature, Geometry, MultiPolygon, Polygon, Position } from 'geojson';

const key = (p: Position) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;

function polygonsOf(g: Geometry | null | undefined): Position[][][] {
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(polygonsOf);
  return [];
}

/** Twice the signed planar area of a ring (lon/lat units): enough to compare sizes. */
function area2(r: Position[]): number {
  let a = 0;
  for (let i = 0, n = r.length - 1; i < n; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return a;
}

function inside(p: Position, r: Position[]): boolean {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/**
 * One feature whose outline is the union of the areas' outlines. Point and line features are not merged.
 * Rings come out as plain lon/lat rings; call rewind() afterwards for the winding d3 expects.
 */
export function dissolve(features: Feature[], name: string): Feature<MultiPolygon | Polygon> {
  // edges keyed by their two ends in order; an edge seen again either way round is a shared border
  const edges = new Map<string, [Position, Position]>();
  for (const f of features) {
    for (const poly of polygonsOf(f.geometry)) {
      // one winding for all: outer rings anticlockwise, holes clockwise, so a shared border always runs both ways
      for (const [ri, raw] of poly.entries()) {
        const ring = (ri === 0) === area2(raw) > 0 ? raw : raw.slice().reverse();
        for (let i = 0; i + 1 < ring.length; i++) {
          const a = ring[i], b = ring[i + 1];
          const ka = key(a), kb = key(b);
          if (ka === kb) continue;
          const fwd = `${ka}|${kb}`, back = `${kb}|${ka}`;
          if (edges.has(back)) edges.delete(back);
          else edges.set(fwd, [a, b]);
        }
      }
    }
  }
  // chain the edges left over into closed rings
  const from = new Map<string, string[]>();
  for (const k of edges.keys()) {
    const start = k.slice(0, k.indexOf('|'));
    (from.get(start) ?? from.set(start, []).get(start)!).push(k);
  }
  const rings: Position[][] = [];
  for (const k0 of [...edges.keys()]) {
    if (!edges.has(k0)) continue;
    const ring: Position[] = [];
    let k = k0;
    for (let guard = 0; guard < 2_000_000 && edges.has(k); guard++) {
      const [a, b] = edges.get(k)!;
      edges.delete(k);
      ring.push(a);
      const next = (from.get(key(b)) ?? []).find((n) => edges.has(n));
      if (!next) { ring.push(b); break; }
      k = next;
    }
    if (ring.length >= 3) {
      if (key(ring[0]) !== key(ring[ring.length - 1])) ring.push(ring[0]);
      if (ring.length >= 4) rings.push(ring);
    }
  }
  // rings inside an odd number of other rings are holes; the rest are outer rings
  const sorted = rings.map((r) => ({ r, a: Math.abs(area2(r)) })).sort((x, y) => y.a - x.a);
  const polys: Position[][][] = [];
  const owner: number[] = [];
  sorted.forEach(({ r }, i) => {
    const containers = sorted.slice(0, i).map((o, j) => ({ j, o })).filter(({ o }) => inside(r[0], o.r));
    if (containers.length % 2 === 1) {
      // a hole of the smallest outer ring around it
      const outerIdx = containers.reverse().find(({ j }) => owner[j] !== undefined && polys[owner[j]][0] === sorted[j].r)?.j;
      if (outerIdx !== undefined) { polys[owner[outerIdx]].push(r); owner[i] = owner[outerIdx]; return; }
    }
    owner[i] = polys.push([r]) - 1;
  });
  const geometry: MultiPolygon | Polygon = polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  return { type: 'Feature', properties: { name, __name: name }, geometry };
}

/**
 * An area across the 180° meridian is stored as pieces cut along it (west of the line ending at 180, east of it
 * starting at -180). Drawn as they are, its outline gets a straight line down 180°. The pieces touching -180 move
 * to 180…360 so the cut edges meet, and the shared edges are dissolved away. Any other area comes back as it is.
 */
export function joinAcross180<T extends Feature>(f: T): T {
  const polys = polygonsOf(f.geometry);
  const touches = (p: Position[][], lon: number) => p.some((r) => r.some((q) => Math.abs(q[0] - lon) < 1e-9));
  if (!polys.some((p) => touches(p, 180)) || !polys.some((p) => touches(p, -180))) return f;
  const moved = polys.map((p) => (touches(p, -180) && p[0].every((q) => q[0] <= 0) ? p.map((r) => r.map((q) => [q[0] + 360, q[1]])) : p));
  const joined = dissolve([{ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: moved } }], '');
  // wound the way d3 reads it (a ring that seems to cover most of the globe is turned round), as rewind() does
  const g = joined.geometry;
  for (const rings of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
    if (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) rings.forEach((r) => r.reverse());
  }
  return { ...f, geometry: g };
}
