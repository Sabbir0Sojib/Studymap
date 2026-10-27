// Text measurement in mm using the real map font, for wrapping and layout.
import { ptToMm } from './journals';
import { fonts, fontStack } from './fonts.svelte';

let ctx: CanvasRenderingContext2D | null = null;
let lastFont = '';
// map labels are measured again on every rebuild of the map, so widths are kept (per font, at 100 px)
const cache = new Map<string, number>();
let cacheTick = -1;

export function textWidthMm(text: string, pt: number, bold = false, family?: string): number {
  const tick = fonts.tick; // measure again once a font has loaded
  if (tick !== cacheTick) { cache.clear(); cacheTick = tick; }
  const font = `${bold ? 700 : 400} 100px ${fontStack(family ?? fonts.current)}`;
  const key = font + '|' + text;
  let w = cache.get(key);
  if (w === undefined) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return text.length * ptToMm(pt) * 0.55;
    if (font !== lastFont) { ctx.font = font; lastFont = font; }
    w = ctx.measureText(text).width / 100;
    if (cache.size > 5000) cache.clear();
    cache.set(key, w);
  }
  return w * ptToMm(pt);
}

export function wrapText(text: string, pt: number, maxMm: number, bold = false, family?: string): string[] {
  // a line break typed by the user always starts a new line
  if (text.includes('\n')) return text.split('\n').flatMap((p) => (p.trim() ? wrapText(p, pt, maxMm, bold, family) : ['']));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (line && textWidthMm(test, pt, bold, family) > maxMm) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}
