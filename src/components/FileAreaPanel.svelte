<script lang="ts">
  // Use your own boundary file (DIVA-GIS, GADM, a government shapefile...) and pick the areas you need.
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import { geoCentroid } from 'd3-geo';
  import type { FeatureCollection } from 'geojson';
  import { store, uid, defaultStyle } from '../lib/store.svelte';
  import type { Layer } from '../lib/store.svelte';
  import { readVectorFiles, looksGeographic, guessNameField, ImportError, unreadableMessage } from '../lib/importers';
  import { rewind } from '../lib/scene';
  import { firstArea, syncPlaceholderTitle } from '../lib/actions';
  import { t } from '../lib/i18n.svelte';

  // ondone: told when a file has been chosen as the study area, so the panel can fold away
  let { ondone }: { ondone?: () => void } = $props();
  let input: HTMLInputElement;
  let dragging = $state(false);
  let error = $state('');
  let reading = $state(false);
  let activeId = $state<string | null>(store.doc.study.source === 'layer' ? store.doc.study.fromLayer ?? null : null);
  let field = $state(store.doc.study.field ?? '');
  let picked = $state<Set<string>>(new Set(store.doc.study.values ?? []));
  let q = $state('');

  const files = $derived(store.doc.layers.filter((l) => l.kind === 'vector' && store.geoms[l.id]));
  const active = $derived(files.find((l) => l.id === activeId) ?? files[files.length - 1] ?? null);
  const fc = $derived(active ? store.geoms[active.id] : null);
  const fields = $derived(fc ? Object.keys(fc.features.find((f) => f.properties)?.properties ?? {}).filter((k) => !k.startsWith('__')) : []);
  const names = $derived.by(() => {
    if (!fc || !field) return [] as { name: string; count: number }[];
    const m = new Map<string, number>();
    for (const f of fc.features) { const n = String(f.properties?.[field] ?? ''); if (n) m.set(n, (m.get(n) ?? 0) + 1); }
    return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  });
  const shown = $derived(q.trim() ? names.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase())) : names);

  $effect(() => {
    // pick a sensible name column for a newly chosen file
    if (fc && (!field || !fields.includes(field))) field = guessNameField(fc);
  });

  async function load(list: File[]) {
    error = '';
    if (!list.length) return;
    reading = true;
    store.busy = t('Reading your file…');
    try {
      const loaded = await readVectorFiles(list);
      if (!loaded.length) throw new ImportError(t('No map data found. For a shapefile choose the .shp together with its .dbf and .prj, or the .zip.'));
      for (const { name, fc } of loaded) {
        if (!fc.features.length) throw new ImportError(t('We opened {name} but found no map shapes in it. Check that it is the right file.', { name }));
        if (!looksGeographic(fc)) throw new ImportError(t('{name} is not in latitude/longitude and has no .prj file to convert it. Add the .prj file, or export it as WGS 84 from QGIS.', { name }));
        rewind(fc);
        const l: Layer = {
          id: uid('vector'), kind: 'vector', name, visible: true, inLegend: false, legendLabel: name,
          style: defaultStyle({ fill: 'none', stroke: '#6B6B66', strokePt: 0.35 }), source: `${name} (your data)`,
        };
        store.geoms = { ...store.geoms, [l.id]: fc };
        store.doc.layers.splice(store.doc.layers.length - 1, 0, l);
        activeId = l.id;
      }
      field = '';
      picked = new Set();
      store.commit();
    } catch (e) {
      // our own messages are plain words; anything else is a parser error that would mean nothing to the reader
      error = e instanceof ImportError ? e.message : unreadableMessage(list.length === 1 ? list[0].name : 'those files');
    } finally {
      reading = false;
      store.busy = '';
    }
  }

  function toggle(n: string) {
    const s = new Set(picked);
    if (s.has(n)) s.delete(n); else s.add(n);
    picked = s;
  }

  function use() {
    if (!active || !fc) return;
    const values = [...picked];
    const feats = values.length ? fc.features.filter((f) => picked.has(String(f.properties?.[field] ?? ''))) : fc.features;
    const sub: FeatureCollection = { type: 'FeatureCollection', features: feats };
    const c = geoCentroid(sub as any) as [number, number];
    const ctry = (globalThis as any).__countryAt?.(c[0], c[1]) as { iso: string; name: string } | null;
    firstArea(); // a first area gets the map style and the saved default style, as a place or a drawing does
    const s = store.doc.study;
    s.source = 'layer';
    s.fromLayer = active.id;
    s.field = values.length ? field : undefined;
    s.values = values.length ? values : undefined;
    s.name = values.length ? (values.length <= 3 ? values.join(', ') : `${values.length} areas`) : active.name;
    syncPlaceholderTitle();
    s.highlight = true;
    s.iso = ctry?.iso ?? s.iso;
    s.countryName = ctry?.name ?? s.countryName;
    s.level = 0;
    s.unitIds = []; s.unitNames = values;
    store.doc.view = { padding: 0.12, panX: 0, panY: 0, zoom: 1 };
    store.doc.crs = null;
    const t = store.doc.title;
    if (!t || t === 'Untitled map' || t.endsWith(' study area') || t.startsWith('Study area')) store.doc.title = `${s.name} study area`;
    const study = store.doc.layers.find((l) => l.kind === 'study');
    if (study) { study.legendLabel = 'Study area'; study.style.byUnit = values.length > 1 && values.length <= 8 ? study.style.byUnit : false; }
    store.commit();
    ondone?.();
  }
</script>

<div class="stack">
  <button
    class="drop"
    class:dragging
    onclick={() => input.click()}
    ondragover={(e) => { e.preventDefault(); dragging = true; }}
    ondragleave={() => (dragging = false)}
    ondrop={(e) => { e.preventDefault(); dragging = false; load([...(e.dataTransfer?.files ?? [])]); }}
  >
    <UploadSimple size={24} />
    <strong>{reading ? t('Reading…') : t('Choose or drop your boundary file')}</strong>
    <small><b>{t('Shapefile:')}</b> {t('the .zip a GIS program or data portal gives you (or the .shp, .dbf and .prj files together)')}</small>
    <small>{t('GeoJSON and KML files work too. Free boundaries are on GADM, DIVA-GIS and many government sites.')}</small>
  </button>
  <input bind:this={input} type="file" multiple class="sr-only" tabindex="-1" accept=".zip,.shp,.dbf,.shx,.prj,.cpg,.geojson,.json,.kml,.gpx" onchange={(e) => { const t = e.target as HTMLInputElement; load([...(t.files ?? [])]); t.value = ''; }} />
  <p class="msg err" role="alert">{t(error)}</p>

  {#if active && fc}
    {#if files.length > 1}
      <label class="field"><span>{t('File')}</span>
        <select class="input" value={active.id} onchange={(e) => { activeId = (e.target as HTMLSelectElement).value; field = ''; picked = new Set(); }}>
          {#each files as f}<option value={f.id}>{f.name}</option>{/each}
        </select>
      </label>
    {/if}
    <p class="hint"><strong>{active.name}</strong>: {t('{n} areas.', { n: fc.features.length.toLocaleString() })}</p>
    <label class="field"><span>{t('Names are in column')}</span>
      <select class="input" bind:value={field} onchange={() => (picked = new Set())}>
        {#each fields as f}<option value={f}>{f}</option>{/each}
      </select>
    </label>
    <input class="input" type="search" placeholder={t('Search names…')} aria-label={t('Search names in your file')} bind:value={q} spellcheck={false} />
    <div class="units" role="group" aria-label={t('Areas in your file')}>
      {#each shown.slice(0, 400) as n (n.name)}
        <label class="check"><input type="checkbox" checked={picked.has(n.name)} onchange={() => toggle(n.name)} /> <span class="nm">{n.name}</span>{#if n.count > 1}<small>{n.count}</small>{/if}</label>
      {/each}
      {#if shown.length > 400}<p class="hint">{t('Showing 400 of {n}. Search to narrow the list.', { n: shown.length.toLocaleString() })}</p>{/if}
      {#if !names.length}<p class="hint">{t('This column has no names. Choose another column above.')}</p>{:else if !shown.length}<p class="hint">{t('No names match.')}</p>{/if}
    </div>
    <div class="row">
      <button class="btn small ghost" onclick={() => (picked = new Set(shown.map((n) => n.name)))}>{t('Select shown')}</button>
      <button class="btn small ghost" onclick={() => (picked = new Set())}>{t('Clear')}</button>
    </div>
    <button class="btn primary" onclick={use}>
      {picked.size ? t('Use {n} selected as study area', { n: picked.size }) : t('Use the whole file as study area')}
    </button>
    <label class="check"><input type="checkbox" checked={active.visible} onchange={() => { active.visible = !active.visible; store.commit(); }} /> {t('Show all boundaries from this file on the map')}</label>
  {/if}
</div>

<style>
  .stack { display: grid; gap: 12px; }
  .drop {
    display: grid; justify-items: center; gap: 6px; text-align: center;
    padding: 22px 16px; border: 1.5px dashed var(--line-input); border-radius: var(--r-panel);
    background: var(--panel-2); color: var(--ink-2);
    transition: border-color 120ms ease, background-color 120ms ease;
  }
  .drop strong { color: var(--ink); font-weight: 600; }
  .drop small { font-size: 12.5px; color: var(--ink-3); line-height: 1.4; }
  .drop small b { color: var(--ink-2); font-weight: 600; }
  .drop:hover, .drop.dragging { border-color: var(--accent); background: var(--accent-wash); }
  .units { max-height: 240px; overflow: auto; display: grid; gap: 4px; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: #fff; }
  .units .check { font-size: 14px; min-height: 28px; }
  .nm { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .units small { color: var(--ink-3); font-size: 11.5px; }
</style>
