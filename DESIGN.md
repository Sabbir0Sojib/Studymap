---
name: StudyMap
description: "A field notebook for study area maps: a clean white cover around a graph-paper desk ruled in true millimetres."
colors:
  cover: "#ffffff"
  cover-deep: "#e9f1f9"
  cover-edge: "#e4e6e1"
  cover-hover: "rgb(43 45 47 / 0.05)"
  cover-ink: "#2b2d2f"
  cover-ink-2: "#5e6267"
  cover-chip: "#ffffff"
  cover-chip-hover: "#f4f5f2"
  cover-chip-ink: "#2b2d2f"
  cover-chip-edge: "#cdd1cb"
  cover-action: "#2b2d2f"
  cover-action-hover: "#3f4245"
  cover-action-ink: "#ffffff"
  cover-focus: "#2f6fb5"
  cover-line: "rgb(43 45 47 / 0.45)"
  cover-mark: "#2b2d2f"
  cover-mark-ink: "#ffffff"
  cover-mark-dot: "#6fa3dc"
  cover-active-ink: "#1f4e80"
  graphite: "#2b2d2f"
  graphite-hover: "#3f4245"
  ruling-blue: "#2f6fb5"
  ruling-blue-hover: "#255a93"
  ruling-blue-wash: "#e9f1f9"
  ruling-blue-ink: "#1f4e80"
  desk-paper: "#f6f7f3"
  rule-minor: "#dfe7ed"
  rule-major: "#c9d7e2"
  panel-white: "#ffffff"
  panel-2: "#f4f5f2"
  line: "#e4e6e1"
  line-strong: "#cdd1cb"
  line-input: "#8d949e"
  ink-2: "#4c5054"
  ink-3: "#5e6267"
  ok: "#1f7a4d"
  ok-wash: "#e7f4ec"
  warn: "#8a5300"
  warn-wash: "#fdf3dc"
  warn-ink: "#6d4200"
  err: "#b42318"
  err-wash: "#fdecea"
typography:
  display:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "tnum"
  label:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "12.5px"
    fontWeight: 500
    lineHeight: 1.45
  caption:
    fontFamily: "Geist Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "11.5px"
    fontWeight: 500
    lineHeight: 1.2
  figure:
    fontFamily: "Arimo, Arial, Helvetica, sans-serif"
    fontWeight: 400
rounded:
  chip: "6px"
  control: "8px"
  card: "10px"
  panel: "12px"
spacing:
  hair: "2px"
  xs: "6px"
  sm: "8px"
  item: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  cover-bar:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    height: "56px"
  rail:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    width: "76px"
  rail-tab:
    backgroundColor: "{colors.cover}"
    textColor: "{colors.cover-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.card}"
    height: "58px"
  rail-tab-active:
    backgroundColor: "{colors.cover-deep}"
    textColor: "{colors.cover-active-ink}"
  cover-mark:
    backgroundColor: "{colors.cover-mark}"
    textColor: "{colors.cover-mark-ink}"
    size: "26px"
  cover-chip:
    backgroundColor: "{colors.cover-chip}"
    textColor: "{colors.cover-chip-ink}"
    rounded: "{rounded.control}"
    height: "36px"
  cover-chip-hover:
    backgroundColor: "{colors.cover-chip-hover}"
  cover-export:
    backgroundColor: "{colors.cover-action}"
    textColor: "{colors.cover-action-ink}"
    rounded: "{rounded.control}"
    height: "38px"
  cover-export-hover:
    backgroundColor: "{colors.cover-action-hover}"
  side-panel:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    width: "340px"
  panel-foot:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    padding: "7px 20px 8px"
    height: "56px"
  desk:
    backgroundColor: "{colors.desk-paper}"
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
    height: "38px"
  button-primary-hover:
    backgroundColor: "{colors.graphite-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-3}"
  button-secondary:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
    height: "38px"
  button-secondary-hover:
    backgroundColor: "{colors.panel-2}"
  button-danger:
    backgroundColor: "{colors.err-wash}"
    textColor: "{colors.err}"
    rounded: "{rounded.control}"
    height: "30px"
  input:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
    height: "38px"
  segmented-track:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "3px"
  segmented-chosen:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
    height: "30px"
  slider-track:
    backgroundColor: "{colors.line-input}"
    height: "4px"
  slider-thumb:
    backgroundColor: "{colors.panel-white}"
    size: "18px"
  slider-value:
    textColor: "{colors.graphite}"
  switch-track:
    backgroundColor: "{colors.line-strong}"
    rounded: "10px"
    width: "34px"
    height: "20px"
  switch-track-on:
    backgroundColor: "{colors.ruling-blue}"
  switch-knob:
    backgroundColor: "{colors.panel-white}"
    size: "16px"
  accordion-title:
    textColor: "{colors.graphite}"
    typography: "{typography.title}"
    height: "40px"
  accordion-title-quiet:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    height: "34px"
  chip:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
    padding: "5px 9px"
  chip-selected:
    backgroundColor: "{colors.ruling-blue-wash}"
    textColor: "{colors.ruling-blue-ink}"
  row-chosen:
    backgroundColor: "{colors.ruling-blue-wash}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
  rail-tick:
    backgroundColor: "{colors.cover-mark}"
    textColor: "{colors.cover-mark-ink}"
    size: "14px"
  sub-tab:
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    height: "40px"
  sub-tab-open:
    textColor: "{colors.graphite}"
  layer-row:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    padding: "1px 6px"
  layer-row-selected:
    backgroundColor: "{colors.ruling-blue-wash}"
  option-row-icon:
    backgroundColor: "{colors.ruling-blue-wash}"
    textColor: "{colors.ruling-blue-ink}"
    rounded: "{rounded.control}"
    size: "32px"
  tile-chosen:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.chip}"
  map-style-tile:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.chip}"
  page-paper:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-2}"
    rounded: "2px"
  floating-toolbar:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.panel}"
    padding: "5px 6px 5px 12px"
  check-pill-ok:
    backgroundColor: "{colors.panel-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.control}"
    height: "36px"
  check-pill-warn:
    backgroundColor: "{colors.warn-wash}"
    textColor: "{colors.warn}"
  check-pill-error:
    backgroundColor: "{colors.err-wash}"
    textColor: "{colors.err}"
  toast:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.card}"
    padding: "9px 9px 9px 14px"
---

# Design System: StudyMap

## Overview

**Creative North Star: "Field Notebook"**

StudyMap is the researcher's field notebook. A clean white cover (the top bar and the rail, and nothing else, split from the desk and the leaf by hairlines) wraps a desk of graph paper. The cover is quiet by the user's choice: graphite ink on white, with colour left to the figure and to state. The paper is ruled in the page's own millimetres, so the grid under the figure is the figure's real scale. Each tool opens as one plain white leaf, and the journey from place to export is read down the rail: four steps in order, a small graphite tick on each one that is done. It refuses the generic grey-desk-plus-blue-accent web editor and the dark GIS cockpit.

Two worlds share the screen and must never bleed into each other. The editor chrome (cover, leaves, desk, toolbars) speaks in Geist, graphite and ruling blue. The figure on the page speaks in Arimo and the journal look-alike fonts, millimetre units and colourblind-safe cartographic palettes, because it is the exported product. The exported page keeps its own theme colours and is never tinted by the chrome. Ruling blue marks selection, focus, handles and guides on the page but is never written into the export.

The system draws with rules, not boxes. Sections are split by hairlines, lists are ruled rows, folded groups are ruled accordions, and state is told plainly: a washed rail tab for where you are, a small graphite tick for what is done. Density is moderate: 14px body, 38px controls, 20px leaf gutters, every number tabular.

**Key Characteristics:**
- White, hairline-edged cover on the top bar and rail only; white leaves; graph-paper desk.
- Graphite is the ink and the one main button; ruling blue is selection and focus; red appears only in error states.
- One navigation: a labelled icon rail (76px) of four steps and Help, one 340px leaf, a centred page on a desk ruled in the page's millimetres.
- Rules, not boxes: hairline-split sections, ruled rows, ruled accordions, word tabs underlined in blue.
- One panel rhythm: 16px between sections, 10px inside them.
- Four weights: 400, 500, 600, and 700 only for the wordmark and the 24px display.
- Graphite-tinted, low shadows; corners step 6 / 8 / 10 / 12px by object size.
- Light only (`color-scheme: light`).

## Colors

A warm paper-and-ink palette: a white cover and white leaves on a pale paper desk, graphite for ink and action, and one cool ruling blue for state. Semantic greens, ambers and reds appear only to report a result; red is never decoration.

### Primary
- **Graphite** (#2b2d2f): all text ink, the primary button, the wordmark mark, the tick on a done step, and the toast. Hover on the primary is Graphite Hover (#3f4245). A primary that cannot be used yet is not a dark block: it is a quiet shape in Panel 2 with a Line Strong edge and Ink 3 words, still readable, and it does not change on hover.
- **Ruling Blue** (#2f6fb5): selection, focus rings (on the cover too), the open sub-tab underline, the chosen tile ring and the chosen-row ring, switches that are on, the border of a slider thumb, and handles, guides and the draw zone on the page. A chosen segment is not blue: it is a raised white key. Never exported. Companions: Ruling Blue Hover (#255a93), Ruling Blue Wash (#e9f1f9) for selected rows, chosen text rows and pills, option-row icon tiles, the active rail tab, the focused slider thumb and text selection, Ruling Blue Ink (#1f4e80) for text on the wash.

### Neutral
- **Desk Paper** (#f6f7f3): the desk behind the page and the body background.
- **Rule Minor** (#dfe7ed) and **Rule Major** (#c9d7e2): the graph-paper lines, 5 mm and 10 mm of the page.
- **Panel White** (#ffffff): the side panel, popovers, floating toolbars, inputs, and the page itself.
- **Panel 2** (#f4f5f2): hover fill for ruled rows, accordion titles and quiet buttons, and the soft track of a segmented control.
- **Line** (#e4e6e1): hairlines between sections and rows, the rule above every accordion, the 1px ring around floating surfaces, the border of a segmented track and of a map style tile.
- **Line Strong** (#cdd1cb): secondary button borders, hover borders, the off track of a switch, scrollbar thumb.
- **Line Input** (#8d949e): the edge of text boxes and dashed outlines, and every non-text edge that must be seen, 3:1 against white: the slider track, the chosen segment's key edge, the edge of a switch track, and the dashed outline of "Add a layer".
- **Ink 2** (#4c5054): secondary text, field labels, icon buttons. **Ink 3** (#5e6267): hints, detail lines, millimetre sizes, the drawn caret of a select, the + and − of an accordion, and the words of a disabled main button.

### Cover (top bar and rail only)
The cover is white and quiet. Each of its colours is its own `--cover-*` token in `src/app.css` (most alias a neutral or graphite above), so the cover can change in one place. Beside them the bar carries only the shared state colours (the ready tick, warn and error pills, the saved dot).
- **Cover** (#ffffff): the top bar and the rail. **Cover Edge** (#e4e6e1): the hairline under the top bar, beside the rail (above it on phones), and between undo and redo.
- **Cover Deep** (#e9f1f9): the active rail tab, with an inset 1px Cover Edge ring and **Cover Active Ink** (#1f4e80) words.
- **Cover Ink** (#2b2d2f): text and icons on the cover. **Cover Ink 2** (#5e6267): the millimetre size and the saved note.
- **Cover Hover** (graphite at 5%): hover fill on cover buttons, rail tabs and the title field.
- **Cover Chip** (#ffffff), **Cover Chip Hover** (#f4f5f2), **Cover Chip Ink** (#2b2d2f) and **Cover Chip Edge** (#cdd1cb): the size picker and the idle and loading check pill. The ready pill is Panel White with the same edge.
- **Cover Action** (#2b2d2f), **Cover Action Hover** (#3f4245) and **Cover Action Ink** (#ffffff): the graphite Export button.
- **Cover Focus** (#2f6fb5): the focus ring on the cover, ruling blue on white. **Cover Line** (graphite at 45%): the dashed underline of the map title.
- **Cover Mark** (#2b2d2f), **Cover Mark Ink** (#ffffff) and **Cover Mark Dot** (#6fa3dc): the wordmark mark, a graphite square with a white stroke and a light blue dot.

### Semantic (results only)
- **OK** (#1f7a4d) on **OK Wash** (#e7f4ec): the saved dot, passed findings, confirmation messages.
- **Warn** (#8a5300) on **Warn Wash** (#fdf3dc), with **Warn Ink** (#6d4200) for finding text: cautions.
- **Error** (#b42318) on **Error Wash** (#fdecea): failed checks, export and load problems, delete hover, and the quiet red confirm button (Delete, Replace). This is the only red in the chrome; red appears in error states and in the confirmation of a destructive step, and nowhere else.

### Figure palettes (exported, not chrome)
The exported figure takes colour from its own theme set and the Okabe-Ito palette for user choices. It is a separate world and is never tinted by the chrome.

### Named Rules
**The Quiet-Cover Rule.** The cover is white and quiet; colour on screen belongs to the figure and to state. Every cover colour is a `--cover-*` token: graphite ink, hairlines, and nothing louder. If the cover wants a fill, a stripe or a brand wash, it is wrong; the one splash of colour is the small blue dot in the wordmark mark.

**The Graphite-Is-Action Rule.** Graphite is the ink and the one main action per context. Ruling blue says where you are or what is chosen; it is never the fill of a main button.

**The Never-Exported Rule.** Ruling blue and every other chrome colour mark selection and guides on the page but never enter the exported file.

**The One Chosen Rule.** "Chosen" is drawn one of three ways, by what the thing is. Picture tiles (map styles, layouts, north-arrow styles, colour dots) take a 2px Ruling Blue ring. Text rows and pills (fonts, export formats, page colour, draw tools) take Ruling Blue Wash plus an inset 1.5px Ruling Blue ring. A segmented control shows a raised white key. Labels on the wash are Ruling Blue Ink (draw tools, side picker, chips); the long names in font, export-format and page-colour rows stay graphite so they keep reading as content. A new choosable thing picks one of the three rather than inventing a fourth.

## Typography

**UI Font:** Geist Variable (with system-ui, -apple-system, Segoe UI)
**Figure Font:** Arimo (with Arial, Helvetica) and the journal look-alike fonts, self-hosted; used only inside the exported figure and in live previews of figure text
**Code Font:** ui-monospace, Cascadia Mono, Consolas (raw text areas only)

**Character:** Geist gives the chrome a clean, modern editor voice. Rank comes from weight (400, 500, 600), not from size jumps, on a strict ladder of 11.5 / 12.5 / 14 / 16 / 20 px plus one 24px Display step.

### Hierarchy
- **Display** (700, 24px, 1.2, -0.02em; 20px on mobile): the empty-start prompt only (`Canvas .start h2`).
- **Headline** (600, 16px, -0.01em): panel titles (on phones kept for screen readers only); the wordmark is 700, 16px, -0.02em.
- **Title** (600, 14px, -0.005em): group titles inside a leaf, and the title of an accordion.
- **Body** (400, 14px, 1.45, tabular figures): control and panel copy. Button text is 500.
- **Label** (500, 12.5px): field labels in Ink 2, hints in Ink 3, sub-tab words (500, 600 when open), the quiet note at the right of a group heading or an accordion title, the title of a quiet accordion (Ink 2), the value at the right end of a slider's label (600, Ink).
- **Caption** (500, 11.5px): the word under each rail icon (600 when active), tooltips and status text. Map style names under their preview tiles use the same 11.5px size (500, 600 when chosen).

### Named Rules
**The Strict Ladder Rule.** Only 11.5, 12.5, 14, 16 and 20 px exist, plus the single 24px Display. Hierarchy comes from weight and ink colour.

**The Four Weights Rule.** Only 400, 500 and 600 carry the chrome; 700 is for the wordmark and the 24px Display. 550 and 650 do not exist; pick 500 or 600.

**The Tabular Rule.** Every number in the chrome uses tabular figures (set on body). Sizes, coordinates and zoom never shift width.

**The Two Faces Rule.** Geist never appears in the exported figure; Arimo and the journal fonts appear in the chrome only as live previews of figure text.

## Layout

A fixed three-column editor grid under a 56px cover bar: rail 76px, leaf 340px, desk fills the rest. Under 1100px the rail narrows to 68px and the leaf to 300px. Closing the leaf collapses its column to 0. Under 760px the layout stacks: cover bar (56px), desk, the leaf as a bottom sheet with a grab handle (about half the screen while there is no place, about 40% once there is one, so the map stays big; the handle makes it taller), then the rail as a 64px bottom bar.

The cover bar runs left to right: mark and wordmark, File, undo and redo (split by a Cover Edge rule), a dashed-underline map title (up to 280px), then pushed right: size picker, check pill, graphite Export. The File, size and check menus open 42px under the bar; under 880px the two wide menus become full-width sheets beneath it.

The leaf stacks, top to bottom: a 42px head with the panel's title at the left, "Step 2 of 4" in a quiet note and the close button (on phones the head folds into the grab handle's row, leaving only the close button); word sub-tabs where a panel has parts (Design: Colours, Layout, Text, Page, My styles; Map parts: Essentials, On the map, Inset maps, Add, Layers); a one-line note under the tabs only on Layout, My styles, Inset maps and Layers (hidden on phones); the scrolling body (20px gutters), which is one `.stack`; and a foot holding the step's one main action above a hairline and a soft shadow.

**Panel rhythm.** Every side panel body is a `.stack` (`src/app.css`): sections are 16px apart and split by a hairline, with 16px above and below the rule; the things inside a section sit 10px apart. Grid tracks are `minmax(0, 1fr)` and the sections, stacks, fields and forms inside `.side .body` carry `min-width: 0`, so nothing inside a panel grows wider than the panel. Panels use this rhythm instead of their own spacing. Consecutive accordions skip the section gap and touch, so a run of them reads as one ruled list.

**The foot.** Every step's one main action lives in the foot: the next-step button on Place, Design and Map parts ("Next: layout and colours", "Next: what is on the map", "Next: check and download"), and on Export the button "Download {FORMAT}" (PDF, TIFF, PNG or SVG). Export's panel hands the foot what to run, what to say and whether it is ready through `store.exportRun`, `store.exportLabel` and `store.exportDisabled`; while it works the label reads "Preparing your file…", and with no place it reads "Choose a place first". Help and the element settings have no foot. The foot is a Panel White strip 56px tall (7px 20px 8px) holding one full-width 40px primary button (44px on touch), with a 1px Line rule and a soft shadow above it, so content scrolling under it reads as more to come. A disabled next button hides its arrow (and a disabled Download hides its icon).

The desk centres the page with 34px side padding and a 64px band at the top for the floating toolbar; zoom sits 16px from the bottom right. Once a place exists and the window is wider than 760px, a 48px tool strip down the left and 20px rulers along the top and left frame the desk (the page then keeps clear of them). Phone versus desktop is judged by the window width (760px, the same line as the CSS), never by the desk width: at 1100px the desk is only about 730px wide, and the rulers and tool strip stay and the page still fits the desk. The graph-paper ruling is aligned to the page's top-left and scales with zoom: 5 mm minor and 10 mm major lines, and a 1 mm ruling added at 7 px/mm or more. This adapts the "1 mm and 5 mm" direction on purpose: at normal zoom 1 mm lines are about 3 px apart and read as a solid hatch.

Spacing rhythm: 6 and 8px inside controls, 10px between the things inside a panel section, 12px between grouped controls, 16px between sections, 20px leaf gutters.

Touch: under `pointer: coarse` every control is at least 44px.

### Named Rules
**The One Rhythm Rule.** A panel is a `.stack`: 16px between sections with a hairline between them, 10px inside a section. A panel that needs other spacing is wrong, not special.

## Elevation & Depth

Flat with rules, lifted only where something floats. The cover, rail and leaf sit flat on hairlines. Shadows are graphite-tinted (rgb 43 45 47), low and soft, like paper resting on paper; anything that floats also carries a 1px Line ring.

### Shadow Vocabulary
- **Rest** (`box-shadow: 0 1px 2px rgb(43 45 47 / 0.07), 0 1px 1px rgb(43 45 47 / 0.04)`): status bar, zoom control, hint pill.
- **Float** (`box-shadow: 0 8px 24px -10px rgb(43 45 47 / 0.16), 0 2px 6px -3px rgb(43 45 47 / 0.07)`): menus, popovers, the contextual toolbar, toast.
- **Page** (`box-shadow: 0 1px 2px rgb(43 45 47 / 0.10), 0 10px 30px -12px rgb(43 45 47 / 0.22)`): the paper page on the desk, and nothing else.
- **Foot edge** (`box-shadow: 0 -10px 14px -12px rgb(43 45 47 / 0.16)`): the soft shadow above the panel foot, cast upward onto the scrolling body.
- **Focus ring** (`box-shadow: 0 0 0 3px rgb(47 111 181 / 0.35)`): focused text boxes, with a Ruling Blue border. A focused slider has no ring: the global outline frames it and its thumb fills with Ruling Blue Wash.
- **Raised key** (`box-shadow: 0 1px 2px rgb(43 45 47 / 0.12), 0 0 0 1px var(--line-input)`): the chosen option of a segmented control.
- **Slider thumb** (`box-shadow: 0 1px 3px rgb(43 45 47 / 0.25)`): the soft shadow under a slider's white thumb.

### Named Rules
**The Graphite Shadow Rule.** Shadows are never neutral black or blue-grey; they use graphite (rgb 43 45 47) at low alpha, and floating things add a 1px Line ring.

## Shapes

Corners step up with object size: chips and inner segment buttons 6px, buttons, inputs and the segmented track 8px, cards, rail tabs and small pills 10px, leaves, popovers and the floating toolbar 12px. The page itself is nearly square (2px) because it is paper, and so is the small page drawing in the Page panel. Step markers, switch tracks and knobs, and colour dots are circles or full pills. Selection on the page is drawn with 1.5px non-scaling strokes and white square handles, never filled boxes. Pickable picture tiles take a 2px Ruling Blue ring when chosen (see The One Chosen Rule). Nothing carries a coloured side-stripe.

## Components

### Cover (top bar and rail)
White, flat and quiet, edged by a 1px Cover Edge hairline. Graphite text and icons (Cover Ink); hover is graphite at 5% (Cover Hover); the focus ring is ruling blue (Cover Focus), which reads cleanly on white. Rail tabs are an icon above an 11.5px word, 58px tall, 10px corners; the active tab is a Cover Deep wash with Cover Active Ink words, a filled icon, an inset Cover Edge ring and a 600 weight. The rail is the only navigation: Place, Design, Map parts and Export in order, a 14px graphite tick (Cover Mark, with a Cover ring) at the corner of the icon on each step that is done, and Help pinned to the bottom; it is a labelled navigation landmark, the current step carries `aria-current="step"`, every tab has a tooltip, and on mobile the rail is a bottom bar. The wordmark mark is a 26px graphite square with a white stroke and a light blue dot. The size picker and idle check pill are white (Cover Chip) with a Cover Chip Edge ring and a Cover Chip Hover fill; the ready pill is Panel White with a green check; the title field is a Cover Line dashed underline that becomes a white box with a graphite edge and the blue focus ring when focused. Warn and error check pills use their wash and ink. Export is the one graphite action (Cover Action). Every cover colour is a `--cover-*` token, so the whole cover can change in one place.

### Menus (File, figure size, journal check)
White popovers, 12px corners, Float shadow plus a Line ring. Opening a menu with the mouse does not move focus into it; opening it with the keyboard moves focus to its first choice. Escape closes it and returns focus to its button, and tabbing out closes it. The figure size menu is 480px wide: a one-line note, then one ruled row per publisher, with the publisher's name in an 84px column (12.5px, 600) and its sizes wrapping beside it as chips (label and width in mm; the chosen chip is Ruling Blue Wash with a blue edge), then a width and height row under a hairline.

### Buttons
Calm and solid, never shouty.
- **Shape:** 8px corners, 38px tall (30px small, 44px on touch).
- **Primary:** graphite fill, white text, 500 weight; hover Graphite Hover. One per context (Export, the leaf's foot). Disabled, it becomes a quiet shape, not a dark block: Panel 2 fill, Line Strong border, Ink 3 words at full opacity so the label stays readable.
- **Secondary:** white with a Line Strong border; hover fills Panel 2.
- **Ghost / icon:** transparent, hover a faint graphite fill.
- **Danger (`.btn.danger`):** the quiet red confirm: Error Wash fill, Error border and words, hover deepens the wash a little. It appears only as the confirming half of a destructive step.
- **Press:** 1px nudge in 80ms. Disabled buttons never change on hover (hover fills apply to enabled buttons only); other disabled states drop to 45% opacity.

**Inline confirm.** Deletes and replaces are confirmed in place, never in a pop-up. Removing one of your fonts swaps its x for Delete / Keep; deleting a saved style swaps its row actions for "Delete this style?" with Delete / Keep; saving over a style of the same name asks "Replace it with this look?" with Replace / Cancel. The danger button confirms and a ghost button backs out; in Delete / Keep the Keep button takes focus first and Escape means Keep. Fonts and My styles no longer use `confirm()`.

### Side panel (the leaf)
White and flat, with no rule or stripe down its edge. A head (title, how far along, close button), word sub-tabs where there are parts, a scrolling body that is a single `.stack` (see Layout), and a foot holding the step's one main action. Sections are split by a hairline and 16px of space, never boxed; folded groups are accordions.
- **A part's settings:** the head (back, the part's name, delete) is sticky, with its own white and a hairline once the body scrolls.
- **Order:** the everyday options come first. The rarer ones sit in one closed quiet accordion, "More options", then "Box, see-through and turn", then "Position and size".
- **The main map:** the grid switch and Quick looks are on top. "Fine-tune the grid" (closed) holds the sides, type, units, interval, frame and label options.

### Steps (the rail)
The four steps (Place, Design, Map parts, Export) are the rail's tabs; there is no second row of steps in the leaf. State:
- **Now:** the active tab: a Cover Deep wash, Cover Active Ink word at 600, a filled icon. Only while the panel is on show; the same button hides it again.
- **Done:** a small graphite tick at the corner of the icon (with "(done)" in the tooltip). A step is done once the place exists, the step has been opened and you have moved past it; Place is done as soon as the place exists. Help and the element settings keep the step you were on, so the ticks stay. Ticks start again on a new map.
- **To come:** nothing extra: the plain tab. Every step can be opened at any time; with no place the foot says "Choose a place first".
- **How far along:** the leaf's head says "Step 2 of 4" in a quiet note. The foot's one Next button walks the four steps in order.

### Sub-tabs
Words only, no icons and no boxes, across a hairline. The words are 12.5px Ink 2 at 500; the open word is Ink at 600 with a 2px Ruling Blue underline; hover shows a Line Strong underline. Arrow keys, Home and End move between tabs. Design runs Colours, Layout, Text, Page, My styles. A one-line 12.5px Ink 3 note sits under the tabs only where the name does not explain itself (Layout, My styles, Inset maps, Layers). On the narrower 300px leaf the words are 11.5px so all five of Map parts show whole. Layers is last in Map parts: the first three are the quick switches most people need, Add makes new things, and Layers is the full list for order and fine settings, next to Add where a new layer lands.

### Inputs / Fields
- **Style:** white, 1px Line Input edge, 8px corners, 38px tall; label above in 12.5px Ink 2; hover darkens the edge to Ink 3.
- **Focus:** border turns Ruling Blue with the 3px blue ring at 35%. Global focus-visible is a 2px Ruling Blue outline offset 2px (graphite on the cover). Caret and selection use the notebook blue.
- **Select (`select.input`):** the same field with a drawn caret instead of the OS arrow: the Phosphor caret-down, 14px, in Ink 3, 11px from the right edge, with 34px of right padding so words never run under it. Compact selects (the coordinates table) draw a 12px caret and keep 20px of padding.

### Segmented control
A soft track (Panel 2 fill, 1px Line border, 8px corners, 3px inset, 3px gap). The chosen option is a white raised key: Panel White fill, Ink text, 600 weight, 6px corners, with a small lift (the Raised key shadow: a soft drop plus a 1px Line Input ring, about 3:1 so the key's edge can be seen). There is no blue ring and no wash. Unchosen options are Ink 2 words on the track; on hover they darken to Ink and take a white wash (white at 60%); every option presses to 0.97 scale. The focus outline sits 2px inside the key (offset -2px) so it is not clipped by the track. Labels stay on one line. A group of up to three options sits in one row. A group of more than three (`.seg.wrap`) is an even two-column grid: an odd last option takes the full row, labels never wrap raggedly (long ones truncate). Under forced colours the chosen option gains a 2px ButtonText outline.

### Sliders
A 4px track in Line Input (3:1 against white, the same in every browser) with 2px corners and no fill, inside a 24px-tall hit area (44px on touch), and an 18px thumb (28px on touch): Panel White fill, a 2px Ruling Blue border and a soft graphite shadow (the Slider thumb shadow). The thumb grows to 1.1x on hover. On keyboard focus the global outline frames the slider and the thumb fills with Ruling Blue Wash. Under forced colours the track is ButtonText and the thumb is Highlight with a ButtonText border.
- **Label row (`.field.slider`):** the label (12.5px, Ink 2) sits at the left and the current value in a `<span class="val" aria-hidden="true">` at the right end (never an `<output>`: it is labelable, so the label would bind to it and the slider would lose its name), in 600 weight, Ink, with tabular figures so the value never shifts the label. The spoken value, with its unit, is the input's `aria-valuetext`.
- **Pairs (`.pair`):** two related sliders can sit side by side in two even columns on a 12px gap (Fill strength and Outline in Design, Colours).

### Switches
Every on/off property that takes effect at once is a switch, not a checkbox: `<label class="row-switch"><span>Name<small>optional hint</small></span><input type="checkbox" role="switch"></label>`, with the global `input[type='checkbox'][role='switch']` style. The row is the label at the left (14px, with an optional 12.5px Ink 3 hint under it) and the switch at the right, at least 36px tall (44px on touch). The switch is a 34 by 20px pill: off, a Line Strong track with a Line Input edge and a white 16px knob; on, the track and edge fill Ruling Blue and the knob slides 14px. Focus is the global 2px blue outline. Under forced colours the track uses ButtonText and Highlight. Native checkboxes remain only for list ticks (legend entries, the districts to include, which names to show), where the box is one of many.

### Accordions
One quiet style for everything that expands and collapses: `<details class="acc"><summary>Title</summary><div class="acc-body">…</div></details>`. A hairline above, the title in the group-title style (14px, 600, Ink) in a 40px-tall row, and a + (closed) or − (open) in Ink 3 at the right; hover fills Panel 2, and the browser's own marker is hidden. A `.cur` note sits at the right of the title as a quiet state word (12.5px, Ink 3), such as "On". The body has 10px between its items and 14px under it. `.acc.quiet` is the smaller nested one (34px, 12.5px, 500, Ink 2). Consecutive accordions touch, so a run of them is one ruled list closed by a hairline. It replaces the boxed `.sec`, the native `.more` and the old Help FAQ style. Used for: the two folded groups of Map parts, Add ("Add your own", "Add detail from OpenStreetMap", quiet and closed), "Text for your paper" in Export (quiet and closed), "Fine-tune one side" in Page (closed), "About these fonts", "Change or hide names on the map", "Position and size", Help's "On the page", "Drawing on the map", "Keyboard shortcuts" and FAQ, and the Main map (Main properties, Extent), Grid (Grid, Grid frame, Coordinates) and Inset map sections.

### Ruled rows
Export formats, Layers rows, Map parts switches, the font list, My styles, the Add tab's options, and Help are ruled rows: a hairline above every row but the first, no outer box, Panel 2 on hover. The chosen format or font is Ruling Blue Wash with an inset 1.5px blue ring.
- **Legend entries and map names:** 34px ruled rows (EntryList) with a swatch, a borderless name that becomes a field on focus, and the same eye as the Layers list. They are used in the legend's settings and in "Change or hide names on the map"; never boxed inputs or native checkboxes.
- **Add tab options:** "Add your own" (sample points, a map file) and "Add detail from OpenStreetMap" (rivers and water, roads) are ruled rows like the font list, never cards: a 32px icon tile (Ruling Blue Wash, blue ink, 8px corners), a 600 name over a one-line 12.5px Ink 3 description, a hairline above the first row and below each. Rows that need a place are held at 50% opacity until one is chosen.
- **Layers rows:** swatch, name and eye, on a grid of 22px, the full remaining width and 28px (44px on touch). The eye is always visible. The other actions (up, down, zoom, delete) sit in an overlay at the right that fades in over 120ms on hover, keyboard focus or selection, with a background that fades into the row colour so it can cover the end of a long name; names keep their full width at rest. The list holds the map's layers only: the north arrow, scale bar, legend and credits are switched in Map parts, Essentials. On touch (`hover: none`) the actions are inline in columns of their own. A selected row is Ruling Blue Wash with a 600 name. Delete turns Error on hover. "Add a layer" is a dashed Line Input outline.
- **Map parts switches:** rows of the Switch component (see Switches) with a 500 name, a hairline between rows and Panel 2 on hover.

### Option tiles
Pickable tiles carry a hairline at rest and a 2px Ruling Blue ring when chosen: map styles three across (see Map style tiles), layout thumbnails in 2 columns, north-arrow and other element tiles in 3 to 5 columns (the five north arrows, Arrow, Rose, Star, Compass and Simple, sit in one row, each with its name under it; 3 + 2 on the narrower leaf). Colour dots take the same 2px ring: the area colours are a one-row grid of eight 28px cells (seven Okabe-Ito dots and the custom picker) that never wraps. Their heading, "Area colour" (or "Outline colour" when each area gets its own colour), carries a right-aligned 12.5px Ink 3 note, "Colour-blind safe", instead of a separate hint paragraph. Text-and-pill choices (draw tools, page colour) use the wash and inset ring instead; see The One Chosen Rule.

### Map style tiles
Each map style is a tiny map preview drawn in that style's own colours, not a two-tone swatch. The preview is an inline SVG at 2:1 (6px corners, 1px Line border) showing the sea, the country's land with its coast line, a neighbouring country in the style's second land colour with a dashed border, a river, and the study area with its fill and outline. Under it sits the style's name: 11.5px, 500 weight in Ink 2, always one line (ellipsis if it must), centred, with tighter letter-spacing (-0.025em, instead of -0.005em) in the narrower panel at 1100px and below. Tiles run three across on a 10px gap, so all twelve styles fit in four short rows.
- **Chosen:** a 2px Ruling Blue ring around the preview, and the name turns Ink at 600 weight.
- **Hover:** the border darkens to Line Strong and the preview lifts 1px. **Focus:** the global 2px Ruling Blue outline on the preview.
- The preview colours are the style's figure colours, not chrome tokens: they preview the figure and tint nothing else in the chrome.

### Heading row with a note
A group title on the left and a quiet 12.5px Ink 3 note at the right, on one baseline: the current style's name beside "Map style", "Colour-blind safe" beside "Area colour". It replaces a hint paragraph under the heading.

### Colour-blind check
A row at the bottom of the Journal check menu (under the findings, once there is a place), set apart by a hairline: the title "Colour-blind readers", one labelled select, not a grid of four buttons (the label "Show the page as seen with" in 12.5px Ink 2 above a standard select with four options: Normal vision, Red-green (deuteranopia), Red-weak (protanopia), Blue-yellow (tritanopia)), then one hint line saying the preview is on screen only and the files are not changed. It is a check on the finished figure, so it lives with the other checks; while it is on, the page shows its own "Preview … Turn off" note, and it stays on as you change step.

### Page drawing
In the Page panel, "Fine-tune one side" is a quiet accordion, closed by default, holding a small drawing of the page, not four boxed groups. The paper is drawn at its real proportions, fitted in 150 by 100px (never under 64 by 44px): Panel White, a Line Strong edge, 2px corners, Rest shadow, its size in millimetres written inside in 600 weight. A minus/plus pair sits on each edge (a Line Strong outlined pair, 8px corners, 30 by 28px buttons, 44px on touch, Ruling Blue Wash and Ink on hover, 40% opacity at the page-size limit), so you change the side you can see. The amount (1, 5, 10 or 25 mm) is one small select above the drawing.

### Tool strip
The 48px strip down the left of the desk holds seven buttons: Select, Hand, Text, Map parts, Shapes, Picture and Draw on the map.
- **Groups:** Map parts, Shapes and Draw on the map open a labelled menu beside the strip (icon and name per row, keyboard and Esc, closes on an outside click).
- **Group icon:** a group button shows the icon of its last-used tool, with a small corner mark.
- **Buttons:** each is icon-only with a tooltip and an accessible name.
- **Pressed:** a pressed tool uses the Ruling Blue Wash (see The One Chosen Rule); pressing it again returns to select.
- **Draw on the map:** at 40% opacity and disabled until a place is chosen. Its shapes go into one "My drawing" layer, so they keep their place on the ground and get a legend line. The same four tools appear as named tiles in Map parts, Add.
- **Short screens:** the strip scrolls with an edge fade.
- **Map zoom:** the map's own zoom (+ − fit) sits in the scale box below the page, never on the figure.

### Picking inside the map
A click on the selected map picks the one feature under the pointer: a name, a point, a line or an area. The smallest wins when two lie under it.
- **Highlight:** a dashed Ruling Blue box (1.5px, a 6% wash) marks it on the page.
- **Panel:** its layer's settings open with a "this feature" card on top. The card has a 1px Ruling Blue border, the Ruling Blue Wash, 10px corners, the name and "Name in Sub-areas" in Ink 3, and a close button back to the whole layer.
- **Card settings:** its own fill and outline (Okabe-Ito dots plus any colour, "Same as the layer" to undo), show this one, the name on the map, and show the name.
- **Moving a name:** a picked name drags to a new place and stays exactly there ("Put the name back in its place" undoes it).
- **Export:** the click tags are stripped from every exported file.

### Box, see-through and turn
Every page part except the main map has the same quiet accordion, "Box, see-through and turn".
- **Background:** white, paper grey, pale blue, black or any colour, with a strength slider.
- **Border:** black, grey, blue, vermillion or any colour, with a width slider.
- **Box shape:** room inside and rounded corners, shown once there is a background or border.
- **See-through:** 0–80%.
- **Turn:** a slider with −90, −45, 0, 45 and 90° chips.
- **Unset:** nothing set means nothing is stored and nothing is drawn.

### Floating toolbar and status
White, 12px corners, Float shadow plus Line ring, 34px buttons; the element name leads in 600 weight split by a hairline. Pressed toggles use the Ruling Blue Wash with blue icon. The scale box, zoom control and hint pill use Rest shadow and 10px corners.

### Toast
Graphite background, near-white text, 10px corners, Float shadow; its actions (Undo, Dismiss) are 600 weight on a 12% white fill. A message fades and rises in (160ms, eased, from 6px below) and fades out and drops back when it goes; the toast is hidden rather than removed so the next message is read out.

### Icons
Phosphor icons only, drawn at 12 to 24px. All of them are `aria-hidden`, set once through an `IconContext` around the whole app; an icon-only button carries its name in `aria-label`, never in the icon.

## Do's and Don'ts

### Do:
- **Do** keep the cover white and quiet: graphite ink on #ffffff, a 1px hairline (#e4e6e1), and every cover colour from a `--cover-*` token.
- **Do** use graphite (#2b2d2f) for the one main action per context and for all ink, and put every step's main action in the panel foot.
- **Do** use ruling blue (#2f6fb5) for selection, focus, the current step, the chosen tile ring, slider thumbs, and handles and guides on the page.
- **Do** draw "chosen" by The One Chosen Rule: a 2px blue ring on picture tiles, wash plus an inset 1.5px ring on text rows and pills, a raised white key on a segmented control.
- **Do** build every panel as a `.stack`: 16px between sections with a hairline, 10px inside a section.
- **Do** separate sections and list rows with 1px hairlines instead of boxes and cards, and fold secondary groups into ruled accordions.
- **Do** use a switch for every on/off property that takes effect at once; keep native checkboxes for list ticks.
- **Do** confirm a delete or a replace inline (Delete / Keep, Replace / Cancel) with the quiet red button.
- **Do** tell state plainly: a washed rail tab for where you are, a small graphite tick for done.
- **Do** lay an option group of more than three as an even two-column grid; an odd last option takes the full row and nothing wraps raggedly.
- **Do** step corners by size: 6px chips, 8px controls, 10px cards, 12px panels and popovers.
- **Do** rule the desk in the page's own millimetres (5 mm and 10 mm, with 1 mm from 7 px/mm), aligned to the page's top-left and scaling with zoom.
- **Do** use tabular figures for every number in the chrome, keep to the 11.5 / 12.5 / 14 / 16 / 20 px ladder, and use only the 400, 500 and 600 weights (700 for the wordmark and the 24px display).
- **Do** give a slider's value as a `<span class="val" aria-hidden="true">` (not `<output>`) plus `aria-valuetext`, and draw its track in Line Input.
- **Do** keep every control at least 44px under `pointer: coarse`, and respect reduced motion.
- **Do** let the exported page keep its own theme colours.

### Don't:
- **Don't** add colour to the panels; leaves stay white with graphite ink, and semantic colours report results only.
- **Don't** export ruling blue or any chrome colour into the figure, and don't tint the page with the chrome.
- **Don't** add a dark theme or dark panels; the world is light (`color-scheme: light`).
- **Don't** put a coloured side-stripe on anything: no rule, border or bar down one edge of a leaf, row, card or message.
- **Don't** use red for anything but error states and the confirm of a destructive step; it is never decoration.
- **Don't** give the cover a colour fill, stripe or brand wash; colour on screen belongs to the figure and to state.
- **Don't** fill a main button with blue, and don't draw a disabled main button as a dark grey block; it is a quiet Panel 2 shape with readable Ink 3 words. A disabled button never changes on hover.
- **Don't** use neutral black or blue-grey shadows; shadows are graphite-tinted and low.
- **Don't** use `confirm()` or any pop-up dialog to confirm a panel action, the OS arrow on a select, or a native checkbox for an instant on/off.
- **Don't** use weights 550 or 650, or box a folded group as a card; use an accordion.
- **Don't** repeat the steps in a second row of navigation in the leaf; the rail is the one navigation.
- **Don't** use decorative gradients, eyebrow labels or emoji in the chrome (the only gradients are the graph-paper ruling and the fade that lets a Layers row's hover actions sit over a long name).
- **Don't** introduce GIS vocabulary or layer-tree plus inspector layouts outside the Layers panel.
