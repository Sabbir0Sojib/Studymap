// One-click map styles. Each sets colours for the built-in layers; user layers keep theirs.
//
// How the colours are chosen (so new styles can follow the same rules):
// - countries.fill is the land of the study country, countries.fill2 its neighbours (a little darker, so they step back).
// - Land is lighter than the sea by enough to read in greyscale print; neighbours stay clearly lighter than the sea too.
// - The study area is the strongest thing on the map: a colour-blind-safe hue (Okabe-Ito or a dark ColorBrewer hue),
//   an outline darker than its fill, and a fill that prints visibly darker than the land.
// - Borders, boundaries and rivers are at least about 3:1 against the land but quieter than the study outline.
// - Styles with relief: the figure veils everything outside the study area with 55% white while relief is on, so
//   their sea is a little stronger than in the flat styles to keep land and sea apart.
// - The inset colour is the study outline colour. Neutrals stay in one family (warm or cool) inside a style.
// - The detailed OpenStreetMap water and roads (added for small areas) follow the style too: water is a touch lighter than
//   the lakes with a river-blue edge, roads are a quiet light neutral of the style's own family. Black and white and High
//   contrast use true greys only.
import type { Doc, InsetItem, Layer, LayerKind, LayerStyle } from './store.svelte';

export interface Theme {
  id: string;
  name: string;
  /** colours shown on the theme's swatch, in order: land, water, area, line */
  swatch: [string, string, string, string];
  terrain: false | 'shade' | 'tint';
  styles: Partial<Record<LayerKind, Partial<LayerStyle>>>;
  inset: string;
  /** the automatic OpenStreetMap layers: water (fill and outline) and roads (line) */
  osm: Record<'water' | 'roads', Partial<LayerStyle>>;
}

/** OpenStreetMap water and roads for one style. The line weights are the ones those layers start with. */
const osmLook = (waterFill: string, waterLine: string, road: string): Theme['osm'] => ({
  water: { fill: waterFill, stroke: waterLine, strokePt: 0.6 },
  roads: { fill: 'none', stroke: road, strokePt: 0.45 },
});

export const THEMES: Theme[] = [
  // Classic: the default. Warm paper land, a clear pale-blue sea and a vermillion study area; suits most journals and screens.
  {
    id: 'classic', name: 'Classic', swatch: ['#FBFAF6', '#C5DDE9', '#A94700', '#84827E'], terrain: false, inset: '#A94700',
    styles: {
      sea: { fill: '#C5DDE9' },
      countries: { fill: '#FBFAF6', fill2: '#F0EEE8', stroke: '#84827E' },
      study: { fill: '#D55E00', fillOpacity: 0.32, stroke: '#A94700' },
      admin: { stroke: '#7E7C78' },
      subunits: { stroke: '#95938F' },
      disputed: { stroke: '#605E5A' },
      lakes: { fill: '#C5DDE9', stroke: '#5F8FA6' },
      rivers: { stroke: '#3D84A2' },
    },
    osm: osmLook('#CFE3EE', '#4F8FB3', '#B3A58F'),
  },
  // Terrain: shaded relief on cream land with a light vermillion tint, so hills show through the study area; for hilly or mountain sites.
  {
    id: 'terrain', name: 'Terrain', swatch: ['#F3F0EB', '#B8D3E1', '#A94700', '#797773'], terrain: 'shade', inset: '#A94700',
    styles: {
      sea: { fill: '#B8D3E1' },
      countries: { fill: '#F3F0EB', fill2: '#E7E4DD', stroke: '#797773' },
      study: { fill: '#D55E00', fillOpacity: 0.16, stroke: '#A94700' },
      admin: { stroke: '#797773' },
      subunits: { stroke: '#92908C' },
      disputed: { stroke: '#5B5955' },
      lakes: { fill: '#B8D3E1', stroke: '#5F8FA6' },
      rivers: { stroke: '#3D84A2' },
    },
    osm: osmLook('#C4DAE6', '#5090AB', '#B1A692'),
  },
  // Atlas: school-atlas look with elevation colours (green lowland to brown highland) and a deep burnt-orange outline; for regional maps where height matters.
  {
    id: 'atlas', name: 'Atlas', swatch: ['#F1F1E8', '#B7D3E4', '#8C2D04', '#797E72'], terrain: 'tint', inset: '#8C2D04',
    styles: {
      sea: { fill: '#B7D3E4' },
      countries: { fill: '#F1F1E8', fill2: '#E4E4DC', stroke: '#797E72' },
      // the elevation colours show through the area untouched (only the land around it is veiled), so the area needs just a trace of fill
      study: { fill: '#D94801', fillOpacity: 0.06, stroke: '#8C2D04' },
      admin: { stroke: '#74786F' },
      subunits: { stroke: '#93978D' },
      disputed: { stroke: '#575B51' },
      lakes: { fill: '#B7D3E4', stroke: '#518BA9' },
      rivers: { stroke: '#287FA5' },
    },
    osm: osmLook('#C3DAE9', '#3E8CAE', '#ACAFA8'),
  },
  // Soft grey: quiet cool greys with one blue accent; for slides, theses and screens where the map sits behind other content.
  {
    id: 'soft', name: 'Soft grey', swatch: ['#F6F8FA', '#D0DAE1', '#005C91', '#85898E'], terrain: false, inset: '#005C91',
    styles: {
      sea: { fill: '#D0DAE1' },
      countries: { fill: '#F6F8FA', fill2: '#EBEEF1', stroke: '#85898E' },
      study: { fill: '#0072B2', fillOpacity: 0.28, stroke: '#005C91' },
      admin: { stroke: '#787D81' },
      subunits: { stroke: '#979CA0' },
      disputed: { stroke: '#5F6468' },
      lakes: { fill: '#D0DAE1', stroke: '#788F9C' },
      rivers: { stroke: '#668394' },
    },
    osm: osmLook('#D8E0E6', '#758F9F', '#AEB2B6'),
  },
  // Black and white: true greys only, with relief shading; for journals that print in black and white.
  {
    id: 'mono', name: 'Black & white', swatch: ['#FFFFFF', '#D3D3D3', '#1B1B1B', '#595959'], terrain: 'shade', inset: '#1B1B1B',
    styles: {
      sea: { fill: '#D3D3D3' },
      countries: { fill: '#FFFFFF', fill2: '#F0F0F0', stroke: '#595959' },
      study: { fill: '#1B1B1B', fillOpacity: 0.24, stroke: '#1B1B1B' },
      admin: { stroke: '#686868' },
      subunits: { stroke: '#919191' },
      disputed: { stroke: '#424242' },
      lakes: { fill: '#D3D3D3', stroke: '#686868' },
      rivers: { stroke: '#6D6D6D' },
    },
    osm: osmLook('#DADADA', '#6D6D6D', '#8A8A8A'),
  },
  // Field green: green-tinged land, a teal-blue sea and a deep green study area with relief; for ecology, forestry and field-site papers.
  {
    id: 'forest', name: 'Field green', swatch: ['#F5F5EF', '#BBD3DA', '#00644B', '#81857B'], terrain: 'shade', inset: '#00644B',
    styles: {
      sea: { fill: '#BBD3DA' },
      countries: { fill: '#F5F5EF', fill2: '#EAEAE3', stroke: '#81857B' },
      study: { fill: '#009E73', fillOpacity: 0.2, stroke: '#00644B' },
      admin: { stroke: '#7B8076' },
      subunits: { stroke: '#989C94' },
      disputed: { stroke: '#5B6056' },
      lakes: { fill: '#BBD3DA', stroke: '#62909D' },
      rivers: { stroke: '#478499' },
    },
    osm: osmLook('#C7DAE0', '#5990A3', '#ACAEA8'),
  },
  // Journal grey: neutral greys with a single vermillion accent; the safest choice for any journal, it reads the same in colour and in greyscale print.
  {
    id: 'journal', name: 'Journal grey', swatch: ['#F6F6F6', '#D1D5D8', '#A94700', '#777777'], terrain: false, inset: '#A94700',
    styles: {
      sea: { fill: '#D1D5D8' },
      countries: { fill: '#F6F6F6', fill2: '#E9E9E9', stroke: '#777777' },
      study: { fill: '#D55E00', fillOpacity: 0.36, stroke: '#A94700' },
      admin: { stroke: '#727272' },
      subunits: { stroke: '#969696' },
      disputed: { stroke: '#505050' },
      lakes: { fill: '#D1D5D8', stroke: '#798993' },
      rivers: { stroke: '#667A86' },
    },
    osm: osmLook('#D9DCDF', '#758792', '#ABABAB'),
  },
  // Coastal blue: pale sand land and blue water in steps (sea, lighter lakes, deeper rivers) with a deep green-teal study area; for coastal, island and delta sites.
  {
    id: 'ocean', name: 'Coastal blue', swatch: ['#F6EEE0', '#B5D3E3', '#014D3F', '#887D6F'], terrain: false, inset: '#014D3F',
    styles: {
      sea: { fill: '#B5D3E3' },
      countries: { fill: '#F6EEE0', fill2: '#EAE2D3', stroke: '#887D6F' },
      study: { fill: '#009E73', fillOpacity: 0.4, stroke: '#014D3F' },
      admin: { stroke: '#7B7163' },
      subunits: { stroke: '#9E9488' },
      disputed: { stroke: '#5D5347' },
      lakes: { fill: '#C9E0EC', stroke: '#3D8DAD' },
      rivers: { stroke: '#00769D' },
    },
    osm: osmLook('#C9E0EC', '#1A84A7', '#B8AC98'),
  },
  // Earth tones: warm ochre and olive land, muted blue water and a deep red-brown study area with relief; for geology, soil and landscape papers.
  {
    id: 'earth', name: 'Earth tones', swatch: ['#F3E8D5', '#B2CBD3', '#7F2704', '#786B5F'], terrain: 'shade', inset: '#7F2704',
    styles: {
      sea: { fill: '#B2CBD3' },
      countries: { fill: '#F3E8D5', fill2: '#DFDDCC', stroke: '#786B5F' },
      study: { fill: '#A63603', fillOpacity: 0.26, stroke: '#7F2704' },
      admin: { stroke: '#706358' },
      subunits: { stroke: '#908479' },
      disputed: { stroke: '#55493E' },
      lakes: { fill: '#B2CBD3', stroke: '#597C89' },
      rivers: { stroke: '#366D7F' },
    },
    osm: osmLook('#BFD4DA', '#4A7C8C', '#B0A18D'),
  },
  // High contrast: white land, mid-grey sea, near-black lines and a dark study area; for small figures, thumbnails and black-and-white photocopies.
  {
    id: 'contrast', name: 'High contrast', swatch: ['#FFFFFF', '#C4C4C4', '#111111', '#262626'], terrain: false, inset: '#111111',
    styles: {
      sea: { fill: '#C4C4C4' },
      countries: { fill: '#FFFFFF', fill2: '#ECECEC', stroke: '#262626' },
      study: { fill: '#2B2B2B', fillOpacity: 0.42, stroke: '#111111' },
      admin: { stroke: '#3B3B3B' },
      subunits: { stroke: '#6A6A6A' },
      disputed: { stroke: '#262626' },
      lakes: { fill: '#C4C4C4', stroke: '#474747' },
      rivers: { stroke: '#555555' },
    },
    osm: osmLook('#CECECE', '#555555', '#787878'),
  },
  // Pastel: soft cream land, a powder-blue sea and a raspberry study area; friendly for posters and slides, and still readable in print.
  {
    id: 'pastel', name: 'Pastel', swatch: ['#FFFCF7', '#BEDCEC', '#A6366B', '#8A8590'], terrain: false, inset: '#A6366B',
    styles: {
      sea: { fill: '#BEDCEC' },
      countries: { fill: '#FFFCF7', fill2: '#F8F5F0', stroke: '#8A8590' },
      study: { fill: '#D6558D', fillOpacity: 0.3, stroke: '#A6366B' },
      admin: { stroke: '#8A8590' },
      subunits: { stroke: '#94909A' },
      disputed: { stroke: '#6B6670' },
      lakes: { fill: '#BEDCEC', stroke: '#5F93B2' },
      rivers: { stroke: '#4E8CB0' },
    },
    osm: osmLook('#CBE3F0', '#5F93B2', '#CFC9D2'),
  },
  // Vintage: warm ivory land, a blue-grey sea and a deep brick-red study area; an old-atlas look for theses and historical maps.
  {
    id: 'vintage', name: 'Vintage', swatch: ['#F3E7CB', '#B5C7CC', '#8A261C', '#7D6B55'], terrain: false, inset: '#8A261C',
    styles: {
      sea: { fill: '#B5C7CC' },
      countries: { fill: '#F3E7CB', fill2: '#EDE1C6', stroke: '#7D6B55' },
      study: { fill: '#A83A2A', fillOpacity: 0.3, stroke: '#8A261C' },
      admin: { stroke: '#7D6B55' },
      subunits: { stroke: '#917F66' },
      disputed: { stroke: '#5E4D3A' },
      lakes: { fill: '#B5C7CC', stroke: '#5E7E8A' },
      rivers: { stroke: '#4A6F7E' },
    },
    osm: osmLook('#C3D2D6', '#5E7E8A', '#C4B598'),
  },
];

/** The colours (and starting line weight) of the automatic OpenStreetMap water or roads layer in a map style. */
export function osmStyle(themeId: string, osmTheme: 'water' | 'roads'): Partial<LayerStyle> {
  const t = THEMES.find((x) => x.id === themeId) ?? THEMES[0];
  return { ...t.osm[osmTheme] };
}

/** The marker colour for a new locator: the colour of a locator already on the map (so a hand-picked colour carries on), else the map style's. */
export function insetColour(doc: Doc): string {
  const insets = doc.items.filter((i): i is InsetItem => i.kind === 'inset');
  const own = insets.find((i) => i.visible) ?? insets[0];
  return own?.extentColor || (THEMES.find((x) => x.id === doc.themeId) ?? THEMES[0]).inset;
}

/** Give an OpenStreetMap layer the colours of a map style. Only colours change: the line weight stays as it is. */
export function recolourOsm(l: Layer, themeId: string) {
  if (l.kind !== 'osm' || !l.osmTheme || l.osmTheme === 'places') return;
  const o = osmStyle(themeId, l.osmTheme);
  if (o.stroke) l.style.stroke = o.stroke;
  if (o.fill && o.fill !== 'none') l.style.fill = o.fill;
}

export function applyTheme(doc: Doc, id: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  doc.themeId = t.id;
  for (const l of doc.layers) {
    const s = t.styles[l.kind];
    if (s) Object.assign(l.style, s);
    recolourOsm(l, t.id);
    if (l.kind === 'terrain' && l.terrain) {
      l.visible = t.terrain !== false;
      l.terrain.tint = t.terrain === 'tint';
    }
  }
  for (const it of doc.items) { if (it.kind === 'inset') it.extentColor = t.inset; else if (it.kind === 'detail') it.boxColor = t.inset; }
}
