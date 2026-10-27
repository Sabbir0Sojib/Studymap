// What the shell (rail, side panel, top bar, Place panel) shares: which part of Design and Map parts is open,
// whether My maps is open, which of the four steps a tab belongs to, and the two things that switch maps
// (start a new one, open a kept one). No screen draws anything from here.
import { store } from '../lib/store.svelte';
import type { Tab } from '../lib/store.svelte';
import { applyDefaultStyle } from '../lib/mystyles';
import { getMap, listMaps, putMap } from '../lib/library';
import { t, i18n } from '../lib/i18n.svelte';

/** The part of Design / Map parts last opened, kept while the app is open (also when the panel is closed and reopened). */
export const memo = $state({ design: 'colours', parts: 'essentials' });

/** open one part of Design (e.g. 'page') from elsewhere, such as the page toolbar */
export function openDesign(part: string) { memo.design = part; }

/** The two folded groups of Map parts, Add: "Add your own" (points, a map file) and "Add detail from OpenStreetMap". */
export const addOpen = $state({ own: false, osm: false });

/** open one part of Map parts (e.g. 'layers'); own = also unfold "Add your own" */
export function openParts(part: 'essentials' | 'onmap' | 'insets' | 'add' | 'layers', own = false) {
  memo.parts = part;
  if (own) addOpen.own = true;
}

/** the My maps window */
export const mapsUi = $state({ open: false });

export type Step = 'place' | 'templates' | 'elements' | 'export';
/** the step a tab belongs to (the old Style, Text and Uploads tabs belong to Design and Map parts); null while element settings are open */
export function stepOf(tab: Tab): Step | 'help' | null {
  if (tab === 'place') return 'place';
  if (tab === 'templates' || tab === 'style') return 'templates';
  if (tab === 'elements' || tab === 'uploads' || tab === 'text') return 'elements';
  if (tab === 'export') return 'export';
  return tab === 'help' ? 'help' : null;
}

/** "just now", "5 min ago", "2 h ago", or the date: how long ago a map was kept */
export function ago(at: number): string {
  const d = Date.now() - at;
  if (d < 60_000) return t('just now');
  if (d < 3_600_000) return t('{n} min ago', { n: Math.round(d / 60_000) });
  if (d < 86_400_000) return t('{n} h ago', { n: Math.round(d / 3_600_000) });
  return new Date(at).toLocaleDateString(i18n.lang === 'bn' ? 'bn-BD' : undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * A message about something that went wrong: it stays on the screen until it is dismissed and is announced at once.
 * It is told by its English words, or by the Bangla ones a translated message uses (a problem message in Bangla
 * carries one of them, such as "যায়নি" or "ব্যর্থ").
 */
export function isProblem(msg: string): boolean {
  return /could ?n.t|couldn|failed|not responding|error|check your connection|try again/i.test(msg) || /যায়নি|যায় নি|পারিনি|পারেনি|হয়নি|ব্যর্থ|ত্রুটি|সংযোগ|আবার চেষ্টা/.test(msg);
}

/** Keep the map on screen in My maps first, so switching never loses an edit made a moment ago (an empty map is not kept). */
/** Keeps the map on screen in My maps before another one replaces it. */
export async function keepCurrent() {
  store.flush();
  if (store.doc.study.source === 'none') return;
  try {
    const old = (await listMaps()).find((m) => m.id === store.mapId);
    await putMap({ id: store.mapId, name: store.doc.title || store.doc.study.name || 'Untitled map', updated: Date.now(), thumb: old?.thumb, data: store.serialize(true, false) });
  } catch { /* the library is unavailable: the map stays in the autosave until the new one replaces it */ }
}

/** File, New map: the map on screen is already kept in My maps, so this only starts a fresh one. */
export async function startNewMap() {
  await keepCurrent();
  store.cvd = '';
  store.reset();
  if (applyDefaultStyle(store.doc)) store.clearHistory();
  store.status = t('New map started. The one before is in File, My maps.');
}

/** Open a map kept in My maps; false when it is gone. */
export async function openKeptMap(id: string): Promise<boolean> {
  if (id === store.mapId) return true;
  try {
    const m = await getMap(id);
    if (!m) { store.status = t('That map is no longer in this browser.'); return false; }
    await keepCurrent();
    store.load(m.data, true);
    store.setMapId(id);
    store.status = t('Opened {name}. Your other maps are in File, My maps.', { name: m.name });
    return true;
  } catch (e) {
    store.status = t('Could not open that map: {reason}', { reason: (e as Error).message });
    return false;
  }
}
