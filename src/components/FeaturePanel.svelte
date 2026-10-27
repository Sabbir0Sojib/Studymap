<script lang="ts">
  // One feature picked on the map (an area, a line, a point or a name): its own colours, its name and whether it
  // shows, above its layer's settings, so anything on the map can be changed by clicking it.
  import X from 'phosphor-svelte/lib/X';
  import { store } from '../lib/store.svelte';
  import type { FeatureStyle } from '../lib/store.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import { resolveChoro } from '../lib/classify';
  import { t } from '../lib/i18n.svelte';

  const COLOURS: [string, string][] = [['#D55E00', 'vermillion'], ['#0072B2', 'blue'], ['#009E73', 'bluish green'], ['#E69F00', 'orange'], ['#56B4E9', 'sky blue'], ['#CC79A7', 'reddish purple'], ['#1B1F1D', 'black']];
  const c = () => store.commit();

  const p = $derived(store.picked);
  const layer = $derived(p ? store.doc.layers.find((l) => l.id === p.layerId) : undefined);
  const fs = $derived<FeatureStyle>((p && layer?.featureStyle?.[p.name]) || {});
  const word = $derived(p ? ({ area: 'area', line: 'line', point: 'point', label: 'name' } as const)[p.what] : 'area');
  /** the same word with a capital, as the key of its translation (Area, Line, Point, Name) */
  const cap = $derived(word[0].toUpperCase() + word.slice(1));
  /** a shape drawn by hand is picked by its place in its layer (#0, #1…) until it has a name */
  const anon = $derived(!!p && p.name.startsWith('#'));
  const drawnFc = $derived(p && layer?.custom ? store.geoms[p.layerId] : undefined);
  const fi = $derived.by(() => {
    if (!p || !drawnFc) return -1;
    if (anon) { const n = Number(p.name.slice(1)); return n < drawnFc.features.length ? n : -1; }
    return drawnFc.features.findIndex((f) => String(f.properties?.name ?? '') === p.name);
  });
  const shapeName = $derived(fi >= 0 && drawnFc ? String(drawnFc.features[fi].properties?.name ?? '') : '');
  const shown = $derived(p && layer ? (anon ? shapeName : layer.labelText?.[p.name] ?? p.name) : '');
  // a drawn shape is named in its own Name field below (that writes the shape's name); the printed text of other layers' names is changed here
  /** the colour a colour-by-value map gives this area, so the picker starts from what is on the map */
  const choroFill = $derived.by(() => {
    if (!p || !layer?.choro || p.what !== 'area') return undefined;
    const fc = layer.kind === 'subunits' ? store.subFc : layer.adminLevel ? store.adminLevels[layer.adminLevel] : store.adminFc;
    const names = fc ? fc.features.map((f) => String(f.properties?.name ?? f.properties?.__name ?? '')).filter(Boolean) : [];
    return resolveChoro(layer.choro, names).colours.get(p.name);
  });
  const named = $derived(!!layer && !layer.custom && (!!layer.style.labelField || p?.what === 'label'));
  const nameHidden = $derived(!!p && layer?.labelText?.[p.name] === '');
  /** Give a drawn shape a name (properties.name): the names of the layer are then printed on the map. */
  function nameShape(v: string) {
    if (!p || !layer || !drawnFc || fi < 0) return;
    const next = v.trim();
    const old = p.name;
    const feats = drawnFc.features.map((f, i) => (i === fi ? { ...f, properties: { ...(f.properties ?? {}), name: next } } : f));
    store.geoms = { ...store.geoms, [layer.id]: { ...drawnFc, features: feats } };
    const key = next || `#${fi}`;
    // the shape's own look and moved name follow it to its new key
    if (key !== old) {
      for (const field of ['featureStyle', 'labelText'] as const) {
        const m = layer[field] as Record<string, unknown> | undefined;
        if (m && old in m) { const copy = { ...m }; copy[key] = copy[old]; delete copy[old]; (layer as unknown as Record<string, unknown>)[field] = copy; }
      }
      store.picked = { ...p, name: key };
    }
    if (next && !layer.style.labelField) layer.style.labelField = 'name';
    c();
    store.autosave(); // the shapes live outside the document, so save them now
  }

  /** Change this feature's own look; a setting back to the layer's is dropped, so an untouched feature stores nothing. */
  function set(patch: Partial<FeatureStyle>) {
    if (!p || !layer) return;
    const all = { ...(layer.featureStyle ?? {}) };
    const next: FeatureStyle = { ...(all[p.name] ?? {}), ...patch };
    for (const k of Object.keys(next) as (keyof FeatureStyle)[]) if (next[k] === undefined || (k === 'hidden' && next[k] === false)) delete next[k];
    if (Object.keys(next).length) all[p.name] = next;
    else delete all[p.name];
    layer.featureStyle = all;
    c();
  }
  /** The name printed on the map ('' hides it); back to the original when it matches again. */
  function rename(v: string | null) {
    if (!p || !layer) return;
    const texts = { ...(layer.labelText ?? {}) };
    if (v === null || v === p.name) delete texts[p.name];
    else texts[p.name] = v;
    layer.labelText = texts;
    c();
  }
</script>

{#if p && layer}
  <section class="feature" aria-label={t('This {word}', { word: t(word) })}>
    <div class="fhead">
      <div class="who">
        <h3 class="group-title">{anon ? (shapeName || t('{word} {n}', { word: t(cap), n: fi + 1 })) : shown || p.name || t('This {word}', { word: t(word) })}</h3>
        <small>{t('{what} in {layer}', { what: t(cap), layer: layer.name })}</small>
      </div>
      <button class="close" onclick={() => (store.picked = null)} aria-label={t('Back to the whole layer')} title={t('Back to the whole layer')}><X size={16} /></button>
    </div>

    {#if p.what !== 'label'}
      {#if p.what !== 'line'}
        <div class="field">
          <span class="lbl">{t('Fill')} {#if fs.fill}<button class="link" onclick={() => set({ fill: undefined })}>{t('Same as the layer')}</button>{/if}</span>
          <div class="colours" role="group" aria-label={t('Fill colour of this {word}', { word: t(word) })}>
            {#each COLOURS as [col, name]}<button class="dot" class:on={fs.fill === col} style="background:{col}" aria-label={t('Fill with {name}', { name: t(name) })} aria-pressed={fs.fill === col} onclick={() => set({ fill: col })}></button>{/each}
            <ColorPicker value={fs.fill ?? choroFill ?? layer.style.fill} label={t('Any fill colour')} size={28} onchange={(v) => set({ fill: v })} />
          </div>
        </div>
      {/if}
      <div class="field">
        <span class="lbl">{p.what === 'line' ? t('Colour') : t('Outline')} {#if fs.stroke}<button class="link" onclick={() => set({ stroke: undefined })}>{t('Same as the layer')}</button>{/if}</span>
        <div class="colours" role="group" aria-label={t('{what} of this {word}', { what: p.what === 'line' ? t('Colour') : t('Outline colour'), word: t(word) })}>
          {#each COLOURS as [col, name]}<button class="dot" class:on={fs.stroke === col} style="background:{col}" aria-label={t('{what} {name}', { what: p.what === 'line' ? t('Colour') : t('Outline'), name: t(name) })} aria-pressed={fs.stroke === col} onclick={() => set({ stroke: col })}></button>{/each}
          <ColorPicker value={fs.stroke ?? layer.style.stroke} label={t('Any outline colour')} size={28} onchange={(v) => set({ stroke: v })} />
        </div>
      </div>
      <label class="row-switch"><span>{t('Show this {word}', { word: t(word) })}</span><input type="checkbox" role="switch" checked={!fs.hidden} onchange={() => set({ hidden: !fs.hidden })} /></label>
    {/if}

    {#if fi >= 0}
      <label class="field"><span>{t('Name')}</span>
        <input class="input" type="text" value={shapeName} placeholder={t('e.g. Pond A')} onchange={(e) => nameShape((e.target as HTMLInputElement).value)} />
      </label>
      <p class="hint">{t('A name is printed on the map beside this {word} (turn names off in "Names on the map").', { word: t(word) })}</p>
    {/if}
    {#if named}
      <label class="field"><span>{t('Name on the map')}</span>
        <input class="input" type="text" value={nameHidden ? p.name : shown} disabled={nameHidden} onchange={(e) => rename((e.target as HTMLInputElement).value)} />
      </label>
      <label class="row-switch"><span>{t('Show the name')}</span><input type="checkbox" role="switch" checked={!nameHidden} onchange={() => rename(nameHidden ? null : '')} /></label>
      {#if !nameHidden}
        {#if fs.labelDx || fs.labelDy}
          <label class="row-switch"><span>{t('Line from the name to its place')}</span><input type="checkbox" role="switch" checked={fs.leader !== false} onchange={() => set({ leader: fs.leader === false ? undefined : false })} /></label>
          <button class="btn" onclick={() => set({ labelDx: undefined, labelDy: undefined, leader: undefined })}>{t('Put the name back in its place')}</button>
        {:else}
          <p class="hint">{t('Drag the name on the map to move it.')}</p>
        {/if}
      {/if}
    {/if}
  </section>
{/if}

<style>
  .feature { display: grid; gap: 10px; padding: 12px; margin: 0 0 4px; border: 1px solid var(--accent); border-radius: 10px; background: var(--accent-wash); }
  .fhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
  .who { min-width: 0; }
  .who .group-title { margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .who small { font-size: 12.5px; color: var(--ink-3); }
  .close { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 8px; color: var(--ink-2); flex: none; }
  .close:hover { background: var(--panel); color: var(--ink); }
  .lbl { display: flex; justify-content: space-between; align-items: baseline; font-size: 12.5px; color: var(--ink-2); margin-bottom: 6px; }
  .link { font-size: 12.5px; color: var(--accent-ink); text-decoration: underline; text-underline-offset: 2px; padding: 0; }
  .colours { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .dot { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  .dot:hover { box-shadow: 0 0 0 2px var(--ink-2); }
  .dot.on { box-shadow: 0 0 0 2px var(--accent); }
  @media (pointer: coarse) { .close { width: 44px; height: 44px; } }
</style>
