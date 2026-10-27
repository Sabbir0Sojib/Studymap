// Journal figure presets. Values from publisher artwork guidelines (see RESEARCH.md section 3).
// When a publisher does not state a width, the preset uses a common value and says so in `note`.

export type ExportFormat = 'pdf' | 'svg' | 'tiff' | 'png';

export interface JournalPreset {
  id: string;
  publisher: string;
  label: string;
  widthMm: number;
  maxHeightMm: number;
  minDpi: number;
  minFontPt: number;
  minLinePt: number;
  formats: ExportFormat[];
  maxFileMb?: number;
  note?: string;
  /** fonts the publisher names for figure text, as the bundled look-alikes (absent = no rule) */
  fonts?: string[];
}

const ALL: ExportFormat[] = ['pdf', 'svg', 'tiff', 'png'];

export const PRESETS: JournalPreset[] = [
  { id: 'elsevier-1', publisher: 'Elsevier', label: 'Single column', widthMm: 90, maxHeightMm: 240, minDpi: 500, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'tiff'], fonts: ['Arimo', 'Tinos', 'Cousine'] },
  { id: 'elsevier-15', publisher: 'Elsevier', label: '1.5 column', widthMm: 140, maxHeightMm: 240, minDpi: 500, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'tiff'], fonts: ['Arimo', 'Tinos', 'Cousine'] },
  { id: 'elsevier-2', publisher: 'Elsevier', label: 'Double column', widthMm: 190, maxHeightMm: 240, minDpi: 500, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'tiff'], fonts: ['Arimo', 'Tinos', 'Cousine'] },
  { id: 'springer-1', publisher: 'Springer', label: 'Single column', widthMm: 84, maxHeightMm: 234, minDpi: 600, minFontPt: 8, minLinePt: 0.3, formats: ['pdf', 'tiff'], fonts: ['Arimo'] },
  { id: 'springer-2', publisher: 'Springer', label: 'Double column', widthMm: 174, maxHeightMm: 234, minDpi: 600, minFontPt: 8, minLinePt: 0.3, formats: ['pdf', 'tiff'], fonts: ['Arimo'] },
  { id: 'nature-1', publisher: 'Nature', label: 'Single column', widthMm: 89, maxHeightMm: 170, minDpi: 450, minFontPt: 5, minLinePt: 0.25, formats: ['pdf', 'tiff'], note: 'Height limit not confirmed.', fonts: ['Arimo', 'Carlito'] },
  { id: 'nature-2', publisher: 'Nature', label: 'Double column', widthMm: 183, maxHeightMm: 170, minDpi: 450, minFontPt: 5, minLinePt: 0.25, formats: ['pdf', 'tiff'], note: 'Height limit not confirmed.', fonts: ['Arimo', 'Carlito'] },
  { id: 'wiley-1', publisher: 'Wiley', label: 'Single column', widthMm: 80, maxHeightMm: 240, minDpi: 600, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'tiff', 'png'], maxFileMb: 10 },
  { id: 'wiley-2', publisher: 'Wiley', label: 'Double column', widthMm: 180, maxHeightMm: 240, minDpi: 600, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'tiff', 'png'], maxFileMb: 10 },
  { id: 'mdpi', publisher: 'MDPI', label: 'Full width', widthMm: 170, maxHeightMm: 230, minDpi: 600, minFontPt: 8, minLinePt: 0.25, formats: ['tiff', 'png'], note: 'MDPI does not fix widths. Remote Sensing requires scale, north arrow and coordinates.' },
  { id: 'plos-1', publisher: 'PLOS', label: 'Single column', widthMm: 132, maxHeightMm: 222, minDpi: 300, minFontPt: 8, minLinePt: 0.25, formats: ['tiff'], maxFileMb: 10, note: 'PLOS accepts TIFF or EPS only, and no Google basemaps.', fonts: ['Arimo', 'Tinos'] },
  { id: 'plos-2', publisher: 'PLOS', label: 'Full width', widthMm: 190, maxHeightMm: 222, minDpi: 300, minFontPt: 8, minLinePt: 0.25, formats: ['tiff'], maxFileMb: 10, note: 'PLOS accepts TIFF or EPS only, and no Google basemaps.', fonts: ['Arimo', 'Tinos'] },
  { id: 'frontiers-1', publisher: 'Frontiers', label: 'Single column', widthMm: 85, maxHeightMm: 240, minDpi: 300, minFontPt: 8, minLinePt: 0.25, formats: ['tiff', 'pdf'] },
  { id: 'frontiers-2', publisher: 'Frontiers', label: 'Double column', widthMm: 180, maxHeightMm: 240, minDpi: 300, minFontPt: 8, minLinePt: 0.25, formats: ['tiff', 'pdf'] },
  { id: 'ieee-1', publisher: 'IEEE', label: 'Single column', widthMm: 88.9, maxHeightMm: 220, minDpi: 600, minFontPt: 8, minLinePt: 0.25, formats: ['pdf', 'tiff', 'png'], fonts: ['Tinos', 'Arimo', 'Caladea'] },
  { id: 'ieee-2', publisher: 'IEEE', label: 'Double column', widthMm: 182, maxHeightMm: 220, minDpi: 600, minFontPt: 8, minLinePt: 0.25, formats: ['pdf', 'tiff', 'png'], fonts: ['Tinos', 'Arimo', 'Caladea'] },
  { id: 'copernicus', publisher: 'Copernicus', label: 'Full width', widthMm: 170, maxHeightMm: 230, minDpi: 300, minFontPt: 7, minLinePt: 0.25, formats: ['pdf', 'png'], maxFileMb: 5, note: 'Copernicus asks for a basemap licence statement.' },
  { id: 'thesis-a4', publisher: 'Thesis', label: 'A4 text width', widthMm: 160, maxHeightMm: 240, minDpi: 300, minFontPt: 8, minLinePt: 0.25, formats: ALL },
];

export const CUSTOM_PRESET: JournalPreset = {
  id: 'custom', publisher: 'Custom', label: 'Any size', widthMm: 170, maxHeightMm: 1000, minDpi: 300, minFontPt: 7, minLinePt: 0.25, formats: ALL,
};

export function findPreset(id: string): JournalPreset {
  return PRESETS.find((p) => p.id === id) ?? CUSTOM_PRESET;
}

export const PT_TO_MM = 25.4 / 72;
export const mmToPt = (mm: number) => mm / PT_TO_MM;
export const ptToMm = (pt: number) => pt * PT_TO_MM;
