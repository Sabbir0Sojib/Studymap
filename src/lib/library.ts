// "My maps": every map kept in this browser (IndexedDB), with a small picture of each and named versions
// ("Before reviewer 2"), so a new map never replaces the last one. Nothing leaves the computer.

export interface MapEntry {
  id: string;
  name: string;
  /** ms since 1970 */
  updated: number;
  /** a small PNG of the page, as a data URL */
  thumb?: string;
  /** the whole project, as File, Download project file writes it */
  data: string;
}

export interface VersionEntry {
  id: string;
  mapId: string;
  label: string;
  created: number;
  thumb?: string;
  data: string;
}

const DB = 'studymap-library';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser cannot keep several maps.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('maps')) d.createObjectStore('maps', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('versions')) d.createObjectStore('versions', { keyPath: 'id' }).createIndex('mapId', 'mapId');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error ?? new Error('Could not open the map library.')); };
  });
  return dbp;
}

function run<T>(store: 'maps' | 'versions', mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(store, mode);
    const req = work(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error ?? new Error('The map library could not save that.'));
    tx.onabort = () => reject(tx.error ?? new Error('The browser storage is full.'));
  }));
}

/** All kept maps, newest first, without their data (it can be large). */
export async function listMaps(): Promise<Omit<MapEntry, 'data'>[]> {
  const all = await run<MapEntry[]>('maps', 'readonly', (s) => s.getAll());
  return all.map(({ data: _d, ...rest }) => rest).sort((a, b) => b.updated - a.updated);
}

export const getMap = (id: string) => run<MapEntry | undefined>('maps', 'readonly', (s) => s.get(id));

export async function putMap(e: MapEntry) {
  await run('maps', 'readwrite', (s) => s.put(e));
}

export async function deleteMap(id: string) {
  await run('maps', 'readwrite', (s) => s.delete(id));
  const vs = await listVersions(id);
  await Promise.all(vs.map((v) => run('versions', 'readwrite', (s) => s.delete(v.id))));
}

export async function listVersions(mapId: string): Promise<VersionEntry[]> {
  const all = await run<VersionEntry[]>('versions', 'readonly', (s) => s.index('mapId').getAll(mapId));
  return all.sort((a, b) => b.created - a.created);
}

export async function putVersion(v: VersionEntry) {
  await run('versions', 'readwrite', (s) => s.put(v));
}

export async function deleteVersion(id: string) {
  await run('versions', 'readwrite', (s) => s.delete(id));
}

/** A small picture of the page for the gallery: the figure drawn onto a canvas about 320 px wide. */
export async function thumbnail(svg: SVGSVGElement, widthMm: number, heightMm: number): Promise<string | undefined> {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const w = 320, h = Math.max(1, Math.round((w * heightMm) / widthMm));
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('thumb')); img.src = url; });
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      if (!g) return undefined;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      return c.toDataURL('image/png');
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return undefined;
  }
}
