<script lang="ts">
  // The desk: the page at its true aspect, selection and handles, snapping, map pan/zoom and drawing tools.
  // Everything drawn in the overlay (selection, guides, drawings in progress) uses the accent and is never exported.
  import { untrack } from 'svelte';
  import Figure from './Figure.svelte';
  import PlaceSearch from './PlaceSearch.svelte';
  import { store } from '../lib/store.svelte';
  import type { DetailItem, Item, MapItem } from '../lib/store.svelte';
  import type { InsetScene, LayerDraw, MainScene } from '../lib/scene';
  import type { DetailDraw } from '../lib/frames.svelte';
  import type { ScaleBarSpec } from '../lib/carto';
  import { openDesign } from './SidePanel.svelte';
  import { isProblem } from './shell.svelte';
  import { t } from '../lib/i18n.svelte';
  import ArrowsHorizontal from 'phosphor-svelte/lib/ArrowsHorizontal';
  import ArrowsVertical from 'phosphor-svelte/lib/ArrowsVertical';
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import PathIcon from 'phosphor-svelte/lib/Path';
  import PolygonIcon from 'phosphor-svelte/lib/Polygon';
  import Scribble from 'phosphor-svelte/lib/Scribble';
  import { drawOnMap, groupParts, ungroupParts, copyItem, copyItems, pasteItem } from '../lib/actions';
  import { frameOf, pickAt } from '../lib/pick';
  import { panDetail, zoomDetail, setDetailScale, setDetailBox, fitDetailToArea, setDrawnArea, circleRing, fitToArea, mapScale, setMapScale, addToLayer, addInBox, alignItem, restack, readPicture, parseScale, duplicateItem, resizePage, keepOnPage, trimPage, PAGE_MIN, PAGE_MAX, itemText, setItemText, setItemTexts, alignGroup, distributeGroup, deleteItems, duplicateItems } from '../lib/actions';
  import type { PageSide } from '../lib/actions';
  import { look, TEXT } from '../lib/textstyle';
  import { fontStack } from '../lib/fonts.svelte';
  import Rulers from './Rulers.svelte';
  import SidePicker from './panels/SidePicker.svelte';
  import Cursor from 'phosphor-svelte/lib/Cursor';
  import HandGrabbing from 'phosphor-svelte/lib/HandGrabbing';
  import TextT from 'phosphor-svelte/lib/TextT';
  import ListBullets from 'phosphor-svelte/lib/ListBullets';
  import Ruler from 'phosphor-svelte/lib/Ruler';
  import TableIcon from 'phosphor-svelte/lib/Table';
  import ChartLine from 'phosphor-svelte/lib/ChartLine';
  import { drawnLines, sitesLayers } from '../lib/figparts';
  import { fitTables, syncProfiles } from '../lib/figparts.svelte';
  import NavigationArrow from 'phosphor-svelte/lib/NavigationArrow';
  import MapTrifold from 'phosphor-svelte/lib/MapTrifold';
  import FrameCorners from 'phosphor-svelte/lib/FrameCorners';
  import ImageIcon from 'phosphor-svelte/lib/Image';
  import Square from 'phosphor-svelte/lib/Square';
  import CircleIcon from 'phosphor-svelte/lib/Circle';
  import LineSegment from 'phosphor-svelte/lib/LineSegment';
  import ArrowUpRight from 'phosphor-svelte/lib/ArrowUpRight';
  import AlignLeft from 'phosphor-svelte/lib/AlignLeft';
  import AlignRight from 'phosphor-svelte/lib/AlignRight';
  import AlignCenterHorizontal from 'phosphor-svelte/lib/AlignCenterHorizontal';
  import AlignTop from 'phosphor-svelte/lib/AlignTop';
  import AlignBottom from 'phosphor-svelte/lib/AlignBottom';
  import AlignCenterVertical from 'phosphor-svelte/lib/AlignCenterVertical';
  import ArrowLineUp from 'phosphor-svelte/lib/ArrowLineUp';
  import ArrowLineDown from 'phosphor-svelte/lib/ArrowLineDown';
  import Lock from 'phosphor-svelte/lib/Lock';
  import TextB from 'phosphor-svelte/lib/TextB';
  import DotsThree from 'phosphor-svelte/lib/DotsThree';
  import DotsThreeVertical from 'phosphor-svelte/lib/DotsThreeVertical';
  import TextItalic from 'phosphor-svelte/lib/TextItalic';
  import LockOpen from 'phosphor-svelte/lib/LockOpen';
  import { haversine } from '../lib/carto';
  import Minus from 'phosphor-svelte/lib/Minus';
  import Plus from 'phosphor-svelte/lib/Plus';
  import ArrowsOutCardinal from 'phosphor-svelte/lib/ArrowsOutCardinal';
  import MagnifyingGlassPlus from 'phosphor-svelte/lib/MagnifyingGlassPlus';
  import MagnifyingGlassMinus from 'phosphor-svelte/lib/MagnifyingGlassMinus';
  import CornersIn from 'phosphor-svelte/lib/CornersIn';
  import GridFour from 'phosphor-svelte/lib/GridFour';
  import Copy from 'phosphor-svelte/lib/Copy';
  import EyeSlash from 'phosphor-svelte/lib/EyeSlash';
  import Trash from 'phosphor-svelte/lib/Trash';
  import Sliders from 'phosphor-svelte/lib/Sliders';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';

  interface Props {
    main: MainScene | null;
    insets: Record<string, InsetScene | null>;
    /** the detail maps' scenes, their names and images, by part id */
    details: Record<string, DetailDraw | null>;
    scale: ScaleBarSpec | null;
    credits: string[];
    labels: Record<string, LayerDraw['labels']>;
    terrainHref?: string | null;
    elevation?: { min: number; max: number } | null;
    basemapHref?: string | null;
    svgEl?: SVGSVGElement;
  }
  let { main, insets, details, scale, credits, labels, terrainHref = null, elevation = null, basemapHref = null, svgEl = $bindable() }: Props = $props();

  let host: HTMLDivElement;
  let hostW = $state(900);
  let hostH = $state(700);
  let userZoom = $state<number | null>(null);
  $effect(() => {
    const ro = new ResizeObserver(([e]) => { hostW = e.contentRect.width; hostH = e.contentRect.height; });
    ro.observe(host);
    return () => ro.disconnect();
  });

  /* ---------- QGIS-style layout chrome: palette column, rulers, status bar ---------- */
  const PAL = 48, RUL = 20, TOP = 0; // palette width, ruler thickness, band above the rulers (none: the rulers meet the top bar, the toolbar floats below them)
  // phones keep the simple view; so does the empty first screen, where only the search matters
  // phone or not is the window's width (as in the CSS), not the desk's: at 1100 px the desk is only about 730 px wide,
  // and judging by the desk made a laptop get the phone fit (page too big for the desk) and lose its rulers
  let winW = $state(typeof window === 'undefined' ? 1200 : window.innerWidth);
  const chrome = $derived(winW > 760 && store.doc.study.source !== 'none');
  let stageEl = $state<HTMLDivElement>();
  let scrollerEl = $state<HTMLDivElement>();
  let pageOff = $state<[number, number]>([0, 0]);
  function measure() {
    if (!stageEl || !host) return;
    const a = stageEl.getBoundingClientRect(), b = host.getBoundingClientRect();
    pageOff = [a.left - b.left, a.top - b.top];
  }
  $effect(() => {
    void pxPerMm; void hostW; void hostH; void store.doc.widthMm; void store.doc.heightMm; void chrome;
    requestAnimationFrame(measure);
  });
  let picInput = $state<HTMLInputElement>();
  async function pickPicture(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      store.pendingImage = (await readPicture(f)).href;
      store.addKind = 'image';
    } catch { store.status = t('Could not read that picture. Use PNG, JPEG, SVG or WebP.'); }
  }
  const PALETTE = [
    { k: 'text', label: 'Add text', icon: TextT },
    { k: 'legend', label: 'Add legend', icon: ListBullets },
    { k: 'scale', label: 'Add scale bar', icon: Ruler },
    { k: 'north', label: 'Add north arrow', icon: NavigationArrow },
    { k: 'locator', label: 'Add inset map', icon: MapTrifold },
    { k: 'detail', label: 'Add detail map', icon: FrameCorners },
    { k: 'table', label: 'Add table of sites', icon: TableIcon },
    { k: 'profile', label: 'Add elevation profile', icon: ChartLine },
    { k: 'image', label: 'Add picture or logo', icon: ImageIcon },
    { k: 'rect', label: 'Add rectangle', icon: Square },
    { k: 'ellipse', label: 'Add ellipse', icon: CircleIcon },
    { k: 'line', label: 'Add line', icon: LineSegment },
    { k: 'arrow', label: 'Add arrow', icon: ArrowUpRight },
  ] as const;
  // drawing on the map itself (into the "My drawing" layer), after the page tools
  const MAPDRAW = [
    { t: 'point', label: 'Draw points on the map', name: 'Points', icon: MapPin },
    { t: 'line', label: 'Draw a line on the map', name: 'Line', icon: PathIcon },
    { t: 'polygon', label: 'Draw an area on the map', name: 'Area', icon: PolygonIcon },
    { t: 'freehand', label: 'Draw freehand on the map', name: 'Freehand', icon: Scribble },
  ] as const;
  function pickDraw(t: (typeof MAPDRAW)[number]['t']) {
    if (store.drawTarget && store.tool === t) { store.tool = 'select'; store.drawTarget = null; return; }
    drawOnMap(t);
  }
  function pickTool(k: (typeof PALETTE)[number]['k']) {
    store.tool = 'select';
    store.drawTarget = null;
    if (k === 'image') { picInput?.click(); return; }
    store.addKind = store.addKind === k ? null : k;
  }

  /* ---------- the tool strip: a few buttons, the families of tools open a small labelled menu beside it ---------- */
  type GroupId = 'parts' | 'shapes' | 'draw';
  /** off: the reason a tool cannot be used yet (shown as its tooltip and on the status line), or '' when it can */
  type FlyItem = { id: string; label: string; name: string; icon: typeof TextT; run: () => void; active: () => boolean; off?: () => string };
  /** a page tool, by its key in PALETTE: the accessible name stays "Add rectangle", the menu shows the plain word */
  const pageTool = (k: (typeof PALETTE)[number]['k'], name: string, off?: () => string): FlyItem => {
    const p = PALETTE.find((x) => x.k === k)!;
    return { id: k, label: p.label, name, icon: p.icon, run: () => pickTool(k), active: () => store.addKind === k, off };
  };
  // the table needs sample points, the profile a line drawn on the map
  const needSites = () => (sitesLayers(store.doc, store.geoms).length ? '' : t('Add sample points first to make a table of them'));
  const needLine = () => (drawnLines(store.doc, store.geoms).length ? '' : t('Draw a line on the map first to make a profile of it'));
  const FLY: Record<GroupId, { label: string; tip: string; items: FlyItem[] }> = {
    parts: { label: 'Map parts', tip: 'Map parts: legend, scale bar, north arrow, inset map, detail map, table, elevation profile', items: [pageTool('legend', 'Legend'), pageTool('scale', 'Scale bar'), pageTool('north', 'North arrow'), pageTool('locator', 'Inset map'), pageTool('detail', 'Detail map'), pageTool('table', 'Table of sites', needSites), pageTool('profile', 'Elevation profile', needLine)] },
    shapes: { label: 'Shapes', tip: 'Shapes: rectangle, ellipse, line, arrow', items: [pageTool('rect', 'Rectangle'), pageTool('ellipse', 'Ellipse'), pageTool('line', 'Line'), pageTool('arrow', 'Arrow')] },
    draw: { label: 'Draw on the map', tip: 'Draw on the map: points, line, area, freehand', items: MAPDRAW.map((d) => ({ id: d.t, label: d.label, name: d.name, icon: d.icon, run: () => pickDraw(d.t), active: () => !!store.drawTarget && store.tool === d.t })) },
  };
  const GROUPS: GroupId[] = ['parts', 'shapes', 'draw'];
  // the button of a family shows the tool used last in it (the running one while it runs)
  let last = $state<Record<GroupId, string>>({ parts: 'legend', shapes: 'rect', draw: 'point' });
  const running = (g: GroupId) => FLY[g].items.find((i) => i.active());
  const shown = (g: GroupId) => running(g) ?? FLY[g].items.find((i) => i.id === last[g]) ?? FLY[g].items[0];
  $effect(() => { for (const g of GROUPS) { const r = running(g); if (r) last[g] = r.id; } });
  let fly = $state<{ g: GroupId; y: number; kb: boolean } | null>(null);
  let flyBtn: HTMLElement | null = null; // the button that opened the menu, so Esc can give focus back to it
  /** The menu's top: level with its button, kept on the desk (rows are at most 44 px tall). */
  const flyTop = $derived(fly ? Math.max(6, Math.min(fly.y - 6, hostH - FLY[fly.g].items.length * 44 - 20)) : 0);
  function openFly(b: HTMLElement, g: GroupId, kb: boolean) {
    const r = b.getBoundingClientRect(), h = host.getBoundingClientRect();
    flyBtn = b;
    tip = null;
    fly = { g, y: r.top - h.top, kb };
  }
  // a click from the keyboard (Enter, Space) has no pointer, and the menu takes focus then
  function toggleFly(e: MouseEvent, g: GroupId) {
    if (fly?.g === g) closeFly(false);
    else openFly(e.currentTarget as HTMLElement, g, e.detail === 0);
  }
  function closeFly(refocus: boolean) {
    const b = flyBtn;
    fly = null;
    if (refocus && b?.isConnected) b.focus({ preventScroll: true });
  }
  function choose(g: GroupId, it: FlyItem) {
    const why = it.off?.();
    if (why) { store.status = t('{why}.', { why }); return; }
    last[g] = it.id;
    it.run();
    closeFly(true);
  }
  /** ArrowRight or ArrowDown on a family button opens its menu (or steps into it) from the keyboard. */
  function groupKey(e: KeyboardEvent, g: GroupId) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    if (fly?.g === g) document.querySelector<HTMLElement>('.flyout [role=menuitem]')?.focus();
    else openFly(e.currentTarget as HTMLElement, g, true);
  }
  /** Arrow keys, Home and End move between the rows; Left, Tab and Esc close the menu and give focus back to its button. */
  function flyKey(e: KeyboardEvent) {
    if (e.key === 'Tab' || e.key === 'ArrowLeft') { e.preventDefault(); closeFly(true); return; }
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=menuitem]')];
    const i = items.indexOf(document.activeElement as HTMLElement), end = items.length - 1;
    const to = e.key === 'ArrowDown' ? (i < end ? i + 1 : 0) : e.key === 'ArrowUp' ? (i > 0 ? i - 1 : end) : e.key === 'Home' ? 0 : e.key === 'End' ? end : -1;
    if (to < 0) return;
    e.preventDefault();
    items[to].focus();
  }
  /** Opened from the keyboard, the menu takes focus: the running tool's row, else the first. */
  function flyFocus(node: HTMLElement, kb: boolean) {
    if (kb) (node.querySelector<HTMLElement>('[aria-current=true]') ?? node.querySelector<HTMLElement>('[role=menuitem]'))?.focus({ preventScroll: true });
  }
  $effect(() => {
    if (!fly) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element)?.closest?.('.flyout, .pal.has-menu')) closeFly(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); closeFly(true); } };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key, true); };
  });
  $effect(() => { if (!chrome) fly = null; });
  // a strip taller than the desk scrolls, with a soft fade at the edge that has more behind it
  let palEl = $state<HTMLDivElement>();
  let palFade = $state({ t: false, b: false });
  function palScroll() {
    const e = palEl;
    if (e) palFade = { t: e.scrollTop > 2, b: e.scrollTop + e.clientHeight < e.scrollHeight - 2 };
  }
  $effect(() => {
    if (!palEl) return;
    const ro = new ResizeObserver(palScroll);
    ro.observe(palEl);
    palScroll();
    return () => ro.disconnect();
  });

  // a table's box follows its rows, and an elevation profile reads the ground height along its line (see lib/figparts.svelte.ts)
  $effect(() => { fitTables(); });
  $effect(() => { syncProfiles(); });

  const W = $derived(store.doc.widthMm);
  const H = $derived(store.doc.heightMm);
  // the palette column and rulers take room on wider screens (see .scroller.chrome)
  // phones have only the 8px side padding and the toolbar band, so the page gets nearly the whole width
  const phone = $derived(winW <= 760);
  const fit = $derived(Math.max(0.4, Math.min((hostW - (phone ? 20 : 72) - (chrome ? 68 : 0)) / W, (hostH - (phone ? 120 : 150) - (chrome ? 20 : 0)) / H)));
  const pxPerMm = $derived(userZoom ?? fit);
  const pageW = $derived(W * pxPerMm);
  const pageH = $derived(H * pxPerMm);
  const pct = $derived(Math.round((pxPerMm / (96 / 25.4)) * 100));

  const sel = $derived(store.doc.items.find((i) => i.id === store.selected) ?? null);
  /** the selected part's main text, for the B / I / size buttons */
  const txt = $derived(sel ? itemText(sel) : null);
  /** the parts selected together (Shift+click), the leading one first; the main map is never grouped and a part hidden since is left out */
  const group = $derived(store.selected ? store.selection.map((id) => store.doc.items.find((i) => i.id === id)).filter((i): i is Item => !!i && i.kind !== 'map' && i.visible) : []);
  const multi = $derived(group.length > 1);
  /** the parts of the group that have text; the first of them sets whether Bold / Italic show as pressed */
  const groupTexts = $derived(group.filter((i) => itemText(i)));
  const gtxt = $derived(groupTexts.length ? itemText(groupTexts[0]) : null);
  const map = $derived(store.map as MapItem);
  /** the selected detail map, and the one waiting for a box dragged on the main map */
  const selDetail = $derived(sel?.kind === 'detail' ? sel : null);
  const picking = $derived(store.detailPick ? (store.doc.items.find((i) => i.id === store.detailPick && i.kind === 'detail') as DetailItem | undefined) ?? null : null);
  const adjusting = $derived(store.tool === 'adjust');
  const drawing = $derived(['rect', 'circle', 'polygon', 'freehand', 'point', 'line'].includes(store.tool));
  const target = $derived(store.drawTarget ? store.doc.layers.find((l) => l.id === store.drawTarget) ?? null : null);
  // the layer being drawn into went away (undone, deleted): stop drawing instead of adding to nothing
  $effect(() => { if (store.drawTarget && !target) { store.drawTarget = null; store.tool = 'select'; } });

  /* ---------- editing text right on the figure ---------- */
  let editing = $state<string | null>(null);
  const editItem = $derived(editing ? store.doc.items.find((i) => i.id === editing) ?? null : null);
  let editOriginal = '';
  let editIsNew = false;
  function startEdit(it: Item, isNew = false) {
    editIsNew = isNew;
    editOriginal = it.kind === 'title' ? it.text : it.kind === 'inset' ? it.label : '';
    if (it.kind === 'title' || it.kind === 'inset') { store.select(it.id); editing = it.id; }
    else { store.select(it.id); store.openSettings(); } // anything else: double-click opens its settings
  }
  function endEdit(refocus = false, cancel = false) {
    if (!editing) return;
    const it = store.doc.items.find((i) => i.id === editing);
    editing = null;
    // a text left empty (or a new one cancelled with Esc) is removed rather than kept as an invisible box
    if (it?.kind === 'title' && ((cancel && editIsNew) || !it.text.trim())) {
      store.doc.items = store.doc.items.filter((i) => i !== it);
      store.select(null);
      if (!cancel) store.status = t('The empty text was removed.');
    }
    editIsNew = false;
    store.commit();
    if (refocus) { pointerFocus = true; overlay?.focus({ preventScroll: true }); } // after Enter or Esc, arrow keys nudge the text again
  }
  /** The editor opens while another element has focus, which the autofocus attribute leaves alone, so focus it here. */
  function focusSelect(node: HTMLTextAreaElement) {
    requestAnimationFrame(() => { node.focus({ preventScroll: true }); node.select(); });
  }
  const isLine = (it: Item) => it.kind === 'shape' && (it.shape === 'line' || it.shape === 'arrow');
  function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax, vy = by - ay, L = vx * vx + vy * vy;
    const t = L ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0;
    return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
  }

  /* ---------- map content preview while panning or zooming ---------- */
  let previewPan = $state<[number, number]>([0, 0]);
  let previewZoom = $state<{ s: number; cx: number; cy: number; /** the map frame (item id) being zoomed */ id: string } | null>(null);
  const contentTransform = $derived.by(() => {
    const [dx, dy] = previewPan;
    const z = previewZoom;
    let t = dx || dy ? `translate(${dx},${dy})` : '';
    if (z) t += ` translate(${z.cx},${z.cy}) scale(${z.s}) translate(${-z.cx},${-z.cy})`;
    return t.trim();
  });

  /* ---------- pointer interaction ---------- */
  type Mode = 'move' | 'resize' | 'pan' | 'draw' | 'ipan' | 'add' | 'label' | 'rotate' | 'marquee' | 'dbox';
  type Corner = 'nw' | 'ne' | 'sw' | 'se' | 'p1' | 'p2';
  // moved: the pointer has travelled far enough to count as a drag (a click moves nothing); opin / pinned: the flags to put back on cancel;
  // shiftHandle: a Shift press that landed on a resize handle, which still counts as a Shift+click if nothing is dragged
  let drag = $state<{ mode: Mode; id: string; corner?: Corner; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; group?: { id: string; ox: number; oy: number; pinned?: boolean }[]; moved?: boolean; opin?: boolean; shiftHandle?: boolean; /** a dragged name's feature */ name?: string; /** the map (or a feature in it) was already selected: a click picks what is under it */ inside?: boolean; /** a part of a group that was already picked: a click picks only that part */ enter?: boolean; /** a box drawn with Shift adds to the selection */ add?: boolean } | null>(null);
  /** the map frame a pan or zoom gesture is moving now: the detail map's id, or the main map's */
  const contentFor = $derived(drag?.mode === 'pan' ? drag.id : previewZoom?.id);
  // the box dragged across empty page to pick every part inside it
  let marquee = $state<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  let guides = $state<{ x: number[]; y: number[] }>({ x: [], y: [] });
  let draft = $state<[number, number][]>([]); // page mm
  let hover = $state<[number, number] | null>(null);
  const SNAP = 1.5;
  const MOVE_PX = 3; // how far (screen pixels) the pointer must travel before a press becomes a drag

  function toMm(e: PointerEvent | WheelEvent | MouseEvent): [number, number] {
    const r = overlay.getBoundingClientRect();
    return [(e.clientX - r.left) / pxPerMm, (e.clientY - r.top) / pxPerMm];
  }
  let overlay: SVGSVGElement;
  let pointerFocus = $state(false);

  function hit(x: number, y: number): Item | null {
    const items = store.doc.items.filter((i) => i.visible && (store.doc.study.source !== 'none' || i.kind === 'map'));
    const hits = items.filter((i) => {
      if (isLine(i)) return segDist(x, y, i.x, i.y, i.x + i.w, i.y + i.h) <= 1.5; // only near the line itself
      // a turned part: test the point turned back into the part's own frame
      const rr = ((i.look?.rotate ?? 0) * Math.PI) / 180;
      if (rr) {
        const cx = i.x + i.w / 2, cy = i.y + i.h / 2, px = x - cx, py = y - cy;
        const lx = cx + px * Math.cos(rr) + py * Math.sin(rr), ly = cy - px * Math.sin(rr) + py * Math.cos(rr);
        return lx >= Math.min(i.x, i.x + i.w) - 0.6 && lx <= Math.max(i.x, i.x + i.w) + 0.6 && ly >= Math.min(i.y, i.y + i.h) - 0.6 && ly <= Math.max(i.y, i.y + i.h) + 0.6;
      }
      const x0 = Math.min(i.x, i.x + i.w), x1 = Math.max(i.x, i.x + i.w), y0 = Math.min(i.y, i.y + i.h), y1 = Math.max(i.y, i.y + i.h);
      return x >= x0 - 0.6 && x <= x1 + 0.6 && y >= y0 - 0.6 && y <= y1 + 0.6;
    });
    // smallest first (a legend on the map wins over the map); a line near the pointer before boxes; equal sizes: the top one
    const area = (i: Item) => (isLine(i) ? 0 : Math.abs(i.w * i.h));
    const order = (i: Item) => store.doc.items.indexOf(i);
    hits.sort((a, b) => area(a) - area(b) || order(b) - order(a));
    return hits[0] ?? null;
  }
  const inMap = (x: number, y: number) => x >= map.x && x <= map.x + map.w && y >= map.y && y <= map.y + map.h;

  function onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const [x, y] = toMm(e);
    overlay.setPointerCapture(e.pointerId);
    e.preventDefault();
    // preventDefault keeps focus where it was (often a toolbar button, where Enter would press it again), so take it here
    pointerFocus = true;
    overlay.focus({ preventScroll: true });
    // a plain note (not a problem, not an Undo) has done its job once the next click lands on the map
    if (store.status && !problem && store.undoFor !== store.status) store.status = '';
    if (store.addKind) {
      if (store.addKind === 'image' && !store.pendingImage) return;
      draft = [[x, y], [x, y]];
      drag = { mode: 'add', id: '', sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0 };
      return;
    }
    if (picking) {
      // a box dragged on the main map says what the detail map shows
      if (!inMap(x, y) || !main) { store.status = t('Drag the box on the main map.'); return; }
      draft = [[x, y], [x, y]];
      drag = { mode: 'dbox', id: picking.id, sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0 };
      return;
    }
    if (drawing) {
      overlay.focus({ preventScroll: true }); // so Enter can finish a line or area
      if (!inMap(x, y) || !main) return;
      if (hit(x, y)?.kind === 'detail') { store.status = t('Draw on the main map: a detail map cannot be drawn on yet.'); return; }
      if (store.tool === 'polygon' || store.tool === 'line') {
        draft = [...draft, [x, y]];
        return;
      }
      if (store.tool === 'point') {
        draft = [[x, y]];
        finishDraw(false);
        draft = [];
        return;
      }
      draft = [[x, y]];
      drag = { mode: 'draw', id: '', sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0 };
      return;
    }
    if (adjusting) {
      if (!inMap(x, y)) { store.tool = 'select'; return; }
      drag = { mode: 'pan', id: map.id, sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0 };
      return;
    }
    // the turn handle above a selected part: drag round its centre
    if ((e.target as Element).closest('[data-rotate]') && sel && !sel.locked) {
      drag = { mode: 'rotate', id: sel.id, sx: x, sy: y, ox: sel.look?.rotate ?? 0, oy: 0, ow: 0, oh: 0 };
      return;
    }
    const handle = (e.target as Element).closest('[data-corner]') as SVGElement | null;
    const it = handle && sel ? sel : hit(x, y);
    // a Shift+click that lands on the map or on nothing keeps the selection (and never pans the map)
    // a drag across empty page (or with Shift across the map) draws a box that picks every part inside it;
    // a plain click on empty page selects the page itself, so its size tools appear (in onUp)
    if (!handle && (!it || (e.shiftKey && it.kind === 'map'))) {
      drag = { mode: 'marquee', id: '', sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0, add: e.shiftKey };
      marquee = null;
      return;
    }
    if (!it) return;
    // Shift+click adds a part to the selection or takes it out (the main map is not grouped)
    if (e.shiftKey && !handle && it.kind !== 'map') { shiftPick(it); return; }
    const grip = (e.target as Element).closest('[data-grip]');
    if (!handle && !grip && it.kind === 'map' && store.doc.study.source !== 'none') {
      const edge = Math.min(x - it.x, it.x + it.w - x, y - it.y, it.y + it.h - y);
      if (edge > 2.5) {
        // the name picked a moment ago drags to a new place; anything else pans the map
        const pk = store.picked;
        const under = pk?.what === 'label' && !pk.frame && svgEl ? pickAt(svgEl, e.clientX, e.clientY, it.id) : null;
        if (pk && under && under.what === 'label' && under.layerId === pk.layerId && under.name === pk.name) {
          const fs = store.doc.layers.find((l) => l.id === pk.layerId)?.featureStyle?.[pk.name];
          drag = { mode: 'label', id: pk.layerId, name: pk.name, sx: x, sy: y, ox: fs?.labelDx ?? 0, oy: fs?.labelDy ?? 0, ow: 0, oh: 0 };
          return;
        }
        // first click selects the map; once it (or a feature in it) is selected, a click picks the name, line, point or area under it
        const inside = store.selected === it.id || (!!store.picked && !store.picked.frame);
        if (!inside) store.select(it.id);
        drag = { mode: 'pan', id: it.id, sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0, inside };
        return;
      }
    }
    // A selected detail map pans its content when dragged inside, as the main map does (its edge moves the frame); a click picks what is under it.
    if (!handle && !grip && it.kind === 'detail' && !store.extra.length && (store.selected === it.id || store.picked?.frame === it.id)) {
      const edge = Math.min(x - it.x, it.x + it.w - x, y - it.y, it.y + it.h - y);
      if (edge > 2.5) {
        drag = { mode: 'pan', id: it.id, sx: x, sy: y, ox: 0, oy: 0, ow: 0, oh: 0, inside: true };
        return;
      }
    }
    // A selected locator map pans like the main map when dragged inside (its edge still moves it).
    if (!handle && !grip && it.kind === 'inset' && store.selected === it.id && !store.extra.length) {
      const edge = Math.min(x - it.x, it.x + it.w - x, y - it.y, it.y + it.h - y);
      if (edge > 2.5) {
        drag = { mode: 'ipan', id: it.id, sx: x, sy: y, ox: it.panX ?? 0, oy: it.panY ?? 0, ow: 0, oh: 0 };
        return;
      }
    }
    // a part of the group: the whole group moves with it (only while something is selected, so old group ids cannot count)
    const inGroup = !!store.selected && (store.selected === it.id || store.extra.includes(it.id));
    if (!inGroup) {
      store.select(it.id);
      // a grouped part brings its whole group (Ctrl+G); clicking it again then picks only that part
      if (it.group) store.extra = store.doc.items.filter((o) => o.group === it.group && o.id !== it.id && o.visible).map((o) => o.id);
    }
    if (it.locked) return; // locked in place, as in the QGIS Items panel
    const together = (inGroup || !!it.group) && !handle && store.extra.length ? group.filter((g) => g.id !== it.id && !g.locked).map((g) => ({ id: g.id, ox: g.x, oy: g.y, pinned: g.pinned })) : undefined;
    drag = { mode: handle ? 'resize' : 'move', corner: (handle?.dataset.corner as Corner) ?? undefined, id: it.id, sx: x, sy: y, ox: it.x, oy: it.y, ow: it.w, oh: it.h, group: together, opin: it.pinned, shiftHandle: e.shiftKey && !!handle, enter: inGroup };
  }

  /** Shift+click: add a part to the selection or take it out again (the main map is not grouped). */
  function shiftPick(it: Item) {
    if (!sel || sel.kind === 'map') store.select(it.id); else store.toggleExtra(it.id);
  }

  function snap(v: number, targets: number[]): number | null {
    let best: number | null = null, bd = SNAP;
    for (const t of targets) { const d = Math.abs(v - t); if (d < bd) { bd = d; best = t; } }
    return best;
  }

  function onMove(e: PointerEvent) {
    const [x, y] = toMm(e);
    hover = [x, y];
    if (!drag) return;
    const dx = x - drag.sx, dy = y - drag.sy;
    if (drag.mode === 'draw') {
      if (store.tool === 'freehand') {
        const last = draft[draft.length - 1];
        if (!last || Math.hypot(x - last[0], y - last[1]) > 0.8) draft = [...draft, [x, y]];
      } else draft = [draft[0], [x, y]];
      return;
    }
    if (drag.mode === 'pan') { previewPan = [dx, dy]; return; }
    if (drag.mode === 'label') { moveLabel(dx, dy); return; }
    if (drag.mode === 'rotate') { turnTo(x, y, e.shiftKey); return; }
    if (drag.mode === 'marquee') { marquee = { x0: drag.sx, y0: drag.sy, x1: x, y1: y }; return; }
    if (drag.mode === 'dbox') { draft = [draft[0], [Math.min(map.x + map.w, Math.max(map.x, x)), Math.min(map.y + map.h, Math.max(map.y, y))]]; return; }
    if (drag.mode === 'add') { draft = [draft[0], [x, y]]; return; }
    if (drag.mode === 'ipan') {
      const ins = store.doc.items.find((i) => i.id === drag!.id);
      if (ins && ins.kind === 'inset') { ins.panX = Math.round((drag.ox + dx) * 10) / 10; ins.panY = Math.round((drag.oy + dy) * 10) / 10; }
      return;
    }
    // a click is not a drag: nothing moves until the pointer has travelled a few pixels (a trackpad jitter or a snap must not shift parts)
    if (!drag.moved) {
      if (Math.hypot(dx, dy) * pxPerMm < MOVE_PX) return;
      drag.moved = true;
    }
    const it = store.doc.items.find((i) => i.id === drag!.id);
    if (!it) return;
    if (!it.pinned && (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3)) it.pinned = true;
    if (drag.mode === 'resize' && it.kind === 'title' && it.autoW) it.autoW = false;
    if (drag.mode === 'resize' && it.kind === 'table') it.fit = false; // sized by hand: the box no longer follows the table
    const others = store.doc.items.filter((i) => i.id !== it.id && i.visible && !drag!.group?.some((g) => g.id === i.id));
    const gd = store.doc.guides ?? { x: [], y: [] };
    const xs = [0, W / 2, W, 5, W - 5, ...gd.x, ...others.flatMap((o) => [o.x, o.x + o.w, o.x + o.w / 2])];
    const ys = [0, H / 2, H, 5, H - 5, ...gd.y, ...others.flatMap((o) => [o.y, o.y + o.h, o.y + o.h / 2])];
    const gx: number[] = [], gy: number[] = [];
    const r1 = (v: number) => Math.round(v * 10) / 10;
    if (drag.mode === 'move') {
      let nx = drag.ox + dx, ny = drag.oy + dy;
      if (!e.altKey) {
        for (const off of [0, it.w, it.w / 2]) { const g = snap(nx + off, xs); if (g != null) { nx = g - off; gx.push(g); break; } }
        for (const off of [0, it.h, it.h / 2]) { const g = snap(ny + off, ys); if (g != null) { ny = g - off; gy.push(g); break; } }
      }
      it.x = r1(nx); it.y = r1(ny);
      if (drag.group) {
        const ddx = it.x - drag.ox, ddy = it.y - drag.oy;
        for (const g of drag.group) { const o = store.doc.items.find((i) => i.id === g.id); if (o) { o.x = r1(g.ox + ddx); o.y = r1(g.oy + ddy); o.pinned = true; } }
      }
    } else {
      const c = drag.corner!;
      // a turned part resizes along its own sides: the pointer's move is turned back into the part's frame
      const rr = ((it.look?.rotate ?? 0) * Math.PI) / 180;
      const ldx = rr ? dx * Math.cos(rr) + dy * Math.sin(rr) : dx, ldy = rr ? -dx * Math.sin(rr) + dy * Math.cos(rr) : dy;
      if (c === 'p1') { it.x = r1(drag.ox + ldx); it.y = r1(drag.oy + ldy); it.w = r1(drag.ow - ldx); it.h = r1(drag.oh - ldy); }
      else if (c === 'p2') { it.w = r1(drag.ow + ldx); it.h = r1(drag.oh + ldy); }
      else {
        let x0 = drag.ox, y0 = drag.oy, x1 = drag.ox + drag.ow, y1 = drag.oy + drag.oh;
        if (c.includes('w')) x0 += ldx; else x1 += ldx;
        if (c.includes('n')) y0 += ldy; else y1 += ldy;
        if (!e.altKey && !rr) {
          const ex = c.includes('w') ? x0 : x1, ey = c.includes('n') ? y0 : y1;
          const sx = snap(ex, xs), sy = snap(ey, ys);
          if (sx != null) { if (c.includes('w')) x0 = sx; else x1 = sx; gx.push(sx); }
          if (sy != null) { if (c.includes('n')) y0 = sy; else y1 = sy; gy.push(sy); }
        }
        const keepRatio = it.kind === 'north' || (it.kind === 'inset' && it.context === 'globe') || e.shiftKey;
        let w = Math.max(4, x1 - x0), h = Math.max(4, y1 - y0);
        if (keepRatio && drag.ow > 0) h = w * (drag.oh / drag.ow);
        if (c.includes('n')) y0 = y1 - h;
        if (c.includes('w')) x0 = x1 - w;
        it.x = r1(x0); it.y = r1(y0); it.w = r1(w); it.h = r1(h);
        if (rr) {
          // the corner across from the one dragged stays put on the page
          const fixed = (bx: number, by: number, bw: number, bh: number): [number, number] => {
            const px = c.includes('w') ? bx + bw : bx, py = c.includes('n') ? by + bh : by, cx = bx + bw / 2, cy = by + bh / 2;
            return [cx + (px - cx) * Math.cos(rr) - (py - cy) * Math.sin(rr), cy + (px - cx) * Math.sin(rr) + (py - cy) * Math.cos(rr)];
          };
          const a = fixed(drag.ox, drag.oy, drag.ow, drag.oh), b = fixed(it.x, it.y, it.w, it.h);
          it.x = r1(it.x + a[0] - b[0]); it.y = r1(it.y + a[1] - b[1]);
        }
      }
    }
    guides = { x: gx, y: gy };
  }

  /** Freehand strokes: thin points closer than 1 mm, then two rounds of corner cutting (Chaikin). */
  function smoothRing(pts: [number, number][]): [number, number][] {
    let out: [number, number][] = [pts[0]];
    for (const p of pts) { const q = out[out.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= 1) out.push(p); }
    if (out.length < 3) return pts;
    for (let k = 0; k < 2; k++) {
      const next: [number, number][] = [];
      for (let i = 0; i < out.length; i++) {
        const p = out[i], q = out[(i + 1) % out.length];
        next.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]);
      }
      out = next;
    }
    return out;
  }

  function finishDraw(add: boolean) {
    if (!main) return;
    const fp = main.fp;
    const toLL = (p: [number, number]) => fp.inverse([p[0] - map.x, p[1] - map.y]);
    let ring: [number, number][] = [];
    const t = store.tool;
    if (t === 'rect' && draft.length === 2) {
      const [[ax, ay], [bx, by]] = draft;
      if (Math.abs(bx - ax) < 1 || Math.abs(by - ay) < 1) return;
      const pts: [number, number][] = [];
      const n = 12;
      for (let i = 0; i <= n; i++) pts.push([ax + ((bx - ax) * i) / n, ay]);
      for (let i = 1; i <= n; i++) pts.push([bx, ay + ((by - ay) * i) / n]);
      for (let i = 1; i <= n; i++) pts.push([bx - ((bx - ax) * i) / n, by]);
      for (let i = 1; i <= n; i++) pts.push([ax, by - ((by - ay) * i) / n]);
      ring = pts.map(toLL).filter(Boolean) as [number, number][];
    } else if (t === 'circle' && draft.length === 2) {
      const c = toLL(draft[0]), edge = toLL(draft[1]);
      if (!c || !edge) return;
      const r = haversine(c, edge);
      if (r < 1) return;
      ring = circleRing(c, r);
    } else if (t === 'point' && draft.length >= 1) {
      const p = toLL(draft[0]);
      if (p && store.drawTarget) addToLayer(store.drawTarget, { type: 'Point', coordinates: p });
      return;
    } else if (t === 'line' && draft.length >= 2) {
      const line = draft.map(toLL).filter(Boolean) as [number, number][];
      if (line.length >= 2 && store.drawTarget) addToLayer(store.drawTarget, { type: 'LineString', coordinates: line });
      return;
    } else if ((t === 'polygon' || t === 'freehand') && draft.length >= 3) {
      ring = (t === 'freehand' ? smoothRing(draft) : draft).map(toLL).filter(Boolean) as [number, number][];
      ring.push(ring[0]);
    }
    if (ring.length < 4) return;
    if (store.drawTarget) { addToLayer(store.drawTarget, { type: 'Polygon', coordinates: [ring] }); return; } // keep drawing into the layer
    setDrawnArea(ring, add, store.doc.study.source === 'none' ? null : fp);
    store.tool = 'select';
  }

  function onUp(e: PointerEvent) {
    if (drag?.mode === 'add') {
      const [[ax, ay], [bx, by]] = draft;
      const kind = store.addKind;
      if (kind) addInBox(kind, { x: ax, y: ay, w: bx - ax, h: by - ay }, [bx, by]);
      store.addKind = null;
      // a new text box opens ready for typing
      const added = kind === 'text' ? store.doc.items.find((i) => i.id === store.selected) : null;
      if (added?.kind === 'title') startEdit(added, true);
      draft = [];
    } else if (drag?.mode === 'draw') {
      if (store.tool !== 'polygon') { finishDraw(e.shiftKey); draft = []; }
    } else if (drag?.mode === 'dbox') {
      const [[ax, ay], [bx, by]] = draft;
      const d = store.doc.items.find((i) => i.id === drag!.id);
      draft = [];
      store.detailPick = null;
      if (d?.kind === 'detail') setDetailBox(d, { x0: Math.min(ax, bx) - map.x, y0: Math.min(ay, by) - map.y, x1: Math.max(ax, bx) - map.x, y1: Math.max(ay, by) - map.y });
    } else if (drag?.mode === 'pan') {
      const [dx, dy] = previewPan;
      const frame = store.doc.items.find((i) => i.id === drag!.id);
      const detail = frame?.kind === 'detail' ? frame : null;
      if (Math.hypot(dx, dy) > 0.3) {
        if (detail) panDetail(detail, dx, dy);
        else {
          // a rotated map pans along its own (unrotated) axes
          const [ux, uy] = unrotate(dx, dy);
          store.doc.view.panX += ux;
          store.doc.view.panY += uy;
          store.commit();
        }
      } else if (drag.inside && svgEl) {
        // a click, not a drag, on a selected map: pick what lies under the pointer, as a GIS Identify tool does
        const p = pickAt(svgEl, e.clientX, e.clientY, drag.id);
        if (p && p.what !== 'grid') { store.select(p.layerId, true); store.picked = { layerId: p.layerId, name: p.name, what: p.what, frame: detail?.id }; }
        else { store.picked = null; store.select(drag.id, p?.what === 'grid'); }
      }
      previewPan = [0, 0];
    } else if (drag?.mode === 'label' || drag?.mode === 'rotate') {
      if (drag.moved) store.commit();
    } else if (drag?.mode === 'marquee') {
      const m = marquee;
      marquee = null;
      if (!m || (Math.abs(m.x1 - m.x0) < 1 && Math.abs(m.y1 - m.y0) < 1)) {
        if (!drag.add) { store.select(null); pageOn = true; } // a click, not a box: the page itself
      } else {
        const x0 = Math.min(m.x0, m.x1), x1 = Math.max(m.x0, m.x1), y0 = Math.min(m.y0, m.y1), y1 = Math.max(m.y0, m.y1);
        const inside = store.doc.items.filter((i) => i.visible && i.kind !== 'map' && Math.min(i.x, i.x + i.w) >= x0 && Math.max(i.x, i.x + i.w) <= x1 && Math.min(i.y, i.y + i.h) >= y0 && Math.max(i.y, i.y + i.h) <= y1);
        // groups come whole; with Shift the parts already picked stay picked
        const ids = new Set([...(drag.add ? store.selection : []), ...inside.map((i) => i.id)]);
        for (const i of store.doc.items) if (i.group && inside.some((o) => o.group === i.group) && i.visible) ids.add(i.id);
        const list = [...ids];
        if (list.length) { store.select(list[0]); store.extra = list.slice(1); }
        else if (!drag.add) store.select(null);
      }
    } else if (drag?.mode === 'ipan') {
      store.commit();
    } else if (drag) {
      const it = store.doc.items.find((i) => i.id === drag!.id);
      if (!drag.moved) {
        // a click, not a drag: nothing moved, so there is nothing to keep or to undo
        if (it && drag.mode === 'move' && drag.group && drag.enter) store.select(it.id); // click a member of the picked group: just that part
        else if (drag.shiftHandle) { // Shift+click that landed on a resize handle still picks the part under the pointer
          const [x, y] = toMm(e);
          const under = hit(x, y);
          if (under && under.kind !== 'map') shiftPick(under);
        }
      } else {
        if (it && (drag.mode === 'move' || drag.mode === 'resize') && (it.x !== drag.ox || it.y !== drag.oy || it.w !== drag.ow || it.h !== drag.oh)) it.pinned = true;
        store.commit();
      }
    }
    drag = null;
    guides = { x: [], y: [] };
  }

  /** The browser took the pointer away: undo the preview, keep nothing half-finished. */
  function onCancel() {
    if (drag && (drag.mode === 'move' || drag.mode === 'resize')) {
      const it = store.doc.items.find((i) => i.id === drag!.id);
      if (it) { it.x = drag.ox; it.y = drag.oy; it.w = drag.ow; it.h = drag.oh; it.pinned = drag.opin; }
      // the other parts of a dragged group go back too, with their pinned flags
      for (const g of drag.group ?? []) {
        const o = store.doc.items.find((i) => i.id === g.id);
        if (o) { o.x = g.ox; o.y = g.oy; o.pinned = g.pinned; }
      }
    }
    if (drag?.mode === 'ipan') {
      const it = store.doc.items.find((i) => i.id === drag!.id);
      if (it && it.kind === 'inset') { it.panX = drag.ox; it.panY = drag.oy; }
    }
    drag = null;
    if (store.tool !== 'polygon' && store.tool !== 'line') draft = [];
    previewPan = [0, 0];
    guides = { x: [], y: [] };
  }

  /** The second click of a double-click lands on the first one's point: drop that copy (a double-click off the map added none). */
  function dropTwin() {
    const a = draft[draft.length - 1], b = draft[draft.length - 2];
    if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) * pxPerMm < 6) draft = draft.slice(0, -1);
  }
  function onDbl(e: MouseEvent) {
    if (store.tool === 'line') {
      dropTwin();
      finishDraw(false);
      draft = [];
      return;
    }
    if (store.tool === 'polygon') {
      dropTwin();
      finishDraw(e.shiftKey);
      draft = [];
      return;
    }
    if (drawing) return; // points, freehand, rectangle, circle: a double-click never switches tools while drawing
    const [x, y] = toMm(e);
    const it = hit(x, y);
    if (it?.kind === 'map') { store.select(it.id); store.tool = 'adjust'; }
    else if (it) startEdit(it);
  }

  // Zoom inside the map: previewed immediately, rebuilt once the wheel stops.
  let zoomTimer: ReturnType<typeof setTimeout> | undefined;
  function onWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      userZoom = Math.min(16, Math.max(0.5, pxPerMm * Math.exp(-e.deltaY * 0.002)));
      return;
    }
    const [x, y] = toMm(e);
    const overAny = hit(x, y);
    if (overAny?.kind === 'inset' && store.doc.study.source !== 'none') { e.preventDefault(); zoomInset(overAny, Math.exp(-e.deltaY * 0.0018), x, y); return; }
    if (overAny?.kind === 'detail' && store.doc.study.source !== 'none') {
      e.preventDefault();
      if (previewZoom && previewZoom.id !== overAny.id) commitZoom();
      const cur = previewZoom ?? { s: 1, cx: x - overAny.x, cy: y - overAny.y, id: overAny.id };
      previewZoom = { s: Math.min(30, Math.max(0.05, cur.s * Math.exp(-e.deltaY * 0.0018))), cx: cur.cx, cy: cur.cy, id: overAny.id };
      clearTimeout(zoomTimer);
      zoomTimer = setTimeout(commitZoom, 220);
      return;
    }
    if (!inMap(x, y) || store.doc.study.source === 'none') return;
    const over = hit(x, y);
    if (over && over.kind === 'inset') {
      e.preventDefault();
      zoomInset(over, Math.exp(-e.deltaY * 0.0018), x, y);
      return;
    }
    if (over && over.kind !== 'map') return;
    e.preventDefault();
    const cx = x - map.x, cy = y - map.y;
    const step = Math.exp(-e.deltaY * 0.0018);
    if (previewZoom && previewZoom.id !== map.id) commitZoom();
    const cur = previewZoom ?? { s: 1, cx, cy, id: map.id };
    previewZoom = { s: Math.min(30, Math.max(0.05, cur.s * step)), cx: cur.cx, cy: cur.cy, id: map.id };
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(commitZoom, 220);
  }
  /** Zoom a locator map by factor s about page point (x, y); no point = its centre. */
  let insetTimer: ReturnType<typeof setTimeout> | undefined;
  function zoomInset(it: Item, s: number, x?: number, y?: number) {
    if (it.kind !== 'inset') return;
    const z = it.zoom ?? 1;
    const z2 = Math.min(200, Math.max(0.2, z * s));
    const f = z2 / z;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    const Px = (x ?? cx) - cx, Py = (y ?? cy) - cy;
    const px = it.panX ?? 0, py = it.panY ?? 0;
    it.zoom = Math.round(z2 * 1000) / 1000;
    it.panX = Math.round((Px - (Px - px) * f) * 10) / 10;
    it.panY = Math.round((Py - (Py - py) * f) * 10) / 10;
    clearTimeout(insetTimer);
    insetTimer = setTimeout(() => store.commit(), 250);
  }
  function resetInset(it: Item) { if (it.kind === 'inset') { it.zoom = 1; it.panX = 0; it.panY = 0; store.commit(); } }

  function commitZoom() {
    const z = previewZoom;
    if (!z) return;
    const detail = z.id !== map.id ? store.doc.items.find((i) => i.id === z.id) : null;
    if (detail?.kind === 'detail') { previewZoom = null; zoomDetail(detail, z.s, [z.cx, z.cy]); return; }
    const v = store.doc.view;
    const nz = Math.min(5000, Math.max(0.01, v.zoom * z.s));
    const real = nz / v.zoom;
    const [cx, cy] = unrotate(z.cx - map.w / 2, z.cy - map.h / 2);
    v.panX = (v.panX - cx) * real + cx;
    v.panY = (v.panY - cy) * real + cy;
    v.zoom = nz;
    previewZoom = null;
    store.commit();
  }
  // QGIS-style scale box: shows the printed scale, type another to zoom to it.
  let scaleEditing = $state(false);
  let scaleText = $state('');
  /** the scale box shows and sets the scale of the selected detail map, else of the main map */
  const scaleFrame = $derived(selDetail ? details[selDetail.id]?.scene ?? null : main);
  const setScale = (d: number) => { if (selDetail) setDetailScale(selDetail, d); else if (main) setMapScale(main.fp, d); };
  const scaleNow = $derived.by(() => {
    const d = scaleFrame ? mapScale(scaleFrame.fp) : null;
    if (!d) return '';
    const p = 10 ** Math.max(0, Math.floor(Math.log10(d)) - 2); // three significant figures: 1:52,300
    return (Math.round(d / p) * p).toLocaleString('en-US');
  });

  // Grid popover on the toolbar, for the main map or a locator
  let gridPop = $state(false);
  let gridAt = $state<[number, number]>([0, 0]);
  // the map's + / − / fit sit in the scale box (beside the page, never on it, so they cannot be taken for part of the figure
  // or hide the legend); a narrow desk (phones) has no room for them there and offers them in the map's toolbar instead
  const zoomInline = $derived(hostW >= 720);
  const selGrid = $derived(sel?.kind === 'map' || sel?.kind === 'detail' ? sel.grid : sel?.kind === 'inset' && sel.context !== 'globe' ? (sel.grid ?? null) : null);
  // Arrange menu: align to the page (or the map frame) and order, folded into one button
  let arrPop = $state(false);
  let arrAt = $state<[number, number]>([0, 0]);
  /** Where a toolbar popover of width w opens: under its button, kept inside the desk. */
  function popAt(e: MouseEvent, w: number): [number, number] {
    const b = (e.currentTarget as HTMLElement).getBoundingClientRect(), h = host.getBoundingClientRect();
    return [Math.min(Math.max(8, b.left - h.left + b.width / 2 - w / 2), h.width - w - 8), b.bottom - h.top + 8];
  }
  let popBtn: HTMLElement | null = null; // the button that opened the popover, so Esc can give focus back to it
  $effect(() => { void store.selected; gridPop = false; arrPop = false; });
  /** Move focus into a popover when it opens: its first enabled item or control. */
  function popFocus(node: HTMLElement) {
    node.querySelector<HTMLElement>('[role=menuitem]:not(:disabled), input:not(:disabled), button:not(:disabled)')?.focus({ preventScroll: true });
  }
  /** Arrow keys, Home and End move between the items of a menu (one tab stop, roving focus). */
  function menuKey(e: KeyboardEvent) {
    const items = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role=menuitem]:not(:disabled)')];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement), last = items.length - 1;
    const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? (i < last ? i + 1 : 0) : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? (i > 0 ? i - 1 : last) : e.key === 'Home' ? 0 : e.key === 'End' ? last : -1;
    if (to < 0) return;
    e.preventDefault();
    items[to].focus();
  }
  // the right-click menu: where it opens (desk px) and what it is for (a part, the map, or the empty page)
  let ctx = $state<{ x: number; y: number; on: 'part' | 'map' | 'page' } | null>(null);
  function onMenu(e: MouseEvent) {
    e.preventDefault();
    const [x, y] = toMm(e);
    const it = hit(x, y);
    if (it && !store.selection.includes(it.id)) {
      store.select(it.id);
      if (it.group) store.extra = store.doc.items.filter((o) => o.group === it.group && o.id !== it.id && o.visible).map((o) => o.id);
    }
    if (!it) store.select(null);
    openMenu(e.clientX, e.clientY, !it ? 'page' : it.kind === 'map' ? 'map' : 'part');
  }
  function openMenu(cx: number, cy: number, on: 'part' | 'map' | 'page') {
    const h = host.getBoundingClientRect();
    ctx = { x: Math.max(8, Math.min(cx - h.left, h.width - 236)), y: Math.max(8, Math.min(cy - h.top, h.height - 340)), on };
    gridPop = false; arrPop = false;
  }
  /** Run a menu choice, then close the menu and give the keyboard back to the page. */
  function pick(f: () => void) {
    f();
    ctx = null;
    overlay?.focus({ preventScroll: true });
  }
  $effect(() => {
    if (!gridPop && !arrPop && !ctx) return;
    const away = (e: PointerEvent) => { if (!(e.target as Element)?.closest?.('.gridpop, .gridbtn, .arrbtn, .ctxmenu')) { gridPop = false; arrPop = false; ctx = null; } };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (ctx) { ctx = null; e.stopPropagation(); overlay?.focus({ preventScroll: true }); return; }
      gridPop = false; arrPop = false; e.stopPropagation();
      const b = popBtn;
      if (b?.isConnected) b.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key, true); };
  });

  /** A page-space offset turned into the map's own unrotated axes. */
  /** Turn the selected part to point at the pointer: snaps to the quarter turns, and with Shift to every 15°. */
  function turnTo(x: number, y: number, fine: boolean) {
    const it = store.doc.items.find((i) => i.id === drag?.id);
    if (!it || !drag) return;
    const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
    let a = (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    a = ((a + 540) % 360) - 180;
    if (fine) a = Math.round(a / 15) * 15;
    else for (const q of [-180, -90, 0, 90, 180]) if (Math.abs(a - q) < 4) a = q;
    a = Math.round(a);
    if (a === 180) a = -180;
    const look = { ...(it.look ?? {}), rotate: a || undefined };
    if (!look.rotate) delete look.rotate;
    it.look = Object.keys(look).length ? look : undefined;
    drag.moved = true;
  }

  /** Drag a picked name: its offset from the place chosen for it, in the map's own (unrotated) mm. */
  function moveLabel(dx: number, dy: number) {
    const l = store.doc.layers.find((q) => q.id === drag?.id);
    if (!l || !drag?.name) return;
    const [ux, uy] = unrotate(dx, dy);
    const all = { ...(l.featureStyle ?? {}) };
    all[drag.name] = { ...(all[drag.name] ?? {}), labelDx: Math.round((drag.ox + ux) * 10) / 10, labelDy: Math.round((drag.oy + uy) * 10) / 10 };
    l.featureStyle = all;
    drag.moved = true;
  }

  // The picked feature's outline box on the page, found in the drawn figure after each redraw
  let pickBox = $state<{ x: number; y: number; w: number; h: number } | null>(null);
  $effect(() => {
    const p = store.picked;
    void main; void labels; void previewPan; void pxPerMm; void store.doc.layers.map((l) => l.featureStyle);
    if (!p || !svgEl || !overlay) { pickBox = null; return; }
    const f = requestAnimationFrame(() => {
      // the same name is drawn in every frame: the one in the frame it was picked in
      const frame = p.frame ?? map.id;
      const el = [...(svgEl?.querySelectorAll(`[data-pick="${CSS.escape(`${p.layerId}|${p.what}|${p.name}`)}"]`) ?? [])].find((n) => frameOf(n) === frame);
      if (!el || !overlay) { pickBox = null; return; }
      const r = el.getBoundingClientRect(), o = overlay.getBoundingClientRect();
      pickBox = { x: (r.left - o.left) / pxPerMm, y: (r.top - o.top) / pxPerMm, w: r.width / pxPerMm, h: r.height / pxPerMm };
    });
    return () => cancelAnimationFrame(f);
  });

  function unrotate(dx: number, dy: number): [number, number] {
    const r = ((map.rotation ?? 0) * Math.PI) / 180;
    if (!r) return [dx, dy];
    return [dx * Math.cos(r) + dy * Math.sin(r), -dx * Math.sin(r) + dy * Math.cos(r)];
  }

  function zoomMap(f: number) {
    const v = store.doc.view;
    v.zoom = Math.min(5000, Math.max(0.01, v.zoom * f));
    v.panX *= f; v.panY *= f;
    store.commit();
  }

  /**
   * While a line or area has points: Ctrl+Z (Cmd+Z) and Backspace take back the last one, and Esc finishes the shape
   * (or drops it when it is too short to be one). It runs before the app's own shortcuts, which then never see these keys;
   * with no points left Ctrl+Z is the usual undo again, and a second Esc leaves the tool.
   */
  function onDrawKey(e: KeyboardEvent) {
    if (!draft.length || (store.tool !== 'polygon' && store.tool !== 'line') || fly) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if ((e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) || (e.key === 'Backspace' && plain && (t === document.body || t?.closest?.('main')))) {
      e.preventDefault(); e.stopPropagation();
      draft = draft.slice(0, -1);
    } else if (e.key === 'Escape' && plain) {
      e.preventDefault(); e.stopPropagation();
      finishDraw(false); // a line with under 2 points or an area with under 3 adds nothing
      draft = [];
    }
  }

  function onKey(e: KeyboardEvent) {
    // the menu key, or Shift+F10, opens the right-click menu for what is selected
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = overlay.getBoundingClientRect();
      const at = sel ? [sel.x + sel.w / 2, sel.y + sel.h / 2] : [W / 2, H / 2];
      openMenu(r.left + at[0] * pxPerMm, r.top + at[1] * pxPerMm, !sel ? 'page' : sel.kind === 'map' ? 'map' : 'part');
      return;
    }
    if (e.key === 'Escape' && pageOn) { pageOn = false; return; }
    if (e.key === 'Escape' && store.addKind) { store.addKind = null; store.pendingImage = null; draft = []; return; }
    if (e.key === 'Enter' && (store.tool === 'polygon' || store.tool === 'line')) { finishDraw(false); draft = []; return; }
    // Move map: the arrow keys move the map inside its frame, as dragging does (Shift for bigger steps)
    if (adjusting) {
      const step = e.shiftKey ? 10 : 2;
      const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[e.key];
      if (!d) return;
      e.preventDefault();
      if (sel?.kind === 'detail') panDetail(sel, d[0], d[1]);
      else { const [ux, uy] = unrotate(d[0], d[1]); store.doc.view.panX += ux; store.doc.view.panY += uy; store.commit(); }
      return;
    }
    if (!sel) return;
    const movers = (multi ? group : [sel]).filter((i) => !i.locked);
    if (!movers.length) return;
    const step = e.shiftKey ? 5 : 0.5;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[e.key];
    if (!d) return;
    e.preventDefault();
    for (const m of movers) {
      m.pinned = true;
      m.x = Math.round((m.x + d[0]) * 10) / 10;
      m.y = Math.round((m.y + d[1]) * 10) / 10;
    }
    store.commit();
  }

  $effect(() => { if (!drawing) draft = []; });

  /* ---------- phones: the sheet steps aside while a map-drawing tool runs, so the map is as big as it can be ---------- */
  let sheetHid = false;
  $effect(() => {
    const on = phone && drawing && !!store.drawTarget;
    untrack(() => {
      if (on && store.panelOpen) { store.panelOpen = false; sheetHid = true; }
      else if (!on && sheetHid) { sheetHid = false; store.panelOpen = true; } // and it comes back when the drawing ends (Done, Esc, another tool)
    });
  });

  /* ---------- notes over the map ---------- */
  // what drawOnMap says when a tool starts (the toolbar says it too, and says it better): it goes with the tool
  const drawNotes = () => ['Click on the map to place points. Press Done when finished.', 'Click each point of the line. Double-click, Enter or Esc finishes it.', 'Click each corner of the area. Double-click, Enter or Esc finishes it.', 'Hold the mouse down and draw. Each stroke is one shape.'].map((k) => t(k));
  $effect(() => { if (!drawing && drawNotes().includes(store.status)) store.status = ''; });
  // plain notes go after about 4 s (longer for a long one) instead of the 9 s the app gives; an Undo note keeps those 9 s, a problem stays until dismissed
  let noteTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const msg = store.status;
    clearTimeout(noteTimer);
    if (!msg || problem || store.undoFor === msg) return;
    noteTimer = setTimeout(() => { if (store.status === msg) store.status = ''; }, Math.min(8000, 4000 + Math.max(0, msg.length - 50) * 40));
    return () => clearTimeout(noteTimer);
  });
  /** what the drawing toolbar says: the short touch version on phones, the keys on a computer */
  const drawHint = $derived.by(() => {
    const tool = store.tool;
    if (phone) return tool === 'point' ? t('Tap to add points') : tool === 'line' ? t('Tap along the line, then Done') : tool === 'polygon' ? t('Tap the corners, then Done') : tool === 'circle' ? t('Drag from the centre outwards') : tool === 'freehand' ? t('Draw around the area') : t('Drag a rectangle on the map');
    const finish = t('Double-click, Enter or Esc to finish · Backspace removes the last point');
    return tool === 'point' ? t('Click to add points') : tool === 'line' ? t('Click along the line. {finish}', { finish }) : tool === 'polygon' ? t('Click the corners. {finish}', { finish }) : tool === 'circle' ? t('Drag from the centre outwards') : tool === 'freehand' ? t('Hold and draw around the area') : t('Drag a rectangle on the map');
  });

  /* ---------- quick labels for the tool column ---------- */
  let tip = $state<{ text: string; y: number } | null>(null);
  function showTip(e: Event) {
    const b = (e.target as Element).closest?.('[data-tip]') as HTMLElement | null;
    if (!b || !host) { tip = null; return; }
    const r = b.getBoundingClientRect(), h = host.getBoundingClientRect();
    tip = { text: b.dataset.tip ?? '', y: r.top - h.top + r.height / 2 };
  }

  /* ---------- the page itself: selected by a click on an empty part of it ---------- */
  let pageOn = $state(false);
  $effect(() => { if (store.selected || store.addKind || drawing) pageOn = false; });
  /** make the page wider or taller (negative: smaller) by whole mm, keeping every part on it */
  function pageBy(side: PageSide, d: number) {
    if (!resizePage(side, d)) { store.status = t('The page can be {min} to {max} mm on each side.', { min: String(PAGE_MIN), max: String(PAGE_MAX) }); return; }
    const moved = keepOnPage();
    store.status = t('Page is now {w} × {h} mm.', { w: String(W), h: String(H) }) + (moved ? ' ' + (moved === 1 ? t('One part was moved back onto the page.') : t('{n} parts were moved back onto the page.', { n: moved })) : '');
    store.commit();
  }
  function pageFit() {
    trimPage(3);
    store.status = t('Page fitted to its contents: {w} × {h} mm.', { w: String(W), h: String(H) });
  }
  function pageSettings() { openDesign('page'); store.select(null); store.tab = 'templates'; store.panelOpen = true; }

  /* ---------- the page edges: drag to make the page bigger or smaller ---------- */
  const PAGE_GRIPS: { side: PageSide; label: string }[] = [
    { side: 'right', label: 'Drag to make the page wider or narrower' },
    { side: 'bottom', label: 'Drag to make the page taller or shorter' },
    { side: 'left', label: 'Drag to add or remove space on the left' },
    { side: 'top', label: 'Drag to add or remove space at the top' },
  ];
  let pageDrag = $state<{ side: PageSide; start: number; applied: number; zoomWas: number | null } | null>(null);
  function startPageDrag(e: PointerEvent, side: PageSide) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    // hold the zoom still while dragging, so the edge stays under the pointer
    pageDrag = { side, start: side === 'left' || side === 'right' ? e.clientX : e.clientY, applied: 0, zoomWas: userZoom };
    userZoom = pxPerMm;
  }
  function movePageDrag(e: PointerEvent) {
    if (!pageDrag) return;
    const p = pageDrag.side === 'left' || pageDrag.side === 'right' ? e.clientX : e.clientY;
    const sign = pageDrag.side === 'left' || pageDrag.side === 'top' ? -1 : 1;
    const want = Math.round(((p - pageDrag.start) / pxPerMm) * sign);
    if (want !== pageDrag.applied) pageDrag.applied += resizePage(pageDrag.side, want - pageDrag.applied);
  }
  function endPageDrag() {
    if (!pageDrag) return;
    const moved = keepOnPage();
    userZoom = pageDrag.zoomWas;
    if (pageDrag.applied) {
      store.status = t('Page is now {w} × {h} mm.', { w: String(W), h: String(H) }) + (moved ? ' ' + (moved === 1 ? t('One part was moved back onto the page; Design, Page, "Fill the page" tidies everything.') : t('{n} parts were moved back onto the page; Design, Page, "Fill the page" tidies everything.', { n: moved })) : '');
      store.commit();
    }
    pageDrag = null;
  }
  function pageKey(e: KeyboardEvent, side: PageSide) {
    const grow = { right: 'ArrowRight', bottom: 'ArrowDown', left: 'ArrowLeft', top: 'ArrowUp' }[side];
    const shrink = { right: 'ArrowLeft', bottom: 'ArrowUp', left: 'ArrowRight', top: 'ArrowDown' }[side];
    if (e.key !== grow && e.key !== shrink) return;
    e.preventDefault();
    e.stopPropagation();
    if (resizePage(side, (e.key === grow ? 1 : -1) * (e.shiftKey ? 10 : 1))) { keepOnPage(); store.commit(); }
  }

  /* ---------- toolbar actions ---------- */
  function duplicate() { if (sel) duplicateItem(sel.id); }
  function isOnMap(it: Item) {
    const m = store.doc.items.find((x) => x.kind === 'map' && x.visible);
    const x0 = Math.min(it.x, it.x + it.w), y0 = Math.min(it.y, it.y + it.h);
    return !!m && x0 >= m.x && y0 >= m.y && x0 + Math.abs(it.w) <= m.x + m.w && y0 + Math.abs(it.h) <= m.y + m.h;
  }
  function hide() { if (sel && sel.kind !== 'map') { sel.visible = false; store.select(null); store.commit(); } }
  function del() { if (sel && sel.kind !== 'map' && !sel.locked) { store.doc.items = store.doc.items.filter((i) => i !== sel); store.select(null); store.commit(); store.told(t('Deleted. Undo brings it back.')); } }
  /** Delete all of the group, then say so with an Undo (locked parts stay, and deleteItems already says so). */
  function delAll() {
    const before = store.doc.items.length, said = store.status;
    deleteItems(store.selection);
    const n = before - store.doc.items.length;
    if (!n) return;
    store.told((n > 1 ? t('{n} parts deleted.', { n }) : t('{n} part deleted.', { n })) + ' ' + (store.status !== said ? store.status : t('Undo brings them back.')));
  }
  const NAMES: Record<string, string> = { map: 'Main map', detail: 'Detail map', inset: 'Locator map', north: 'North arrow', scale: 'Scale bar', legend: 'Legend', credits: 'Credits', title: 'Text', shape: 'Shape', image: 'Picture', table: 'Table of sites', profile: 'Elevation profile' };

  let hoverCursor = $state('default');
  const cursor = $derived(drawing || store.addKind || picking ? 'crosshair' : drag?.mode === 'pan' ? 'grabbing' : adjusting ? 'grab' : drag?.mode === 'move' ? 'grabbing' : hoverCursor);
  $effect(() => {
    const h = hover;
    if (!h || drag) return;
    const it = hit(h[0], h[1]);
    if (!it) { hoverCursor = 'default'; return; }
    if (it.kind === 'map' && store.doc.study.source !== 'none') {
      const edge = Math.min(h[0] - it.x, it.x + it.w - h[0], h[1] - it.y, it.y + it.h - h[1]);
      hoverCursor = edge > 2.5 ? 'grab' : 'move';
    } else if (it.kind === 'detail' && (store.selected === it.id || store.picked?.frame === it.id) && Math.min(h[0] - it.x, it.x + it.w - h[0], h[1] - it.y, it.y + it.h - h[1]) > 2.5) hoverCursor = 'grab';
    else hoverCursor = 'move';
  });
  const draftPath = $derived.by(() => {
    if (!draft.length) return '';
    if (store.addKind && draft.length === 2) {
      const [[ax, ay], [bx, by]] = draft;
      return store.addKind === 'line' || store.addKind === 'arrow' ? `M${ax},${ay}L${bx},${by}` : `M${ax},${ay}H${bx}V${by}H${ax}Z`;
    }
    if ((store.tool === 'rect' || picking) && draft.length === 2) {
      const [[ax, ay], [bx, by]] = draft;
      return `M${ax},${ay}H${bx}V${by}H${ax}Z`;
    }
    if (store.tool === 'circle' && draft.length === 2) {
      const r = Math.hypot(draft[1][0] - draft[0][0], draft[1][1] - draft[0][1]);
      return `M${draft[0][0] - r},${draft[0][1]}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }
    const pts = (store.tool === 'polygon' || store.tool === 'line') && hover ? [...draft, hover] : draft;
    return 'M' + pts.map((p) => p.join(',')).join('L');
  });
  const handleR = $derived(5 / pxPerMm);
  // a message about a problem is announced at once (alert); the rest wait their turn (status)
  const problem = $derived(isProblem(store.status));
  /** the page's size in words, e.g. "Page 180 × 120 mm" */
  const pageSize = $derived(t('Page {w} × {h} mm', { w: String(W), h: String(H) }));
  const CVD_NOTE = { grey: 'Preview: printed in black and white', deutan: 'Preview: red-green colour blindness', protan: 'Preview: red-weak colour blindness', tritan: 'Preview: blue-yellow colour blindness' } as const;
  /** the part to name in "Drag a box on the page for the …" */
  const partWord = (k: string | null) => t((PALETTE.find((p) => p.k === k)?.label ?? '').replace('Add ', ''));
</script>

<svelte:window bind:innerWidth={winW} onkeydowncapture={onDrawKey} />
<!-- the desk is graph paper: its ruling is the page's own millimetres, so it scales with zoom and meets the page edge -->
<div class="desk" class:fine={pxPerMm >= 7} bind:this={host} style="--mm:{pxPerMm}px;--ox:{pageOff[0]}px;--oy:{pageOff[1]}px">
  <!-- colour-vision simulation (Machado et al. 2009, full severity), applied to the on-screen page only -->
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <filter id="cvd-protan" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0" /></filter>
    <filter id="cvd-deutan" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0" /></filter>
    <filter id="cvd-tritan" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.303900 0 0  0 0 0 1 0" /></filter>
    <!-- printed in black and white: the page's lightness only (Rec. 709 weights), to see which colours merge into one grey -->
    <filter id="cvd-grey" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0" /></filter>
  </svg>
  {#if tip && !fly}<div class="paltip" style="left:{PAL + 8}px;top:{tip.y}px">{tip.text}</div>{/if}
  {#if store.busy}<div class="loadbar" role="progressbar" aria-label={store.busy}></div>{/if}
  {#if store.cvd}
    <div class="cvdnote" role="status">{t(CVD_NOTE[store.cvd])} <button onclick={() => (store.cvd = '')}>{t('Turn off')}</button></div>
  {/if}
  {#if store.addKind}
    <div class="toolbar fitbar" role="group" aria-label={t('Add to the page')}>
      <span class="tb-label">{store.addKind === 'image' ? t('Drag a box on the page for the picture, or click to place it') : t('Drag a box on the page for the {part}, or click to place it', { part: partWord(store.addKind) })}</span>
      <button class="tb-btn" onclick={() => { store.addKind = null; store.pendingImage = null; }}>{t('Cancel')}</button>
    </div>
  {:else if picking}
    <div class="toolbar fitbar" role="group" aria-label={t('Choose what the detail map shows')}>
      <FrameCorners size={16} />
      <span class="tb-label">{t('Drag a box on the main map: the detail map will show that area')}</span>
      <button class="tb-btn" onclick={() => { store.detailPick = null; draft = []; }}>{t('Cancel')}</button>
    </div>
  {:else if sel || adjusting || drawing}
    <div class="toolbar" class:compact={hostW < 760} class:fitbar={drawing} role="group" aria-label={t('{part} tools', { part: sel ? t(NAMES[sel.kind]) : t('Map') })}>
      {#if drawing}
        <PencilSimple size={16} />
        <span class="tb-label">{target ? `${target.name}: ` : ''}{drawHint}</span>
        <button class="tb-btn" class:primary={!!target} onclick={() => { if (target && ((store.tool === 'line' && draft.length >= 2) || (store.tool === 'polygon' && draft.length >= 3))) finishDraw(false); store.tool = 'select'; store.drawTarget = null; draft = []; }}>{target ? t('Done') : t('Cancel')}</button>
      {:else if adjusting}
        <ArrowsOutCardinal size={16} />
        <span class="tb-label">{t('Drag or use the arrow keys to move the map, scroll to zoom')}</span>
        <button class="tb-icon" onclick={() => zoomMap(1 / 1.25)} aria-label={t('Zoom map out')}><Minus size={16} /></button>
        <button class="tb-icon" onclick={() => zoomMap(1.25)} aria-label={t('Zoom map in')}><Plus size={16} /></button>
        <button class="tb-btn" onclick={fitToArea}><CornersIn size={15} /> <span class="tb-text">{t('Fit to area')}</span></button>
        <button class="tb-btn primary" onclick={() => (store.tool = 'select')}>{t('Done')}</button>
      {:else if sel && multi}
        <span class="tb-label strong">{t('{n} parts', { n: group.length })}</span>
        {#if gtxt}
          <!-- Bold and Italic reach every part that has text; the pressed look follows the leading one with text, so a mixed group ends up all one way -->
          {@const gt = gtxt}
          <button class="tb-icon" aria-pressed={gt.bold} onclick={() => setItemTexts(group, { bold: !gt.bold })} aria-label={t('Bold')} title={t('Bold all (Ctrl+B)')}><TextB size={16} weight="bold" /></button>
          <button class="tb-icon" aria-pressed={gt.italic} onclick={() => setItemTexts(group, { italic: !gt.italic })} aria-label={t('Italic')} title={t('Italic all (Ctrl+I)')}><TextItalic size={16} weight="bold" /></button>
          <span class="tb-sep"></span>
        {/if}
        <button class="tb-btn arrbtn" aria-expanded={arrPop} aria-haspopup="menu" title={t('Align and space them')}
          onclick={(e) => { arrAt = popAt(e, 232); popBtn = e.currentTarget; gridPop = false; arrPop = !arrPop; }}><AlignLeft size={15} /> <span class="tb-text">{t('Arrange')}</span> <span aria-hidden="true">▾</span></button>
        {#if group.length > 1 && group.every((g) => g.group && g.group === group[0].group)}
          <button class="tb-btn" onclick={() => ungroupParts(store.selection)} title={t('Take the group apart (Ctrl+Shift+G)')}>{t('Ungroup')}</button>
        {:else}
          <button class="tb-btn" onclick={() => groupParts(store.selection)} title={t('Keep them together (Ctrl+G)')}>{t('Group')}</button>
        {/if}
        <button class="tb-icon" onclick={() => duplicateItems(store.selection)} aria-label={t('Duplicate all')} title={t('Duplicate all (Ctrl+D)')}><Copy size={16} /></button>
        <span class="tb-sep"></span>
        <button class="tb-icon danger" onclick={delAll} aria-label={t('Delete all')} title={t('Delete all (Del)')}><Trash size={16} /></button>
        <span class="tb-label muted">{t('Shift+click to add or remove')}</span>
      {:else if sel}
        <span class="tb-label strong">{t(NAMES[sel.kind])}</span>
        {#if sel.kind === 'detail'}
          <button class="tb-icon" onclick={() => zoomDetail(sel, 1 / 1.25)} aria-label={t('Zoom detail map out')}><Minus size={16} /></button>
          <button class="tb-icon" onclick={() => zoomDetail(sel, 1.25)} aria-label={t('Zoom detail map in')}><Plus size={16} /></button>
          <button class="tb-btn" onclick={() => fitDetailToArea(sel)}><CornersIn size={15} /> <span class="tb-text">{t('Fit to area')}</span></button>
        {/if}
        {#if sel.kind === 'inset'}
          <button class="tb-icon" onclick={() => zoomInset(sel, 1 / 1.25)} aria-label={t('Zoom inset map out')}><Minus size={16} /></button>
          <button class="tb-icon" onclick={() => zoomInset(sel, 1.25)} aria-label={t('Zoom inset map in')}><Plus size={16} /></button>
          <button class="tb-btn" onclick={() => resetInset(sel)}><CornersIn size={15} /> {t('Reset')}</button>
          <button class="tb-btn" onclick={() => startEdit(sel)}>{t('Label')}</button>
        {/if}
        {#if sel.kind === 'title'}<button class="tb-btn" onclick={() => startEdit(sel)}>{t('Edit text')}</button>{/if}
        {#if txt}
          {@const tx = txt}
          <span class="tb-sep"></span>
          <button class="tb-icon" aria-pressed={tx.bold} onclick={() => setItemText(sel, { bold: !tx.bold })} aria-label={t('Bold')} title={t('Bold (Ctrl+B)')}><TextB size={16} weight="bold" /></button>
          <button class="tb-icon" aria-pressed={tx.italic} onclick={() => setItemText(sel, { italic: !tx.italic })} aria-label={t('Italic')} title={t('Italic (Ctrl+I)')}><TextItalic size={16} weight="bold" /></button>
          {#if tx.size !== null}
            {@const pt = tx.size}
            <button class="tb-icon" onclick={() => setItemText(sel, { size: pt - 0.5 })} aria-label={t('Smaller text')} title={t('Smaller text')}><span class="aa sm" aria-hidden="true">A</span></button>
            <span class="tb-size" aria-label={t('Text size')}>{pt} pt</span>
            <button class="tb-icon" onclick={() => setItemText(sel, { size: pt + 0.5 })} aria-label={t('Larger text')} title={t('Larger text')}><span class="aa" aria-hidden="true">A</span></button>
          {/if}
        {/if}
        {#if sel.kind === 'map' || sel.kind === 'detail' || (sel.kind === 'inset' && sel.context !== 'globe')}
          <button class="tb-btn gridbtn" aria-expanded={gridPop} aria-haspopup="dialog" aria-pressed={!!selGrid?.show} title={t('Coordinate grid')}
            onclick={(e) => {
              if (sel?.kind === 'inset' && !sel.grid) sel.grid = { show: false, lines: true, step: 'auto', format: 'dm', labelPt: 7, lineColor: '#B4B4AE', sides: 'two' };
              gridAt = popAt(e, 250);
              popBtn = e.currentTarget;
              arrPop = false;
              gridPop = !gridPop;
            }}><GridFour size={15} /> <span class="tb-text">{t('Grid')}</span> <span aria-hidden="true">▾</span></button>
        {/if}
        {#if sel.kind !== 'map'}
          <span class="tb-sep"></span>
          <button class="tb-btn arrbtn" aria-expanded={arrPop} aria-haspopup="menu" disabled={!!sel.locked} title={sel.locked ? t('Locked: unlock it to arrange') : t('Align and order')}
            onclick={(e) => { arrAt = popAt(e, 232); popBtn = e.currentTarget; gridPop = false; arrPop = !arrPop; }}><AlignLeft size={15} /> <span class="tb-text">{t('Arrange')}</span> <span aria-hidden="true">▾</span></button>
        {/if}
        <button class="tb-icon" onclick={() => { sel.locked = !sel.locked; store.commit(); }} aria-label={sel.locked ? t('Unlock') : t('Lock in place')} aria-pressed={!!sel.locked} title={sel.locked ? t('Locked: click to unlock') : t('Lock in place')}>{#if sel.locked}<Lock size={16} weight="fill" />{:else}<LockOpen size={16} />{/if}</button>
        {#if sel.kind === 'map'}
          {#if !zoomInline}
            <!-- no room for the zoom buttons beside the scale box on a narrow desk (phones): they come with the map's toolbar -->
            <button class="tb-icon" onclick={() => zoomMap(1 / 1.3)} aria-label={t('Zoom map out')} title={t('Zoom out')}><Minus size={16} /></button>
            <button class="tb-icon" onclick={() => zoomMap(1.3)} aria-label={t('Zoom map in')} title={t('Zoom in')}><Plus size={16} /></button>
          {/if}
          <button class="tb-btn" onclick={() => (store.tool = 'adjust')}><ArrowsOutCardinal size={15} /> <span class="tb-text">{t('Move map')}</span></button>
          <button class="tb-btn" onclick={fitToArea}><CornersIn size={15} /> <span class="tb-text">{t('Fit to area')}</span></button>

        {/if}
        <button class="tb-btn" onclick={() => store.openSettings()}><Sliders size={15} /> <span class="tb-text">{t('Settings')}</span></button>
        {#if sel.kind !== 'map'}
          {#if sel.kind === 'title' || sel.kind === 'shape' || sel.kind === 'inset' || sel.kind === 'detail'}<button class="tb-icon" onclick={duplicate} aria-label={t('Duplicate')} title={t('Duplicate (Ctrl+D)')}><Copy size={16} /></button>{/if}
          <button class="tb-btn" onclick={hide} aria-label={t('Hide')} title={t('Hide (bring it back from Layers, On the page)')}><EyeSlash size={15} /> {t('Hide')}</button>
          <span class="tb-sep"></span>
          <button class="tb-icon danger" onclick={del} aria-label={t('Delete')} disabled={sel.locked} title={sel.locked ? t('Locked: unlock it to delete') : t('Delete (Del)')}><Trash size={16} /></button>
        {/if}
      {/if}
    </div>
  {:else if pageOn}
    <!-- the page is selected: make it bigger or smaller from here, or drag its edges -->
    <div class="toolbar pagebar" class:compact={hostW < 760} role="group" aria-label={t('Page tools')}>
      <span class="tb-label strong">{pageSize.replace(/ /g, '\u00a0')}</span>
      <span class="tb-label muted"><ArrowsHorizontal size={14} /> <span class="tb-text">{t('Width')}</span></span>
      <button class="tb-icon" onclick={() => pageBy('right', -10)} aria-label={t('Narrower by 10 mm')} title={t('Narrower by 10 mm')}><Minus size={16} /></button>
      <button class="tb-icon" onclick={() => pageBy('right', 10)} aria-label={t('Wider by 10 mm')} title={t('Wider by 10 mm')}><Plus size={16} /></button>
      <span class="tb-sep"></span>
      <span class="tb-label muted"><ArrowsVertical size={14} /> <span class="tb-text">{t('Height')}</span></span>
      <button class="tb-icon" onclick={() => pageBy('bottom', -10)} aria-label={t('Shorter by 10 mm')} title={t('Shorter by 10 mm')}><Minus size={16} /></button>
      <button class="tb-icon" onclick={() => pageBy('bottom', 10)} aria-label={t('Taller by 10 mm')} title={t('Taller by 10 mm')}><Plus size={16} /></button>
      <span class="tb-sep"></span>
      <button class="tb-btn" onclick={pageFit} title={t('Shrink the page to what is on it, with a 3 mm margin')}><CornersIn size={16} /> <span class="tb-text">{t('Fit to contents')}</span></button>
      <button class="tb-btn" onclick={pageSettings} title={t('Journal size, exact width and height, each side, page colour')}><Sliders size={16} /> <span class="tb-text">{t('Page settings')}</span></button>
    </div>
  {/if}

  {#if ctx}
    {@const ids = store.selection}
    {@const one = sel}
    <!-- svelte-ignore a11y_interactive_supports_focus (the items inside take focus) -->
    <div class="gridpop ctxmenu" role="menu" aria-label={t('Actions')} use:popFocus onkeydown={menuKey} style="left:{ctx.x}px;top:{ctx.y}px">
      {#if ctx.on === 'part' && one}
        <button role="menuitem" onclick={() => pick(() => store.select(one.id, true))}><Sliders size={15} /> {t('Settings')}</button>
        <button role="menuitem" onclick={() => pick(() => (store.extra.length ? copyItems(ids) : copyItem(one.id)))}>{t('Copy')} <kbd>Ctrl C</kbd></button>
        <button role="menuitem" onclick={() => pick(() => (store.extra.length ? duplicateItems(ids) : duplicateItem(one.id)))}><Copy size={15} /> {t('Duplicate')} <kbd>Ctrl D</kbd></button>
        <span class="ctxsep"></span>
        {#if !store.extra.length}
          <button role="menuitem" onclick={() => pick(() => restack(one.id, 1))}>{t('Bring forward')}</button>
          <button role="menuitem" onclick={() => pick(() => restack(one.id, -1))}>{t('Send backward')}</button>
          <button role="menuitem" onclick={() => pick(() => restack(one.id, 'front'))}><ArrowLineUp size={15} /> {t('Bring to front')}</button>
          <button role="menuitem" onclick={() => pick(() => restack(one.id, 'back'))}><ArrowLineDown size={15} /> {t('Send to back')}</button>
          <span class="ctxsep"></span>
        {/if}
        {#if store.extra.length && !(group.every((g) => g.group && g.group === group[0].group))}
          <button role="menuitem" onclick={() => pick(() => groupParts(ids))}>{t('Group')} <kbd>Ctrl G</kbd></button>
        {/if}
        {#if group.some((g) => g.group)}
          <button role="menuitem" onclick={() => pick(() => ungroupParts(ids))}>{t('Ungroup')} <kbd>Ctrl Shift G</kbd></button>
        {/if}
        <button role="menuitem" onclick={() => pick(() => { const lock = !one.locked; for (const g of group) g.locked = lock; store.commit(); })}>{#if one.locked}<LockOpen size={15} /> {t('Unlock')}{:else}<Lock size={15} /> {t('Lock in place')}{/if}</button>
        <button role="menuitem" onclick={() => pick(() => { for (const g of group) g.visible = false; store.select(null); store.commit(); store.told(t('Hidden. Map parts brings it back.')); })}><EyeSlash size={15} /> {t('Hide')}</button>
        <span class="ctxsep"></span>
        <button role="menuitem" class="danger" disabled={group.some((g) => g.locked)} onclick={() => pick(() => (store.extra.length ? delAll() : del()))}><Trash size={15} /> {t('Delete')} <kbd>Del</kbd></button>
      {:else if ctx.on === 'map'}
        <button role="menuitem" onclick={() => pick(() => { const m = store.doc.items.find((i) => i.kind === 'map'); if (m) store.select(m.id, true); })}><Sliders size={15} /> {t('Map settings')}</button>
        <button role="menuitem" onclick={() => pick(() => fitToArea())}><CornersIn size={15} /> {t('Fit the map to the area')}</button>
        <button role="menuitem" onclick={() => pick(() => (store.tool = 'adjust'))}><HandGrabbing size={15} /> {t('Move the map in its frame')}</button>
        <span class="ctxsep"></span>
        <button role="menuitem" onclick={() => pick(() => { pasteItem(); })}>{t('Paste')} <kbd>Ctrl V</kbd></button>
      {:else}
        <button role="menuitem" onclick={() => pick(() => { pasteItem(); })}>{t('Paste')} <kbd>Ctrl V</kbd></button>
        <button role="menuitem" onclick={() => pick(() => pageSettings())}>{t('Page size and colour')}</button>
        <button role="menuitem" onclick={() => pick(() => { const all = store.doc.items.filter((i) => i.visible && i.kind !== 'map').map((i) => i.id); if (all.length) { store.select(all[0]); store.extra = all.slice(1); } })}>{t('Select all parts')}</button>
      {/if}
    </div>
  {/if}

  {#if arrPop && sel && multi}
    {@const ids = store.selection}
    <!-- svelte-ignore a11y_interactive_supports_focus (the items inside take focus) -->
    <div class="gridpop arrpop" role="menu" aria-label={t('Arrange the selected parts')} use:popFocus onkeydown={menuKey} style="left:{arrAt[0]}px;top:{arrAt[1]}px">
      <span class="gp-lbl">{t('Line them up with each other')}</span>
      <div class="arrgrid">
        <button role="menuitem" onclick={() => alignGroup(ids, 'left')}><AlignLeft size={16} /> {t('Left')}</button>
        <button role="menuitem" onclick={() => alignGroup(ids, 'hcenter')}><AlignCenterHorizontal size={16} /> {t('Centre')}</button>
        <button role="menuitem" onclick={() => alignGroup(ids, 'right')}><AlignRight size={16} /> {t('Right')}</button>
        <button role="menuitem" onclick={() => alignGroup(ids, 'top')}><AlignTop size={16} /> {t('Top')}</button>
        <button role="menuitem" onclick={() => alignGroup(ids, 'vcenter')}><AlignCenterVertical size={16} /> {t('Middle')}</button>
        <button role="menuitem" onclick={() => alignGroup(ids, 'bottom')}><AlignBottom size={16} /> {t('Bottom')}</button>
      </div>
      <span class="gp-lbl">{t('Equal spaces between them')}{group.length < 3 ? ' ' + t('(pick 3 or more)') : ''}</span>
      <div class="arrgrid two">
        <button role="menuitem" disabled={group.length < 3} onclick={() => distributeGroup(ids, 'x')}><DotsThree size={16} /> {t('Across')}</button>
        <button role="menuitem" disabled={group.length < 3} onclick={() => distributeGroup(ids, 'y')}><DotsThreeVertical size={16} /> {t('Down')}</button>
      </div>
    </div>
  {:else if arrPop && sel && sel.kind !== 'map'}
    {@const id = sel.id}
    <!-- svelte-ignore a11y_interactive_supports_focus (the items inside take focus) -->
    <div class="gridpop arrpop" role="menu" aria-label={t('Arrange')} use:popFocus onkeydown={menuKey} style="left:{arrAt[0]}px;top:{arrAt[1]}px">
      <span class="gp-lbl">{isOnMap(sel) ? t('Align to the map frame') : t('Align to the page margins')}</span>
      <div class="arrgrid">
        <button role="menuitem" onclick={() => alignItem(id, 'left')}><AlignLeft size={16} /> {t('Left')}</button>
        <button role="menuitem" onclick={() => alignItem(id, 'hcenter')}><AlignCenterHorizontal size={16} /> {t('Centre')}</button>
        <button role="menuitem" onclick={() => alignItem(id, 'right')}><AlignRight size={16} /> {t('Right')}</button>
        <button role="menuitem" onclick={() => alignItem(id, 'top')}><AlignTop size={16} /> {t('Top')}</button>
        <button role="menuitem" onclick={() => alignItem(id, 'vcenter')}><AlignCenterVertical size={16} /> {t('Middle')}</button>
        <button role="menuitem" onclick={() => alignItem(id, 'bottom')}><AlignBottom size={16} /> {t('Bottom')}</button>
      </div>
      <span class="gp-lbl">{t('Order')}</span>
      <div class="arrgrid two">
        <button role="menuitem" onclick={() => restack(id, 'front')}><ArrowLineUp size={16} /> {t('To front')}</button>
        <button role="menuitem" onclick={() => restack(id, 'back')}><ArrowLineDown size={16} /> {t('To back')}</button>
      </div>
    </div>
  {/if}

  {#if gridPop && selGrid}
    <div class="gridpop" role="dialog" aria-label={t('Grid')} use:popFocus style="left:{gridAt[0]}px;top:{gridAt[1]}px">
      <label class="row-switch"><span>{t('Coordinate grid')}</span><input type="checkbox" role="switch" checked={selGrid.show} onchange={() => { selGrid!.show = !selGrid!.show; store.commit(); }} /></label>
      {#if selGrid.show}
        <span class="gp-lbl">{t('Click a side to show or hide its coordinates')}</span>
        <SidePicker grid={selGrid} />
      {/if}
      <button class="btn small" onclick={() => { gridPop = false; store.openSettings(); setTimeout(() => { const t = document.querySelector('aside .gp'), b = document.querySelector('aside .body'); if (t && b) b.scrollTo({ top: b.scrollTop + t.getBoundingClientRect().top - b.getBoundingClientRect().top - 8, behavior: 'smooth' }); }, 120); }}>{t('All grid settings…')}</button>
    </div>
  {/if}

  {#if chrome}
    <!-- the tool strip: select and move the map, text and picture, and three families (map parts, shapes, drawing on the map) that open a labelled menu beside it -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions (the column only listens for the labels of the tools inside) -->
    <div class="palette" class:fade-t={palFade.t} class:fade-b={palFade.b} bind:this={palEl} onscroll={() => { palScroll(); closeFly(false); }} onpointerover={showTip} onpointerleave={() => (tip = null)} onfocusin={showTip} onfocusout={() => (tip = null)} role="group" aria-label={t('Layout tools')} style="top:{TOP}px;width:{PAL}px">
      <button class="pal" aria-pressed={!store.addKind && store.tool === 'select'} onclick={() => { store.addKind = null; store.tool = 'select'; }} aria-label={t('Select and move items')} data-tip={t('Select and move')}><Cursor size={19} /></button>
      <button class="pal" aria-pressed={store.tool === 'adjust'} onclick={() => { store.addKind = null; store.tool = store.tool === 'adjust' ? 'select' : 'adjust'; }} aria-label={t('Move map content')} data-tip={t('Move the map inside its frame')}><HandGrabbing size={19} /></button>
      <span class="pal-sep"></span>
      <button class="pal" aria-pressed={store.addKind === 'text'} onclick={() => pickTool('text')} aria-label={t('Add text')} data-tip={t('Text')}><TextT size={19} /></button>
      {#snippet family(g: GroupId)}
        {@const cur = shown(g)}
        <button class="pal has-menu" aria-pressed={!!running(g)} aria-haspopup="menu" aria-expanded={fly?.g === g} aria-controls={fly?.g === g ? 'tool-menu' : undefined}
          disabled={g === 'draw' && store.doc.study.source === 'none'} aria-label={t(FLY[g].label)} data-tip={t(FLY[g].tip)}
          onclick={(e) => toggleFly(e, g)} onkeydown={(e) => groupKey(e, g)}><cur.icon size={19} /></button>
      {/snippet}
      {@render family('parts')}
      {@render family('shapes')}
      <button class="pal" aria-pressed={store.addKind === 'image'} onclick={() => pickTool('image')} aria-label={t('Add picture or logo')} data-tip={t('Picture or logo')}><ImageIcon size={19} /></button>
      <span class="pal-sep"></span>
      {@render family('draw')}
      <input bind:this={picInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" class="sr-only" tabindex="-1" aria-hidden="true" onchange={pickPicture} />
    </div>
    {#if fly}
      {@const fg = FLY[fly.g]}
      <!-- beside the strip, not inside it: the strip scrolls when the window is short and would clip the menu -->
      <!-- svelte-ignore a11y_interactive_supports_focus (the rows inside take focus) -->
      <div class="flyout" id="tool-menu" role="menu" aria-label={t(fg.label)} use:flyFocus={fly.kb} onkeydown={flyKey} style="left:{PAL + 6}px;top:{flyTop}px">
        {#each fg.items as it (it.id)}
          <button class="fly-item" class:off={!!it.off?.()} role="menuitem" tabindex="-1" aria-label={t(it.label)} aria-current={it.active() ? 'true' : undefined} aria-disabled={it.off?.() ? 'true' : undefined} title={it.off?.() || undefined} onclick={() => choose(fly!.g, it)}><it.icon size={18} /><span>{t(it.name)}</span></button>
        {/each}
      </div>
    {/if}
    <Rulers {pxPerMm} offX={pageOff[0]} offY={pageOff[1]} width={hostW} height={hostH} left={PAL + RUL} top={TOP + RUL} {hover} />
    <div class="status" aria-live="off">
      {#if hover && hover[0] >= 0 && hover[1] >= 0 && hover[0] <= W && hover[1] <= H}<span>x {hover[0].toFixed(1)} mm</span><span>y {hover[1].toFixed(1)} mm</span>{/if}
      {#if multi}<span class="selinfo">{t('{n} parts selected', { n: group.length })}</span>{:else if sel}<span class="selinfo">{t(NAMES[sel.kind])} {Math.abs(sel.w).toFixed(1)} × {Math.abs(sel.h).toFixed(1)} mm</span>{/if}
      <span>{pageSize}</span>
    </div>
  {/if}

  <!-- a click beside the page selects the page (its size tools), except with Shift held (a missed Shift+click keeps the group) -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scroller" class:chrome bind:this={scrollerEl} onscroll={measure}
    onpointerdown={(e) => { if ((e.target === e.currentTarget || e.target === stageEl) && !store.addKind && !drawing && !e.shiftKey) { endEdit(); store.select(null); pageOn = store.doc.study.source !== 'none'; } }}>
    <div class="stage" bind:this={stageEl} style="width:{pageW}px;height:{pageH}px">
      {#if store.doc.study.source !== 'none' && !drawing}
        {#each PAGE_GRIPS as g (g.side)}
          <button class="pagegrip {g.side}" class:on={pageOn} class:active={pageDrag?.side === g.side} aria-label={t(g.label)} title="{t(g.label)} {t('(or use Design, Page size)')}"
            onpointerdown={(e) => startPageDrag(e, g.side)} onpointermove={movePageDrag} onpointerup={endPageDrag} onpointercancel={endPageDrag}
            onkeydown={(e) => pageKey(e, g.side)}></button>
        {/each}
        {#if pageDrag}<div class="pagesize" role="status">{W} × {H} mm</div>{/if}
      {/if}
      <div class="page" class:on={pageOn} class:clear={store.doc.pageColor === 'none'} style="width:{pageW}px;height:{pageH}px;{store.doc.pageColor && store.doc.pageColor !== 'none' ? `background:${store.doc.pageColor}` : ''}">
        <div class="fig" aria-hidden="true" style={store.cvd ? `filter:url(#cvd-${store.cvd})` : undefined}>
          <Figure doc={store.doc} {main} {insets} {details} {scale} {credits} {labels} {terrainHref} {elevation} {basemapHref} geoms={store.geoms} {contentTransform} {contentFor} bind:svgEl />
        </div>
        <span id="page-help" class="sr-only">{t('A map of {name}, {w} by {h} mm. Click an element to select it, drag to move, drag a corner to resize, arrow keys to nudge. Double-click the map to move inside it.', { name: store.doc.study.name || t('no area yet'), w: String(W), h: String(H) })}</span>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <svg
          bind:this={overlay}
          class="overlay"
          class:working={drawing || !!drag || !!store.selected}
          class:pointerfocus={pointerFocus}
          onblur={() => (pointerFocus = false)}
          width={pageW}
          height={pageH}
          viewBox="0 0 {W} {H}"
          role="application"
          aria-label={t('Map page')}
          aria-describedby="page-help"
          tabindex="0"
          style="cursor:{cursor}"
          onpointerdown={onDown}
          onpointermove={onMove}
          onpointerup={onUp}
          onpointercancel={onCancel}
          onpointerleave={() => (hover = null)}
          ondblclick={onDbl}
          oncontextmenu={onMenu}
          onwheel={onWheel}
          onkeydown={onKey}
        >
          {#each guides.x as gx}<line x1={gx} y1="0" x2={gx} y2={H} class="guide" />{/each}
          {#each guides.y as gy}<line x1="0" y1={gy} x2={W} y2={gy} class="guide" />{/each}
          {#if adjusting}
            <rect x={map.x} y={map.y} width={map.w} height={map.h} class="adjust" />
          {/if}
          {#if drawing}
            <rect x={map.x} y={map.y} width={map.w} height={map.h} class="draw-zone" />
          {/if}
          {#each store.doc.guides?.x ?? [] as gx}<line x1={gx} x2={gx} y1="0" y2={H} class="guide-line" />{/each}
          {#each store.doc.guides?.y ?? [] as gy}<line y1={gy} y2={gy} x1="0" x2={W} class="guide-line" />{/each}
          {#if draftPath}<path d={draftPath} class="draft" />{/if}
          {#if marquee}<rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} class="marquee" />{/if}
          {#if pickBox && !drawing}<rect x={pickBox.x - 0.8} y={pickBox.y - 0.8} width={pickBox.w + 1.6} height={pickBox.h + 1.6} rx="0.6" class="picked" />{/if}
          {#if multi && !adjusting && !drawing}
            {#each group.filter((g) => g.id !== store.selected) as g (g.id)}
              {#if isLine(g)}<line x1={g.x} y1={g.y} x2={g.x + g.w} y2={g.y + g.h} class="sel extra" />
              {:else}<rect x={Math.min(g.x, g.x + g.w)} y={Math.min(g.y, g.y + g.h)} width={Math.abs(g.w)} height={Math.abs(g.h)} class="sel extra" />{/if}
            {/each}
          {/if}
          {#if sel?.kind === 'map' && !adjusting && !drawing}
            <rect data-grip x={sel.x + sel.w / 2 - 6} y={sel.y - 1.2} width="12" height="2.4" rx="1.2" class="grip" />
          {/if}
          {#if sel && !sel.locked && !adjusting && !drawing && (sel.visible || !multi)}
            <!-- while several parts are selected the leading one keeps its outline but no handles, so a Shift+click near its corner can still add or remove a part -->
            {#if isLine(sel)}
              <line x1={sel.x} y1={sel.y} x2={sel.x + sel.w} y2={sel.y + sel.h} class="sel" />
              {#if !multi}
                <circle data-corner="p1" cx={sel.x} cy={sel.y} r={12 / pxPerMm} class="hit" />
                <circle data-corner="p2" cx={sel.x + sel.w} cy={sel.y + sel.h} r={12 / pxPerMm} class="hit" />
                <circle data-corner="p1" cx={sel.x} cy={sel.y} r={handleR} class="handle" />
                <circle data-corner="p2" cx={sel.x + sel.w} cy={sel.y + sel.h} r={handleR} class="handle" />
              {/if}
            {:else}
              <g transform={sel.look?.rotate ? `rotate(${sel.look.rotate} ${sel.x + sel.w / 2} ${sel.y + sel.h / 2})` : undefined}>
                <rect x={sel.x} y={sel.y} width={sel.w} height={sel.h} class="sel" />
                {#if !multi}
                  {#each [['nw', sel.x, sel.y], ['ne', sel.x + sel.w, sel.y], ['sw', sel.x, sel.y + sel.h], ['se', sel.x + sel.w, sel.y + sel.h]] as [cn, cx, cy]}
                    <circle data-corner={cn} cx={cx} cy={cy} r={12 / pxPerMm} class="hit {cn}" />
                    <circle data-corner={cn} cx={cx} cy={cy} r={handleR} class="handle {cn}" />
                  {/each}
                  {#if sel.kind !== 'map' && sel.kind !== 'detail'}
                    <!-- the turn handle: a short stalk above the top edge -->
                    <line x1={sel.x + sel.w / 2} y1={sel.y} x2={sel.x + sel.w / 2} y2={sel.y - 22 / pxPerMm} class="stalk" />
                    <circle data-rotate cx={sel.x + sel.w / 2} cy={sel.y - 22 / pxPerMm} r={12 / pxPerMm} class="hit turn" />
                    <circle data-rotate cx={sel.x + sel.w / 2} cy={sel.y - 22 / pxPerMm} r={handleR} class="handle turn" />
                  {/if}
                {/if}
              </g>
            {/if}
          {/if}
        </svg>
        {#if editItem && (editItem.kind === 'title' || editItem.kind === 'inset')}
          {@const ei = editItem}
          <!-- bold and italic as they will print: a title keeps them on the item, a locator label in its text style (read here, so Ctrl+B / Ctrl+I show at once) -->
          {@const ek = ei.kind === 'title' ? { weight: ei.bold ? 700 : 400, style: ei.italic ? 'italic' : 'normal' } : look(ei.text, TEXT.insetLabel)}
          <textarea class="textedit" use:focusSelect rows="1"
            style="left:{ei.x * pxPerMm}px;top:{(ei.kind === 'inset' ? ei.y + ei.h - 6 : ei.y) * pxPerMm}px;width:{Math.max(ei.w, ei.kind === 'inset' ? 30 : 12) * pxPerMm}px;height:{Math.max(ei.kind === 'inset' ? 6 : ei.h, 5) * pxPerMm + 6}px;font-size:{Math.max(12, ei.labelPt * 0.3528 * pxPerMm)}px;font-family:{fontStack(ei.kind === 'title' && ei.font ? ei.font : store.doc.font)};font-weight:{ek.weight};font-style:{ek.style};text-align:{ei.kind === 'title' ? ({ start: 'left', middle: 'center', end: 'right' } as const)[ei.align ?? 'start'] : 'left'}"
            value={ei.kind === 'title' ? ei.text : ei.label}
            placeholder={ei.kind === 'inset' ? t('Label, e.g. (a) Bangladesh') : t('Type your text')}
            aria-label={ei.kind === 'title' ? t('Text. Enter to finish, Shift+Enter for a new line, Esc to cancel') : t('Locator label')}
            oninput={(e) => { const v = (e.target as HTMLTextAreaElement).value; if (ei.kind === 'title') ei.text = v; else if (ei.kind === 'inset') ei.label = v.replace(/\n/g, ' '); }}
            onkeydown={(e) => {
              if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'i')) { e.preventDefault(); if (e.repeat) return; const t = itemText(ei); if (t) setItemText(ei, e.key.toLowerCase() === 'b' ? { bold: !t.bold } : { italic: !t.italic }); }
              else if (e.key === 'Escape') { if (ei.kind === 'title') ei.text = editOriginal; else if (ei.kind === 'inset') ei.label = editOriginal; e.preventDefault(); endEdit(true, true); }
              else if (e.key === 'Enter' && !(e.shiftKey && ei.kind === 'title')) { e.preventDefault(); endEdit(true); }
              e.stopPropagation();
            }}
            onblur={() => endEdit()}></textarea>
        {/if}
      </div>
    </div>
  </div>

  {#if store.doc.study.source === 'none' && !drawing && store.panelOpen && store.tab === 'place'}
    <p class="hint-pill" role="note"><span class="long">{t('Search for a place, or draw your own area on this map.')}</span><span class="short">{t('Search a place or draw an area')}</span></p>
  {:else if store.doc.study.source === 'none' && !drawing}
    <div class="start" role="region" aria-label={t('Start')}>
      <h2>{t('Make a map of any place')}</h2>
      <PlaceSearch big />
      <button class="draw-link" onclick={() => { store.tab = 'place'; store.panelOpen = true; store.tool = 'rect'; }}><PencilSimple size={16} /> {t('Draw an area instead')}</button>
    </div>
  {/if}

  {#if scaleFrame && store.doc.study.source !== 'none'}
    <form class="scalebox" onsubmit={(e) => { e.preventDefault(); const d = parseScale(scaleText); if (d) setScale(d); scaleEditing = false; (document.activeElement as HTMLElement)?.blur(); }}>
      <label for="map-scale">{selDetail ? t('Detail scale 1:') : t('Map scale 1:')}</label>
      <input id="map-scale" inputmode="numeric" autocomplete="off" spellcheck={false}
        value={scaleEditing ? scaleText : scaleNow}
        onfocus={(e) => { scaleEditing = true; scaleText = scaleNow; (e.target as HTMLInputElement).select(); }}
        oninput={(e) => (scaleText = (e.target as HTMLInputElement).value)}
        onblur={() => { if (scaleEditing && scaleText.trim() && scaleText !== scaleNow) { const d = parseScale(scaleText); if (d) setScale(d); } scaleEditing = false; }}
        onkeydown={(e) => { if (e.key === 'Escape') { scaleText = scaleNow; scaleEditing = false; (e.target as HTMLInputElement).blur(); } }}
        title={t('Type a scale such as 50000 and press Enter')} />
      <select aria-label={t('Common scales')} onchange={(e) => { const d = Number((e.target as HTMLSelectElement).value); if (d) setScale(d); (e.target as HTMLSelectElement).value = ''; }}>
        <option value="">▾</option>
        {#each [5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000] as d}<option value={d}>1:{d.toLocaleString('en-US')}</option>{/each}
      </select>
      {#if zoomInline && !drawing && map.visible}
        <!-- zooming the map changes the scale beside it, so the buttons live in the scale box (type="button": Enter in the scale field must not press them) -->
        <div class="mapzoom" role="group" aria-label={t('Map zoom')}>
          <button type="button" onclick={() => (selDetail ? zoomDetail(selDetail, 1.3) : zoomMap(1.3))} aria-label={t('Zoom map in')} title={t('Zoom in (or scroll on the map)')}><Plus size={16} weight="bold" /></button>
          <button type="button" onclick={() => (selDetail ? zoomDetail(selDetail, 1 / 1.3) : zoomMap(1 / 1.3))} aria-label={t('Zoom map out')} title={t('Zoom out')}><Minus size={16} weight="bold" /></button>
          <button type="button" onclick={() => (selDetail ? fitDetailToArea(selDetail) : fitToArea())} aria-label={t('Fit map to the area')} title={t('Fit to your area')}><CornersIn size={16} /></button>
        </div>
      {/if}
    </form>
  {/if}

  <div class="zoom" role="group" aria-label={t('Page zoom')}>
    <button onclick={() => (userZoom = Math.max(0.5, pxPerMm / 1.2))} aria-label={t('Zoom page out')}><MagnifyingGlassMinus size={16} /></button>
    <button class="pct" onclick={() => (userZoom = null)} title={t('Fit page to screen')} aria-label={userZoom ? t('Page zoom {pct}%. Fit the page to the screen', { pct: String(pct) }) : t('Fit the page to the screen')}>{userZoom ? `${pct}%` : t('Fit')}</button>
    <button onclick={() => (userZoom = Math.min(16, pxPerMm * 1.2))} aria-label={t('Zoom page in')}><MagnifyingGlassPlus size={16} /></button>
  </div>

  <div class="toast" class:empty={!store.status} role={problem ? 'alert' : 'status'}>
    <span>{store.status}</span>
    {#if store.status}
      {#if store.undoFor === store.status}<button onclick={() => { store.undo(); store.status = ''; }}>{t('Undo')}</button>{/if}
      <button onclick={() => (store.status = '')}>{t('Dismiss')}</button>
    {/if}
  </div>
</div>

<style>
  .desk {
    position: absolute; inset: 0; overflow: hidden;
    background-color: var(--desk);
    background-image:
      linear-gradient(to right, var(--rule-major) 1px, transparent 1px), linear-gradient(to bottom, var(--rule-major) 1px, transparent 1px),
      linear-gradient(to right, var(--rule) 1px, transparent 1px), linear-gradient(to bottom, var(--rule) 1px, transparent 1px);
    background-size: calc(var(--mm) * 10) calc(var(--mm) * 10), calc(var(--mm) * 10) calc(var(--mm) * 10), calc(var(--mm) * 5) calc(var(--mm) * 5), calc(var(--mm) * 5) calc(var(--mm) * 5);
    background-position: var(--ox) var(--oy);
  }
  /* zoomed in far enough, the 1 mm ruling appears too */
  .desk.fine {
    background-image:
      linear-gradient(to right, var(--rule-major) 1px, transparent 1px), linear-gradient(to bottom, var(--rule-major) 1px, transparent 1px),
      linear-gradient(to right, var(--rule) 1px, transparent 1px), linear-gradient(to bottom, var(--rule) 1px, transparent 1px),
      linear-gradient(to right, rgb(223 231 237 / 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgb(223 231 237 / 0.5) 1px, transparent 1px);
    background-size: calc(var(--mm) * 10) calc(var(--mm) * 10), calc(var(--mm) * 10) calc(var(--mm) * 10), calc(var(--mm) * 5) calc(var(--mm) * 5), calc(var(--mm) * 5) calc(var(--mm) * 5), var(--mm) var(--mm), var(--mm) var(--mm);
  }
  .scroller { position: absolute; inset: 0; overflow: auto; display: grid; place-items: center; padding: 64px 34px 64px; }
  .scroller.chrome { inset: 20px 0 0 68px; } /* below the ruler only: the rulers meet the top bar */
  .palette {
    position: absolute; left: 0; bottom: 0; z-index: 5; display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 0; background: var(--panel); border-right: 1px solid var(--line); overflow-y: auto; scrollbar-width: none;
  }
  .palette::-webkit-scrollbar { display: none; }
  /* a strip taller than the desk scrolls; the edge with more behind it fades out, so the cut-off is a cue and not a mistake */
  .palette.fade-b { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent); }
  .palette.fade-t { -webkit-mask-image: linear-gradient(to top, #000 calc(100% - 24px), transparent); mask-image: linear-gradient(to top, #000 calc(100% - 24px), transparent); }
  .palette.fade-t.fade-b { -webkit-mask-image: linear-gradient(#0000, #000 24px, #000 calc(100% - 24px), #0000); mask-image: linear-gradient(#0000, #000 24px, #000 calc(100% - 24px), #0000); }
  .pal { position: relative; width: 36px; height: 34px; flex: none; display: grid; place-items: center; border: 0; border-radius: var(--r-ctl); background: transparent; color: var(--ink-2); transition: background-color 120ms ease, color 120ms ease, transform 80ms ease; }
  .pal:active:not(:disabled) { transform: scale(0.97); }
  .pal:hover:not(:disabled) { background: var(--panel-2); color: var(--ink); }
  .pal:disabled { opacity: 0.4; cursor: not-allowed; }
  .pal[aria-expanded='true'] { background: var(--panel-2); color: var(--ink); }
  .pal[aria-pressed='true'] { background: var(--accent-wash); color: var(--accent-ink); }
  /* a family of tools carries a small corner mark: there is a menu behind it */
  .pal.has-menu::after { content: ''; position: absolute; right: 4px; bottom: 4px; border: solid transparent; border-width: 0 0 5px 5px; border-bottom-color: currentColor; opacity: 0.75; }
  .pal-sep { width: 24px; height: 1px; background: var(--line); margin: 4px 0; flex: none; }
  /* the menu of a family: labelled rows (icon and name) beside the strip */
  .flyout {
    position: absolute; z-index: 21; min-width: 188px; display: grid; gap: 2px; padding: 6px;
    background: var(--panel); border-radius: var(--r-panel); box-shadow: var(--shadow-2), 0 0 0 1px var(--line);
    animation: flyin 140ms var(--ease) both;
  }
  @keyframes flyin { from { opacity: 0; translate: -4px 0; } to { opacity: 1; translate: 0 0; } }
  @media (prefers-reduced-motion: reduce) { .flyout { animation: none; } }
  .fly-item {
    display: flex; align-items: center; gap: 10px; height: 36px; padding: 0 10px; border: 0; border-radius: var(--r-ctl);
    background: transparent; color: var(--ink); font-size: 14px; font-weight: 500; text-align: left;
    transition: background-color 120ms ease, transform 80ms ease;
  }
  .fly-item > :global(svg) { flex: none; color: var(--ink-2); }
  .fly-item:active { transform: scale(0.98); }
  .fly-item:hover { background: var(--panel-2); }
  /* a tool that cannot be used yet (no sample points, no line drawn): 45%, no hover; its tooltip says why */
  .fly-item.off { opacity: 0.45; cursor: not-allowed; }
  .fly-item.off:hover { background: transparent; }
  .fly-item:focus-visible { outline-offset: -2px; }
  /* the running tool: Ruling Blue Wash with an inset ring, as for the other text rows (The One Chosen Rule) */
  .fly-item[aria-current='true'] { background: var(--accent-wash); color: var(--accent-ink); box-shadow: inset 0 0 0 1.5px var(--accent); }
  .fly-item[aria-current='true'] > :global(svg) { color: inherit; }
  .status {
    position: absolute; left: 76px; bottom: 16px; z-index: 5; display: flex; gap: 14px; align-items: center; height: 30px; padding: 0 12px;
    background: var(--panel); border-radius: var(--r-ctl); box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
    font-size: 11.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; white-space: nowrap; max-width: calc(100% - 590px); min-width: 0; overflow: hidden;
  }
  /* the selection text gives way (with an ellipsis) so the bar never runs under the scale box */
  .status span { flex: none; }
  .status .selinfo { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .guide-line { stroke: var(--accent); stroke-width: 1px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
  .loadbar { position: absolute; z-index: 9; left: 0; right: 0; top: 0; height: 3px; overflow: hidden; background: var(--accent-wash); }
  .loadbar::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 30%; background: var(--accent); border-radius: 2px; transform: translateX(-100%); animation: loadbar 1.1s var(--ease) infinite; }
  @keyframes loadbar { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
  @media (prefers-reduced-motion: reduce) { .loadbar::after { animation: none; transform: none; width: 100%; opacity: 0.5; } }
  .paltip { position: absolute; z-index: 20; transform: translateY(-50%); white-space: nowrap; pointer-events: none; padding: 4px 8px; border-radius: var(--r-chip); background: var(--ink); color: var(--panel); font-size: 11.5px; font-weight: 500; box-shadow: var(--shadow-1); animation: paltip 140ms var(--ease) 200ms both; }
  @keyframes paltip { from { opacity: 0; translate: -4px 0; } to { opacity: 1; translate: 0 0; } }
  @media (prefers-reduced-motion: reduce) { .paltip { animation: none; } }
  .cvdnote { position: absolute; z-index: 8; left: 50%; bottom: 14px; transform: translateX(-50%); display: flex; align-items: center; gap: 10px; padding: 6px 8px 6px 14px; border-radius: 999px; background: var(--ink); color: var(--panel); font-size: 12.5px; font-weight: 500; box-shadow: var(--shadow-2); white-space: nowrap; }
  .cvdnote button { border: 0; border-radius: 999px; padding: 4px 10px; background: rgb(255 255 255 / 0.14); color: inherit; font-weight: 600; font-size: 11.5px; }
  .cvdnote button:hover { background: rgb(255 255 255 / 0.24); }
  .arrpop { width: 232px; gap: 8px; }
  .arrgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
  .arrgrid.two { grid-template-columns: 1fr 1fr; }
  .arrgrid button { display: grid; justify-items: center; gap: 3px; padding: 7px 4px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel); font-size: 11.5px; font-weight: 500; color: var(--ink-2); }
  .arrgrid.two button { display: flex; justify-content: center; align-items: center; gap: 6px; }
  .arrgrid button:hover { border-color: var(--accent); background: var(--accent-wash); color: var(--ink); }
  .gridpop { position: absolute; z-index: 9; display: grid; gap: 10px; width: 250px; padding: 14px; background: var(--panel); border-radius: var(--r-panel); box-shadow: var(--shadow-2), 0 0 0 1px var(--line); }
  .gp-lbl { font-size: 11.5px; color: var(--ink-3); }
  .tb-sep { width: 1px; height: 20px; background: var(--line); margin: 0 2px; }
  .stage { position: relative; }
  .page { position: relative; background: #fff; box-shadow: var(--shadow-page); border-radius: 2px; }
  /* a see-through page shows the usual checkerboard */
  .page.clear { background: repeating-conic-gradient(#e9ebea 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
  .pagegrip { position: absolute; z-index: 3; border: 0; padding: 0; background: transparent; touch-action: none; }
  .pagegrip::after { content: ''; position: absolute; border-radius: 3px; background: var(--line-strong); transition: background 0.15s; }
  .pagegrip:hover::after, .pagegrip.active::after, .pagegrip:focus-visible::after, .pagegrip.on::after { background: var(--accent); }
  /* the selected page: a blue edge, and its edge handles stand out */
  .page.on { outline: 2px solid var(--accent); outline-offset: 1px; }
  .pagegrip.right, .pagegrip.left { top: 50%; width: 24px; height: 56px; margin-top: -28px; cursor: ew-resize; }
  .pagegrip.right { right: -26px; } .pagegrip.left { left: -26px; }
  .pagegrip.right::after, .pagegrip.left::after { left: 10px; top: 8px; width: 4px; height: 40px; }
  .pagegrip.bottom, .pagegrip.top { left: 50%; height: 24px; width: 56px; margin-left: -28px; cursor: ns-resize; }
  .pagegrip.bottom { bottom: -26px; } .pagegrip.top { top: -26px; }
  .pagegrip.bottom::after, .pagegrip.top::after { top: 10px; left: 8px; height: 4px; width: 40px; }
  .pagesize { position: absolute; z-index: 4; right: 0; bottom: calc(100% + 28px); background: var(--ink); color: var(--panel); font-size: 11.5px; font-weight: 600; padding: 3px 8px; border-radius: var(--r-chip); font-variant-numeric: tabular-nums; pointer-events: none; }
  .fig, .fig :global(svg.figure) { position: absolute; inset: 0; width: 100%; height: 100%; }
  .overlay { position: absolute; inset: 0; touch-action: pan-x pan-y; overflow: visible; }
  /* touch drags move items, the map or draw only while one of those is possible; otherwise the page scrolls */
  .overlay.working { touch-action: none; }
  .overlay:focus { outline: none; }
  .overlay:focus-visible:not(.pointerfocus) { outline: 2px solid var(--accent); outline-offset: 4px; }
  .sel { fill: none; stroke: var(--accent); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
  .sel.extra { stroke-dasharray: 5 3; fill: rgb(47 111 181 / 0.05); pointer-events: none; }
  .stalk { stroke: var(--accent); stroke-width: 1px; vector-effect: non-scaling-stroke; pointer-events: none; }
  .hit.turn, .handle.turn { cursor: grab; }
  .ctxmenu { width: 228px; padding: 6px; display: grid; gap: 1px; max-height: calc(100% - 16px); overflow-y: auto; } /* a short desk scrolls the menu instead of cutting it off */
  .ctxmenu button { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 32px; padding: 0 10px; border: 0; box-shadow: none; border-radius: 6px; font-size: 12.5px; font-weight: 400; color: var(--ink); text-align: left; background: transparent; }
  .ctxmenu button:hover:not(:disabled), .ctxmenu button:focus-visible { background: var(--panel-2); }
  .ctxmenu button:disabled { opacity: 0.45; cursor: not-allowed; }
  .ctxmenu button.danger:hover:not(:disabled) { color: var(--err); }
  .ctxmenu kbd { margin-left: auto; font-family: inherit; font-size: 11.5px; color: var(--ink-3); background: none; border: 0; padding: 0; }
  .ctxsep { height: 1px; background: var(--line); margin: 4px 2px; }
  @media (pointer: coarse) { .ctxmenu button { min-height: 44px; } }
  .marquee { fill: rgb(47 111 181 / 0.07); stroke: var(--accent); stroke-width: 1px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
  /* the one feature picked inside the map */
  .picked { fill: rgb(47 111 181 / 0.06); stroke: var(--accent); stroke-width: 1.5px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
  .handle { fill: #fff; stroke: var(--accent); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
  .handle.nw, .handle.se, .hit.nw, .hit.se { cursor: nwse-resize; }
  .hit.ne, .hit.sw { cursor: nesw-resize; }
  .hit { fill: transparent; stroke: none; }
  .handle.ne, .handle.sw { cursor: nesw-resize; }
  circle[data-corner='p1'], circle[data-corner='p2'] { cursor: move; }
  .guide { stroke: var(--accent); stroke-width: 1px; vector-effect: non-scaling-stroke; }
  .adjust { fill: none; stroke: var(--accent); stroke-width: 2px; vector-effect: non-scaling-stroke; stroke-dasharray: 6 4; }
  .draw-zone { fill: rgb(47 111 181 / 0.04); stroke: var(--accent); stroke-width: 1px; vector-effect: non-scaling-stroke; }
  .draft { fill: rgb(47 111 181 / 0.12); stroke: var(--accent); stroke-width: 2px; vector-effect: non-scaling-stroke; stroke-linejoin: round; }

  .toolbar {
    position: absolute; top: 30px; left: 50%; transform: translateX(-50%); z-index: 6;
    display: flex; align-items: center; gap: 4px;
    max-width: calc(100% - 24px);
    padding: 5px 6px 5px 12px;
    background: var(--panel); border-radius: var(--r-panel);
    box-shadow: var(--shadow-2), 0 0 0 1px var(--line);
    color: var(--ink-2);
    white-space: nowrap; overflow-x: auto;
  }
  .tb-label { font-size: 12.5px; padding: 0 6px; }
  .tb-label.muted { color: var(--ink-3); font-size: 11.5px; white-space: nowrap; }
  .toolbar.compact .tb-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .toolbar.compact .tb-btn { padding-inline: 8px; }
  /* phones: the page tools take two short rows instead of running off the screen */
  .toolbar.pagebar.compact { flex-wrap: wrap; justify-content: center; white-space: normal; row-gap: 2px; padding: 5px 6px; width: max-content; max-width: calc(100% - 16px); }
  .toolbar.pagebar.compact .tb-label.strong { flex-basis: 100%; text-align: center; border-right: 0; padding: 2px 0 0; margin: 0; }
  .tb-label.strong { font-weight: 600; color: var(--ink); padding-right: 10px; margin-right: 2px; border-right: 1px solid var(--line); }
  .tb-btn, .tb-icon {
    display: inline-flex; align-items: center; gap: 6px; height: 34px;
    border: 0; border-radius: var(--r-ctl); background: transparent; color: var(--ink);
    font-size: 12.5px; font-weight: 500; padding: 0 10px;
    transition: background-color 120ms ease, color 120ms ease, transform 80ms ease;
  }
  .tb-btn:active:not(:disabled), .tb-icon:active:not(:disabled) { transform: scale(0.97); }
  .tb-icon { width: 34px; padding: 0; justify-content: center; color: var(--ink-2); }
  .tb-icon[aria-pressed='true'] { background: var(--accent-wash); color: var(--accent-ink); }
  .aa { font-weight: 700; font-size: 16px; line-height: 1; }
  .aa.sm { font-size: 11.5px; }
  .tb-size { min-width: 38px; text-align: center; font-size: 12.5px; font-weight: 600; color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .tb-btn:hover:not(:disabled), .tb-icon:hover:not(:disabled) { background: var(--panel-2); }
  .tb-btn:disabled, .tb-icon:disabled { opacity: 0.45; cursor: not-allowed; }
  .tb-btn[aria-pressed='true'] { background: var(--accent-wash); color: var(--accent-ink); }
  .tb-btn.primary { background: var(--graphite); color: #fff; }
  .tb-btn.primary:hover { background: var(--graphite-hover); }
  /* Delete is the last button, after a hairline; red only appears when the pointer is on it (red is for destructive steps) */
  .tb-icon.danger:hover:not(:disabled) { background: var(--err-wash); color: var(--err); }
  /* drawing and placing: the words may wrap, so Done and Cancel never leave the screen (the long sentence of a line or area is the one that overflowed) */
  .toolbar.fitbar { width: max-content; white-space: normal; overflow: visible; }
  .toolbar.fitbar > :global(svg), .toolbar.fitbar .tb-btn { flex: none; }
  .toolbar.fitbar .tb-label { flex: 1 1 0; min-width: 0; padding-block: 3px; line-height: 1.3; }

  .hint-pill .short { display: none; }
  @media (max-width: 760px) { .hint-pill .long { display: none; } .hint-pill .short { display: inline; } }
  .hint-pill {
    position: absolute; z-index: 6; top: 14px; left: 50%; transform: translateX(-50%);
    margin: 0; padding: 9px 14px; border-radius: var(--r-card);
    background: var(--panel); color: var(--ink-2); font-size: 14px;
    box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
    white-space: nowrap;
    max-width: calc(100% - 32px);
    overflow: hidden; text-overflow: ellipsis;
  }
  .start {
    position: absolute; z-index: 7; left: 50%; top: 18px; transform: translateX(-50%);
    width: min(520px, calc(100% - 40px));
    display: grid; gap: 12px; padding: 26px 26px 20px;
    background: rgb(255 255 255 / 0.97); border-radius: var(--r-panel);
    box-shadow: 0 24px 60px -24px rgb(43 45 47 / 0.30), 0 0 0 1px var(--line);
  }
  .start h2 { margin: 0; font-size: 24px; letter-spacing: -0.02em; font-weight: 700; }
  .draw-link { justify-self: start; display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--accent); font-weight: 600; padding: 6px 0; }
  .draw-link:hover { text-decoration: underline; text-underline-offset: 3px; }

  .textedit {
    position: absolute; z-index: 7; padding: 0 6px; border: 2px solid var(--accent); border-radius: 4px;
    background: #fff; color: #1B1F1D; font-family: Arimo, Arial, sans-serif; box-shadow: var(--shadow-2);
  }
  .textedit:focus-visible { outline: none; }
  textarea.textedit { resize: none; overflow: hidden; line-height: 1.25; }
  /* the map's zoom buttons: a segment of the scale box after a hairline, beside the page and never on it; icons in Ink on white, fully opaque */
  .mapzoom { display: flex; align-items: center; margin-left: 4px; padding-left: 4px; border-left: 1px solid var(--line); }
  .mapzoom button { width: 28px; height: 26px; border: 0; background: transparent; display: grid; place-items: center; color: var(--ink); border-radius: var(--r-chip); transition: background-color 120ms ease, transform 80ms ease; }
  .mapzoom button:active:not(:disabled) { transform: scale(0.97); }
  .mapzoom button:hover { background: var(--panel-2); }
  .grip { fill: var(--accent); cursor: move; }
  .scalebox {
    position: absolute; right: 150px; bottom: 16px; z-index: 6;
    display: flex; align-items: center; gap: 2px; height: 34px; padding: 0 4px 0 10px;
    background: var(--panel); border-radius: var(--r-card); box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
    font-size: 12.5px; color: var(--ink-2);
  }
  .scalebox label { white-space: nowrap; font-weight: 500; }
  .scalebox input { width: 92px; height: 26px; border: 1px solid transparent; border-radius: var(--r-chip); background: transparent; padding: 0 4px; font: inherit; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
  .scalebox input:hover { border-color: var(--line-strong); }
  .scalebox input:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); background: var(--panel); }
  .scalebox select { width: 26px; height: 26px; border: 0; background: transparent; color: var(--ink-2); cursor: pointer; appearance: none; text-align: center; border-radius: var(--r-chip); }
  .scalebox select:hover { background: var(--panel-2); }
  @media (max-width: 760px) { .scalebox { right: auto; left: 12px; } .scalebox label { font-size: 0; } .scalebox label::after { content: '1:'; font-size: 12.5px; } }
  /* a phone: the colour-blind note sits above the scale box and zoom buttons, and wraps instead of covering them */
  @media (max-width: 760px) { .cvdnote { bottom: 66px; white-space: normal; max-width: calc(100% - 24px); } }
  .zoom {
    position: absolute; right: 16px; bottom: 16px; z-index: 6;
    display: flex; align-items: center; background: var(--panel); border-radius: var(--r-card);
    box-shadow: var(--shadow-1), 0 0 0 1px var(--line);
  }
  .zoom button { height: 34px; min-width: 34px; border: 0; background: transparent; display: grid; place-items: center; color: var(--ink-2); border-radius: var(--r-card); transition: background-color 120ms ease, color 120ms ease, transform 80ms ease; }
  .zoom button:active:not(:disabled) { transform: scale(0.97); }
  .zoom button:hover { background: var(--panel-2); color: var(--ink); }
  .pct { font-size: 12.5px; font-weight: 600; padding: 0 6px; }
  .toast {
    position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 8;
    width: max-content; max-width: min(560px, calc(100% - 24px));
    display: flex; gap: 12px; align-items: center;
    background: var(--ink); color: #f3f4f6; border-radius: var(--r-card);
    padding: 9px 9px 9px 14px; font-size: 14px;
    box-shadow: var(--shadow-2);
    transition: opacity 160ms ease, transform 160ms var(--ease);
  }
  /* a message rises in and fades out; when there is none it is hidden, not removed, so the next one is read out */
  .toast.empty { opacity: 0; transform: translate(-50%, 6px); visibility: hidden; transition: opacity 160ms ease, transform 160ms ease, visibility 0s 160ms; }
  .toast > span { min-width: 0; }
  .toast button { flex: none; border: 0; background: rgb(255 255 255 / 0.12); color: #fff; font-weight: 600; padding: 5px 10px; border-radius: var(--r-chip); }
  /* touch screens: every control at least 44 x 44 px */
  @media (pointer: coarse) {
    .mapzoom button, .zoom button, .tb-icon, .pal { min-width: 44px; min-height: 44px; }
    .fly-item { min-height: 44px; }
    .tb-btn { min-height: 44px; }
    .scalebox { height: 48px; }
    .scalebox input { min-height: 44px; }
    .scalebox select { min-width: 44px; min-height: 44px; }
    .toast button { min-width: 44px; min-height: 44px; }
  }
  @media (max-width: 760px) {
    .scroller { inset: 56px 0 0 0; padding: 6px 8px 56px; }
    .pagegrip { display: none; } /* phones: Design, Page size */
    .start { top: 12px; transform: translateX(-50%); padding: 18px; }
    .start h2 { font-size: 20px; }
    .toast { bottom: 66px; } /* above the scale box and the page zoom */
  }
  /* forced colours (Windows high contrast): the pressed tool and the toolbar words keep a visible edge */
  @media (forced-colors: active) {
    .pal[aria-pressed='true'], .tb-icon[aria-pressed='true'], .tb-btn[aria-pressed='true'], .fly-item[aria-current='true'] { outline: 2px solid Highlight; }
    .tb-btn, .toast button, .cvdnote button { border: 1px solid ButtonText; }
    .flyout { border: 1px solid CanvasText; }
  }
</style>
