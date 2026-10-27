// Detailed rivers, water bodies, roads and town names from OpenStreetMap, fetched for the map extent via Overpass.
// Data © OpenStreetMap contributors, ODbL. An exported figure is a "Produced Work" and needs that credit.
import type { FeatureCollection } from 'geojson';

export type OsmTheme = 'water' | 'roads' | 'places';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/** Largest box we ask for, in square degrees, so requests stay polite and fast. */
export const MAX_AREA_DEG2 = 4;

export function areaDeg2(b: [[number, number], [number, number]]) {
  return Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
}

/** Overpass boxes in -180…180: a map across 180° (east past 180, see frameLonLatBounds) asks for both sides. */
function boxes(b: [[number, number], [number, number]]): string[] {
  const s = b[0][1].toFixed(4), n = b[1][1].toFixed(4);
  let w = b[0][0], e = b[1][0];
  if (w < -180) { w += 360; e += 360; }
  if (e <= 180) return [`(${s},${w.toFixed(4)},${n},${e.toFixed(4)})`];
  return [`(${s},${w.toFixed(4)},${n},180)`, `(${s},-180,${n},${(e - 360).toFixed(4)})`];
}

function query(theme: OsmTheme, b: [[number, number], [number, number]]): string {
  const bb = boxes(b);
  const each = (stmt: string) => bb.map((box) => `${stmt}${box};`).join('');
  const small = areaDeg2(b) < 0.25;
  if (theme === 'water') {
    const lines = small ? 'river|canal|stream' : 'river|canal';
    return `[out:json][timeout:60];(${each(`way["waterway"~"^(${lines})$"]`)}${each('way["natural"="water"]')}${each('relation["natural"="water"]')}${each('way["waterway"="riverbank"]')});out geom;`;
  }
  if (theme === 'places') {
    // cities and towns; on a small map also villages and the parts of a town
    const kinds = small ? 'city|town|village|suburb' : areaDeg2(b) < 1.5 ? 'city|town|village' : 'city|town';
    return `[out:json][timeout:60];(${each(`node["place"~"^(${kinds})$"]["name"]`)});out;`;
  }
  const roads = small ? 'motorway|trunk|primary|secondary|tertiary' : 'motorway|trunk|primary|secondary';
  return `[out:json][timeout:60];(${each(`way["highway"~"^(${roads})$"]`)});out geom;`;
}

export async function fetchOsm(theme: OsmTheme, b: [[number, number], [number, number]], onTry?: (server: string) => void): Promise<FeatureCollection> {
  if (areaDeg2(b) > MAX_AREA_DEG2) throw new Error('The map covers too large an area for detailed OpenStreetMap data. Zoom in, or use the Natural Earth rivers.');
  const body = new URLSearchParams({ data: query(theme, b) });
  let lastErr = '';
  for (const url of SERVERS) {
    onTry?.(new URL(url).host);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25000);
    try {
      const res = await fetch(url, { method: 'POST', body, signal: ac.signal });
      if (!res.ok) { lastErr = `${new URL(url).host} answered ${res.status}`; continue; }
      const json = await res.json();
      const osmtogeojson = (await import('osmtogeojson')).default;
      const fc = osmtogeojson(json) as FeatureCollection;
      fc.features = fc.features.filter((f) => f.geometry && (theme === 'places' ? f.geometry.type === 'Point' : f.geometry.type !== 'Point'));
      for (const f of fc.features) {
        const p = (f.properties ??= {});
        const tags = (p.tags ?? p) as Record<string, string>;
        // English names where OpenStreetMap has them (a figure for an English-language journal)
        p.name = theme === 'places' ? tags['name:en'] ?? tags.name ?? '' : tags.name ?? '';
        p.cls = theme === 'roads' ? tags.highway ?? '' : theme === 'places' ? tags.place ?? '' : tags.waterway ?? tags.natural ?? '';
        if (theme === 'places' && tags.population) p.population = Number(String(tags.population).replace(/[^\d]/g, '')) || 0;
        delete p.tags;
        delete p.meta;
        delete p.relations;
      }
      return fc;
    } catch (e) {
      lastErr = (e as Error).name === 'AbortError' ? `${new URL(url).host} timed out` : (e as Error).message;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`OpenStreetMap servers are busy right now (${lastErr}). Try again in a minute.`);
}
