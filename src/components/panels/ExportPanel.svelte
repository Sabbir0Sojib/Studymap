<script lang="ts">
  import FilePdf from 'phosphor-svelte/lib/FilePdf';
  import FileSvg from 'phosphor-svelte/lib/FileSvg';
  import FileImage from 'phosphor-svelte/lib/FileImage';
  import Image from 'phosphor-svelte/lib/Image';
  import { tick } from 'svelte';
  import { store } from '../../lib/store.svelte';
  import { findPreset } from '../../lib/journals';
  import { TERRAIN_CREDIT, TERRAIN_CREDIT_FULL } from '../../lib/terrain';
  import { download, exportPdf, exportPng, exportSvg, exportTiff, exportBundle, rasterSize, maxDpi } from '../../lib/export';
  import { fontsUsed } from '../../lib/fonts.svelte';
  import PaperPack from '../PaperPack.svelte';
  import type { MainScene } from '../../lib/scene';
  import type { Finding } from '../../lib/check';
  import { t } from '../../lib/i18n.svelte';

  let { svgEl, main, findings, credits = [], terrainOn = false }: { svgEl?: SVGSVGElement; main: MainScene | null; findings: Finding[]; credits?: string[]; terrainOn?: boolean } = $props();
  // A file name that says what the file is: title, size and resolution (Dhaka_District_study_area_190x150mm_600dpi.tif).
  const defaultName = $derived.by(() => {
    const d = store.doc;
    const base = (d.title || 'Study area map').normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'Study_area_map';
    const raster = d.exportFormat === 'png' || d.exportFormat === 'tiff';
    return `${base}_${d.widthMm}x${d.heightMm}mm${raster ? `_${d.exportDpi}dpi` : ''}`;
  });
  const ownName = $derived(store.doc.exportNameFor === undefined || store.doc.exportNameFor === store.doc.study.name ? (store.doc.exportName ?? '') : '');
  const fileName = $derived((ownName.trim() || defaultName).replace(/[\\/:*?"<>|]+/g, '_'));
  const ext = $derived(store.doc.exportFormat === 'tiff' ? 'tif' : store.doc.exportFormat);

  const caption = $derived.by(() => {
    const s = store.doc.study;
    const where = s.name ? (s.countryName && s.countryName !== s.name ? `${s.name}, ${s.countryName}` : s.name) : 'the study area';
    // The short elevation credit printed on the map is replaced by its full wording here.
    const lines = credits.map((c) => c.split(TERRAIN_CREDIT).join('').replace(/;\s*$/, '').trim()).filter(Boolean);
    if (terrainOn) lines.push(TERRAIN_CREDIT_FULL);
    const text = `Location of ${where}. ${lines.join('. ')}${lines.length ? '.' : ''}`;
    return text.replace(/\.{2,}/g, '.').replace(/\)\./g, ').');
  });
  let copied = $state(false);
  let copyErr = $state('');
  async function copyCaption() {
    copyErr = '';
    try { await navigator.clipboard.writeText(caption); copied = true; setTimeout(() => (copied = false), 2000); }
    catch { copied = false; copyErr = t('Could not copy. Select the caption above and press Ctrl+C.'); }
  }
  const preset = $derived(findPreset(store.doc.presetId));
  const raster = $derived(rasterSize(store.doc.widthMm, store.doc.heightMm, store.doc.exportDpi));
  const isRaster = $derived(store.doc.exportFormat === 'tiff' || store.doc.exportFormat === 'png');
  const problems = $derived(findings.filter((f) => f.level === 'error'));
  let dpiErr = $state(false);
  // A typed dpi outside the allowed range is not applied; the field goes back to the last good value and says why.
  function setDpi(input: HTMLInputElement) {
    const v = Math.round(Number(input.value));
    if (input.value.trim() && v >= 72 && v <= 2400) { dpiErr = false; store.doc.exportDpi = v; store.commit(); }
    else { dpiErr = true; input.value = String(store.doc.exportDpi); }
  }
  let busy = $state(false);
  /** Everything for the submission in one .zip: PDF, TIFF (or PNG for a page too big for TIFF here), SVG, caption, project. */
  let zipping = $state(false);
  async function goBundle() {
    if (!svgEl || zipping) return;
    zipping = true; msg = ''; err = false;
    const d = store.doc;
    try {
      await store.beforeExport?.();
      await tick();
      const dpi = Math.min(Math.max(d.exportDpi, preset.minDpi), maxDpi(d.widthMm, d.heightMm));
      const blob = await exportBundle(svgEl, d.widthMm, d.heightMm, dpi, d.title, caption, store.serialize(true, true), fileName, 'tiff', { families: fontsUsed(d), transparent: d.pageColor === 'none' });
      download(blob, `${fileName}.zip`);
      msg = t('Downloaded {file} ({size}): PDF, {dpi} dpi TIFF, SVG, the caption and the project file.', { file: `${fileName}.zip`, size: `${(blob.size / 1048576).toFixed(1)} MB`, dpi });
      store.status = t('Downloaded {file}. It is in your Downloads folder.', { file: `${fileName}.zip` });
    } catch (e) {
      msg = t((e as Error).message); err = true;
    } finally {
      store.afterExport?.();
      zipping = false;
    }
  }
  let msg = $state('');
  let err = $state(false);

  const FORMATS = [
    { id: 'pdf', label: 'PDF', note: 'Vector, best for journals', icon: FilePdf },
    { id: 'tiff', label: 'TIFF', note: 'High-resolution image', icon: FileImage },
    { id: 'png', label: 'PNG', note: 'Image for slides and Word', icon: Image },
    { id: 'svg', label: 'SVG', note: 'Edit in Illustrator or Inkscape', icon: FileSvg },
  ] as const;

  async function go() {
    if (!svgEl) return;
    busy = true; msg = ''; err = false;
    const d = store.doc;
    const name = fileName;
    try {
      await store.beforeExport?.();
      await tick();
      const t0 = performance.now();
      let blob: Blob;
      const opts = { families: fontsUsed(d), transparent: d.pageColor === 'none' };
      if (d.exportFormat === 'svg') blob = await exportSvg(svgEl, opts);
      else if (d.exportFormat === 'pdf') blob = await exportPdf(svgEl, d.widthMm, d.heightMm, d.title, caption, opts);
      else if (d.exportFormat === 'png') blob = await exportPng(svgEl, d.widthMm, d.heightMm, d.exportDpi, d.title, caption, opts);
      else blob = await exportTiff(svgEl, d.widthMm, d.heightMm, d.exportDpi, opts);
      download(blob, `${name}.${ext}`);
      const mb = blob.size / 1048576;
      const size = mb < 1 ? `${Math.max(1, Math.round(blob.size / 1024))} KB` : `${mb.toFixed(1)} MB`;
      const over = preset.maxFileMb && mb > preset.maxFileMb ? ` ${t('{publisher} accepts up to {max} MB; try 300 dpi or PDF.', { publisher: preset.publisher, max: preset.maxFileMb })}` : '';
      msg = `${t('Downloaded {file} ({size}) in {secs} s.', { file: `${name}.${ext}`, size, secs: ((performance.now() - t0) / 1000).toFixed(1) })}${over} ${t('Next: copy the figure caption below and paste it under the figure in your paper.')}`;
      store.status = t('Downloaded {file} ({size}). It is in your Downloads folder.', { file: `${name}.${ext}`, size });
    } catch (e) {
      msg = t((e as Error).message);
      err = true;
    } finally {
      store.afterExport?.();
      busy = false;
    }
  }

  // The Download button lives in the panel's foot (SidePanel): this panel hands it what to run, what to say and whether it is ready.
  const noPlace = $derived(store.doc.study.source === 'none');
  const notReady = $derived(busy || !main || noPlace || (isRaster && !raster.ok));
  const downloadLabel = $derived(busy ? t('Preparing your file…') : noPlace ? t('Choose a place first') : t('Download {format}', { format: store.doc.exportFormat.toUpperCase() }));
  $effect(() => {
    store.exportRun = go;
    return () => { store.exportRun = undefined; };
  });
  $effect(() => {
    store.exportLabel = downloadLabel;
    store.exportDisabled = notReady;
  });
</script>

<div class="stack">
  <section>
    <h3 class="group-title" id="export-types">{t('File type')}</h3>
    <div class="formats" role="group" aria-labelledby="export-types">
      {#each FORMATS as f}
        <button class="fmt" aria-pressed={store.doc.exportFormat === f.id} onclick={() => { store.doc.exportFormat = f.id; store.commit(); }}>
          <f.icon size={24} />
          <span><strong>{f.label}{#if preset.id !== 'custom' && preset.formats.includes(f.id)}<em>{t('{publisher} accepts', { publisher: preset.publisher })}</em>{/if}</strong><small>{t(f.note)}</small></span>
        </button>
      {/each}
    </div>
  </section>

  {#if isRaster}
    <section>
      <h3 class="group-title">{t('Resolution (dpi)')}</h3>
      <div class="seg" role="group" aria-label={t('Resolution (dpi)')}>
        {#each [300, 600, 1000, 1200] as dpi}
          <button aria-pressed={store.doc.exportDpi === dpi} onclick={() => { store.doc.exportDpi = dpi; dpiErr = false; store.commit(); }}>{dpi}</button>
        {/each}
      </div>
      <label class="field custom-dpi"><span>{t('Or type any value (72 to 2400)')}</span>
        <input class="input" type="number" min="72" max="2400" step="1" inputmode="numeric" value={store.doc.exportDpi}
          aria-invalid={dpiErr ? 'true' : undefined} aria-describedby={dpiErr ? 'dpi-err' : undefined}
          onchange={(e) => setDpi(e.target as HTMLInputElement)} />
      </label>
      {#if dpiErr}<p class="msg err" id="dpi-err" role="alert">{t('Use 72 to 2400 dpi.')}</p>{/if}
      <p class="hint">{t('{w} × {h} pixels.', { w: raster.w.toLocaleString(), h: raster.h.toLocaleString() })}{preset.id !== 'custom' ? ` ${t('{publisher} asks for at least {min} dpi.', { publisher: preset.publisher, min: preset.minDpi })}` : ''}</p>
    </section>
  {/if}

  <section>
    <label class="group-title" for="export-name">{t('File name')}</label>
    <!-- one field drawn as a row: the name takes the width that is left (and ends in … when it is long), the extension sits after it -->
    <div class="namebox" title="{fileName}.{ext}">
      <input id="export-name" value={ownName} placeholder={defaultName} spellcheck={false} autocomplete="off" aria-describedby="export-saved" oninput={(e) => { store.doc.exportName = (e.target as HTMLInputElement).value; store.doc.exportNameFor = store.doc.study.name; store.commit(); }} />
      <span class="suffix" aria-hidden="true">.{ext}</span>
    </div>
    <!-- the whole name, for screen readers: nothing is hidden in the narrow field -->
    <span class="sr-only" id="export-saved">{t('Saved as {file}', { file: `${fileName}.${ext}` })}</span>
  </section>

  {#if store.busy || problems.length || (isRaster && !raster.ok) || msg}
    <section class="status">
      {#if store.busy}<p class="msg" role="status">{t(store.busy)} {t('Wait for it to finish so the detail is in your file.')}</p>{/if}
      {#if problems.length}
        <div class="problems" role="alert">
          <strong>{t('Fix before submitting')}</strong>
          <ul>{#each problems as p}<li>{t(p.text)}{#if p.fix} <button class="btn small" onclick={() => { p.fix!.run(); store.commit(); }}>{t(p.fix.label)}</button>{/if}</li>{/each}</ul>
        </div>
      {/if}
      {#if isRaster && !raster.ok}
        <div class="toolarge" role="alert">
          <p class="msg err">{t('{dpi} dpi is too large for a browser to draw at this page size. Up to {max} dpi works.', { dpi: store.doc.exportDpi, max: maxDpi(store.doc.widthMm, store.doc.heightMm) })}</p>
          <button class="btn small" onclick={() => { store.doc.exportDpi = maxDpi(store.doc.widthMm, store.doc.heightMm); store.commit(); }}>{t('Use {max} dpi', { max: maxDpi(store.doc.widthMm, store.doc.heightMm) })}</button>
        </div>
      {/if}
      {#if msg}<p class="msg" class:err class:ok={!err}>{msg}</p>{/if}
    </section>
  {/if}
  <!-- what the Download button in the foot did, read out once it is done -->
  <span class="sr-only" role="status">{msg}</span>

  <section>
    <h3 class="group-title">{t('Figure caption')}</h3>
    <p class="caption">{caption}</p>
    <button class="btn small" onclick={copyCaption}>{copied ? t('Copied') : t('Copy caption')}</button>
    <span class="sr-only" role="status">{copied ? t('Caption copied') : ''}</span>
    {#if copyErr}<p class="msg err" role="alert">{copyErr}</p>{/if}
    <p class="hint">{t('Paste it under the figure in your paper. It carries the full data credits.')}</p>
  </section>

  <section>
    <h3 class="group-title">{t('Everything at once')}</h3>
    <button class="btn" disabled={zipping || notReady} onclick={goBundle}>{zipping ? t('Preparing the files…') : t('Download all as .zip')}</button>
    <p class="hint">{t('PDF, TIFF and SVG of the figure, the caption, and the project file to change it again later.')}</p>
  </section>

  <!-- the sentences a paper needs around the figure, folded away until wanted -->
  {#if store.studyFeatures.length}
    <details class="acc quiet">
      <summary>{t('Text for your paper')}</summary>
      <div class="acc-body"><PaperPack {main} {credits} /></div>
    </details>
  {/if}
</div>

<style>
  /* a ruled pick list: a hairline between rows; the chosen row is washed blue and ringed */
  .formats { display: grid; border-top: 1px solid var(--line); }
  .fmt {
    display: grid; grid-template-columns: 28px minmax(0, 1fr); column-gap: 12px; align-items: center; text-align: left;
    padding: 10px 8px; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; background: transparent; color: var(--ink-2);
  }
  .fmt span { display: grid; gap: 2px; min-width: 0; }
  .fmt strong { display: flex; gap: 8px; align-items: baseline; color: var(--ink); font-weight: 600; }
  /* what the journal takes, on the title line at the right */
  .fmt strong em { margin-left: auto; font-size: 11.5px; font-weight: 600; color: var(--ok); font-style: normal; }
  .fmt small { display: block; font-size: 12.5px; color: var(--ink-3); }
  .fmt:hover { background: var(--panel-2); }
  .fmt:focus-visible { outline-offset: -2px; }
  .fmt[aria-pressed='true'] { background: var(--accent-wash); box-shadow: inset 0 0 0 1.5px var(--accent); color: var(--ink); border-radius: var(--r-ctl); }
  /* the file name with its extension inside the field */
  .namebox {
    display: flex; align-items: center; gap: 2px; min-width: 0; min-height: 38px; padding: 0 10px;
    background: var(--panel); border: 1px solid var(--line-input); border-radius: var(--r-ctl);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .namebox:hover { border-color: var(--ink-3); }
  .namebox:focus-within { outline: 2px solid transparent; outline-offset: 2px; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
  .namebox input { flex: 1 1 auto; min-width: 0; padding: 8px 0; border: 0; border-radius: 0; background: transparent; font-size: 14px; text-overflow: ellipsis; outline: none; }
  .namebox input::placeholder { color: var(--ink-2); opacity: 1; }
  .suffix { flex: none; color: var(--ink-3); }
  @media (pointer: coarse) { .namebox { min-height: 44px; } .namebox input { font-size: 16px; } }
  .problems { padding: 12px 14px; border-radius: var(--r-card); background: var(--err-wash); color: var(--err); font-size: 12.5px; }
  .problems ul { margin: 6px 0 0; padding-left: 18px; }
  .caption { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0; padding: 10px 12px; border-radius: var(--r-ctl); background: var(--panel-2); font-size: 12.5px; line-height: 1.5; user-select: all; }
  section .btn { justify-self: start; }
  .toolarge { display: grid; gap: 6px; justify-items: start; }
</style>
