// Data loading: bundled Natural Earth layers and geoBoundaries (gbOpen) via its public API.
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { joinAcross180 } from './dissolve';

const cache = new Map<string, Promise<unknown>>();

function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key) as Promise<T> | undefined;
  if (!p) {
    p = load().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}

async function topo(name: string): Promise<FeatureCollection> {
  return once(`topo:${name}`, async () => {
    const res = await fetch(`./data/${name}.json`);
    if (!res.ok) throw new Error(`Could not load ${name}.`);
    const t = await res.json();
    const key = Object.keys(t.objects)[0];
    return feature(t, t.objects[key]) as unknown as FeatureCollection;
  });
}

export const loadCountries = () => topo('countries10');
export const loadCountriesLow = () => topo('countries50');
export const loadRivers = () => topo('rivers10');
export const loadLakes = () => topo('lakes10');
export const loadDisputed = () => topo('disputed10');

export interface CountryInfo {
  iso: string;
  name: string;
}

export async function countryList(): Promise<CountryInfo[]> {
  const fc = await loadCountriesLow();
  return fc.features
    .map((f) => ({ iso: String(f.properties?.iso ?? ''), name: String(f.properties?.name ?? '') }))
    .filter((c) => c.iso && c.iso !== '-99' && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface BoundaryMeta {
  iso: string;
  level: number;
  canonical: string;
  license: string;
  source: string;
  year: string;
  url: string;
  count: number;
}

type IndexRow = [number, string, string, string, string, string, number];

/**
 * Every country's boundary levels, bundled with the app (public/data/gb-index.json, made from the geoBoundaries
 * API "ALL/ALL" listing), so checking which levels exist is instant instead of five slow API calls.
 */
const gbIndex = () => once('gbindex', async () => {
  const res = await fetch('./data/gb-index.json');
  if (!res.ok) throw new Error('Could not load the boundary index.');
  return (await res.json()) as Record<string, IndexRow[]>;
});

export async function boundaryMeta(iso: string, level: number): Promise<BoundaryMeta | null> {
  const idx = await gbIndex().catch(() => null);
  const row = idx?.[iso]?.find((r) => r[0] === level);
  if (!row) return null;
  const [, canonical, license, source, year, commit, count] = row;
  return {
    iso, level, license, source, year, count,
    canonical, // '' when geoBoundaries has no name for the level (see kindName)
    url: `https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/${commit}/releaseData/gbOpen/${iso}/ADM${level}/geoBoundaries-${iso}-ADM${level}_simplified.geojson`,
  };
}

/** Which admin levels (1..5) exist for a country. */
export async function availableLevels(iso: string): Promise<BoundaryMeta[]> {
  const metas = await Promise.all([1, 2, 3, 4, 5].map((l) => boundaryMeta(iso, l)));
  return metas.filter((m): m is BoundaryMeta => !!m);
}

/** Start downloading the index early so the first use is instant. */
export function warmBoundaryIndex() { gbIndex().catch(() => {}); }

export async function loadBoundaries(meta: BoundaryMeta): Promise<FeatureCollection> {
  return once(`gb:${meta.url}`, async () => {
    const res = await fetch(meta.url);
    if (!res.ok) throw new Error(`Could not download the ${meta.canonical || `level ${meta.level}`} boundaries for ${meta.iso}.`);
    const fc = (await res.json()) as FeatureCollection;
    // areas cut at the 180° meridian are joined back, so no border is drawn down 180° (callers rewind() as before)
    fc.features = fc.features.map((f) => joinAcross180(f));
    fc.features.forEach((f, i) => {
      const p = (f.properties ??= {});
      p.__id = String(p.shapeID ?? i);
      p.__name = String(p.shapeName ?? `Unit ${i + 1}`);
    });
    return fc;
  });
}

export function featureName(f: Feature<Geometry | null>): string {
  const p = f.properties ?? {};
  return String(p.__name ?? p.name ?? p.NAME ?? p.shapeName ?? 'Unnamed');
}
