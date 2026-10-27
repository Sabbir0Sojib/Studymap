<script lang="ts">
  // Style the points of a layer by the columns of their table: a colour (and symbol) for each value, a size that follows
  // a number, or a number inside each marker. Everything starts off, so a layer keeps its one look until one is chosen.
  import { store } from '../../lib/store.svelte';
  import type { Layer, PointsBy } from '../../lib/store.svelte';
  import { MAX_CATS, MAX_SYMS, SHAPES, catColour, catLabel, columnFacts, scanMarks, symShape } from '../../lib/marks';
  import ColorPicker from '../ColorPicker.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { layer }: { layer: Layer } = $props();
  const c = () => store.commit();

  const fc = $derived(store.geoms[layer.id]);
  const columns = $derived(Object.keys(fc?.features.find((f) => f.properties)?.properties ?? {}).filter((k) => !k.startsWith('__')));
  const facts = $derived(columnFacts(fc, columns));
  const pb = $derived<PointsBy>(layer.pointsBy ?? {});
  const info = $derived(fc && layer.pointsBy ? scanMarks(layer, fc) : undefined);
  const numbered = $derived(!!pb.number);

  /** Change a setting; one set back to nothing is dropped, and a layer with nothing left keeps no style at all. */
  function set(patch: Partial<PointsBy>) {
    const next: Record<string, unknown> = { ...(layer.pointsBy ?? {}), ...patch };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    layer.pointsBy = Object.keys(next).length ? (next as PointsBy) : undefined;
    c();
  }
  function setCat(v: string, patch: { color?: string; label?: string }) {
    const cats = { ...(pb.cats ?? {}) };
    const own = { ...(cats[v] ?? {}), ...patch };
    if (own.label !== undefined && (own.label.trim() === '' || own.label === v)) delete own.label;
    if (Object.keys(own).length) cats[v] = own; else delete cats[v];
    set({ cats: Object.keys(cats).length ? cats : undefined });
  }
  function setSym(v: string, shape: Layer['style']['symbol']) {
    set({ symbols: { ...(pb.symbols ?? {}), [v]: shape } });
  }
  /** Numbers inside the markers: the names beside them would crowd the numbers, so they go off (the Label points with list brings them back). */
  function setMarker(kind: 'symbols' | 'numbers') {
    if (kind === 'numbers') {
      if (layer.style.labelField) layer.style.labelField = '';
      if (layer.legendLabel === 'Sample site') layer.legendLabel = 'Sampling sites';
      set({ number: 'order', numberField: undefined });
    } else {
      if (layer.legendLabel === 'Sampling sites') layer.legendLabel = 'Sample site';
      set({ number: undefined, numberField: undefined, numberPt: undefined, numberRange: undefined });
    }
  }
  const sizeMin = $derived(pb.sizeMin ?? 3);
  const sizeMax = $derived(pb.sizeMax ?? 12);
  const numberPt = $derived(pb.numberPt ?? 6);
  const word = (n: number) => (n === 1 ? t('1 value') : t('{n} values', { n }));
</script>

{#if columns.length}
  <section>
    <h3 class="group-title">{t('Style by a column')}</h3>

    <label class="field"><span>{t('Colour by')}</span>
      <select class="input" value={pb.colorField ?? ''} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ colorField: v || undefined, cats: v === pb.colorField ? pb.cats : undefined }); }}>
        <option value="">{t('One colour for all')}</option>
        {#each columns as col}<option value={col} disabled={(facts[col]?.distinct ?? 0) > MAX_CATS}>{col} ({word(facts[col]?.distinct ?? 0)}{(facts[col]?.distinct ?? 0) > MAX_CATS ? t(', too many') : ''})</option>{/each}
      </select>
    </label>
    {#if pb.colorField && info}
      {#if info.cats.length > MAX_CATS}
        <p class="hint warn">{t('This column has more than {n} different values. Choose a column with fewer, such as a type or a group.', { n: MAX_CATS })}</p>
      {:else}
        <ul class="cats" aria-label={t('Colour of each value')}>
          {#each info.cats as v (v)}
            <li>
              <ColorPicker value={catColour(pb, info.cats, v)} label={t('Colour for {name}', { name: catLabel(pb, v) })} size={26} onchange={(col) => setCat(v, { color: col })} />
              <input class="nm" type="text" value={catLabel(pb, v)} aria-label={t('Legend text for {name}', { name: v === '' ? t('blank values') : v })} oninput={(e) => setCat(v, { label: (e.target as HTMLInputElement).value })} />
              {#if pb.symbolField === pb.colorField && !numbered}
                <select class="shape" value={symShape(pb, info.syms, v)} aria-label={t('Symbol for {name}', { name: catLabel(pb, v) })} onchange={(e) => setSym(v, (e.target as HTMLSelectElement).value as Layer['style']['symbol'])}>
                  {#each SHAPES as sh}<option value={sh}>{t(sh)}</option>{/each}
                </select>
              {/if}
            </li>
          {/each}
        </ul>
        <label class="field"><span>{t('Legend heading (optional)')}</span><input class="input" type="text" value={pb.title ?? ''} placeholder={t('e.g. Sample type')} oninput={(e) => set({ title: (e.target as HTMLInputElement).value || undefined })} /></label>
        <p class="hint">{t('Each value gets a colour that stays apart for readers with colour-blindness. Change a colour or its legend text here.')}</p>
      {/if}
    {/if}

    {#if !numbered}
      <label class="field"><span>{t('Symbol by')}</span>
        <select class="input" value={pb.symbolField ?? ''} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ symbolField: v || undefined, symbols: v === pb.symbolField ? pb.symbols : undefined }); }}>
          <option value="">{t('One symbol for all')}</option>
          {#each columns as col}<option value={col} disabled={(facts[col]?.distinct ?? 0) > MAX_SYMS}>{col} ({word(facts[col]?.distinct ?? 0)}{(facts[col]?.distinct ?? 0) > MAX_SYMS ? t(', up to 4') : ''})</option>{/each}
        </select>
      </label>
      {#if pb.symbolField && pb.symbolField !== pb.colorField && info && info.syms.length <= MAX_SYMS}
        <ul class="cats" aria-label={t('Symbol of each value')}>
          {#each info.syms as v (v)}
            <li class="plain">
              <span class="nm static">{v === '' ? t('No value') : v}</span>
              <select class="shape" value={symShape(pb, info.syms, v)} aria-label={t('Symbol for {name}', { name: v === '' ? t('blank values') : v })} onchange={(e) => setSym(v, (e.target as HTMLSelectElement).value as Layer['style']['symbol'])}>
                {#each SHAPES as sh}<option value={sh}>{t(sh)}</option>{/each}
              </select>
            </li>
          {/each}
        </ul>
      {/if}

      <label class="field"><span>{t('Size by')}</span>
        <select class="input" value={pb.sizeField ?? ''} onchange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ sizeField: v || undefined }); }}>
          <option value="">{t('One size for all')}</option>
          {#each columns as col}<option value={col} disabled={!facts[col]?.numeric}>{col}{facts[col]?.numeric ? '' : t(' (not numbers)')}</option>{/each}
        </select>
      </label>
      {#if pb.sizeField}
        <label class="field slider"><span>{t('Smallest symbol')} <span class="val" aria-hidden="true">{sizeMin} pt</span></span><input type="range" min="1.5" max="10" step="0.5" value={sizeMin} aria-valuetext="{sizeMin} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; set({ sizeMin: v === 3 ? undefined : v, sizeMax: pb.sizeMax !== undefined && pb.sizeMax < v ? v : pb.sizeMax }); }} /></label>
        <label class="field slider"><span>{t('Largest symbol')} <span class="val" aria-hidden="true">{sizeMax} pt</span></span><input type="range" min="3" max="14" step="0.5" value={sizeMax} aria-valuetext="{sizeMax} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; set({ sizeMax: v === 12 ? undefined : v, sizeMin: pb.sizeMin !== undefined && pb.sizeMin > v ? v : pb.sizeMin }); }} /></label>
        <div class="field"><span>{t('Size grows with')}</span>
          <div class="seg" role="group" aria-label={t('How the size follows the number')}>
            <button aria-pressed={(pb.sizeScale ?? 'linear') === 'linear'} onclick={() => set({ sizeScale: undefined })}>{t('Width')}</button>
            <button aria-pressed={pb.sizeScale === 'sqrt'} onclick={() => set({ sizeScale: 'sqrt' })}>{t('Area (square root)')}</button>
          </div>
        </div>
        <p class="hint">{pb.sizeScale === 'sqrt' ? t('The area of each circle follows the number, so a value twice as big looks twice as big.') : t('The width of each circle follows the number.')}{info && info.noNumber ? ' ' + (info.noNumber === 1 ? t('1 site has no number and is drawn at the smallest size.') : t('{n} sites have no number and are drawn at the smallest size.', { n: info.noNumber })) : ''}</p>
        <label class="row-switch"><span>{t('Size key in the legend')}<small>{t('Three example circles with their values')}</small></span><input type="checkbox" role="switch" checked={pb.sizeLegend !== false} onchange={() => set({ sizeLegend: pb.sizeLegend === false ? undefined : false })} /></label>
        {#if pb.sizeLegend !== false}
          <label class="field"><span>{t('Size key heading')}</span><input class="input" type="text" value={pb.sizeTitle ?? pb.sizeField} oninput={(e) => { const v = (e.target as HTMLInputElement).value; set({ sizeTitle: v === pb.sizeField ? undefined : v }); }} /></label>
        {/if}
      {/if}
    {/if}

    <div class="field"><span>{t('Markers')}</span>
      <div class="seg" role="group" aria-label={t('Markers')}>
        <button aria-pressed={!numbered} onclick={() => setMarker('symbols')}>{t('Symbols')}</button>
        <button aria-pressed={numbered} onclick={() => setMarker('numbers')}>{t('Numbers inside')}</button>
      </div>
    </div>
    {#if numbered}
      <div class="field"><span>{t('Number from')}</span>
        <div class="seg" role="group" aria-label={t('Where the numbers come from')}>
          <button aria-pressed={pb.number === 'order'} onclick={() => set({ number: 'order', numberField: undefined })}>{t('1, 2, 3 in table order')}</button>
          <button aria-pressed={pb.number === 'column'} onclick={() => set({ number: 'column', numberField: pb.numberField ?? columns.find((k) => /^(name|site|id|station|label|code)$/i.test(k)) ?? columns[0] })}>{t('A column')}</button>
        </div>
      </div>
      {#if pb.number === 'column'}
        <label class="field"><span>{t('Column with the numbers or IDs')}</span>
          <select class="input" value={pb.numberField ?? columns[0]} onchange={(e) => set({ numberField: (e.target as HTMLSelectElement).value })}>
            {#each columns as col}<option value={col}>{col}</option>{/each}
          </select>
        </label>
      {/if}
      <label class="field slider"><span>{t('Number size')} <span class="val" aria-hidden="true">{numberPt} pt</span></span><input type="range" min="5" max="10" step="0.5" value={numberPt} aria-valuetext="{numberPt} pt" oninput={(e) => { const v = +(e.target as HTMLInputElement).value; set({ numberPt: v === 6 ? undefined : v }); }} /></label>
      {#if !pb.colorField}
        <label class="row-switch"><span>{t('Range in the legend')}<small>{t('Writes "{range}" before the legend text', { range: `${info?.first ?? '1'}–${info?.last ?? '8'}` })}</small></span><input type="checkbox" role="switch" checked={pb.numberRange !== false} onchange={() => set({ numberRange: pb.numberRange === false ? undefined : false })} /></label>
      {/if}
      <p class="hint">{t('Each circle grows to hold its number. The names beside the sites are off; choose "Label points with" above to bring them back.')}</p>
    {/if}
  </section>
{/if}

<style>
  .cats { list-style: none; margin: 0; padding: 0; display: grid; }
  .cats li { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 38px; padding: 0 2px; }
  .cats li.plain { grid-template-columns: minmax(0, 1fr) auto; }
  .cats li + li { border-top: 1px solid var(--line); }
  .nm { width: 100%; min-width: 0; height: 30px; padding: 0 6px; border: 1px solid transparent; border-radius: var(--r-chip); background: transparent; font-size: 14px; font-weight: 500; text-overflow: ellipsis; }
  .nm.static { display: block; line-height: 30px; overflow: hidden; white-space: nowrap; }
  .nm:not(.static):hover { border-color: var(--line-strong); }
  .nm:not(.static):focus-visible { outline: 2px solid transparent; background: var(--panel); border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .shape { height: 30px; padding: 0 6px; border: 1px solid var(--line-strong); border-radius: var(--r-chip); background: var(--panel); font-size: 12.5px; text-transform: capitalize; }
  @media (pointer: coarse) { .cats li { min-height: 44px; } .nm, .shape { height: 40px; } }
</style>
