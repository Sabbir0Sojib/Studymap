// Builds a satellite base map for a map frame in any projection, from web-mercator image tiles.
// Imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0.
import proj4 from 'proj4';

export interface ImageryRequest {
  id: number;
  url: string; // template with {z} {x} {y}
  maxZoom: number;
  proj4: string;
  widthMm: number;
  heightMm: number;
  center: [number, number];
  k: number;
  /** map rotation, degrees clockwise */
  rot?: number;
  pxPerMm: number;
  lonLat: [[number, number], [number, number]];
  /** a picture made of many days: the tile addresses (each with {date}) and the days to combine */
  composite?: { urls: string[]; dates: string[] };
}

export interface ImageryResult {
  id: number;
  width: number;
  height: number;
  rgba?: Uint8ClampedArray;
  error?: string;
  /** 0–1 while a picture of many days is being put together */
  progress?: number;
}

/**
 * One tile put together from many days of daily satellite pictures (each mostly empty where the satellite did not
 * pass, white where it was cloudy): per pixel, of the days that saw the ground, a value a little darker than the
 * middle one, which leaves out bright clouds and dark cloud shadows alike.
 */
async function compositeTile(c: { urls: string[]; dates: string[] }, z: number, x: number, y: number): Promise<Uint8ClampedArray | null> {
  const days = await Promise.all(c.dates.flatMap((d) => c.urls.map((u) => fetchTile(u.replace('{date}', d), z, x, y).catch(() => null))));
  const got = days.filter((t): t is Uint8ClampedArray => !!t);
  if (!got.length) return null;
  const out = new Uint8ClampedArray(TILE * TILE * 4);
  const r: number[] = [], g: number[] = [], b: number[] = [], l: number[] = [];
  for (let i = 0; i < TILE * TILE; i++) {
    r.length = g.length = b.length = l.length = 0;
    for (const t of got) {
      const o = i * 4;
      if (t[o + 3] < 200) continue; // no picture there that day
      const s = t[o] + t[o + 1] + t[o + 2];
      if (s < 12) continue; // the black of a missing scene edge
      r.push(t[o]); g.push(t[o + 1]); b.push(t[o + 2]); l.push(s);
    }
    if (!l.length) continue;
    const order = l.map((_, k) => k).sort((p, q) => l[p] - l[q]);
    const k = order[Math.floor((order.length - 1) * 0.4)];
    const o = i * 4;
    out[o] = r[k]; out[o + 1] = g[k]; out[o + 2] = b[k]; out[o + 3] = 255;
  }
  return out;
}

const TILE = 256;

function lonLatToWorld(lon: number, lat: number, z: number): [number, number] {
  const n = 2 ** z * TILE;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return [((lon + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
}

async function fetchTile(url: string, z: number, x: number, y: number): Promise<Uint8ClampedArray | null> {
  const n = 2 ** z;
  const xx = ((x % n) + n) % n;
  if (y < 0 || y >= n) return null;
  const res = await fetch(url.replace('{z}', String(z)).replace('{x}', String(xx)).replace('{y}', String(y)));
  if (!res.ok) return null;
  const bmp = await createImageBitmap(await res.blob());
  const c = new OffscreenCanvas(TILE, TILE);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, TILE, TILE);
  bmp.close();
  return ctx.getImageData(0, 0, TILE, TILE).data;
}

async function build(r: ImageryRequest): Promise<ImageryResult> {
  const W = Math.max(2, Math.round(r.widthMm * r.pxPerMm));
  const H = Math.max(2, Math.round(r.heightMm * r.pxPerMm));
  const conv = proj4('EPSG:4326', r.proj4);
  const isDeg = /\+proj=(longlat|latlong|lonlat|latlon)\b/.test(r.proj4);
  const midLat = (r.lonLat[0][1] + r.lonLat[1][1]) / 2;
  const unitPerPx = 1 / r.k / r.pxPerMm;
  const groundPerPx = isDeg ? unitPerPx * 111320 * Math.cos((midLat * Math.PI) / 180) : unitPerPx;
  let z = Math.round(Math.log2((40075016 * Math.cos((midLat * Math.PI) / 180)) / (TILE * groundPerPx)));
  z = Math.max(1, Math.min(r.maxZoom, z));

  for (; z >= 1; z--) {
    const [x0w, y1w] = lonLatToWorld(r.lonLat[0][0], r.lonLat[0][1], z);
    const [x1w, y0w] = lonLatToWorld(r.lonLat[1][0], r.lonLat[1][1], z);
    const tx0 = Math.floor(x0w / TILE), tx1 = Math.floor(x1w / TILE);
    const ty0 = Math.floor(y0w / TILE), ty1 = Math.floor(y1w / TILE);
    const nx = tx1 - tx0 + 1, ny = ty1 - ty0 + 1;
    if (nx * ny > 160) continue; // too many tiles: one zoom level coarser
    let tiles: (Uint8ClampedArray | null)[];
    if (r.composite) {
      // many days per tile: keep the number of requests polite (about 900 at most), a few tiles at a time
      const per = r.composite.dates.length * r.composite.urls.length;
      if (nx * ny * per > 900 && z > 1) continue;
      tiles = [];
      for (let i = 0; i < nx * ny; i += 3) {
        const batch = await Promise.all([i, i + 1, i + 2].filter((k) => k < nx * ny).map((k) => compositeTile(r.composite!, z, tx0 + (k % nx), ty0 + Math.floor(k / nx))));
        tiles.push(...batch);
        (self as unknown as Worker).postMessage({ id: r.id, width: 0, height: 0, progress: Math.min(1, tiles.length / (nx * ny)) } satisfies ImageryResult);
      }
      if (!tiles.some(Boolean)) return { id: r.id, width: 0, height: 0, error: 'No clear satellite pictures of this area in those days. Try a longer or a drier season.' };
    } else {
      tiles = await Promise.all(Array.from({ length: nx * ny }, (_, i) => fetchTile(r.url, z, tx0 + (i % nx), ty0 + Math.floor(i / nx)).catch(() => null)));
      if (tiles.filter(Boolean).length < tiles.length * 0.5) continue;
    }

    // Inverse-project a coarse grid of output pixels and interpolate between (as for the terrain).
    const STEP = 8;
    const gw = Math.ceil(W / STEP) + 1, gh = Math.ceil(H / STEP) + 1;
    const gx = new Float64Array(gw * gh), gy = new Float64Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        let fx0 = (i * STEP) / r.pxPerMm - r.widthMm / 2, fy0 = (j * STEP) / r.pxPerMm - r.heightMm / 2;
        if (r.rot) { const a = (r.rot * Math.PI) / 180, ux = fx0 * Math.cos(a) + fy0 * Math.sin(a), uy = -fx0 * Math.sin(a) + fy0 * Math.cos(a); fx0 = ux; fy0 = uy; }
        const X = r.center[0] + fx0 / r.k;
        const Y = r.center[1] - fy0 / r.k;
        const ll = conv.inverse([X, Y]);
        // a view across 180° reads its tiles in one run east of the west edge (fetchTile wraps the columns)
        const lon = isFinite(ll[0]) ? r.lonLat[0][0] + ((((ll[0] - r.lonLat[0][0]) % 360) + 360) % 360) : NaN;
        const w = isFinite(lon) && isFinite(ll[1]) ? lonLatToWorld(lon, ll[1], z) : [NaN, NaN];
        gx[j * gw + i] = w[0];
        gy[j * gw + i] = w[1];
      }
    }
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      const gj = Math.min(gh - 2, Math.floor(y / STEP)), fy = (y - gj * STEP) / STEP;
      for (let x = 0; x < W; x++) {
        const gi = Math.min(gw - 2, Math.floor(x / STEP)), fx = (x - gi * STEP) / STEP;
        const k00 = gj * gw + gi, k10 = k00 + 1, k01 = k00 + gw, k11 = k01 + 1;
        const wx = (gx[k00] * (1 - fx) + gx[k10] * fx) * (1 - fy) + (gx[k01] * (1 - fx) + gx[k11] * fx) * fy;
        const wy = (gy[k00] * (1 - fx) + gy[k10] * fx) * (1 - fy) + (gy[k01] * (1 - fx) + gy[k11] * fx) * fy;
        if (!isFinite(wx)) continue;
        const px = wx - tx0 * TILE, py = wy - ty0 * TILE;
        const tix = Math.floor(px / TILE), tiy = Math.floor(py / TILE);
        if (tix < 0 || tiy < 0 || tix >= nx || tiy >= ny) continue;
        const t = tiles[tiy * nx + tix];
        if (!t) continue;
        const sx = Math.min(TILE - 1, Math.max(0, Math.floor(px - tix * TILE))), sy = Math.min(TILE - 1, Math.max(0, Math.floor(py - tiy * TILE)));
        const s = (sy * TILE + sx) * 4, o = (y * W + x) * 4;
        rgba[o] = t[s]; rgba[o + 1] = t[s + 1]; rgba[o + 2] = t[s + 2]; rgba[o + 3] = 255;
      }
    }
    return { id: r.id, width: W, height: H, rgba };
  }
  return { id: r.id, width: 0, height: 0, error: 'Satellite imagery is not available for this view.' };
}

self.onmessage = async (e: MessageEvent<ImageryRequest>) => {
  try {
    const res = await build(e.data);
    (self as unknown as Worker).postMessage(res, res.rgba ? [res.rgba.buffer] : []);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, width: 0, height: 0, error: (err as Error).message } satisfies ImageryResult);
  }
};
