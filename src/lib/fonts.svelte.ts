// Fonts for the figure: free look-alikes of the fonts journals ask for (same letter widths, embedded in PDFs),
// plus fonts the user adds from their own computer. Added fonts stay in this browser (IndexedDB) and travel
// inside saved projects, but never inside the undo history (they can be megabytes).
import arimoR from '../assets/fonts/Arimo-Regular.ttf?url';
import arimoB from '../assets/fonts/Arimo-Bold.ttf?url';
import arimoI from '../assets/fonts/Arimo-Italic.ttf?url';
import arimoBI from '../assets/fonts/Arimo-BoldItalic.ttf?url';
import tinosR from '../assets/fonts/Tinos-Regular.ttf?url';
import tinosB from '../assets/fonts/Tinos-Bold.ttf?url';
import tinosI from '../assets/fonts/Tinos-Italic.ttf?url';
import tinosBI from '../assets/fonts/Tinos-BoldItalic.ttf?url';
import carlitoR from '../assets/fonts/Carlito-Regular.ttf?url';
import carlitoB from '../assets/fonts/Carlito-Bold.ttf?url';
import carlitoI from '../assets/fonts/Carlito-Italic.ttf?url';
import carlitoBI from '../assets/fonts/Carlito-BoldItalic.ttf?url';
import caladeaR from '../assets/fonts/Caladea-Regular.ttf?url';
import caladeaB from '../assets/fonts/Caladea-Bold.ttf?url';
import caladeaI from '../assets/fonts/Caladea-Italic.ttf?url';
import caladeaBI from '../assets/fonts/Caladea-BoldItalic.ttf?url';
import cousineR from '../assets/fonts/Cousine-Regular.ttf?url';
import cousineB from '../assets/fonts/Cousine-Bold.ttf?url';
import cousineI from '../assets/fonts/Cousine-Italic.ttf?url';
import cousineBI from '../assets/fonts/Cousine-BoldItalic.ttf?url';
import type { Doc } from './store.svelte';
import { t } from './i18n.svelte';

export type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';
export const STYLES: FontStyle[] = ['normal', 'bold', 'italic', 'bolditalic'];
const DESC: Record<FontStyle, FontFaceDescriptors> = {
  normal: { weight: '400', style: 'normal' },
  bold: { weight: '700', style: 'normal' },
  italic: { weight: '400', style: 'italic' },
  bolditalic: { weight: '700', style: 'italic' },
};

export interface BuiltinFont {
  family: string;
  /** the font journals name, which this one matches letter for letter in width */
  like: string;
  /** fonts to fall back on in other programs (an SVG opened elsewhere) */
  fallback: string;
  serif: boolean;
  files: Record<FontStyle, string>;
}

export const BUILTIN_FONTS: BuiltinFont[] = [
  { family: 'Arimo', like: 'Arial / Helvetica', fallback: 'Arial, Helvetica, sans-serif', serif: false, files: { normal: arimoR, bold: arimoB, italic: arimoI, bolditalic: arimoBI } },
  { family: 'Tinos', like: 'Times New Roman', fallback: "'Times New Roman', Times, serif", serif: true, files: { normal: tinosR, bold: tinosB, italic: tinosI, bolditalic: tinosBI } },
  { family: 'Carlito', like: 'Calibri', fallback: 'Calibri, sans-serif', serif: false, files: { normal: carlitoR, bold: carlitoB, italic: carlitoI, bolditalic: carlitoBI } },
  { family: 'Caladea', like: 'Cambria', fallback: 'Cambria, Georgia, serif', serif: true, files: { normal: caladeaR, bold: caladeaB, italic: caladeaI, bolditalic: caladeaBI } },
  { family: 'Cousine', like: 'Courier New', fallback: "'Courier New', Courier, monospace", serif: false, files: { normal: cousineR, bold: cousineB, italic: cousineI, bolditalic: cousineBI } },
];
export const DEFAULT_FONT = 'Arimo';
export const builtin = (family: string) => BUILTIN_FONTS.find((f) => f.family === family);

/** Reactive: `tick` changes whenever a font finishes loading, so text is measured again. */
export const fonts = $state({ tick: 0, current: DEFAULT_FONT, custom: [] as { family: string; styles: FontStyle[] }[] });
const customFiles = new Map<string, Partial<Record<FontStyle, ArrayBuffer>>>();

const quote = (f: string) => (/^[A-Za-z][A-Za-z0-9-]*$/.test(f) ? f : `'${f.replace(/['"\\]/g, '')}'`);

/** CSS / SVG font-family value for a font, with sensible fallbacks. */
export function fontStack(family: string | undefined): string {
  const f = family || DEFAULT_FONT;
  const b = builtin(f);
  return b ? `${b.family}, ${b.fallback}` : `${quote(f)}, Arimo, Arial, sans-serif`;
}

/** Friendly name for menus: "Times New Roman (Tinos)" or the added font's own name. */
export function fontLabel(family: string | undefined): string {
  const b = builtin(family || DEFAULT_FONT);
  return b ? `${b.like} (${b.family})` : family || DEFAULT_FONT;
}

/** The bundled font a family counts as for journal rules: itself, or by name for a font the user added. */
export function journalFamily(family: string): string {
  if (builtin(family)) return family;
  const n = family.toLowerCase();
  return /arial|helvetica|arimo|liberation sans/.test(n) ? 'Arimo' : /times|tinos|liberation serif/.test(n) ? 'Tinos' : /calibri|carlito/.test(n) ? 'Carlito' : /cambria|caladea/.test(n) ? 'Caladea' : /courier|cousine|liberation mono/.test(n) ? 'Cousine' : family;
}

export const isKnownFont = (family: string) => !!builtin(family) || fonts.custom.some((c) => c.family === family);

/** Every font the figure uses (the map's font and any text with its own). */
export function fontsUsed(doc: Doc): string[] {
  const s = new Set<string>([doc.font || DEFAULT_FONT]);
  for (const it of doc.items) if (it.kind === 'title' && it.font) s.add(it.font);
  return [...s].filter(isKnownFont);
}

/* ---------- loading for the screen ---------- */

const ready = new Map<string, Promise<void>>();
/**
 * Make a font's four styles available to the page, so text is drawn and measured with it. Only the regular style
 * is downloaded now (each style is about 450 KB, a long wait on a slow connection); bold and italic are fetched by
 * the browser the first time text on the page uses them, and text is measured again when they arrive.
 */
export function ensureFont(family: string): Promise<void> {
  const f = family || DEFAULT_FONT;
  let p = ready.get(f);
  if (!p) {
    const b = builtin(f);
    watchFontLoads();
    p = b
      ? Promise.all(STYLES.map((st) => {
          // Arimo regular, bold and italic are also declared in app.css; the extra faces are harmless
          const face = new FontFace(f, `url(${b.files[st]})`, DESC[st]);
          document.fonts.add(face);
          return st === 'normal' ? face.load().catch(() => {}) : undefined;
        })).then(() => { fonts.tick++; })
      : document.fonts.load(`16px ${quote(f)}`).then(() => { fonts.tick++; });
    ready.set(f, p);
  }
  return p;
}

let watching = false;
/** Any face that finishes loading later (a bold label drawn for the first time) has text measured again. */
function watchFontLoads() {
  if (watching || typeof document === 'undefined' || !document.fonts) return;
  watching = true;
  document.fonts.addEventListener('loadingdone', () => { fonts.tick++; });
}

/* ---------- file bytes for exports ---------- */

const byteCache = new Map<string, Promise<ArrayBuffer>>();
function fetchBytes(url: string): Promise<ArrayBuffer> {
  let p = byteCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error('Could not load the map font. Check the connection and try again.');
      return r.arrayBuffer();
    });
    p.catch(() => byteCache.delete(url));
    byteCache.set(url, p);
  }
  return p;
}

/** The font file for one style; a style the font lacks borrows the closest one it has. */
export async function fontBytes(family: string, style: FontStyle): Promise<{ bytes: ArrayBuffer; exact: boolean } | null> {
  const b = builtin(family);
  if (b) return { bytes: await fetchBytes(b.files[style]), exact: true };
  const files = customFiles.get(family);
  if (!files) return null;
  const order: FontStyle[] = style === 'bolditalic' ? ['bolditalic', 'bold', 'italic', 'normal'] : style === 'normal' ? ['normal', 'bold', 'italic', 'bolditalic'] : [style, 'normal', 'bolditalic', 'bold', 'italic'];
  for (const st of order) if (files[st]) return { bytes: files[st]!, exact: st === style };
  return null;
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

/* ---------- reading a font file the user adds ---------- */

/** Family name and style from a TrueType file's own tables. */
function describe(buf: ArrayBuffer): { family: string; style: FontStyle } {
  const dv = new DataView(buf);
  const n = dv.getUint16(4);
  const tables: Record<string, [number, number]> = {};
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16;
    const tag = String.fromCharCode(dv.getUint8(r), dv.getUint8(r + 1), dv.getUint8(r + 2), dv.getUint8(r + 3));
    tables[tag] = [dv.getUint32(r + 8), dv.getUint32(r + 12)];
  }
  let family = '';
  const name = tables['name'];
  if (name) {
    const [o] = name;
    const count = dv.getUint16(o + 2), strOff = o + dv.getUint16(o + 4);
    const found: Record<number, string> = {};
    for (let i = 0; i < count; i++) {
      const r = o + 6 + i * 12;
      const platform = dv.getUint16(r), id = dv.getUint16(r + 6), len = dv.getUint16(r + 8), off = strOff + dv.getUint16(r + 10);
      if ((id !== 1 && id !== 16) || found[id]) continue;
      let s = '';
      if (platform === 3 || platform === 0) for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(dv.getUint16(off + k));
      else if (platform === 1) for (let k = 0; k < len; k++) s += String.fromCharCode(dv.getUint8(off + k));
      if (s.trim()) found[id] = s.trim();
    }
    family = found[16] || found[1] || '';
  }
  let bold = false, italic = false;
  if (tables['OS/2']) {
    const sel = dv.getUint16(tables['OS/2'][0] + 62);
    italic = !!(sel & 1); bold = !!(sel & 32);
  } else if (tables['head']) {
    const mac = dv.getUint16(tables['head'][0] + 44);
    bold = !!(mac & 1); italic = !!(mac & 2);
  }
  return { family, style: bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal' };
}

function register(family: string, files: Partial<Record<FontStyle, ArrayBuffer>>) {
  customFiles.set(family, files);
  for (const st of STYLES) {
    const buf = files[st];
    if (!buf) continue;
    const face = new FontFace(family, buf.slice(0), DESC[st]);
    document.fonts.add(face);
    face.load().catch(() => {});
  }
  const styles = STYLES.filter((st) => files[st]);
  const i = fonts.custom.findIndex((c) => c.family === family);
  if (i >= 0) fonts.custom[i] = { family, styles }; else fonts.custom.push({ family, styles });
  ready.set(family, document.fonts.ready.then(() => { fonts.tick++; }));
}

/**
 * Add font files from the user's computer (.ttf, or .otf with TrueType outlines). Files of one family
 * (regular, bold, italic) are grouped. Returns a sentence for the status line.
 */
export async function addFontFiles(list: FileList | File[]): Promise<{ message: string; families: string[] }> {
  const added = new Set<string>();
  const problems: string[] = [];
  for (const file of Array.from(list)) {
    const buf = await file.arrayBuffer();
    if (buf.byteLength < 12) { problems.push(t('{file} is not a font file', { file: file.name })); continue; }
    const magic = new DataView(buf).getUint32(0);
    if (magic === 0x4f54544f /* OTTO */) { problems.push(t('{file} is a PostScript-style .otf that PDFs made here cannot embed; use the .ttf version of the font', { file: file.name })); continue; }
    if (magic === 0x774f4646 || magic === 0x774f4632 /* wOFF, wOF2 */) { problems.push(t('{file} is a web font; use its .ttf file', { file: file.name })); continue; }
    if (magic !== 0x00010000 && magic !== 0x74727565 /* 'true' */) { problems.push(t('{file} is not a TrueType font (.ttf)', { file: file.name })); continue; }
    let d: { family: string; style: FontStyle };
    try { d = describe(buf); } catch { problems.push(t('{file} could not be read', { file: file.name })); continue; }
    const family = (d.family || file.name.replace(/\.(ttf|otf)$/i, '').replace(/[-_ ]?(regular|bold|italic|bolditalic)$/i, '')).slice(0, 60);
    if (builtin(family)) { problems.push(t('{family} is already in the list', { family })); continue; }
    const files = { ...(customFiles.get(family) ?? {}) };
    files[d.style] = buf;
    register(family, files);
    await saveFont(family, files).catch(() => {});
    added.add(family);
  }
  const fams = [...added];
  const ok = fams.length ? t('Added {fonts}.', { fonts: fams.join(', ') }) : '';
  const bad = problems.length ? ' ' + t('Not added: {problems}.', { problems: problems.join('; ') }) : '';
  return { message: (ok + bad).trim() || t('No font files were chosen.'), families: fams };
}

export async function removeFont(family: string) {
  customFiles.delete(family);
  fonts.custom = fonts.custom.filter((c) => c.family !== family);
  for (const face of [...document.fonts]) if (face.family.replace(/["']/g, '') === family) document.fonts.delete(face);
  ready.delete(family);
  fonts.tick++;
  await db().then((d) => new Promise<void>((res) => { const t = d.transaction('fonts', 'readwrite'); t.objectStore('fonts').delete(family); t.oncomplete = () => res(); t.onerror = () => res(); })).catch(() => {});
}

/* ---------- keeping added fonts: this browser, and project files ---------- */

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open('studymap', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fonts', { keyPath: 'family' });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    dbp.catch(() => (dbp = null));
  }
  return dbp;
}
function saveFont(family: string, files: Partial<Record<FontStyle, ArrayBuffer>>): Promise<void> {
  return db().then((d) => new Promise((res, rej) => {
    const t = d.transaction('fonts', 'readwrite');
    t.objectStore('fonts').put({ family, files });
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  }));
}

/** Bring back the fonts added on earlier visits. */
export async function restoreFonts(): Promise<void> {
  try {
    const d = await db();
    const all: { family: string; files: Partial<Record<FontStyle, ArrayBuffer>> }[] = await new Promise((res, rej) => {
      const r = d.transaction('fonts').objectStore('fonts').getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    for (const f of all) if (!customFiles.has(f.family)) register(f.family, f.files);
  } catch { /* private windows may have no IndexedDB: added fonts then last for this visit only */ }
}

/** Added fonts the figure uses, as base64, for a project file. */
export function packFonts(doc: Doc): Record<string, Partial<Record<FontStyle, string>>> {
  const out: Record<string, Partial<Record<FontStyle, string>>> = {};
  for (const fam of fontsUsed(doc)) {
    const files = customFiles.get(fam);
    if (!files) continue;
    out[fam] = {};
    for (const st of STYLES) if (files[st]) out[fam][st] = toBase64(files[st]!);
  }
  return out;
}

/** Fonts that came inside an opened project file. */
export function unpackFonts(packed: unknown) {
  if (!packed || typeof packed !== 'object') return;
  for (const [family, styles] of Object.entries(packed as Record<string, Partial<Record<FontStyle, string>>>)) {
    if (builtin(family) || !styles) continue;
    const files: Partial<Record<FontStyle, ArrayBuffer>> = {};
    for (const st of STYLES) if (typeof styles[st] === 'string') { try { files[st] = fromBase64(styles[st]!); } catch { /* skip a damaged style */ } }
    if (!Object.keys(files).length) continue;
    register(family, files);
    saveFont(family, files).catch(() => {});
  }
}
