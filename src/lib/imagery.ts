// Main-thread side of the imagery worker: requests, JPEG encoding, caching.
import type { ImageryRequest, ImageryResult } from './imagery.worker';

/** Free base maps whose licence allows printing in commercial journals. {date} is the day chosen (YYYY-MM-DD). */
export const BASEMAPS = {
  s2cloudless: {
    name: 'Satellite (Sentinel-2, 2016)',
    // EOX WMTS GoogleMapsCompatible grid: {TileMatrix}/{TileRow}/{TileCol}
    url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
    maxZoom: 14,
    dated: false,
    credit: 'Imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0',
    short: 'Imagery: Sentinel-2 cloudless 2016 by EOX (CC BY 4.0)',
  },
  // NASA's daily true-colour pictures of the whole Earth (no licence limits, credit asked): for countries and regions,
  // too coarse (250–375 m) for a district or a town
  viirs: {
    name: 'Satellite on a chosen day (NASA VIIRS, 375 m)',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    maxZoom: 9,
    dated: true,
    credit: 'Imagery: NASA EOSDIS GIBS, VIIRS (Suomi NPP) corrected reflectance, {date}',
    short: 'Imagery: NASA GIBS VIIRS, {date}',
  },
  // NASA's Harmonized Landsat Sentinel-2 (30 m) of a chosen season, put together from every day's pictures in it
  hls: {
    name: 'Satellite of a chosen season (NASA HLS, 30 m)',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
    maxZoom: 12,
    dated: true,
    credit: 'Imagery: NASA EOSDIS GIBS, Harmonized Landsat Sentinel-2 (HLS) surface reflectance, composite of {date}',
    short: 'Imagery: NASA HLS, {date}',
  },
  modis: {
    name: 'Satellite on a chosen day (NASA MODIS, 250 m)',
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg',
    maxZoom: 9,
    dated: true,
    credit: 'Imagery: NASA EOSDIS GIBS, MODIS (Terra) corrected reflectance, {date}',
    short: 'Imagery: NASA GIBS MODIS, {date}',
  },
} as const;
export type BasemapId = keyof typeof BASEMAPS;

const HLS_URLS = [
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/HLS_L30_Nadir_BRDF_Adjusted_Reflectance/default/{date}/GoogleMapsCompatible_Level12/{z}/{y}/{x}.png',
];
/** The days of a season ("2025-12-01/2026-02-28"), every other day, at most 30 of them. */
export function seasonDays(range: string): string[] {
  const [a, b] = range.split('/');
  const t0 = Date.parse(a), t1 = Date.parse(b ?? a);
  if (!isFinite(t0) || !isFinite(t1) || t1 < t0) return [];
  const step = Math.max(2, Math.ceil((t1 - t0) / 86_400_000 / 30)) * 86_400_000;
  const out: string[] = [];
  for (let t = t0; t <= t1 && out.length < 30; t += step) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
/** The most recent dry season (December to February, when the sky is clearest over South Asia), as a range. */
export function lastDrySeason(): string {
  const now = new Date();
  const y = now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y - 1}-12-01/${y}-02-28`;
}
/** The request extras for a base map: the many-day composite of HLS, nothing for the others. */
export function basemapComposite(id: BasemapId, date?: string): { urls: string[]; dates: string[] } | undefined {
  if (id !== 'hls') return undefined;
  return { urls: HLS_URLS, dates: seasonDays(date || lastDrySeason()) };
}

/** A recent day the daily NASA pictures are complete for (they appear a day or so after). */
export function recentDay(): string {
  const d = new Date(Date.now() - 3 * 86_400_000);
  return d.toISOString().slice(0, 10);
}
/** The tile address of a base map, with its day filled in. */
export function basemapUrl(id: BasemapId, date?: string): string {
  return BASEMAPS[id].url.replace('{date}', date || recentDay());
}
export function basemapCredit(id: BasemapId, date?: string, short = false): string {
  const when = id === 'hls' ? (date || lastDrySeason()).replace('/', ' to ') : date || recentDay();
  return (short ? BASEMAPS[id].short : BASEMAPS[id].credit).replace('{date}', when);
}

let worker: Worker | null = null;
let seq = 0;
/** a handler returns false while it waits for more (progress messages) */
const pending = new Map<number, (r: ImageryResult) => void | false>();
const cache = new Map<string, Promise<string>>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./imagery.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ImageryResult>) => {
      if (pending.get(e.data.id)?.(e.data) === false) return;
      pending.delete(e.data.id);
    };
    // the worker could not start (offline, its file missing) or crashed (out of memory): every request waiting on it
    // fails instead of waiting for ever, and the next one starts a fresh worker
    worker.onerror = (e) => {
      e.preventDefault();
      worker?.terminate();
      worker = null;
      for (const [id, done] of [...pending]) { pending.delete(id); done({ id, width: 0, height: 0, error: 'The satellite helper stopped. Try again.' } as ImageryResult); }
    };
  }
  return worker;
}

/** A data URL image covering the whole map frame. onProgress hears how far a many-day picture has got (0–1). */
export function imageryImage(req: Omit<ImageryRequest, 'id'>, onProgress?: (f: number) => void): Promise<string> {
  const key = JSON.stringify(req);
  let p = cache.get(key);
  if (p) return p;
  p = new Promise<string>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (r) => {
      if (r.progress !== undefined && !r.rgba && !r.error) { onProgress?.(r.progress); return false; }
      if (r.error || !r.rgba) return reject(new Error(r.error ?? 'Imagery failed.'));
      const raw = document.createElement('canvas');
      raw.width = r.width; raw.height = r.height;
      raw.getContext('2d')!.putImageData(new ImageData(r.rgba as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0);
      // JPEG has no transparency: paint gaps a quiet grey first, then the image over it
      const c = document.createElement('canvas');
      c.width = r.width; c.height = r.height;
      const g = c.getContext('2d')!;
      g.fillStyle = '#E4E6E3';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(raw, 0, 0);
      resolve(c.toDataURL('image/jpeg', 0.9));
    });
    getWorker().postMessage({ ...req, id } satisfies ImageryRequest);
  });
  p.catch(() => cache.delete(key));
  if (cache.size > 8) cache.delete(cache.keys().next().value!);
  cache.set(key, p);
  return p;
}
