// Journal readiness checks for the current figure.
import { findPreset } from './journals';
import { store } from './store.svelte';
import type { Doc } from './store.svelte';
import type { MainScene } from './scene';
import { ptToMm } from './journals';
import { textWidthMm, wrapText } from './measure';
import { overlaps } from './placement';
import { rasterSize, maxDpi } from './export';
import { builtin, DEFAULT_FONT, fontLabel, fonts as fontState, fontsUsed, journalFamily } from './fonts.svelte';
import type { FontStyle } from './fonts.svelte';
import { look, TEXT } from './textstyle';
import { legendNeed, legendPlan, legendRows } from './legend';
import { lineCoords, lineKey, profileLayout, tableData, tableLayout } from './figparts';
import { detailZoom } from './figdraw';
import { frames } from './frames.svelte';
import { mapScale } from './scene';
import type { TextDefaults, TextStyle } from './textstyle';

export interface Finding {
  /** ok = passed, info = a reminder, warn = worth a look, error = a journal would reject it */
  level: 'ok' | 'info' | 'warn' | 'error';
  text: string;
  /** a one-click repair the checker can offer */
  fix?: { label: string; run: () => void };
  /** the part(s) on the page this is about, so the list can show them */
  ids?: string[];
}

/** Make every text on the figure at least `min` pt (labels, grid, legend, scale, locators, map names). */
export function raiseText(doc: Doc, min: number) {
  for (const it of doc.items as any[]) {
    if (typeof it.labelPt === 'number' && it.labelPt < min) it.labelPt = min;
    if (it.grid && it.grid.labelPt < min) it.grid.labelPt = min;
  }
  for (const l of doc.layers) if (l.style.labelPt < min) l.style.labelPt = min;
}

/** The font style (bold, italic, both) that each text on the figure asks for, with the font it is set in. */
function textAsks(doc: Doc): { font: string; style: FontStyle }[] {
  const base = doc.font || DEFAULT_FONT;
  const asks: { font: string; style: FontStyle }[] = [];
  const style = (bold: boolean, italic: boolean): FontStyle => (bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
  const ask = (t: TextStyle | undefined, d: TextDefaults, font = base) => { const l = look(t, d); asks.push({ font, style: style(l.bold, l.italic) }); };
  for (const it of doc.items) {
    if (!it.visible) continue;
    if (it.kind === 'title') asks.push({ font: it.font || base, style: style(it.bold, !!it.italic) });
    else if (it.kind === 'legend') { ask(it.text, TEXT.legend); if (it.title) ask(it.titleText, TEXT.legendTitle); }
    else if (it.kind === 'scale') ask(it.text, TEXT.scale);
    else if (it.kind === 'credits') ask(it.text, TEXT.credits);
    else if (it.kind === 'north') ask(it.text, TEXT.north);
    else if (it.kind === 'inset') { if (it.label) ask(it.text, TEXT.insetLabel); if (it.grid?.show) ask(it.grid.text, TEXT.grid); }
    else if (it.kind === 'detail') { if (it.label || it.scaleText) ask(it.text, TEXT.insetLabel); if (it.grid.show) ask(it.grid.text, TEXT.grid); }
    else if (it.kind === 'map' && it.grid.show) ask(it.grid.text, TEXT.grid);
  }
  for (const l of doc.layers) if (l.visible && l.style.labelField) ask(l.style.labelStyle, TEXT.layerLabel(l.kind));
  return asks;
}

export function checkFigure(doc: Doc, main: MainScene | null, scaleVariation: number | null, credits: string[] = []): Finding[] {
  const p = findPreset(doc.presetId);
  const out: Finding[] = [];
  const name = p.id === 'custom' ? 'this figure' : `${p.publisher} (${p.label.toLowerCase()})`;

  if (p.id !== 'custom' && Math.abs(doc.widthMm - p.widthMm) > 0.5) out.push({ level: 'warn', text: `Width is ${doc.widthMm} mm; ${p.publisher} expects ${p.widthMm} mm for ${p.label.toLowerCase()}.` });
  if (doc.heightMm > p.maxHeightMm) out.push({ level: 'error', text: `Height ${doc.heightMm} mm is over the ${p.maxHeightMm} mm limit.` });

  const fonts: { label: string; pt: number }[] = [];
  for (const it of doc.items) {
    if (!it.visible) continue;
    if (it.kind === 'map' && it.grid.show) fonts.push({ label: 'Grid labels', pt: it.grid.labelPt });
    if (it.kind === 'inset' && it.grid?.show) fonts.push({ label: 'Locator grid labels', pt: it.grid.labelPt });
    if (it.kind === 'detail' && it.grid.show) fonts.push({ label: 'Detail map grid labels', pt: it.grid.labelPt });
    if ('labelPt' in it && (it.kind !== 'detail' || it.label || it.scaleText)) fonts.push({ label: labelOf(it.kind), pt: it.labelPt });
  }
  for (const l of doc.layers) if (l.visible && l.style.labelField) fonts.push({ label: `${l.name} labels`, pt: l.style.labelPt });
  const small = fonts.filter((f) => f.pt < p.minFontPt);
  if (small.length) out.push({ level: 'error', text: `${small.map((s) => `${s.label} ${s.pt} pt`).join(', ')}: below the ${p.minFontPt} pt minimum.`, fix: { label: `Make all text ${p.minFontPt} pt or larger`, run: () => raiseText(doc, p.minFontPt) } });

  if (p.fonts?.length) {
    const off = fontsUsed(doc).filter((f) => !p.fonts!.includes(journalFamily(f)));
    if (off.length) {
      const names = p.fonts.map((f) => builtin(f)?.like.replace(' / ', ' or ') ?? f);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
      const to = p.fonts[0];
      out.push({ level: 'warn', text: `${p.publisher} asks for ${list} in figures; this map uses ${off.map(fontLabel).join(', ')}.`, fix: { label: `Use ${fontLabel(to)} for all text`, run: () => { doc.font = to; for (const it of doc.items) if (it.kind === 'title') it.font = undefined; } } });
    }
  }

  // A font the user added without its bold or italic file: the screen imitates the style, but PDF and PNG print it plain.
  const asks = textAsks(doc);
  for (const f of fontState.custom) {
    const lacking = (['bold', 'italic', 'bolditalic'] as FontStyle[]).filter((st) => !f.styles.includes(st) && asks.some((a) => a.font === f.family && a.style === st));
    if (!lacking.length) continue;
    const names = lacking.map((st) => (st === 'bolditalic' ? 'bold italic' : st));
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}` : names[0];
    out.push({ level: 'warn', text: `Your font ${f.family} has no ${list} file, but text on the figure asks for it. On screen the browser imitates it; the PDF and PNG print that text in a plainer style. Add the ${list} .ttf in Design, Text.` });
  }

  const thin = doc.layers.filter((l) => l.visible && l.style.stroke !== 'none' && l.style.strokePt > 0 && l.style.strokePt < p.minLinePt && l.kind !== 'sea');
  if (thin.length) out.push({ level: 'warn', text: `${thin.map((l) => l.name).join(', ')}: lines thinner than ${p.minLinePt} pt may vanish in print.` });

  if ((doc.exportFormat === 'tiff' || doc.exportFormat === 'png') && !rasterSize(doc.widthMm, doc.heightMm, doc.exportDpi).ok)
    out.push({ level: 'error', text: `${doc.exportDpi} dpi is too much for a ${doc.widthMm} × ${doc.heightMm} mm page in a browser. Use ${maxDpi(doc.widthMm, doc.heightMm)} dpi or less, or PDF.` });
  // each with a one-click repair, so a researcher never has to look up what the journal wants
  const okDpi = Math.min(p.minDpi, maxDpi(doc.widthMm, doc.heightMm));
  if ((doc.exportFormat === 'tiff' || doc.exportFormat === 'png') && doc.exportDpi < p.minDpi) out.push({ level: 'error', text: `${doc.exportDpi} dpi is below the ${p.minDpi} dpi ${p.publisher} asks for.`, fix: { label: `Use ${okDpi} dpi`, run: () => { doc.exportDpi = okDpi; } } });
  if (!p.formats.includes(doc.exportFormat)) {
    const to = p.formats[0];
    out.push({ level: 'warn', text: `${p.publisher} prefers ${p.formats.map((f) => f.toUpperCase()).join(' or ')} for figures. ${doc.exportFormat.toUpperCase()} is fine for slides, posters and the web.`, fix: { label: `Use ${to.toUpperCase()}`, run: () => { doc.exportFormat = to as typeof doc.exportFormat; } } });
  }

  if (main) {
    const isGeo = main.crs.geographic || main.crs.code === 'EPSG:3857';
    const scale = doc.items.find((i) => i.kind === 'scale' && i.visible);
    if (scale && scaleVariation != null && scaleVariation > 0.03) {
      out.push({ level: 'warn', text: `Scale changes ${(scaleVariation * 100).toFixed(0)}% from top to bottom in this projection, so the scale bar is only true at the centre. Choose an equal-area or UTM projection, or remove the scale bar.` });
    } else if (scale && isGeo) {
      out.push({ level: 'warn', text: `Scale bars are not exact in ${main.crs.name}. A UTM or local projection is better.` });
    }
    const credits = doc.items.find((i) => i.kind === 'credits' && i.visible);
    if (!credits) out.push({ level: 'info', text: 'Data credits are in the figure caption (Export). Paste it under the figure: the data licences ask for the credit.' });
  }
  for (const o of overlaps(doc, main)) out.push({ level: 'warn', text: o.text, ids: o.ids });
  // Text that no longer fits its box.
  const legend = doc.items.find((i) => i.kind === 'legend' && i.visible);
  if (legend && legend.kind === 'legend' && main) {
    // the same lines, rows and columns the figure draws (lib/legend: columns, swatch size, row spacing, colour classes, size keys)
    const rows = legendRows(doc, main, { terrain: false }, legend);
    const lay = legendPlan(legend, rows);
    const need = legendNeed(legend, rows, lay.textX);
    // the title runs across the whole box from 1 mm in (entries start after their swatch)
    const titleW = legend.title ? textWidthMm(legend.title, legend.labelPt * 1.1, legend.titleText?.bold ?? true) : 0;
    // the widest entry: the legend text of a layer measured as before, the lines of a layer styled by a table as they are written
    const widest = Math.max(0, ...rows.filter((r) => !r.head).map((r) => textWidthMm(r.text, legend.labelPt, !!legend.text?.bold) + (r.textX ?? lay.textX) - lay.textX));
    if (widest + lay.textX + 0.4 > lay.colW + 0.5 || need.widest + 1 > legend.w + 0.5 || titleW + 2 > legend.w + 0.5) out.push({ level: 'warn', text: 'Legend text is wider than the legend box. Make the box wider or taller, or shorten the labels.' });
  }
  const cr = doc.items.find((i) => i.kind === 'credits' && i.visible);
  if (cr && cr.kind === 'credits') {
    const lines = credits.flatMap((t) => wrapText(t, cr.labelPt, cr.w - 0.5, !!cr.text?.bold)).length;
    if (lines * ptToMm(cr.labelPt) * 1.25 > cr.h + 0.5) out.push({ level: 'warn', text: 'Credits run past their box. Make the box taller, or move the credits to the caption.' });
  }
  // The table of sites and the elevation profile: rows or columns that do not fit, a chart with no heights yet
  for (const it of doc.items) {
    if (!it.visible) continue;
    if (it.kind === 'table') {
      const d = tableData(it, doc, store.geoms);
      if (!d || !d.head.length) { out.push({ level: 'warn', text: 'The table of sites has no sample points or no columns to show. Choose them in its settings.', ids: [it.id] }); continue; }
      const lay = tableLayout(it, d);
      const fixBox = { label: 'Fit the box to the table', run: () => { it.fit = undefined; } };
      if (lay.shown < d.rows.length) out.push({ level: 'warn', text: `The table has more rows than fit its box: ${lay.shown} of ${d.rows.length} are shown. Make the box taller, the text smaller, or show fewer sites.`, ids: [it.id], fix: it.fit === false ? fixBox : undefined });
      else if (lay.squeezed) out.push({ level: 'warn', text: 'The table is narrower than its columns, so some words are cut short. Make the box wider or show fewer columns.', ids: [it.id], fix: fixBox });
    } else if (it.kind === 'profile') {
      const coords = lineCoords(it.line, store.geoms);
      if (!coords) out.push({ level: 'warn', text: 'The elevation profile has no line. Choose the line it follows in its settings.', ids: [it.id] });
      else if (!it.data || it.data.key !== lineKey(coords)) out.push({ level: 'warn', text: 'The elevation profile is still reading the ground height. Wait a moment before you export.', ids: [it.id] });
      else if (!profileLayout(it, it.data).ok) out.push({ level: 'warn', text: 'The elevation profile box is too small to hold a chart. Make it larger.', ids: [it.id] });
      else if (it.exag && !profileLayout(it, it.data).exagFits) out.push({ level: 'info', text: 'The elevation profile is too narrow for the vertical exaggeration text, so it is left off. Make the box wider, or switch that text off.', ids: [it.id] });
    }
  }
  // Detail maps: a zoom box that is not smaller than the main map's own view, or lines that something lies across
  const zooms = detailZoom(doc, main, frames.details);
  const mainScale = main ? mapScale(main.fp) : null;
  for (const it of doc.items) {
    if (it.kind !== 'detail' || !it.visible) continue;
    if (mainScale && it.scale >= mainScale * 0.98) out.push({ level: 'info', text: `${labelOf('detail')} is not closer than the main map (1:${Math.round(it.scale).toLocaleString('en-US')} against 1:${Math.round(mainScale).toLocaleString('en-US')}), so it shows no more than the main map does.`, ids: [it.id] });
    if (zooms.find((z) => z.id === it.id)?.blocked) out.push({ level: 'info', text: `The lines from the zoom box to the ${labelOf('detail').toLowerCase()} are left out because another part lies across them. Move that part, or switch the lines off.`, ids: [it.id] });
  }
  for (const it of doc.items) {
    if (!it.visible) continue;
    if (it.x < -0.01 || it.y < -0.01|| it.x + it.w > doc.widthMm + 0.01 || it.y + it.h > doc.heightMm + 0.01) {
      out.push({ level: 'warn', text: `${labelOf(it.kind)} sticks out of the figure and will be cut off.`, ids: [it.id], fix: { label: 'Move it back onto the page', run: () => {
        const W = doc.widthMm, H = doc.heightMm;
        if (it.w > 0 && it.w <= W) it.x = Math.min(Math.max(0, it.x), W - it.w);
        if (it.h > 0 && it.h <= H) it.y = Math.min(Math.max(0, it.y), H - it.h);
        it.pinned = true;
      } } });
    }
  }

  // Printed in black and white, two legend colours with nearly the same lightness merge into one grey.
  if (main) {
    const drawn = new Set(main.layers.filter((ld) => ld.paths.length).map((ld) => ld.layer.id));
    const keys = doc.layers
      .filter((l) => l.visible && l.inLegend && drawn.has(l.id) && l.kind !== 'terrain' && l.kind !== 'basemap')
      .map((l) => ({ name: l.legendLabel?.trim() || l.name, col: l.style.fill !== 'none' && l.style.fillOpacity > 0.15 ? l.style.fill : l.style.stroke, dash: l.style.dash }))
      .filter((k) => /^#[0-9a-f]{6}$/i.test(k.col));
    const merged: string[] = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = keys[i], b = keys[j];
      if (a.col.toLowerCase() === b.col.toLowerCase() || a.dash !== b.dash) continue; // same colour on purpose, or told apart by the dash
      if (Math.abs(lightness(a.col) - lightness(b.col)) < 7) merged.push(`${a.name} and ${b.name}`);
    }
    if (merged.length) out.push({ level: 'info', text: `Printed in black and white, ${merged.slice(0, 2).join('; ')} look the same grey. Preview it with "Printed in black and white" (Journal check), and change one colour or use a dashed line if the journal prints in grey.` });
  }

  const grid = doc.items.find((i) => i.kind === 'map');
  const north = doc.items.find((i) => i.kind === 'north' && i.visible);
  if (grid && grid.kind === 'map' && !grid.grid.show && !north) out.push({ level: 'warn', text: 'Add a coordinate grid or a north arrow so readers know orientation.' });

  if (!out.some((f) => f.level === 'warn' || f.level === 'error')) out.unshift({ level: 'ok', text: `Ready for ${name}.` });
  return out;
}

/** CIE lightness L* (0–100) of a #rrggbb colour: what is left of it on a black-and-white print. */
function lightness(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

function labelOf(kind: string): string {
  return ({ 'Main map': 'Main map', map: 'Main map', north: 'North arrow', inset: 'Inset', detail: 'Detail map', scale: 'Scale bar', legend: 'Legend', credits: 'Credits', title: 'Title', table: 'Table of sites', profile: 'Elevation profile' } as Record<string, string>)[kind] ?? kind;
}
