// Builds a hillshade (and optional elevation tint) for a map frame in any projection.
// Elevation: Mapterhorn terrarium tiles (Copernicus GLO-30 worldwide, finer national data where available).
import proj4 from 'proj4';

export interface TerrainRequest {
  id: number;
  proj4: string;
  widthMm: number;
  heightMm: number;
  center: [number, number];
  k: number;
  /** map rotation, degrees clockwise */
  rot?: number;
  pxPerMm: number;
  lonLat: [[number, number], [number, number]];
  azimuth: number;
  altitude: number;
  exaggeration: number;
  tint: boolean;
  shade: boolean;
  /** contour lines instead of shading: the interval in metres, or 0 to choose one from the relief in view */
  contours?: number;
}

/** The ground height along a line: `pts` is lon, lat, lon, lat… (a line drawn on the map); about `n` samples, evenly spaced along its great-circle length. */
export interface ProfileRequest {
  id: number;
  profile: { pts: number[]; n: number };
}

export interface TerrainResult {
  id: number;
  width: number;
  height: number;
  /** an elevation profile: distance along the line (km) and ground height (m) at each sample, the line's length and the tile zoom used */
  profile?: { km: number[]; m: number[]; lenKm: number; z: number };
  rgba?: Uint8ClampedArray;
  zoom?: number;
  minElev?: number;
  maxElev?: number;
  error?: string;
  /** contour lines: their height and their points as lon, lat, lon, lat… */
  lines?: { level: number; pts: number[] }[];
  /** the interval the lines were drawn at */
  interval?: number;
}

/** A round interval giving about eight lines across the relief in view: 5, 10, 20, 25, 50, 100… m. */
function niceInterval(span: number): number {
  const raw = Math.max(1, span / 8);
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * p) return m * p;
  return 10 * p;
}

/** Light smoothing of the elevation grid (5 × 5 box), so 30 m data gives clean lines rather than ragged ones. */
function smooth(src: Float32Array, W: number, H: number): Float32Array {
  const tmp = new Float32Array(W * H), out = new Float32Array(W * H), R = 2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let k = -R; k <= R; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += src[y * W + xx]; n++; } }
    tmp[y * W + x] = s / n;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let k = -R; k <= R; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += tmp[yy * W + x]; n++; } }
    out[y * W + x] = s / n;
  }
  return out;
}

/** Douglas-Peucker on a pixel polyline (pairs), keeping detail finer than tol px out. */
function simplifyPx(p: number[], tol: number): number[] {
  const n = p.length / 2;
  if (n < 3) return p;
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let far = -1, fd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((p[i * 2] - ax) * dy - (p[i * 2 + 1] - ay) * dx) / L;
      if (d > fd) { fd = d; far = i; }
    }
    if (far > 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(p[i * 2], p[i * 2 + 1]);
  return out;
}

/** Marching squares at one height: the crossing segments, joined into lines (pixel coordinates). */
function trace(e: Float32Array, W: number, H: number, L: number): number[][] {
  const segs: number[] = [];
  const lerp = (v0: number, v1: number) => (L - v0) / (v1 - v0 || 1e-9);
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const a = e[y * W + x], b = e[y * W + x + 1], c = e[(y + 1) * W + x + 1], d = e[(y + 1) * W + x];
    const idx = (a >= L ? 8 : 0) | (b >= L ? 4 : 0) | (c >= L ? 2 : 0) | (d >= L ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const top = [x + lerp(a, b), y], right = [x + 1, y + lerp(b, c)], bottom = [x + lerp(d, c), y + 1], left = [x, y + lerp(a, d)];
    const add = (p: number[], q: number[]) => segs.push(p[0], p[1], q[0], q[1]);
    switch (idx) {
      case 1: case 14: add(left, bottom); break;
      case 2: case 13: add(bottom, right); break;
      case 3: case 12: add(left, right); break;
      case 4: case 11: add(top, right); break;
      case 5: add(left, top); add(bottom, right); break;
      case 6: case 9: add(top, bottom); break;
      case 7: case 8: add(left, top); break;
      case 10: add(left, bottom); add(top, right); break;
    }
  }
  // join segments end to end into lines
  const key = (x: number, y: number) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`;
  const ends = new Map<string, number[]>();
  const n = segs.length / 4;
  for (let i = 0; i < n; i++) for (const k of [key(segs[i * 4], segs[i * 4 + 1]), key(segs[i * 4 + 2], segs[i * 4 + 3])]) { const l = ends.get(k); if (l) l.push(i); else ends.set(k, [i]); }
  const used = new Uint8Array(n);
  const lines: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let line = [segs[i * 4], segs[i * 4 + 1], segs[i * 4 + 2], segs[i * 4 + 3]];
    for (const dir of [1, -1]) {
      for (;;) {
        const lx = dir > 0 ? line[line.length - 2] : line[0], ly = dir > 0 ? line[line.length - 1] : line[1];
        const next = (ends.get(key(lx, ly)) ?? []).find((j) => !used[j]);
        if (next === undefined) break;
        used[next] = 1;
        const s = [segs[next * 4], segs[next * 4 + 1], segs[next * 4 + 2], segs[next * 4 + 3]];
        const startHere = key(s[0], s[1]) === key(lx, ly);
        const far = startHere ? [s[2], s[3]] : [s[0], s[1]];
        if (dir > 0) line.push(far[0], far[1]); else line = [far[0], far[1], ...line];
      }
    }
    if (line.length >= 12) lines.push(line); // shorter than ~6 px is a speck, not a line
  }
  return lines;
}

const TILE = 512;
const MAX_Z = 12;

/** Great-circle distance in metres between two lon/lat points. */
function groundDistance(a: number[], b: number[]): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** A longitude moved into [west, west + 360), so a view across 180° reads its tiles in one run. */
function unwrap(lon: number, west: number): number {
  return west + ((((lon - west) % 360) + 360) % 360);
}

function lonLatToWorld(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z * TILE;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

async function fetchTile(z: number, x: number, y: number): Promise<Float32Array | null> {
  // a view across 180° asks for columns past the last one: they wrap round to the first
  const n = 2 ** z;
  const res = await fetch(`https://tiles.mapterhorn.com/${z}/${((x % n) + n) % n}/${y}.webp`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Terrain server answered ${res.status}.`);
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(TILE, TILE);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const d = ctx.getImageData(0, 0, TILE, TILE).data;
  const out = new Float32Array(TILE * TILE);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  return out;
}

// Muted hypsometric ramp (lowland green-grey to brown to light grey), not a rainbow.
const RAMP: [number, [number, number, number]][] = [
  [0, [214, 226, 205]], [0.12, [196, 214, 180]], [0.3, [222, 214, 170]], [0.5, [206, 182, 140]],
  [0.7, [184, 156, 128]], [0.88, [204, 196, 190]], [1, [240, 238, 236]],
];
function ramp(t: number): [number, number, number] {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const [t0, a] = RAMP[i - 1], [t1, b] = RAMP[i];
      const f = (t - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

async function build(r: TerrainRequest): Promise<TerrainResult> {
  const W = Math.max(2, Math.round(r.widthMm * r.pxPerMm));
  const H = Math.max(2, Math.round(r.heightMm * r.pxPerMm));
  const conv = proj4('EPSG:4326', r.proj4);

  // Ground metres per output pixel at the centre, measured across and down the page: CRS units are not ground metres
  // (Web Mercator stretches with latitude, some grids are in feet, a lon/lat map has degrees of two sizes).
  const midLat = (r.lonLat[0][1] + r.lonLat[1][1]) / 2;
  const groundAt = (dxPx: number, dyPx: number): number => {
    const ll = (px: number, py: number) => {
      let fx0 = px / r.pxPerMm, fy0 = py / r.pxPerMm;
      if (r.rot) { const a = (r.rot * Math.PI) / 180, ux = fx0 * Math.cos(a) + fy0 * Math.sin(a), uy = -fx0 * Math.sin(a) + fy0 * Math.cos(a); fx0 = ux; fy0 = uy; }
      return conv.inverse([r.center[0] + fx0 / r.k, r.center[1] - fy0 / r.k]);
    };
    const a = ll(-dxPx / 2, -dyPx / 2), b = ll(dxPx / 2, dyPx / 2);
    const d = groundDistance(a, b) / Math.hypot(dxPx, dyPx);
    return isFinite(d) && d > 0 ? d : NaN;
  };
  const cellX0 = groundAt(10, 0), cellY0 = groundAt(0, 10);
  const fallback = 1 / r.k / r.pxPerMm; // CRS units per pixel, if the centre cannot be measured
  const cellX = isFinite(cellX0) ? cellX0 : fallback, cellY = isFinite(cellY0) ? cellY0 : fallback;
  const groundPerPx = Math.sqrt(cellX * cellY);
  let z = Math.round(Math.log2((40075016 * Math.cos((midLat * Math.PI) / 180)) / (TILE * groundPerPx)));
  z = Math.max(1, Math.min(MAX_Z, z));

  for (let attempt = 0; attempt < 4; attempt++, z--) {
    const [x0w, y1w] = lonLatToWorld(r.lonLat[0][0], r.lonLat[0][1], z);
    const [x1w, y0w] = lonLatToWorld(r.lonLat[1][0], r.lonLat[1][1], z);
    const tx0 = Math.floor(x0w / TILE) - 0, tx1 = Math.floor(x1w / TILE);
    const ty0 = Math.floor(y0w / TILE), ty1 = Math.floor(y1w / TILE);
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    if (nx * ny > 80) { continue; }
    const tiles = await Promise.all(
      Array.from({ length: nx * ny }, (_, i) => fetchTile(z, tx0 + (i % nx), ty0 + Math.floor(i / nx)).catch(() => null)),
    );
    if (tiles.some((t) => !t)) continue; // missing at this zoom: step down
    const MW = nx * TILE;
    const sample = (wx: number, wy: number): number => {
      const px = wx - tx0 * TILE, py = wy - ty0 * TILE;
      const ix = Math.max(0, Math.min(MW - 2, Math.floor(px))), iy = Math.max(0, Math.min(ny * TILE - 2, Math.floor(py)));
      const fx = Math.min(1, Math.max(0, px - ix)), fy = Math.min(1, Math.max(0, py - iy));
      const g = (x: number, y: number) => {
        const t = tiles[Math.floor(y / TILE) * nx + Math.floor(x / TILE)]!;
        return t[(y % TILE) * TILE + (x % TILE)];
      };
      const a = g(ix, iy), b = g(ix + 1, iy), c = g(ix, iy + 1), d = g(ix + 1, iy + 1);
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    };

    // Inverse-project on a coarse grid and interpolate between, like a triangulated reprojection.
    const STEP = 8;
    const gw = Math.ceil(W / STEP) + 1, gh = Math.ceil(H / STEP) + 1;
    const gridX = new Float64Array(gw * gh), gridY = new Float64Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        let fx0 = (i * STEP) / r.pxPerMm - r.widthMm / 2, fy0 = (j * STEP) / r.pxPerMm - r.heightMm / 2;
        if (r.rot) { const a = (r.rot * Math.PI) / 180, ux = fx0 * Math.cos(a) + fy0 * Math.sin(a), uy = -fx0 * Math.sin(a) + fy0 * Math.cos(a); fx0 = ux; fy0 = uy; }
        const X = r.center[0] + fx0 / r.k;
        const Y = r.center[1] - fy0 / r.k;
        const ll = conv.inverse([X, Y]);
        const w = isFinite(ll[0]) && isFinite(ll[1]) ? lonLatToWorld(unwrap(ll[0], r.lonLat[0][0]), ll[1], z) : [NaN, NaN];
        gridX[j * gw + i] = w[0];
        gridY[j * gw + i] = w[1];
      }
    }
    const elev = new Float32Array(W * H);
    let minE = Infinity, maxE = -Infinity;
    for (let y = 0; y < H; y++) {
      const gj = Math.min(gh - 2, Math.floor(y / STEP)), fy = (y - gj * STEP) / STEP;
      for (let x = 0; x < W; x++) {
        const gi = Math.min(gw - 2, Math.floor(x / STEP)), fx = (x - gi * STEP) / STEP;
        const k00 = gj * gw + gi, k10 = k00 + 1, k01 = k00 + gw, k11 = k01 + 1;
        const wx = (gridX[k00] * (1 - fx) + gridX[k10] * fx) * (1 - fy) + (gridX[k01] * (1 - fx) + gridX[k11] * fx) * fy;
        const wy = (gridY[k00] * (1 - fx) + gridY[k10] * fx) * (1 - fy) + (gridY[k01] * (1 - fx) + gridY[k11] * fx) * fy;
        const e = isFinite(wx) ? sample(wx, wy) : 0;
        elev[y * W + x] = e;
        if (e < minE) minE = e;
        if (e > maxE) maxE = e;
      }
    }

    if (r.contours !== undefined) {
      // Contour lines: traced on the smoothed grid, then each point turned back into lon/lat for the map to draw
      const sm = smooth(elev, W, H);
      // on nearly flat land 30 m data is mostly buildings and trees: lines closer than 10 m would only draw that noise
      const lo = Math.max(0, minE), interval = r.contours > 0 ? r.contours : Math.max(10, niceInterval(maxE - lo));
      const lines: { level: number; pts: number[] }[] = [];
      const toLL = (px: number, py: number): [number, number] | null => {
        let fx0 = px / r.pxPerMm - r.widthMm / 2, fy0 = py / r.pxPerMm - r.heightMm / 2;
        if (r.rot) { const a = (r.rot * Math.PI) / 180, ux = fx0 * Math.cos(a) + fy0 * Math.sin(a), uy = -fx0 * Math.sin(a) + fy0 * Math.cos(a); fx0 = ux; fy0 = uy; }
        const ll = conv.inverse([r.center[0] + fx0 / r.k, r.center[1] - fy0 / r.k]);
        return isFinite(ll[0]) && isFinite(ll[1]) ? [ll[0], ll[1]] : null;
      };
      let count = 0;
      for (let L = Math.ceil(lo / interval) * interval; L <= maxE && count < 60000; L += interval) {
        if (L <= 0) continue; // the sea level line is the coast, drawn already
        for (const px of trace(sm, W, H, L)) {
          const s = simplifyPx(px, 0.6);
          const pts: number[] = [];
          for (let i = 0; i < s.length; i += 2) { const q = toLL(s[i] + 0.5, s[i + 1] + 0.5); if (q) pts.push(q[0], q[1]); }
          if (pts.length >= 4) { lines.push({ level: L, pts }); count += pts.length; }
        }
      }
      return { id: r.id, width: W, height: H, zoom: z, minElev: minE, maxElev: maxE, lines, interval };
    }

    // Horn hillshade on the output grid. Cell size in metres on the ground, across and down the page.
    const zr = ((90 - r.altitude) * Math.PI) / 180;
    const az = ((360 - r.azimuth + 90) * Math.PI) / 180;
    const rgba = new Uint8ClampedArray(W * H * 4);
    const span = Math.max(1, maxE - Math.max(0, minE));
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const at = (xx: number, yy: number) => elev[Math.max(0, Math.min(H - 1, yy)) * W + Math.max(0, Math.min(W - 1, xx))];
        const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
        const d = at(x - 1, y), f = at(x + 1, y);
        const g = at(x - 1, y + 1), h = at(x, y + 1), i2 = at(x + 1, y + 1);
        const dzdx = ((c + 2 * f + i2) - (a + 2 * d + g)) / (8 * cellX) * r.exaggeration;
        const dzdy = ((g + 2 * h + i2) - (a + 2 * b + c)) / (8 * cellY) * r.exaggeration;
        const slope = Math.atan(Math.hypot(dzdx, dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        const hs = Math.max(0, Math.cos(zr) * Math.cos(slope) + Math.sin(zr) * Math.sin(slope) * Math.cos(az - aspect));
        const o = (y * W + x) * 4;
        if (r.tint) {
          const e = elev[y * W + x];
          const [cr, cg, cb] = ramp((e - Math.max(0, minE)) / span);
          const s = r.shade ? 0.55 + 0.6 * hs : 1;
          rgba[o] = cr * s; rgba[o + 1] = cg * s; rgba[o + 2] = cb * s; rgba[o + 3] = 255;
        } else {
          // Transparent shading: dark where shadowed, a little light where lit, clear on flat ground.
          const flat = Math.cos(zr);
          const v = hs - flat;
          if (v < 0) { rgba[o] = rgba[o + 1] = rgba[o + 2] = 20; rgba[o + 3] = Math.min(255, -v * 420); }
          else { rgba[o] = rgba[o + 1] = rgba[o + 2] = 255; rgba[o + 3] = Math.min(140, v * 260); }
        }
      }
    }
    return { id: r.id, width: W, height: H, rgba, zoom: z, minElev: minE, maxElev: maxE };
  }
  return { id: r.id, width: 0, height: 0, error: 'Terrain data is not available for this area at a usable resolution.' };
}

/* ---------- elevation profile ---------- */

const EARTH = 6371008.8;

/** The point a fraction t of the way along the great circle from a to b (lon, lat in degrees). */
function onCircle(a: [number, number], b: [number, number], t: number): [number, number] {
  const rad = Math.PI / 180;
  const v = (p: [number, number]): [number, number, number] => [Math.cos(p[1] * rad) * Math.cos(p[0] * rad), Math.cos(p[1] * rad) * Math.sin(p[0] * rad), Math.sin(p[1] * rad)];
  const [x1, y1, z1] = v(a), [x2, y2, z2] = v(b);
  const d = Math.acos(Math.max(-1, Math.min(1, x1 * x2 + y1 * y2 + z1 * z2)));
  if (d < 1e-12) return a;
  const s = Math.sin(d), p = Math.sin((1 - t) * d) / s, q = Math.sin(t * d) / s;
  const x = p * x1 + q * x2, y = p * y1 + q * y2, z = p * z1 + q * z2;
  return [Math.atan2(y, x) / rad, Math.atan2(z, Math.hypot(x, y)) / rad];
}

/** Great-circle distance in metres. */
function distance(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Ground height at about `n` points evenly spaced along a line, read from the same Mapterhorn tiles as the relief.
 * The tile zoom is the one whose pixel is about 30 m on the ground, stepped down when a tile is missing or the line is so long
 * that it would need more than 36 tiles; the heights between pixels are interpolated (bilinear), as for the hillshade.
 */
async function profile(r: ProfileRequest): Promise<TerrainResult> {
  const line: [number, number][] = [];
  for (let i = 0; i + 1 < r.profile.pts.length; i += 2) line.push([r.profile.pts[i], r.profile.pts[i + 1]]);
  if (line.length < 2) return { id: r.id, width: 0, height: 0, error: 'The line needs at least two points.' };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) { const d = distance(line[i - 1], line[i]); seg.push(d); total += d; }
  if (!(total > 1)) return { id: r.id, width: 0, height: 0, error: 'The line is too short for a profile.' };
  const n = Math.max(2, Math.min(1000, Math.round(r.profile.n)));
  // the samples: position along the line, then the point on the sphere
  const at: [number, number][] = [];
  const dist: number[] = [];
  let k = 0, run = 0;
  for (let i = 0; i < n; i++) {
    const s = (total * i) / (n - 1);
    while (k < seg.length - 1 && run + seg[k] < s) { run += seg[k]; k++; }
    const t = seg[k] > 0 ? Math.max(0, Math.min(1, (s - run) / seg[k])) : 0;
    at.push(onCircle(line[k], line[k + 1], t));
    dist.push(s / 1000);
  }
  const midLat = at.reduce((a, p) => a + p[1], 0) / at.length;
  let z = Math.round(Math.log2((40075016 * Math.cos((midLat * Math.PI) / 180)) / (TILE * 30)));
  z = Math.max(1, Math.min(MAX_Z, z));
  for (let attempt = 0; attempt < 12 && z >= 1; attempt++, z--) {
    const world = at.map((p) => lonLatToWorld(p[0], p[1], z));
    const need = new Map<string, [number, number]>();
    for (const [wx, wy] of world) {
      // the pixel and its right and lower neighbours (the bilinear sample reads all four)
      for (const dx of [0, 1]) for (const dy of [0, 1]) {
        const tx = Math.floor((wx + dx) / TILE), ty = Math.floor((wy + dy) / TILE);
        need.set(`${tx},${ty}`, [tx, ty]);
      }
    }
    if (need.size > 36) continue;
    const list = [...need.entries()];
    const got = await Promise.all(list.map(([, [tx, ty]]) => fetchTile(z, tx, ty).catch(() => null)));
    if (got.some((t) => !t)) continue;
    const tiles = new Map<string, Float32Array>();
    list.forEach(([key], i) => tiles.set(key, got[i]!));
    const g = (x: number, y: number) => tiles.get(`${Math.floor(x / TILE)},${Math.floor(y / TILE)}`)![(y % TILE) * TILE + (x % TILE)];
    const m = world.map(([wx, wy]) => {
      const ix = Math.floor(wx), iy = Math.floor(wy);
      const fx = wx - ix, fy = wy - iy;
      const e = (g(ix, iy) * (1 - fx) + g(ix + 1, iy) * fx) * (1 - fy) + (g(ix, iy + 1) * (1 - fx) + g(ix + 1, iy + 1) * fx) * fy;
      return Math.round(e * 10) / 10;
    });
    return { id: r.id, width: 0, height: 0, profile: { km: dist.map((d) => Math.round(d * 1000) / 1000), m, lenKm: Math.round((total / 1000) * 1000) / 1000, z } };
  }
  return { id: r.id, width: 0, height: 0, error: 'Terrain data is not available along this line.' };
}

self.onmessage = async (e: MessageEvent<TerrainRequest | ProfileRequest>) => {
  try {
    if ('profile' in e.data) {
      (self as unknown as Worker).postMessage(await profile(e.data));
      return;
    }
    const res = await build(e.data);
    (self as unknown as Worker).postMessage(res, res.rgba ? [res.rgba.buffer] : []);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, width: 0, height: 0, error: (err as Error).message } satisfies TerrainResult);
  }
};
