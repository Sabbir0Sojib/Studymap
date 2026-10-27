// Colour palettes for the colour picker, and the "recent colours" memory shared by the whole app.

export interface PaletteColour { hex: string; name?: string }
export interface Palette { name: string; colours: PaletteColour[] }

/** The rows of swatches in the colour picker. Every hex is uppercase '#RRGGBB'. ("Recent" is added by the picker.) */
export const PALETTES: Palette[] = [
  {
    // Okabe and Ito: eight colours that stay apart for people with the common kinds of colour blindness
    name: 'Colour-blind safe',
    colours: [
      { hex: '#E69F00', name: 'Orange' },
      { hex: '#56B4E9', name: 'Sky blue' },
      { hex: '#009E73', name: 'Bluish green' },
      { hex: '#F0E442', name: 'Yellow' },
      { hex: '#0072B2', name: 'Blue' },
      { hex: '#D55E00', name: 'Vermillion' },
      { hex: '#CC79A7', name: 'Reddish purple' },
      { hex: '#000000', name: 'Black' },
    ],
  },
  {
    // paper, land, water and the greys a map is drawn in
    name: 'Map tones',
    colours: [
      { hex: '#FFFFFF', name: 'White' },
      { hex: '#FBFAF6', name: 'Paper' },
      { hex: '#F4F3EE', name: 'Land' },
      { hex: '#E8E6DE', name: 'Stone' },
      { hex: '#DCEAF1', name: 'Pale water' },
      { hex: '#BFD9EA', name: 'Water' },
      { hex: '#A3A3A0', name: 'Silver' },
      { hex: '#6B6B66', name: 'Mid grey' },
      { hex: '#3A403D', name: 'Charcoal' },
      { hex: '#1B1F1D', name: 'Near black' },
    ],
  },
  {
    // ColorBrewer Dark2
    name: 'Strong',
    colours: [
      { hex: '#1B9E77', name: 'Teal green' },
      { hex: '#D95F02', name: 'Burnt orange' },
      { hex: '#7570B3', name: 'Slate purple' },
      { hex: '#E7298A', name: 'Magenta' },
      { hex: '#66A61E', name: 'Leaf green' },
      { hex: '#E6AB02', name: 'Mustard' },
      { hex: '#A6761D', name: 'Ochre brown' },
      { hex: '#666666', name: 'Dark grey' },
    ],
  },
  {
    // ColorBrewer Set2
    name: 'Soft',
    colours: [
      { hex: '#66C2A5', name: 'Soft teal' },
      { hex: '#FC8D62', name: 'Salmon' },
      { hex: '#8DA0CB', name: 'Periwinkle' },
      { hex: '#E78AC3', name: 'Orchid pink' },
      { hex: '#A6D854', name: 'Lime' },
      { hex: '#FFD92F', name: 'Sunflower' },
      { hex: '#E5C494', name: 'Sand' },
      { hex: '#B3B3B3', name: 'Light grey' },
    ],
  },
];

const NAMES = new Map<string, string>();
for (const p of PALETTES) for (const c of p.colours) if (c.name) NAMES.set(c.hex, c.name);

/** '#abc', 'abc', '#aabbcc' or 'AABBCC' (spaces around are fine) become '#AABBCC'. Anything else gives null. */
export function normalizeHex(input: string | null | undefined): string | null {
  const s = String(input ?? '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) return '#' + s.replace(/./g, (c) => c + c).toUpperCase();
  return /^[0-9a-f]{6}$/i.test(s) ? '#' + s.toUpperCase() : null;
}

/** The plain name of a colour in the palettes ('Vermillion' for #D55E00), if it has one. */
export function colourName(hex: string): string | undefined {
  const h = normalizeHex(hex);
  return h ? NAMES.get(h) : undefined;
}

/** How light a colour looks, from 0 (black) to 1 (white): the WCAG relative luminance. */
export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  if (!h) return 0.5;
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Recent colours: the last few picked anywhere in the app, kept in this browser.
const RECENT_KEY = 'studymap.recentColours';
const RECENT_MAX = 8;
// A copy in memory, so "Recent" still works for this visit when the browser will not keep anything.
let remembered: string[] = [];

function tidy(list: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(list)) {
    for (const x of list) {
      const h = typeof x === 'string' ? normalizeHex(x) : null;
      if (h && !out.includes(h)) out.push(h);
    }
  }
  return out.slice(0, RECENT_MAX);
}

/** The last colours picked, newest first, as uppercase '#RRGGBB' (at most 8). */
export function recentColours(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) remembered = tidy(JSON.parse(raw));
  } catch { /* storage is blocked or the saved text is damaged: the copy in memory is used */ }
  return [...remembered];
}

/** Remember a colour as the newest recent one. Anything that is not a colour (such as 'none') is ignored. */
export function pushRecent(hex: string): void {
  const h = normalizeHex(hex);
  if (!h) return;
  remembered = [h, ...recentColours().filter((c) => c !== h)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(remembered)); } catch { /* kept for this visit only */ }
}
