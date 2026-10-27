// Main-thread side of the terrain worker: debounced requests, PNG encoding, caching.
import type { ProfileRequest, TerrainRequest, TerrainResult } from './terrain.worker';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: TerrainResult) => void>();
const cache = new Map<string, Promise<TerrainImage>>();

export interface TerrainImage {
  href: string; // PNG data URL
  zoom: number;
  minElev: number;
  maxElev: number;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./terrain.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<TerrainResult>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
    // the worker could not start (offline, its file missing) or crashed (out of memory): every request waiting on it
    // fails instead of waiting for ever, and the next one starts a fresh worker
    worker.onerror = (e) => {
      e.preventDefault();
      worker?.terminate();
      worker = null;
      for (const [id, done] of [...pending]) { pending.delete(id); done({ id, width: 0, height: 0, error: 'The terrain helper stopped. Try again.' } as TerrainResult); }
    };
  }
  return worker;
}

export function terrainImage(req: Omit<TerrainRequest, 'id'>): Promise<TerrainImage> {
  const key = JSON.stringify(req);
  let p = cache.get(key);
  if (p) return p;
  p = new Promise<TerrainImage>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (r) => {
      if (r.error || !r.rgba) return reject(new Error(r.error ?? 'Terrain failed.'));
      const c = document.createElement('canvas');
      c.width = r.width;
      c.height = r.height;
      c.getContext('2d')!.putImageData(new ImageData(r.rgba as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0);
      resolve({ href: c.toDataURL('image/png'), zoom: r.zoom!, minElev: r.minElev!, maxElev: r.maxElev! });
    });
    getWorker().postMessage({ ...req, id } satisfies TerrainRequest);
  });
  p.catch(() => cache.delete(key));
  if (cache.size > 12) cache.delete(cache.keys().next().value!);
  cache.set(key, p);
  return p;
}

/** Contour lines for a map frame, as lon/lat lines with their height ("100 m"); interval 0 picks one from the relief. */
export function contourLines(req: Omit<TerrainRequest, 'id' | 'contours'>, interval: number): Promise<{ fc: import('geojson').FeatureCollection; interval: number }> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (r) => {
      if (r.error || !r.lines) return reject(new Error(r.error ?? 'Contours failed.'));
      const iv = r.interval ?? interval;
      const features = r.lines.map((l) => {
        const coords: [number, number][] = [];
        for (let i = 0; i < l.pts.length; i += 2) coords.push([l.pts[i], l.pts[i + 1]]);
        // every fifth line is an index contour, drawn heavier as on a topographic map
        return { type: 'Feature' as const, properties: { name: `${l.level} m`, elev: l.level, major: Math.round(l.level / iv) % 5 === 0 }, geometry: { type: 'LineString' as const, coordinates: coords } };
      });
      resolve({ fc: { type: 'FeatureCollection', features }, interval: iv });
    });
    getWorker().postMessage({ ...req, contours: interval, tint: false, shade: false, id } satisfies TerrainRequest);
  });
}

export interface ProfileResult { km: number[]; m: number[]; lenKm: number; z: number }
const profiles = new Map<string, Promise<ProfileResult>>();

/**
 * The ground height at about `n` points evenly spaced along a line (lon/lat), with the distance along it in km.
 * `key` names the line (see lineKey in figparts.ts); the same line is read once. The tile zoom is chosen for a pixel of about 30 m.
 */
export function elevationProfile(line: [number, number][], key: string, n = 200): Promise<ProfileResult> {
  const id = `${key}|${n}`;
  let p = profiles.get(id);
  if (p) return p;
  p = new Promise<ProfileResult>((resolve, reject) => {
    const seqId = ++seq;
    pending.set(seqId, (r) => {
      if (r.error || !r.profile) return reject(new Error(r.error ?? 'The ground height could not be read.'));
      resolve(r.profile);
    });
    getWorker().postMessage({ id: seqId, profile: { pts: line.flatMap((c) => [c[0], c[1]]), n } } satisfies ProfileRequest);
  });
  p.catch(() => profiles.delete(id));
  if (profiles.size > 12) profiles.delete(profiles.keys().next().value!);
  profiles.set(id, p);
  return p;
}

export const TERRAIN_CREDIT ='Elevation: Copernicus GLO-30 (© DLR, Airbus DS; EU, ESA) via Mapterhorn';
/** Full wording for the figure caption, offered in Export. */
export const TERRAIN_CREDIT_FULL = 'Elevation: Mapterhorn terrain tiles, containing modified Copernicus GLO-30 data (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA; all rights reserved).';
