// What lies under the pointer on the map: a name, a point, a line or an area, found in the drawn figure itself
// (like the Identify tool of a GIS), so a click on any of them opens its own settings.

export type PickWhat = 'label' | 'point' | 'line' | 'area' | 'grid';

export interface Picked {
  /** the layer it belongs to ('grid' for the coordinates round the frame) */
  layerId: string;
  /** the feature's name (an area's or a place name's original text) */
  name: string;
  what: PickWhat;
  /** where it is on screen (client px), for the highlight box */
  box: { x: number; y: number; w: number; h: number };
}

// names and points are small and drawn on top, so they win over a line; a line wins over the area it runs through
const RANK: Record<PickWhat, number> = { label: 0, grid: 0, point: 1, line: 2, area: 3 };

/** The map frame (main map or detail map) an element is drawn in: the id in the clip path of the group that holds its map content. */
export function frameOf(el: Element): string | undefined {
  return el.closest('[clip-path^="url(#clip-"]')?.getAttribute('clip-path')?.slice('url(#clip-'.length, -1);
}

/**
 * Find the topmost feature under a screen point. Elements carry data-pick="layerId|what|name".
 * frame: the map frame (item id) the click is in; the other frames' drawings are left out (a detail map's study area reaches
 * beyond its clip, and clipping does not count in a hit test).
 */
export function pickAt(svg: SVGSVGElement, clientX: number, clientY: number, frame?: string): Picked | null {
  const els = Array.from(svg.querySelectorAll<SVGGraphicsElement>('[data-pick]')).filter((el) => !frame || frameOf(el) === frame);
  let best: { el: SVGGraphicsElement; rank: number; size: number; layerId: string; what: PickWhat; name: string } | null = null;
  // drawn last = on top, so walk backwards
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    const [layerId, what0, ...rest] = (el.dataset.pick ?? '').split('|');
    const what = what0 as PickWhat;
    const rank = RANK[what];
    if (rank === undefined || (best && rank > best.rank)) continue;
    const ctm = el.getScreenCTM();
    if (!ctm) continue;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const scale = Math.hypot(ctm.a, ctm.b) || 1; // screen px per user unit
    let hit = false;
    if (what === 'label' || what === 'grid') {
      const b = el.getBBox();
      const pad = 2 / scale;
      hit = p.x >= b.x - pad && p.x <= b.x + b.width + pad && p.y >= b.y - pad && p.y <= b.y + b.height + pad;
    } else if (el instanceof SVGGeometryElement) {
      if (what === 'area') hit = el.isPointInFill(p);
      else {
        // a thin line or a small symbol is hard to hit exactly: test it with a stroke about 8 screen px wide
        const was = el.style.strokeWidth;
        el.style.strokeWidth = String(8 / scale);
        hit = el.isPointInStroke(p) || (what === 'point' && el.isPointInFill(p));
        el.style.strokeWidth = was;
      }
    }
    if (!hit) continue;
    const b = el.getBBox();
    const size = b.width * b.height;
    // the same kind under the pointer twice (a sub-area inside the study area): the smaller, more precise one wins
    if (!best || rank < best.rank || (rank === best.rank && size < best.size)) best = { el, rank, size, layerId, what, name: rest.join('|') };
  }
  if (!best) return null;
  const r = best.el.getBoundingClientRect();
  return { layerId: best.layerId, name: best.name, what: best.what, box: { x: r.x, y: r.y, w: r.width, h: r.height } };
}
