// Turns the document plus loaded data into drawable geometry for every frame.
import proj4 from 'proj4';
import { geoArea, geoContains, geoAzimuthalEqualArea, geoBounds, geoCentroid, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Geometry, Polygon, MultiPolygon } from 'geojson';
import type { GeoPath, GeoProjection } from 'd3-geo';
import { fitBounds, frameLonLatBounds, frameOutline, makeFrameProjection, projectedBounds, suggestCrs, thin, wrapLon } from './projection';
import type { CrsOption, FrameProjection } from './projection';
import { buildGraticule, geodesic, scaleBar, trueNorthAngle } from './carto';
import type { Graticule } from './carto';
import { buildProjectedGrid } from './grid';
import type { DetailItem, Doc, InsetItem, Layer, MapItem, ScaleItem } from './store.svelte';
import { textWidthMm } from './measure';
import { dissolve } from './dissolve';
import { basemapCredit } from './imagery';
import { TERRAIN_CREDIT } from './terrain';
import { ptToMm } from './journals';
import { pointLook, scanMarks } from './marks';
import type { MarksInfo } from './marks';

/* ---------- geometry helpers ---------- */

/** d3-geo wants clockwise exterior rings (the opposite of RFC 7946). Fix in place once. */
const rewound = new WeakSet<object>();
/* Facts about a feature that do not change while the map is zoomed or panned, worked out once (the map is
   rebuilt on every zoom, and these spherical sums were most of that time for large boundary files). */
const centroids = new WeakMap<object, [number, number]>();
const centreOf = (f: Feature) => { let c = centroids.get(f); if (!c) { c = geoCentroid(f as any) as [number, number]; centroids.set(f, c); } return c; };
const insideCache = new WeakMap<object, { s0: unknown; n: number; v: boolean }>();
/** Is the centre of feature f inside the study area? (cached per feature and study area) */
function insideStudy(f: Feature, study: Feature[]): boolean {
  const hit = insideCache.get(f);
  if (hit && hit.s0 === study[0] && hit.n === study.length) return hit.v;
  const c = centreOf(f);
  const v = study.some((s) => { try { return geoContains(s as any, c); } catch { return false; } });
  insideCache.set(f, { s0: study[0], n: study.length, v });
  return v;
}
const studyCentres = new WeakMap<object, { n: number; c: [number, number] }>();
function studyCentroid(study: Feature[]): [number, number] {
  const hit = studyCentres.get(study[0]);
  if (hit && hit.n === study.length) return hit.c;
  const c = geoCentroid({ type: 'FeatureCollection', features: study } as FeatureCollection) as [number, number];
  studyCentres.set(study[0], { n: study.length, c });
  return c;
}

export function rewind<T extends FeatureCollection | Feature>(obj: T): T {
  const feats: Feature[] = obj.type === 'FeatureCollection' ? (obj as FeatureCollection).features : [obj as Feature];
  for (const f of feats) {
    const g = f.geometry as Geometry | null;
    if (!g || rewound.has(g)) continue;
    const fixPoly = (rings: number[][][]) => {
      const poly: Polygon = { type: 'Polygon', coordinates: rings };
      if (geoArea(poly) > 2 * Math.PI) rings.forEach((r) => r.reverse());
    };
    if (g.type === 'Polygon') fixPoly(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(fixPoly);
    rewound.add(g);
  }
  return obj;
}

const bboxCache = new WeakMap<object, [[number, number], [number, number]]>();
export function featureBBox(f: Feature): [[number, number], [number, number]] {
  let b = bboxCache.get(f);
  if (!b) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    eachCoord(f.geometry, (x, y) => {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    });
    b = [[x0, y0], [x1, y1]];
    bboxCache.set(f, b);
  }
  return b;
}

export function eachCoord(g: Geometry | null, fn: (x: number, y: number) => void) {
  if (!g) return;
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { fn(c[0] as number, c[1] as number); return; }
    for (const x of c) walk(x);
  };
  if (g.type === 'GeometryCollection') g.geometries.forEach((x) => eachCoord(x, fn));
  else walk((g as Exclude<Geometry, { type: 'GeometryCollection' }>).coordinates);
}

export function samplePoints(feats: Feature[], max = 6000): [number, number][] {
  const all: [number, number][] = [];
  let total = 0;
  for (const f of feats) eachCoord(f.geometry, () => total++);
  const every = Math.max(1, Math.floor(total / max));
  let i = 0;
  for (const f of feats) eachCoord(f.geometry, (x, y) => { if (i++ % every === 0) all.push([x, y]); });
  return all;
}

function intersects(a: [[number, number], [number, number]], b: [[number, number], [number, number]]) {
  return a[0][0] <= b[1][0] && a[1][0] >= b[0][0] && a[0][1] <= b[1][1] && a[1][1] >= b[0][1];
}

function inView(fc: FeatureCollection | null | undefined, view: [[number, number], [number, number]]): Feature[] {
  if (!fc) return [];
  // a view across 180° runs past 180 (see frameLonLatBounds): data there is stored from -180 on, so look there too
  const [[w, s], [e, n]] = view;
  const views: [[number, number], [number, number]][] = [view];
  if (e > 180) views.push([[w - 360, s], [e - 360, n]]);
  if (w < -180) views.push([[w + 360, s], [e + 360, n]]);
  return fc.features.filter((f) => f.geometry && views.some((v) => intersects(featureBBox(f), v)));
}

/* ---------- scene ---------- */

export interface LayerDraw {
  layer: Layer;
  layerId: string;
  paths: {
    d: string; name: string; kind: 'area' | 'line' | 'point'; x?: number; y?: number; alt?: boolean; noStroke?: boolean; w?: number;
    /** a shape drawn by hand has no name of its own yet: its key is its place in the layer (#0, #1…), which is what a click on it picks */
    key?: string;
    /** points styled by a column: the row it came from, its table values, and its radius in mm (symbol, or number ring) */
    idx?: number; props?: Record<string, unknown>; r?: number;
  }[];
  labels: { x: number; y: number; text: string; anchor: 'middle' | 'start'; weight: number; orig?: string; /** where a name moved by hand belongs (its leader line starts there) */ from?: [number, number]; /** a point's name: the radius of its marker, mm */ pr?: number }[];
  /** points styled by a column: the values the table holds (colours, symbols, number range of the sizes) */
  marks?: MarksInfo;
  /** areas of a boundary layer: every name the layer has, drawn or not (for colouring areas from a table) */
  allNames?: string[];
}

export interface MainScene {
  fp: FrameProjection;
  crs: CrsOption;
  crsSuggestions: CrsOption[];
  lonLatView: [[number, number], [number, number]];
  layers: LayerDraw[];
  byId: Record<string, LayerDraw>;
  graticule: ReturnType<typeof buildGraticule>;
  northAngle: number;
  studyCentroid: [number, number];
}

export interface Data {
  countries: FeatureCollection | null;
  /** the study country from geoBoundaries ADM0, so its border matches the admin units */
  country: Feature<Geometry> | null;
  countriesLow: FeatureCollection | null;
  rivers: FeatureCollection | null;
  lakes: FeatureCollection | null;
  disputed: FeatureCollection | null;
  admin: FeatureCollection | null;
  /** boundaries at fixed levels (extra boundary layers, locator maps) */
  adminLevels?: Record<number, FeatureCollection>;
  /** official units one level finer than the study area, inside it (thanas inside a district, etc.) */
  sub: FeatureCollection | null;
  study: Feature<Geometry>[];
  geoms: Record<string, FeatureCollection>;
  /** admin level of the study area when it is an official unit (1 division, 2 district, 3 upazila...) */
  studyLevel?: number;
}

/**
 * The level a "surroundings" locator shows: the chosen level, but always one above the study area itself, so a
 * district map shows its division (not the district again), an upazila map its district.
 */
export function parentLevel(frameLevel: number | undefined, studyLevel: number | undefined): number {
  const want = frameLevel ?? 2;
  if (studyLevel && studyLevel > 0 && want >= studyLevel) return Math.max(1, studyLevel - 1);
  return want;
}

/** The settings of points styled by a column that change where the scene puts things (sizes, numbers, the columns used); colours and legend texts do not. */
const markKey = (pb: NonNullable<Layer['pointsBy']>) => [pb.colorField, pb.symbolField, pb.sizeField, pb.sizeMin, pb.sizeMax, pb.sizeScale, pb.number, pb.numberField, pb.numberPt];

/** The last scene of each map frame (the main map and every detail map), kept while nothing that shapes it has changed. */
const cache = new Map<string, { key: string; refs: unknown[]; scene: MainScene | null }>();

/** What in the layer list changes where the layers' drawings fall (not their colours, which Figure reads live). */
function layersKey(doc: Doc, data: Data) {
  return doc.layers.map((l) => [l.id, l.kind, l.visible, l.style.labelField, l.osmTheme, l.style.sizePt, !!data.geoms[l.id], l.adminLevel ?? 0, l.labelText ?? null, l.pointsBy ? markKey(l.pointsBy) : 0, l.custom ? 1 : 0]);
}
const dataRefs = (data: Data) => [data.countries, data.countriesLow, data.country, data.rivers, data.lakes, data.disputed, data.admin, data.adminLevels, data.sub, data.study, data.geoms];

/** The scene for a frame from the last one when its key and data are the same, else made again. */
function remembered(id: string, key: string, data: Data, make: () => MainScene | null): MainScene | null {
  const refs = dataRefs(data);
  const hit = cache.get(id);
  if (hit && hit.key === key && hit.refs.every((r, i) => r === refs[i])) return hit.scene;
  const scene = make();
  if (cache.size > 24) cache.clear();
  cache.set(id, { key, refs, scene });
  return scene;
}

/**
 * Projected geometry for the main map. Cached: moving, restyling or reordering anything
 * that does not change the map's geometry reuses the previous result instantly.
 */
export function buildMain(doc: Doc, map: MapItem, data: Data): MainScene | null {
  const key = JSON.stringify([
    doc.crs?.proj4, doc.view, map.w, map.h, map.rotation ?? 0, map.grid.show, map.grid.step, map.grid.format, map.grid.units, map.grid.stepM, doc.study.iso, doc.study.highlight,
    doc.study.countryName,
    layersKey(doc, data),
  ]);
  return remembered(map.id, key, data, () => buildMainUncached(doc, map, data));
}

/** Every name in a boundary file (the same name an area is drawn and labelled under). */
function namesOf(fc: FeatureCollection | null | undefined): string[] {
  return fc ? fc.features.map((f) => String(f.properties?.name ?? f.properties?.__name ?? '')).filter(Boolean) : [];
}

function bboxFeature(b: [[number, number], [number, number]]): Feature<Polygon> {
  const [[w, s], [e, n]] = b;
  const ring: [number, number][] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) ring.push([w + ((e - w) * i) / steps, s]);
  for (let i = 1; i <= steps; i++) ring.push([e, s + ((n - s) * i) / steps]);
  for (let i = 1; i <= steps; i++) ring.push([e - ((e - w) * i) / steps, n]);
  for (let i = 1; i <= steps; i++) ring.push([w, n - ((n - s) * i) / steps]);
  return { type: 'Feature', properties: { __extentOnly: true }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** A boundaries layer draws its own level, or the automatic one. */
function adminFor(layer: Layer, data: Data): FeatureCollection | null {
  return layer.adminLevel ? data.adminLevels?.[layer.adminLevel] ?? null : data.admin;
}

const WORLD: [[number, number], [number, number]] = [[-179, -58], [179, 80]];

function buildMainUncached(doc: Doc, map: MapItem, data: Data): MainScene | null {
  const study = data.study.length ? data.study : [];
  // What the map frame is fitted to: a saved view box, the study area, or the whole world before a place is chosen.
  const saved = doc.view.extent;
  // d3 gives a box across 180° as west > east (Fiji: 177 to -178); here east runs on past 180 instead (177 to 182)
  const extent: [[number, number], [number, number]] | null = saved
    ? saved[0][0] > saved[1][0] ? [[saved[0][0], saved[0][1]], [saved[1][0] + 360, saved[1][1]]] : saved
    : study.length ? null : WORLD;
  const fitTo = extent ? [bboxFeature(extent)] : study;
  const pts = samplePoints(fitTo);
  if (!pts.length) return null;
  const fc = { type: 'FeatureCollection', features: fitTo } as FeatureCollection;
  const gb = extent ? extent : geoBounds(fc);
  const lonSpan = gb[0][0] > gb[1][0] ? gb[1][0] + 360 - gb[0][0] : gb[1][0] - gb[0][0]; // d3 gives west > east across 180°
  const span = Math.max(lonSpan, Math.abs(gb[1][1] - gb[0][1]));
  const centroid = (study.length ? studyCentroid(study) : [wrapLon(gb[0][0] + lonSpan / 2), (gb[0][1] + gb[1][1]) / 2]) as [number, number];
  const suggestions = suggestCrs(centroid[0], centroid[1], span);
  const crs = doc.crs ?? suggestions[0];
  const b = projectedBounds(crs, pts);
  if (!b) return null;
  const fit = fitBounds(b, map.w, map.h, extent ? 0 : doc.view.padding);
  const k = fit.k * doc.view.zoom;
  const center: [number, number] = [fit.center[0] - doc.view.panX / k, fit.center[1] + doc.view.panY / k];
  const fp = makeFrameProjection(crs, map.w, map.h, center, k, map.rotation ?? 0);
  return drawFrame(doc, data, map, fp, crs, suggestions, centroid, gb);
}

/** What a map frame draws on the page: its size in mm and its coordinate grid (the main map and every detail map have them). */
interface FrameBox { w: number; h: number; grid: MapItem['grid'] }

/** Everything a frame shows, projected through its own frame projection: the layers, their names and the grid. */
function drawFrame(doc: Doc, data: Data, map: FrameBox, fp: FrameProjection, crs: CrsOption, suggestions: CrsOption[], centroid: [number, number], gb: [[number, number], [number, number]]): MainScene {
  const study = data.study.length ? data.study : [];
  const llb = frameLonLatBounds(fp) ?? [[gb[0][0], gb[0][1]], [gb[1][0], gb[1][1]]];
  const padX = (llb[1][0] - llb[0][0]) * 0.25, padY = (llb[1][1] - llb[0][1]) * 0.25;
  const view: [[number, number], [number, number]] = [[llb[0][0] - padX, llb[0][1] - padY], [llb[1][0] + padX, llb[1][1] + padY]];

  const layers: LayerDraw[] = [];
  const osmWater = doc.layers.some((l) => l.kind === 'osm' && l.osmTheme === 'water' && l.visible && data.geoms[l.id]?.features.length);
  for (const layer of doc.layers) {
    if (osmWater && (layer.kind === 'rivers' || layer.kind === 'lakes')) continue;
    if (!layer.visible) continue;
    const draw: LayerDraw = { layer, layerId: layer.id, paths: [], labels: [] };
    const area = (feats: Feature[], name = (f: Feature) => String(f.properties?.name ?? f.properties?.__name ?? '')) => {
      for (const f of feats) {
        const d = fp.path(f as any);
        if (d) draw.paths.push({ d, name: name(f), kind: 'area' });
      }
    };
    switch (layer.kind) {
      case 'sea':
        draw.paths.push({ d: `M0,0H${map.w}V${map.h}H0Z`, name: 'sea', kind: 'area' });
        break;
      case 'countries': {
        const own = data.country;
        const wide = llb[1][0] - llb[0][0] > 30 || !data.countries;
        const near = inView(wide ? data.countriesLow : data.countries, view);
        // With the official district lines on, the home country's land is drawn from them (MapFrame paints them in its
        // land colour): the world outline of the home country is then drawn like a neighbour, so where it reaches past
        // the official border it reads as the neighbour's land, not as a stray piece of the home country.
        const official = doc.layers.some((l) => l.kind === 'admin' && l.visible) && !!data.admin?.features.length;
        for (const f of near) {
          const isOwn = f.properties?.iso === doc.study.iso;
          const d = fp.path(f as any);
          if (d) draw.paths.push({ d, name: String(f.properties?.name ?? ''), kind: 'area', alt: !isOwn || official, noStroke: official || (isOwn && !!own) });
        }
        if (own && !official) {
          const d = fp.path(own as any);
          if (d) draw.paths.push({ d, name: doc.study.countryName, kind: 'area' });
        }
        break;
      }
      case 'lakes':
        // Lakes smaller than about 0.3 mm² on paper print as specks.
        for (const f of inView(data.lakes, view)) {
          if (fp.area(f as any) < 0.3) continue;
          const d = fp.path(f as any);
          if (d) draw.paths.push({ d, name: String(f.properties?.name ?? ''), kind: 'area' });
        }
        break;
      case 'disputed': area(inView(data.disputed, view)); break;
      case 'rivers':
        // Natural Earth rivers are 1:10m data; at large scales they no longer follow the real channel, so below 0.4°
        // they only stand in until detailed OpenStreetMap water has loaded (that layer then replaces them).
        if (llb[1][0] - llb[0][0] > 40) break;
        if (llb[1][0] - llb[0][0] < 0.4 && !doc.layers.some((l) => l.kind === 'osm' && l.osmTheme === 'water' && l.visible)) break;
        for (const f of inView(data.rivers, view)) {
          const d = fp.path(f as any);
          if (d) draw.paths.push({ d, name: String(f.properties?.name ?? ''), kind: 'line' });
        }
        break;
      case 'admin': area(inView(adminFor(layer, data), view)); draw.allNames = namesOf(adminFor(layer, data)); break;
      case 'subunits': area(inView(data.sub, view)); draw.allNames = namesOf(data.sub); break;
      case 'study':
        if (!doc.study.highlight) break;
        for (const f of study) {
          if (f.properties?.__extentOnly) continue;
          const g = f.geometry;
          if (g.type === 'Point') {
            const q = fp.forward(g.coordinates as [number, number]);
            if (q) draw.paths.push({ d: '', name: String(f.properties?.name ?? ''), kind: 'point', x: q[0], y: q[1] });
            continue;
          }
          const d = fp.path(f as any);
          if (d) draw.paths.push({ d, name: String(f.properties?.name ?? f.properties?.__name ?? ''), kind: g.type.includes('Line') ? 'line' : 'area' });
        }
        break;
      case 'osm': {
        const fc = data.geoms[layer.id];
        if (!fc) break;
        const ROAD_W: Record<string, number> = { motorway: 1.8, trunk: 1.6, primary: 1.25, secondary: 1, tertiary: 0.7 };
        for (const f of inView(fc, view)) {
          const t = f.geometry!.type;
          // Ponds smaller than ~0.3 mm² on paper print as specks; leave them out.
          if (!t.includes('Line') && fp.area(f as any) < 0.3) continue;
          const d = fp.path(f as any);
          if (!d) continue;
          const cls = String(f.properties?.cls ?? '');
          const w = layer.osmTheme === 'roads' ? ROAD_W[cls] ?? 1 : cls === 'stream' ? 0.6 : 1;
          draw.paths.push({ d, name: String(f.properties?.name ?? ''), kind: t.includes('Line') ? 'line' : 'area', w });
        }
        break;
      }
      case 'points':
      case 'vector': {
        const fc = data.geoms[layer.id];
        if (!fc) break;
        // points styled by a column: what the table holds, found once; each point then asks for its own look
        const info = layer.pointsBy ? scanMarks(layer, fc) : undefined;
        if (info) draw.marks = info;
        for (let fi = 0; fi < fc.features.length; fi++) {
          const f = fc.features[fi];
          if (!f.geometry) continue;
          const t = f.geometry.type;
          const label = layer.style.labelField ? String(f.properties?.[layer.style.labelField] ?? '') : '';
          // a shape drawn by hand without a name is told apart by its place in the layer, so it can be picked and named on its own
          const key = !label && layer.custom ? `#${fi}` : undefined;
          if (t === 'Point' || t === 'MultiPoint') {
            const coords = t === 'Point' ? [f.geometry.coordinates] : (f.geometry as any).coordinates;
            const mk = info ? pointLook(layer, info, (f.properties ?? {}) as Record<string, unknown>, fi) : null;
            const r = mk ? mk.dMm / 2 : ptToMm(layer.style.sizePt) / 2;
            for (const c of coords) {
              const q = fp.forward([c[0], c[1]]);
              if (q && q[0] >= -5 && q[1] >= -5 && q[0] <= map.w + 5 && q[1] <= map.h + 5) {
                draw.paths.push({ d: '', name: label, key, kind: 'point', x: q[0], y: q[1], ...(info ? { idx: fi, props: (f.properties ?? {}) as Record<string, unknown>, r } : {}) });
                const own = label ? layer.labelText?.[label] : undefined;
                // a town name gives way to the names of areas; a city before a town before a village
                const rank = layer.osmTheme === 'places' ? ({ city: 4, town: 3, suburb: 2, village: 1 } as Record<string, number>)[String(f.properties?.cls)] ?? 1 : 0;
                const weight = rank ? rank * 1e-3 + Math.min(1e-4, Number(f.properties?.population ?? 0) * 1e-12) : 1e9;
                if (label && own !== '') draw.labels.push({ x: q[0] + r + 0.6, y: q[1], text: own ?? label, anchor: 'start', weight, orig: label, pr: r });
              }
            }
          } else {
            const d = fp.path(f as any);
            // index contours (every fifth) are drawn heavier, as on a topographic map
            if (d) draw.paths.push({ d, name: label, key, kind: t.includes('Line') ? 'line' : 'area', w: layer.contour && f.properties?.major ? 2.2 : undefined });
          }
        }
        break;
      }
    }
    if (layer.style.labelField && layer.kind !== 'points') {
      const feats = layer.kind === 'study' ? study.filter((x) => !x.properties?.__extentOnly) : layer.kind === 'admin' ? inView(adminFor(layer, data), view) : layer.kind === 'subunits' ? inView(data.sub, view) : layer.kind === 'countries' ? inView(data.countries, view) : layer.kind === 'vector' ? data.geoms[layer.id]?.features ?? [] : [];
      const seen = new Set<string>();
      // Boundary labels name the neighbours around the study area (as on a QGIS/ArcGIS location map), not the area itself.
      const neighbours = layer.kind === 'admin';
      for (const f of feats) {
        if (!f.geometry || f.geometry.type.includes('Point')) continue;
        const orig = String(f.properties?.[layer.style.labelField] ?? f.properties?.__name ?? f.properties?.name ?? '');
        if (!orig || seen.has(orig)) continue;
        const own = layer.labelText?.[orig];
        if (own === '') { seen.add(orig); continue; } // hidden by the user
        const text = own ?? orig;
        if (neighbours && insideStudy(f as Feature, study)) continue; // a unit of the study area itself
        if (neighbours && fp.areaVisible(f as any) < 40) continue; // too little of it on the map to name
        const c = neighbours ? fp.centroidVisible(f as any) : fp.centroid(f as any);
        if (neighbours && c && study.length) {
          // the label point must be outside the study area (a crescent-shaped area can wrap around a neighbour's centre)
          const ll = fp.inverse(c);
          if (ll && study.some((s) => { try { return geoContains(s as any, ll); } catch { return false; } })) continue;
        }
        if (!c || c[0] < 2 || c[1] < 2 || c[0] > map.w - 2 || c[1] > map.h - 2) continue;
        seen.add(orig);
        const bb = featureBBox(f);
        const weight = (bb[1][0] - bb[0][0]) * (bb[1][1] - bb[0][1]) * (layer.kind === 'study' ? 1e6 : 1);
        draw.labels.push({ x: c[0], y: c[1], text, anchor: 'middle', weight, orig });
      }
    }
    layers.push(draw);
  }

  const graticule = !map.grid.show || !study.length ? null
    : map.grid.units === 'metres' ? buildProjectedGrid(fp, map.grid.stepM ?? 'auto') ?? buildGraticule(fp, map.grid.step, map.grid.format)
    : buildGraticule(fp, map.grid.step, map.grid.format);
  const northAngle = trueNorthAngle(fp, [map.w / 2, map.h / 2]);
  const byId: Record<string, LayerDraw> = {};
  for (const ld of layers) byId[ld.layerId] = ld;
  return { fp, crs, crsSuggestions: suggestions, lonLatView: llb, layers, byId, graticule, northAngle, studyCentroid: centroid };
}

export function studyAsLayerSource(doc: Doc): Layer | undefined {
  return doc.study.fromLayer ? doc.layers.find((l) => l.id === doc.study.fromLayer) : undefined;
}

/* ---------- detail maps ---------- */

/** Scale denominator at the map centre: 50000 means 1:50,000 (1 cm on paper = 500 m on the ground). */
export function mapScale(fp: FrameProjection): number | null {
  const cx = fp.widthMm / 2, cy = fp.heightMm / 2;
  const a = fp.inverse([cx - 5, cy]), b = fp.inverse([cx + 5, cy]);
  if (!a || !b) return null;
  const metresPerMm = geodesic(a, b) / 10;
  return metresPerMm > 0 ? metresPerMm * 1000 : null;
}

const converters = new Map<string, proj4.Converter>();
const converter = (def: string) => {
  let c = converters.get(def);
  if (!c) { c = proj4('EPSG:4326', def); converters.set(def, c); }
  return c;
};
/** Longitude and latitude into the CRS (null when the projection cannot place it). */
function crsPoint(crs: CrsOption, ll: [number, number]): [number, number] | null {
  const q = converter(crs.proj4).forward(ll);
  return isFinite(q[0]) && isFinite(q[1]) ? [q[0], q[1]] : null;
}

/**
 * The frame projection of a detail map: the main map's projection and turn, the given ground at the middle of a w × h mm frame,
 * and the printed scale 1 : scale at that middle. The scale is not stored as a zoom, so mm per CRS unit is found from it by trying
 * a first size, then correcting by what it came to (it is a unit or two off at most for any map a page can hold).
 */
export function detailProjection(main: MainScene, w: number, h: number, centre: [number, number], scale: number): FrameProjection | null {
  const c = crsPoint(main.crs, centre);
  if (!c || !(scale > 0)) return null;
  let k = 1, fp = makeFrameProjection(main.crs, w, h, c, k, main.fp.rot);
  for (let i = 0; i < 3; i++) {
    const d = mapScale(fp);
    if (!d) return null;
    if (Math.abs(d / scale - 1) < 1e-5) break;
    k *= d / scale;
    fp = makeFrameProjection(main.crs, w, h, c, k, main.fp.rot);
  }
  return fp;
}

/** The scale (1 : n) a frame of w × h mm shows with its middle at CRS point c and k mm per CRS unit. */
function scaleAt(main: MainScene, w: number, h: number, c: [number, number], k: number): number | null {
  return mapScale(makeFrameProjection(main.crs, w, h, c, k, main.fp.rot));
}

/** Longitude and latitude of a point in CRS units. */
function lonLatOf(crs: CrsOption, c: [number, number]): [number, number] | null {
  const q = converter(crs.proj4).inverse(c);
  return isFinite(q[0]) && isFinite(q[1]) ? [q[0], q[1]] : null;
}

/** A scale as people say it: three significant figures (1:52,300). */
export const niceScale = (d: number) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(d)) - 2); return Math.round(d / p) * p; };

export interface DetailView { centre: [number, number]; scale: number }

/** A detail map's view from the CRS box it must hold (padding 0 to 1): used to fit it to the study area or to a feature. */
export function detailFitting(main: MainScene, w: number, h: number, b: [[number, number], [number, number]], padding: number): DetailView | null {
  const fit = fitBounds(b, w, h, padding);
  const centre = lonLatOf(main.crs, fit.center), scale = scaleAt(main, w, h, fit.center, fit.k);
  return centre && scale ? { centre: [round6(centre[0]), round6(centre[1])], scale: niceScale(scale) } : null;
}
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** A detail map's view that holds some features (their lon/lat), or the study area when none are given. */
export function detailFor(main: MainScene, w: number, h: number, feats: Feature[], padding = 0.12): DetailView | null {
  const b = projectedBounds(main.crs, samplePoints(feats));
  return b ? detailFitting(main, w, h, b, padding) : null;
}

/** A detail map's first view: 3 times as close as the main map, at the middle of the study area. */
export function detailStart(main: MainScene): DetailView | null {
  const d = mapScale(main.fp);
  return d ? { centre: [round6(main.studyCentroid[0]), round6(main.studyCentroid[1])], scale: niceScale(d / 3) } : null;
}

/** The view of a detail map after the main map's box (main mm, as dragged on the page) is chosen as what it must show. */
export function detailForBox(main: MainScene, w: number, h: number, box: { x0: number; y0: number; x1: number; y1: number }): DetailView | null {
  const bw = Math.abs(box.x1 - box.x0), bh = Math.abs(box.y1 - box.y0);
  if (bw < 0.5 || bh < 0.5) return null;
  const c = main.fp.toCrs([(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2]);
  const centre = lonLatOf(main.crs, c);
  const scale = scaleAt(main, w, h, c, main.fp.k * Math.min(w / bw, h / bh));
  return centre && scale ? { centre: [round6(centre[0]), round6(centre[1])], scale: niceScale(scale) } : null;
}

/** The ground of a detail map as a box on the main map: its four corners in the main map's own mm (same projection and turn, so a plain rectangle). */
export function detailBox(main: MainScene, det: MainScene): [number, number][] {
  const w = det.fp.widthMm, h = det.fp.heightMm;
  return ([[0, 0], [w, 0], [w, h], [0, h]] as [number, number][]).map((p) => main.fp.fromCrs(det.fp.toCrs(p)));
}

/**
 * Projected geometry for a detail map: the same layers as the main map in the same projection, at its own ground and scale.
 * Cached per detail map, like the main one.
 */
export function buildDetail(doc: Doc, d: DetailItem, main: MainScene, data: Data): MainScene | null {
  if (!data.study.length) return null;
  const key = JSON.stringify([
    main.crs.proj4, main.fp.rot, d.centre, d.scale, d.w, d.h, d.grid.show, d.grid.step, d.grid.format, d.grid.units, d.grid.stepM, doc.study.iso, doc.study.highlight, doc.study.countryName,
    layersKey(doc, data),
  ]);
  return remembered(d.id, key, data, () => {
    const fp = detailProjection(main, d.w, d.h, d.centre, d.scale);
    return fp ? drawFrame(doc, data, d, fp, main.crs, main.crsSuggestions, main.studyCentroid, main.lonLatView) : null;
  });
}

/* ---------- insets ---------- */

export interface InsetScene {
  sphere: string;
  graticule: string;
  land: string;
  /** the outline came from the official units: the world map's own border lines are left out (they run apart from it) */
  official?: boolean;
  focus: string; // highlighted country
  admin: string; // internal boundaries of the country
  study: string; // the study area itself
  box: { x0: number; y0: number; x1: number; y1: number } | null; // bounds of the extent outline, for connector lines
  extent: string; // main map outline
  marker: { x: number; y: number } | null; // when extent is too small to see
  label: string;
  /** coordinate grid of a country/region locator, in locator mm */
  grid?: Graticule | null;
}

function pathBox(d: string): { x0: number; y0: number; x1: number; y1: number } | null {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 4) return null;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  return { x0, y0, x1, y1 };
}

interface InsetBase { scene: Omit<InsetScene, 'box' | 'extent' | 'marker'>; proj: GeoProjection; path: GeoPath }
const baseCache = new Map<string, { countries: unknown; low: unknown; admin: unknown; levels: unknown; study: unknown; base: InsetBase }>();

/**
 * Insets in two parts. The base (land, country, boundaries) only changes with the inset's size or kind or the area,
 * so panning or zooming the main map just redraws the small extent box: no more reprojecting every district.
 */
/** The cached frame of a locator: its projection and everything drawn in it except the extent box. */
function baseOf(inset: InsetItem, main: MainScene, data0: Data, iso: string): InsetBase {
  // boundaries inside the locator: none, a chosen level, or the same as the main map
  const data: Data = inset.adminLevel === undefined ? data0 : { ...data0, admin: inset.adminLevel ? data0.adminLevels?.[inset.adminLevel] ?? null : null };
  const c = main.studyCentroid;
  // Region locators, and a country locator of a whole-country map, follow the main map's view; the others do not
  // (so panning never makes them reproject every district).
  const follows = inset.context === 'region' || (inset.context === 'country' && coversCountry(data, iso));
  const where = inset.context === 'globe' ? c.map((v) => v.toFixed(2)).join(',') : follows ? main.lonLatView.flat().map((v) => v.toFixed(2)).join(',') : '';
  const key = [inset.id, inset.w, inset.h, inset.context, inset.label, iso, where, inset.adminLevel ?? 'auto', inset.context === 'parent' ? parentLevel(inset.frameLevel, data.studyLevel) : '', inset.zoom ?? 1, inset.panX ?? 0, inset.panY ?? 0, inset.grid?.show ? JSON.stringify([inset.grid.step, inset.grid.format]) : ''].join('|');
  let hit = baseCache.get(key);
  if (!hit || hit.countries !== data.countries || hit.low !== data.countriesLow || hit.admin !== data.admin || hit.levels !== data.adminLevels || hit.study !== data.study) {
    if (baseCache.size > 40) baseCache.clear();
    hit = { countries: data.countries, low: data.countriesLow, admin: data.admin, levels: data.adminLevels, study: data.study, base: insetBase(inset, main, data, iso) };
    baseCache.set(key, hit);
  }
  return hit.base;
}

/** The ground a locator shows, as a lon/lat ring round its frame (clockwise, like frameOutline). */
function insetOutline(b: InsetBase, w: number, h: number): [number, number][] {
  const ring: [number, number][] = [];
  const n = 16;
  const edge = (a: [number, number], z: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const q = b.proj.invert?.([a[0] + ((z[0] - a[0]) * i) / n, a[1] + ((z[1] - a[1]) * i) / n]);
      if (q && Number.isFinite(q[0]) && Number.isFinite(q[1])) ring.push(q as [number, number]);
    }
  };
  edge([0, 0], [w, 0]); edge([w, 0], [w, h]); edge([w, h], [0, h]); edge([0, h], [0, 0]);
  if (ring.length) ring.push(ring[0]);
  return ring;
}

/** marks: another locator whose ground this one outlines (with zoom lines to it) instead of the main map's. */
/** A country locator of a small area (an upazila) draws district lines, not the thousands of upazilas of the country. */
function insetData(inset: InsetItem, raw: Data): Data {
  const fine = inset.context === 'country' && inset.adminLevel === undefined && (raw.studyLevel ?? 0) > 2 && raw.adminLevels?.[2];
  return fine ? { ...raw, admin: raw.adminLevels![2] } : raw;
}

export function buildInset(inset: InsetItem, main: MainScene, data0Raw: Data, iso: string, marks?: InsetItem): InsetScene | null {
  const data0 = insetData(inset, data0Raw);
  const c = main.studyCentroid;
  const { scene, proj, path } = baseOf(inset, main, data0, iso);
  const ring = marks ? insetOutline(baseOf(marks, main, insetData(marks, data0Raw), iso), marks.w, marks.h) : [];
  const outline = ring.length > 4 ? ring : frameOutline(main.fp);
  // frameOutline runs top-left, top-right, bottom-right, bottom-left: clockwise, which d3 reads as the inside
  const extentFeature: Feature<Polygon> = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outline] } };
  const extent = path(extentFeature as any) ?? '';
  const marker = smallMarker(extent, proj(c) as [number, number] | null);
  const box = inset.context === 'globe' || marker ? null : pathBox(extent);
  return { ...scene, box, extent: marker ? '' : extent, marker };
}

/** Is the study area (nearly) the whole country? Remembered per study data, as it is asked on every redraw. */
const wholeCache = new WeakMap<object, Map<string, boolean>>();
function coversCountry(data: Data, iso: string): boolean {
  if (!data.study.length) return false;
  let m = wholeCache.get(data.study);
  if (!m) { m = new Map(); wholeCache.set(data.study, m); }
  if (m.has(iso)) return m.get(iso)!;
  const countryF = data.countries?.features.find((f) => f.properties?.iso === iso) ?? data.countriesLow?.features.find((f) => f.properties?.iso === iso);
  let whole = false;
  if (countryF) {
    const sb = geoBounds({ type: 'FeatureCollection', features: data.study } as any), cb = geoBounds(countryF as any);
    const area = (b: number[][]) => Math.abs((b[1][0] - b[0][0]) * (b[1][1] - b[0][1]));
    whole = area(sb) > 0.5 * area(cb);
  }
  m.set(iso, whole);
  return whole;
}

/** The locator's own zoom (about its centre) and pan, on top of the automatic fit. */
function insetView<P extends GeoProjection>(proj: P, inset: InsetItem, W: number, H: number): P {
  const z = inset.zoom ?? 1, px = inset.panX ?? 0, py = inset.panY ?? 0;
  if (z === 1 && !px && !py) return proj;
  const [tx, ty] = proj.translate();
  proj.scale(proj.scale() * z);
  proj.translate([W / 2 + (tx - W / 2) * z + px, H / 2 + (ty - H / 2) * z + py]);
  return proj;
}

function insetBase(inset: InsetItem, main: MainScene, data: Data, iso: string): InsetBase {
  const W = inset.w, H = inset.h;
  const c = main.studyCentroid;
  const countryF = data.countries?.features.find((f) => f.properties?.iso === iso) ?? data.countriesLow?.features.find((f) => f.properties?.iso === iso);
  const label = inset.label || '';

  if (inset.context === 'globe') {
    const proj = insetView(geoOrthographic().rotate([-c[0], -c[1]]).fitExtent([[0.4, 0.4], [W - 0.4, H - 0.4]], { type: 'Sphere' }).clipAngle(90), inset, W, H);
    const p = geoPath(proj).digits(3);
    const land = data.countriesLow ? p(data.countriesLow as any) ?? '' : '';
    const focus = countryF ? p(countryF as any) ?? '' : '';
    return { proj, path: p, scene: { sphere: p({ type: 'Sphere' }) ?? '', graticule: p(geoGraticule10()) ?? '', land, focus, admin: '', study: '', label } };
  }

  let target: any = countryF;
  let parentF: Feature | null = null;
  // When the study area is (nearly) the whole country, a country locator shows the region around it.
  const whole = inset.context === 'country' && !!countryF && coversCountry(data, iso);
  if (inset.context === 'parent') {
    // the district (or division) that holds the study area: the finest official unit round it that is clearly
    // larger than the area itself, so a district picked from the place search (its level unknown) still gets its
    // division here, never the district again
    const own = data.study.filter((f) => !f.properties?.__extentOnly && f.geometry && /Polygon/.test(f.geometry.type)).reduce((s, f) => { let a = geoArea(f as any); if (a > 2 * Math.PI) a = 4 * Math.PI - a; return s + a; }, 0);
    for (let lv = parentLevel(inset.frameLevel, data.studyLevel); lv >= 1 && !parentF; lv--) {
      const fc = data.adminLevels?.[lv];
      const f = fc?.features.find((u) => { try { const b = featureBBox(u); return c[0] >= b[0][0] && c[0] <= b[1][0] && c[1] >= b[0][1] && c[1] <= b[1][1] && geoContains(u as any, c); } catch { return false; } });
      if (!f) continue;
      let a = geoArea(f as any); if (a > 2 * Math.PI) a = 4 * Math.PI - a;
      if (!own || a > own * 1.6) parentF = f;
    }
    if (parentF) target = parentF;
  }
  if (inset.context === 'region' || whole || (inset.context === 'parent' && !parentF) || !countryF) {
    const [[x0, y0], [x1, y1]] = main.lonLatView;
    const dx = Math.min(80, Math.max(x1 - x0, 0.5) * 3), dy = Math.min(60, Math.max(y1 - y0, 0.5) * 3);
    const s0 = Math.max(-85, c[1] - dy), n0 = Math.min(85, c[1] + dy);
    // densified edges, so the box follows the parallels instead of cutting across as a great circle
    const ring: [number, number][] = [];
    for (let i = 0; i <= 8; i++) ring.push([c[0] - dx + (2 * dx * i) / 8, s0]);
    for (let i = 1; i <= 8; i++) ring.push([c[0] + dx, s0 + ((n0 - s0) * i) / 8]);
    for (let i = 1; i <= 8; i++) ring.push([c[0] + dx - (2 * dx * i) / 8, n0]);
    for (let i = 1; i <= 8; i++) ring.push([c[0] - dx, n0 - ((n0 - s0) * i) / 8]);
    target = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
    rewind(target);
  }
  const tc = geoCentroid(target) as [number, number];
  const proj = insetView(geoAzimuthalEqualArea().rotate([-tc[0], -tc[1]]).fitExtent([[1.5, 1.5], [W - 1.5, H - 1.5]], target), inset, W, H);
  // A locator is a few centimetres wide: cut every outline at its frame (plus a little) and drop vertices closer than
  // 0.06 mm, which no print can show. Detailed district lines otherwise ran to over a megabyte and made every redraw slow.
  proj.clipExtent([[-2, -2], [W + 2, H + 2]]);
  const p = geoPath({ stream: (s: any) => proj.stream(thin(s, 0.06)) } as any).digits(2);
  const tb = geoBounds(target);
  const grow = 20 / Math.min(1, inset.zoom ?? 1);
  const view: [[number, number], [number, number]] = [[tb[0][0] - grow, tb[0][1] - grow], [tb[1][0] + grow, tb[1][1] + grow]];
  const land = inView(data.countries, view).map((f) => p(f as any) ?? '').join('');
  // The outline of the division (or of the country) is merged from the official units at the study area's own level,
  // so it runs exactly along the study area's edge (the coarser files of the same source draw it a little apart).
  const units = data.adminLevels?.[data.studyLevel ?? 0] ?? null;
  let focusF: Feature | null = parentF ?? countryF ?? null;
  if (units && focusF) {
    const fb = featureBBox(focusF);
    const inside = units.features.filter((u) => {
      if (!u.geometry) return false;
      const uc = geoCentroid(u as any) as [number, number];
      return uc[0] >= fb[0][0] && uc[0] <= fb[1][0] && uc[1] >= fb[0][1] && uc[1] <= fb[1][1] && geoContains(focusF as any, uc);
    });
    if (inside.length) focusF = rewind(dissolve(inside as Feature[], '')) as Feature;
  }
  const focus = focusF ? p(focusF as any) ?? '' : '';
  const official = !!units && focusF !== (parentF ?? countryF ?? null);
  const admin = data.admin ? inView(data.admin, view).map((f) => p(f as any) ?? '').join('') : '';
  const studyPolys = data.study.filter((f) => !f.properties?.__extentOnly && f.geometry.type !== 'Point');
  const study = studyPolys.length ? p({ type: 'FeatureCollection', features: studyPolys } as any) ?? '' : '';
  // A grid on a locator uses the same builder as the main map, through a frame-projection adapter.
  let grid: Graticule | null = null;
  if (inset.grid?.show) {
    const adapter = { widthMm: W, heightMm: H, forward: (ll: [number, number]) => { const q = proj(ll); return q && isFinite(q[0]) ? (q as [number, number]) : null; }, inverse: (xy: [number, number]) => { const q = proj.invert?.(xy); return q && isFinite(q[0]) ? (q as [number, number]) : null; } } as unknown as FrameProjection;
    grid = buildGraticule(adapter, inset.grid.step, inset.grid.format);
  }
  return { proj, path: p, scene: { sphere: `M0,0H${W}V${H}H0Z`, graticule: '', land, focus, admin, study, label, grid, official } };
}

/** When the extent box would be smaller than ~1.2 mm, show a locator ring instead. */
function smallMarker(extentPath: string, at: [number, number] | null): { x: number; y: number } | null {
  if (!at) return null;
  const nums = extentPath.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 4) return { x: at[0], y: at[1] };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    x0 = Math.min(x0, nums[i]); x1 = Math.max(x1, nums[i]);
    y0 = Math.min(y0, nums[i + 1]); y1 = Math.max(y1, nums[i + 1]);
  }
  return Math.max(x1 - x0, y1 - y0) < 1.2 ? { x: at[0], y: at[1] } : null;
}

/* ---------- scale bar ---------- */

export function buildScale(item: ScaleItem, main: MainScene) {
  // a unit written out ("kilometres") takes more room than "km" at the end of the bar
  const unit = item.unitText?.trim();
  const extra = unit ? Math.max(0, textWidthMm(unit, item.labelPt, false) - textWidthMm(item.units === 'imperial' ? 'mi' : 'km', item.labelPt, false)) : 0;
  const avail = Math.max(10, item.w - 4 - extra);
  return scaleBar(main.fp, avail * 0.92, item.units, item.segments);
}

/* ---------- credits ---------- */

export function creditsText(doc: Doc, main: MainScene | null, adminMeta: { canonical: string; license: string; source: string } | null, terrainOn = false): string[] {
  const lines: string[] = [];
  const credits = doc.items.find((i) => i.kind === 'credits');
  if (main && credits && 'showProjection' in credits && credits.showProjection) {
    const code = main.crs.code.startsWith('EPSG') ? ` (${main.crs.code})` : '';
    lines.push(`Projection: ${main.crs.name}${code}`);
  }
  const src = new Set<string>();
  const vis = (k: Layer['kind']) => doc.layers.some((l) => l.kind === k && l.visible);
  if (vis('countries') || vis('rivers') || vis('lakes') || vis('disputed')) src.add('Natural Earth');
  if ((doc.study.source === 'place') && doc.study.highlight) src.add('© OpenStreetMap contributors (openstreetmap.org/copyright)');
  if (adminMeta && (vis('admin') || (doc.study.source === 'admin' && doc.study.level > 0))) {
    src.add(`geoBoundaries${adminMeta.license ? ` (${shortLicense(adminMeta.license)})` : ''}`);
  }
  if (terrainOn || doc.layers.some((l) => l.contour && l.visible) || doc.items.some((i) => i.kind === 'profile' && i.visible)) src.add(TERRAIN_CREDIT);
  for (const l of doc.layers) if (l.kind === 'basemap' && l.visible) src.add(basemapCredit(l.basemap?.id ?? 's2cloudless', l.basemap?.date, true));
  if (doc.layers.some((l) => l.visible && l.kind === 'osm')) src.add('© OpenStreetMap contributors (openstreetmap.org/copyright)');
  for (const l of doc.layers) {
    if (!l.visible || (l.kind !== 'points' && l.kind !== 'vector') || !l.source) continue;
    const used = (main?.byId[l.id]?.paths.length ?? 0) > 0 || (doc.study.source === 'layer' && doc.study.fromLayer === l.id);
    if (used) src.add(l.source);
  }
  if (src.size) lines.push(`Data: ${[...src].join('; ')}`);
  if (credits && 'extra' in credits && credits.extra.trim()) lines.push(credits.extra.trim());
  if (credits && 'showDisclaimer' in credits && credits.showDisclaimer) lines.push('Boundaries are not necessarily authoritative.');
  return lines;
}

function shortLicense(l: string): string {
  const m = l.match(/\((CC[^)]+|ODbL[^)]*)\)/);
  if (m) return m[1];
  if (/public domain/i.test(l)) return 'public domain';
  if (/open database/i.test(l)) return 'ODbL';
  return l.length > 40 ? l.slice(0, 40) + '…' : l;
}

export type { MultiPolygon };

/* ---------- label placement ---------- */

type Box = [number, number, number, number]; // x0,y0,x1,y1
const overlaps = (a: Box, b: Box) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/**
 * Greedy collision removal: point labels first, then the study area, then larger areas.
 * Labels that would overlap another label, a point symbol, or a layout item on top of the map are dropped.
 * Each map frame places its own names: the main map, and every detail map (own = false).
 */
export function placeLabels(main: MainScene | null, doc: Doc, map: { id: string; x: number; y: number; w: number; h: number }, own = true): Record<string, LayerDraw['labels']> {
  const out: Record<string, LayerDraw['labels']> = {};
  if (!main) return out;
  const layers = main.layers.map((ld) => ({ ...ld, layer: doc.layers.find((l) => l.id === ld.layerId) ?? ld.layer }));
  const taken: Box[] = [];
  for (const it of doc.items) {
    if (!it.visible || it.kind === 'map' || it.id === map.id) continue;
    const b: Box = [it.x - map.x, it.y - map.y, it.x - map.x + it.w, it.y - map.y + it.h];
    if (b[2] > 0 && b[3] > 0 && b[0] < map.w && b[1] < map.h) taken.push(b);
  }
  for (const ld of layers) {
    if (ld.layer.kind !== 'points') continue;
    const r0 = ptToMm(ld.layer.style.sizePt) / 2;
    for (const p of ld.paths) if (p.kind === 'point') { const r = p.r ?? r0; taken.push([p.x! - r, p.y! - r, p.x! + r, p.y! + r]); }
  }
  // The study area's outline: names of the areas around it stay outside it, names inside stay inside, so no name
  // sits across the line a reader follows (moved a little if they would, as a cartographer nudges them by hand).
  const studyLd = layers.find((ld) => ld.layer.kind === 'study');
  const studyD = studyLd?.paths.filter((p) => p.kind === 'area' && p.d).map((p) => p.d) ?? [];
  const ctx = labelCtx();
  const areas = ctx ? studyPaths(studyD) : [];
  const inStudy = (b: Box) => {
    if (!ctx || !areas.length) return -1;
    let hit = 0, n = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      n++;
      if (areas.some((p) => ctx.isPointInPath(p, b[0] + ((b[2] - b[0]) * (i + 0.5)) / 5, b[1] + ((b[3] - b[1]) * (j + 0.5)) / 3))) hit++;
    }
    return hit / n;
  };
  // a study area too small to hold names (a district on a country map): its sub-area names are left out
  const sb = studyD.length ? pathBox(studyD.join(' ')) : null;
  const tiny = !!sb && Math.max(sb.x1 - sb.x0, sb.y1 - sb.y0) < Math.min(map.w, map.h) * 0.22;
  const all = layers.flatMap((ld) => ld.labels.map((lb) => ({ lb, ld })));
  all.sort((a, b) => b.lb.weight - a.lb.weight);
  const keep = new Map<object, LayerDraw['labels'][number]>();
  for (const { lb, ld } of all) {
    if (tiny && ld.layer.kind === 'subunits') continue;
    const pt = ld.layer.style.labelPt;
    const h = ptToMm(pt);
    // bold names take more room, and so do spaced capitals (the letter spacing of the layer's names)
    const w = textWidthMm(lb.text, pt, ld.layer.style.labelStyle?.bold ?? false) + (Array.from(lb.text).length - 1) * ptToMm(pt) * (ld.layer.style.labelSpacing ?? 0);
    const pad = h * 0.25;
    const boxAt = (x: number, y: number): Box => {
      const x0 = lb.anchor === 'start' ? x : x - w / 2;
      // a point label starts right beside its own symbol, so it gets no left padding
      return [lb.anchor === 'start' ? x0 : x0 - pad, y - h * 0.6 - pad, x0 + w + pad, y + h * 0.5 + pad];
    };
    const fits = (b: Box) => !(b[0] < 0.5 || b[2] > map.w - 0.5 || b[1] < 0.5 || b[3] > map.h - 0.5) && !taken.some((t) => overlaps(t, b));
    // which side of the outline the name belongs on: around it (neighbours, countries) or within it (its own parts)
    const side = ld.layer.kind === 'admin' || ld.layer.kind === 'countries' ? 'out' : ld.layer.kind === 'subunits' || ld.layer.kind === 'study' ? 'in' : null;
    const clean = (b: Box) => { if (!side) return true; const f = inStudy(b); return f < 0 || (side === 'out' ? f === 0 : f === 1); };
    let at: [number, number] | null = null;
    // a name the user dragged stays exactly where it was put (on the main map: a detail map places its names by itself, as the offset is in the main map's mm)
    const moved = own ? ld.layer.featureStyle?.[lb.orig ?? lb.text] : undefined;
    if (moved && (moved.labelDx || moved.labelDy)) {
      const x = lb.x + (moved.labelDx ?? 0), y = lb.y + (moved.labelDy ?? 0);
      taken.push(boxAt(x, y));
      // a point's name starts beside its symbol, so its line starts at the point itself
      const fx = lb.anchor === 'start' ? lb.x - (lb.pr ?? ptToMm(ld.layer.style.sizePt) / 2) - 0.6 : lb.x;
      keep.set(lb, { ...lb, x, y, from: [fx, lb.y] });
      continue;
    }
    if (fits(boxAt(lb.x, lb.y))) at = [lb.x, lb.y];
    if (at && !clean(boxAt(at[0], at[1])) && lb.anchor === 'middle') {
      // nudge it: up, down, sideways by up to two line heights or half its width
      const tries: [number, number][] = [[0, -h], [0, h], [-w / 2, 0], [w / 2, 0], [0, -2 * h], [0, 2 * h], [-w / 2, -h], [w / 2, -h], [-w / 2, h], [w / 2, h]];
      for (const [dx, dy] of tries) {
        const b = boxAt(lb.x + dx, lb.y + dy);
        if (fits(b) && clean(b)) { at = [lb.x + dx, lb.y + dy]; break; }
      }
    }
    if (!at) continue;
    taken.push(boxAt(at[0], at[1]));
    keep.set(lb, at[0] === lb.x && at[1] === lb.y ? lb : { ...lb, x: at[0], y: at[1] });
  }
  for (const ld of layers) out[ld.layerId] = ld.labels.filter((lb) => keep.has(lb)).map((lb) => keep.get(lb)!);
  return out;
}

// the outline's Path2D objects, kept while the outline is the same (labels are placed again on every pan step, for every map frame)
const outlines = new Map<string, Path2D[]>();
function studyPaths(ds: string[]) {
  const key = ds.join('');
  let paths = outlines.get(key);
  if (!paths) { if (outlines.size > 6) outlines.clear(); paths = ds.map((d) => new Path2D(d)); outlines.set(key, paths); }
  return paths;
}
let lctx: CanvasRenderingContext2D | null = null;
function labelCtx() {
  if (!lctx && typeof document !== 'undefined') lctx = document.createElement('canvas').getContext('2d');
  return lctx;
}
