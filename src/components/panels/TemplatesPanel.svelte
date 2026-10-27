<script lang="ts">
  import { store } from '../../lib/store.svelte';
  import { t } from '../../lib/i18n.svelte';
  import { TEMPLATES, applyTemplate } from '../../lib/templates';

  import classic from '../../assets/templates/classic.png';
  import corner from '../../assets/templates/corner.png';
  import strip from '../../assets/templates/strip.png';
  import titled from '../../assets/templates/titled.png';
  import minimal from '../../assets/templates/minimal.png';
  import twin from '../../assets/templates/twin.png';
  import drill from '../../assets/templates/drill.png';
  import overview from '../../assets/templates/overview.png';
  import { zoomToLayer, fitToArea } from '../../lib/actions';
  import { findPreset } from '../../lib/journals';

  // Real renders of each layout, made with the app itself (Dhaka District).
  const THUMBS: Record<string, string> = { classic, corner, strip, titled, twin, minimal, drill, overview };
  const thumb = (id: string) => THUMBS[id];

  const mm = (v: number) => +v.toFixed(1);

  function pick(id: string) {
    const was = store.doc.templateId;
    const { widthMm: w0, heightMm: h0 } = store.doc;
    applyTemplate(store.doc, id);
    store.commit();
    // Country overview shows the whole country with the study areas marked in it.
    const countries = store.doc.layers.find((l) => l.kind === 'countries');
    if (id === 'overview' && countries) zoomToLayer(countries);
    else if (was === 'overview' && store.doc.view.extent) fitToArea();
    // A layout can change the page size; say so rather than doing it silently.
    const { widthMm: w, heightMm: h } = store.doc;
    if (w !== w0 || h !== h0) {
      const p = findPreset(store.doc.presetId);
      store.status = h > p.maxHeightMm
        ? t("Layout applied. Page is now {w} × {h} mm, taller than {publisher}'s {max} mm limit.", { w: mm(w), h: mm(h), publisher: p.publisher, max: p.maxHeightMm })
        : t('Layout applied. Page is now {w} × {h} mm.', { w: mm(w), h: mm(h) });
    }
  }
</script>

<div class="stack">
  <section>
    <div class="grid" role="group" aria-label={t('Page layouts')}>
      {#each TEMPLATES as tp}
        <button class="tpl" title={t(tp.note)} aria-pressed={store.doc.templateId === tp.id} onclick={() => pick(tp.id)}>
          <span class="img">
            {#if thumb(tp.id)}<img src={thumb(tp.id)} alt="" width="400" height="300" loading="lazy" decoding="async" />{/if}
          </span>
          <span class="name">{t(tp.name)}</span>
          <span class="sr-only">. {t(tp.note)}</span>
        </button>
      {/each}
    </div>
  </section>
</div>

<style>
  .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 10px; align-items: start; }
  .tpl { display: grid; gap: 0; align-content: start; text-align: left; border: 0; background: transparent; padding: 0; border-radius: var(--r-ctl); min-width: 0; }
  .img {
    aspect-ratio: 4 / 3; border-radius: var(--r-chip); overflow: hidden;
    background: var(--panel-2); border: 1px solid var(--line);
    display: grid; place-items: center;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .img img { width: 100%; height: 100%; object-fit: contain; background: #fff; display: block; }
  .tpl:hover .img { border-color: var(--line-strong); }
  .tpl:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
  /* chosen picture tile: a 2 px ruling-blue ring around the thumbnail */
  .tpl[aria-pressed='true'] .img { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
  .name { font-weight: 600; font-size: 12.5px; line-height: 1.3; margin-top: 6px; color: var(--ink-2); }
  .tpl[aria-pressed='true'] .name { color: var(--ink); }
</style>
