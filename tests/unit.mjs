// Quick checks of the map maths and file handling, run in Node without a browser (about 5 seconds):
//
//   node tests/unit.mjs
//
// The app's own TypeScript modules are loaded through Vite, exactly as the app uses them.
import { createServer } from 'vite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import proj4 from 'proj4';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({ root: ROOT, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
const load = (p) => server.ssrLoadModule(p);
const { utmFor, makeFrameProjection, frameLonLatBounds } = await load('/src/lib/projection.ts');
const { buildGraticule, trueNorthAngle, geodesic } = await load('/src/lib/carto.ts');
const { parsePointsText } = await load('/src/lib/importers.ts');
const { maxDpi, rasterSize } = await load('/src/lib/export.ts');
const { store, defaultDoc } = await load('/src/lib/store.svelte.ts');
const { joinAcross180 } = await load('/src/lib/dissolve.ts');
const { kindName } = await load('/src/lib/adminsearch.ts');

let failed = 0;
const ok = (name, cond, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/** A frame of w × h mm centred on a lon/lat point, at `scale` (50000 = 1:50,000). */
function frameAt(crs, lonlat, scale, w = 160, h = 110) {
  const c = proj4('EPSG:4326', crs.proj4).forward(lonlat);
  return makeFrameProjection(crs, w, h, c, 1000 / scale, 0);
}

// UTM zones, with the Norway and Svalbard exceptions and the poles
ok('UTM Dhaka is zone 46N', utmFor(90.4, 23.8).code === 'EPSG:32646');
ok('UTM Sydney is zone 56S', utmFor(151.2, -33.9).code === 'EPSG:32756');
ok('UTM Bergen is zone 32V (Norway exception)', utmFor(5.32, 60.39).code === 'EPSG:32632', utmFor(5.32, 60.39).code);
ok('UTM Ny-Ålesund is zone 33X (Svalbard exception)', utmFor(11.93, 78.92).code === 'EPSG:32633', utmFor(11.93, 78.92).code);
ok('UTM Longyearbyen is zone 33X', utmFor(15.6, 78.2).code === 'EPSG:32633');
ok('north of 84°N is UPS North', utmFor(10, 86).code === 'EPSG:32661');
ok('south of 80°S is UPS South', utmFor(10, -85).code === 'EPSG:32761');

// A map across the 180° meridian (Fiji)
const fijiCrs = utmFor(179.9, -17.5);
const fiji = frameAt(fijiCrs, [180, -17.5], 2_500_000);
const fb = frameLonLatBounds(fiji);
ok('Fiji frame keeps a real width', fb && fb[1][0] - fb[0][0] < 12, fb && JSON.stringify(fb.map((p) => p.map((v) => +v.toFixed(2)))));
ok('Fiji frame runs east past 180°', fb && fb[0][0] < 180 && fb[1][0] > 180);
const fg = buildGraticule(fiji, 'auto', 'dm');
const lonLabels = fg ? fg.labels.filter((l) => l.axis === 'lon').map((l) => l.text) : [];
ok('Fiji grid has meridian labels', lonLabels.length >= 2, [...new Set(lonLabels)].join(' '));
ok('Fiji grid labels are real longitudes (no 181°)', lonLabels.every((t) => !/^18[1-9]|^19\d|^2\d\d/.test(t)));
ok('Fiji grid step is not 90°', fg && fg.step < 10, fg && String(fg.step));

// A map with the North Pole inside it
const ups = utmFor(0, 88);
const pole = frameAt(ups, [0, 90], 20_000_000);
const pb = frameLonLatBounds(pole);
ok('polar frame reaches the pole', pb && pb[1][1] === 90, pb && JSON.stringify(pb));
const pg = buildGraticule(pole, 'auto', 'dm');
ok('polar grid has parallels', pg && pg.labels.some((l) => l.axis === 'lat'), pg && String(pg.labels.length));

// True north right by the pole points north, not south
const nearPole = frameAt(ups, [0, 89.95], 50_000);
const angle = trueNorthAngle(nearPole, [80, 55]);
ok('north arrow at 89.95°N points up', Math.abs(angle) < 5, angle.toFixed(1) + '°');

// An island cut at 180° (as OpenStreetMap and geoBoundaries store it) is joined back into one shape
const cut = { type: 'Feature', properties: { name: 'Island' }, geometry: { type: 'MultiPolygon', coordinates: [
  [[[179.5, -17], [180, -17], [180, -16.5], [179.5, -16.5], [179.5, -17]]],
  [[[-180, -17], [-179.6, -17], [-179.6, -16.5], [-180, -16.5], [-180, -17]]],
] } };
const joined = joinAcross180(cut);
const jRings = joined.geometry.type === 'Polygon' ? [joined.geometry.coordinates] : joined.geometry.coordinates;
ok('island cut at 180° becomes one shape', jRings.length === 1, joined.geometry.type);
ok('no edge runs along 180° after joining', !jRings[0][0].some((p, i, r) => i && Math.abs(p[0] - 180) < 1e-9 && Math.abs(r[i - 1][0] - 180) < 1e-9));
ok('the name is kept', joined.properties.name === 'Island');
const { geoArea } = await import('d3-geo');
ok('joined island is wound for d3 (small area, not the rest of the globe)', geoArea(joined) < 0.01, geoArea(joined).toExponential(2));
const square = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[90, 23], [91, 23], [91, 24], [90, 24], [90, 23]]] } };
ok('an area away from 180° is left alone', joinAcross180(square) === square);

// Level names: never a raw code such as "Adm1"
ok('unnamed first level reads "Region"', kindName('', 1) === 'Region', kindName('', 1));
ok('named level keeps its name', kindName('Districts', 2) === 'District');

// Ellipsoid distances
ok('1° along the equator = 111,319 m', near(geodesic([0, 0], [1, 0]), 111319.49, 0.5), geodesic([0, 0], [1, 0]).toFixed(2));
ok('Vincenty test line (Flinders Peak to Buninyong) = 54,972.271 m', near(geodesic([144.42486788889, -37.95103341667], [143.92649552778, -37.65282113889]), 54972.271, 0.01));
ok('nearly opposite points still give a distance', geodesic([0, 0], [179.9, 0.1]) > 19_900_000);

// Points with latitude and longitude swapped: the whole file is turned back, not only the rows over 90
const swappedCsv = 'name,lat,lon\nDhaka,90.41,23.81\nKolkata,88.36,22.57\nChittagong,91.83,22.36\n';
const sw = parsePointsText(swappedCsv);
ok('swapped file: every row turned back', sw.points.length === 3 && sw.points.every((p) => p.geometry.coordinates[0] > 85 && p.geometry.coordinates[1] < 30), sw.points.map((p) => p.geometry.coordinates.join(',')).join(' | '));
const mixed = parsePointsText('name,lat,lon\nA,23.8,90.4\nB,22.5,88.3\nC,91.8,22.3\n');
ok('right file with one swapped row: only that row turned', mixed.points.map((p) => p.geometry.coordinates[1].toFixed(1)).join(',') === '23.8,22.5,22.3');
const fine = parsePointsText('name,lat,lon\nA,23.8,90.4\nB,22.5,88.3\n');
ok('right file: nothing turned, no warning', fine.points[1].geometry.coordinates[0] === 88.3 && !fine.errors.length);

// Raster size limits agree with each other
const sizes = [[84, 99], [85, 60], [170, 230], [190, 133], [297, 420]];
ok('maxDpi always fits the pixel limit', sizes.every(([w, h]) => rasterSize(w, h, maxDpi(w, h)).ok), sizes.map(([w, h]) => `${w}x${h}:${maxDpi(w, h)}`).join(' '));

// A damaged project file leaves the open map as it was
store.doc = defaultDoc();
store.doc.title = 'Keep me';
const before = JSON.stringify(store.doc);
for (const bad of ['{"app":"StudyMap","doc":{"version":2}}', '{"app":"StudyMap","doc":{"version":2,"clean":true,"layers":[]}}', '{"app":"StudyMap","doc":{"version":2,"layers":[],"items":[null],"widthMm":90,"heightMm":60,"study":{}}}']) {
  let threw = false;
  try { store.load(bad); } catch { threw = true; }
  ok(`damaged file refused: ${bad.slice(25, 70)}`, threw && JSON.stringify(store.doc) === before);
}
const good = JSON.stringify({ app: 'StudyMap', doc: { ...defaultDoc(), title: 'Opened' }, geoms: {} });
store.load(good);
ok('a good project file still opens', store.doc.title === 'Opened');

// Redo straight after an edit does not lose the edit
store.load(good);
store.doc.title = 'A'; store.snapshot();
store.doc.title = 'B'; store.snapshot();
store.undo(); // title A, B can be redone
store.doc.title = 'C'; store.commit(); // an edit still waiting (350 ms)
store.redo();
ok('redo within 350 ms of an edit keeps the edit', store.doc.title === 'C', store.doc.title);

await server.close();
console.log(`\n${failed ? failed + ' failed' : 'all passed'}`);
process.exit(failed ? 1 : 0);
