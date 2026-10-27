// Numbers about the study area and the sentences a paper needs around its map figure: size, perimeter, centre,
// bounding coordinates, a methods sentence and alt text, worked out from the same geometry the map draws.
import type { Feature, Geometry, MultiLineString, Position } from 'geojson';
import { geoArea, geoBounds, geoCentroid, geoLength } from 'd3-geo';
import type { Doc } from './store.svelte';
import type { MainScene } from './scene';

const R_KM = 6371.0088; // mean Earth radius

export interface StudyFacts {
  areaKm2: number;
  perimeterKm: number;
  centre: [number, number];
  bounds: [[number, number], [number, number]];
  parts: number;
}

/** The outline of polygons as lines, for their perimeter. */
function rings(g: Geometry): Position[][] {
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type === 'MultiPolygon') return g.coordinates.flat();
  if (g.type === 'GeometryCollection') return g.geometries.flatMap(rings);
  return [];
}

export function studyFacts(features: Feature<Geometry>[]): StudyFacts | null {
  const polys = features.filter((f) => f.geometry && !f.properties?.__extentOnly && /Polygon|GeometryCollection/.test(f.geometry.type));
  if (!polys.length) return null;
  let sr = 0, len = 0;
  for (const f of polys) {
    let a = geoArea(f as any);
    if (a > 2 * Math.PI) a = 4 * Math.PI - a; // a ring wound the wrong way reads as the rest of the globe
    sr += a;
    const lines: MultiLineString = { type: 'MultiLineString', coordinates: rings(f.geometry) };
    len += geoLength(lines as any);
  }
  const fc = { type: 'FeatureCollection', features: polys } as any;
  return { areaKm2: sr * R_KM * R_KM, perimeterKm: len * R_KM, centre: geoCentroid(fc) as [number, number], bounds: geoBounds(fc) as [[number, number], [number, number]], parts: polys.length };
}

/** 23°45′12″N style, as journals print coordinates. */
export function dms(v: number, axis: 'lat' | 'lon'): string {
  const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : v >= 0 ? 'E' : 'W';
  let s = Math.round(Math.abs(v) * 3600);
  const d = Math.floor(s / 3600); s -= d * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${hemi}`;
}

/** Area with sensible rounding: 1,463 km², 12.4 km², 0.82 km². */
export function fmtArea(km2: number): string {
  if (km2 >= 100) return `${Math.round(km2).toLocaleString('en-US')} km²`;
  if (km2 >= 1) return `${km2.toFixed(1)} km²`;
  return `${km2.toFixed(2)} km² (${Math.round(km2 * 100).toLocaleString('en-US')} ha)`;
}
export const fmtKm = (km: number) => (km >= 100 ? `${Math.round(km).toLocaleString('en-US')} km` : `${km.toFixed(1)} km`);

export interface PaperText { facts: string; location: string; methods: string; alt: string }

/** Ready-to-paste sentences for the study-area section, the methods and the figure's alt text. */
export function paperText(doc: Doc, main: MainScene | null, f: StudyFacts, credits: string[]): PaperText {
  const name = doc.study.name || 'The study area';
  const country = doc.study.countryName && doc.study.countryName !== doc.study.name ? doc.study.countryName : '';
  const [[w, s], [e, n]] = f.bounds;
  const location = `${name}${country ? `, ${country},` : ''} lies between ${dms(s, 'lat')} and ${dms(n, 'lat')} latitude and ${dms(w, 'lon')} and ${dms(e, 'lon')} longitude, centred near ${dms(f.centre[1], 'lat')}, ${dms(f.centre[0], 'lon')}.`;
  const facts = `It covers about ${fmtArea(f.areaKm2)}, with a boundary length of about ${fmtKm(f.perimeterKm)}${f.parts > 1 ? ` in ${f.parts} parts` : ''}.`;
  const crs = main ? `${main.crs.name}${main.crs.code.startsWith('EPSG') ? ` (${main.crs.code})` : ''}` : '';
  const data = credits.find((c) => c.startsWith('Data: '))?.slice(6).replace(/\s*\([^)]*\)/g, '') ?? '';
  const methods = `The study area map was prepared with StudyMap${data ? ` from ${data}` : ''}${crs ? `, in the ${crs} projection` : ''}.`;
  const insets = doc.items.filter((i) => i.kind === 'inset' && i.visible).length;
  const has = (k: string) => doc.items.some((i) => i.kind === k && i.visible);
  const map = doc.items.find((i) => i.kind === 'map');
  const parts = [has('legend') && 'a legend', has('north') && 'a north arrow', has('scale') && 'a scale bar', map?.kind === 'map' && map.grid.show && 'latitude and longitude labels'].filter(Boolean) as string[];
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const details = doc.items.filter((i) => i.kind === 'detail' && i.visible).length;
  const alt = `Map of ${name}${country ? `, ${country}` : ''}, showing the study area outlined${doc.layers.some((l) => l.kind === 'subunits' && l.visible) ? ' with its sub-areas named' : ''}${insets ? `, and ${insets === 1 ? 'a small locator map' : `${insets} small locator maps`} showing where it lies` : ''}.${details ? ` ${details === 1 ? 'A detail map enlarges' : `${details} detail maps enlarge`} part of the area, marked by a box on the main map.` : ''}${list ? ` The figure has ${list}.` : ''}`;
  return { facts, location, methods, alt };
}
