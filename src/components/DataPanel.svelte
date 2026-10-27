<script lang="ts">
  // Data input for a user layer: paste or upload points, or upload a vector file.
  import type { FeatureCollection } from 'geojson';
  import { store } from '../lib/store.svelte';
  import type { Layer } from '../lib/store.svelte';
  import { looksGeographic, parsePointsText, readVectorFile } from '../lib/importers';
  import { rewind } from '../lib/scene';
  import UploadSimple from 'phosphor-svelte/lib/UploadSimple';
  import { t } from '../lib/i18n.svelte';

  let { layer }: { layer: Layer } = $props();
  let text = $state('');
  let messages = $state<string[]>([]);
  // true while the messages tell of success (points added, file loaded); anything else in the list is a problem
  let good = $state(false);
  const msgIsError = $derived(messages.length > 0 && !good);
  let fileInput: HTMLInputElement;

  const SAMPLE = `site,lat,lon\nS1,24.8949,91.8687\nS2,24.9532,91.9024\nS3,24.8201,91.7998\nS4,24.9105,92.0310\nS5,24°47'12"N,91°56'40"E`;

  function apply(fc: FeatureCollection, from: string) {
    rewind(fc);
    store.geoms = { ...store.geoms, [layer.id]: fc };
    const cols = Object.keys(fc.features[0]?.properties ?? {}).filter((k) => !k.startsWith('__'));
    // a style by a column of the table that was there before: kept while the new table still has that column, dropped when it has not
    const pb = layer.pointsBy;
    if (pb) {
      const keep = { ...pb };
      for (const k of ['colorField', 'symbolField', 'sizeField', 'numberField'] as const) if (keep[k] && !cols.includes(keep[k]!)) delete keep[k];
      if (!keep.colorField) { delete keep.cats; delete keep.title; }
      if (!keep.symbolField) delete keep.symbols;
      if (keep.number === 'column' && !keep.numberField) keep.number = 'order';
      layer.pointsBy = Object.keys(keep).length ? keep : undefined;
    }
    if (layer.kind === 'points' && !layer.style.labelField && cols.length) {
      const guess = cols.find((c) => /^(name|site|id|station|label|code)$/i.test(c));
      if (guess) layer.style.labelField = guess;
    }
    if (layer.name === 'My layer' || layer.name === 'Sample sites') {
      if (from) layer.name = from.replace(/\.[^.]+$/, '');
    }
    store.commit();
    store.autosave();
  }

  const points = (n: number) => t(n === 1 ? '{n} point' : '{n} points', { n: n.toLocaleString() });
  const rows = (n: number) => t(n === 1 ? '{n} row' : '{n} rows', { n: n.toLocaleString() });
  const features = (n: number) => t(n === 1 ? '{n} feature' : '{n} features', { n: n.toLocaleString() });

  function usePasted() {
    const r = parsePointsText(text);
    messages = r.errors;
    good = false;
    if (r.points.length) {
      apply({ type: 'FeatureCollection', features: r.points }, '');
      good = true;
      messages = [r.skipped ? t('Added {points}, skipped {rows}.', { points: points(r.points.length), rows: rows(r.skipped) }) : t('Added {points}.', { points: points(r.points.length) }), ...r.errors];
    }
  }

  async function onFile(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    (e.target as HTMLInputElement).value = '';
    if (!f) return;
    try {
      store.busy = t('Reading {file}…', { file: f.name });
      const fc = await readVectorFile(f);
      if (!fc.features.length) throw new Error(t('The file has no features.'));
      if (!looksGeographic(fc)) throw new Error(t('These coordinates are not latitude/longitude. For shapefiles, include the .prj file in the zip so it can be converted.'));
      apply(fc, f.name);
      layer.source = layer.source || '';
      good = true;
      messages = [t('Loaded {features} from {file}.', { features: features(fc.features.length), file: f.name })];
    } catch (err) {
      good = false;
      messages = [(err as Error).message];
    } finally {
      store.busy = '';
    }
  }

  const columns = $derived(Object.keys(store.geoms[layer.id]?.features[0]?.properties ?? {}).filter((k) => !k.startsWith('__')));
</script>

<section class="block">
  <h3 class="group-title">{layer.kind === 'points' ? t('Points') : t('File')}</h3>
  {#if layer.kind === 'points'}
    <label class="field">
      <span>{t('Paste a table with latitude and longitude columns (decimal or degrees-minutes-seconds)')}</span>
      <textarea class="input" rows="6" bind:value={text} placeholder={SAMPLE} spellcheck={false} aria-describedby="data-msgs"></textarea>
    </label>
    <div class="row">
      <button class="btn primary small" onclick={usePasted} disabled={!text.trim()}>{t('Add points')}</button>
      <button class="btn small" onclick={() => (text = SAMPLE)}>{t('Try an example')}</button>
    </div>
  {/if}
  <button class="btn" onclick={() => fileInput.click()}><UploadSimple size={16} weight="bold" /> {layer.kind === 'points' ? t('Upload CSV') : t('Upload GeoJSON, KML, GPX or zipped shapefile')}</button>
  <input bind:this={fileInput} type="file" class="sr-only" tabindex="-1" accept={layer.kind === 'points' ? '.csv,.txt,.tsv,.xlsx' : '.geojson,.json,.kml,.gpx,.zip,.csv,.xlsx'} onchange={onFile} />
  <p class="hint">{t('Files are read on your computer. Nothing is uploaded.')}</p>
  <div id="data-msgs">
    <div role="status">{#if !msgIsError}{#each messages as m}<p class="msg">{t(m)}</p>{/each}{/if}</div>
    <div role="alert">{#if msgIsError}{#each messages as m}<p class="msg err">{t(m)}</p>{/each}{/if}</div>
  </div>
  {#if columns.length}
    <label class="field">
      <span>{t('Label points with')}</span>
      <select class="input" bind:value={layer.style.labelField} onchange={() => store.commit()}>
        <option value="">{t('No labels')}</option>
        {#each columns as c}<option value={c}>{c}</option>{/each}
      </select>
    </label>
  {/if}
  <label class="field">
    <span>{t('Data source (printed in the credits)')}</span>
    <input class="input" bind:value={layer.source} oninput={() => store.commit()} placeholder={t('e.g. Field survey, 2025…')} />
  </label>
</section>

<style>
  .block { display: grid; gap: 8px; grid-template-columns: minmax(0, 1fr); }
  .block :global(.btn) { white-space: normal; text-align: center; }
  .hint { margin: 0; font-size: 12.5px; color: var(--ink-3); }
  #data-msgs { display: grid; gap: 6px; }
  .msg.err { background: var(--err-wash); color: var(--err); }
</style>
