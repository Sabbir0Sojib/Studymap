// The drawn scenes of the map frames, shared by the app (which builds them) and the panels and actions that read them
// (a detail map's settings show its scale; adding one starts from the main map's).
import type { LayerDraw, MainScene } from './scene';

/** A detail map ready to draw: its geometry, its own names, and the images over it when it has them (relief, satellite). */
export interface DetailDraw {
  scene: MainScene;
  labels: Record<string, LayerDraw['labels']>;
  terrainHref?: string | null;
  basemapHref?: string | null;
}

class Frames {
  /** the main map's scene (null before a place is chosen) */
  main = $state.raw<MainScene | null>(null);
  /** the detail maps' scenes by part id (null while one cannot be drawn) */
  details = $state.raw<Record<string, DetailDraw | null>>({});
}
export const frames = new Frames();
