// Find any place on Earth and get its outline.
// Suggestions: Photon (komoot), built on OpenStreetMap, made for search-as-you-type.
// Outline: Nominatim lookup, one request per chosen place, as its usage policy asks.
import type { Feature, Geometry } from 'geojson';

export interface PlaceHit {
  osm: string; // e.g. "R1234"
  name: string;
  detail: string; // "Division, Bangladesh"
  kind: string; // human words: "City", "District", "Lake"...
  countryCode: string;
  center: [number, number];
  extent?: [number, number, number, number]; // w, n, e, s
}

const KIND: Record<string, string> = {
  city: 'City', town: 'Town', village: 'Village', hamlet: 'Village', suburb: 'Area', district: 'District',
  county: 'District', state: 'Division or state', country: 'Country', locality: 'Place', street: 'Street',
  house: 'Building', administrative: 'Area', water: 'Water', lake: 'Lake', river: 'River', park: 'Park',
  national_park: 'National park', nature_reserve: 'Protected area', island: 'Island', mountain_range: 'Mountains',
  peak: 'Peak', university: 'University', forest: 'Forest', wood: 'Forest', bay: 'Bay', wetland: 'Wetland',
};

/** How likely a result is the area a researcher means: countries and regions first, buildings last. */
const RANK: Record<string, number> = {
  country: 0, state: 1, region: 1, province: 1, city: 2, county: 2, district: 2, administrative: 2,
  lake: 3, island: 3, national_park: 3, nature_reserve: 3, protected_area: 3, park: 3, forest: 3, wood: 3, bay: 3,
  wetland: 3, river: 3, water: 3, mountain_range: 3, peak: 4, town: 4, municipality: 4,
  suburb: 5, locality: 5, university: 5, village: 6, hamlet: 6, neighbourhood: 6, street: 7, house: 8, building: 8,
};

let ctrl: AbortController | null = null;

export async function suggest(q: string, near?: [number, number] | null): Promise<PlaceHit[]> {
  ctrl?.abort();
  ctrl = new AbortController();
  // A gentle location bias: places near the current map (or the user's country) rank higher; others still appear.
  const bias = near ? `&lat=${near[1].toFixed(3)}&lon=${near[0].toFixed(3)}&zoom=5&location_bias_scale=0.4` : '';
  // Spelling variants: OpenStreetMap often writes "St." where people type "Saint" (and Mount/Mt., Fort/Ft.).
  const swaps: [RegExp, string][] = [[/\bsaint\b/i, 'St.'], [/\bst\.?(?=\s)/i, 'Saint'], [/\bmount\b/i, 'Mt.'], [/\bmt\.?(?=\s)/i, 'Mount'], [/\bfort\b/i, 'Ft.']];
  const queries = [q, ...swaps.filter(([re]) => re.test(q)).map(([re, to]) => q.replace(re, to))].slice(0, 2);
  const answers = await Promise.all(queries.map(async (qq) => {
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(qq)}&limit=8&lang=en${bias}`, { signal: ctrl!.signal });
    if (!res.ok) throw new Error('Place search is not responding. Try again in a moment.');
    return res.json();
  }));
  const j = { features: answers.flatMap((a) => a.features ?? []) };
  // Order: names that match what was typed come first (wherever they are), then places near the map; the
  // service's own order is kept within each group.
  const norm = (x: string) => x.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\bst\.?\s/g, 'saint ').replace(/[^a-z0-9]+/g, ' ').trim();
  const typed = norm(q);
  const rank = (f: any) => RANK[f.properties?.osm_value] ?? RANK[f.properties?.type] ?? (f.properties?.osm_key === 'boundary' || f.properties?.osm_key === 'natural' ? 3 : 5);
  const exact = (f: any) => Number(rank(f) <= 4 && norm(String(f.properties?.name ?? '')) === typed);
  const far = (c: [number, number]) => (near ? Number(Math.hypot((c[0] - near[0]) * Math.cos((near[1] * Math.PI) / 180), c[1] - near[1]) > 13.5) : 0);
  j.features.sort((a: any, b: any) => exact(b) - exact(a) || rank(a) - rank(b) || far(a.geometry.coordinates) - far(b.geometry.coordinates));
  const seen = new Set<string>();
  const shown = new Set<string>();
  const out: PlaceHit[] = [];
  for (const f of j.features ?? []) {
    const p = f.properties ?? {};
    const osm = `${p.osm_type}${p.osm_id}`;
    if (!p.osm_type || seen.has(osm)) continue;
    seen.add(osm);
    const parts = [p.county !== p.name ? p.county : '', p.state !== p.name ? p.state : '', p.country !== p.name ? p.country : ''].filter(Boolean);
    const label = [p.name, p.osm_value, ...parts].join('|');
    if (shown.has(label)) continue; // e.g. an island mapped both as an outline and as a point
    shown.add(label);
    out.push({
      osm,
      name: p.name ?? p.street ?? 'Unnamed place',
      detail: [...new Set(parts)].join(', '),
      kind: KIND[p.osm_value] ?? KIND[p.type] ?? (p.osm_key === 'boundary' ? 'Area' : 'Place'),
      countryCode: String(p.countrycode ?? '').toUpperCase(),
      center: f.geometry.coordinates,
      extent: p.extent,
    });
  }
  return out;
}

/** The outline of a chosen place (polygon when OpenStreetMap has one, otherwise its point). */
export async function outline(hit: PlaceHit): Promise<Feature<Geometry>> {
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${hit.osm}&format=geojson&polygon_geojson=1&polygon_threshold=0.0003`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const j = await res.json();
      const f = j.features?.[0];
      if (f?.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon' || f.geometry.type.includes('Line'))) {
        return { type: 'Feature', properties: { name: hit.name }, geometry: f.geometry };
      }
    }
  } catch {
    /* try a search below */
  }
  // Many towns are mapped as a point with a separate boundary; look for that boundary around the point.
  try {
    const q = encodeURIComponent([hit.name, hit.detail.split(', ').pop()].filter(Boolean).join(', '));
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=geojson&polygon_geojson=1&polygon_threshold=0.0003&limit=6`);
    if (res.ok) {
      const j = await res.json();
      const [lon, lat] = hit.center;
      const want = hit.name.trim().toLowerCase();
      const area = (j.features ?? []).find((f: any) => {
        if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) return false;
        const name = String(f.properties?.name ?? f.properties?.display_name ?? '').split(',')[0].trim().toLowerCase();
        const [w, s, e, n] = f.bbox ?? [Infinity, Infinity, -Infinity, -Infinity];
        return name === want && lon >= w && lon <= e && lat >= s && lat <= n && e - w < 6;
      });
      if (area) return { type: 'Feature', properties: { name: hit.name }, geometry: area.geometry };
    }
  } catch {
    /* fall back to the point */
  }
  return { type: 'Feature', properties: { name: hit.name }, geometry: { type: 'Point', coordinates: hit.center } };
}

/** Extent for a point place: the search result's box, or a few kilometres around it. */
export function pointExtent(hit: PlaceHit): Feature<Geometry> {
  const [lon, lat] = hit.center;
  // About 20 km across when the place has no useful extent of its own.
  let [w, n, e, s] = hit.extent ?? [lon - 0.1, lat + 0.09, lon + 0.1, lat - 0.09];
  if (Math.abs(e - w) < 0.05) { w = lon - 0.1; e = lon + 0.1; }
  if (Math.abs(n - s) < 0.05) { s = lat - 0.09; n = lat + 0.09; }
  return { type: 'Feature', properties: { name: hit.name, __extentOnly: true }, geometry: { type: 'Polygon', coordinates: [[[w, s], [w, n], [e, n], [e, s], [w, s]]] } };
}

export const EXAMPLES = ['Dhaka', 'Sundarbans', 'Kathmandu Valley', 'Lake Victoria', 'Mekong Delta', 'Rangamati'];
