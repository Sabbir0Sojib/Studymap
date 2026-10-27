<script lang="ts">
  // Help in the words used on screen: the four steps (each one opens its panel, like the rail), the page, shortcuts, questions.
  import { store } from '../../lib/store.svelte';
  import type { Tab } from '../../lib/store.svelte';
  import { t } from '../../lib/i18n.svelte';

  const STEPS: { tab: Tab; title: string; text: string }[] = [
    { tab: 'place', title: 'Place', text: 'Search a district, city, park or lake, open your own file, or draw an area.' },
    { tab: 'templates', title: 'Design', text: 'Pick a map style, a font and a layout. Page size takes any journal or any size.' },
    { tab: 'elements', title: 'Map parts', text: 'Switch the north arrow, scale bar, legend, grid and inset maps on or off. Add has text, shapes, tables and charts, and a detail map (More maps) that enlarges part of the area with a zoom box. Layers lists everything drawn on the map.' },
    { tab: 'export', title: 'Export', text: 'Download a PDF, TIFF, PNG or SVG at the exact journal size, with a ready caption.' },
  ];
  const open = (tb: Tab) => { store.select(null); store.tab = tb; store.panelOpen = true; };
  const placeDone = $derived(store.doc.study.source !== 'none');

  const PAGE: [string, string][] = [
    ['Click', 'select a part; its toolbar appears above the page'],
    ['Drag', 'move it; drag a corner to resize'],
    ['Double-click text', 'type straight onto the map'],
    ['Scroll on the map', 'zoom the map; drag inside it to move it'],
    ['Click an empty part of the page', 'page size tools appear: wider, narrower, taller, shorter, fit'],
    ['Drag a page edge', 'make the page bigger or smaller'],
    ['Text, Picture', 'in the strip on the left: pick the tool, then click on the page or drag a box'],
    ['Map parts, Shapes', 'each opens a short menu (legend, scale bar, north arrow, inset map; rectangle, ellipse, line, arrow); pick one, then click or drag a box'],
    ['Hand tool', 'drag to move the map inside its frame'],
  ];
  // the last button of the strip draws on the map itself, so it is told apart from the page tools
  const DRAW: [string, string][] = [
    ['Points', 'click each place to add a point'],
    ['Line or area', 'click each corner; double-click, press Enter or Esc to finish'],
    ['Backspace', 'takes back the last point you added (Ctrl Z does too)'],
    ['Freehand', 'hold the mouse down and drag around the area'],
    ['Where it goes', 'into the layer “My drawing”, which keeps its place on the ground and gets a legend line'],
  ];
  const KEYS: [string[], string][] = [
    [['Ctrl', 'Z'], 'Undo (while drawing a line or area: the last point)'],
    [['Ctrl', 'Y'], 'Redo'],
    [['Ctrl', 'D'], 'Duplicate'],
    [['Ctrl', 'C'], 'Copy, then Ctrl V to paste'],
    [['Delete'], 'Remove the selected part'],
    [['Enter'], 'Finish a line or area you are drawing on the map'],
    [['Backspace'], 'Take back the last point while drawing on the map'],
    [['←', '→'], 'Nudge 0.5 mm (with Shift: 5 mm)'],
    [['Shift', 'Enter'], 'New line while typing text'],
    [['Esc'], 'Cancel or close; also finishes a line or area'],
  ];
  const FAQ: [string, string][] = [
    ['Which file do I send to the journal?', 'PDF, unless the journal asks for TIFF. The check at the top (Ready / to fix) tells you what the journal would reject.'],
    ['My journal wants Times New Roman or Arial.', 'Design, Text. The fonts there have the same letter widths as the ones journals name, and they are embedded in the PDF.'],
    ['Is my data uploaded anywhere?', 'No. Everything runs in your browser and there is no account. Your map is kept here between visits; File, Download project file keeps a copy for another computer.'],
    ['How do I credit the data?', 'Export writes a caption with every data credit. Paste it under your figure, or switch on Credits on the map in Map parts.'],
  ];
</script>

<div class="stack">
  <section>
    <h3 class="group-title">{t('Make a map in four steps')}</h3>
    <ol class="steps">
      {#each STEPS as s, i}
        <li>
          <button class="step" onclick={() => open(i > 0 && !placeDone ? 'place' : s.tab)} title={i > 0 && !placeDone ? t('Choose a place first: opens Place') : t('Open {name}', { name: t(s.title) })}>
            <span class="n" aria-hidden="true">{i + 1}</span>
            <span class="txt"><b>{t(s.title)}</b><span>{t(s.text)}</span></span>
          </button>
        </li>
      {/each}
    </ol>
  </section>

  <!-- reference material stays folded until it is wanted; the rows touch, hairlines tell them apart -->
  <section class="rows bare">
    <details class="acc">
      <summary>{t('On the page')}</summary>
      <div class="acc-body">
        <dl class="pairs">
          {#each PAGE as [k, v]}<div><dt>{t(k)}</dt><dd>{t(v)}</dd></div>{/each}
        </dl>
      </div>
    </details>
    <details class="acc">
      <summary>{t('Drawing on the map')}</summary>
      <div class="acc-body">
        <p class="lede">{t('The last button in the strip on the left, “Draw on the map”, opens a menu of four tools (Points, Line, Area, Freehand). It waits until you have chosen a place.')}</p>
        <dl class="pairs">
          {#each DRAW as [k, v]}<div><dt>{t(k)}</dt><dd>{t(v)}</dd></div>{/each}
        </dl>
      </div>
    </details>
    <details class="acc">
      <summary>{t('Keyboard shortcuts')}</summary>
      <div class="acc-body">
        <dl class="keys">
          {#each KEYS as [keys, what]}
            <div><dt>{#each keys as k, i}{#if i}<span class="plus" aria-hidden="true">+</span>{/if}<kbd>{k}</kbd>{/each}</dt><dd>{t(what)}</dd></div>
          {/each}
        </dl>
      </div>
    </details>
  </section>

  <section class="rows">
    <h3 class="group-title">{t('Common questions')}</h3>
    {#each FAQ as [q, a]}
      <details class="acc"><summary>{t(q)}</summary><div class="acc-body"><p>{t(a)}</p></div></details>
    {/each}
  </section>

  <p class="foot">
    {t('Data: Natural Earth, geoBoundaries, OpenStreetMap contributors, Copernicus elevation (Mapterhorn), Sentinel-2 cloudless by EOX.')}
    {t('Map fonts: Arimo, Tinos, Carlito, Caladea, Cousine (open licences). StudyMap is free and open source (MIT).')}
  </p>
</div>

<style>
  /* every list is rule-separated rows: a hairline above each row but the first */
  .steps { list-style: none; margin: 0; padding: 0; display: grid; }
  .steps li + li { border-top: 1px solid var(--line); }
  .step { width: 100%; display: grid; grid-template-columns: 24px 1fr; gap: 10px; align-items: start; text-align: left; padding: 10px 4px; border: 0; border-radius: 0; background: transparent; transition: background-color 120ms ease; }
  .step:hover { background: var(--panel-2); }
  /* an outlined disc: the rail marks a finished step with a graphite tick instead */
  .n { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; border: 1.5px solid var(--ink-3); background: var(--panel); color: var(--ink); font-size: 11.5px; font-weight: 600; margin-top: 1px; }
  .txt { display: grid; gap: 2px; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
  .txt b { font-size: 14px; color: var(--ink); font-weight: 600; }

  /* folded rows touch each other; the first one's rule is the section's own */
  .rows { gap: 0; }
  .rows > .acc:first-of-type { border-top: 0; }
  .rows > .group-title { margin-bottom: 6px; }
  .bare { padding-top: 0; }
  .acc-body p { margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.5; }
  .acc-body p.lede { color: var(--ink-3); }

  dl { margin: 0; display: grid; }
  dl > div { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 10px; padding: 8px 4px; font-size: 12.5px; align-items: center; }
  dl > div + div { border-top: 1px solid var(--line); }
  dt { font-weight: 600; color: var(--ink); }
  dd { margin: 0; color: var(--ink-2); line-height: 1.4; }
  .keys dt { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
  kbd { font: 600 11.5px/1 ui-monospace, 'Cascadia Mono', Consolas, monospace; padding: 4px 6px; border: 1px solid var(--line-strong); border-bottom-width: 2px; border-radius: 5px; background: var(--panel-2); color: var(--ink); }
  .plus { color: var(--ink-3); font-size: 11.5px; }
  .foot { margin: 0; padding-top: 14px; border-top: 1px solid var(--line); font-size: 11.5px; color: var(--ink-3); line-height: 1.5; }
</style>
