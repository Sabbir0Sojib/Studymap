// One way to style any text on the figure: bold, italic and colour. Each kind of text keeps its own defaults
// (neighbour names are grey italic, the legend title is bold...), so a value left unset keeps that look.
import type { LayerKind } from './store.svelte';
import { ptToMm } from './journals';

export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface TextDefaults { bold?: boolean; italic?: boolean; color: string }

/** SVG text attributes for a style over its defaults. */
export function look(t: TextStyle | undefined, d: TextDefaults) {
  const bold = t?.bold ?? !!d.bold;
  const italic = t?.italic ?? !!d.italic;
  return { bold, italic, weight: bold ? 700 : 400, style: italic ? 'italic' : 'normal', fill: t?.color || d.color, custom: !!t?.color };
}

/** What each kind of text looked like before it could be styled; still the defaults. */
export const TEXT = {
  layerLabel: (kind: LayerKind): TextDefaults => (kind === 'countries' || kind === 'admin' ? { italic: true, color: '#6B6B66' } : { color: '#2D3330' }),
  grid: { color: '#1B1F1D' } as TextDefaults,
  insetLabel: { color: '#1B1F1D' } as TextDefaults,
  north: { bold: true, color: '#1B1F1D' } as TextDefaults,
  scale: { color: '#1B1F1D' } as TextDefaults,
  legendTitle: { bold: true, color: '#1B1F1D' } as TextDefaults,
  legend: { color: '#1B1F1D' } as TextDefaults,
  credits: { color: '#3A403D' } as TextDefaults,
};

/** The text as drawn: a text part set in capitals shows every letter as a capital while the typed text stays as it is. */
export const shownText = (t: { text: string; upper?: boolean }): string => (t.upper ? t.text.toUpperCase() : t.text);

/**
 * Rows, columns and spacing of a legend box. The figure, the journal check and the box-fitting in App.svelte all use
 * this, so they agree. `n` is the number of entries; with `cols` unset the columns follow the box height, as before.
 * `fit` is the height that holds every entry (the `need` in App.svelte).
 */
export function legendLayout(lg: { labelPt: number; title: string; w: number; h: number; cols?: number; rowGap?: number; symbolSize?: number }, n: number) {
  const fs = ptToMm(lg.labelPt);
  const k = lg.symbolSize ?? 1;
  // a larger swatch makes the row taller; at the usual size the row is what it always was
  const row = Math.max(fs * 1.55, 3.4, k === 1 ? 0 : 2.6 * k + 0.8) * (lg.rowGap ?? 1);
  const top = lg.title ? fs * 1.1 + 1.6 : 1;
  const perCol = lg.cols ? Math.max(1, Math.ceil(n / lg.cols)) : Math.max(1, Math.floor((lg.h - top) / row));
  const cols = Math.max(1, Math.ceil(n / perCol));
  return { fs, k, row, top, perCol, cols, colW: lg.w / cols, textX: 1 + 5 * k + 1.6, fit: top + (lg.cols ? perCol : n) * row + 1 };
}
