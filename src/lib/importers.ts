// Read user files in the browser. Nothing is uploaded anywhere.
import Papa from 'papaparse';
import { feature } from 'topojson-client'; // already in the app for the bundled world data
import type { Feature, FeatureCollection, Point } from 'geojson';

export interface PointImport {
  points: Feature<Point>[];
  columns: string[];
  latCol: string;
  lonCol: string;
  skipped: number;
  errors: string[];
}

const LAT_NAMES = ['lat', 'latitude', 'y', 'lat_dd', 'latdd', 'northing_deg', 'gps_lat', 'decimallatitude'];
const LON_NAMES = ['lon', 'long', 'lng', 'longitude', 'x', 'lon_dd', 'londd', 'gps_lon', 'gps_long', 'decimallongitude'];

function findColumn(cols: string[], names: string[]): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z_]/g, '');
  return cols.find((c) => names.includes(norm(c))) ?? cols.find((c) => names.some((n) => n.length > 1 && norm(c).startsWith(n)));
}

/** Parse decimal degrees or DMS such as 24°53'45.2"N, 24 53 45 N, N24.8958, -91.87. */
export function parseCoordinate(raw: unknown): number | null {
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  if (raw == null) return null;
  let s = String(raw).trim().toUpperCase().replace(/\u2212/g, '-');
  if (!s) return null;
  const plain = Number(s.replace(',', '.'));
  if (s !== '' && isFinite(plain) && !/[NSW°º'′"″:\s]/.test(s)) return plain; // 24.5, -91.87, 1e2
  // south or west, or a minus sign, means negative (both together are still just negative)
  const sign = /[SW]/.test(s) || s.startsWith('-') ? -1 : 1;
  s = s.replace(/[NSEW]/g, ' ').replace(/,/g, '.').replace(/^-/, '').trim();
  const parts = s.split(/[°º'′"″:\s]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.some((n) => !isFinite(n))) return null;
  const [d, m = 0, sec = 0] = parts;
  if (m >= 60 || sec >= 60) return null;
  return sign * (d + m / 60 + sec / 3600);
}

export function parsePointsText(text: string): PointImport {
  const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false });
  const columns = res.meta.fields ?? [];
  const latCol = findColumn(columns, LAT_NAMES);
  const lonCol = findColumn(columns, LON_NAMES);
  const errors: string[] = [];
  if (!latCol || !lonCol) {
    errors.push('Could not find latitude and longitude columns. Name them "lat" and "lon" (or latitude/longitude).');
    return { points: [], columns, latCol: latCol ?? '', lonCol: lonCol ?? '', skipped: res.data.length, errors };
  }
  const points: Feature<Point>[] = [];
  let skipped = 0;
  let swapped = 0;
  const parsed = res.data.map((row) => [parseCoordinate(row[latCol]), parseCoordinate(row[lonCol])] as const);
  // Columns the wrong way round are a property of the whole file: only some rows prove it (a latitude over 90), the
  // rest look possible but are just as wrong (Kolkata swapped reads 88.4°N 22.6°E). So when more rows say "swapped"
  // than "right", every row is swapped back; otherwise only the rows that cannot be right are.
  let sayWrong = 0, sayRight = 0;
  for (const [la, lo] of parsed) {
    if (la == null || lo == null) continue;
    if (Math.abs(la) > 90 && Math.abs(lo) <= 90) sayWrong++;
    else if (Math.abs(lo) > 90 && Math.abs(la) <= 90) sayRight++;
  }
  const swapAll = sayWrong > sayRight;
  res.data.forEach((row, i) => {
    let [lat, lon] = parsed[i];
    let turned = false;
    if (lat != null && lon != null && (swapAll || (Math.abs(lat) > 90 && Math.abs(lon) <= 90))) { [lat, lon] = [lon, lat]; turned = true; }
    if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      skipped++;
      if (errors.length < 5) errors.push(`Row ${i + 2}: "${row[latCol]}", "${row[lonCol]}" is not a valid coordinate.`);
      return;
    }
    if (turned) swapped++;
    points.push({ type: 'Feature', properties: { ...row }, geometry: { type: 'Point', coordinates: [lon, lat] } });
  });
  if (swapped) errors.push(`${swapped} row${swapped === 1 ? '' : 's'} had latitude and longitude the wrong way round and ${swapped === 1 ? 'was' : 'were'} corrected. Check the points are in the right place.`);
  return { points, columns, latCol, lonCol, skipped, errors };
}

/** An error whose text is already plain enough to show to the user as it is. */
export class ImportError extends Error {}

/** The one message for a file we could not open, so no raw parser error (such as a JSON syntax error) reaches the screen. */
export function unreadableMessage(fileName: string): string {
  return `We couldn't read ${fileName}. Use a zipped shapefile (.zip), GeoJSON (.geojson), KML, GPX, or a CSV or Excel (.xlsx) file with latitude and longitude columns.`;
}

const GEOMETRY_TYPES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon', 'GeometryCollection']);

export async function readVectorFile(file: File): Promise<FeatureCollection> {
  try {
    return await readVectorFileRaw(file);
  } catch (e) {
    // our own messages are already in plain words; anything else came from a parser
    throw e instanceof ImportError ? e : new ImportError(unreadableMessage(file.name));
  }
}

async function readVectorFileRaw(file: File): Promise<FeatureCollection> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    let j: any;
    try { j = JSON.parse(await file.text()); } catch { throw new ImportError(`${file.name} is not a complete GeoJSON file (it may be cut off or damaged). Export it again and retry.`); }
    if (!j || typeof j !== 'object') throw new ImportError(`${file.name} has no map shapes in it.`);
    if (j.type === 'FeatureCollection') {
      if (!Array.isArray(j.features)) throw new ImportError(unreadableMessage(file.name));
      return j;
    }
    if (j.type === 'Feature') return { type: 'FeatureCollection', features: [j] };
    if (j.type === 'Topology') {
      const key = Object.keys(j.objects)[0];
      return feature(j, j.objects[key]) as unknown as FeatureCollection;
    }
    // a bare shape; any other JSON is not map data
    if (!GEOMETRY_TYPES.has(j.type)) throw new ImportError(unreadableMessage(file.name));
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: j }] };
  }
  if (name.endsWith('.kml') || name.endsWith('.gpx')) {
    const tg = await import('@tmcw/togeojson');
    const dom = new DOMParser().parseFromString(await file.text(), 'text/xml');
    if (dom.getElementsByTagName('parsererror').length) throw new ImportError(unreadableMessage(file.name));
    return (name.endsWith('.kml') ? tg.kml(dom) : tg.gpx(dom)) as FeatureCollection;
  }
  if (name.endsWith('.zip')) {
    const shp = (await import('shpjs')).default;
    const out = await shp(await file.arrayBuffer());
    const list = (Array.isArray(out) ? out : [out]).filter((fc) => fc && Array.isArray((fc as FeatureCollection).features));
    return { type: 'FeatureCollection', features: list.flatMap((fc) => fc.features).filter((f) => f && f.geometry) } as FeatureCollection;
  }
  if (name.endsWith('.csv') || name.endsWith('.txt') || name.endsWith('.tsv')) {
    const r = parsePointsText(await file.text());
    if (!r.points.length) throw new ImportError(r.errors[0] ?? `No points found in ${file.name}. Add latitude and longitude columns (for example "lat" and "lon").`);
    return { type: 'FeatureCollection', features: r.points };
  }
  if (name.endsWith('.xlsx')) {
    // field data kept in Excel: the first sheet is read like a CSV with latitude and longitude columns
    const { xlsxToCsv } = await import('./xlsx');
    let csv = '';
    try { csv = (await xlsxToCsv(await file.arrayBuffer())).csv; } catch (e) { throw new ImportError(`${file.name}: ${(e as Error).message}`); }
    const r = parsePointsText(csv);
    if (!r.points.length) throw new ImportError(r.errors[0] ?? `No points found on the first sheet of ${file.name}. Add latitude and longitude columns (for example "lat" and "lon").`);
    return { type: 'FeatureCollection', features: r.points };
  }
  if (name.endsWith('.xls') || name.endsWith('.ods')) throw new ImportError(`${file.name} is an older spreadsheet format. In Excel or LibreOffice, use Save as, then Excel workbook (.xlsx) or CSV.`);
  if (name.endsWith('.shp')) throw new ImportError('Choose the .shp together with its .dbf and .prj files (hold Ctrl to pick several), or a .zip that contains them.');
  if (name.endsWith('.gpkg')) throw new ImportError('GeoPackage is not supported yet. Export the layer as a shapefile or GeoJSON from QGIS.');
  throw new ImportError(unreadableMessage(file.name));
}

export interface LoadedFile {
  name: string;
  fc: FeatureCollection;
}

/**
 * Read one or more chosen files. Loose shapefile parts (.shp, .dbf, .shx, .prj, .cpg), as they come
 * from DIVA-GIS or GADM downloads, are grouped by name and read together; everything else is read on its own.
 */
export async function readVectorFiles(files: File[]): Promise<LoadedFile[]> {
  const out: LoadedFile[] = [];
  const parts = new Map<string, Record<string, File>>();
  for (const f of files) {
    const m = f.name.match(/^(.*)\.(shp|dbf|shx|prj|cpg|qmd|sbn|sbx|xml)$/i);
    if (m) {
      const base = m[1].replace(/\.shp$/i, '');
      const g = parts.get(base) ?? {};
      g[m[2].toLowerCase()] = f;
      parts.set(base, g);
    } else {
      out.push({ name: f.name.replace(/\.[^.]+$/, ''), fc: await readVectorFile(f) });
    }
  }
  for (const [base, g] of parts) {
    if (!g.shp) {
      if (g.dbf) throw new ImportError(`${base}.dbf was chosen without ${base}.shp. Choose the .shp file too.`);
      continue;
    }
    try {
      const shp = (await import('shpjs')).default as unknown as (o: Record<string, ArrayBuffer | string>) => Promise<FeatureCollection | FeatureCollection[]>;
      const input: Record<string, ArrayBuffer | string> = { shp: await g.shp.arrayBuffer() };
      if (g.dbf) input.dbf = await g.dbf.arrayBuffer();
      if (g.prj) input.prj = await g.prj.text();
      if (g.cpg) input.cpg = await g.cpg.text();
      const res = await shp(input);
      const list = Array.isArray(res) ? res : [res];
      out.push({ name: base, fc: { type: 'FeatureCollection', features: list.flatMap((x) => x.features) } });
    } catch (e) {
      throw e instanceof ImportError ? e : new ImportError(unreadableMessage(g.shp.name));
    }
  }
  return out;
}

/** Field that most likely holds unit names (DIVA-GIS/GADM NAME_3, geoBoundaries shapeName, ADM2_EN, name...). */
export function guessNameField(fc: FeatureCollection): string {
  const props = fc.features.find((f) => f.properties)?.properties ?? {};
  const keys = Object.keys(props).filter((k) => !k.startsWith('__'));
  const nameN = keys.filter((k) => /^NAME_\d$/i.test(k)).sort().pop();
  if (nameN) return nameN;
  const pref = ['shapeName', 'name', 'NAME', 'Name', 'NAME_EN', 'name_en', 'NAME_ENGLI', 'NAMEENGLIS'];
  for (const p of pref) if (keys.includes(p)) return p;
  const adm = keys.filter((k) => /^ADM\d_EN$/i.test(k)).sort().pop();
  if (adm) return adm;
  const named = keys.find((k) => /name/i.test(k));
  if (named) return named;
  return keys.find((k) => typeof props[k] === 'string') ?? keys[0] ?? '';
}

/** Rough check that coordinates are longitude/latitude (shapefiles with .prj are reprojected by shpjs). */
export function looksGeographic(fc: FeatureCollection): boolean {
  let ok = true;
  const visit = (c: unknown): void => {
    if (!ok || !Array.isArray(c)) return;
    if (typeof c[0] === 'number') {
      if (Math.abs(c[0] as number) > 180 || Math.abs(c[1] as number) > 90) ok = false;
      return;
    }
    for (const x of c) visit(x);
  };
  for (const f of fc.features.slice(0, 50)) if (f.geometry && 'coordinates' in f.geometry) visit(f.geometry.coordinates);
  return ok;
}
