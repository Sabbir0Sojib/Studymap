// A link that carries the map itself: its settings, packed and written after the # of the address, so a co-author
// opens the same figure with nothing uploaded anywhere. Boundaries are fetched again by the app; hand-drawn shapes
// travel with the link while they are small, imported files do not.
import type { FeatureCollection } from 'geojson';
import type { Doc } from './store.svelte';

const KEY = 'm=';
// above this the link gets awkward to paste into a chat or an email
const MAX_CHARS = 60_000;

const b64url = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (t: string) => {
  const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};

async function pack(text: string): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const out = new Blob([text]).stream().pipeThrough(cs);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
async function unpack(b: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([b as BlobPart]).stream().pipeThrough(ds);
  return await new Response(out).text();
}

/** The share link for a map; `left` names what could not travel with it (imported files, very large drawings). */
export async function shareLink(doc: Doc, geoms: Record<string, FeatureCollection>, drawnIds: string[]): Promise<{ url: string; left: string[] }> {
  const left: string[] = [];
  const keep: Record<string, FeatureCollection> = {};
  for (const id of drawnIds) if (geoms[id]) keep[id] = geoms[id];
  let body = JSON.stringify({ app: 'StudyMap', doc, geoms: keep });
  let packed = b64url(await pack(body));
  if (packed.length > MAX_CHARS && Object.keys(keep).length) {
    left.push('shapes drawn by hand (too large for a link)');
    body = JSON.stringify({ app: 'StudyMap', doc, geoms: {} });
    packed = b64url(await pack(body));
  }
  for (const l of doc.layers) if (l.visible && (l.kind === 'points' || l.kind === 'vector') && l.source) left.push(l.name);
  const base = location.href.split('#')[0];
  return { url: `${base}#${KEY}${packed}`, left };
}

/** The project carried by the address, if it has one. */
export async function readSharedLink(hash: string): Promise<string | null> {
  const h = hash.replace(/^#/, '');
  if (!h.startsWith(KEY)) return null;
  try { return await unpack(unb64url(h.slice(KEY.length))); } catch { return null; }
}
