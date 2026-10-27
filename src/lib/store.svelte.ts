// Document model, selection, undo/redo and autosave.
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { CrsOption } from './projection';
import type { LabelFormat } from './carto';
import { findPreset } from './journals';
import type { TextStyle } from './textstyle';
import { applyTheme } from './themes';

export type LayerKind = 'sea' | 'countries' | 'admin' | 'study' | 'rivers' | 'lakes' | 'disputed' | 'points' | 'vector' | 'osm' | 'terrain' | 'subunits' | 'basemap';

export interface LayerStyle {
  fill: string;
  /** second fill, used for countries other than the study country */
  fill2?: string;
  fillOpacity: number;
  stroke: string;
  strokePt: number;
  dash: boolean;
  symbol: 'circle' | 'triangle' | 'square' | 'diamond';
  sizePt: number;
  labelField: string; // '' = no labels
  labelPt: number;
  /** bold, italic and colour of the names this layer prints on the map */
  labelStyle?: TextStyle;
  /** false takes the halo (an outline round the letters) off the names; unset keeps the automatic one */
  labelHalo?: boolean;
  /** colour of that halo; unset = white, or dark behind light names */
  labelHaloColor?: string;
  /** extra space between the letters of the names, in em (spaced capitals for area names); unset = none */
  labelSpacing?: number;
  /** points drawn in a file or by hand (a vector layer): how solid their symbols are, 0–1; unset = fully solid (the fill opacity is for the areas) */
  symbolOpacity?: number;
  /** study area: diagonal hatching instead of a flat fill */
  hatch?: boolean;
  /** study area made of several units: give each its own colour and legend entry */
  byUnit?: boolean;
}

export interface Layer {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  inLegend: boolean;
  legendLabel: string;
  style: LayerStyle;
  source?: string; // credit line
  osmTheme?: 'water' | 'roads' | 'places';
  osmBBox?: [[number, number], [number, number]];
  /** auto: hidden by itself on flat ground, where relief shading is only noise */
  terrain?: { tint: boolean; exaggeration: number; azimuth: number; opacity: number; auto?: boolean };
  /** layer added by the app for small areas; removed again when it no longer applies */
  auto?: boolean;
  /** boundaries layer: geoBoundaries level drawn (1 division/state, 2 district...); unset = chosen automatically */
  adminLevel?: number;
  /** base map image: which one, where it shows (everywhere, only inside or only outside the study area), strength */
  basemap?: { id: 's2cloudless' | 'viirs' | 'modis' | 'hls'; clip: 'all' | 'inside' | 'outside'; opacity: number; /** the day shown, for the daily NASA pictures (YYYY-MM-DD) */ date?: string };
  /** a layer the user draws by hand (points, lines, areas) */
  custom?: boolean;
  /** names printed on the map, changed by the user: original name -> new text ('' hides that name) */
  labelText?: Record<string, string>;
  /** one feature styled on its own, picked by clicking it on the map: feature name -> its own look */
  featureStyle?: Record<string, FeatureStyle>;
  /** contour lines traced from the elevation data: interval in metres (0 = chosen from the relief); shown = the one in use */
  contour?: { interval: number; shown?: number };
  /** points (a points layer, or points in a file): look decided by the columns of the table (colour, symbol, size, numbers) */
  pointsBy?: PointsBy;
  /** areas (sub-areas, official boundaries) coloured from a table of values: a choropleth */
  choro?: ChoroConfig;
}

/** Points styled by a column of their table, as in QGIS "Categorized" and "Proportional symbols". Everything unset = one look for all. */
export interface PointsBy {
  /** colour each site by this column: every different value gets a colour (at most 10 values) and its own legend line */
  colorField?: string;
  /** a value's own colour and legend text (unset = from the colour-blind-safe set, and the value itself) */
  cats?: Record<string, { color?: string; label?: string }>;
  /** heading above the colour entries in the legend (unset = none) */
  title?: string;
  /** give each value of this column its own symbol (at most 4 values) */
  symbolField?: string;
  /** a value's own symbol (unset = by order: circle, triangle, square, diamond) */
  symbols?: Record<string, LayerStyle['symbol']>;
  /** size each site by this number column: smallest and largest symbol (pt), and how the area follows the number */
  sizeField?: string;
  sizeMin?: number;
  sizeMax?: number;
  sizeScale?: 'linear' | 'sqrt';
  /** false leaves the size key out of the legend; sizeTitle is its heading (unset = the column name) */
  sizeLegend?: boolean;
  sizeTitle?: string;
  /** a number inside each marker: its position in the table, or a column (unset = none) */
  number?: 'order' | 'column';
  numberField?: string;
  /** size of that number in pt (unset = 6) */
  numberPt?: number;
  /** false leaves "1–8" off the front of the legend text of numbered markers */
  numberRange?: boolean;
}

/** A table of values that colours the areas of a layer by their name. The colours are worked out when drawing, never stored on the areas. */
export interface ChoroConfig {
  /** the table as pasted or opened: the first row of headers, then one row per area */
  table: { head: string[]; rows: string[][] };
  /** the table column that holds the area names, and the one that holds the values */
  nameCol: string;
  field: string;
  /** names the program could not match by itself: the table's name -> the area chosen for it ('' = none) */
  fix?: Record<string, string>;
  /** how the values are grouped: equal intervals, quantiles, natural breaks (Jenks), limits typed in, or one colour per value */
  method: 'equal' | 'quantile' | 'jenks' | 'custom' | 'categories';
  /** number of classes, 3 to 7 */
  classes: number;
  palette: 'viridis' | 'blues' | 'greens' | 'oranges' | 'diverging';
  reverse?: boolean;
  /** the limits typed in, lowest to highest (method 'custom') */
  breaks?: number[];
  /** heading of the legend entries (unset = the value column's name) */
  title?: string;
  /** colour strength, 0 to 1 (unset = 1) */
  opacity?: number;
  /** for 'categories': a value's own colour and legend text */
  cats?: Record<string, { color?: string; label?: string }>;
  /** areas with no value: legend text (unset = "No data"), and false takes the hatching off their grey */
  noDataLabel?: string;
  noDataHatch?: boolean;
}

/** The look of one area, line or point that differs from its layer's (unset = as the layer). */
export interface FeatureStyle {
  fill?: string;
  stroke?: string;
  /** not drawn at all */
  hidden?: boolean;
  /** its name moved by hand (mm on the map, from where it was placed automatically) */
  labelDx?: number;
  labelDy?: number;
  /** a moved name has a thin line back to its place (a callout) unless this is false */
  leader?: boolean;
}

export type ItemKind = 'map' | 'detail' | 'inset' | 'north' | 'scale' | 'legend' | 'credits' | 'title' | 'shape' | 'image' | 'table' | 'profile';

export interface ItemBase {
  id: string;
  kind: ItemKind;
  x: number; y: number; w: number; h: number; // mm
  visible: boolean;
  /** placed by hand: automatic placement leaves it alone */
  pinned?: boolean;
  /** locked: cannot be moved or resized on the page (as in the QGIS Items panel) */
  locked?: boolean;
  /** its box: background, border, rounding, see-through, turn (any part but the main map) */
  look?: BoxLook;
  /** parts grouped together (Ctrl+G) share this id: picked, moved and aligned as one */
  group?: string;
}

/** The box round any page part, as in a layout program's item properties (unset = none, as before). */
export interface BoxLook {
  bg?: string;
  /** 0–1, unset = 1 */
  bgOpacity?: number;
  border?: string;
  borderPt?: number;
  /** corner rounding, mm */
  radius?: number;
  /** room between the part and its background or border, mm */
  pad?: number;
  /** the whole part, 0–1, unset = 1 */
  opacity?: number;
  /** degrees clockwise about its centre */
  rotate?: number;
}

export interface MapItem extends ItemBase {
  kind: 'map';
  /** sides: 'two' labels the left and bottom edges only (cleaner), 'all' labels all four */
  grid: {
    show: boolean; lines: boolean; step: number | 'auto'; format: LabelFormat; labelPt: number; lineColor: string; sides?: 'two' | 'all';
    /** QGIS-style options (unset = defaults in grid.ts) */
    type?: 'lines' | 'crosses' | 'frame';
    units?: 'degrees' | 'metres';
    stepM?: number | 'auto';
    linePt?: number;
    dash?: boolean;
    frame?: 'none' | 'zebra' | 'ticks-out' | 'ticks-in' | 'ticks-both' | 'line';
    frameSize?: number;
    gap?: number;
    ann?: Record<'left' | 'right' | 'top' | 'bottom', { show: 'all' | 'lat' | 'lon' | 'none'; pos: 'out' | 'in'; dir: 'h' | 'v' }>;
    /** bold, italic and colour of the coordinate labels */
    text?: TextStyle;
  };
  /** map rotation in degrees, clockwise */
  rotation?: number;
  framePt: number;
  /** colour of the frame line; unset = near-black */
  frameColor?: string;
  /** what is drawn round the study area: everything (unset), faded behind a white veil, or nothing (the area alone) */
  around?: 'fade' | 'hide';
}
/**
 * A second map frame on the page: the same layers and styles as the main map (one layer list for the whole figure), in the same
 * projection, at its own place and scale. It is a zoomed-in detail of the study area (a town, a cluster of sites) with a zoom box
 * on the main map, or one more panel of the same area. Its ground is the point at the middle of its frame and its printed scale,
 * so resizing the frame shows more or less ground at the same scale, as a map item of a layout program does.
 */
export interface DetailItem extends ItemBase {
  kind: 'detail';
  /** the ground at the middle of its frame, longitude and latitude */
  centre: [number, number];
  /** its printed scale, 1 : scale (the number of the scale box) */
  scale: number;
  /** its own coordinate grid, with the same options as the main map (off until switched on) */
  grid: MapItem['grid'];
  framePt: number;
  /** colour of its frame line; unset = near-black */
  frameColor?: string;
  /** panel letter or caption inside the frame, e.g. "(b)"; '' = none */
  label: string;
  labelPt: number;
  /** bold, italic and colour of its label */
  text?: TextStyle;
  /** "1:50,000" written in a corner of the frame */
  scaleText?: boolean;
  /** the zoom box that marks this frame on the main map (colour, line width pt, fill strength 0-1) and the lines from it to this frame */
  showBox: boolean;
  boxColor: string;
  boxPt?: number;
  boxFill?: number;
  connect: boolean;
  connectPt?: number;
  connectDash?: boolean;
}
export interface InsetItem extends ItemBase {
  kind: 'inset';
  /** parent: the official unit around the study area (its district or division), as in drill-down figures */
  context: 'country' | 'globe' | 'region' | 'parent';
  /** for context 'parent': the level of that unit (1 division/state, 2 district...) */
  frameLevel?: number;
  /** the locator's own zoom (1 = fitted) and pan (mm), like the main map */
  zoom?: number;
  panX?: number;
  panY?: number;
  /** coordinate grid with the same options as the main map (not for the globe) */
  grid?: MapItem['grid'];
  framePt?: number;
  /** colour of its frame line; unset = near-black */
  frameColor?: string;
  /** line width (pt) and fill strength (0–1) of the zoom box that marks the main map; unset = 0.8 pt and 0.07 */
  extentPt?: number;
  extentFill?: number;
  /** width (pt) of the zoom lines and whether they are dashed; unset = 0.5 pt, solid */
  connectPt?: number;
  connectDash?: boolean;
  /** colours: sea, land, the country or district it shows, boundary lines */
  colours?: { sea?: string; land?: string; focus?: string; lines?: string };
  showExtent: boolean;
  extentColor: string;
  label: string;
  labelPt: number;
  /** bold, italic and colour of its label */
  text?: TextStyle;
  /** draw lines from the extent box to the main map's corners */
  connect?: boolean;
  /** id of another locator whose ground this one outlines instead of the main map's (drill-down: (a) marks (b)) */
  marks?: string;
  /** boundaries drawn inside a country locator: 0 none, 1 division/state, 2 district...; unset = same as the main map */
  adminLevel?: number;
}
export interface NorthItem extends ItemBase {
  kind: 'north'; style: 'arrow' | 'star' | 'simple' | 'compass' | 'rose'; trueNorth: boolean; backdrop?: boolean;
  /** the N (and E, S, W) letters */
  text?: TextStyle;
  /** the dark parts of the arrow; unset = near-black */
  color?: string;
  /** true leaves the letters (N, and E, S, W on a rose) off */
  hideN?: boolean;
  /** letter size, times the automatic size; unset = 1 */
  nSize?: number;
}
export interface ScaleItem extends ItemBase {
  kind: 'scale'; units: 'metric' | 'imperial'; segments: number;
  /** blocks (alternating), line, ticks, double (two rows of blocks), hollow (outlined blocks) */
  style: 'alternating' | 'line' | 'ticks' | 'double' | 'hollow';
  /** numbers above (default) or below the bar */
  labelPos?: 'above' | 'below';
  labelPt: number; backdrop?: boolean; ratio?: 'none' | 'cm' | 'fraction';
  /** its numbers and unit */
  text?: TextStyle;
  /** colour of the dark blocks and of the bar's lines, and of the light blocks; unset = near-black and white */
  barDark?: string;
  barLight?: string;
  /** bar height, mm; unset = from the box height */
  barH?: number;
  /** the unit as written ("kilometres"); unset = km, m or mi */
  unitText?: string;
  /** the detail map (its id) this bar measures; unset = the main map */
  of?: string;
}
export interface LegendItem extends ItemBase {
  kind: 'legend'; title: string; labelPt: number; frame: boolean;
  /** entry text */
  text?: TextStyle;
  /** title text (bold unless changed) */
  titleText?: TextStyle;
  /** number of columns; unset = as many as the box height needs */
  cols?: 1 | 2 | 3;
  /** the colour swatch, times its usual size; unset = 1 */
  symbolSize?: number;
  /** space between the entries, times the usual; unset = 1 */
  rowGap?: number;
  /** where the title sits; unset = left */
  titleAlign?: 'start' | 'middle';
}
export interface CreditsItem extends ItemBase {
  kind: 'credits'; labelPt: number; showProjection: boolean; showDisclaimer: boolean; extra: string; text?: TextStyle;
  /** text alignment in its box; unset = left */
  align?: 'start' | 'middle' | 'end';
}
/** Any text on the page: titles, panel letters, notes. */
export interface TitleItem extends ItemBase {
  kind: 'title'; text: string; labelPt: number; bold: boolean; italic?: boolean; color?: string; align?: 'start' | 'middle' | 'end';
  /** its own font; empty = the map's font */
  font?: string;
  /** the box grows sideways with the text (until it reaches the page edge); off once the width is set by hand */
  autoW?: boolean;
  /** made by a layout: its title line or its (c) panel letter */
  role?: 'title' | 'letter';
  /** distance between lines, times the letter size; unset = 1.25 */
  lineGap?: number;
  /** a halo (an outline round the letters, for text over a map): its colour, and its width in pt (unset = 0.22 of the letter size); unset colour = none */
  halo?: string;
  haloPt?: number;
  /** shown in capital letters; the text itself stays as typed */
  upper?: boolean;
}
export interface ShapeItem extends ItemBase {
  kind: 'shape'; shape: 'rect' | 'ellipse' | 'line' | 'arrow'; stroke: string; strokePt: number; fill: string; fillOpacity: number; dash: boolean;
  /** dashed or dotted (with dash on); unset = dashed */
  dashStyle?: 'dash' | 'dot';
  /** arrow heads: at the end (default), both ends or the start */
  heads?: 'end' | 'both' | 'start';
  /** arrow head size, times the default */
  headSize?: number;
  /** open (two strokes) or filled (default) arrow head */
  headStyle?: 'filled' | 'open';
  /** rectangle corner rounding, mm */
  radius?: number;
}

/** A picture placed on the page: a logo, a photo of the site, a chart. */
export interface ImageItem extends ItemBase { kind: 'image'; href: string; fit: 'contain' | 'cover'; frame: boolean }

/** A table of the sample sites of a points layer, set on the page like a legend (lib/figparts.ts draws and measures it). */
export interface TableItem extends ItemBase {
  kind: 'table';
  /** the points layer whose sites are listed (its id) */
  layer: string;
  /** the columns shown, left to right: '#no' (the numbers on the markers), '#lat', '#lon', or a column of the table */
  cols: string[];
  /** latitude and longitude written as 23°45′12″N or as 23.7534°N */
  coord: 'dms' | 'dec';
  labelPt: number;
  /** a light grey band on every second row */
  zebra: boolean;
  /** a hairline round the table */
  frame: boolean;
  /** a caption line above the table ('' = none) */
  title: string;
  /** the rows' text (the header row is always bold) */
  text?: TextStyle;
  /** false once the box was sized by hand: it then no longer follows the size of the table */
  fit?: boolean;
}

/** The ground height along a line, sampled from the terrain tiles: distance (km) and height (m) at evenly spaced points. */
export interface ProfileData { key: string; z: number; lenKm: number; km: number[]; m: number[] }

/** A small line chart of the ground height along a line drawn on the map (as the Elevation Profile of QGIS). */
export interface ProfileItem extends ItemBase {
  kind: 'profile';
  /** the line: "layerId|n", n being the shape's place in its layer */
  line: string;
  /** line colour, and the fill under it (unset = the line colour) with its strength 0–1 (unset = 0.22, 0 = no fill) */
  color: string;
  fill?: string;
  fillOpacity?: number;
  /** line width, pt (unset = 0.8) */
  linePt?: number;
  labelPt: number;
  /** "A" and "B" over the two ends of the chart, and at the line's ends on the map */
  ends: boolean;
  /** the lowest and the highest point marked and written */
  extremes: boolean;
  /** "Vertical exaggeration 24×" written on the chart */
  exag: boolean;
  /** false leaves the axis titles ("Distance (km)", "Elevation (m)") off, and false takes the light grid lines off (unset = on) */
  axisTitles?: boolean;
  grid?: boolean;
  text?: TextStyle;
  /** the sampled heights, kept with the part so a saved map and its export never wait for the network */
  data?: ProfileData;
}

export type Item = MapItem | DetailItem | InsetItem | NorthItem | ScaleItem | LegendItem | CreditsItem | TitleItem | ShapeItem | ImageItem | TableItem | ProfileItem;

export type StudySource = 'none' | 'place' | 'drawn' | 'admin' | 'layer';

export interface StudySelection {
  /** where the area comes from; 'none' means no place chosen yet */
  source: StudySource;
  /** short name shown in the app and used for file names */
  name: string;
  /** whether the area is highlighted on the map (a map of a city can also be shown plain) */
  highlight: boolean;
  /** country the area is in, for country insets and admin boundaries */
  iso: string;
  countryName: string;
  /** admin mode */
  level: number; // 0 = whole country
  unitIds: string[];
  unitNames: string[];
  /** layer mode: the uploaded file, and optionally only some of its features (by a name field) */
  fromLayer?: string;
  within?: string; // a drawn area keeps the place it was drawn inside as context
  /** several areas shown together: true = one merged outline (shared borders removed) */
  merge?: boolean;
  field?: string;
  values?: string[];
  /** place mode: OpenStreetMap object, e.g. "R1234" */
  osm?: string;
}

export interface Doc {
  version: 2;
  title: string;
  presetId: string;
  templateId: string;
  themeId: string;
  widthMm: number;
  heightMm: number;
  study: StudySelection;
  crs: CrsOption | null; // null = automatic
  /** extent: a lon/lat box the frame is fitted to instead of the area (kept when you draw, so the map does not jump) */
  view: { padding: number; panX: number; panY: number; zoom: number; extent?: [[number, number], [number, number]] };
  /** font for all text on the figure (see lib/fonts) */
  font: string;
  /** page background: a colour, or "none" for a see-through PNG/SVG (default white) */
  pageColor?: string;
  layers: Layer[]; // bottom to top
  items: Item[];
  exportDpi: number;
  exportFormat: 'pdf' | 'svg' | 'tiff' | 'png';
  /** set once the v0.8 "clean by default" look has been applied */
  clean?: boolean;
  /** file name for exports, without extension; empty = made from the title, size and dpi */
  exportName?: string;
  /** the area the file name was typed for (another area uses the automatic name again) */
  exportNameFor?: string;
  /** the user removed the automatic OpenStreetMap detail: do not add it again */
  noAutoDetail?: boolean;
  /** layout guides in page mm, dragged out of the rulers (never printed) */
  guides?: { x: number[]; y: number[] };
}

/** key in `geoms` that holds the place or drawn area geometry */
export const STUDY_GEOM = '__study';

export const OKABE_ITO = ['#D55E00', '#0072B2', '#009E73', '#E69F00', '#56B4E9', '#CC79A7', '#F0E442', '#000000'];

let seq = 0;
export const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

export const defaultStyle = (over: Partial<LayerStyle> = {}): LayerStyle => ({
  fill: '#cccccc', fillOpacity: 1, stroke: '#555555', strokePt: 0.5, dash: false,
  symbol: 'circle', sizePt: 5, labelField: '', labelPt: 7, ...over,
});

/** The coordinate grid of a new detail map: off, with the settings the main map starts with. */
export const detailGrid = (): MapItem['grid'] => ({ show: false, lines: true, step: 'auto', format: 'dm', labelPt: 7, lineColor: '#B4B4AE', sides: 'two' });

export function makeLayer(kind: LayerKind, name: string, style: Partial<LayerStyle>, extra: Partial<Layer> = {}): Layer {
  return layer(kind, name, style, extra);
}
function layer(kind: LayerKind, name: string, style: Partial<LayerStyle>, extra: Partial<Layer> = {}): Layer {
  return { id: uid(kind), kind, name, visible: true, inLegend: true, legendLabel: name, style: defaultStyle(style), ...extra };
}

export function defaultLayers(): Layer[] {
  return [
    layer('sea', 'Sea', { fill: '#DCEAF1', stroke: 'none' }, { inLegend: false }),
    layer('countries', 'Countries', { fill: '#FBFAF6', fill2: '#E8E6DE', stroke: '#8C8C86', strokePt: 0.5 }, { legendLabel: 'International boundary', source: 'Natural Earth', inLegend: false }),
    layer('terrain', 'Terrain', { fill: 'none', stroke: 'none' }, { visible: false, legendLabel: 'Shaded relief', source: 'Mapterhorn', terrain: { tint: false, exaggeration: 2, azimuth: 315, opacity: 1, auto: true } }),
    layer('study', 'Your area', { fill: '#D55E00', fillOpacity: 0.22, stroke: '#B04A00', strokePt: 1 }, { legendLabel: 'Study area' }),
    layer('admin', 'Boundaries', { fill: 'none', stroke: '#86867F', strokePt: 0.4, dash: true, labelField: '__name', labelPt: 7 }, { legendLabel: 'District boundary' }),
    layer('subunits', 'Sub-areas', { fill: 'none', stroke: '#9A9A94', strokePt: 0.3, dash: false, labelField: '__name', labelPt: 7 }, { legendLabel: 'Sub-district boundary', inLegend: false }),
    layer('lakes', 'Lakes', { fill: '#DCEAF1', stroke: '#6E9CB5', strokePt: 0.3 }, { legendLabel: 'Water body', source: 'Natural Earth' }),
    // rivers start off (a clean location map); one switch in Map parts, On the map turns them on
    layer('rivers', 'Rivers', { fill: 'none', stroke: '#4F8FB3', strokePt: 0.6 }, { visible: false, legendLabel: 'River', source: 'Natural Earth' }),
    layer('disputed', 'Disputed areas', { fill: 'none', stroke: '#6B6B66', strokePt: 0.5, dash: true }, { visible: false, inLegend: false, source: 'Natural Earth' }),
  ];
}

/**
 * The default figure is deliberately plain, like a journal location map: the map, one country locator,
 * a short legend, north arrow and scale bar. Globe and credits text are one switch away; the full
 * data credits go into the figure caption on the Export panel.
 */
export function defaultItems(W: number, H: number): Item[] {
  return [
    // before a place is chosen the world fills the page; the first area puts the layout's column beside it (freshLook)
    { id: uid('map'), kind: 'map', x: 6, y: 5, w: W - 12, h: H - 10, visible: true, framePt: 0.6,
      grid: { show: true, lines: true, step: 'auto', format: 'dm', labelPt: 7, lineColor: '#B4B4AE', sides: 'two' } },
    { id: uid('inset'), kind: 'inset', context: 'globe', x: W - 48, y: 5, w: 40, h: 40, visible: false, showExtent: true, extentColor: '#D55E00', label: '', labelPt: 7 },
    { id: uid('inset'), kind: 'inset', context: 'country', x: W - 52, y: 5, w: 48, h: 52, visible: true, showExtent: true, extentColor: '#D55E00', label: '', labelPt: 7, connect: false },
    { id: uid('north'), kind: 'north', x: 12, y: 10, w: 8, h: 14, visible: true, style: 'arrow', trueNorth: true, backdrop: false },
    // the side column is anchored to the map frame: locator at the top, legend and scale bar at the foot (credits, when shown, between)
    { id: uid('scale'), kind: 'scale', x: W - 52, y: H - 14, w: 44, h: 9, visible: true, units: 'metric', segments: 4, style: 'alternating', labelPt: 7, backdrop: true, ratio: 'none' },
    { id: uid('legend'), kind: 'legend', x: W - 52, y: H - 41, w: 48, h: 24, visible: true, title: '', labelPt: 7, frame: false },
    { id: uid('credits'), kind: 'credits', x: W - 52, y: 62, w: 48, h: 22, visible: false, labelPt: 7, showProjection: true, showDisclaimer: false, extra: '' },
  ];
}

/** Bring an older map to the plain look once (globe, credits text and extra legend rows off). */
export function makeClean(doc: Doc) {
  if (doc.clean) return;
  doc.clean = true;
  for (const it of doc.items) {
    if (it.kind === 'inset' && it.context === 'globe') it.visible = false;
    if (it.kind === 'credits') it.visible = false;
    if (it.kind === 'north') it.backdrop = false;
    if (it.kind === 'map') { it.grid.sides = 'two'; it.grid.lineColor = '#B4B4AE'; }
  }
  for (const l of doc.layers) if (l.kind === 'countries' || l.kind === 'subunits') l.inLegend = false;
  doc.layers = doc.layers.filter((l) => !(l.kind === 'osm' && l.auto));
}

export function defaultDoc(): Doc {
  const preset = findPreset('elsevier-2');
  const W = preset.widthMm;
  const H = 150;
  const doc: Doc = {
    version: 2,
    title: 'Untitled map',
    presetId: preset.id,
    templateId: 'classic',
    themeId: 'classic',
    clean: true,
    widthMm: W,
    heightMm: H,
    study: { source: 'none', name: '', highlight: true, iso: '', countryName: '', level: 0, unitIds: [], unitNames: [] },
    crs: null,
    view: { padding: 0.12, panX: 0, panY: 0, zoom: 1 },
    font: 'Arimo',
    layers: defaultLayers(),
    items: defaultItems(W, H),
    exportDpi: 600,
    exportFormat: 'pdf',
  };
  applyTheme(doc, 'classic'); // the empty page already shows the default map style's colours
  return doc;
}

/** A saved document, checked and brought up to date; throws (changing nothing) when the file is damaged. */
function readDoc(raw: any): Doc {
  const damaged = () => new Error('This project file is damaged and cannot be opened.');
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.layers) || (raw.items != null && !Array.isArray(raw.items))) throw damaged();
  if (!(raw.widthMm > 0) || !(raw.heightMm > 0) || (raw.version === 2 && (!raw.study || typeof raw.study !== 'object'))) throw damaged();
  // what a file made by hand or by another version lacks takes its usual value
  const d = defaultDoc();
  raw.items ??= [];
  raw.view = raw.view && typeof raw.view === 'object' ? { ...d.view, ...raw.view } : d.view;
  for (const k of ['title', 'presetId', 'templateId', 'themeId', 'font', 'exportDpi', 'exportFormat'] as const) raw[k] ??= d[k];
  let doc: Doc;
  try { doc = upgrade(raw); } catch { throw damaged(); }
  if (!doc.study || typeof doc.study !== 'object' || doc.items.some((it) => !it || typeof it !== 'object') || doc.layers.some((l) => !l || typeof l !== 'object')) throw damaged();
  return doc;
}

/** Bring projects saved by older versions up to the current model. */
function upgrade(raw: any): Doc {
  const doc = raw as Doc;
  if (raw.version === 1) {
    const s = raw.study ?? {};
    doc.study = {
      source: s.fromLayer ? 'layer' : 'admin',
      name: s.level === 0 ? s.countryName : (s.unitNames ?? []).join(', ') || s.countryName,
      highlight: true,
      iso: s.iso ?? '', countryName: s.countryName ?? '', level: s.level ?? 0,
      unitIds: s.unitIds ?? [], unitNames: s.unitNames ?? [], fromLayer: s.fromLayer,
    };
    doc.title = doc.study.name ? `${doc.study.name} study area` : 'Untitled map';
    doc.templateId = 'classic';
    doc.themeId = 'classic';
    doc.version = 2;
  }
  // a detail map from a file made by hand or by another version: whatever it lacks takes its usual value
  for (const it of doc.items ?? []) {
    if (it.kind !== 'detail') continue;
    it.grid ??= detailGrid();
    it.framePt ??= 0.6;
    it.labelPt ??= 8;
    it.label ??= '';
    it.showBox ??= true;
    it.boxColor ??= '#D55E00';
    it.connect ??= true;
  }
  const fresh = doc.clean ? [] : defaultLayers();
  fresh.forEach((l, i) => {
    if (doc.layers.some((x) => x.kind === l.kind)) return;
    const below = fresh[i - 1];
    const at = below ? doc.layers.findIndex((x) => x.kind === below.kind) + 1 : 0;
    doc.layers.splice(Math.max(0, at), 0, l);
  });
  return doc;
}

const AUTOSAVE_KEY = 'studymap.autosave.v1';
// which entry of My maps the map on screen is (kept outside the document, so undo never changes it)
const MAPID_KEY = 'studymap.mapId';
function storedMapId(): string {
  try {
    let id = localStorage.getItem(MAPID_KEY);
    if (!id) { id = uid('map'); localStorage.setItem(MAPID_KEY, id); } // kept at once, so a reload never makes a second entry
    return id;
  } catch { return uid('map'); }
}

/** The panel on show. 'text', 'uploads' and 'style' are old names that open a part of Map parts or Design; Layers is a part of Map parts (shell.svelte.ts). */
export type Tab = 'place' | 'templates' | 'elements' | 'text' | 'uploads' | 'style' | 'edit' | 'export' | 'help';
export type Tool = 'select' | 'adjust' | 'rect' | 'circle' | 'polygon' | 'freehand' | 'point' | 'line';

class Store {
  doc = $state<Doc>(defaultDoc());
  selected = $state<string | null>(null); // item or layer id
  /** more parts picked with Shift+click: moved, aligned, spaced and deleted together with the selected one */
  extra = $state<string[]>([]);
  /** one feature of the selected layer, clicked on the map: its own settings show above the layer's */
  picked = $state<{ layerId: string; name: string; what: 'label' | 'point' | 'line' | 'area'; /** the detail map it was picked in (unset = the main map) */ frame?: string } | null>(null);
  tab = $state<Tab>('place');
  panelOpen = $state(true);
  tool = $state<Tool>('select');
  /** while set, drawing tools add shapes to this layer instead of making the study area */
  drawTarget = $state<string | null>(null);
  /** layout tool from the palette: an item kind to drag out on the page, or null for selecting */
  addKind = $state<null | 'text' | 'legend' | 'scale' | 'north' | 'locator' | 'detail' | 'image' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'table' | 'profile'>(null);
  /** picture chosen for the image tool, waiting to be placed */
  pendingImage = $state<string | null>(null);
  /** the detail map (its id) waiting for a box dragged on the main map to say what it shows */
  detailPick = $state<string | null>(null);
  status = $state<string>('');
  /** the message that came with an action Undo can take back: the toast then offers an Undo button */
  undoFor = $state<string>('');
  /** the Export panel hands its download to the panel foot, so the one main action sits in the same place on every step */
  exportRun = $state<(() => void) | undefined>(undefined);
  exportLabel = $state('');
  exportDisabled = $state(true);
  /** tell the person what just happened, with an Undo button next to it */
  told(msg: string) { this.status = msg; this.undoFor = msg; }
  /** screen-only preview of the figure as seen with a colour-vision deficiency ('' = off) */
  /** on-screen preview of how the page reads: colour-blind vision, or printed in black and white */
  cvd = $state<'' | 'deutan' | 'protan' | 'tritan' | 'grey'>('');
  busy = $state<string>('');
  /** user geometry, kept outside the reactive doc to keep edits fast */
  geoms = $state.raw<Record<string, FeatureCollection>>({});
  /** resolved study area features (from a place, a drawing, admin units or a layer) */
  studyFeatures = $state.raw<Feature<Geometry>[]>([]);
  /** the areas before merging (studyFeatures may hold them merged into one outline) */
  studyParts = $state.raw<Feature<Geometry>[]>([]);
  adminFc = $state.raw<FeatureCollection | null>(null);
  /** boundaries at fixed levels, for extra boundary layers and locator maps (key: level) */
  adminLevels = $state.raw<Record<number, FeatureCollection>>({});
  subFc = $state.raw<FeatureCollection | null>(null);
  subMeta = $state.raw<{ canonical: string; license: string } | null>(null);
  countryFeature = $state.raw<Feature<Geometry> | null>(null);
  terrain = $state.raw<{ key: string; href: string; zoom: number; minElev: number; maxElev: number } | null>(null);
  terrainMsg = $state('');
  adminMeta = $state.raw<{ canonical: string; license: string; source: string } | null>(null);
  countriesFc = $state.raw<FeatureCollection | null>(null);
  /** set by the app; renders terrain at print resolution right before an export */
  beforeExport: (() => Promise<void>) | null = null;
  /** set by the app: share of a page box (mm) over the study area, so new parts are dropped beside it */
  cover: ((r: { x: number; y: number; w: number; h: number }) => number) | null = null;
  afterExport: (() => void) | null = null;

  private past: string[] = [];
  private future: string[] = [];
  private last = '';
  private timer: ReturnType<typeof setTimeout> | undefined;

  get canUndo() { return this.pastLen > 0; }
  get canRedo() { return this.futureLen > 0; }
  pastLen = $state(0);
  futureLen = $state(0);

  /** call after any edit; groups rapid edits into one undo step */
  commit() {
    clearTimeout(this.timer);
    this.pending = true;
    this.saving = true;
    this.timer = setTimeout(() => this.snapshot(), 350);
  }

  // Each history step keeps the geometry object of its time too (geoms are replaced, never mutated, so a
  // reference is a cheap snapshot): undoing a drawing brings back the earlier shape as well as the settings.
  private pastGeoms: Record<string, FeatureCollection>[] = [];
  private futureGeoms: Record<string, FeatureCollection>[] = [];
  private lastGeoms: Record<string, FeatureCollection> = {};
  private pending = false;

  snapshot() {
    this.pending = false;
    const now = JSON.stringify(this.doc);
    if (now === this.last && this.geoms === this.lastGeoms) { this.saving = this.saveQueued; return; }
    if (this.last) { this.past.push(this.last); this.pastGeoms.push(this.lastGeoms); }
    if (this.past.length > 100) { this.past.shift(); this.pastGeoms.shift(); }
    this.future = []; this.futureGeoms = [];
    this.last = now;
    this.lastGeoms = this.geoms;
    this.pastLen = this.past.length;
    this.futureLen = 0;
    this.autosave();
  }

  /** Forget the undo history (a new or opened project starts its own). */
  clearHistory() {
    clearTimeout(this.timer);
    this.pending = false;
    this.saving = this.saveQueued;
    this.past = []; this.pastGeoms = []; this.future = []; this.futureGeoms = [];
    this.last = JSON.stringify(this.doc);
    this.lastGeoms = this.geoms;
    this.pastLen = 0; this.futureLen = 0;
  }

  undo() {
    clearTimeout(this.timer);
    // a user edit still waiting becomes its own step; automatic touch-ups (legend size, placement) do not
    if (this.pending) this.snapshot();
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(JSON.stringify(this.doc)); this.futureGeoms.push(this.geoms);
    this.last = prev;
    this.lastGeoms = this.pastGeoms.pop() ?? this.geoms;
    this.geoms = this.lastGeoms;
    this.doc = JSON.parse(prev);
    this.pruneSelection();
    this.pastLen = this.past.length;
    this.futureLen = this.future.length;
    this.autosave();
  }

  redo() {
    clearTimeout(this.timer);
    // an edit still waiting is a new step: it ends the redo list (as it would have 350 ms later), so nothing is lost
    if (this.pending) this.snapshot();
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.last); this.pastGeoms.push(this.lastGeoms);
    this.last = next;
    this.lastGeoms = this.futureGeoms.pop() ?? this.geoms;
    this.geoms = this.lastGeoms;
    this.doc = JSON.parse(next);
    this.pruneSelection();
    this.pastLen = this.past.length;
    this.futureLen = this.future.length;
    this.autosave();
  }

  /** After undo or redo: let go of selected parts that no longer exist, so no stale group or empty Settings page is left. */
  private pruneSelection() {
    if (!this.selected) return;
    const part = (id: string) => this.doc.items.some((i) => i.id === id);
    if (!part(this.selected) && !this.doc.layers.some((l) => l.id === this.selected)) { this.select(null); return; }
    if (this.extra.some((id) => !part(id))) this.extra = this.extra.filter(part);
  }

  item<T extends Item = Item>(kind: ItemKind): T | undefined {
    return this.doc.items.find((i) => i.kind === kind) as T | undefined;
  }
  get map(): MapItem { return this.doc.items.find((i) => i.kind === 'map') as MapItem; }
  layer(kind: LayerKind): Layer | undefined { return this.doc.layers.find((l) => l.kind === kind); }

  /** Select an element and show its settings. */
  /** the panel to go back to when the settings of a selected item close */
  private backTab: Tab = 'place';
  /**
   * Select an item or layer. Clicking on the page only selects (the side panel stays as it is);
   * open = true also shows its settings (Layers list, Settings button, double-click).
   */
  select(id: string | null, open = false) {
    this.extra = [];
    if (this.picked && this.picked.layerId !== id) this.picked = null;
    this.selected = id;
    if (id && (open || this.tab === 'edit')) {
      if (this.tab !== 'edit') this.backTab = this.tab;
      this.tab = 'edit';
      this.panelOpen = true;
    } else if (!id && this.tab === 'edit') this.tab = this.backTab;
  }
  /** Shift+click: add a part to the selection, or take it out again. */
  toggleExtra(id: string) {
    if (!this.selected) { this.select(id); return; }
    if (id === this.selected) {
      // the leading part leaves the group: the next one leads; the last one leaving clears the selection properly
      const [next, ...rest] = this.extra;
      if (next) { this.selected = next; this.extra = rest; } else this.select(null);
      return;
    }
    this.extra = this.extra.includes(id) ? this.extra.filter((x) => x !== id) : [...this.extra, id];
  }
  /** Every selected part, the leading one first. */
  get selection(): string[] { return this.selected ? [this.selected, ...this.extra] : []; }
  /** Show the settings of the selected item. */
  openSettings() {
    if (!this.selected) return;
    if (this.tab !== 'edit') this.backTab = this.tab;
    this.tab = 'edit';
    this.panelOpen = true;
  }

  /** A rail button: opens its panel, and closes it again when it is already the one on show. */
  openTab(t: Tab) {
    // the old Style, Text and Uploads names are parts of Design and Map parts: their step's button closes that panel too
    const home = (x: Tab): Tab => (x === 'style' ? 'templates' : x === 'text' || x === 'uploads' ? 'elements' : x);
    if (home(this.tab) === home(t) && this.panelOpen && t !== 'edit') this.panelOpen = false;
    else { this.tab = t; this.panelOpen = true; }
    if (t !== 'edit') { this.selected = null; this.extra = []; }
  }

  serialize(includeGeoms = true, refetchable = true): string {
    const used: Record<string, FeatureCollection> = {};
    if (includeGeoms) {
      // OpenStreetMap detail is fetched again on load, so the autosave leaves it out.
      for (const l of this.doc.layers) if (this.geoms[l.id] && (refetchable || l.kind !== 'osm')) used[l.id] = this.geoms[l.id];
      if (this.geoms[STUDY_GEOM]) used[STUDY_GEOM] = this.geoms[STUDY_GEOM];
    }
    return JSON.stringify({ app: 'StudyMap', doc: this.doc, geoms: used });
  }

  /** keepId: the same map coming back (the autosave, a version); otherwise an opened file becomes its own entry in My maps */
  load(text: string, keepId = false) {
    const j = JSON.parse(text);
    if (!j || j.app !== 'StudyMap' || !j.doc || (j.doc.version !== 1 && j.doc.version !== 2)) throw new Error('This is not a StudyMap project file.');
    // checked and brought up to date before anything on screen changes: a damaged file leaves the open map as it was
    const doc = readDoc(j.doc);
    this.geoms = j.geoms && typeof j.geoms === 'object' ? { ...j.geoms } : {};
    this.studyFeatures = [];
    if (!keepId) this.setMapId(uid('map'));
    this.doc = doc;
    this.dropTools();
    this.onLoaded?.(); // older maps are brought up to date by the app (look, layout)
    this.select(null); // also drops the group, so no old part ids stay picked in the new map
    this.clearHistory();
    this.autosave();
  }

  /** when the map was last kept in this browser (0 = not yet, -1 = could not save) */
  savedAt = $state(0);
  private saveQueued = false;
  private saveRun: (() => void) | null = null;
  private warnedStorage = false;
  /** an edit is waiting to be kept (the top bar says "Saving…" until it is) */
  saving = $state(false);
  /** set by the app: runs after a project or the autosave is loaded */
  onLoaded?: () => void;
  /** set by the app: runs after each autosave with the saved project (keeps My maps up to date) */
  onSaved?: (project: string) => void;
  /** the map on screen in My maps */
  mapId = $state<string>(storedMapId());
  setMapId(id: string) {
    this.mapId = id;
    try { localStorage.setItem(MAPID_KEY, id); } catch { /* private window: the id lives for this visit */ }
  }
  /** Saved when the browser is idle, so it never stutters a drag or a zoom. */
  autosave() {
    if (this.saveQueued) return;
    this.saveQueued = true;
    this.saving = true;
    const run = () => {
      if (!this.saveQueued) return; // already saved by flush()
      this.saveQueued = false;
      this.saving = false;
      const essential = () => {
        // the study area and shapes drawn by hand cannot be fetched again; imported files can be re-added
        const used: Record<string, FeatureCollection> = {};
        if (this.geoms[STUDY_GEOM]) used[STUDY_GEOM] = this.geoms[STUDY_GEOM];
        for (const l of this.doc.layers) if (l.kind === 'vector' && !l.source && this.geoms[l.id]) used[l.id] = this.geoms[l.id];
        return JSON.stringify({ app: 'StudyMap', doc: this.doc, geoms: used });
      };
      const warnFull = () => {
        if (this.warnedStorage) return;
        this.warnedStorage = true;
        this.status = 'Your browser storage is full, so imported files are not kept between visits. Use File, Download project file to keep everything.';
      };
      try {
        const s = this.serialize(true, false);
        const small = s.length < 4_500_000;
        localStorage.setItem(AUTOSAVE_KEY, small ? s : essential());
        this.savedAt = Date.now();
        if (!small) warnFull(); // too big for this browser's storage: the imported files are left out, so say so
        this.onSaved?.(s);
      } catch {
        // the copy kept by "Start a new map" (see Root) is the first thing to give up for room
        try { localStorage.removeItem('studymap.backup.v1'); } catch { /* storage blocked */ }
        try {
          localStorage.setItem(AUTOSAVE_KEY, essential());
          this.savedAt = Date.now();
          warnFull();
        } catch {
          this.savedAt = -1;
          if (!this.warnedStorage) { this.warnedStorage = true; this.status = 'This browser could not save your map automatically. Use File, Download project file to keep it.'; }
        }
      }
    };
    this.saveRun = run;
    const ric = (globalThis as any).requestIdleCallback as ((f: () => void, o?: { timeout: number }) => void) | undefined;
    if (ric) ric(run, { timeout: 1000 }); else setTimeout(run, 300);
  }

  /** Keep the latest edit now: the page is being closed, reloaded or hidden, and an idle moment may never come. */
  flush() {
    if (this.pending) { clearTimeout(this.timer); this.snapshot(); }
    this.saveRun?.();
  }

  restore(): boolean {
    try {
      const s = localStorage.getItem(AUTOSAVE_KEY);
      if (!s) return false;
      this.load(s, true);
      return true;
    } catch {
      return false;
    }
  }

  /** A tool left on from the map before (drawing into a layer, placing a part) would act on the wrong map. */
  private dropTools() {
    this.tool = 'select';
    this.drawTarget = null;
    this.addKind = null;
    this.pendingImage = null;
    this.detailPick = null;
  }

  reset() {
    this.dropTools();
    this.setMapId(uid('map')); // the map before stays in My maps
    this.doc = defaultDoc();
    this.geoms = {};
    this.studyFeatures = [];
    this.selected = null;
    this.extra = [];
    this.tab = 'place';
    this.panelOpen = true;
    this.clearHistory();
    this.autosave();
  }
}

export const store = new Store();
