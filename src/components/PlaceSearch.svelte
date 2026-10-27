<script lang="ts">
  // Search any place on Earth. Used in the Place panel and on the empty page.
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
  import X from 'phosphor-svelte/lib/X';
  import { suggest, EXAMPLES } from '../lib/place';
  import type { PlaceHit } from '../lib/place';
  import { choosePlace, pickAdmin, addArea } from '../lib/actions';
  import { store } from '../lib/store.svelte';
  import { t } from '../lib/i18n.svelte';
  import { searchAdmin, warmCountry, homeCountry, explainRepeats, kindName } from '../lib/adminsearch';
  import type { AdminHit } from '../lib/adminsearch';
  import { availableLevels, countryList, featureName, loadBoundaries, loadCountriesLow } from '../lib/data';
  import { featureBBox } from '../lib/scene';
  import { geoArea, geoCentroid, geoContains } from 'd3-geo';
  import type { Feature } from 'geojson';

  // onpick: told after the person has chosen an area (not when they add a unit to the map)
  // adding: a pick is added to the areas already on the map instead of replacing them
  let { big = false, autofocus = false, showExamples = true, adding = false, onpick }: { big?: boolean; autofocus?: boolean; showExamples?: boolean; adding?: boolean; onpick?: () => void } = $props();

  // places chosen before, newest first, kept in this browser (one click brings their results back)
  const RECENT_KEY = 'studymap.recentPlaces';
  function readRecent(): string[] {
    try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : []; } catch { return []; }
  }
  let recent = $state<string[]>(readRecent());
  function remember(name: string) {
    recent = [name, ...recent.filter((x) => x.toLowerCase() !== name.toLowerCase())].slice(0, 6);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); } catch { /* kept for this visit */ }
  }
  const rowName = (r: { admin?: AdminHit; place?: PlaceHit }) => (r.admin ? (r.admin.name.toLowerCase().includes(r.admin.kind.toLowerCase()) ? r.admin.name : `${r.admin.name} ${r.admin.kind}`) : r.place?.name ?? '');
  let q = $state('');
  let field: HTMLInputElement | undefined;
  let hits = $state<PlaceHit[]>([]);
  let active = $state(0);
  let open = $state(false);
  let loading = $state(false);
  // the free search service is sometimes slow: after a few seconds, say so instead of a silent spinner
  let slow = $state(false);
  let error = $state('');
  let notFound = $state(''); // the text that gave no results at all
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listId = `places-${Math.random().toString(36).slice(2, 8)}`;

  // Official boundaries answer instantly for the map's (or the user's) country; countries that the world-wide
  // results point to are loaded too, so "Kathmandu" also offers Kathmandu District, Nepal.
  const iso = $derived(store.doc.study.iso || homeCountry());
  let namesReady = $state(0);
  let extraIsos = $state<string[]>([]);
  const isos = $derived([...new Set([iso, ...extraIsos].filter(Boolean))]);
  let admin = $derived.by(() => {
    namesReady;
    const all = isos.flatMap((i, n) => searchAdmin(q, i, 5).map((h) => ({ h, n })));
    // exact names first, then the home country first
    const qq = q.trim().toLowerCase();
    all.sort((a, b) => Number(b.h.name.toLowerCase() === qq) - Number(a.h.name.toLowerCase() === qq) || (a.h.score ?? 0) - (b.h.score ?? 0) || a.n - b.n);
    return explainRepeats(all.slice(0, 5).map((x) => x.h));
  });
  $effect(() => { for (const i of isos) warmCountry(i, () => namesReady++, i === iso ? 4 : 2); });
  type Row = { admin?: AdminHit; place?: PlaceHit };
  // Official boundaries come first, then every other place; the list shows a small heading over each group.
  const rows = $derived<Row[]>([...admin.map((a) => ({ admin: a })), ...hits.map((p) => ({ place: p }))]);
  const adminRows = $derived(rows.slice(0, admin.length));
  const placeRows = $derived(rows.slice(admin.length));
  // shown only while nothing is listed, so it goes away if official boundaries turn up a moment later
  const emptyMsg = $derived(notFound && !rows.length && !loading ? t('Nothing found for “{q}”. Try a nearby city or the district name.', { q: notFound }) : '');
  let names = $state<Record<string, string>>({});
  countryList().then((l) => (names = Object.fromEntries(l.map((c) => [c.iso, c.name])))).catch(() => {});
  // the country goes once in the group heading when every boundary is from the same one; otherwise each row names its own
  const adminIsos = $derived([...new Set(admin.map((a) => a.iso))]);
  const adminHead = $derived(adminIsos.length === 1 && names[adminIsos[0]] ? t('Official boundaries in {country}', { country: names[adminIsos[0]] }) : t('Official boundaries'));

  // "in Dhaka Division": the unit one level up that holds each official boundary. The search only names it when two results share a name,
  // so it is found here (the coarser level is already downloaded) and remembered; a boundary with none shows no second line.
  const parents = new Map<string, string>();
  let parentsReady = $state(0);
  const parentOf = (a: AdminHit) => { parentsReady; return parents.get(`${a.iso}:${a.level}:${a.id}`) || ''; };
  function holds(f: Feature, c: [number, number]): boolean {
    const b = featureBBox(f);
    if (c[0] < b[0][0] || c[0] > b[1][0] || c[1] < b[0][1] || c[1] > b[1][1]) return false;
    try { return geoContains(f as any, c) !== geoArea(f as any) > 2 * Math.PI; } catch { return false; } // some files wind their rings the other way
  }
  function findParent(a: AdminHit) {
    const key = `${a.iso}:${a.level}:${a.id}`;
    if (a.level < 2 || !a.feat || parents.has(key)) return;
    parents.set(key, '');
    // a point of the unit itself: the mean of its largest outer ring, whichever way the ring is wound
    const g: any = a.feat.geometry;
    const ring: [number, number][] = g?.type === 'Polygon' ? g.coordinates[0] : g?.type === 'MultiPolygon' ? g.coordinates.reduce((m: any, q: any) => (q[0].length > m.length ? q[0] : m), []) : [];
    if (!ring.length) return;
    const c: [number, number] = [ring.reduce((t, q) => t + q[0], 0) / ring.length, ring.reduce((t, q) => t + q[1], 0) / ring.length];
    availableLevels(a.iso)
      .then(async (ls) => {
        const meta = ls.find((l) => l.level === a.level - 1);
        const up = meta ? (await loadBoundaries(meta)).features.find((f) => holds(f as Feature, c)) : null;
        if (!meta || !up) return;
        const name = featureName(up), kind = kindName(meta.canonical, meta.level);
        parents.set(key, name.toLowerCase().includes(kind.toLowerCase()) ? name : `${name} ${kind}`);
        parentsReady++;
      })
      .catch(() => {});
  }
  $effect(() => { for (const a of admin) findParent(a); });

  // Where to bias the world-wide search: the current area, else the user's own country.
  let homeCentre: [number, number] | null = null;
  loadCountriesLow().then((fc) => { const f = fc.features.find((x) => x.properties?.iso === homeCountry()); if (f) homeCentre = geoCentroid(f as any) as [number, number]; }).catch(() => {});
  function near(): [number, number] | null {
    const f = store.studyFeatures.filter((x) => x.geometry);
    if (f.length) return geoCentroid({ type: 'FeatureCollection', features: f } as any) as [number, number];
    return homeCentre;
  }

  // Start over empties the search box too
  let prevSource = store.doc.study.source;
  $effect(() => { const s = store.doc.study.source; if (s === 'none' && prevSource !== 'none') { q = ''; hits = []; open = false; } prevSource = s; });

  let seq = 0; // answers that arrive after a newer search, or after a pick, are dropped
  function search(text: string) {
    clearTimeout(timer);
    const my = ++seq;
    error = '';
    notFound = '';
    if (text.trim().length < 2) { hits = []; open = false; return; }
    open = true;
    active = 0;
    timer = setTimeout(async () => {
      loading = true;
      slow = false;
      const slowTimer = setTimeout(() => { if (my === seq) slow = true; }, 6000);
      // results of the previous words are cleared if the new ones take a moment, so nobody picks Paris while Lake Victoria loads
      const staleTimer = setTimeout(() => { if (my === seq) hits = []; }, 700);
      try {
        const got = await suggest(text.trim(), near());
        if (my !== seq) return;
        hits = got;
        // official boundaries of the countries these places are in
        const at = (globalThis as any).__countryAt as ((lon: number, lat: number) => { iso: string } | null) | undefined;
        const found = [...new Set(got.slice(0, 4).map((h) => at?.(h.center[0], h.center[1])?.iso).filter((x): x is string => !!x))].slice(0, 2);
        if (found.some((f) => !extraIsos.includes(f))) extraIsos = [...new Set([...found, ...extraIsos])].slice(0, 4);
        open = true;
        if (!hits.length && !admin.length) notFound = text.trim();
      } catch (e) {
        // a network failure would otherwise show the browser's own words ("Failed to fetch")
        const msg = (e as Error).message ?? '';
        if (my === seq && (e as Error).name !== 'AbortError') error = msg === t('Place search is not responding. Try again in a moment.') ? msg : t('We could not reach the place search. Check your internet connection and try again.');
      } finally {
        clearTimeout(slowTimer);
        clearTimeout(staleTimer);
        if (my === seq) slow = false;
        loading = false;
      }
    }, 200);
  }

  // "Add to map" keeps the area on the map and adds this row next to it. Rows that are already part of the map do not offer it.
  function canAdd(r: Row | undefined): boolean {
    if (!r || adding) return false;
    const st = store.doc.study;
    if (st.source === 'none') return false;
    return r.admin ? !st.unitIds.includes(r.admin.id) : !!r.place;
  }
  function addRow(r: Row) {
    open = false; seq++; remember(rowName(r)); addArea(r); q = '';
  }
  // spoken for screen readers when the list changes
  const countMsg = $derived(open && !loading && q.trim().length >= 2 ? (rows.length ? (rows.length === 1 ? t('{n} place found', { n: rows.length }) : t('{n} places found', { n: rows.length })) : notFound ? t('No places found') : '') : '');
  const canAddActive = $derived(open && rows.length > 0 && canAdd(rows[active]));

  async function pick(r: Row) {
    seq++;
    clearTimeout(timer);
    loading = false;
    open = false;
    remember(rowName(r));
    if (adding) { q = ''; await addArea(r); onpick?.(); return; }
    if (r.admin) { q = r.admin.name; await pickAdmin(r.admin); onpick?.(); return; }
    if (r.place) { q = r.place.name; await choosePlace(r.place); onpick?.(); }
  }

  // the × button: empty the box and put the cursor back in it
  function clear() {
    seq++;
    clearTimeout(timer);
    q = ''; hits = []; error = ''; notFound = ''; loading = false; open = false;
    field?.focus();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); open = true; active = Math.min(rows.length - 1, active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); }
    else if (e.key === 'Enter' && e.shiftKey && open && canAdd(rows[active])) { e.preventDefault(); addRow(rows[active]); }
    else if (e.key === 'Enter' && rows[active]) { e.preventDefault(); pick(rows[active]); }
    else if (e.key === 'Escape') open = false;
  }
</script>

<div class="search" class:big>
  <div class="box">
    <MagnifyingGlass size={big ? 20 : 18} />
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="search"
      role="combobox"
      aria-expanded={open && rows.length > 0}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
      aria-label={t('Search for a place')}
      aria-describedby="{listId}-hint"
      placeholder={t('City, district, park, lake…')}
      autocomplete="off"
      spellcheck={false}
      {autofocus}
      bind:this={field}
      bind:value={q}
      oninput={() => search(q)}
      onkeydown={onKey}
      onfocus={() => { if (rows.length) open = true; }}
      onblur={() => setTimeout(() => (open = false), 150)}
    />
    {#if loading}<span class="spin" aria-hidden="true"></span>{/if}
    {#if q}
      <button type="button" class="clear" aria-label={t('Clear search')} onmousedown={(e) => e.preventDefault()} onclick={clear}><X size={14} weight="bold" /></button>
    {/if}
  </div>
  <ul class="results" id={listId} role="listbox" aria-label={t('Places')} hidden={!open || !rows.length}>
    {#if adminRows.length}
      <li role="presentation" class="group">
        <ul role="group" aria-labelledby="{listId}-h-admin">
          <li role="presentation" class="heading" id="{listId}-h-admin">{adminHead}</li>
          {#each adminRows as r, i}{@render option(r, i)}{/each}
        </ul>
      </li>
    {/if}
    {#if placeRows.length}
      <li role="presentation" class="group">
        <ul role="group" aria-labelledby="{listId}-h-places">
          <li role="presentation" class="heading" id="{listId}-h-places">{t('Other places')}</li>
          {#each placeRows as r, i}{@render option(r, adminRows.length + i)}{/each}
        </ul>
      </li>
    {/if}
  </ul>
  <span class="sr-only" id="{listId}-hint">{t('Use the up and down arrow keys to choose a place, then Enter.')}{canAddActive ? ' ' + t('Shift and Enter adds the chosen place to the map next to your area.') : ''}</span>
  <p class="sr-only" aria-live="polite">{countMsg}</p>
  {#if slow && loading}<p class="hint" role="status">{t('The place search is slow right now. Official districts and divisions appear at once; other places can take up to a minute.')}</p>{/if}
  {#if error}<p class="msg err" role="alert">{error}</p>{/if}
  <!-- nothing found is not a fault: a quiet hint, not an error -->
  {#if !error && emptyMsg}<p class="hint" role="status">{emptyMsg}</p>{/if}
  {#if recent.length && !q}
    <div class="examples recent" role="group" aria-label={t('Recent places')}>
      <span class="try">{t('Recent')}</span>
      {#each recent as name}
        <button onclick={() => { q = name; search(name); }}>{name}</button>
      {/each}
    </div>
  {/if}
  {#if showExamples && !q}
    <div class="examples" role="group" aria-label={t('Examples')}>
      <span class="try">{t('Try')}</span>
      {#each EXAMPLES as ex}
        <button onclick={() => { q = ex; search(ex); }}>{ex}</button>
      {/each}
    </div>
  {/if}
</div>

{#snippet option(r: Row, i: number)}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <li id="{listId}-{i}" role="option" aria-selected={i === active} class:active={i === active} class:official={!!r.admin} onmousedown={(e) => e.preventDefault()} onclick={() => pick(r)}>
    {#if r.admin}
      {@const st = store.doc.study}
      {#if !adding && st.source !== 'none' && !st.unitIds.includes(r.admin.id)}
        <button class="add" onmousedown={(e) => e.preventDefault()} onclick={(e) => { e.stopPropagation(); addRow(r); }} title={t('Keep the area you have and add this one (Shift+Enter)')}>{t('Add to map')}</button>
      {/if}
      {@const up = parentOf(r.admin)}
      {@const detail = [up ? t('in {name}', { name: up }) : '', adminIsos.length > 1 ? names[r.admin.iso] ?? '' : ''].filter(Boolean).join(', ')}
      <span class="name">{r.admin.name} <span class="tag">{t(r.admin.kind)}</span></span>
      {#if detail}<span class="detail">{detail}</span>{/if}
    {:else if r.place}
      {#if !adding && store.doc.study.source !== 'none'}
        <button class="add" onmousedown={(e) => e.preventDefault()} onclick={(e) => { e.stopPropagation(); addRow(r); }} title={t('Keep the area you have and add this one (Shift+Enter)')}>{t('Add to map')}</button>
      {/if}
      <span class="name">{r.place.name}</span>
      <span class="detail">{t(r.place.kind)}{r.place.detail ? `, ${r.place.detail}` : ''}</span>
    {/if}
  </li>
{/snippet}

<style>
  .search { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
  .box {
    display: flex; align-items: center; gap: 10px; min-width: 0;
    height: 44px; padding: 0 12px;
    background: var(--panel); border: 1px solid var(--line-input); border-radius: var(--r-card);
    color: var(--ink-3);
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .big .box { height: 54px; padding: 0 16px; border-radius: var(--r-panel); box-shadow: var(--shadow-1); }
  .box:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); color: var(--ink-2); }
  input { flex: 1; min-width: 0; width: 0; border: 0; outline: none; background: transparent; font-size: 16px; color: var(--ink); }
  .big input { font-size: 16px; }
  /* the browser's own × has no accessible name, so it is replaced by .clear */
  input::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; display: none; }
  .clear { flex: none; display: grid; place-items: center; width: 24px; height: 24px; margin-right: -4px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--ink-3); }
  .clear:hover { background: var(--panel-2); color: var(--ink); }
  @media (pointer: coarse) { .clear { width: 44px; height: 44px; margin-right: -14px; } }
  .spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--line-strong); border-top-color: var(--accent); animation: spin 700ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .results {
    position: absolute; z-index: 40; left: 0; right: 0; top: calc(100% - 4px);
    margin: 0; padding: 6px; list-style: none;
    background: var(--panel); border-radius: var(--r-panel);
    box-shadow: var(--shadow-2), 0 0 0 1px var(--line);
    max-height: 320px; overflow: auto;
  }
  .big .results { top: 60px; }
  .results ul { margin: 0; padding: 0; list-style: none; }
  .group + .group { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--line); }
  .heading { padding: 6px 10px 3px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; color: var(--ink-3); }
  .results li[role='option'] { position: relative; display: grid; gap: 1px; padding: 9px 10px; border-radius: var(--r-ctl); cursor: pointer; }
  .add { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); height: 28px; padding: 0 10px; border: 1px solid var(--accent); border-radius: var(--r-chip); background: var(--panel); color: var(--accent); font-size: 12.5px; font-weight: 600; }
  .add:hover { background: var(--accent-wash); color: var(--accent-ink); }
  /* the button sits over the right end of the row, so the words keep clear of it */
  .results li[role='option']:has(.add) { padding-right: 104px; }
  @media (pointer: coarse) { .add { height: 44px; } .results li[role='option']:has(.add) { padding-right: 108px; } }
  .results li[role='option'].active, .results li[role='option']:hover { background: var(--accent-wash); }
  .name { font-weight: 600; }
  .tag { margin-left: 4px; padding: 1px 6px; border-radius: 4px; background: var(--accent-wash); color: var(--accent-ink); font-size: 11.5px; font-weight: 600; }
  .detail { font-size: 12.5px; color: var(--ink-3); }
  .results li[role='option'].active .detail, .results li[role='option']:hover .detail { color: var(--ink-2); }
  .examples { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .try { font-size: 12.5px; color: var(--ink-3); margin-right: 2px; }
  .examples button { border: 1px solid var(--line); background: var(--panel); border-radius: var(--r-chip); padding: 5px 12px; font-size: 12.5px; color: var(--ink-2); }
  .examples button:hover { border-color: var(--line-strong); color: var(--ink); }
  .examples button:active { transform: scale(0.97); }
  @media (pointer: coarse) { .examples button { min-height: 44px; padding: 0 14px; } }
  @media (max-width: 760px) {
    .results { position: static; max-height: none; box-shadow: 0 0 0 1px var(--line); }
  }
</style>
