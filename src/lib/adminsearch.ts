// Search official boundaries (geoBoundaries) by name across every level of a country, so a user types
// "Dhaka" and gets Dhaka Division, Dhaka District... without choosing a level first.
import { geoArea, geoBounds, geoContains } from 'd3-geo';
import type { Feature } from 'geojson';
import { availableLevels, featureName, loadBoundaries } from './data';
import type { BoundaryMeta } from './data';

export interface AdminHit {
  /** the unit one level up that holds this one, filled in when names repeat */
  within?: string;
  feat?: Feature;
  /** match quality, lower is better */
  score?: number;
  iso: string;
  level: number;
  kind: string; // "District", "Upazila"...
  /** the level has no name of its own, so `kind` is a stand-in word that is not added to the place's name */
  generic?: boolean;
  id: string;
  name: string;
}

const MAX_UNITS = 6000;
const loaded = new Map<string, AdminHit[]>(); // iso:level -> units
const pending = new Map<string, Promise<void>>();

/** "subdistricts" -> "Subdistrict", "Union Councils / Municipal..." -> "Union council". */
// geoBoundaries leaves some levels unnamed (Russia's first level): a plain word stands in, never the code "ADM1"
const GENERIC_KINDS: Record<number, string> = { 1: 'Region', 2: 'District', 3: 'Sub-district', 4: 'Local area', 5: 'Local area' };

/** True when a level has no name of its own: a place is then called by its name alone ("Chukotka Autonomous Okrug"). */
export function genericKind(canonical: string): boolean {
  return !canonical.trim();
}

export function kindName(canonical: string, level: number): string {
  if (genericKind(canonical)) return GENERIC_KINDS[level] ?? 'Area';
  const w = canonical.split(/[\/,]/)[0].trim();
  const one = w.replace(/ies$/i, 'y').replace(/(?<!s)s$/i, '');
  return one.charAt(0).toUpperCase() + one.slice(1).toLowerCase();
}

function loadLevel(meta: BoundaryMeta): Promise<void> {
  const k = `${meta.iso}:${meta.level}`;
  if (loaded.has(k)) return Promise.resolve();
  let p = pending.get(k);
  if (!p) {
    p = loadBoundaries(meta).then((fc) => {
      const kind = kindName(meta.canonical, meta.level);
      const generic = genericKind(meta.canonical);
      loaded.set(k, fc.features.map((f) => ({ iso: meta.iso, level: meta.level, kind, generic, id: String(f.properties?.__id), name: featureName(f), feat: f as Feature })));
    }).finally(() => pending.delete(k));
    pending.set(k, p);
  }
  return p;
}

/** Download the name lists of a country's levels, coarse first. Calls `onLevel` as each arrives. */
export async function warmCountry(iso: string, onLevel?: () => void, depth = 4): Promise<void> {
  if (!iso) return;
  const levels = (await availableLevels(iso)).filter((m) => m.count <= MAX_UNITS);
  for (const m of levels.slice(0, depth)) {
    // one level at a time, when the browser is idle, so typing and the results list stay responsive
    await new Promise<void>((r) => ((globalThis as any).requestIdleCallback ? (globalThis as any).requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 50)));
    await loadLevel(m).catch(() => {});
    onLevel?.();
  }
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Best matches among the names already downloaded for `iso`. */
export function searchAdmin(q: string, iso: string, limit = 6): AdminHit[] {
  const n = norm(q);
  if (n.length < 2 || !iso) return [];
  const scored: { h: AdminHit; s: number }[] = [];
  for (const [k, list] of loaded) {
    if (!k.startsWith(iso + ':')) continue;
    for (const h of list) {
      const m = norm(h.name);
      const s = m === n ? 0 : m.startsWith(n) ? 1 : m.split(' ').some((w) => w.startsWith(n)) ? 2 : m.includes(n) ? 3 : -1;
      if (s >= 0) scored.push({ h, s: s * 10 + h.level });
    }
  }
  scored.sort((a, b) => a.s - b.s || a.h.name.localeCompare(b.h.name));
  const seen = new Set<string>();
  const out: AdminHit[] = [];
  for (const { h, s } of scored) {
    h.score = s;
    const key = `${h.level}:${h.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

/** A best guess at the user's own country from their time zone, so the first search already knows it. */
export function homeCountry(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  const map: Record<string, string> = {
    'Asia/Dhaka': 'BGD', 'Asia/Kolkata': 'IND', 'Asia/Calcutta': 'IND', 'Asia/Karachi': 'PAK', 'Asia/Kathmandu': 'NPL', 'Asia/Katmandu': 'NPL',
    'Asia/Colombo': 'LKA', 'Asia/Thimphu': 'BTN', 'Asia/Yangon': 'MMR', 'Asia/Bangkok': 'THA', 'Asia/Jakarta': 'IDN', 'Asia/Manila': 'PHL',
    'Asia/Ho_Chi_Minh': 'VNM', 'Asia/Kuala_Lumpur': 'MYS', 'Asia/Shanghai': 'CHN', 'Asia/Tokyo': 'JPN', 'Asia/Seoul': 'KOR', 'Asia/Tehran': 'IRN',
    'Asia/Riyadh': 'SAU', 'Asia/Dubai': 'ARE', 'Africa/Nairobi': 'KEN', 'Africa/Lagos': 'NGA', 'Africa/Addis_Ababa': 'ETH', 'Africa/Cairo': 'EGY',
    'Africa/Johannesburg': 'ZAF', 'Africa/Accra': 'GHA', 'Africa/Dar_es_Salaam': 'TZA', 'Africa/Kampala': 'UGA', 'Europe/London': 'GBR',
    'Europe/Berlin': 'DEU', 'Europe/Paris': 'FRA', 'Europe/Madrid': 'ESP', 'Europe/Rome': 'ITA', 'Europe/Istanbul': 'TUR', 'America/Sao_Paulo': 'BRA',
    'America/Mexico_City': 'MEX', 'America/Bogota': 'COL', 'America/Lima': 'PER', 'Australia/Sydney': 'AUS', 'Asia/Kabul': 'AFG',
  };
  return map[tz] ?? '';
}

/** Does unit f contain point c? Works whichever way its rings are wound (some files wind them the other way). */
const boxes = new WeakMap<object, { b: [[number, number], [number, number]]; flip: boolean }>();
function holds(f: Feature, c: [number, number]): boolean {
  let m = boxes.get(f);
  if (!m) {
    const flip = geoArea(f as any) > 2 * Math.PI;
    m = { flip, b: flip ? [[-180, -90], [180, 90]] : (geoBounds(f as any) as [[number, number], [number, number]]) };
    boxes.set(f, m);
  }
  if (!m.flip && (c[0] < m.b[0][0] || c[0] > m.b[1][0] || c[1] < m.b[0][1] || c[1] > m.b[1][1])) return false;
  try { return geoContains(f as any, c) !== m.flip; } catch { return false; }
}

/** For results whose names repeat, find the unit one level up that holds each one. */
export function explainRepeats(hits: AdminHit[]): AdminHit[] {
  const count = new Map<string, number>();
  for (const h of hits) count.set(h.level + ':' + h.name, (count.get(h.level + ':' + h.name) ?? 0) + 1);
  for (const h of hits) {
    if ((count.get(h.level + ':' + h.name) ?? 0) < 2 || h.within !== undefined || !h.feat || h.level < 2) continue;
    const parents = loaded.get(`${h.iso}:${h.level - 1}`);
    if (!parents) continue;
    try {
      // a point of the unit itself: the mean of its outer ring (immune to the ring winding, unlike geoCentroid)
      const g: any = h.feat.geometry;
      const ring: [number, number][] = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates.reduce((a: any, p: any) => (p[0].length > a.length ? p[0] : a), []) : [];
      if (!ring.length) continue;
      const c: [number, number] = [ring.reduce((t, q) => t + q[0], 0) / ring.length, ring.reduce((t, q) => t + q[1], 0) / ring.length];
      h.within = parents.find((p) => p.feat && holds(p.feat, c))?.name ?? '';
    } catch { h.within = ''; }
  }
  return hits;
}
