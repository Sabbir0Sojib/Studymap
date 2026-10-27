// Keeps the table of sites and the elevation profile up to date while the map is edited. Both run inside a $effect of the
// desk (Canvas.svelte), so they cost nothing until such a part is on the page.
import { untrack } from 'svelte';
import { store } from './store.svelte';
import { lineCoords, lineKey, tableData, tableLayout } from './figparts';
import { elevationProfile } from './terrain';

/** What each elevation profile is doing, by part id: '' = it has its heights, otherwise the sentence to show (reading, or why it cannot). */
export const profileState = $state<Record<string, string>>({});
const setState = (id: string, text: string) => { if (untrack(() => profileState[id]) !== text) profileState[id] = text; };

const inflight = new Set<string>();
/** a failed read is not tried again for a while (every edit of the map would otherwise ask the network again) */
const failed = new Map<string, number>();
/** the reads under way, so an export can wait for them */
const reading = new Set<Promise<unknown>>();

/**
 * Read the ground height along the line of every elevation profile whose heights are missing or belong to another line.
 * The heights are kept in the part itself (data), so a saved map, a reload and an export never wait for the network.
 * They are written without an Undo step of their own: undoing goes back to before the part was made, not to "no heights".
 */
export function syncProfiles() {
  for (const it of store.doc.items) {
    if (it.kind !== 'profile' || !it.visible) continue;
    const id = it.id;
    const coords = lineCoords(it.line, store.geoms);
    if (!coords) { setState(id, 'The line is not on the map any more. Choose another line in the settings.'); continue; }
    const key = lineKey(coords);
    if (it.data?.key === key) { setState(id, ''); continue; }
    const tag = `${id}|${key}`;
    if (inflight.has(tag)) continue;
    const bad = failed.get(tag);
    if (bad && Date.now() - bad < 20000) continue;
    inflight.add(tag);
    setState(id, 'Reading the ground height along the line…');
    const run: Promise<void> = elevationProfile(coords, key)
      .then((r) => {
        const cur = store.doc.items.find((x) => x.id === id);
        // the part may have been deleted, undone or pointed at another line meanwhile: the next run of this effect deals with it
        if (cur && cur.kind === 'profile') {
          const now = lineCoords(cur.line, store.geoms);
          if (now && lineKey(now) === key) { cur.data = { key, z: r.z, lenKm: r.lenKm, km: r.km, m: r.m }; store.autosave(); }
        }
        failed.delete(tag);
      })
      .catch((e: Error) => { failed.set(tag, Date.now()); setState(id, `${e.message} Check your connection, then try again.`); })
      .finally(() => { inflight.delete(tag); reading.delete(run); });
    reading.add(run);
  }
}

/** Wait (at most a minute) until every elevation profile has its heights, so an export never shows "Reading the ground height…". */
export async function profilesReady(): Promise<void> {
  syncProfiles();
  if (!reading.size) return;
  await Promise.race([Promise.allSettled([...reading]), new Promise((r) => setTimeout(r, 60000))]);
}

/** Ask again after a failure (the "Try again" button). */
export function retryProfile(id: string) {
  for (const k of [...failed.keys()]) if (k.startsWith(id + '|')) failed.delete(k);
  syncProfiles();
}

const r1 = (v: number) => Math.round(v * 10) / 10;
/** up to the next 0.1 mm, so a box rounded to a tenth never comes out a hair short of its rows */
const up1 = (v: number) => Math.ceil(v * 10 - 1e-6) / 10;

/**
 * A table's box follows the table: as wide as its columns and as tall as its rows (like the legend), until the box is sized by hand.
 * A table in the right half of the page keeps its right edge when it grows; one that would run off the page moves up or left.
 * A table taller than the page is cut to the page; the journal check then says how many rows are left out.
 */
export function fitTables() {
  const W = store.doc.widthMm, H = store.doc.heightMm;
  for (const it of store.doc.items) {
    if (it.kind !== 'table' || !it.visible || it.fit === false) continue;
    const d = tableData(it, store.doc, store.geoms);
    if (!d || !d.head.length) continue;
    // measured against the table's own natural size: the columns are as wide as their words whatever the box is now
    const lay = tableLayout({ ...it, w: 0, h: 0 }, d);
    const w = Math.min(W, Math.max(8, up1(lay.natW))), h0 = Math.max(4, up1(lay.natH));
    let x = it.x, y = it.y;
    if (Math.abs(it.w - w) > 0.3) x = it.x + it.w / 2 > W / 2 ? r1(it.x + it.w - w) : it.x;
    x = Math.max(0, Math.min(x, W - w));
    if (y + h0 > H) y = Math.max(0, r1(H - h0));
    const h = Math.min(h0, r1(H - y));
    if (Math.abs(it.w - w) > 0.3 || Math.abs(it.h - h) > 0.3) { it.w = w; it.h = h; }
    if (Math.abs(it.x - x) > 0.05) it.x = x;
    if (Math.abs(it.y - y) > 0.05) it.y = y;
  }
}
