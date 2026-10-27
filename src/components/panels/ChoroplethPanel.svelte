<script lang="ts">
  // Colour the areas of a layer (the sub-areas of the study area, or official boundaries) from a table of values:
  // paste it or open a CSV or Excel file, check that the names matched, choose how the values are grouped and the colours.
  // The table is kept on the layer; the colours are worked out when the map is drawn, so every change shows at once.
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import { store } from '../../lib/store.svelte';
  import type { ChoroConfig, Layer } from '../../lib/store.svelte';
  import { CAT_COLOURS, PALETTES, guessColumns, parseTable, rampCss, resolveChoro, toNumber } from '../../lib/classify';
  import type { Table } from '../../lib/classify';
  import ColorPicker from '../ColorPicker.svelte';
  import { t } from '../../lib/i18n.svelte';

  let { layer, names: drawnNames = [] }: { layer: Layer; /** the area names of this layer on the map (when it is drawn) */ names?: string[] } = $props();
  const c = () => store.commit();

  let text = $state('');
  let msg = $state('');
  let msgErr = $state(false);
  let fileInput = $state<HTMLInputElement>();

  const cfg = $derived(layer.choro);
  /** Every name the layer has, drawn or not: from the map when it is drawn, else from the loaded boundaries. */
  const areaNames = $derived.by(() => {
    if (drawnNames.length) return drawnNames;
    const fc = layer.kind === 'subunits' ? store.subFc : layer.adminLevel ? store.adminLevels[layer.adminLevel] : store.adminFc;
    return fc ? fc.features.map((f) => String(f.properties?.name ?? f.properties?.__name ?? '')).filter(Boolean) : [];
  });
  const res = $derived(cfg ? resolveChoro(cfg, areaNames) : null);
  const numericValues = $derived.by(() => {
    if (!cfg) return [];
    const vi = cfg.table.head.indexOf(cfg.field);
    return cfg.table.rows.map((r) => toNumber(r[vi])).filter((v): v is number => v !== null);
  });
  const typed = $derived(cfg?.breaks ? cfg.breaks.join(', ') : '');
  let typedBreaks = $state('');
  $effect(() => { typedBreaks = typed; });
  // the areas no table row has claimed yet, offered to the rows that did not match
  const free = $derived.by(() => {
    if (!res) return [];
    const used = new Set([...res.pairs.values()].filter((v): v is string => !!v));
    return [...new Set(areaNames)].filter((n) => !used.has(n)).sort((a, b) => a.localeCompare(b));
  });

  function useTable(tbl: Table) {
    const g = guessColumns(tbl);
    const vi = tbl.head.indexOf(g.value);
    const nums = tbl.rows.map((r) => toNumber(r[vi])).filter((v) => v !== null).length;
    const numeric = nums >= Math.max(1, tbl.rows.filter((r) => r[vi] !== '').length * 0.6);
    const distinct = new Set(tbl.rows.map((r) => toNumber(r[vi])).filter((v) => v !== null)).size;
    layer.choro = {
      table: tbl, nameCol: g.name, field: g.value,
      method: numeric ? (distinct >= 8 ? 'jenks' : 'equal') : 'categories',
      classes: Math.max(3, Math.min(5, distinct || 5)), palette: 'blues', // calm and colour-blind safe; Viridis (ending in yellow) is one click away
    };
    layer.inLegend = true;
    // opaque colours would hide anything drawn under them (points, your own shapes): the coloured areas go right above the study area, with the rest above
    const ls = store.doc.layers;
    // (the layer is held first: once it is out of the list the panel's own `layer` no longer finds it)
    const me = layer;
    const si = ls.findIndex((l) => l.kind === 'study'), li = ls.indexOf(me);
    if (si >= 0 && li > si + 1) { ls.splice(li, 1); ls.splice(si + 1, 0, me); }
    const r = resolveChoro(layer.choro, areaNames);
    msgErr = false;
    msg = !r.unmatched.length ? t('Matched {matched} of {rows} rows.', { matched: r.matched, rows: r.rows })
      : r.unmatched.length === 1 ? t('Matched {matched} of {rows} rows. 1 name does not match an area: choose the right area below.', { matched: r.matched, rows: r.rows })
      : t('Matched {matched} of {rows} rows. {n} names do not match an area: choose the right area below.', { matched: r.matched, rows: r.rows, n: r.unmatched.length });
    c();
  }
  function usePasted() {
    try { useTable(parseTable(text)); text = ''; } catch (e) { msgErr = true; msg = (e as Error).message; }
  }
  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      store.busy = t('Reading {file}…', { file: f.name });
      const n = f.name.toLowerCase();
      if (n.endsWith('.xls') || n.endsWith('.ods')) throw new Error(t('{file} is an older spreadsheet format. In Excel or LibreOffice, use Save as, then Excel workbook (.xlsx) or CSV.', { file: f.name }));
      let csv: string;
      if (n.endsWith('.xlsx')) { const { xlsxToCsv } = await import('../../lib/xlsx'); csv = (await xlsxToCsv(await f.arrayBuffer())).csv; }
      else csv = await f.text();
      useTable(parseTable(csv));
    } catch (err) {
      msgErr = true;
      msg = (err as Error).message;
    } finally {
      store.busy = '';
    }
  }
  /** A small table of the layer's own area names with made-up numbers, so the tool can be tried at once. */
  function example() {
    const list = [...new Set(areaNames)].slice(0, 12);
    if (!list.length) { msgErr = true; msg = t('This map has no areas of this kind to colour yet.'); return; }
    text = 'Name,Value\n' + list.map((n, i) => `${n},${Math.round(200 + ((i * 7919) % 97) * 38)}`).join('\n');
  }

  function patch(p: Partial<ChoroConfig>) {
    if (!layer.choro) return;
    Object.assign(layer.choro, p);
    for (const k of Object.keys(p) as (keyof ChoroConfig)[]) if (layer.choro[k] === undefined) delete (layer.choro as Partial<ChoroConfig>)[k];
    c();
  }
  function pick(table: string, area: string) { patch({ fix: { ...(cfg?.fix ?? {}), [table]: area } }); }
  function setCat(v: string, p: { color?: string; label?: string }) {
    if (!cfg) return;
    const cats = { ...(cfg.cats ?? {}) };
    const own = { ...(cats[v] ?? {}), ...p };
    if (own.label !== undefined && (own.label.trim() === '' || own.label === v)) delete own.label;
    if (Object.keys(own).length) cats[v] = own; else delete cats[v];
    patch({ cats: Object.keys(cats).length ? cats : undefined });
  }
  function setBreaks(raw: string) {
    typedBreaks = raw;
    const nums = raw.split(/[;,\s]+/).map((s) => toNumber(s)).filter((v): v is number => v !== null);
    if (nums.length >= 2) patch({ breaks: nums.sort((a, b) => a - b), classes: Math.min(7, nums.length - 1) });
  }
  function remove() { layer.choro = undefined; msg = ''; c(); }
  function setMethod(id: ChoroConfig['method']) {
    if (!cfg || !res) return;
    // the limits typed in start from the ones in use, rounded
    patch({ method: id, breaks: id === 'custom' && !cfg.breaks && res.breaks.length > 1 ? res.breaks.map((b) => Math.round(b * 100) / 100) : cfg.breaks });
  }

  const methods: { id: ChoroConfig['method']; label: string }[] = [
    { id: 'equal', label: 'Equal intervals' }, { id: 'quantile', label: 'Quantiles' }, { id: 'jenks', label: 'Natural breaks' },
    { id: 'custom', label: 'Limits I type' }, { id: 'categories', label: 'Each value its own colour' },
  ];
  const noAreas = $derived(areaNames.length === 0);
  // "Matched 3 of 5 rows; 2 areas have no value." (a sentence of its own in each case, so every language can word it)
  const matchedText = $derived.by(() => {
    if (!res) return '';
    const v = { matched: res.matched, rows: res.rows, n: res.noData.size };
    const one = res.rows === 1, gaps = res.noData.size;
    if (!gaps) return one ? t('Matched {matched} of {rows} row.', v) : t('Matched {matched} of {rows} rows.', v);
    if (gaps === 1) return one ? t('Matched {matched} of {rows} row; 1 area has no value.', v) : t('Matched {matched} of {rows} rows; 1 area has no value.', v);
    return one ? t('Matched {matched} of {rows} row; {n} areas have no value.', v) : t('Matched {matched} of {rows} rows; {n} areas have no value.', v);
  });
</script>

<section>
  <h3 class="group-title">{t('Colour areas by a value')}</h3>
  {#if !cfg}
    <p class="hint">{layer.kind === 'admin' ? t('Colour the boundary areas from a table, such as people, cases or land use per area. You need one column with the area names and one with the values.') : t('Colour the sub-areas from a table, such as people, cases or land use per area. You need one column with the area names and one with the values.')}</p>
    {#if noAreas}<p class="hint warn">{layer.kind === 'subunits' ? t('This map has no sub-areas yet. They show when the study area is a district or similar, with finer official units inside it.') : t('No boundaries are loaded on this map yet.')}</p>{/if}
    <label class="field">
      <span>{t('Paste a table (first row = column names)')}</span>
      <textarea class="input" rows="5" bind:value={text} placeholder={'Name,Population\nSavar,1370000\nDhamrai,430000'} spellcheck={false}></textarea>
    </label>
    <div class="row">
      <button class="btn primary small" onclick={usePasted} disabled={!text.trim()}>{t('Colour the areas')}</button>
      <button class="btn small" onclick={example} disabled={noAreas}>{t('Try an example')}</button>
    </div>
    <button class="btn" onclick={() => fileInput?.click()}><UploadSimple size={16} weight="bold" /> {t('Open a CSV or Excel file')}</button>
    <input bind:this={fileInput} type="file" class="sr-only" tabindex="-1" accept=".csv,.txt,.tsv,.xlsx" onchange={onFile} />
    <p class="hint">{t('Read on your computer. Nothing is uploaded.')}</p>
    <p class="msg" class:err={msgErr} role="status">{msg}</p>
  {:else if res}
    <div class="two">
      <label class="field"><span>{t('Names are in')}</span>
        <select class="input" value={cfg.nameCol} onchange={(e) => patch({ nameCol: (e.target as HTMLSelectElement).value, fix: undefined })}>
          {#each cfg.table.head as h}<option value={h}>{h}</option>{/each}
        </select>
      </label>
      <label class="field"><span>{t('Values are in')}</span>
        <select class="input" value={cfg.field} onchange={(e) => patch({ field: (e.target as HTMLSelectElement).value, title: undefined, cats: undefined })}>
          {#each cfg.table.head as h}<option value={h}>{h}</option>{/each}
        </select>
      </label>
    </div>
    <p class="msg {res.unmatched.length ? '' : 'ok'}" role="status">{matchedText}</p>
    {#if res.unmatched.length}
      <div class="unm" role="group" aria-label={t('Names that did not match')}>
        <p class="hint">{t('These names in your table are not on the map. Choose the area each one means, or leave it out.')}</p>
        {#each res.unmatched as nm (nm)}
          <label class="um"><span class="un">{nm}</span>
            <select class="input" value={cfg.fix?.[nm] ?? ''} aria-label={t('Area for {name}', { name: nm })} onchange={(e) => pick(nm, (e.target as HTMLSelectElement).value)}>
              <option value="">{t('Not on this map')}</option>
              {#each free as a}<option value={a}>{a}</option>{/each}
            </select>
          </label>
        {/each}
      </div>
    {/if}
    {#if res.notNumbers && !res.categories}<p class="hint warn">{res.notNumbers === 1 ? t('1 value is not a number and is left uncoloured. Choose "Each value its own colour" for words.') : t('{n} values are not numbers and are left uncoloured. Choose "Each value its own colour" for words.', { n: res.notNumbers })}</p>{/if}

    <div class="field"><span>{t('Group the values')}</span>
      <div class="seg wrap" role="group" aria-label={t('How the values are grouped')}>
        {#each methods as m}<button aria-pressed={cfg.method === m.id} onclick={() => setMethod(m.id)}>{t(m.label)}</button>{/each}
      </div>
    </div>
    {#if cfg.method === 'custom'}
      <label class="field"><span>{t('Class limits, lowest to highest')}</span><input class="input" type="text" value={typedBreaks} placeholder="0, 500, 1000, 5000" onchange={(e) => setBreaks((e.target as HTMLInputElement).value)} /></label>
      <p class="hint">{t('Separate the limits with commas. Values below the first or above the last limit join the end classes.')}</p>
    {:else if cfg.method !== 'categories'}
      <label class="field slider"><span>{t('Classes')} <span class="val" aria-hidden="true">{res.legend.length === cfg.classes ? cfg.classes : t('{a} of {b}', { a: String(res.legend.length), b: String(cfg.classes) })}</span></span><input type="range" min="3" max="7" step="1" value={cfg.classes} aria-valuetext={t('{n} classes', { n: cfg.classes })} oninput={(e) => patch({ classes: +(e.target as HTMLInputElement).value })} /></label>
      {#if res.legend.length < cfg.classes && numericValues.length}<p class="hint">{res.legend.length === 1 ? t('These values only make 1 different class.') : t('These values only make {n} different classes.', { n: res.legend.length })}</p>{/if}
    {/if}

    {#if cfg.method === 'categories'}
      <ul class="cats" aria-label={t('Colour of each value')}>
        {#each res.legend as e (e.key)}
          <li>
            <ColorPicker value={e.colour} label={t('Colour for {name}', { name: e.label })} size={26} onchange={(col) => setCat(e.key ?? '', { color: col })} />
            <input class="nm" type="text" value={e.label} aria-label={t('Legend text for {name}', { name: e.key ?? e.label })} oninput={(ev) => setCat(e.key ?? '', { label: (ev.target as HTMLInputElement).value })} />
          </li>
        {/each}
      </ul>
      {#if res.legend.length > CAT_COLOURS.length}<p class="hint warn">{t('More than {n} different values: some colours repeat. Group the values instead.', { n: CAT_COLOURS.length })}</p>{/if}
    {:else}
      <div class="field"><span>{t('Colours')}</span>
        <div class="pal" role="group" aria-label={t('Colour scheme')}>
          {#each PALETTES as p}
            <button class="pbtn" aria-pressed={cfg.palette === p.id} aria-label={t(p.label)} title={t(p.label)} onclick={() => patch({ palette: p.id })}>
              <span class="ramp" style="background:{rampCss(p.id, cfg.reverse)}"></span><span class="pn">{t(p.label)}</span>
            </button>
          {/each}
        </div>
      </div>
      <label class="row-switch"><span>{t('Reverse the colours')}<small>{t('Darkest for the smallest values instead of the largest')}</small></span><input type="checkbox" role="switch" checked={!!cfg.reverse} onchange={() => patch({ reverse: cfg.reverse ? undefined : true })} /></label>
    {/if}
    <label class="field slider"><span>{t('Colour strength')} <span class="val" aria-hidden="true">{Math.round((cfg.opacity ?? 1) * 100)}%</span></span><input type="range" min="0.3" max="1" step="0.05" value={cfg.opacity ?? 1} aria-valuetext={t('{n} percent', { n: Math.round((cfg.opacity ?? 1) * 100) })} oninput={(e) => { const v = +(e.target as HTMLInputElement).value; patch({ opacity: v === 1 ? undefined : v }); }} /></label>

    <label class="field"><span>{t('Legend title')}</span><input class="input" type="text" value={cfg.title ?? cfg.field} placeholder={cfg.field} oninput={(e) => { const v = (e.target as HTMLInputElement).value; patch({ title: v === cfg.field ? undefined : v }); }} /></label>
    {#if res.noData.size}
      <label class="field"><span>{t('Areas with no value are called')}</span><input class="input" type="text" value={cfg.noDataLabel ?? 'No data'} oninput={(e) => { const v = (e.target as HTMLInputElement).value; patch({ noDataLabel: v === 'No data' ? undefined : v }); }} /></label>
      <label class="row-switch"><span>{t('Hatch them')}<small>{t('Grey with diagonal lines, so they never pass for a class, even in black and white')}</small></span><input type="checkbox" role="switch" checked={cfg.noDataHatch !== false} onchange={() => patch({ noDataHatch: cfg.noDataHatch === false ? undefined : false })} /></label>
    {/if}
    <div class="row">
      <button class="btn small" onclick={() => { layer.choro = undefined; text = ''; msg = ''; c(); }}>{t('Use another table')}</button>
      <button class="btn small ghost" onclick={remove}>{t('Remove the colours')}</button>
    </div>
    <p class="hint">{t('An area you colour by hand (click it on the map) keeps that colour.')}</p>
  {/if}
</section>

<style>
  .two { display: grid; gap: 10px; }
  .unm { display: grid; gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel-2); }
  .um { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); align-items: center; gap: 8px; }
  .un { font-size: 13px; font-weight: 500; overflow-wrap: anywhere; }
  .um .input { min-height: 34px; padding: 4px 8px; font-size: 12.5px; }
  .pal { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .pbtn { display: grid; gap: 4px; padding: 6px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: var(--panel); text-align: left; }
  .pbtn:hover { border-color: var(--line-strong); }
  .pbtn[aria-pressed='true'] { border-color: var(--accent); background: var(--accent-wash); }
  .ramp { display: block; height: 12px; border-radius: 3px; box-shadow: inset 0 0 0 1px rgb(43 45 47 / 0.15); }
  .pn { font-size: 12.5px; color: var(--ink-2); font-weight: 500; }
  .pbtn[aria-pressed='true'] .pn { color: var(--accent-ink); }
  .cats { list-style: none; margin: 0; padding: 0; display: grid; }
  .cats li { display: grid; grid-template-columns: 26px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 38px; padding: 0 2px; }
  .cats li + li { border-top: 1px solid var(--line); }
  .nm { width: 100%; min-width: 0; height: 30px; padding: 0 6px; border: 1px solid transparent; border-radius: var(--r-chip); background: transparent; font-size: 14px; font-weight: 500; text-overflow: ellipsis; }
  .nm:hover { border-color: var(--line-strong); }
  .nm:focus-visible { outline: 2px solid transparent; background: var(--panel); border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  @media (pointer: coarse) { .cats li { min-height: 44px; } .nm { height: 40px; } .um .input { min-height: 44px; } }
</style>
