<script lang="ts">
  import MapPin from 'phosphor-svelte/lib/MapPin';
  import FileArrowUp from 'phosphor-svelte/lib/FileArrowUp';
  import Drop from 'phosphor-svelte/lib/Drop';
  import Path from 'phosphor-svelte/lib/Path';
  import { store, uid, defaultStyle, OKABE_ITO } from '../../lib/store.svelte';
  import type { Layer } from '../../lib/store.svelte';
  import { osmLayerStyle } from '../../lib/actions';
  import { addOpen } from '../shell.svelte';
  import { t } from '../../lib/i18n.svelte';

  function addLayer(l: Layer) {
    store.doc.layers.splice(store.doc.layers.length - 1, 0, l);
    store.select(l.id, true); // open its settings: that is where the points or the file go
    store.commit();
  }

  function addPoints() {
    const used = store.doc.layers.filter((l) => l.kind === 'points').length;
    addLayer({ id: uid('points'), kind: 'points', name: 'Sample sites', visible: true, inLegend: true, legendLabel: 'Sample site',
      style: defaultStyle({ fill: OKABE_ITO.filter((c) => c !== '#F0E442')[(used + 1) % 7], stroke: '#1B1F1D', strokePt: 0.4, sizePt: 5, symbol: 'circle' }) });
  }
  function addFile() {
    addLayer({ id: uid('vector'), kind: 'vector', name: 'My layer', visible: true, inLegend: true, legendLabel: 'My layer',
      style: defaultStyle({ fill: '#0072B2', fillOpacity: 0.18, stroke: '#0072B2', strokePt: 0.8, sizePt: 5 }) });
  }
  function addOsm(theme: 'water' | 'roads') {
    const water = theme === 'water';
    addLayer({ id: uid('osm'), kind: 'osm', osmTheme: theme, name: water ? 'Rivers and water (detailed)' : 'Roads', visible: true, inLegend: true,
      legendLabel: water ? 'River and water body' : 'Road',
      style: osmLayerStyle(theme) }); // the colours of the map style in use
  }
  const noPlace = $derived(store.doc.study.source === 'none');
</script>

<!-- two folded groups: most figures need neither, so they start closed and keep the Add tab short -->
<div class="stack">
  <details class="acc quiet" bind:open={addOpen.own}>
    <summary>{t('Add your own')}</summary>
    <div class="acc-body">
      <div class="opts">
        <button class="opt" onclick={addPoints}>
          <span class="ic"><MapPin size={20} /></span>
          <span><strong>{t('Sample points')}</strong><small>{t('Paste a table or CSV file')}</small></span>
        </button>
        <button class="opt" onclick={addFile}>
          <span class="ic"><FileArrowUp size={20} /></span>
          <span><strong>{t('A map file')}</strong><small>{t('GeoJSON, KML, GPX or zipped shapefile')}</small></span>
        </button>
      </div>
      <p class="hint">{t('Files are read on your computer. Nothing is uploaded.')}</p>
    </div>
  </details>
  <details class="acc quiet" bind:open={addOpen.osm}>
    <summary>{t('Add detail from OpenStreetMap')}</summary>
    <div class="acc-body">
      <div class="opts">
        <button class="opt" onclick={() => addOsm('water')} disabled={noPlace} aria-describedby={noPlace ? 'osm-hint' : undefined}>
          <span class="ic"><Drop size={20} /></span>
          <span><strong>{t('Rivers and water')}</strong><small>{t('Every river, canal, lake and pond')}</small></span>
        </button>
        <button class="opt" onclick={() => addOsm('roads')} disabled={noPlace} aria-describedby={noPlace ? 'osm-hint' : undefined}>
          <span class="ic"><Path size={20} /></span>
          <span><strong>{t('Roads')}</strong><small>{t('Main roads')}</small></span>
        </button>
      </div>
      {#if noPlace}<p class="hint" id="osm-hint">{t('Choose a place first.')}</p>{/if}
    </div>
  </details>
</div>

<style>
  /* ruled rows: icon, name, one line on what it does; no cards. The list has no gap, so the hairlines meet */
  .opts { display: grid; border-top: 1px solid var(--line); }
  .opt {
    display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 12px; align-items: center; text-align: left;
    padding: 10px 4px; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent;
  }
  .opt:hover:not(:disabled) { background: var(--panel-2); }
  .opt:disabled { opacity: 0.5; cursor: not-allowed; }
  .ic { width: 32px; height: 32px; border-radius: var(--r-ctl); background: var(--accent-wash); color: var(--accent-ink); display: grid; place-items: center; }
  .opt strong { display: block; font-weight: 600; }
  .opt small { display: block; font-size: 12.5px; color: var(--ink-3); line-height: 1.35; }
</style>
