<script lang="ts">
  // The exported figure. Everything here is in millimetres and is exactly what gets exported.
  import type { FeatureCollection } from 'geojson';
  import type { CreditsItem, DetailItem, Doc, InsetItem, LegendItem, MapItem, NorthItem, ScaleItem, TitleItem, ShapeItem, ProfileItem, TableItem } from '../lib/store.svelte';
  import type { InsetScene, LayerDraw, MainScene } from '../lib/scene';
  import type { DetailDraw } from '../lib/frames.svelte';
  import type { ScaleBarSpec } from '../lib/carto';
  import { fmtNumber } from '../lib/carto';
  import { ptToMm } from '../lib/journals';
  import { gridSettings, gridDecor } from '../lib/grid';
  import MapFrame from './MapFrame.svelte';
  import { crosses, dashFor, detailZoom, facingSegs, n3, symbolPath } from '../lib/figdraw';
  import { textWidthMm, wrapText } from '../lib/measure';
  import { fontStack } from '../lib/fonts.svelte';
  import { look, TEXT, shownText } from '../lib/textstyle';
  import { legendPlan, legendRows } from '../lib/legend';
  import { inkOn } from '../lib/marks';
  import { clipText, lineCoords, profileLayout, tableData, tableLayout } from '../lib/figparts';
  import { profileState } from '../lib/figparts.svelte';

  interface Props {
    doc: Doc;
    main: MainScene | null;
    insets: Record<string, InsetScene | null>;
    scale: ScaleBarSpec | null;
    credits: string[];
    terrainHref?: string | null;
    /** lowest and highest ground in the map, for the elevation colour bar */
    elevation?: { min: number; max: number } | null;
    basemapHref?: string | null;
    /** the points and lines of the user's layers (the table of sites and the profile's line are read from them) */
    geoms?: Record<string, FeatureCollection>;
    labels?: Record<string, LayerDraw['labels']>;
    /** the detail maps' scenes, their names and images, by part id */
    details?: Record<string, DetailDraw | null>;
    /** live pan/zoom preview applied to the map content while a gesture is in progress, and the map frame it is for (unset = the main map) */
    contentTransform?: string;
    contentFor?: string;
    svgEl?: SVGSVGElement;
  }
  let { doc, main, insets, scale, credits, terrainHref = null, elevation = null, basemapHref = null, geoms = {}, labels = {}, details = {}, contentTransform = '', contentFor = undefined, svgEl = $bindable() }: Props = $props();

  const FONT = $derived(fontStack(doc.font));
  const mm = ptToMm;
  const studyLayer = $derived(doc.layers.find((l) => l.kind === 'study' && l.visible));
  const seaFill = $derived(doc.layers.find((l) => l.kind === 'sea')?.style.fill ?? '#DCEAF1');

  // Same muted hypsometric ramp as the terrain worker, for the legend's colour bar.
  const ELEV_RAMP: [number, string][] = [[0, '#D6E2CD'], [0.12, '#C4D6B4'], [0.3, '#DED6AA'], [0.5, '#CEB68C'], [0.7, '#B89C80'], [0.88, '#CCC4BE'], [1, '#F0EEEC']];
  /**
   * Lines from the extent box in a locator map to the main map's corners, as in printed atlases.
   * Left out when a line would run across another part of the figure (the legend, the globe...), which looks broken.
   */
  /** m: the frame the lines run to, the main map or (drill-down) the locator this one marks */
  function connectors(ins: InsetItem, box: { x0: number; y0: number; x1: number; y1: number } | null, m: { id: string; x: number; y: number; w: number; h: number } | undefined): string {
    if (!box || !m) return '';
    let segs = facingSegs({ x0: ins.x + box.x0, y0: ins.y + box.y0, x1: ins.x + box.x1, y1: ins.y + box.y1 }, ins, m);
    if (!segs.length) return '';
    // a turned locator carries its zoom box with it, so the lines start where the box now is (they end on the map, which stays put)
    const turn = ((ins.look?.rotate ?? 0) * Math.PI) / 180;
    if (turn) {
      const cx = ins.x + ins.w / 2, cy = ins.y + ins.h / 2, cos = Math.cos(turn), sin = Math.sin(turn);
      segs = segs.map(([p, q]) => [[cx + (p[0] - cx) * cos - (p[1] - cy) * sin, cy + (p[0] - cx) * sin + (p[1] - cy) * cos], q]);
    }
    const others = doc.items.filter((o) => o.visible && o.id !== ins.id && o.id !== m.id && o.kind !== 'shape' && !(o.kind === 'title' && Math.abs(o.w) < 14 && Math.abs(o.h) < 9));
    if (segs.some(([p, q]) => others.some((o) => crosses(p, q, o)))) return '';
    return segs.map(([p, q]) => `M${n3(p[0])},${n3(p[1])}L${n3(q[0])},${n3(q[1])}`).join('');
  }
  const mapItem = $derived(doc.items.find((i) => i.kind === 'map' && i.visible) as MapItem | undefined);
  /** the detail maps' ground as boxes on the main map (drawn in its content), and the lines from each box to its detail map */
  const detailBoxes = $derived(detailZoom(doc, main, details));
  /**
   * "A" and "B" at the two ends of the line of each elevation profile that shows them, so a reader can match the chart to the map.
   * The letter sits just beyond the end, in the direction the line comes from.
   */
  const profileEnds = $derived.by(() => {
    const out: { id: string; color: string; fs: number; ends: { letter: string; x: number; y: number; cx: number; cy: number }[] }[] = [];
    if (!main) return out;
    for (const it of doc.items) {
      if (it.kind !== 'profile' || !it.visible || !it.ends) continue;
      const c = lineCoords(it.line, geoms);
      if (!c) continue;
      const q = c.map((p) => main.fp.forward(p));
      const fs = mm(it.labelPt);
      const end = (at: number, step: 1 | -1, letter: string) => {
        const e = q[at];
        if (!e) return null;
        // the first vertex a few mm away fixes the direction (the next one may sit almost on the end)
        let from = e;
        for (let i = at + step; i >= 0 && i < q.length; i += step) { const v = q[i]; if (v && Math.hypot(v[0] - e[0], v[1] - e[1]) > 2.5) { from = v; break; } from = v ?? from; }
        const dx = e[0] - from[0], dy = e[1] - from[1], len = Math.hypot(dx, dy) || 1;
        const off = 0.8 + fs * 0.55;
        return { letter, x: e[0], y: e[1], cx: e[0] + (dx / len) * off, cy: e[1] + (dy / len) * off };
      };
      const a = end(0, 1, 'A'), b = end(q.length - 1, -1, 'B');
      out.push({ id: it.id, color: it.color, fs, ends: [a, b].filter((x): x is NonNullable<typeof a> => !!x) });
    }
    return out;
  });

  function ratioText(sc: ScaleBarSpec, kind: 'cm' | 'fraction'): string {
    const perUnit = sc.unit === 'km' ? 1000 : sc.unit === 'mi' ? 1609.344 : 1;
    const mPerMm = (sc.segmentValue * sc.segments * perUnit) / sc.totalMm;
    if (kind === 'cm') {
      const km = (mPerMm * 10) / 1000;
      return `1 cm = ${km >= 10 ? Math.round(km) : km >= 1 ? km.toFixed(1).replace(/\.0$/, '') : `${Math.round(km * 1000)} m`.replace(/ m$/, '')}${km >= 1 ? ' km' : ' m'}`;
    }
    const den = mPerMm * 1000;
    const p = 10 ** Math.floor(Math.log10(den) - 1);
    return `1:${(Math.round(den / p) * p).toLocaleString('en-US')}`;
  }
</script>

<svg
  bind:this={svgEl}
  xmlns="http://www.w3.org/2000/svg"
  width="{doc.widthMm}mm"
  height="{doc.heightMm}mm"
  viewBox="0 0 {doc.widthMm} {doc.heightMm}"
  font-family={FONT}
  style="font-synthesis:none"
  class="figure"
  role="img"
  aria-labelledby="fig-title"
>
  <title id="fig-title">Map of {doc.study.name || 'the study area'}{doc.study.countryName && doc.study.countryName !== doc.study.name ? `, ${doc.study.countryName}` : ''}{main ? `. Projection: ${main.crs.name}` : ''}</title>
  {#if doc.pageColor !== 'none'}<rect x="0" y="0" width={doc.widthMm} height={doc.heightMm} fill={doc.pageColor || '#ffffff'} />{/if}
  {#each doc.items as it (it.id)}
    {#if it.visible && (doc.study.source !== 'none' || it.kind === 'map')}
      {#if it.kind === 'map'}
        <MapFrame {doc} m={it as MapItem} scene={main} {labels} contentTransform={contentFor && contentFor !== it.id ? '' : contentTransform} {terrainHref} {basemapHref} {profileEnds} boxes={detailBoxes} />
      {:else if it.kind === 'detail'}
        {@const dm = it as DetailItem}
        {@const dd = details[dm.id]}
        {@const zb = detailBoxes.find((b) => b.id === dm.id)}
        <!-- a detail map: the same layers as the main map at its own place and scale (no box or turn of its own); its zoom lines go over the map right after it -->
        <MapFrame {doc} m={dm} scene={dd?.scene ?? null} labels={dd?.labels ?? {}} contentTransform={contentFor === dm.id ? contentTransform : ''} terrainHref={dd?.terrainHref} basemapHref={dd?.basemapHref} />
        {#if zb?.lines}
          <path d={zb.lines} fill="none" stroke={dm.boxColor} stroke-width={n3(mm(dm.connectPt ?? 0.5))} stroke-dasharray={dm.connectDash ? `${n3(mm(dm.connectPt ?? 0.5) * 5)} ${n3(mm(dm.connectPt ?? 0.5) * 3)}` : undefined} />
        {/if}
      {:else}
      {@const lk = it.look}
      {@const pad = lk?.pad ?? 1}
      <!-- the part's own box: turned about its centre, see-through, with a background or border when set -->
      <g transform={lk?.rotate ? `rotate(${n3(lk.rotate)} ${n3(it.x + it.w / 2)} ${n3(it.y + it.h / 2)})` : undefined} opacity={lk?.opacity !== undefined && lk.opacity < 1 ? n3(lk.opacity) : undefined}>
      {#if lk && (lk.bg || lk.border)}
        <rect x={n3(Math.min(it.x, it.x + it.w) - pad)} y={n3(Math.min(it.y, it.y + it.h) - pad)} width={n3(Math.abs(it.w) + 2 * pad)} height={n3(Math.abs(it.h) + 2 * pad)} rx={lk.radius ? n3(lk.radius) : undefined} fill={lk.bg ?? 'none'} fill-opacity={lk.bg && lk.bgOpacity !== undefined ? n3(lk.bgOpacity) : undefined} stroke={lk.border ?? 'none'} stroke-width={lk.border ? n3(mm(lk.borderPt ?? 0.5)) : undefined} />
      {/if}
      {#if it.kind === 'inset'}
        {@const ins = it as InsetItem}
        {@const sc = insets[ins.id]}
        <g transform="translate({ins.x},{ins.y})">
          <defs><clipPath id="clip-{ins.id}"><rect width={ins.w} height={ins.h} /></clipPath></defs>
          {#if sc}
            <g clip-path="url(#clip-{ins.id})">
              <path d={sc.sphere} fill={ins.colours?.sea ?? seaFill} />
              {#if sc.graticule}<path d={sc.graticule} fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width={n3(mm(0.2))} />{/if}
              <path d={sc.land} fill={ins.colours?.land ?? '#F4F3EE'} stroke={sc.official ? 'none' : ins.colours?.lines ?? '#9A9A94'} stroke-width={n3(mm(0.25))} stroke-linejoin="round" />
              <path d={sc.focus} fill={ins.colours?.focus ?? (sc.admin ? '#F4F3EE' : '#D9D7CC')} stroke="#4A4A46" stroke-width={n3(mm(0.4))} stroke-linejoin="round" />
              {#if sc.admin}<path d={sc.admin} fill="none" stroke={ins.colours?.lines ?? '#9A9A94'} stroke-width={n3(mm(0.2))} stroke-linejoin="round" />{/if}
              {#if sc.grid && ins.grid}
                {@const igs = gridSettings(ins.grid)}
                {#if igs.type === 'lines'}<path d={sc.grid.lines} fill="none" stroke={ins.grid.lineColor} stroke-width={n3(mm(igs.linePt))} stroke-opacity="0.85" stroke-dasharray={igs.dash ? `${n3(mm(igs.linePt) * 6)} ${n3(mm(igs.linePt) * 4)}` : undefined} />
                {:else if igs.type === 'crosses'}<path d={gridDecor(sc.grid, igs, ins.w, ins.h, mm(ins.grid.labelPt)).crosses} fill="none" stroke={ins.grid.lineColor} stroke-width={n3(mm(Math.max(igs.linePt, 0.3)))} />{/if}
              {/if}
              {#if sc.study && studyLayer}<path d={sc.study} fill={studyLayer.style.stroke} fill-opacity="0.45" stroke={studyLayer.style.stroke} stroke-width={n3(mm(0.3))} />{/if}
              {#if ins.showExtent}
                {#if sc.extent}<path d={sc.extent} fill={ins.extentColor} fill-opacity={ins.extentFill ?? 0.07} stroke={ins.extentColor} stroke-width={n3(mm(ins.extentPt ?? 0.8))} stroke-linejoin="round" />{/if}
                {#if sc.marker}<circle cx={n3(sc.marker.x)} cy={n3(sc.marker.y)} r="1.3" fill="none" stroke={ins.extentColor} stroke-width={n3(mm(1))} /><circle cx={n3(sc.marker.x)} cy={n3(sc.marker.y)} r="0.35" fill={ins.extentColor} />{/if}
              {/if}
            </g>
            {#if ins.context === 'globe'}
              <path d={sc.sphere} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.5))} />
            {:else}
              {#if sc.grid && ins.grid}
                {@const igs = gridSettings(ins.grid)}
                {@const ifs = mm(ins.grid.labelPt)}
                {@const ideco = gridDecor(sc.grid, igs, ins.w, ins.h, ifs)}
                {@const igl = look(ins.grid.text, TEXT.grid)}
                {#each ideco.zebra as z}<rect x={n3(z.x)} y={n3(z.y)} width={n3(z.w)} height={n3(z.h)} fill={z.dark ? '#1B1F1D' : '#ffffff'} stroke="#1B1F1D" stroke-width={n3(mm(0.2))} />{/each}
                {#if ideco.ticks}<path d={ideco.ticks} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.35))} />{/if}
                {#each ideco.texts as t}<text transform="translate({n3(t.x)},{n3(t.y)}){t.rotate ? ` rotate(${t.rotate})` : ''}" font-size={n3(ifs)} font-weight={igl.weight} font-style={igl.style} text-anchor={t.anchor} fill={igl.fill}>{t.text}</text>{/each}
              {/if}
              {#if (ins.framePt ?? 0.5) > 0}<rect width={ins.w} height={ins.h} fill="none" stroke={ins.frameColor ?? '#1B1F1D'} stroke-width={n3(mm(ins.framePt ?? 0.5))} />{/if}
            {/if}
            {#if sc.label}
              {@const il = look(ins.text, TEXT.insetLabel)}
              {@const letter = /^\([a-z0-9]{1,2}\)$/i.test(sc.label.trim())}
              {@const lfs = mm(ins.labelPt)}
              {#if letter}
                <rect x="0.8" y="0.8" width={n3(textWidthMm(sc.label, ins.labelPt, il.weight >= 600) + 1.6)} height={n3(lfs * 1.15 + 1)} rx="0.5" fill="#ffffff" fill-opacity="0.85" />
                <text x="1.6" y={n3(0.8 + lfs * 0.95)} font-size={n3(lfs)} font-weight={il.weight} font-style={il.style} fill={il.fill}>{sc.label}</text>
              {:else}
                <text x="1.5" y={n3(ins.h - 1.5)} font-size={n3(lfs)} font-weight={il.weight} font-style={il.style} fill={il.fill}>{sc.label}</text>
              {/if}
            {/if}
          {:else}
            <rect width={ins.w} height={ins.h} fill="#F4F3EE" stroke="#1B1F1D" stroke-width={n3(mm(0.5))} />
          {/if}
        </g>
      {:else if it.kind === 'north'}
        {@const nt = it as NorthItem}
        {@const ang = nt.trueNorth && main ? main.northAngle : 0}
        {@const cx = nt.w / 2}
        {@const fs = Math.min(nt.w * 0.55, nt.h * 0.3)}
        {@const nl = look(nt.text, TEXT.north)}
        {@const nc = nt.color ?? '#1B1F1D'}
        <!-- the letters can be left off or made larger (the arrow keeps its size) -->
        {@const lf = fs * (nt.nSize ?? 1)}
        <g transform="translate({nt.x},{nt.y})">
          {#if nt.backdrop}<rect x="-1" y="-0.8" width={nt.w + 2} height={nt.h + 1.8} rx="0.6" fill="#ffffff" fill-opacity="0.82" />{/if}
          <g transform="rotate({n3(ang)},{n3(cx)},{n3(nt.h * 0.62)})">
            {#if nt.style === 'rose'}
              {@const r = Math.min(nt.w, nt.h * 0.75) * 0.46}
              {@const cy = nt.h * 0.6}
              <path d="M{cx},{n3(cy - r)} L{n3(cx + r * 0.2)},{n3(cy - r * 0.2)} L{n3(cx + r)},{n3(cy)} L{n3(cx + r * 0.2)},{n3(cy + r * 0.2)} L{cx},{n3(cy + r)} L{n3(cx - r * 0.2)},{n3(cy + r * 0.2)} L{n3(cx - r)},{n3(cy)} L{n3(cx - r * 0.2)},{n3(cy - r * 0.2)} Z" fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.4))} stroke-linejoin="round" />
              <path d="M{cx},{n3(cy - r)} L{n3(cx + r * 0.2)},{n3(cy - r * 0.2)} L{cx},{n3(cy)} Z M{n3(cx + r)},{n3(cy)} L{n3(cx + r * 0.2)},{n3(cy + r * 0.2)} L{cx},{n3(cy)} Z M{cx},{n3(cy + r)} L{n3(cx - r * 0.2)},{n3(cy + r * 0.2)} L{cx},{n3(cy)} Z M{n3(cx - r)},{n3(cy)} L{n3(cx - r * 0.2)},{n3(cy - r * 0.2)} L{cx},{n3(cy)} Z" fill={nc} />
              {#if !nt.hideN}
                <text x={n3(cx + r + 0.5)} y={n3(cy + lf * 0.3)} font-size={n3(lf * 0.62)} font-weight={nl.weight} font-style={nl.style} fill={nl.fill}>E</text>
                <text x={n3(cx - r - 0.5)} y={n3(cy + lf * 0.3)} font-size={n3(lf * 0.62)} font-weight={nl.weight} font-style={nl.style} text-anchor="end" fill={nl.fill}>W</text>
                <text x={cx} y={n3(cy + r + lf * 0.7)} font-size={n3(lf * 0.62)} font-weight={nl.weight} font-style={nl.style} text-anchor="middle" fill={nl.fill}>S</text>
              {/if}
            {:else if nt.style === 'compass'}
              <circle cx={cx} cy={n3(nt.h * 0.62)} r={n3(nt.w * 0.42)} fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.5))} />
              <path d="M{cx},{n3(nt.h * 0.62 - nt.w * 0.52)} L{n3(cx + nt.w * 0.13)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.62 + nt.w * 0.52)} L{n3(cx - nt.w * 0.13)},{n3(nt.h * 0.62)} Z" fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.4))} />
              <path d="M{cx},{n3(nt.h * 0.62 - nt.w * 0.52)} L{n3(cx + nt.w * 0.13)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.62)} Z" fill={nc} />
            {:else if nt.style === 'arrow'}
              <path d="M{cx},{n3(nt.h * 0.3)} L{n3(cx + nt.w * 0.32)},{n3(nt.h)} L{cx},{n3(nt.h * 0.84)} Z" fill={nc} />
              <path d="M{cx},{n3(nt.h * 0.3)} L{n3(cx - nt.w * 0.32)},{n3(nt.h)} L{cx},{n3(nt.h * 0.84)} Z" fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.5))} stroke-linejoin="round" />
            {:else if nt.style === 'star'}
              <path d="M{cx},{n3(nt.h * 0.3)} L{n3(cx + nt.w * 0.14)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.94)} L{n3(cx - nt.w * 0.14)},{n3(nt.h * 0.62)} Z" fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.5))} />
              <path d="M{cx},{n3(nt.h * 0.3)} L{n3(cx + nt.w * 0.14)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.62)} Z" fill={nc} />
              <path d="M{n3(cx - nt.w * 0.4)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.56)} L{n3(cx + nt.w * 0.4)},{n3(nt.h * 0.62)} L{cx},{n3(nt.h * 0.68)} Z" fill="#ffffff" stroke={nc} stroke-width={n3(mm(0.4))} />
            {:else}
              <line x1={cx} y1={n3(nt.h)} x2={cx} y2={n3(nt.h * 0.32)} stroke={nc} stroke-width={n3(mm(0.8))} />
              <path d="M{cx},{n3(nt.h * 0.28)} L{n3(cx + nt.w * 0.2)},{n3(nt.h * 0.5)} L{n3(cx - nt.w * 0.2)},{n3(nt.h * 0.5)} Z" fill={nc} />
            {/if}
          </g>
          {#if !nt.hideN}<text x={n3(cx)} y={n3(lf * 0.8)} font-size={n3(lf)} font-weight={nl.weight} font-style={nl.style} text-anchor="middle" fill={nl.fill}>N</text>{/if}
        </g>
      {:else if it.kind === 'scale' && scale}
        {@const s = it as ScaleItem}
        {@const fs = mm(s.labelPt)}
        {@const segW = scale.totalMm / scale.segments}
        {@const below = s.labelPos === 'below'}
        {@const barH = s.barH ?? Math.max(0.9, Math.min(1.6, s.h * 0.16))}
        <!-- bh: height of the bar's own zone (ticks stand taller than a line, a double box has two rows) -->
        {@const bh = s.style === 'ticks' ? barH + 0.8 : s.style === 'double' ? barH * 1.6 : barH}
        {@const barY = below ? 0.9 : fs + 0.9}
        {@const numY = below ? barY + bh + 0.7 + fs * 0.8 : fs * 0.8}
        {@const ratioOn = !!s.ratio && s.ratio !== 'none'}
        {@const ratioY = below ? numY + fs * 1.3 : barY + bh + fs * 1.05}
        {@const boxH = below ? numY + fs * 0.3 + (ratioOn ? fs * 1.3 : 0) + 0.6 : barY + bh + 1.4 + (ratioOn ? fs * 1.25 : 0)}
        {@const sl = look(s.text, TEXT.scale)}
        {@const ink = s.barDark ?? '#1B1F1D'}
        {@const lite = s.barLight ?? '#ffffff'}
        {@const unitLabel = s.unitText?.trim() || scale.unit}
        <!-- numbers never run into each other: every tick, every other one, or just the two ends -->
        {@const lw = textWidthMm(fmtNumber(scale.segments * scale.segmentValue), s.labelPt, sl.bold) + 1.2}
        {@const step = segW >= lw ? 1 : segW * 2 >= lw ? 2 : scale.segments}
        {#if s.backdrop}<rect x={n3(s.x)} y={n3(s.y - 0.8)} width={n3(scale.totalMm + 4 + textWidthMm(fmtNumber(scale.segments * scale.segmentValue), s.labelPt, sl.bold) / 2 + textWidthMm(unitLabel, s.labelPt, sl.bold) + 1.4)} height={n3(boxH + 0.8)} rx="0.6" fill="#ffffff" fill-opacity="0.82" />{/if}
        <g transform="translate({n3(s.x + 2)},{s.y})">
          {#if s.style === 'alternating'}
            {#each Array(scale.segments) as _, i}
              <rect x={n3(i * segW)} y={n3(barY)} width={n3(segW)} height={n3(barH)} fill={i % 2 === 0 ? ink : lite} stroke={ink} stroke-width={n3(mm(0.4))} />
            {/each}
          {:else if s.style === 'double'}
            {#each Array(scale.segments) as _, i}
              <rect x={n3(i * segW)} y={n3(barY)} width={n3(segW)} height={n3(bh / 2)} fill={i % 2 === 0 ? ink : lite} stroke={ink} stroke-width={n3(mm(0.4))} />
              <rect x={n3(i * segW)} y={n3(barY + bh / 2)} width={n3(segW)} height={n3(bh / 2)} fill={i % 2 === 0 ? lite : ink} stroke={ink} stroke-width={n3(mm(0.4))} />
            {/each}
          {:else if s.style === 'hollow'}
            {#each Array(scale.segments) as _, i}
              <rect x={n3(i * segW)} y={n3(barY)} width={n3(segW)} height={n3(barH)} fill={lite} stroke={ink} stroke-width={n3(mm(0.5))} />
            {/each}
          {:else if s.style === 'ticks'}
            <!-- one baseline; ticks stand into the zone between the line and the numbers, the two end ticks full height -->
            {@const base = below ? barY : barY + bh}
            {@const dir = below ? 1 : -1}
            <line x1="0" y1={n3(base)} x2={n3(scale.totalMm)} y2={n3(base)} stroke={ink} stroke-width={n3(mm(0.6))} />
            {#each Array(scale.segments + 1) as _, i}
              <line x1={n3(i * segW)} y1={n3(base)} x2={n3(i * segW)} y2={n3(base + dir * bh * (i === 0 || i === scale.segments ? 1 : 0.6))} stroke={ink} stroke-width={n3(mm(0.5))} />
            {/each}
          {:else if s.style === 'line'}
            <path d="M0,{n3(barY)}V{n3(barY + barH)}H{n3(scale.totalMm)}V{n3(barY)}" fill="none" stroke={ink} stroke-width={n3(mm(0.6))} />
            {#each Array(scale.segments - 1) as _, i}
              <line x1={n3((i + 1) * segW)} y1={n3(barY + barH * 0.4)} x2={n3((i + 1) * segW)} y2={n3(barY + barH)} stroke={ink} stroke-width={n3(mm(0.5))} />
            {/each}
          {/if}
          {#each Array(scale.segments + 1) as _, i}
            {@const last = i === scale.segments}
            {#if i === 0 || last || (i % step === 0 && scale.segments - i >= step)}
              <text x={n3(i * segW)} y={n3(numY)} font-size={n3(fs)} font-weight={sl.weight} font-style={sl.style} text-anchor="middle" fill={sl.fill}>{fmtNumber(i * scale.segmentValue)}</text>
            {/if}
          {/each}
          <text x={n3(scale.totalMm + textWidthMm(fmtNumber(scale.segments * scale.segmentValue), s.labelPt, sl.bold) / 2 + 0.8)} y={n3(numY)} font-size={n3(fs)} font-weight={sl.weight} font-style={sl.style} fill={sl.fill}>{unitLabel}</text>
          {#if ratioOn}
            <text x={n3(scale.totalMm / 2)} y={n3(ratioY)} font-size={n3(fs)} font-weight={sl.weight} font-style={sl.style} text-anchor="middle" fill={sl.fill}>{ratioText(scale, s.ratio as 'cm' | 'fraction')}</text>
          {/if}
        </g>
      {:else if it.kind === 'legend'}
        {@const lg = it as LegendItem}
        <!-- rows, columns and the swatch size come from legendLayout, which the checker and the box fitting share -->
        {@const rows = legendRows(doc, main, { terrain: !!terrainHref, elevation }, lg)}
        {@const plan = legendPlan(lg, rows)}
        {@const { fs, k, row, top, textX } = plan}
        {@const lt = look(lg.titleText, TEXT.legendTitle)}
        {@const le = look(lg.text, TEXT.legend)}
        <g transform="translate({lg.x},{lg.y})">
          {#if lg.frame}<rect width={lg.w} height={lg.h} fill="#ffffff" stroke="#1B1F1D" stroke-width={n3(mm(0.4))} />{/if}
          {#if lg.title}<text x={lg.titleAlign === 'middle' ? n3(lg.w / 2) : 1} y={n3(fs + 0.4)} font-size={n3(fs * 1.1)} font-weight={lt.weight} font-style={lt.style} text-anchor={lg.titleAlign === 'middle' ? 'middle' : undefined} fill={lt.fill}>{lg.title}</text>{/if}
          {#each rows as e, i}
            {@const y = plan.pos[i].y}
            {@const cx = plan.pos[i].x}
            {@const rh = e.h * row}
            {@const cy = y + rh / 2 - 0.3}
            {#if e.t === 'text'}
              <!-- a heading over the lines that follow: the title of a colour-by-value map, the column a size key is for -->
              <text x={n3(cx + 1)} y={n3(y + rh / 2 + fs * 0.32)} font-size={n3(fs)} font-weight={lt.weight} font-style={lt.style} fill={lt.fill}>{e.text}</text>
            {:else if e.t === 'box'}
              {#snippet boxSwatch()}
                <rect x="1" y={n3(cy - 1.3)} width="5" height="2.6" fill={e.fill} fill-opacity={e.opacity < 1 ? e.opacity : undefined} stroke={e.stroke} stroke-width={n3(mm(e.strokePt) / k)} />
                {#if e.hatch}<path d="M1.6,{n3(cy + 1.1)}l2.4,-2.4M3.2,{n3(cy + 1.1)}l2.4,-2.4M4.8,{n3(cy + 1.1)}l1,-1" stroke="#8C8C8C" stroke-width={n3(mm(0.35) / k)} />{/if}
              {/snippet}
              <g transform="translate({n3(cx)},0)">
                {#if k === 1}{@render boxSwatch()}{:else}<g transform="translate(1,{n3(cy)}) scale({k}) translate(-1,{n3(-cy)})">{@render boxSwatch()}</g>{/if}
                <text x={n3(e.textX ?? textX)} y={n3(y + rh / 2 + fs * 0.32)} font-size={n3(fs)} font-weight={le.weight} font-style={le.style} fill={le.fill}>{e.text}</text>
              </g>
            {:else if e.t === 'dot'}
              {@const d = e.dMm ?? Math.min(mm(e.layer.style.sizePt), 3)}
              {#snippet dotSwatch(x: number)}
                <path d={symbolPath(e.shape, d / 2)} transform="translate({n3(x)},{n3(cy)})" fill={e.fill} fill-opacity={e.opacity < 1 ? e.opacity : undefined} stroke={e.stroke} stroke-width={n3(mm(e.strokePt) / (e.key ? 1 : k))} />
                {#if e.num}<text x={n3(x)} y={n3(cy + (e.numMm ?? 2) * 0.35)} font-size={n3(e.numMm ?? 2)} font-weight="700" text-anchor="middle" fill={inkOn(e.fill)}>{e.num}</text>{/if}
              {/snippet}
              <g transform="translate({n3(cx)},0)">
                <!-- a key circle or numbered marker is drawn at its true size; a plain symbol scales with the legend's symbol size -->
                {#if e.key || e.num}{@render dotSwatch(e.keyX ?? 3.5)}{:else if k === 1}{@render dotSwatch(3.5)}{:else}<g transform="translate(1,{n3(cy)}) scale({k}) translate(-1,{n3(-cy)})">{@render dotSwatch(3.5)}</g>{/if}
                <text x={n3(e.textX ?? textX)} y={n3(y + rh / 2 + fs * 0.32)} font-size={n3(fs)} font-weight={le.weight} font-style={le.style} fill={le.fill}>{e.text}</text>
              </g>
            {:else if e.t === 'layer'}
            {@const l = e.layer}
            {@const st = l.style}
            {#snippet swatch()}
              {#if e.colour}
                <rect x="1" y={n3(y + row / 2 - 1.6)} width="5" height="2.6" fill={e.colour} stroke={st.stroke} stroke-width={n3(mm(0.3) / k)} />
              {:else if l.kind === 'study' && st.hatch}
                <rect x="1" y={n3(y + row / 2 - 1.6)} width="5" height="2.6" fill="#ffffff" stroke={st.stroke} stroke-width={n3(mm(st.strokePt) / k)} />
                <path d="M1.6,{n3(y + row / 2 + 0.9)}l2.4,-2.4M3.2,{n3(y + row / 2 + 0.9)}l2.4,-2.4M4.8,{n3(y + row / 2 + 0.9)}l1,-1" stroke={st.stroke} stroke-width={n3(mm(0.4) / k)} />
              {:else if l.kind === 'study' && main?.byId[l.id]?.paths[0]?.kind === 'point'}
                <circle cx="3.5" cy={n3(y + row / 2 - 0.3)} r="1.1" fill={st.stroke} stroke="#ffffff" stroke-width={n3(0.3 / k)} />
              {:else if l.kind === 'terrain' && l.terrain?.tint && elevation}
                <defs><linearGradient id="elev-{lg.id}" x1="0" x2="1" y1="0" y2="0">{#each ELEV_RAMP as [t, col]}<stop offset={t} stop-color={col} />{/each}</linearGradient></defs>
                <rect x="1" y={n3(y + row / 2 - 1.6)} width="5" height="2.6" fill="url(#elev-{lg.id})" stroke="#8C8C86" stroke-width={n3(mm(0.25) / k)} />
              {:else if l.kind === 'terrain'}
                <rect x="1" y={n3(y + row / 2 - 1.6)} width="5" height="2.6" fill="#ECEAE4" stroke="#8C8C86" stroke-width={n3(mm(0.25) / k)} />
                <path d="M1,{n3(y + row / 2 + 1)} L3.4,{n3(y + row / 2 - 1.6)} L6,{n3(y + row / 2 + 1)} Z" fill="#8F8B82" />
                <path d="M3.4,{n3(y + row / 2 - 1.6)} L6,{n3(y + row / 2 + 1)} L4.6,{n3(y + row / 2 + 1)} Z" fill="#5E5A53" />
              {:else if l.kind === 'points' || (l.kind === 'vector' && main?.byId[l.id]?.paths.length && main.byId[l.id].paths.every((p) => p.kind === 'point'))}
                <path d={symbolPath(st.symbol, Math.min(mm(st.sizePt), 3) / 2)} transform="translate({n3(3.5)},{n3(y + row / 2 - 0.3)})" fill={st.fill} stroke={st.stroke} stroke-width={n3(mm(st.strokePt) / k)} />
              {:else if (l.kind === 'vector' && main?.byId[l.id]?.paths.length && main.byId[l.id].paths.every((p) => p.kind === 'line')) || l.kind === 'rivers' || l.kind === 'admin' || l.kind === 'countries' || (l.kind === 'osm' && l.osmTheme === 'roads') || st.fill === 'none'}
                <line x1="1" y1={n3(y + row / 2 - 0.3)} x2="6" y2={n3(y + row / 2 - 0.3)} stroke={st.stroke} stroke-width={n3(mm(Math.max(st.strokePt, 0.5)) / k)} stroke-dasharray={dashFor(l)} />
              {:else}
                <rect x="1" y={n3(y + row / 2 - 1.6)} width="5" height="2.6" fill={st.fill} fill-opacity={st.fillOpacity} stroke={st.stroke} stroke-width={n3(mm(st.strokePt) / k)} stroke-dasharray={dashFor(l)} />
              {/if}
            {/snippet}
            <g transform="translate({n3(cx)},0)">
            <!-- a larger or smaller swatch is the same drawing scaled about its left-middle; its lines are scaled back so they keep their width -->
            {#if k === 1}{@render swatch()}{:else}<g transform="translate(1,{n3(cy)}) scale({k}) translate(-1,{n3(-cy)})">{@render swatch()}</g>{/if}
            <text x={n3(textX)} y={n3(y + row / 2 + fs * 0.32)} font-size={n3(fs)} font-weight={le.weight} font-style={le.style} fill={le.fill}>{e.text}</text>
            </g>
            {/if}
          {/each}
        </g>
      {:else if it.kind === 'credits'}
        {@const cr = it as CreditsItem}
        {@const fs = mm(cr.labelPt)}
        {@const ct = look(cr.text, TEXT.credits)}
        {@const lines = credits.flatMap((c) => wrapText(c, cr.labelPt, cr.w - 0.5, ct.bold))}
        <g transform="translate({cr.x},{cr.y})">
          {#each lines as line, i}
            <text x={cr.align === 'middle' ? n3(cr.w / 2) : cr.align === 'end' ? n3(cr.w) : 0} y={n3(fs * 0.85 + i * fs * 1.25)} font-size={n3(fs)} font-weight={ct.weight} font-style={ct.style} text-anchor={cr.align && cr.align !== 'start' ? cr.align : undefined} fill={ct.fill}>{line}</text>
          {/each}
        </g>
      {:else if it.kind === 'title'}
        {@const t = it as TitleItem}
        {@const fs = mm(t.labelPt)}
        {@const ax = t.align === 'middle' ? t.x + t.w / 2 : t.align === 'end' ? t.x + t.w : t.x}
        {@const gap = t.lineGap ?? 1.25}
        <!-- text wraps inside its box; a line break typed with Shift+Enter starts a new line; capitals and the halo are only how it is drawn -->
        {#each wrapText(shownText(t), t.labelPt, Math.max(t.w, 4), t.bold, t.font || undefined) as line, i}
          {#if t.halo}
            <text x={n3(ax)} y={n3(t.y + fs * 0.85 + i * fs * gap)} font-size={n3(fs)} font-weight={t.bold ? 700 : 400} font-style={t.italic ? 'italic' : 'normal'} font-family={t.font ? fontStack(t.font) : undefined} text-anchor={t.align ?? 'start'} fill="none" stroke={t.halo} stroke-width={n3(t.haloPt !== undefined ? mm(t.haloPt) : fs * 0.22)} stroke-linejoin="round">{line}</text>
          {/if}
          <text x={n3(ax)} y={n3(t.y + fs * 0.85 + i * fs * gap)} font-size={n3(fs)} font-weight={t.bold ? 700 : 400} font-style={t.italic ? 'italic' : 'normal'} font-family={t.font ? fontStack(t.font) : undefined} text-anchor={t.align ?? 'start'} fill={t.color ?? '#1B1F1D'}>{line}</text>
        {/each}
      {:else if it.kind === 'table'}
        {@const tb = it as TableItem}
        {@const td = tableData(tb, doc, geoms)}
        {#if td && td.head.length}
          {@const L = tableLayout(tb, td)}
          {@const tt = look(tb.text, TEXT.legend)}
          {@const x0 = L.cw.map((_, c) => L.cw.slice(0, c).reduce((a, b) => a + b, 0))}
          {@const rowY = (i: number) => L.titleH + L.rowH * (1 + i)}
          {@const base = (i: number) => n3(rowY(i) + L.rowH / 2 + L.fs * 0.35)}
          <!-- the table of sites: caption, header row in bold over a hairline, the rows (as many as the box holds), numbers against the right edge of their column -->
          <g transform="translate({tb.x},{tb.y})">
            {#if tb.title.trim()}<text x="0" y={n3(L.rowH / 2 + L.fs * 0.35)} font-size={n3(L.fs)} font-weight="700" fill={tt.fill}>{tb.title}</text>{/if}
            {#if tb.zebra}
              {#each td.rows.slice(0, L.shown) as _, i}{#if i % 2 === 1}<rect x="0" y={n3(rowY(i))} width={n3(tb.w)} height={n3(L.rowH)} fill="#EFEFEC" />{/if}{/each}
            {/if}
            {#each td.head as h, c}
              <text x={n3(td.right[c] ? x0[c] + L.cw[c] - L.padX : x0[c] + L.padX)} y={base(-1)} font-size={n3(L.fs)} font-weight="700" font-style="normal" text-anchor={td.right[c] ? 'end' : 'start'} fill={tt.fill}>{L.squeezed ? clipText(h, tb.labelPt, true, L.cw[c] - 2 * L.padX) : h}</text>
            {/each}
            <line x1="0" y1={n3(L.titleH + L.rowH)} x2={n3(tb.w)} y2={n3(L.titleH + L.rowH)} stroke="#1B1F1D" stroke-width={n3(mm(0.5))} />
            {#each td.rows.slice(0, L.shown) as row, i}
              {#each row as cell, c}
                {#if cell !== ''}<text x={n3(td.right[c] ? x0[c] + L.cw[c] - L.padX : x0[c] + L.padX)} y={base(i)} font-size={n3(L.fs)} font-weight={tt.weight} font-style={tt.style} text-anchor={td.right[c] ? 'end' : 'start'} fill={tt.fill}>{L.squeezed ? clipText(cell, tb.labelPt, tt.bold, L.cw[c] - 2 * L.padX) : cell}</text>{/if}
              {/each}
            {/each}
            {#if tb.frame}<rect x="0" y={n3(L.titleH)} width={n3(tb.w)} height={n3(L.bottom - L.titleH)} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.5))} />{/if}
          </g>
        {:else}
          <g transform="translate({tb.x},{tb.y})">
            <rect width={tb.w} height={tb.h} fill="none" stroke="#B4B4AE" stroke-width="0.2" stroke-dasharray="1.2 0.8" />
            {#each wrapText('Table of sites: choose sample points and columns in its settings.', tb.labelPt, Math.max(tb.w - 3, 8), false) as line, i}<text x={n3(tb.w / 2)} y={n3(1.5 + mm(tb.labelPt) * (0.85 + i * 1.25))} font-size={n3(mm(tb.labelPt))} text-anchor="middle" fill="#5E6267">{line}</text>{/each}
          </g>
        {/if}
      {:else if it.kind === 'profile'}
        {@const pf = it as ProfileItem}
        {@const pt = look(pf.text, TEXT.legend)}
        {@const P = pf.data ? profileLayout(pf, pf.data) : null}
        {@const fs = mm(pf.labelPt)}
        <g transform="translate({pf.x},{pf.y})">
          {#if P && P.ok && pf.data}
            <!-- a line chart of the ground along the line: light grid, the fill under the profile, the profile, the axes with round ticks, the words -->
            {#if pf.grid !== false}{#each P.yt as t, i}{#if i > 0}<line x1={P.x0} y1={t.y} x2={P.x1} y2={t.y} stroke="#DAD9D4" stroke-width={n3(mm(0.25))} />{/if}{/each}{/if}
            {#if pf.fillOpacity !== 0}<path d={P.area} fill={pf.fill ?? pf.color} fill-opacity={pf.fillOpacity ?? 0.22} stroke="none" />{/if}
            <path d={P.line} fill="none" stroke={pf.color} stroke-width={n3(mm(pf.linePt ?? 0.8))} stroke-linejoin="round" stroke-linecap="round" />
            <path d="M{P.x0},{P.y0}V{P.y1}H{P.x1}" fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.5))} stroke-linejoin="miter" />
            <path d={P.xt.map((t) => `M${t.x},${P.y1}v${P.tick}`).join('') + P.yt.map((t) => `M${P.x0},${t.y}h${-P.tick}`).join('')} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.5))} />
            {#each P.xt as t}<text x={t.x} y={P.xNumY} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor="middle" fill={pt.fill}>{t.text}</text>{/each}
            {#each P.yt as t}<text x={P.yNumX} y={n3(t.y + fs * 0.35)} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor="end" fill={pt.fill}>{t.text}</text>{/each}
            {#if pf.axisTitles !== false}
              <text x={n3((P.x0 + P.x1) / 2)} y={P.xTitleY} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor="middle" fill={pt.fill}>Distance (km)</text>
              <text transform="translate({P.yTitleX},{n3((P.y0 + P.y1) / 2)}) rotate(-90)" font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor="middle" fill={pt.fill}>Elevation (m)</text>
            {/if}
            {#if pf.ends}
              <text x={P.x0} y={P.topY} font-size={n3(fs)} font-weight="700" fill={pt.fill}>A</text>
              <text x={P.x1} y={P.topY} font-size={n3(fs)} font-weight="700" text-anchor="end" fill={pt.fill}>B</text>
            {/if}
            {#if pf.exag && P.exagFits}<text x={n3((P.x0 + P.x1) / 2)} y={P.topY} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor="middle" fill={pt.fill}>{P.exagText}</text>{/if}
            {#each [P.lo, P.hi] as mk}
              {#if mk.label}
                <circle cx={mk.x} cy={mk.y} r="0.7" fill={pf.color} stroke="#ffffff" stroke-width="0.25" />
                <text x={mk.label.x} y={mk.label.y} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor={mk.label.anchor} fill="none" stroke="#ffffff" stroke-width={n3(fs * 0.25)} stroke-linejoin="round" stroke-opacity="0.9">{mk.label.text}</text>
                <text x={mk.label.x} y={mk.label.y} font-size={n3(fs)} font-weight={pt.weight} font-style={pt.style} text-anchor={mk.label.anchor} fill={pt.fill}>{mk.label.text}</text>
              {/if}
            {/each}
          {:else}
            <rect width={pf.w} height={pf.h} fill="none" stroke="#B4B4AE" stroke-width="0.2" stroke-dasharray="1.2 0.8" />
            {#each wrapText(P && !P.ok ? 'This box is too small for the chart.' : profileState[pf.id] || 'Elevation profile', pf.labelPt, Math.max(pf.w - 3, 8), false) as line, i}<text x={n3(pf.w / 2)} y={n3(pf.h / 2 + fs * (0.35 + i * 1.25))} font-size={n3(fs)} text-anchor="middle" fill="#5E6267">{line}</text>{/each}
          {/if}
        </g>
      {:else if it.kind === 'image'}
        <!-- an inner svg clips a cropped ("fill the box") picture to its frame -->
        <svg x={it.x} y={it.y} width={it.w} height={it.h} viewBox="0 0 {it.w} {it.h}" overflow="hidden"><image href={it.href} width={it.w} height={it.h} preserveAspectRatio={it.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'} /></svg>
        {#if it.frame}<rect x={it.x} y={it.y} width={it.w} height={it.h} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.4))} />{/if}
      {:else if it.kind === 'shape'}
        {@const sh = it as ShapeItem}
        {@const sw = n3(mm(sh.strokePt))}
        {@const dash = !sh.dash ? undefined : sh.dashStyle === 'dot' ? `0.01 ${n3(mm(sh.strokePt) * 2.2)}` : `${n3(mm(sh.strokePt) * 4)} ${n3(mm(sh.strokePt) * 2.5)}`}
        {#if sh.shape === 'rect'}
          <rect x={sh.x} y={sh.y} width={sh.w} height={sh.h} rx={sh.radius ? n3(Math.min(sh.radius, Math.abs(sh.w) / 2, Math.abs(sh.h) / 2)) : undefined} fill={sh.fill} fill-opacity={sh.fillOpacity} stroke={sh.stroke} stroke-width={sw} stroke-dasharray={dash} stroke-linecap={sh.dashStyle === 'dot' ? 'round' : undefined} />
        {:else if sh.shape === 'ellipse'}
          <ellipse cx={n3(sh.x + sh.w / 2)} cy={n3(sh.y + sh.h / 2)} rx={n3(Math.abs(sh.w) / 2)} ry={n3(Math.abs(sh.h) / 2)} fill={sh.fill} fill-opacity={sh.fillOpacity} stroke={sh.stroke} stroke-width={sw} stroke-dasharray={dash} stroke-linecap={sh.dashStyle === 'dot' ? 'round' : undefined} />
        {:else}
          {@const L = Math.max(1.6, mm(sh.strokePt) * 6) * (sh.headSize ?? 1)}
          {@const len = Math.hypot(sh.w, sh.h) || 1}
          {@const atEnd = sh.shape === 'arrow' && sh.heads !== 'start'}
          {@const atStart = sh.shape === 'arrow' && (sh.heads === 'start' || sh.heads === 'both')}
          <!-- a filled head covers the line's end, so the line stops short of the tip and never pokes through -->
          {@const cut = sh.headStyle === 'open' ? 0 : Math.min(L * 0.8, len / 2)}
          <line x1={n3(sh.x + (atStart ? (sh.w / len) * cut : 0))} y1={n3(sh.y + (atStart ? (sh.h / len) * cut : 0))} x2={n3(sh.x + sh.w - (atEnd ? (sh.w / len) * cut : 0))} y2={n3(sh.y + sh.h - (atEnd ? (sh.h / len) * cut : 0))} stroke={sh.stroke} stroke-width={sw} stroke-dasharray={dash} stroke-linecap="round" />
          {#each [atEnd ? [sh.x + sh.w, sh.y + sh.h, Math.atan2(sh.h, sh.w)] : null, atStart ? [sh.x, sh.y, Math.atan2(-sh.h, -sh.w)] : null] as tip}
            {#if tip}
              {@const [ex, ey, ang] = tip}
              {#if sh.headStyle === 'open'}
                <path d="M{n3(ex - L * Math.cos(ang - 0.42))},{n3(ey - L * Math.sin(ang - 0.42))} L{n3(ex)},{n3(ey)} L{n3(ex - L * Math.cos(ang + 0.42))},{n3(ey - L * Math.sin(ang + 0.42))}" fill="none" stroke={sh.stroke} stroke-width={sw} stroke-linecap="round" stroke-linejoin="round" />
              {:else}
                <path d="M{n3(ex)},{n3(ey)} L{n3(ex - L * Math.cos(ang - 0.42))},{n3(ey - L * Math.sin(ang - 0.42))} L{n3(ex - L * Math.cos(ang + 0.42))},{n3(ey - L * Math.sin(ang + 0.42))} Z" fill={sh.stroke} />
              {/if}
            {/if}
          {/each}
        {/if}
      {/if}
      </g>
      <!-- zoom lines on top of the locator, so they start at the zoom box and run to the map frame (outside the part's own turn, which they follow only at their start) -->
      {#if it.kind === 'inset'}
        {@const ins = it as InsetItem}
        {#if ins.connect && ins.showExtent && insets[ins.id]?.box}
          {@const cw = n3(mm(ins.connectPt ?? 0.5))}
          <path d={connectors(ins, insets[ins.id]!.box, (ins.marks && doc.items.find((o) => o.id === ins.marks && o.visible)) || mapItem)} fill="none" stroke={ins.extentColor} stroke-width={cw} stroke-dasharray={ins.connectDash ? `${n3(cw * 5)} ${n3(cw * 3)}` : undefined} opacity={ins.look?.opacity !== undefined && ins.look.opacity < 1 ? n3(ins.look.opacity) : undefined} />
        {/if}
      {/if}
      {/if}
    {/if}
  {/each}
</svg>

<style>
  .figure { display: block; }
</style>
