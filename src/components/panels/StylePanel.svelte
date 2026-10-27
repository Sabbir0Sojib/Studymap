<script lang="ts">
  import { store, OKABE_ITO } from '../../lib/store.svelte';
  import { THEMES, applyTheme } from '../../lib/themes';
  import ColorPicker from '../ColorPicker.svelte';
  import { t } from '../../lib/i18n.svelte';

  const study = $derived(store.doc.layers.find((l) => l.kind === 'study'));
  const terrain = $derived(store.doc.layers.find((l) => l.kind === 'terrain'));
  const names: Record<string, string> = { '#D55E00': 'vermillion', '#0072B2': 'blue', '#009E73': 'bluish green', '#E69F00': 'orange', '#56B4E9': 'sky blue', '#CC79A7': 'reddish purple', '#F0E442': 'yellow', '#000000': 'black' };
  // colour-blind safe, without the Okabe-Ito yellow (too faint on white paper and on the map)
  const SAFE = OKABE_ITO.filter((c) => c !== '#F0E442');

  function pick(id: string) { applyTheme(store.doc, id); store.commit(); }
  // each style is shown as a tiny map in its own colours: sea, the country, a neighbour, a river and the study area
  type Th = (typeof THEMES)[number];
  const tone = (th: Th) => {
    const s = th.styles;
    return {
      sea: s.sea?.fill ?? th.swatch[1], land: s.countries?.fill ?? th.swatch[0], next: s.countries?.fill2 ?? s.countries?.fill ?? th.swatch[0],
      border: s.countries?.stroke ?? th.swatch[3], river: s.rivers?.stroke ?? '#3D84A2',
      area: s.study?.fill ?? th.swatch[2], areaOp: Math.max(0.18, s.study?.fillOpacity ?? 0.3), areaLine: s.study?.stroke ?? th.swatch[2],
    };
  };
  // (the colour-blind preview is in the Journal check menu at the top, TopBar)
  function areaColour(c: string) {
    if (!study) return;
    study.style.fill = c;
    study.style.stroke = c;
    for (const it of store.doc.items) { if (it.kind === 'inset') it.extentColor = c; else if (it.kind === 'detail') it.boxColor = c; }
    store.commit();
  }
</script>

<div class="stack">
  <section>
    <div class="head">
      <h3 class="group-title">{t('Map style')}</h3>
      <span class="cur" aria-hidden="true">{t(THEMES.find((th) => th.id === store.doc.themeId)?.name ?? '')}</span>
    </div>
    <div class="themes">
      {#each THEMES as th}
        {@const c = tone(th)}
        <button class="theme" aria-pressed={store.doc.themeId === th.id} onclick={() => pick(th.id)}>
          <svg class="sw" viewBox="0 0 60 36" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <rect width="60" height="36" fill={c.sea} />
            <path d="M0 0H45C41 7 44 13 39 19C35 25 39 31 35 36H0Z" fill={c.land} stroke={c.border} stroke-width="0.6" />
            <path d="M0 0H15C16 9 13 18 16 27C17 31 15 34 16 36H0Z" fill={c.next} />
            <path d="M15 0C16 9 13 18 16 27C17 31 15 34 16 36" fill="none" stroke={c.border} stroke-width="0.6" stroke-dasharray="1.6 1.2" />
            <path d="M7 36C12 28 19 26 27 27C32 28 36 25 40 21" fill="none" stroke={c.river} stroke-width="0.9" stroke-linecap="round" />
            <path d="M21 9C26 5 33 7 34 12C35 17 31 22 26 22C20 22 17 13 21 9Z" fill={c.area} fill-opacity={c.areaOp} stroke={c.areaLine} stroke-width="1.1" stroke-linejoin="round" />
          </svg>
          <span class="tname">{t(th.name)}</span>
        </button>
      {/each}
    </div>
  </section>

  {#if study}
    {@const custom = !SAFE.some((c) => c.toLowerCase() === study.style.stroke.toLowerCase())}
    <section>
      <h3 class="group-title">{t('Area fill')}</h3>
      <div class="seg" role="group" aria-label={t('Area fill')}>
        <button aria-pressed={!study.style.hatch && !study.style.byUnit} onclick={() => { study.style.hatch = false; study.style.byUnit = false; store.commit(); }}>{t('Solid')}</button>
        <button aria-pressed={!!study.style.hatch} onclick={() => { study.style.hatch = true; study.style.byUnit = false; store.commit(); }}>{t('Hatched')}</button>
        <button aria-pressed={!!study.style.byUnit} onclick={() => { study.style.byUnit = true; study.style.hatch = false; store.commit(); }}>{t('Colour each area')}</button>
      </div>
      {#if study.style.byUnit}<p class="hint">{t('Each area gets its own colour-blind-safe colour and its own legend entry. Pick several districts in Place (search one, then use Add to map).')}</p>{/if}
      <div class="head sub"><h3 class="group-title">{study.style.byUnit ? t('Outline colour') : t('Area colour')}</h3><span class="cur">{t('Colour-blind safe')}</span></div>
      <div class="colours" role="group" aria-label={t('Colourblind-safe area colours')}>
        {#each SAFE as c}
          <button class="dot" style="background:{c}" aria-label={t('Use {name}', { name: t(names[c]) })} aria-pressed={study.style.stroke.toLowerCase() === c.toLowerCase()} onclick={() => areaColour(c)}></button>
        {/each}
        <!-- the eighth is not a preset: it opens the full picker, so it carries a + badge -->
        <label class="any" class:on={custom} title={t('Any colour')}>
          <ColorPicker value={study.style.stroke} label={t('Any area colour')} size={24} onchange={areaColour} />
        </label>
      </div>
      <div class="pair">
        <label class="field slider"><span>{t('Fill strength')} <span class="val" aria-hidden="true">{Math.round(study.style.fillOpacity * 100)}%</span></span><input type="range" min="0" max="0.6" step="0.02" bind:value={study.style.fillOpacity} oninput={() => store.commit()} aria-valuetext="{Math.round(study.style.fillOpacity * 100)}%" /></label>
        <label class="field slider"><span>{t('Outline')} <span class="val" aria-hidden="true">{study.style.strokePt} pt</span></span><input type="range" min="0.25" max="3" step="0.25" bind:value={study.style.strokePt} oninput={() => store.commit()} aria-valuetext="{study.style.strokePt} pt" /></label>
      </div>
    </section>
  {/if}

  {#if terrain?.terrain}
    <section>
      <h3 class="group-title">{t('Terrain')}</h3>
      <div class="seg" role="group" aria-label={t('Terrain')}>
        <button aria-pressed={!terrain.visible} onclick={() => { terrain.visible = false; terrain.terrain!.auto = false; store.commit(); }}>{t('Off')}</button>
        <button aria-pressed={terrain.visible && !terrain.terrain.tint} onclick={() => { terrain.visible = true; terrain.terrain!.tint = false; terrain.terrain!.auto = false; store.commit(); }}>{t('Shading')}</button>
        <button aria-pressed={terrain.visible && terrain.terrain.tint} onclick={() => { terrain.visible = true; terrain.terrain!.tint = true; terrain.terrain!.auto = false; store.commit(); }}>{t('Colours')}</button>
      </div>
      {#if terrain.visible}
        <label class="field slider"><span>{t('Relief strength')} <span class="val" aria-hidden="true">{terrain.terrain.exaggeration}×</span></span><input type="range" min="1" max="8" step="0.5" bind:value={terrain.terrain.exaggeration} onchange={() => store.commit()} aria-valuetext="{terrain.terrain.exaggeration}×" /></label>
        <p class="msg" role="status">{t(store.terrainMsg)}</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .head .group-title { margin: 0; }
  .head .cur { font-size: 12.5px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .head.sub { margin-top: 6px; }
  /* three across: every name stays on one line, and all twelve styles fit in four short rows */
  .themes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px 10px; }
  .theme { display: grid; gap: 4px; justify-items: stretch; border: 0; background: transparent; padding: 0; text-align: center; min-width: 0; }
  .sw { display: block; width: 100%; height: auto; aspect-ratio: 2 / 1; border-radius: var(--r-chip); border: 1px solid var(--line); transition: box-shadow 120ms ease, border-color 120ms ease, transform 120ms ease; }
  .theme:hover .sw { border-color: var(--line-strong); transform: translateY(-1px); }
  .theme:focus-visible { outline: none; }
  .theme:focus-visible .sw { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* chosen picture tile: a 2 px ruling-blue ring */
  .theme[aria-pressed='true'] .sw { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
  .tname { font-size: 11.5px; font-weight: 500; line-height: 1.2; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.005em; }
  .theme[aria-pressed='true'] .tname { color: var(--ink); font-weight: 600; }
  /* the narrower panel: names stay on one line, set a touch tighter */
  @media (max-width: 1100px) { .themes { gap: 10px 8px; } .tname { letter-spacing: -0.025em; } }
  /* eight colours on one line at any panel width: equal cells, each dot as large as its cell allows (28 px at most) */
  .colours { display: grid; grid-template-columns: repeat(8, minmax(0, 28px)); justify-content: space-between; align-items: center; }
  .dot { position: relative; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px var(--line-strong); padding: 0; }
  /* on touch screens the tap area grows to 44 px without the dot getting bigger */
  @media (pointer: coarse) { .dot::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; } }
  .dot[aria-pressed='true'] { box-shadow: 0 0 0 2px var(--accent); }
  /* the custom picker sits in the row as a dot of its own, marked with a + : "any colour" */
  .any { position: relative; display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 1px var(--line-strong); cursor: pointer; }
  .any.on { box-shadow: 0 0 0 2px var(--accent); }
  .any :global(.trigger) { border-radius: 50%; }
  .any :global(.trigger:focus-visible) { outline-offset: 3px; }
  .any::before {
    content: ''; position: absolute; right: -4px; bottom: -4px; width: 13px; height: 13px; border-radius: 50%; pointer-events: none;
    background: linear-gradient(#fff, #fff) center / 7px 1.5px no-repeat, linear-gradient(#fff, #fff) center / 1.5px 7px no-repeat, var(--graphite);
    box-shadow: 0 0 0 1.5px #fff;
  }
  @media (pointer: coarse) { .any::after { content: ''; position: absolute; inset: -9px; border-radius: 50%; } }
  /* the two sliders share a row */
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
</style>
