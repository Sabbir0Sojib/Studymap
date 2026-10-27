<script lang="ts">
  // One map frame of the figure: the main map or a detail map. Everything here is in millimetres and is exactly what gets exported.
  import type { DetailItem, Doc, Layer, MapItem } from '../lib/store.svelte';
  import type { LayerDraw, MainScene } from '../lib/scene';
  import { ptToMm } from '../lib/journals';
  import { gridSettings, gridDecor } from '../lib/grid';
  import { textWidthMm } from '../lib/measure';
  import { look, TEXT } from '../lib/textstyle';
  import { luminance } from '../lib/palettes';
  import { UNIT_COLOURS } from '../lib/legend';
  import { resolveChoro } from '../lib/classify';
  import { inkOn, markOpacity, pointLook } from '../lib/marks';
  import { dashFor, hatchLines, n3, spaced, symbolPath } from '../lib/figdraw';

  interface Props {
    doc: Doc;
    /** the frame: the main map, or a detail map (which also has a label and a scale text) */
    m: MapItem | DetailItem;
    /** its drawn geometry (null while it cannot be made) */
    scene: MainScene | null;
    labels?: Record<string, LayerDraw['labels']>;
    /** live pan/zoom preview applied to the map content while a gesture is in progress */
    contentTransform?: string;
    terrainHref?: string | null;
    basemapHref?: string | null;
    /** the ends of the elevation profiles' lines, drawn over the main map */
    profileEnds?: { id: string; color: string; fs: number; ends: { letter: string; x: number; y: number; cx: number; cy: number }[] }[];
    /** the zoom boxes of the detail maps, drawn over the main map: a path in this frame's mm and its look */
    boxes?: { id: string; d: string; color: string; pt: number; fill: number }[];
  }
  let { doc, m, scene, labels = {}, contentTransform = '', terrainHref = null, basemapHref = null, profileEnds = [], boxes = [] }: Props = $props();

  const mm = ptToMm;
  /** what keeps the ids of this frame's own clip paths apart from another frame's (the main map keeps its plain ids) */
  const idp = $derived(m.kind === 'detail' ? m.id + '-' : '');
  /** what is drawn round the study area: everything (unset), faded behind a white veil, or nothing (a setting of the main map) */
  const around = $derived(m.kind === 'map' ? m.around : undefined);

  // Draw order and styles come from the live document; geometry comes from the cached scene.
  const drawLayers = $derived(scene ? doc.layers.filter((l) => l.visible && scene.byId[l.id]).map((l) => ({ layer: l, ld: scene.byId[l.id] })) : []);
  /** grid lines go under the study area when there is one (a reference recedes; the subject stays on top) */
  const gridUnder = $derived(drawLayers.some((d) => d.layer.kind === 'study'));
  const studyLayer = $derived(doc.layers.find((l) => l.kind === 'study' && l.visible));
  // Relief outside the study area is veiled so the area itself stays the focus of the figure.
  const focusMask = $derived.by(() => {
    if (!scene || !studyLayer || !doc.study.highlight) return '';
    const areas = scene.byId[studyLayer.id]?.paths.filter((p) => p.kind === 'area').map((p) => p.d) ?? [];
    return areas.length ? `M-1,-1H${m.w + 1}V${m.h + 1}H-1Z${areas.join('')}` : '';
  });
  // Relief is drawn on land only, so the sea of a coastal map keeps its own colour instead of the elevation tint and shading.
  // Land is the countries layer's area paths joined in one path (clipped "nonzero", so the own country drawn twice is not cut out).
  // With no countries layer drawn, the relief covers the whole frame as before.
  const landD = $derived.by(() => {
    const c = doc.layers.find((l) => l.kind === 'countries' && l.visible);
    return c && scene ? (scene.byId[c.id]?.paths.filter((p) => p.kind === 'area').map((p) => p.d).join('') ?? '') : '';
  });
  // areas coloured from a table, by layer: worked out once, for the drawing of the areas and for the names over them
  const choroOf = $derived.by(() => {
    const out = new Map<string, NonNullable<ReturnType<typeof resolveChoro>>>();
    for (const { layer, ld } of drawLayers) {
      const r = layer.choro && ld.allNames ? resolveChoro(layer.choro, ld.allNames) : null;
      if (r && r.legend.length) out.set(layer.id, r);
    }
    return out;
  });
  const adminLand = $derived(scene ? (scene.layers.find((ld) => ld.layer.kind === 'admin')?.paths ?? []).filter((p) => p.kind === 'area' && p.d).map((p) => p.d).join('') : '');
  const studyAreas = $derived(studyLayer && scene ? (scene.byId[studyLayer.id]?.paths ?? []).filter((p) => p.kind === 'area') : []);
  const byUnit = $derived(!!studyLayer?.style.byUnit && studyAreas.length > 1);
  // Over a satellite image (outside the study area) neighbour names read best as white with a dark halo.
  const onImage = $derived(doc.layers.some((l) => l.kind === 'basemap' && l.visible && l.basemap?.clip !== 'inside') && !!basemapHref);
  /** a shape drawn by hand keeps its own look under its key (#0, #1…); a look saved before shapes had keys, for all unnamed ones, still applies */
  const fstyle = (l: Layer, p: { name: string; key?: string }) => l.featureStyle?.[p.key ?? p.name] ?? (p.key ? l.featureStyle?.[''] : undefined);
  // areas with no value in a colour-by-value map
  const NO_DATA = '#E4E4E4';
</script>

<g transform="translate({m.x},{m.y})">
  <defs><clipPath id="clip-{m.id}"><rect width={m.w} height={m.h} /></clipPath></defs>
  <g clip-path="url(#clip-{m.id})">
    {#if scene}
    <g transform={contentTransform || undefined}>
      {#each drawLayers as { layer, ld } (layer.id)}
        {@const s = layer.style}
        {@const lk = look(s.labelStyle, TEXT.layerLabel(layer.kind))}
        <!-- over a satellite image, neighbour names turn white; a light name of any kind gets a dark halo (a white one would swallow it) -->
        {@const labelFill = !lk.custom && onImage && (layer.kind === 'countries' || layer.kind === 'admin') ? '#ffffff' : lk.fill}
        {@const darkHalo = luminance(labelFill) > 0.5 || (onImage && layer.kind !== 'study' && layer.kind !== 'subunits')}
        {@const haloColour = s.labelHaloColor ?? (darkHalo ? '#1B1F1D' : '#ffffff')}
        <!-- areas coloured from a table: the colours are worked out here, so changing the palette changes every area -->
        {@const choro = choroOf.get(layer.id) ?? null}
        <g>
          {#if layer.kind === 'study' && gridUnder && scene.graticule && gridSettings(m.grid).type === 'lines'}
            {@const gs = gridSettings(m.grid)}
            <path d={scene.graticule.lines} fill="none" stroke={m.grid.lineColor} stroke-width={n3(mm(gs.linePt))} stroke-opacity="0.85" stroke-dasharray={gs.dash ? `${n3(mm(gs.linePt) * 6)} ${n3(mm(gs.linePt) * 4)}` : undefined} />
          {/if}
          {#if layer.kind === 'basemap' && basemapHref}
            {@const clip = layer.basemap?.clip ?? 'all'}
            {@const studyD = studyAreas.map((p) => p.d).join('')}
            {#if clip !== 'all' && studyD}
              <defs><clipPath id="bm-{idp}{layer.id}"><path d={clip === 'inside' ? studyD : `M0,0H${m.w}V${m.h}H0Z${studyD}`} clip-rule="evenodd" /></clipPath></defs>
            {/if}
            <image href={basemapHref} x="0" y="0" width={m.w} height={m.h} preserveAspectRatio="none" opacity={layer.basemap?.opacity ?? 1} clip-path={clip !== 'all' && studyD ? `url(#bm-${idp}${layer.id})` : undefined} />
          {/if}
          {#if layer.kind === 'terrain' && terrainHref}
            {#if landD}<defs><clipPath id="land-{idp}{layer.id}"><path d={landD} /></clipPath></defs>{/if}
            <g clip-path={landD ? `url(#land-${idp}${layer.id})` : undefined}>
              <image href={terrainHref} x="0" y="0" width={m.w} height={m.h} preserveAspectRatio="none" opacity={layer.terrain?.opacity ?? 1} />
              {#if focusMask}<path d={focusMask} fill="#ffffff" fill-opacity="0.55" fill-rule="evenodd" />{/if}
            </g>
          {/if}
          {#if layer.kind === 'study' && !byUnit && !s.hatch && studyAreas.length}
            <path d={studyAreas.map((p) => p.d).join('')} fill={s.fill} fill-opacity={s.fillOpacity} stroke="none" fill-rule="nonzero" />
            <!-- a unit given its own colour (clicked on the map) is painted over the shared fill -->
            {#each studyAreas as p}{#if layer.featureStyle?.[p.name]?.fill}<path d={p.d} fill={layer.featureStyle[p.name].fill} fill-opacity={s.fillOpacity} stroke="none" />{/if}{/each}
          {/if}
          {#each ld.paths as p}
            {#if p.kind === 'area' && layer.kind === 'study' && !byUnit && !s.hatch}
              <!-- filled once above -->
            {:else if p.kind === 'area' && layer.kind === 'study' && (byUnit || s.hatch)}
              {#if byUnit}<path d={p.d} fill={layer.featureStyle?.[p.name]?.fill ?? UNIT_COLOURS[studyAreas.indexOf(p) % UNIT_COLOURS.length]} fill-opacity={s.hatch ? 0 : 0.9} stroke="none" data-pick="{layer.id}|area|{p.name}" />{/if}
            {:else if fstyle(layer, p)?.hidden}
              <!-- hidden on its own -->
            {:else if p.kind === 'area'}
              {@const fo = fstyle(layer, p)}
              {@const cc = choro ? choro.colours.get(p.name) ?? NO_DATA : undefined}
              <path d={p.d} fill={fo?.fill ?? cc ?? (p.alt && s.fill2 ? s.fill2 : s.fill)} fill-opacity={choro ? layer.choro?.opacity ?? 1 : fo?.fill && s.fill === 'none' ? 0.5 : s.fillOpacity} stroke={p.noStroke || layer.kind === 'study' ? 'none' : fo?.stroke ?? s.stroke} stroke-width={n3(mm(s.strokePt))} stroke-dasharray={dashFor(layer)} stroke-linejoin="round" fill-rule="evenodd" data-pick="{layer.id}|area|{p.key ?? p.name}" />
            {:else if p.kind === 'line'}
              <path d={p.d} fill="none" stroke={fstyle(layer, p)?.stroke ?? (s.stroke === 'none' ? s.fill : s.stroke)} stroke-width={n3(mm(s.strokePt) * (p.w ?? 1))} stroke-dasharray={dashFor(layer)} stroke-linejoin="round" stroke-linecap="round" data-pick="{layer.id}|line|{p.key ?? p.name}" />
            {:else if layer.kind !== 'study'}
              {@const fo = fstyle(layer, p)}
              {#if p.props && ld.marks}
                <!-- a marker styled by its table row: its own colour, symbol and size, and a number inside it -->
                {@const mk = pointLook(layer, ld.marks, p.props, p.idx ?? 0)}
                {@const mf = fo?.fill ?? mk.fill ?? s.fill}
                <path d={symbolPath(mk.shape, mk.dMm / 2)} transform="translate({n3(p.x!)},{n3(p.y!)})" fill={mf} fill-opacity={markOpacity(layer)} stroke={fo?.stroke ?? s.stroke} stroke-width={n3(mm(s.strokePt))} data-pick="{layer.id}|point|{p.key ?? p.name}" />
                {#if mk.num}<text x={n3(p.x!)} y={n3(p.y! + mk.numMm! * 0.35)} font-size={n3(mk.numMm!)} font-weight="700" text-anchor="middle" fill={inkOn(mf)}>{mk.num}</text>{/if}
              {:else}
                <path d={symbolPath(s.symbol, mm(s.sizePt) / 2)} transform="translate({n3(p.x!)},{n3(p.y!)})" fill={fo?.fill ?? s.fill} fill-opacity={markOpacity(layer)} stroke={fo?.stroke ?? s.stroke} stroke-width={n3(mm(s.strokePt))} data-pick="{layer.id}|point|{p.key ?? p.name}" />
              {/if}
            {/if}
          {/each}
          {#if layer.kind === 'countries' && adminLand}
            <!-- the home country's official units in its land colour, so the slivers where the coarser world outline and the
                 official borders differ are land too, and the district edge meets the country's land exactly -->
            <path d={adminLand} fill={s.fill} fill-opacity={s.fillOpacity} stroke="none" />
          {/if}
          {#if choro && layer.choro?.noDataHatch !== false}
            <!-- areas with no value: diagonal hatching over their grey, so they read as "no data" even in black and white -->
            {@const nd = ld.paths.filter((p) => p.kind === 'area' && choro.noData.has(p.name) && !fstyle(layer, p)?.fill && !fstyle(layer, p)?.hidden).map((p) => p.d).join('')}
            {#if nd}
              <defs><clipPath id="nodata-{idp}{layer.id}"><path d={nd} /></clipPath></defs>
              <g clip-path="url(#nodata-{idp}{layer.id})"><path d={hatchLines(m.w, m.h)} fill="none" stroke="#8C8C8C" stroke-width={n3(mm(0.35))} /></g>
            {/if}
          {/if}
        </g>
      {/each}
      <!-- the names of every layer in one pass over all the layers' drawing (same order as the layers), so a layer drawn later never cuts the names of one below it -->
      {#each drawLayers as { layer } (layer.id)}
        {#if labels[layer.id]?.length}
          {@const s = layer.style}
          {@const lk = look(s.labelStyle, TEXT.layerLabel(layer.kind))}
          {@const labelFill = !lk.custom && onImage && (layer.kind === 'countries' || layer.kind === 'admin') ? '#ffffff' : lk.fill}
          {@const darkHalo = luminance(labelFill) > 0.5 || (onImage && layer.kind !== 'study' && layer.kind !== 'subunits')}
          {@const haloColour = s.labelHaloColor ?? (darkHalo ? '#1B1F1D' : '#ffffff')}
          {@const choro = choroOf.get(layer.id) ?? null}
          <g>
            {#each labels[layer.id] ?? [] as lb}
              {@const fs = mm(s.labelPt)}
              <!-- a name on a dark colour of a colour-by-value map turns white (with a dark halo), unless the layer's names have a colour of their own -->
              {@const onDark = !!choro && !lk.custom && !layer.featureStyle?.[lb.orig ?? lb.text]?.fill && luminance(choro.colours.get(lb.orig ?? lb.text) ?? '#ffffff') < 0.28}
              {@const nameFill = onDark ? '#ffffff' : labelFill}
              {@const nameHalo = onDark && !s.labelHaloColor ? '#1B1F1D' : haloColour}
              {@const sp = s.labelSpacing ? spaced(lb.text, lb.x, lb.anchor, s.labelPt, lk.bold, s.labelSpacing) : null}
              {#if lb.from && layer.featureStyle?.[lb.orig ?? lb.text]?.leader !== false}
                {@const tw = sp ? sp.len : textWidthMm(lb.text, s.labelPt, lk.bold)}
                {@const x0 = sp ? sp.x : lb.anchor === 'middle' ? lb.x - tw / 2 : lb.x}
                <!-- a name moved away from its place keeps a thin line back to it, ending at the nearest edge of the name -->
                {@const ex = Math.max(x0 - 0.4, Math.min(x0 + tw + 0.4, lb.from[0]))}
                {@const ey = Math.max(lb.y - fs * 0.55, Math.min(lb.y + fs * 0.45, lb.from[1]))}
                {#if Math.hypot(ex - lb.from[0], ey - lb.from[1]) > 2.5}
                  <line x1={n3(lb.from[0])} y1={n3(lb.from[1])} x2={n3(ex)} y2={n3(ey)} stroke={nameFill} stroke-width={n3(mm(0.35))} stroke-opacity="0.8" />
                  <circle cx={n3(lb.from[0])} cy={n3(lb.from[1])} r={n3(mm(0.9))} fill={nameFill} />
                {/if}
              {/if}
              {#if s.labelHalo !== false}
                <text x={n3(sp ? sp.x : lb.x)} y={n3(lb.y + fs * 0.35)} font-size={n3(fs)} font-weight={lk.weight} font-style={lk.style} text-anchor={sp ? 'start' : lb.anchor} textLength={sp ? n3(sp.len) : undefined} lengthAdjust={sp ? 'spacing' : undefined} fill="none" stroke={nameHalo} stroke-width={n3(fs * 0.22)} stroke-linejoin="round" stroke-opacity={!s.labelHaloColor && (darkHalo || onDark) ? 0.55 : 0.9}>{lb.text}</text>
              {/if}
              <text x={n3(sp ? sp.x : lb.x)} y={n3(lb.y + fs * 0.35)} font-size={n3(fs)} font-weight={lk.weight} font-style={lk.style} text-anchor={sp ? 'start' : lb.anchor} textLength={sp ? n3(sp.len) : undefined} lengthAdjust={sp ? 'spacing' : undefined} fill={nameFill} data-pick="{layer.id}|label|{lb.orig ?? lb.text}">{lb.text}</text>
            {/each}
          </g>
        {/if}
      {/each}
      {#if around && studyAreas.length}
        <!-- round the study area: a white veil (fade) or the page colour (hide), the area itself left clear -->
        <path d={`M-5,-5H${n3(m.w + 5)}V${n3(m.h + 5)}H-5Z${studyAreas.map((p) => p.d).join('')}`} fill={around === 'hide' ? (doc.pageColor && doc.pageColor !== 'none' ? doc.pageColor : '#ffffff') : '#ffffff'} fill-opacity={around === 'hide' ? 1 : 0.62} fill-rule="evenodd" />
      {/if}
      {#if studyLayer?.style.hatch && studyAreas.length}
        <defs><clipPath id="hatch-{m.id}"><path d={studyAreas.map((p) => p.d).join('')} /></clipPath></defs>
        <g clip-path="url(#hatch-{m.id})">
          <path d={hatchLines(m.w, m.h)} fill="none" stroke={studyLayer.style.stroke} stroke-width={n3(mm(0.5))} />
        </g>
      {/if}
      {#if studyLayer && scene.byId[studyLayer.id]}
        {#each scene.byId[studyLayer.id].paths as p}
          {#if p.kind === 'point'}
            <circle cx={n3(p.x!)} cy={n3(p.y!)} r="1.4" fill={studyLayer.style.stroke} stroke="#ffffff" stroke-width="0.4" data-pick="{studyLayer.id}|point|{p.name}" />
          {:else}
            <path d={p.d} fill="none" stroke={studyLayer.featureStyle?.[p.name]?.stroke ?? studyLayer.style.stroke} stroke-width={n3(mm(studyLayer.style.strokePt))} stroke-dasharray={dashFor(studyLayer)} stroke-linejoin="round" data-pick="{studyLayer.id}|area|{p.name}" />
          {/if}
        {/each}
      {/if}
      {#if scene.graticule}
        {@const gs = gridSettings(m.grid)}
        {#if gs.type === 'lines' && !gridUnder}
          <path d={scene.graticule.lines} fill="none" stroke={m.grid.lineColor} stroke-width={n3(mm(gs.linePt))} stroke-opacity="0.85" stroke-dasharray={gs.dash ? `${n3(mm(gs.linePt) * 6)} ${n3(mm(gs.linePt) * 4)}` : undefined} />
        {:else if gs.type === 'crosses'}
          <path d={gridDecor(scene.graticule, gs, m.w, m.h, mm(m.grid.labelPt)).crosses} fill="none" stroke={m.grid.lineColor} stroke-width={n3(mm(Math.max(gs.linePt, 0.3)))} />
        {/if}
      {/if}
      {#each profileEnds as pe (pe.id)}
        <!-- the ends of an elevation profile's line: a dot, and A or B beside it (white halo so the letter reads over the map) -->
        {#each pe.ends as e}
          <circle cx={n3(e.x)} cy={n3(e.y)} r="0.8" fill={pe.color} stroke="#ffffff" stroke-width="0.3" />
          <text x={n3(e.cx)} y={n3(e.cy + pe.fs * 0.35)} font-size={n3(pe.fs)} font-weight="700" text-anchor="middle" fill="none" stroke="#ffffff" stroke-width={n3(pe.fs * 0.28)} stroke-linejoin="round" stroke-opacity="0.9">{e.letter}</text>
          <text x={n3(e.cx)} y={n3(e.cy + pe.fs * 0.35)} font-size={n3(pe.fs)} font-weight="700" text-anchor="middle" fill="#1B1F1D">{e.letter}</text>
        {/each}
      {/each}
      {#each boxes as b (b.id)}
        <!-- the ground of a detail map: a box on the main map (the look of the zoom box of a locator), above the names and the grid -->
        <path d={b.d} fill={b.color} fill-opacity={b.fill} stroke={b.color} stroke-width={n3(mm(b.pt))} stroke-linejoin="round" />
      {/each}
    </g>
    {:else}
      <rect width={m.w} height={m.h} fill="#F4F3EE" />
    {/if}
  </g>
  {#if scene?.graticule}
    {@const gs = gridSettings(m.grid)}
    {@const fs = mm(m.grid.labelPt)}
    {@const deco = gridDecor(scene.graticule, gs, m.w, m.h, fs)}
    {@const gl = look(m.grid.text, TEXT.grid)}
    {#each deco.zebra as z}<rect x={n3(z.x)} y={n3(z.y)} width={n3(z.w)} height={n3(z.h)} fill={z.dark ? '#1B1F1D' : '#ffffff'} stroke="#1B1F1D" stroke-width={n3(mm(0.25))} />{/each}
    {#if deco.ticks}<path d={deco.ticks} fill="none" stroke="#1B1F1D" stroke-width={n3(mm(0.4))} />{/if}
    {#each deco.texts as t}
      <text transform="translate({n3(t.x)},{n3(t.y)}){t.rotate ? ` rotate(${t.rotate})` : ''}" font-size={n3(fs)} font-weight={gl.weight} font-style={gl.style} text-anchor={t.anchor} fill={gl.fill} data-pick="grid|grid|{t.text}">{t.text}</text>
    {/each}
  {/if}
  {#if !scene?.graticule || gridSettings(m.grid).frame !== 'none'}
    <rect width={m.w} height={m.h} fill="none" stroke={m.frameColor ?? '#1B1F1D'} stroke-width={n3(mm(m.framePt))} />
  {/if}
{#if m.kind === 'detail'}
  {@const dl = look(m.text, TEXT.insetLabel)}
  {@const lfs = mm(m.labelPt)}
  {#if m.label}
    <!-- a panel letter sits on a small white tab in the top-left corner, any other caption along the bottom (as on a locator map) -->
    {#if /^\([a-z0-9]{1,2}\)$/i.test(m.label.trim())}
      <rect x="0.8" y="0.8" width={n3(textWidthMm(m.label, m.labelPt, dl.weight >= 600) + 1.6)} height={n3(lfs * 1.15 + 1)} rx="0.5" fill="#ffffff" fill-opacity="0.85" />
      <text x="1.6" y={n3(0.8 + lfs * 0.95)} font-size={n3(lfs)} font-weight={dl.weight} font-style={dl.style} fill={dl.fill}>{m.label}</text>
    {:else}
      <text x="1.5" y={n3(m.h - 1.5)} font-size={n3(lfs)} font-weight={dl.weight} font-style={dl.style} fill={dl.fill}>{m.label}</text>
    {/if}
  {/if}
  {#if m.scaleText}
    <!-- the printed scale in the bottom-right corner, with a white halo so it reads over the map -->
    {@const st = `1:${Math.round(m.scale).toLocaleString('en-US')}`}
    <text x={n3(m.w - 1.5)} y={n3(m.h - 1.5)} font-size={n3(lfs)} font-weight={dl.weight} font-style={dl.style} text-anchor="end" fill="none" stroke="#ffffff" stroke-width={n3(lfs * 0.22)} stroke-linejoin="round" stroke-opacity="0.9">{st}</text>
    <text x={n3(m.w - 1.5)} y={n3(m.h - 1.5)} font-size={n3(lfs)} font-weight={dl.weight} font-style={dl.style} text-anchor="end" fill={dl.fill}>{st}</text>
  {/if}
{/if}
</g>
