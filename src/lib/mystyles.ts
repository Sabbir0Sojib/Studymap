// "My styles": save the look of one map and put it on the next, so a series of figures matches.
//
// A style holds appearance only (colours, line weights, fonts, text styles, grid, legend, scale bar, north arrow,
// locators, page colour, and optionally page size and layout). It never holds geography or wording: the study
// area, layer names, legend labels, the title text and anything the user placed by hand stay as they are.
// Styles live in this browser (localStorage) and travel as a small JSON file. There is no account or server.
//
// Note for importers: this module is called at run time only (no top-level use of imported values), so it may be
// imported from actions.ts even though it imports keepOnPage from there.
import type { Doc, InsetItem, Item, Layer, LayerKind, LayerStyle, LegendItem, MapItem, NorthItem, ScaleItem, CreditsItem, TitleItem } from './store.svelte';
import { store, uid } from './store.svelte';
import { applyTemplate } from './templates';
import { keepOnPage } from './actions';
import { DEFAULT_FONT, ensureFont, isKnownFont } from './fonts.svelte';
import { THEMES, recolourOsm } from './themes';

/* ---------- the shape of a style ---------- */

/**
 * Layers a style knows about. OpenStreetMap layers are told apart by what they draw, so roads never take the water
 * colours. Boundary layers that have a level (division, district...) each keep their own look as "admin:1", "admin:2"...,
 * so the weights and dashes that tell the levels apart survive; "admin" is the plain Boundaries layer.
 */
export type LayerLookKey = 'sea' | 'countries' | 'admin' | `admin:${number}` | 'study' | 'subunits' | 'rivers' | 'lakes' | 'disputed' | 'osm' | 'osm:water' | 'osm:roads';
const LAYER_KEYS: LayerLookKey[] = ['sea', 'countries', 'admin', 'study', 'subunits', 'rivers', 'lakes', 'disputed', 'osm', 'osm:water', 'osm:roads'];
const LEVEL_KEY = /^admin:[1-9]\d?$/;
const INSET_CONTEXTS: InsetItem['context'][] = ['country', 'globe', 'region', 'parent'];

export type LayerLook = Partial<Pick<LayerStyle, 'fill' | 'fill2' | 'fillOpacity' | 'stroke' | 'strokePt' | 'dash' | 'labelPt' | 'labelStyle' | 'hatch'>>;
export interface TerrainLook { visible: boolean; tint?: boolean; exaggeration?: number; azimuth?: number; opacity?: number; auto?: boolean }
export type MapLook = Partial<Pick<MapItem, 'grid' | 'framePt'>>;
export type LegendLook = Partial<Pick<LegendItem, 'labelPt' | 'frame' | 'text' | 'titleText'>>;
export type ScaleLook = Partial<Pick<ScaleItem, 'units' | 'segments' | 'style' | 'labelPt' | 'backdrop' | 'ratio' | 'text'>>;
export type NorthLook = Partial<Pick<NorthItem, 'style' | 'backdrop' | 'trueNorth' | 'text'>>;
export type CreditsLook = Partial<Pick<CreditsItem, 'labelPt' | 'text'>>;
export type InsetLook = Partial<Pick<InsetItem, 'framePt' | 'colours' | 'extentColor' | 'labelPt' | 'text' | 'grid' | 'showExtent' | 'connect'>>;
export type TitleLook = Partial<Pick<TitleItem, 'labelPt' | 'bold' | 'italic' | 'color' | 'font' | 'align'>>;
export interface LayoutLook { presetId: string; widthMm: number; heightMm: number; templateId: string }

export interface Look {
  themeId: string;
  font: string;
  /** a colour, or "none" for a see-through page; white is '#ffffff' */
  pageColor: string;
  layers: Partial<Record<LayerLookKey, LayerLook>>;
  terrain?: TerrainLook;
  items: {
    map?: MapLook; legend?: LegendLook; scale?: ScaleLook; north?: NorthLook; credits?: CreditsLook; title?: TitleLook;
    /** by what the locator shows: country, globe, region or parent */
    inset?: Partial<Record<InsetItem['context'], InsetLook>>;
  };
  /** only when "Include page size and layout" was ticked */
  layout?: LayoutLook;
}

export interface MyStyle { id: string; name: string; created: number; v: 1; look: Look }

export const NOT_A_STYLE = 'This is not a StudyMap style file.';

/* ---------- checks: what a field may hold (used on files and on stored styles, never trusted blindly) ---------- */

type Check = (v: unknown) => unknown;
type Spec = Record<string, Check>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bool: Check = (v) => (typeof v === 'boolean' ? v : undefined);
const num = (min: number, max: number): Check => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
const int = (min: number, max: number): Check => (v) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : undefined);
const oneOf = (list: readonly string[]): Check => (v) => (typeof v === 'string' && list.includes(v) ? v : undefined);
/** a colour word, hex, rgb()/hsl(), or "none": no quotes, semicolons or markup, so it is safe in an SVG or style attribute */
const colour: Check = (v) => (typeof v === 'string' && /^[#a-zA-Z0-9(),.%\s/-]{1,64}$/.test(v) && !/url\(/i.test(v) ? v : undefined);
const ident: Check = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined);
const fontName: Check = (v) => (typeof v === 'string' && v.length > 0 && v.length <= 80 && !/[<>"'`\\;{}\u0000-\u001f]/.test(v) ? v : undefined);
const autoOr = (min: number, max: number): Check => { const n = num(min, max); return (v) => (v === 'auto' ? 'auto' : n(v)); };

/** an object keeping only the fields of `spec` that pass; undefined when a `need`ed field is missing or nothing is left */
const obj = (spec: Spec, need: string[] = []): Check => (v) => {
  if (!isObj(v)) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(spec)) {
    const c = spec[k](v[k]);
    if (c !== undefined) out[k] = c;
  }
  if (need.some((k) => out[k] === undefined)) return undefined;
  return Object.keys(out).length ? out : undefined;
};

const text = obj({ bold: bool, italic: bool, color: colour });

const annSide = obj({ show: oneOf(['all', 'lat', 'lon', 'none']), pos: oneOf(['out', 'in']), dir: oneOf(['h', 'v']) }, ['show', 'pos', 'dir']);
const ann: Check = (v) => {
  if (!isObj(v)) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of ['left', 'right', 'top', 'bottom']) {
    const s = annSide(v[k]);
    if (!s) return undefined;
    out[k] = s;
  }
  return out;
};
const grid = obj({
  show: bool, lines: bool, step: autoOr(0, 360), format: oneOf(['dms', 'dm', 'dd']), labelPt: num(0, 200), lineColor: colour,
  sides: oneOf(['two', 'all']), type: oneOf(['lines', 'crosses', 'frame']), units: oneOf(['degrees', 'metres']), stepM: autoOr(0, 1e9),
  linePt: num(0, 50), dash: bool, frame: oneOf(['none', 'zebra', 'ticks-out', 'ticks-in', 'ticks-both', 'line']),
  frameSize: num(0, 1000), gap: num(0, 1000), ann, text,
}, ['show', 'lines', 'step', 'format', 'labelPt', 'lineColor']);

/** A part of a style: the fields it holds, and the optional ones that go back to the default when the style leaves them out. */
interface Section { spec: Spec; reset: string[]; check: Check }
const section = (spec: Spec, reset: string[] = []): Section => ({ spec, reset, check: obj(spec) });

const LAYER = section({
  fill: colour, fill2: colour, fillOpacity: num(0, 1), stroke: colour, strokePt: num(0, 50), dash: bool, labelPt: num(0, 200), labelStyle: text, hatch: bool,
}, ['fill2', 'labelStyle', 'hatch']);
const TERRAIN = section({ visible: bool, tint: bool, exaggeration: num(0, 50), azimuth: num(0, 360), opacity: num(0, 1), auto: bool });
const ITEMS: Record<'map' | 'legend' | 'scale' | 'north' | 'credits' | 'title', Section> = {
  map: section({ grid, framePt: num(0, 50) }),
  legend: section({ labelPt: num(0, 200), frame: bool, text, titleText: text }, ['text', 'titleText']),
  scale: section({
    units: oneOf(['metric', 'imperial']), segments: int(1, 20), style: oneOf(['alternating', 'line']), labelPt: num(0, 200),
    backdrop: bool, ratio: oneOf(['none', 'cm', 'fraction']), text,
  }, ['backdrop', 'ratio', 'text']),
  north: section({ style: oneOf(['arrow', 'star', 'simple', 'compass', 'rose']), backdrop: bool, trueNorth: bool, text }, ['backdrop', 'text']),
  credits: section({ labelPt: num(0, 200), text }, ['text']),
  title: section({ labelPt: num(0, 200), bold: bool, italic: bool, color: colour, font: fontName, align: oneOf(['start', 'middle', 'end']) }, ['italic', 'color', 'font', 'align']),
};
const INSET = section({
  framePt: num(0, 50), colours: obj({ sea: colour, land: colour, focus: colour, lines: colour }), extentColor: colour, labelPt: num(0, 200),
  text, grid, showExtent: bool, connect: bool,
}, ['framePt', 'colours', 'text', 'grid', 'connect']);
const LAYOUT = obj({ presetId: ident, widthMm: num(50, 1000), heightMm: num(50, 1000), templateId: ident }, ['presetId', 'widthMm', 'heightMm', 'templateId']);

/* ---------- copying a look out of a map and onto a map ---------- */

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** The fields of `spec` that `src` has, deep-copied. */
function grab<T>(src: object, spec: Spec): T {
  const s = src as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(spec)) if (s[k] !== undefined) out[k] = clone(s[k]);
  return out as T;
}

/** Copy the fields a look has onto `dst`; optional fields the look leaves out are cleared so the part matches it. `skip` names fields to leave alone. */
function put(dst: object, look: object | undefined, sec: Section, skip: readonly string[] = []) {
  if (!look) return;
  const d = dst as Record<string, unknown>, l = look as Record<string, unknown>;
  for (const k of Object.keys(sec.spec)) {
    if (skip.includes(k)) continue;
    if (l[k] !== undefined) d[k] = clone(l[k]);
    else if (sec.reset.includes(k)) delete d[k];
  }
}

function layerKey(l: Layer): LayerLookKey | null {
  if (l.kind === 'osm') return l.osmTheme && l.osmTheme !== 'places' ? `osm:${l.osmTheme}` : 'osm';
  const n = l.adminLevel;
  if (l.kind === 'admin' && n) return Number.isInteger(n) && n >= 1 && n <= 99 ? `admin:${n}` : null;
  const k: LayerKind = l.kind;
  return (LAYER_KEYS as string[]).includes(k) ? (k as LayerLookKey) : null;
}

function ofKind<K extends Item['kind']>(doc: Doc, kind: K): Extract<Item, { kind: K }>[] {
  return doc.items.filter((i): i is Extract<Item, { kind: K }> => i.kind === kind);
}

/** A text that is only a panel letter: "(a)", "b)", "C". */
const PANEL_LETTER = /^\(?[a-z]\)?$/i;

/**
 * The title line: the text a layout made as the title, else the one text that is clearly the largest (at least 10 pt;
 * a title the app adds is 12 pt, a subtitle or panel letter 9, a note 7). Panel letters, notes and subtitles are never
 * taken for it, so a style is neither saved from them nor put on them.
 */
function titleOf(doc: Doc): TitleItem | undefined {
  const t = ofKind(doc, 'title').filter((i) => i.role !== 'letter');
  const made = t.find((i) => i.role === 'title' && i.visible) ?? t.find((i) => i.role === 'title');
  if (made) return made;
  const texts = t.filter((i) => !PANEL_LETTER.test((i.text ?? '').trim())).sort((a, b) => b.labelPt - a.labelPt);
  const top = texts[0];
  return top && top.labelPt >= 10 && (texts.length === 1 || top.labelPt > texts[1].labelPt) ? top : undefined;
}

const cleanName = (n: unknown) => (typeof n === 'string' ? n.replace(/\s+/g, ' ').trim().slice(0, 60) : '');

/** Take the look of this map. `includeLayout` adds the page size and layout. */
export function captureStyle(doc: Doc, name: string, includeLayout = false): MyStyle {
  const layers: Look['layers'] = {};
  for (const l of doc.layers) {
    const k = layerKey(l);
    // one look per key: each boundary level has its own key; of several layers that share one (two water layers) the first is kept
    if (k && !layers[k]) layers[k] = grab<LayerLook>(l.style, LAYER.spec);
  }
  const look: Look = { themeId: doc.themeId, font: doc.font || DEFAULT_FONT, pageColor: doc.pageColor ?? '#ffffff', layers, items: {} };

  const tl = doc.layers.find((l) => l.kind === 'terrain');
  if (tl?.terrain) look.terrain = grab<TerrainLook>({ ...tl.terrain, visible: tl.visible }, TERRAIN.spec);

  const map = ofKind(doc, 'map')[0];
  if (map) look.items.map = grab<MapLook>(map, ITEMS.map.spec);
  // The legend frame and the locators' zoom lines are set by the layout (a legend on the map needs its white box), so a style
  // holds them only together with its layout.
  const legend = ofKind(doc, 'legend')[0];
  if (legend) {
    look.items.legend = grab<LegendLook>(legend, ITEMS.legend.spec);
    if (!includeLayout) delete look.items.legend.frame;
  }
  const scale = ofKind(doc, 'scale')[0];
  if (scale) look.items.scale = grab<ScaleLook>(scale, ITEMS.scale.spec);
  const north = ofKind(doc, 'north')[0];
  if (north) look.items.north = grab<NorthLook>(north, ITEMS.north.spec);
  const credits = ofKind(doc, 'credits')[0];
  if (credits) look.items.credits = grab<CreditsLook>(credits, ITEMS.credits.spec);
  const title = titleOf(doc);
  if (title) look.items.title = grab<TitleLook>(title, ITEMS.title.spec);
  const insets: NonNullable<Look['items']['inset']> = {};
  for (const it of ofKind(doc, 'inset')) {
    if (insets[it.context]) continue;
    const g = grab<InsetLook>(it, INSET.spec);
    if (!includeLayout) delete g.connect;
    insets[it.context] = g;
  }
  if (Object.keys(insets).length) look.items.inset = insets;

  if (includeLayout) look.layout = { presetId: doc.presetId, widthMm: doc.widthMm, heightMm: doc.heightMm, templateId: doc.templateId };
  return { id: uid('style'), name: cleanName(name) || 'My style', created: Date.now(), v: 1, look: clone(look) };
}

export interface ApplyResult {
  /** fonts the style uses that this browser does not have (text shows in a stand-in until the font file is added) */
  missingFonts: string[];
  /** boundary layers (by name) whose level the style has no look for: they keep their own look */
  keptLayers: string[];
}

/**
 * Put a style's look on a map. Study area, layer names and visibility (except terrain), legend labels, texts and
 * placed parts are not touched. With a layout in the style, the page is resized and arranged first, so the look's
 * own settings (such as legend frame) win over the layout's defaults.
 */
/** asFigure: passed to the layout (true when a first area is being set up; unset = decided by the map itself). */
export function applyStyle(doc: Doc, style: MyStyle, asFigure?: boolean): ApplyResult {
  const look = style.look;

  if (look.layout) {
    doc.presetId = look.layout.presetId;
    doc.widthMm = look.layout.widthMm;
    doc.heightMm = look.layout.heightMm;
    applyTemplate(doc, look.layout.templateId, true, asFigure);
    if (doc === store.doc) keepOnPage(); // works on the open map; other documents are left as the layout placed them
  }

  doc.themeId = look.themeId;
  doc.font = look.font;
  doc.pageColor = look.pageColor.toLowerCase() === '#ffffff' ? undefined : look.pageColor;

  const kept: string[] = [];
  for (const l of doc.layers) {
    const k = layerKey(l);
    if (!k) continue;
    if (l.kind === 'osm') {
      // a style with no look for these layers still gives them the colours of its map style, so a grey map has no blue water or tan roads
      const own = look.layers[k] ?? look.layers.osm;
      if (own) put(l.style, own, LAYER); else recolourOsm(l, look.themeId);
    } else if (k.startsWith('admin:')) {
      // a boundary level the style has no look for keeps its own look; it never takes the plain Boundaries look
      if (look.layers[k]) put(l.style, look.layers[k], LAYER); else kept.push(l.name);
    } else {
      put(l.style, look.layers[k], LAYER);
    }
  }

  const tl = doc.layers.find((l) => l.kind === 'terrain');
  if (tl && look.terrain) {
    const { visible, ...t } = clone(look.terrain);
    tl.visible = visible;
    const next = { tint: false, exaggeration: 2, azimuth: 315, opacity: 1, ...tl.terrain, ...t };
    if (t.auto === undefined) delete next.auto;
    tl.terrain = next;
  }

  const it = look.items;
  // The legend frame and the locators' zoom lines are the layout's: a style sets them only together with its layout,
  // so applying a look never takes the white box off a legend that sits on the map or the zoom lines off a side-by-side map.
  const byLayout = !!look.layout;
  for (const m of ofKind(doc, 'map')) put(m, it.map, ITEMS.map);
  for (const x of ofKind(doc, 'legend')) put(x, it.legend, ITEMS.legend, byLayout ? [] : ['frame']);
  for (const x of ofKind(doc, 'scale')) put(x, it.scale, ITEMS.scale);
  for (const x of ofKind(doc, 'north')) put(x, it.north, ITEMS.north);
  for (const x of ofKind(doc, 'credits')) put(x, it.credits, ITEMS.credits);
  const title = titleOf(doc);
  if (title) put(title, it.title, ITEMS.title);
  for (const x of ofKind(doc, 'inset')) put(x, it.inset?.[x.context], INSET, byLayout ? [] : ['connect']);

  const fontsWanted = [...new Set([look.font, it.title?.font].filter((f): f is string => !!f))];
  for (const f of fontsWanted) {
    try { ensureFont(f).catch(() => {}); } catch { /* no document (tests): nothing to load */ }
  }
  return { missingFonts: fontsWanted.filter((f) => !isKnownFont(f)), keptLayers: kept };
}

/* ---------- checking a style that came from storage or a file ---------- */

function cleanLook(raw: unknown): Look | null {
  if (!isObj(raw)) return null;
  const layers: Look['layers'] = {};
  if (isObj(raw.layers)) {
    // the fixed layer names, and the boundary levels ("admin:1", "admin:2"...) a style may carry
    const keys = [...LAYER_KEYS, ...Object.keys(raw.layers).filter((k) => LEVEL_KEY.test(k))] as LayerLookKey[];
    for (const k of keys) {
      const c = LAYER.check(raw.layers[k]);
      if (c) layers[k] = c as LayerLook;
    }
  }
  const look: Look = {
    themeId: (ident(raw.themeId) as string | undefined) ?? 'classic',
    font: (fontName(raw.font) as string | undefined) ?? DEFAULT_FONT,
    pageColor: (colour(raw.pageColor) as string | undefined) ?? '#ffffff',
    layers,
    items: {},
  };
  const terrain = TERRAIN.check(raw.terrain);
  if (terrain && typeof (terrain as TerrainLook).visible === 'boolean') look.terrain = terrain as TerrainLook;
  const items = isObj(raw.items) ? raw.items : {};
  const out = look.items as Record<string, unknown>;
  for (const k of Object.keys(ITEMS) as (keyof typeof ITEMS)[]) {
    const c = ITEMS[k].check(items[k]);
    if (c) out[k] = c;
  }
  if (isObj(items.inset)) {
    const insets: NonNullable<Look['items']['inset']> = {};
    for (const ctx of INSET_CONTEXTS) {
      const c = INSET.check(items.inset[ctx]);
      if (c) insets[ctx] = c as InsetLook;
    }
    if (Object.keys(insets).length) look.items.inset = insets;
  }
  const layout = LAYOUT(raw.layout);
  if (layout) look.layout = layout as LayoutLook;
  return look;
}

/** `fresh` gives an imported style a new id, so it never replaces one the user already has. */
function cleanStyle(raw: unknown, fresh: boolean): MyStyle | null {
  if (!isObj(raw)) return null;
  const look = cleanLook(raw.look);
  if (!look) return null;
  const id = !fresh ? (ident(raw.id) as string | undefined) : undefined;
  const created = typeof raw.created === 'number' && Number.isFinite(raw.created) ? raw.created : Date.now();
  return { id: id ?? uid('style'), name: cleanName(raw.name) || 'Imported style', created, v: 1, look };
}

/* ---------- this browser's list of styles ---------- */

const KEY = 'studymap.mystyles.v1';
const DEFAULT_KEY = 'studymap.mystyles.default';

/** The saved styles, newest first. A damaged entry is skipped. */
export function listStyles(): MyStyle[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    const out: MyStyle[] = [];
    for (const r of raw) {
      try { const s = cleanStyle(r, false); if (s) out.push(s); } catch { /* skip */ }
    }
    return out.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

function writeStyles(list: MyStyle[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch { return false; }
}

export const getStyle = (id: string): MyStyle | undefined => listStyles().find((s) => s.id === id);

/** Keep a style (a style with the same id is replaced). False when the browser would not store it. */
export function saveStyle(s: MyStyle): boolean {
  return writeStyles([...listStyles().filter((x) => x.id !== s.id), s]);
}

export function deleteStyle(id: string): boolean {
  if (getDefaultId() === id) setDefaultId(null);
  return writeStyles(listStyles().filter((x) => x.id !== id));
}

export function renameStyle(id: string, name: string): boolean {
  const n = cleanName(name);
  if (!n) return false;
  return writeStyles(listStyles().map((x) => (x.id === id ? { ...x, name: n } : x)));
}

/** The style new maps start with, or null (also null when that style has since been deleted). */
export function getDefaultId(): string | null {
  try {
    const id = localStorage.getItem(DEFAULT_KEY);
    return id && listStyles().some((s) => s.id === id) ? id : null;
  } catch {
    return null;
  }
}

export function setDefaultId(id: string | null): boolean {
  try {
    if (id) localStorage.setItem(DEFAULT_KEY, id); else localStorage.removeItem(DEFAULT_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Put the default style (if one is set) on `doc`. Returns whether it did. */
export function applyDefaultStyle(doc: Doc, asFigure?: boolean): boolean {
  const id = getDefaultId();
  const s = id ? getStyle(id) : undefined;
  if (!s) return false;
  applyStyle(doc, s, asFigure);
  return true;
}

/* ---------- sharing as a file ---------- */

export function styleToFile(s: MyStyle): Blob {
  return new Blob([JSON.stringify({ app: 'StudyMap', kind: 'style', style: s }, null, 2)], { type: 'application/json' });
}

/** File name for a shared style: "<name>.studymap-style.json". */
export function styleFileName(s: MyStyle): string {
  const base = s.name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '');
  return `${base || 'style'}.studymap-style.json`;
}

/** Read a style file. Throws an Error with a plain message when it is not one. */
export async function readStyleFile(file: Blob): Promise<MyStyle> {
  if (file.size > 1_000_000) throw new Error(NOT_A_STYLE);
  let j: unknown;
  try { j = JSON.parse(await file.text()); } catch { throw new Error(NOT_A_STYLE); }
  if (!isObj(j) || j.app !== 'StudyMap' || j.kind !== 'style') throw new Error(NOT_A_STYLE);
  const s = cleanStyle(j.style, true);
  if (!s) throw new Error(NOT_A_STYLE);
  return s;
}

/** Four colours for a small preview, as on the theme swatches: land, water, area, line. */
export function swatchOf(s: MyStyle): [string, string, string, string] {
  const t = THEMES.find((x) => x.id === s.look.themeId) ?? THEMES[0];
  const pick = (c: string | undefined, fallback: string) => (c && c !== 'none' && c !== 'transparent' ? c : fallback);
  const L = s.look.layers;
  // the plain Boundaries line, else the first boundary level the style holds
  const levelKey = Object.keys(L).filter((k) => LEVEL_KEY.test(k)).sort()[0] as LayerLookKey | undefined;
  const line = L.admin?.stroke ?? (levelKey ? L[levelKey]?.stroke : undefined);
  return [pick(L.countries?.fill, t.swatch[0]), pick(L.sea?.fill, t.swatch[1]), pick(L.study?.stroke, t.swatch[2]), pick(line, t.swatch[3])];
}
