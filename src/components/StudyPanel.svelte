<script lang="ts">
  import { onMount } from 'svelte';
  import { store } from '../lib/store.svelte';
  import { availableLevels, countryList, featureName, loadBoundaries } from '../lib/data';
import { geoCentroid, geoContains } from 'd3-geo';
import { featureBBox, rewind } from '../lib/scene';
  import type { BoundaryMeta, CountryInfo } from '../lib/data';
  import { searchAdmin, warmCountry, homeCountry, kindName } from '../lib/adminsearch';
  import type { AdminHit } from '../lib/adminsearch';
  import { pickAdmin } from '../lib/actions';
  import { t } from '../lib/i18n.svelte';

  let countries = $state<CountryInfo[]>([]);
  let levels = $state<BoundaryMeta[]>([]);
  let levelsFor = $state('');
  let levelsLoading = $state(false);
  let query = $state('');
  let unitQuery = $state('');
  let showCountries = $state(false);

  onMount(async () => { countries = await countryList(); });

  $effect(() => {
    const iso = store.doc.study.iso;
    if (iso === levelsFor) return;
    levelsFor = iso;
    levels = [];
    levelsLoading = true;
    availableLevels(iso).then((l) => { if (store.doc.study.iso === iso) levels = l; }).finally(() => { if (store.doc.study.iso === iso) levelsLoading = false; });
  });

  // One box for everything: countries, and every division, district, upazila... of the current country.
  const iso = $derived(store.doc.study.iso || homeCountry());
  let namesReady = $state(0);
  $effect(() => { const i = iso; if (i) warmCountry(i, () => namesReady++); });
  type Match = { country?: CountryInfo; unit?: AdminHit; key: string; label: string; detail: string };
  const matches = $derived.by<Match[]>(() => {
    namesReady;
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const cs = countries.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 4).map((c) => ({ country: c, key: c.iso, label: c.name, detail: 'Country' }));
    const us = searchAdmin(q, iso, 8).map((u) => ({ unit: u, key: `${u.level}-${u.id}`, label: u.name, detail: u.kind }));
    return [...cs, ...us];
  });
  function choose(m: Match) {
    if (m.country) pickCountry(m.country);
    else if (m.unit) { pickAdmin(m.unit, true); query = ''; showCountries = false; }
  }
  let active = $state(0);
  const open = $derived(showCountries && matches.length > 0);
  function onComboKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); showCountries = true; active = Math.min(matches.length - 1, active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); }
    else if (e.key === 'Enter' && matches[active]) { e.preventDefault(); choose(matches[active]); }
    else if (e.key === 'Escape') { showCountries = false; }
  }

  // Parent unit names (e.g. the district of each sub-district), so units with the same name can be told apart.
  let parents = $state.raw<Record<string, string>>({});
  let parentsKey = '';
  $effect(() => {
    const fc = store.adminFc;
    const lvl = store.doc.study.level;
    const parentMeta = levels.find((l) => l.level === lvl - 1);
    const key = `${store.doc.study.iso}:${lvl}:${fc?.features.length}:${!!parentMeta}`;
    if (!fc || lvl < 2 || !parentMeta || key === parentsKey) return;
    parentsKey = key;
    parents = {};
    loadBoundaries(parentMeta).then((pfc) => {
      rewind(pfc);
      const out: Record<string, string> = {};
      for (const f of fc.features) {
        const c = geoCentroid(f as any);
        const hit = pfc.features.find((p) => {
          const b = featureBBox(p);
          return c[0] >= b[0][0] && c[0] <= b[1][0] && c[1] >= b[0][1] && c[1] <= b[1][1] && geoContains(p as any, c);
        });
        if (hit) out[String(f.properties?.__id)] = featureName(hit);
      }
      if (parentsKey === key) parents = out;
    }).catch(() => {});
  });

  const units = $derived.by(() => {
    const fc = store.adminFc;
    if (!fc || store.doc.study.level === 0) return [];
    const q = unitQuery.trim().toLowerCase();
    return fc.features
      .map((f) => ({ id: String(f.properties?.__id), name: featureName(f), parent: parents[String(f.properties?.__id)] ?? '' }))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.parent.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  const vectorLayers = $derived(store.doc.layers.filter((l) => l.kind === 'vector' && store.geoms[l.id]));

  function pickCountry(c: CountryInfo) {
    const s = store.doc.study;
    s.iso = c.iso;
    s.countryName = c.name;
    s.source = 'admin';
    s.name = c.name;
    s.highlight = true;
    s.level = 0;
    s.unitIds = [];
    s.unitNames = [];
    s.fromLayer = undefined;
    store.doc.crs = null;
    store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
    query = '';
    showCountries = false;
    store.commit();
  }

  function setLevel(l: number) {
    const s = store.doc.study;
    s.level = l;
    s.source = 'admin';
    s.name = s.countryName;
    s.unitIds = [];
    s.unitNames = [];
    s.fromLayer = undefined;
    store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
    store.commit();
  }

  function toggleUnit(id: string, name: string) {
    const s = store.doc.study;
    const i = s.unitIds.indexOf(id);
    if (i >= 0) { s.unitIds.splice(i, 1); s.unitNames.splice(s.unitNames.indexOf(name), 1); }
    else { s.unitIds.push(id); s.unitNames.push(name); }
    s.source = 'admin';
    s.name = s.unitNames.join(', ') || s.countryName;
    if (!store.doc.title || store.doc.title === 'Untitled map' || store.doc.title.endsWith(' study area')) store.doc.title = `${s.name} study area`;
    store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
    store.commit();
  }

  function useLayer(id: string) {
    store.doc.study.fromLayer = id || undefined;
    store.doc.study.source = id ? 'layer' : 'admin';
    store.doc.view = { ...store.doc.view, panX: 0, panY: 0, zoom: 1 };
    store.commit();
  }
</script>

<section class="block">
  <h3 class="group-title">{t('Find an official boundary')}</h3>
  <div class="combo">
    <input
      class="input"
      type="search"
      role="combobox"
      placeholder={t('Country, division, district, upazila…')}
      aria-label={t('Search official boundaries')}
      aria-expanded={open}
      aria-controls="country-list"
      aria-autocomplete="list"
      aria-activedescendant={open && matches[active] ? `country-${matches[active].key}` : undefined}
      autocomplete="off"
      spellcheck={false}
      bind:value={query}
      onfocus={() => (showCountries = true)}
      onblur={() => setTimeout(() => (showCountries = false), 120)}
      oninput={() => { showCountries = true; active = 0; }}
      onkeydown={onComboKey}
    />
    <ul class="list" id="country-list" role="listbox" aria-label={t('Matching boundaries')} hidden={!open}>
      {#each matches as c, i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li id="country-{c.key}" role="option" aria-selected={i === active} class:active={i === active} onmousedown={(e) => e.preventDefault()} onclick={() => choose(c)}><span>{c.label}</span><small>{t(c.detail)}</small></li>
      {/each}
    </ul>
  </div>
  <p class="hint">{t('Type a name and pick it. The level is found for you. Pick more names of the same kind to add them.')}{#if store.doc.study.countryName}{" "}{@const parts = t("Searching in {country}; type another country's name to switch.", { country: '\n' }).split('\n')}{parts[0]}<strong>{store.doc.study.countryName}</strong>{parts[1]}{/if}</p>
</section>

<section class="block">
  <h3 class="group-title">{t('Or show a whole level')}</h3>
  <div class="levels" role="group" aria-label={t('Administrative level')}>
    <button aria-pressed={store.doc.study.level === 0 && !store.doc.study.fromLayer} onclick={() => setLevel(0)}>{t('Whole country')}</button>
    {#each levels as l}
      <button aria-pressed={store.doc.study.level === l.level && !store.doc.study.fromLayer} onclick={() => setLevel(l.level)}>
        <span>{t(kindName(l.canonical, l.level))}</span><small>{t('{n} units', { n: l.count.toLocaleString() })}</small>
      </button>
    {/each}
  </div>
  {#if levelsLoading}<p class="hint" role="status">{t('Loading levels…')}</p>{:else if !levels.length && levelsFor}<p class="hint" role="status">{t('No official sub-national boundaries are listed for this country.')}</p>{/if}
</section>

{#if store.doc.study.source === 'admin' && store.doc.study.level > 0}
  <section class="block">
    <h3 class="group-title">{t('Pick one or more units')}</h3>
    <input class="input" type="search" placeholder={t('Search units…')} aria-label={t('Search units')} spellcheck={false} bind:value={unitQuery} />
    <div class="units" role="group" aria-label={t('Units')}>
      {#if !store.adminFc}
        <p class="hint">{t('Loading boundaries…')}</p>
      {:else}
        {#each units.slice(0, 300) as u (u.id)}
          <label class="check"><input type="checkbox" checked={store.doc.study.unitIds.includes(u.id)} onchange={() => toggleUnit(u.id, u.name)} /> {u.name}{#if u.parent}<small class="parent">{u.parent}</small>{/if}</label>
        {/each}
        {#if units.length > 300}<p class="hint">{t('Showing 300 of {n}. Search to narrow the list.', { n: units.length.toLocaleString() })}</p>{/if}
        {#if !units.length}<p class="hint">{t('No unit matches “{q}”.', { q: unitQuery })}</p>{/if}
      {/if}
    </div>
    {#if store.doc.study.unitNames.length}
      <p class="hint">{t('Selected: {names}', { names: store.doc.study.unitNames.join(', ') })}</p>
    {:else}
      <p class="hint warn">{t('Nothing selected, so the whole country is shown.')}</p>
    {/if}
  </section>
{/if}



<style>
  .block { display: grid; gap: 8px; }
  .combo { position: relative; }
  .list { max-height: 320px; overflow: auto; position: absolute; z-index: 10; left: 0; right: 0; top: 38px; margin: 0; padding: 4px; list-style: none; background: #fff; border-radius: var(--r-ctl); box-shadow: var(--shadow-2), 0 0 0 1px var(--line); }
  .list li { display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-radius: var(--r-chip); cursor: pointer; }
  .list li small { color: var(--ink-3); font-size: 11.5px; }
  .list li:hover, .list li.active { background: var(--accent-wash); }
  .hint { margin: 0; font-size: 12.5px; color: var(--ink-3); }
  .hint.warn { color: var(--warn); }
  .levels { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .levels button span { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .levels button { display: grid; text-align: left; gap: 1px; padding: 8px 10px; border: 1px solid var(--line-strong); border-radius: var(--r-ctl); background: #fff; font-weight: 500; text-transform: capitalize; }
  .levels button small { font-size: 11.5px; color: var(--ink-3); text-transform: none; font-weight: 400; }
  .levels button:hover { border-color: var(--ink-3); }
  .levels button[aria-pressed='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); background: var(--accent-wash); }
  .parent { margin-left: auto; color: var(--ink-3); font-size: 11.5px; }
  .units :global(.check) { width: 100%; min-height: 28px; }
  .units { max-height: 220px; overflow: auto; display: grid; gap: 4px; padding: 6px 8px; border: 1px solid var(--line); border-radius: var(--r-ctl); background: #fff; }
</style>
