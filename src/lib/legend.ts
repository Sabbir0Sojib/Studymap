// What the legend lists, and where each line goes. The figure draws it, the box fitting in App.svelte sizes the box by it and
// the journal check measures it, so all three call these two functions and always agree.
//
// A line is one layer (as always), or, for a layer styled by a table, several: one per colour value, a heading with the
// size key's three circles, "1–8 Sampling sites" for numbered markers, the classes of a colour-by-value map and its
// "No data" line.
import type { Doc, Layer, LegendItem } from './store.svelte';
import type { MainScene } from './scene';
import { legendLayout } from './textstyle';
import { textWidthMm } from './measure';
import { ptToMm } from './journals';
import { resolveChoro } from './classify';
import { catColour, catLabel, fmtKey, markOpacity, MAX_CATS, pointLook, sizeFor, sizeKey, symShape } from './marks';
import { look, TEXT } from './textstyle';

/** Several study units can each get their own colour (soft, print-friendly set). */
export const UNIT_COLOURS = ['#B3DE69', '#FB8072', '#80B1D3', '#FDB462', '#BEBADA', '#8DD3C7', '#FCCDE5', '#CCEBC5'];

type Shape = Layer['style']['symbol'];

export type LegendRow = {
  /** height in legend rows (1 = the usual row) */
  h: number;
  /** what is written beside the symbol, and whether it is a heading (bold, from the left edge) */
  text: string;
  head?: boolean;
  /** where the text starts when it is not after the usual swatch (a key with wide circles) */
  textX?: number;
} & (
  | { t: 'layer'; layer: Layer; unit?: string; colour?: string }
  | { t: 'text' }
  | { t: 'dot'; shape: Shape; fill: string; opacity: number; stroke: string; strokePt: number; /** width in mm; unset = the layer's, at most 3 */ dMm?: number; /** a number drawn inside */ num?: string; numMm?: number; layer: Layer; /** a key circle at its true size: not scaled with the symbol size */ key?: boolean; keyX?: number }
  | { t: 'box'; fill: string; opacity: number; stroke: string; strokePt: number; hatch?: boolean; layer: Layer }
);

export interface LegendCtx {
  /** the terrain picture is on the map (the terrain layer then has a line) */
  terrain: boolean;
  /** lowest and highest ground, for the elevation line's text */
  elevation?: { min: number; max: number } | null;
}

/** The legend's lines, top first. `lg` sets the row height that the key circles are fitted to. */
export function legendRows(doc: Doc, main: MainScene | null, ctx: LegendCtx, lg: LegendItem): LegendRow[] {
  if (!main) return [];
  const drawn = new Set(main.layers.filter((ld) => ld.paths.length > 0 || (doc.layers.find((l) => l.id === ld.layerId)?.kind === 'terrain' && ctx.terrain)).map((ld) => ld.layerId));
  const layers = doc.layers.filter((l) => l.visible && l.inLegend && drawn.has(l.id)).slice().reverse();
  const studyL = doc.layers.find((l) => l.kind === 'study' && l.visible);
  const studyAreas = studyL ? (main.byId[studyL.id]?.paths ?? []).filter((p) => p.kind === 'area') : [];
  const byUnit = !!studyL?.style.byUnit && studyAreas.length > 1;
  const lay = legendLayout(lg, 1);
  const out: LegendRow[] = [];
  for (const l of layers) {
    if (l.kind === 'study' && byUnit) {
      studyAreas.forEach((p, i) => { const name = p.name || `Area ${i + 1}`; out.push({ t: 'layer', layer: l, unit: name, colour: UNIT_COLOURS[i % UNIT_COLOURS.length], h: 1, text: name }); });
      continue;
    }
    const own = l.kind === 'subunits' || l.kind === 'admin' ? choroRows(l, main) : l.kind === 'points' || l.kind === 'vector' ? pointRows(l, main, lay.row, lay.k) : null;
    if (own) { out.push(...own); continue; }
    const text = l.kind === 'terrain' && l.terrain?.tint && ctx.elevation && (!l.legendLabel || l.legendLabel === 'Shaded relief')
      ? `Elevation ${ctx.elevation.min.toLocaleString('en-US')}–${ctx.elevation.max.toLocaleString('en-US')} m`
      : l.legendLabel?.trim() || l.name;
    out.push({ t: 'layer', layer: l, h: 1, text });
  }
  return out;
}

/** An area layer coloured from a table: a heading, one line per class, and "No data" when some drawn area has no value. */
function choroRows(l: Layer, main: MainScene): LegendRow[] | null {
  const c = l.choro;
  const ld = main.byId[l.id];
  if (!c || !ld?.allNames) return null;
  const res = resolveChoro(c, ld.allNames);
  if (!res.legend.length) return null;
  const st = l.style;
  const stroke = st.stroke === 'none' ? '#8C8C86' : st.stroke;
  const rows: LegendRow[] = [];
  const title = (c.title ?? c.field).trim();
  if (title) rows.push({ t: 'text', head: true, h: 1, text: title });
  const op = c.opacity ?? 1;
  for (const e of res.legend) rows.push({ t: 'box', layer: l, fill: e.colour, opacity: op, stroke, strokePt: 0.25, h: 1, text: e.label });
  const drawnNames = new Set(ld.paths.filter((p) => p.kind === 'area').map((p) => p.name));
  if ([...res.noData].some((n) => drawnNames.has(n))) rows.push({ t: 'box', layer: l, fill: '#E4E4E4', opacity: 1, stroke, strokePt: 0.25, hatch: c.noDataHatch !== false, h: 1, text: c.noDataLabel?.trim() || 'No data' });
  return rows;
}

/** Points styled by a column: colours, symbols, the size key or the number range. null = one line for the layer, as always. */
function pointRows(l: Layer, main: MainScene, row: number, k: number): LegendRow[] | null {
  const pb = l.pointsBy;
  const ld = main.byId[l.id];
  if (!pb || !ld?.marks) return null;
  const info = ld.marks;
  const st = l.style;
  const pts = ld.paths.filter((p) => p.kind === 'point' && p.props);
  const rows: LegendRow[] = [];
  const base = Math.min(ptToMm(st.sizePt), 3);
  const headRow = (text: string): LegendRow => ({ t: 'text', head: true, h: 1, text });
  const used = (field: string | undefined) => new Set(pts.map((p) => String(p.props?.[field ?? ''] ?? '').trim()));
  const sameField = !!pb.colorField && pb.colorField === pb.symbolField;
  const twoLists = !!pb.colorField && !!pb.symbolField && !sameField;
  if (pb.colorField && info.cats.length <= MAX_CATS) {
    const on = used(pb.colorField);
    const title = pb.title?.trim() || (twoLists ? pb.colorField : '');
    if (title) rows.push(headRow(title));
    for (const v of info.cats) {
      if (!on.has(v)) continue;
      // numbered markers are always circles
      const shape = pb.number ? 'circle' : sameField ? symShape(pb, info.syms, v) : st.symbol;
      rows.push({ t: 'dot', layer: l, shape, fill: catColour(pb, info.cats, v), opacity: markOpacity(l), stroke: st.stroke, strokePt: st.strokePt, dMm: base, h: 1, text: catLabel(pb, v) });
    }
  }
  if (pb.symbolField && !sameField && !pb.number && info.syms.length <= 4) {
    const on = used(pb.symbolField);
    if (twoLists || pb.title?.trim()) rows.push(headRow(pb.symbolField));
    for (const v of info.syms) {
      if (!on.has(v)) continue;
      rows.push({ t: 'dot', layer: l, shape: symShape(pb, info.syms, v), fill: pb.colorField ? '#8C8C8C' : st.fill, opacity: markOpacity(l), stroke: st.stroke, strokePt: st.strokePt, dMm: base, h: 1, text: v === '' ? 'No value' : v });
    }
  }
  if (pb.sizeField && !pb.number && info.domain && pb.sizeLegend !== false) {
    const vals = sizeKey(info.domain);
    const names = fmtKey(vals);
    const ds = vals.map((v) => ptToMm(sizeFor(pb, info.domain, v)));
    const wide = Math.max(5 * k, ...ds);
    const title = (pb.sizeTitle ?? pb.sizeField).trim();
    if (title) rows.push(headRow(title));
    // a key circle sits in a row tall enough for it; the circles share one centre line and the text starts after the widest
    vals.forEach((_, i) => rows.push({ t: 'dot', layer: l, shape: 'circle', fill: pb.colorField ? '#FFFFFF' : st.fill, opacity: markOpacity(l), stroke: st.stroke, strokePt: st.strokePt, dMm: ds[i], key: true, keyX: 1 + wide / 2, h: Math.max(1, (ds[i] + 0.9) / row), textX: 1 + wide + 1.6, text: names[i] }));
  }
  if (pb.number && !pb.colorField) {
    const num = pointLook(l, info, { [pb.numberField ?? '']: info.first }, 0);
    const range = pb.numberRange !== false && info.count > 1 && info.first !== info.last ? `${info.first}–${info.last} ` : '';
    const label = l.legendLabel?.trim() || l.name;
    rows.push({ t: 'dot', layer: l, shape: 'circle', fill: st.fill, opacity: markOpacity(l), stroke: st.stroke, strokePt: st.strokePt, dMm: num.dMm, num: num.num ?? '1', numMm: num.numMm, h: Math.max(1, (num.dMm + 0.9) / row), textX: 1 + Math.max(5 * k, num.dMm) + 1.6, keyX: 1 + Math.max(5 * k, num.dMm) / 2, text: `${range}${label}` });
  }
  return rows.length ? rows : null;
}

/** Row positions: every row of the usual height goes where legendLayout puts it; taller rows (size keys) push the rest down. */
export function legendPlan(lg: LegendItem, rows: LegendRow[]) {
  const n = rows.length;
  const lay = legendLayout(lg, n);
  const { row, top } = lay;
  const hs = rows.map((r) => r.h);
  const even = hs.every((h) => h === 1);
  let col: number[], y: number[];
  let cols = lay.cols, colW = lay.colW, fit = lay.fit;
  if (even) {
    col = rows.map((_, i) => Math.floor(i / lay.perCol));
    y = rows.map((_, i) => top + (i % lay.perCol) * row);
  } else {
    // a heading stays with the line after it: the two are placed as one block
    const blocks: number[][] = [];
    rows.forEach((r, i) => { if (r.head && i + 1 < n) blocks.push([i, i + 1]); else if (!(i > 0 && rows[i - 1].head)) blocks.push([i]); });
    const bh = blocks.map((b) => b.reduce((s, i) => s + hs[i] * row, 0));
    // without set columns the box grows to hold every line in one column (App.svelte fits it to `fit`)
    const cap = lg.cols ? splitCap(bh, lg.cols) : Infinity;
    const colOf: number[] = new Array(n), yOf: number[] = new Array(n);
    let c = 0, used = 0, tallest = 0;
    blocks.forEach((b, bi) => {
      if (used > 0 && used + bh[bi] > cap + 1e-6) { c++; used = 0; }
      let yy = top + used;
      for (const i of b) { colOf[i] = c; yOf[i] = yy; yy += hs[i] * row; }
      used += bh[bi];
      tallest = Math.max(tallest, used);
    });
    col = colOf; y = yOf;
    cols = c + 1;
    colW = lg.w / cols;
    // the box that holds every line in one column (as legendLayout's fit), or the tallest column when columns are set
    fit = lg.cols ? top + tallest + 1 : top + bh.reduce((s, v) => s + v, 0) + 1;
  }
  return { ...lay, cols, colW, fit, pos: rows.map((_, i) => ({ x: col[i] * colW, y: y[i] })) };
}

/** The smallest column height that lets the blocks fit in `cols` columns. */
function splitCap(heights: number[], cols: number): number {
  let lo = Math.max(0, ...heights), hi = heights.reduce((s, v) => s + v, 0);
  const fits = (cap: number) => { let c = 1, used = 0; for (const h of heights) { if (used > 0 && used + h > cap + 1e-6) { c++; used = 0; } used += h; } return c <= cols; };
  for (let i = 0; i < 24 && hi - lo > 0.01; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  return hi;
}

/** How wide the box must be: the widest line after its symbol (or a heading from the left edge), in every column. */
export function legendNeed(lg: LegendItem, rows: LegendRow[], textX: number): { entryW: number; widest: number } {
  const bold = lg.text?.bold ?? false;
  const hb = look(lg.titleText, TEXT.legendTitle).bold;
  let widest = textX + 10;
  let head = 0;
  for (const r of rows) {
    if (r.head) head = Math.max(head, 1 + textWidthMm(r.text, lg.labelPt, hb));
    else widest = Math.max(widest, (r.textX ?? textX) + textWidthMm(r.text, lg.labelPt, bold));
  }
  return { entryW: widest, widest: head };
}
