// Layout templates: rearrange the same elements for different figure styles.
import type { Doc, Item, MapItem } from './store.svelte';
import { uid } from './store.svelte';
import { findPreset } from './journals';
import { insetColour } from './themes';

export interface Template {
  id: string;
  name: string;
  note: string;
  /** preferred page height for a given width */
  height: (w: number) => number;
}

export const TEMPLATES: Template[] = [
  { id: 'classic', name: 'Classic', note: 'Map with a column of locators, legend and credits', height: (w) => Math.round(w < 130 ? w * 1.25 : w * 0.79) },
  { id: 'corner', name: 'Inset in corner', note: 'Full-width map with the locator inside it', height: (w) => Math.round(w * 0.8) },
  { id: 'strip', name: 'Locators below', note: 'Map on top, two locators and legend underneath', height: (w) => Math.round(w * 0.95) },
  { id: 'titled', name: 'With title', note: 'A title line above the map', height: (w) => Math.round(w * 0.85) },
  { id: 'twin', name: 'Side by side', note: 'Study area and country map next to each other', height: (w) => Math.round(w * 0.62) },
  { id: 'drill', name: 'Drill-down (a)(b)(c)', note: 'Country, then district, then the study area, joined by zoom lines', height: (w) => Math.round(w * 0.62) },
  { id: 'overview', name: 'Country overview', note: 'Whole country with the study areas highlighted', height: (w) => Math.round(w * 0.9) },
  { id: 'minimal', name: 'Minimal', note: 'Just the map, scale, north and credits', height: (w) => Math.round(w * 0.7) },
];

type Box = { x: number; y: number; w: number; h: number; visible?: boolean };
type Plan = Partial<Record<'map' | 'globe' | 'country' | 'parent' | 'north' | 'scale' | 'legend' | 'credits' | 'title', Box | null>>;

function plan(id: string, W: number, H: number): Plan {
  const m = 6; // outer margin, room for grid labels
  switch (id) {
    case 'corner': {
      const strip = 24;
      const mapH = H - strip - 12;
      const y2 = 5 + mapH + 7;
      return {
        map: { x: m, y: 5, w: W - 2 * m, h: mapH },
        country: { x: W - m - 46, y: 5, w: 46, h: 40 },
        globe: null,
        north: { x: m + 5, y: 11, w: 8, h: 14 },
        scale: { x: m + 4, y: 5 + mapH - 13, w: 44, h: 9 },
        legend: { x: m, y: y2, w: (W - 2 * m) * 0.56, h: H - y2 - 2 },
        credits: { x: m + (W - 2 * m) * 0.59, y: y2, w: (W - 2 * m) * 0.41, h: H - y2 - 2 },
        title: null,
      };
    }
    case 'strip': {
      const mapH = Math.round(H * 0.66);
      const y2 = mapH + 12;
      const colW = (W - 2 * m - 8) / 3;
      return {
        map: { x: m, y: 5, w: W - 2 * m, h: mapH },
        globe: { x: m + (colW - Math.min(colW, H - y2 - 3)) / 2, y: y2, w: Math.min(colW, H - y2 - 3), h: Math.min(colW, H - y2 - 3) },
        country: { x: m + colW + 4, y: y2, w: colW, h: H - y2 - 3 },
        north: { x: m + 5, y: 11, w: 8, h: 14 },
        scale: { x: m + 4, y: 5 + mapH - 13, w: 44, h: 9 },
        legend: { x: m + 2 * colW + 8, y: y2, w: colW, h: (H - y2) * 0.55 },
        credits: { x: m + 2 * colW + 8, y: y2 + (H - y2) * 0.57, w: colW, h: (H - y2) * 0.4 },
        title: null,
      };
    }
    case 'titled': {
      const top = 14;
      return {
        title: { x: m, y: 3, w: W - 2 * m, h: 7 },
        map: { x: m, y: top, w: W - m - 58, h: H - top - 5 },
        globe: { x: W - 48, y: top, w: 40, h: 40 },
        country: { x: W - 52, y: top + 43, w: 48, h: 38 },
        north: { x: m + 6, y: top + 6, w: 8, h: 14 },
        scale: { x: m + 6, y: H - 17, w: 44, h: 9 },
        legend: { x: W - 52, y: top + 84, w: 48, h: H - top - 84 - 26 },
        credits: { x: W - 52, y: H - 24, w: 48, h: 21 },
      };
    }
    case 'twin': {
      const gap = 10;
      const mw = Math.round((W - 2 * m - gap) * 0.56);
      const cw = W - 2 * m - gap - mw;
      const mh = H - 22;
      return {
        map: { x: m, y: 5, w: mw, h: mh },
        // legend under the country map, not on it
        country: { x: m + mw + gap, y: 5, w: cw, h: mh - 26 },
        globe: null,
        north: { x: m + mw - 14, y: 10, w: 8, h: 14 },
        scale: { x: m + 4, y: 5 + mh - 13, w: 44, h: 9 },
        legend: { x: m + mw + gap, y: 5 + mh - 22, w: cw, h: 22 },
        credits: { x: m, y: H - 10, w: W - 2 * m, h: 9 },
        title: null,
      };
    }
    case 'drill': {
      // (a) country and (b) district stacked on the left, (c) the study area large on the right
      const colW = Math.round(W * 0.34);
      const gap = 8;
      const half = (H - 10 - 4) / 2;
      const mx = m + colW + gap;
      return {
        country: { x: m, y: 5, w: colW, h: half },
        parent: { x: m, y: 5 + half + 4, w: colW, h: half },
        map: { x: mx, y: 5, w: W - mx - m, h: H - 10 },
        globe: null,
        // the legend at the bottom right of (c) with the scale bar under it, the north arrow at the top left under
        // the panel letter (the owner's layout)
        north: { x: mx + 4, y: 12, w: 8, h: 14 },
        scale: { x: W - m - 48, y: H - 18, w: 44, h: 9 },
        legend: { x: W - m - 48, y: H - 37, w: 44, h: 18 },
        credits: null,
        title: null,
      };
    }
    case 'overview': {
      return {
        map: { x: m, y: 5, w: W - 2 * m, h: H - 10 },
        globe: { x: m + 4, y: 9, w: 30, h: 30 },
        country: null,
        north: { x: W - m - 14, y: 10, w: 8, h: 14 },
        scale: { x: W - m - 50, y: H - 19, w: 44, h: 9 },
        legend: { x: m + 4, y: H - 36, w: 50, h: 26 },
        credits: null,
        title: null,
      };
    }
    case 'minimal': {
      return {
        map: { x: m, y: 5, w: W - 2 * m, h: H - 24 },
        globe: null, country: null, legend: null, title: null,
        north: { x: W - m - 14, y: 11, w: 8, h: 14 },
        scale: { x: m + 4, y: H - 32, w: 44, h: 9 },
        credits: { x: m, y: H - 12, w: W - 2 * m, h: 10 },
      };
    }
    default:
      if (W < 130) {
        // single column: map full width on top, locator and legend side by side underneath
        const mapH = Math.round(H * 0.68);
        const y2 = 5 + mapH + 5;
        const half = (W - 2 * m - 4) / 2;
        return {
          map: { x: m, y: 5, w: W - 2 * m, h: mapH },
          globe: null,
          country: { x: m, y: y2, w: half, h: H - y2 - 3 },
          north: { x: W - m - 12, y: 10, w: 7, h: 12 },
          scale: { x: m + 3, y: 5 + mapH - 11, w: Math.min(40, W * 0.45), h: 8 },
          legend: { x: m + half + 4, y: y2, w: half, h: H - y2 - 3 },
          credits: null,
          title: null,
        };
      }
      // the side column is anchored to the map frame at both ends, so it reads as one balanced block:
      // the locator at the top, the legend and the scale bar at the foot, level with the bottom of the map.
      // On a tall page the locator grows to a 3:4 frame (it shows more of the country and its neighbours), so
      // no empty gap is left in the middle of the column.
      const locH = H >= 130 ? 64 : 52;
      return {
        map: { x: m, y: 5, w: W - m - 58, h: H - 10 },
        globe: null,
        country: { x: W - 52, y: 5, w: 48, h: locH },
        north: { x: 12, y: 10, w: 8, h: 14 },
        scale: { x: W - 52, y: H - 14, w: 44, h: 9 },
        legend: { x: W - 52, y: locH + 10, w: 48, h: Math.max(14, H - 17 - locH - 10) },
        credits: null,
        title: null,
      };
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Rearrange the document's elements into a template, keeping every element's own settings. */
/** asFigure: lay out the real figure. Before a place is chosen the page is an empty world map, which fills the sheet. */
export function applyTemplate(doc: Doc, id: string, keepHeight = false, asFigure = doc.study.source !== 'none') {
  const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
  doc.templateId = t.id;
  if (!keepHeight) doc.heightMm = Math.min(t.height(doc.widthMm), 230, findPreset(doc.presetId).maxHeightMm);
  const W = doc.widthMm, H = doc.heightMm;
  const p = plan(t.id, W, H);
  for (const it of doc.items) it.pinned = false;
  // drill-down: the legend, scale bar and north arrow stay where the layout puts them (they never jump to another corner)
  for (const it of doc.items) if (t.id === 'drill' && (it.kind === 'legend' || it.kind === 'north' || it.kind === 'scale')) it.pinned = true;
  const place = (it: Item | undefined, box: Box | null | undefined) => {
    if (!it || box === undefined) return;
    if (box === null) { it.visible = false; return; }
    it.visible = true;
    it.x = r1(Math.max(0, box.x)); it.y = r1(Math.max(0, box.y)); it.w = r1(Math.max(8, box.w)); it.h = r1(Math.max(6, box.h));
  };
  const find = (k: Item['kind'], pred: (i: Item) => boolean = () => true) => doc.items.find((i) => i.kind === k && pred(i));
  place(find('map'), p.map);
  place(find('inset', (i) => i.kind === 'inset' && i.context === 'globe'), p.globe);
  place(find('inset', (i) => i.kind === 'inset' && (i.context === 'country' || i.context === 'region')), p.country);
  let parent = find('inset', (i) => i.kind === 'inset' && i.context === 'parent');
  if (p.parent && !parent) {
    // the marker takes the colour the other locators have (the map style's), so a black-and-white map gets no orange locator
    parent = { id: uid('inset'), kind: 'inset', context: 'parent', frameLevel: 2, x: 0, y: 0, w: 10, h: 10, visible: true, showExtent: true, extentColor: insetColour(doc), label: '', labelPt: 7, connect: true };
    doc.items.push(parent);
  }
  if (parent) place(parent, p.parent ?? null);
  place(find('north'), p.north);
  place(find('scale'), p.scale);
  place(find('legend'), p.legend);
  place(find('credits'), p.credits);
  let title = find('title', (i) => i.kind === 'title' && i.role === 'title');
  if (p.title && !title) {
    title = { id: uid('title'), kind: 'title', role: 'title', x: 0, y: 0, w: 10, h: 7, visible: true, text: doc.study.name || 'Study area', labelPt: 11, bold: true };
    doc.items.push(title);
  }
  if (title) place(title, p.title ?? null);
  const map = find('map') as MapItem | undefined;
  if (map) map.grid.show = true;
  if (map && !asFigure) { map.x = 6; map.y = 5; map.w = r1(W - 12); map.h = r1(H - 10); }
  // Zoom lines only where the locator sits right next to the map with nothing in between.
  const ctry = find('inset', (i) => i.kind === 'inset' && (i.context === 'country' || i.context === 'region'));
  if (ctry && ctry.kind === 'inset') ctry.connect = t.id === 'twin' || t.id === 'strip';
  // Drill-down: panel letters as in published figures, zoom lines from (b) to (c)
  if (ctry && ctry.kind === 'inset') ctry.label = t.id === 'drill' ? '(a)' : ctry.label === '(a)' ? '' : ctry.label;
  // (a) shows the country with its districts, as most published drill-down figures do
  if (t.id === 'drill' && ctry && ctry.kind === 'inset' && ctry.adminLevel === undefined) ctry.adminLevel = 2;
  if (parent && parent.kind === 'inset') { parent.label = '(b)'; parent.connect = true; }
  // (a) outlines the ground of (b), with zoom lines between them, so the eye steps (a) to (b) to (c)
  if (ctry && ctry.kind === 'inset') {
    if (t.id === 'drill' && parent) { ctry.marks = parent.id; ctry.connect = true; } else delete ctry.marks;
  }
  let letter = doc.items.find((i) => i.kind === 'title' && (i.role === 'letter' || (!i.role && i.text === '(c)')));
  if (t.id === 'drill' && !letter && map) {
    letter = { id: uid('title'), kind: 'title', role: 'letter', x: map.x + 2, y: map.y + 1.5, w: 8, h: 5, visible: true, text: '(c)', labelPt: 9, bold: true };
    doc.items.push(letter);
  }
  if (letter && map) { letter.visible = t.id === 'drill'; letter.x = map.x + 2; letter.y = map.y + 1.5; }
  // A legend placed over a map gets a white box so it stays readable.
  const lg = find('legend');
  if (lg && lg.kind === 'legend') lg.frame = t.id === 'drill' || t.id === 'overview';
  // A part the layout hides keeps its old place, which can lie off a smaller page (a style or journal that shrinks the page).
  // Bring it inside, so showing it later (Map parts) puts it on the page and not beyond its edge. Parts on show are
  // kept on the page by keepOnPage, which the callers run.
  for (const it of doc.items) {
    if (it.visible || it.kind === 'shape') continue;
    if (it.w > W) it.w = W;
    if (it.h > H) it.h = H;
    it.x = r1(Math.max(0, Math.min(it.x, W - it.w)));
    it.y = r1(Math.max(0, Math.min(it.y, H - it.h)));
  }
}
