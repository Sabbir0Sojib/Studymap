# Work Log

This is the full record of the work on this website project, from A to Z.
Every change gets a new entry here, with the newest at the bottom.

Times are local (UTC+6).

---

## 2026-10-12 13:40 · Project folder checked

- Connected folder: the project folder on the owner's computer
- It was empty, with no files and no hidden files.
- Purpose: a website (details still to come).

---

## 2026-10-12 13:45 · Design and testing skills installed

Installed 6 skills for this project in `.claude/skills/`.
Each skill is its own folder there.

| # | Skill | Folder | Source (version) | What it does |
|---|-------|--------|------------------|--------------|
| 1 | Taste | `design-taste-frontend` | github.com/Leonxlnx/taste-skill (`d237dd3`) | Main design rules for landing pages and portfolios |
| 2 | Minimalist | `minimalist-ui` | github.com/Leonxlnx/taste-skill (`d237dd3`) | Clean, editorial layout rules |
| 3 | Redesign | `redesign-existing-projects` | github.com/Leonxlnx/taste-skill (`d237dd3`) | Audits and improves an existing site |
| 4 | Impeccable | `impeccable` | github.com/pbakaus/impeccable (`c63b8dd`, v4.5.2) | Design audits, critique and polish commands |
| 5 | Playwright CLI | `playwright-cli` | github.com/microsoft/playwright-cli (`b85c7a7`) | Opens the site in a real browser to click and test |
| 6 | Vercel web design guidelines | `web-design-guidelines` | github.com/vercel-labs/agent-skills (`063bee9`) | Checklist for accessibility, typography, images and phones |

Also installed:

- `@playwright/cli` version 0.1.22, installed globally with npm.
  The Playwright skill needs it to run the `playwright-cli` command.

Checks done before installing:

- All skill files were read and checked for internet access.
- Impeccable downloads its own engine from its official GitHub releases the first time it is used. It checks the file's checksum before running it.
- The Vercel skill fetches its latest rules from Vercel's own GitHub repo each time it runs.
- Nothing else reaches out to the internet.

Test:

- Playwright opened a real browser, read a test page and closed it. It works.
- Removed the leftover `.playwright-cli` test folder afterwards.

Files added:

- `.claude/skills/` (6 skill folders)
- `WORKLOG.md` (this file)

---

## 2026-10-12 14:00 · Idea defined, deep research started

The idea:

- A free website where anyone can make a publication-grade study area map, for a research paper or anything else.
- Quality should match QGIS or ArcGIS, and users can customize everything.
- Budget: zero.

Research started, with 5 topics researched in parallel:

1. Competitors and user pain points
2. What "publication grade" means: journal rules and map elements
3. Free map data and licenses
4. Technology: map engines, export, file import, layout editor
5. Free hosting, funding and growth

The findings and the plan will be saved in `RESEARCH.md` when done.

Update: all 5 research tasks stopped partway when the usage limit was hit. After the limit reset, they were resumed from where they stopped.

---

## 2026-10-12 · Research finished, plan written

Files added:

- `RESEARCH.md`: the full research report and the plan.

Key findings:

- Free competitors already exist, including AcadGIS and CalculatGeek. None of them reaches QGIS quality, so the tool will win on quality: true vector export, any projection, correct grids and scale bars, journal presets, and small-unit boundaries.
- Recommended technology: D3-geo and proj4js drawing one SVG page measured in mm, with export to SVG, PDF and tiled high-dpi TIFF and PNG. Everything runs in the browser.
- Safe data: Natural Earth, geoBoundaries, Mapterhorn terrain and OpenFreeMap.
- Do not host GADM, UN SALB or WDPA, and do not use basemaps that ban print or export.
- Cost is $0 and no card is needed: Cloudflare Pages, GitHub Pages and Hugging Face.
- Funding that works from Bangladesh: Open Collective (paid out through Payoneer), Patreon, bKash and OSGeo.

Plan: 4 phases. Phase 0 is foundations, Phase 1 is the core map, Phase 2 is v1.0, and Phase 3 is growth.

Waiting on the user to decide: name, framework, license, open source or not, and first country.

---

## 2026-10-12 · Build started: decisions and the visual direction

The user asked to build the website using all installed skills, with no login, and "best possible".

Decisions:

- Name: **StudyMap**
- License: MIT, open source
- Stack: chosen for the user, since they asked for "best possible": Svelte 5 + Vite + TypeScript, with d3-geo + proj4 for the maps

Skills used so far:

- **design-taste-frontend** and **minimalist-ui**: design rules loaded.
- **impeccable**: interview done, and `PRODUCT.md` written (users, purpose, positioning, constraints).
- **impeccable concept-seed**: proposed visual directions (seed b4a2c078).
  - Proposed: "Light Table", a drafting light table with pinned film layers. Guides show in non-photo blue, which never prints.
  - Alternatives: "Survey Sheet", "Star Atlas", and the standard editor look.
  - A decision page was opened so the user can choose.

Files added:

- `PRODUCT.md`
- `.impeccable/` (preview sketches and the decision page data)

---

## 2026-10-12 · StudyMap v0.1 built: the working map editor

The user chose the **Light Table** look. Its rules:

- Cutting-mat green frame and layer rail.
- A lit table in the middle holding the exact-mm page.
- Layers shown as pinned film sheets. A hidden layer slides off its pins.
- Non-photo blue for every guide and selection. These never export.

The design brief is saved in `.impeccable/surfaces/src-app-svelte.md`.

### What the app does

**Study area**

- Pick a country, then any boundary level (division, district, upazila, union).
- Choose one or more units, with the parent district shown next to each, so duplicate names can be told apart.
- Or use your own uploaded boundary.
- Boundaries come from geoBoundaries (gbOpen) and Natural Earth. The study country's own border is drawn from geoBoundaries, so it lines up with its districts.

**Layers**

| Layer | Source | Notes |
|---|---|---|
| Sea, countries | Natural Earth | Neighbour countries shaded darker |
| Terrain | Mapterhorn elevation | Shading, or elevation colours with shading; exaggeration, light direction and strength settings; built in a background worker at about 300 dpi |
| Admin boundaries | geoBoundaries | |
| Lakes, rivers | Natural Earth 1:10m | Rivers hide automatically when zoomed in past their accuracy |
| Detailed rivers, water bodies, roads | OpenStreetMap | Fetched for the map area through Overpass, trying 4 servers in turn |
| Your points | Paste or CSV | Decimal or DMS coordinates; swapped lat/lon detected and fixed |
| Your files | GeoJSON, KML, GPX, zipped shapefile | |

**Map**

- Any projection:
  - automatic UTM or local equal-area
  - BTM (EPSG:9678) and other national grids
  - any EPSG code, looked up on epsg.io
- Grid labels in degrees and minutes, DMS or decimal. Lines run across the map, ticks and labels sit outside the frame.
- North arrow that points to true north (3 styles).
- Scale bar measured on the ground. It warns when the projection distorts scale.
- Area-name labels and point labels, placed automatically so none overlap.

**Layout**

- Globe inset and country inset, each marking the main map's extent.
- Legend that lists only what is drawn and splits into columns when needed.
- Automatic credits for every data source used, plus the projection.
- Drag, resize and snapping, with non-photo blue guides. Arrow keys nudge, the mouse wheel zooms the map, dragging pans it.

**Journal tools**

- Size presets for Elsevier, Springer, Nature, Wiley, MDPI, PLOS, Frontiers, IEEE, Copernicus and A4 thesis.
- Journal checker: minimum font size, line widths, dpi, height, accepted formats, text overflow, items outside the page, and scale-bar validity.

**Export**

- Vector PDF with the Arimo font embedded and only that font listed.
- SVG.
- TIFF (LZW compression, dpi stored in the file).
- PNG (dpi stored in the file).
- 300, 600, 1000 or 1200 dpi.

**Saving and editing**

- Save and open project files (.json).
- Automatic saving in the browser.
- Undo and redo.

**Privacy:** no login. Everything runs in the browser.

### Skills used

- **impeccable**: wrote `PRODUCT.md` and the visual direction (seed b4a2c078), and set the quality rules.
- **design-taste-frontend** and **minimalist-ui**: design rules (no em dashes, tabular figures, one accent colour).
- **playwright-cli**: automated end-to-end tests in a real browser.

### Tests run with Playwright, and the bugs they found

1. All 4 export formats downloaded and were checked with Python (PIL).
   - **TIFF LZW bug:** the code-width switch happened one code too early, so the file would not decode. Fixed. The TIFF now decodes at 4488 × 3543 px at 600 dpi, exactly 190 × 150 mm, and its pixels are identical to the PNG.
   - **PDF fonts:** the file listed 14 standard fonts it never used. Fixed with `putOnlyUsedFonts`.
2. Full editing flow: upazila level, 2 units, area labels, pasted points, EPSG:9678 and export.
   - Found duplicate unit names (2 "Companiganj"). Fixed by showing each unit's parent district.
   - Found overlapping labels. Fixed with collision-aware placement.
   - Found point labels being hidden. Fixed.
3. OpenStreetMap water loaded 7,275 features. Busy servers are handled with a clear message.
4. Terrain on Rangamati: about 2 to 6 seconds.
   - Fixed: the credits were too long.
   - Fixed: Kaptai Lake was tinted by the study-area fill. The study fill now sits under water, and its outline is drawn on top.
5. The journal checker caught credits running past their box in the default layout. Fixed the default layout.

### Files

- Built: `package.json`, `vite.config.ts`, `tsconfig.json`, `svelte.config.js`, `index.html`, `.gitignore`, `.claude/launch.json`.
- `src/` (app code):
  - `lib/`: projection, carto, scene, store, data, importers, export, check, journals, measure, osm, terrain and terrain.worker.
  - `components/`: Figure, Table, LayerRail, Inspector, StudyPanel, DataPanel and Header.
- `public/data/`: Natural Earth countries, rivers, lakes and disputed areas, converted to TopoJSON (about 3.7 MB in total).
- `src/assets/fonts/`: the Arimo font (Apache 2.0).
- Production build: about 137 KB gzipped for the main code, plus parts loaded only when needed.

---

## 2026-10-12 · Quality pass: design scan, accessibility review, polish

**Impeccable detector**

- Found 1 advisory item: the grid on the green rail.
- Kept on purpose. It is the cutting-mat signature in the design brief, and a cutting mat is a real measuring surface.

**Vercel web-design-guidelines review** (run by a helper agent against the live guidelines)

Every must-fix item was fixed:

- Focus rings now use the darker blue (#1F7FA8) on light surfaces for 3:1 contrast. The light non-photo blue stays on the green mat.
- Layer rail: the rows were "button inside button". They now use a real button for the name, with the move and hide buttons beside it.
- The Add list is now a proper disclosure. Focus moves into it, and Escape or an outside click closes it.
- The Fill/Line colour pickers had a label inside a label. Fixed, and each colour input is now named.
- Number fields: empty or invalid X/Y/W/H values are ignored, and width and height are clamped to 40–420 mm and 30–420 mm.
- Status messages (export, OpenStreetMap, terrain, toast, busy) now use live regions that stay on the page, so screen readers announce them. Errors use `role="alert"`, and the EPSG field shows `aria-invalid`.
- Focus returns to the panel heading when the panel content is swapped out (Export, Help, removing a layer).
- The country search is now a full combobox: arrow keys, Enter, Escape, and it closes on blur.
- Level choices use pressed buttons.
- Help is now a real button with a name. The wordmark is now the page's `<h1>`.
- The figure SVG now has `role="img"` and a title naming the study area and projection. It is hidden from screen readers in the editor, to avoid reading hundreds of labels.
- The journal check announces a one-line summary instead of the whole list.

**Map polish**

- North arrow and scale bar now get a white backing (on by default), so they read over dark terrain.

**Project documents**

- Added `README.md`, `LICENSE` (MIT) and `DATA-SOURCES.md` (every data source, its licence and its credit line).

**Re-tests after the changes** (Playwright)

- All 4 exports pass. TIFF: 4488 × 3543 at 600 dpi. PDF: Arimo font only. The SVG has an accessible title.
- The full editing flow passes.
- In the flow test, the journal checker flagged legend and credits overflow when many layers were added. That is working as intended.

---

## 2026-10-12 · Independent design review, final fixes, design system documented

**Impeccable finish review**

A fresh reviewer agent ran 3 rounds.

Round 1: recapture. The mobile screenshot was 532 px wide on a 390 px phone, which showed a real overflow bug. Fixed:

- The header could not shrink. It now compacts on phones, and the page is exactly 390 px wide.
- On phones, the map now comes first.
- A stray focus box showed on the panel heading at load. Removed.
- The legend was incomplete. It now covers everything drawn: international boundary, water body, shaded relief (with a relief symbol), district boundary and study area.
- Selecting the whole figure now shows a non-photo blue outline with corner handles, plus blue extent bands on both rulers.

Round 2: fix. Fixed:

- The default panel had empty space. It now shows the projection (with Change), grid toggles and quick export.
- The mobile size label no longer clips.
- The mobile map band was tightened.

Round 3: fix. Fixed:

- Quick export moved into the always-visible footer as a secondary button. Header Export stays the only primary.
- Alignment guides now stay visible in non-photo blue. They are never exported.
- The footer button now names its action ("Export vector…").

The last review round marked all its findings resolved except the button wording, which was a one-line copy change, applied afterwards.

**Design system documented**

- `DESIGN.md` and `.impeccable/design.json` were written by the documenter agent.
- They record colours, type, shapes, components, and 4 named rules (Non-Photo, Two Worlds, Tabular, Objects Only).
- Small drift was recorded as built, not fixed: rail and inspector widths, a 3px radius on films, and a few colours not yet made into tokens.

**Examples saved in `examples/`**

- `sylhet-district-vector.pdf`: vector, fonts embedded.
- `rangamati-district-terrain-vector.pdf`: with hillshade.
- `sylhet-sadar-companiganj-osm-300dpi.png`: OpenStreetMap water, points and labels.
- `sylhet-district-preview.png`.

**Final checks**

- `svelte-check`: 0 errors and 0 warnings.
- Production build: OK.
- Exports: TIFF 4488 × 3543 at 600 dpi (decodes); PDF with Arimo only.

**Known limits and next steps**

- TIFF with hillshade is about 14 MB at 600 dpi, over Wiley's 10 MB limit (the app warns). Adding an LZW predictor would shrink it.
- Public OpenStreetMap (Overpass) servers are sometimes busy. The app retries 4 mirrors and shows a clear message.
- EPS export is not done yet (PDF is accepted almost everywhere).
- No Bangla interface yet.
- Not yet deployed online. Next: GitHub repository, then Cloudflare Pages.

---

## 2026-10-12 · v0.2 redesign: Canva-like, any place, fast

**User feedback on v0.1:** "looking bad", "design is bad", "all things very slow", "looks AI".
They want it to work like Canva and make a map of any place or any shape, anywhere (for example "only Dhaka"), with nothing forced.
They chose the look: **Light and friendly like Canva**.

### Skills used

- **redesign-existing-projects**: overhaul mode. Kept the map engine, data, exports and journal checks; rebuilt the whole interface.
- **impeccable**: new surface brief and contract (brief-pinned, code-led) in `.impeccable/surfaces/src-app-svelte.md`.
  The detector found 0 anti-patterns. Its other notes are drift against the old DESIGN.md, which will be regenerated.
- **design-taste-frontend** and **minimalist-ui**:
  - Geist font replaces Barlow.
  - One accent (survey blue #2456D3) for actions, selection and guides.
  - No gradients, eyebrows, emoji or decorative grid.
  - Tabular numbers.
- **playwright-cli**: end-to-end, performance and screenshot tests; also generated the real layout thumbnails.

### New interface

- **Top bar:** File menu, undo/redo, editable map name, journal size picker (popover), check pill with a findings popover, Export.
- **Left rail:** Place, Layouts, Elements, Text, Your data, Style, Layers, Help. Each opens one side panel.
- **Desk:** the page on a quiet grey desk, without rulers.
  - Floating toolbar for the selected element: Move map, Fit to area, Grid, Settings, Duplicate, Hide, Delete.
  - 4 corner handles, end handles for lines and arrows, and snap guides while dragging.
- **Start screen:** "Make a map of any place", with a large search box over a blurred world map, example places, and "Draw an area instead".

### New features

**Any place**

- Search anything on Earth: Photon suggestions while typing, plus the Nominatim outline.
- Cities mapped only as a point look up their matching boundary.
- If no outline exists, the place is marked with a point and a 20 km view.

**Draw anywhere**

- Rectangle, circle (measured on the ground), polygon, freehand.
- Shift adds another shape.
- The map does not jump after drawing.
- The drawn area is named after its country, and the name is editable.

**Highlight on or off:** a map of a city can be shown plain.

**Layouts:** Classic, Inset in corner, Locators below, With title, Minimal. Each has a real thumbnail rendered by the app (Sylhet District), saved in `src/assets/templates/`.

**Map styles:** Classic, Atlas, Soft grey, Black and white, Field green. One click sets every colour.

**Elements:**

- globe, country and region locators;
- 4 north arrows (new: compass);
- scale bar, legend, grid, credits;
- shapes: rectangle, circle, line, arrow;
- text: title, subtitle, panel letter, note, with bold, italic, alignment and colour.

**Automatic detail:**

- For areas under 3°, OpenStreetMap rivers and water load by themselves.
- Under 0.7°, roads load too.
- They refresh when you move the map.
- The coarse world rivers hide when detailed water is present.

**Smart terrain:** relief shading switches itself off on flat ground (under 60 m of relief), where it only shows noise.

**Legend:** fits its entries, and the credits below it move with it. A place mapped as a point shows a dot in the legend.

**Messages:** they clear themselves after 7 seconds.

### Speed (the main complaint)

**What changed**

- Map geometry is cached. Moving, restyling or reordering things no longer recomputes the map. Insets are cached too.
- Points closer than 0.05 mm on paper are dropped, so the drawing stays light.
- Panning and zooming the map show an instant preview, and the map is rebuilt once when you stop.
- Terrain is built at screen quality (5 px/mm) while you edit, and at print quality (12 px/mm) only when you export.
- At start the app loads only the light world outline. Detailed layers load afterwards, in the background.
- At world scale, rivers are hidden and lakes smaller than about 0.3 mm² are skipped.

**Measured with Playwright**

| Step | Result |
|---|---|
| First paint | about 1.3 s (dev mode) |
| From picking a place to seeing the map | 1.3 to 2.6 s |
| Dragging (40 moves) | 0.46 s; screen updates every 8 ms typically, 17 ms at worst (smooth) |
| Panning (40 moves) | 0.53 s |
| PDF write | 0.8 s (5 s including print-quality terrain) |

### Bugs found and fixed while testing

- Dhaka resolved to Dhaka Division. Boundary matching now requires the exact name.
- The "Inset in corner" layout overflowed at the bottom.
- In "Minimal", the credits touched the grid labels.
- Layout thumbnails did not load. They are now imported directly.
- The start card hid the northern half of the world map. Added a blurred scrim behind it.

### Files

- **New components:** `TopBar`, `Rail`, `SidePanel`, `Canvas`, `PlaceSearch`, and `panels/` (Place, Templates, Elements, Text, Uploads, Style, Layers, Edit, Export, Help).
- **New lib files:** `place.ts`, `templates.ts`, `themes.ts`, `actions.ts`.
- **Removed:** `Header`, `LayerRail`, `Inspector`, `Table`.
- **Project files:** now version 2. Older projects upgrade automatically.

---

## 2026-10-12 · v0.2 independent review: shipped after 4 rounds

**Final verdict: ship.** Each round below lists what was fixed.

**Round 1**

- The status pill said "Ready" while data was loading. It now shows a spinner and what is loading.
- Relief outside the study area is veiled at 55% white, so the area itself is the focus.
- First run: removed the blurred card (it read as "AI"). The Place panel opens with the search focused, and the page shows a plain hint.
- The mobile tab bar now fits all 8 tabs at 390 px.
- Layout thumbnails line up.
- Shorter map credits. Export now offers a **Figure caption** with the full licence wording and a Copy button.
- The legend heading is off by default.
- Locator maps use the same water colour as the main map.
- The map title shows a dashed edit cue.

**Round 2**

- An old CSS rule hid the loading pill below 1240 px. Fixed by renaming its state class.
- The "Inset in corner" thumbnail showed the wrong layout. The generator now waits for the layout to apply.
- Quieter globe grid.
- The phone hint wording is fixed, with side gutters.
- No grid lines or labels on the empty world page.
- When OpenStreetMap is busy, the world rivers stay visible down to 0.4° views.
- The loading text pushed the phone page to 439 px. On phones it now shows a compact "Loading" pill.

**Round 3**

- The figure caption showed only dots. A regex had lost its escaping and replaced every pair of characters. Fixed, and the caption wraps.
- The Export panel overflowed its column. Fixed.
- Export warns while detailed rivers are still loading.
- Short hint text on phones.
- The caption no longer repeats the elevation credit.

**Round 4**

- Verdict: ship.
- Not covered by the review: Download stays enabled while detail loads (the warning is advisory).

**Other**

- The DESIGN.md regeneration for the new look was started (documenter agent).
- Production build OK.
- The exported PDF embeds only Arimo.

---

## 2026-10-12 · Design system documented for v0.2

`DESIGN.md` and `.impeccable/design.json` were rewritten for the new look, "The Quiet Desk", replacing the old Light Table documentation.

**What they record**

- Desk grey #eef0f2, white panels, one survey-blue accent #2456d3.
- Geist type ramp with tabular figures.
- Radii: 6, 8, 10 and 12 px.
- Desk-tinted shadows.
- 5 named rules: One Accent, Never-Exported, Tabular, Two Faces, Desk-Tinted Shadow.

**Small drift, recorded as built**

- Rail width is 76 px.
- Friendlier tab names: "Layouts" and "Your data".
- 10 px radius on tiles.
- Fully rounded example-place pills.
- The start card shows only when the Place panel is closed, by design after review round 1.

---

## 2026-10-12 · v0.3: built around real study area maps (user feedback)

**User feedback on v0.2**

- Zoom in and out did not work easily.
- Search did not work: "Dhaka" gave only a dot.
- Too many features that do not serve the main purpose.
- "Think like QGIS and ArcGIS."
- The user shared 2 real journal examples:
  - Dhaka district with its thanas, a Bangladesh inset with all districts, connector lines, a hatched area, a compass rose and "1 cm = 4 km";
  - Dhaka and Gazipur districts in their own colours, side by side with a country map.

### What changed

**Search finds the real area**

- When OpenStreetMap only has a point (like Dhaka city), the app now uses the official district that contains it.
- "Dhaka" gives **Dhaka District** and says so.
- Bug found by testing: the district outlines were not normalised before the "contains this point" check. Fixed.

**Sub-areas**

- New layer, on by default: the official units one level finer than the study area, inside it (the thanas or upazilas of Dhaka District), with their names.
- The legend names them, for example "Subdistrict boundary".

**Country inset**

- Shows all the country's districts, with the study area filled in.

**Connector lines**

- Lines from the inset's box to the main map's corners.
- On by default in the Side by side and Locators below layouts.
- Off in Classic, where they would cross the legend.

**Area fill**

- Solid, **Hatched** (diagonal lines), or **Colour each area**: each unit gets its own soft colour and its own legend row.

**Map elements**

- **Compass rose** north arrow with N, E, S, W.
- Scale text: **"1 cm = X km"** or **"1:250,000"**.

**New layout: Side by side**

- Study area and country map next to each other, with the legend in a white box.

**Map-like navigation**

- Mouse wheel over the map zooms it.
- Dragging inside the map pans it.
- **+ − Fit** buttons on the map.
- Dragging the map's edge, or the blue grip, moves the frame.
- Ctrl+wheel zooms the page.
- Tested: the wheel zooms 2.05×, and dragging pans.

**Simpler**

- The Text tab is merged into Elements.
- Advanced options (projection details, exact position in mm) are folded under "advanced" sections.
- Classic style is now clean, without relief. A separate **Terrain** style turns relief on.

**Layout thumbnails**

- All 6 regenerated with Dhaka District.
- The on-screen controls are removed from the images.

**Checks**

- svelte-check: 0 errors.
- Production build OK.
- Design detector: 0 anti-patterns.

---

## 2026-10-12 · v0.4: any country, any admin level, any shapefile

**User request:** not only Bangladesh districts. Any level, any country, anywhere, any admin level, and any shapefile (for example DIVA-GIS data).

### What changed

**The Place panel now has 4 clear ways to choose an area:** Search · Boundaries · Your file · Draw.

**Boundaries** (official, geoBoundaries)

- Moved out of the hidden "advanced" spot into its own tab.
- Any country. Every level that exists, from the whole country to the finest level.
- Pick one or many units.
- Tested: Kenya has Counties (47), Sub-Counties (290) and Wards (1,452). Nairobi showed its sub-counties named, and the inset showed all 47 counties.

**Your file** (new)

- Drop or choose a shapefile, either as a .zip or as loose parts (.shp + .dbf + .shx + .prj + .cpg, picked together), the way DIVA-GIS and GADM deliver them. GeoJSON, KML and GPX also work.
- The name column is detected automatically: NAME_0 to NAME_5 (DIVA-GIS/GADM), shapeName, name, ADM*_EN, and so on. It can be changed.
- Search the names, tick one or many, then "Use N selected as study area" (or the whole file).
- The whole file can also stay on the map as boundary lines.
- The credit "<file> (your data)" is added only when the file is actually on the map.
- Shapefiles with a .prj in another projection are converted automatically. Files without latitude/longitude get a clear message.
- Tested with a DIVA-GIS-style Nepal shapefile (NPL_adm2, 4 loose files, NAME_2 column):
  - 73 districts were listed;
  - Kathmandu, Lalitpur and Bhaktapur were picked;
  - "Colour each area" gave each its own colour and legend row;
  - their municipalities were named inside.

### Fixes found by the tests

- The legend counted layers, not areas, so with "Colour each area" the third colour was missing and the columns overlapped. Fixed.
- A file's credit appeared on maps it was not part of. It now appears only when the file is on the map.
- Boundary legend labels now use each country's own word: "County boundary" and "Sub-county boundary" for Kenya, "Subdistrict" for Bangladesh.
- Removed the leftover "use your own boundary" block, and fixed the panel heading styles.

**Checks:** svelte-check 0 errors, 0 warnings. Production build OK.

---

## v0.5: search-then-draw bug fixes (2026-10-13)
User report: "too many bug… i write a area and draw and you make it like bad… think like qgis or arcgis".
Reproduced with Playwright (search Gazipur → draw rectangle, polygon, freehand, circle) and fixed:
- **Drawing no longer moves the map.** The old "keep view" stored the frame's lon/lat bounding box, which is larger than the frame in UTM, so every shape zoomed the map out further (10 km → 20 km scale bar). Now zoom/pan are computed so the frame stays exactly as seen (`holdView` in actions.ts, CRS pinned). "Zoom to it" frames the shape. On the empty world map a drawing still goes to the shape.
- **The searched district stays on the map.** A shape drawn inside the chosen place keeps that place as a dark outline ("Gazipur District boundary" in the legend), like a QGIS context layer. It is removed when another area is chosen.
- **Sub-area names stay.** Upazila/thana boundaries and names of the surrounding district stay after drawing; a shape drawn with no district around it shows every unit it touches.
- **Names updated.** Drawn area is called "Study area in Gazipur District" (or "…in <country>"); legend says "Study area" (it kept saying "Study area (Gazipur District)"); map title follows.
- **Freehand smoothing.** Points closer than 1 mm dropped, then two rounds of Chaikin corner cutting, so hand-drawn edges are clean.
- **Grid labels at fine zoom.** Steps under 1′ now show seconds (all labels used to read 90°23′E), and 5″/2″/1″ steps added.
- **No stuck "Adding rivers and water…" pill.** Automatic OpenStreetMap detail loads quietly; per-server timeout 45 s → 25 s.
- **Fresh map shows "Ready", not "1 to fix".** Sub-area labels default to 7 pt (Elsevier minimum), not 6 pt.
Files: src/lib/actions.ts, src/components/Canvas.svelte, src/App.svelte, src/lib/carto.ts, src/lib/osm.ts, src/lib/scene.ts, src/lib/store.svelte.ts. svelte-check 0 errors, build OK.

## v0.6: instant boundaries, auto level, on/off switches, less lag (2026-10-13)
User report (screenshots): "checking too much time", "auto level?", "I can toggle on or off", "still feels laggy".
Measured with Playwright before → after:
- Place search first result: 4,881 ms → 51 ms. Official boundaries (geoBoundaries) of the user's country are searched locally by name across every level (new src/lib/adminsearch.ts). Typing "Dhaka" lists Dhaka Division, Dhaka District, Jaldhaka Subdistrict instantly, with the level found automatically; world-wide Photon results follow below. The country comes from the current map or the time zone (Asia/Dhaka → Bangladesh).
- "Checking which boundary levels exist…": 5 API calls → instant. The geoBoundaries level list for all 208 countries is bundled as public/data/gb-index.json (63 KB, built from the API's ALL/ALL listing). data.ts boundaryMeta reads it.
- Boundaries tab: one box "Country, division, district, upazila…" finds countries and units; picking a second unit of the same kind adds it (Dhaka + Gazipur). Level buttons kept as "Or show a whole level", with readable singular names.
- Zoom: 299 ms long task → none. Pan: 228+189 ms → none. Insets are now split into a cached base (land, country, districts) and the small extent box, so moving the main map no longer reprojects every district (scene.ts insetBase).
- Autosave runs when the browser is idle and leaves out OpenStreetMap data (it is re-fetched), so saving never stutters a drag.
- Elements panel: new "Show on the map" switches for north arrow, scale bar, legend, globe/country locators, grid, credits, area names, area and district boundaries, rivers, detailed water, roads, shaded relief.

## v0.6.1: "fix all" (2026-10-13)
- Connector lines from a locator's extent box to the main map are left out when either line would cross another part of the figure (legend, globe, credits). Before, "Locators below" drew two lines across the globe and the legend. (Figure.svelte `crosses`, segment–rectangle clipping test.)
- Measured pick → map: Dhaka District shows 1.3 s after the click (the 4 s reported earlier included the test's own wait).
- The two looks from the user's screenshots already exist: grey map = Style → Black and white; country map inside the main map = Layouts → Inset in corner.

## v0.7: full review with every installed skill (2026-10-13)
Review: Impeccable context + detector (0 real anti-patterns; advisories only), Vercel web-design-guidelines code review (25 findings, sub-agent), redesign/taste/minimalist visual audit from Playwright screenshots of every panel at 1440 px and 390 px, plus overflow checks at 360/390/768/1024 px.
Map (QGIS/ArcGIS look):
- Neighbouring districts are named in grey italic around the study area (Tangail, Gazipur, Manikganj, Narayanganj, Munshiganj around Dhaka). Labels sit in the visible part of each neighbour (new FrameProjection.centroidVisible); the study area itself and slivers under 40 mm² are skipped. New switch "Neighbour names".
Fixed bugs:
- Search list reopened by itself a few seconds after picking a place (late world-search answer); stale answers are now dropped.
- Boundaries panel used CSS variables that did not exist: keyboard-highlighted option and selected level were invisible. Data panel messages had the same problem.
- "Show on the map" switches for scale bar, legend and credits did nothing after the item had been deleted; they (and the Elements buttons) now put the default back.
- "No official boundaries" flashed while levels were loading; now "Loading levels…".
- Map +/− buttons covered most of the map on phones; on small pages they sit in a row under the page.
- Phone header: undo/redo kept; check pill becomes icon-only under 440 px; header no longer overflows at 390 px or 768 px (compact header up to 880 px).
- Error messages no longer vanish after 7 s; notes go after 9 s.
- Accessibility: 24 px+ touch targets on resize handles and long checkbox lists; focus returns to the button after closing menus and the side panel; two fixed live regions for data messages; clearer delete-button names; listbox label; hovered result contrast; Move up/down disabled at the ends.
- Touch: the page can be scrolled by finger unless something is selected or a drawing tool is on.
- Small things: no autofocus keyboard pop-up on phones, scale hint float noise, north-arrow style buttons wrap, plurals ("1 point"), thousands separators, copy-caption failure message, white browser theme colour, EPSG placeholder ellipsis, title-field hover.

## v0.8: simple by default (2026-10-13)
User: "still all looking and map looking complicated and complex".
Map, now plain like a journal location map:
- One country locator (globe off), bigger, top right; short legend below it (study area, rivers, boundaries only: "International boundary" and "Sub-district boundary" rows off).
- Credits text block off on the figure; the full credits are in the figure caption on Export (checker now shows this as a note, not a warning).
- Grid labels on the left and bottom only (new grid.sides 'two' | 'all'); lighter, thinner grid lines.
- North arrow without the white box.
- No automatic OpenStreetMap rivers and roads (they made small maps busy and slow); still available under Map parts > Add your own data.
- Saved maps get this look once on load (store makeClean, doc.clean flag).
Screen, fewer places to look:
- Side menu 7 → 4: Place, Design (styles + layouts), Map parts (on/off switches, locators, text, shapes, your data, and "All layers" folded away), Help.
- Place: Search / Your file / Draw. The separate Boundaries tab is gone because search already finds official boundaries; an "Add to map" button on a result adds a second district (Dhaka + Gazipur).
- Long help sentences removed; "Highlight" moved to a Map parts switch.

## v0.9: map scale, zoom to layer, custom dpi (2026-10-13)
User: "still some error, need custom dpi export, map scale zoom in/out, zoom to layer, more features".
- **Map scale box** (bottom right, like the QGIS status bar): shows the printed scale at the map centre (e.g. 1:471,000, three significant figures). Type any scale and press Enter, or pick 1:5,000 to 1:10,000,000 from the list; the map zooms about its centre to exactly that scale (actions.mapScale / setMapScale, measured with haversine over 10 mm at the centre). Map zoom range widened (0.01×–5000×) so street-level scales work.
- **Zoom to layer**: magnifier button on each layer in Map parts > All layers (your area, boundaries, sub-areas, country, your files, OpenStreetMap layers). World-wide layers (rivers, lakes, sea, terrain) have none. "Zoom to it" on Place returns to the study area.
- **Custom dpi**: "Or type any dpi (72 to 2400)" under the dpi buttons. Verified: 150 dpi PNG = 1122 px wide for 190 mm, pHYs = 150 dpi.
- Bug sweep with Playwright over search, scale box, zoom to layer, all 6 layouts, all 6 styles, every switch on/off, undo/redo, PDF/SVG/PNG/TIFF export, drawing, DIVA-GIS shapefile: no page errors, all four files downloaded.
- Fixed: Layers rows wrapped their eye button onto a second line; a map made from a file kept the old drawn-area title.
- Note: "1 to fix" after choosing a dpi under the journal's minimum (Elsevier 500 dpi) is the checker working as intended.

## v0.10: every layer is a layer; boundary levels anywhere; custom canvas (2026-10-13)
User: "can I change any admin level here (locator)? treat all as a layer so I can add and delete any layer; custom canvas, extend canvas".
- **Locator boundary level**: Edit panel of a country/region locator has "Boundaries inside": same as the main map, none (outline only), or any level that exists (Division, District, Subdistrict, Union...). InsetItem.adminLevel; scene buildInset swaps in that level.
- **Boundaries as normal layers**: Layer.adminLevel; any number of boundary layers, each at its own level, each with its own style, legend row ("Division boundary") and neighbour names option. The original Boundaries layer can be switched from Automatic to a fixed level. Levels load on demand (store.adminLevels, App effect).
- **Add a layer** (top of Layers): official boundaries at every level of the country, main rivers, lakes, detailed water and roads (OpenStreetMap), countries, sub-areas, shaded relief, disputed areas, your own file or points.
- **Delete any layer**: trash button on every layer row (except your area and the sea) and in its settings. Deleted standard layers stay deleted after reload (only maps from before v0.8 get missing layers back); they can be added again from Add a layer.
- **Layers has its own button again** in the side menu (Place, Design, Layers, Map parts, Help).
- **Custom canvas**: Design > Page size: type any width/height (30–1000 mm), or "Extend right/down +10 mm" which keeps every element in place; "Arrange the layout to fill the page" re-lays the chosen layout at the new size (applyTemplate keepHeight). Custom size limit raised from 420 to 1000 mm in the top-bar size menu too.
Tested with Playwright: Savar Subdistrict → locator set to districts → Division boundaries added → Rivers deleted → page 190×150 → 200×160 mm; no page errors.

## v0.11: options modelled on real published study-area figures (2026-10-13)
User: "look internet and search and look for research paper study area (real) and make best possible options".
Research (web search of published figures, e.g. Bhola district groundwater 2023: (a) Bangladesh (b) Bhola district (c)(d) upazilas with sampling dots; Bhawal National Park, Environmental Monitoring and Assessment: (A) Bangladesh (B) Dhaka Division districts (C) park; Himachal Pradesh figshare: country, state, DEM with sampling point; Esri inset-map guidance; AcadGIS paper). Recurring patterns: 1) drill-down panels country → district → study area with letters and zoom lines; 2) whole country with the study districts highlighted; 3) DEM/elevation background with an elevation legend; 4) sampling points with a locator. 4 was covered already.
Added:
- **Drill-down (a)(b)(c) layout**: (a) country with district lines, (b) the district around the study area (new locator type "Around it", InsetItem.context 'parent' + frameLevel, frames the official unit holding the study area), (c) the study area large; panel letters and framed legend.
- **Country overview layout**: whole country framed (zoom to the country layer), study districts highlighted, every district named, globe in the corner, framed legend.
- **Elevation colour bar**: with tinted terrain (Atlas style) the legend shows a hypsometric ramp swatch and "Elevation 0–1,546 m" from the actual terrain in view.
- Locators: "Around it" option with "Show the whole: Division/District… around the study area".
Fixed (regression since v0.6): the bundled boundary index left out level 0, so the official country outline (geoBoundaries ADM0) never loaded; "Countries has nothing to zoom to" appeared. Index rebuilt with ADM0 (232 countries).
Thumbnails for the two new layouts rendered from the app (Savar, Dhaka) and downscaled to 480 px.

## v0.12: no more overlapping parts; better file names (2026-10-13)
User: "fix overlay and legend position, and all things; save file name or data have to better".
- **Automatic placement** (new src/lib/placement.ts): a north arrow, scale bar or legend sitting on the map moves to the spot where it hides the least of the study area and nothing else (corners first, then edge positions, e.g. below a panel letter). Coverage is measured by sampling the study area paths (Path2D isPointInPath). Runs after every change of area, view, size or layout.
- Moving or resizing one of them by hand pins it (ItemBase.pinned); its settings have "Place automatically, away from the study area" to hand it back. Choosing a layout unpins everything.
- A legend on the map is only as wide as its longest line (less to hide behind).
- Side by side layout: legend now under the country map instead of on top of it.
- Checker: warns when two parts of the figure overlap ("Legend and Locator map overlap") or the legend covers over 20% of itself with the study area.
- **File names**: default "Dhaka_District_study_area_190x150mm_600dpi.tif" (title, size, dpi for images); editable "File name" field on Export (Doc.exportName). Project files use the same style (".studymap.json").
- **Data inside the file**: PDF title, subject (= figure caption with credits), keywords; PNG tEXt Title, Description (caption), Software. Verified with PIL.
Full Playwright sweep (search, scale box, zoom to layer, all 8 layouts, 6 styles, all switches, undo/redo, PDF/SVG/PNG/TIFF, draw, DIVA shapefile): no page errors.

## v0.13: edit any text, every map zooms, your own layers, satellite base map (2026-10-13)
User: "add or delete custom text; zoom in/out all maps, not only main; manually change any title or text; treat all maps equally; make any custom layer; add or use a base map inside (cropped) or outside, anywhere".
Text
- Double-click any text on the figure (title, notes, panel letters) or a locator map to type over it right there (Canvas text box; Enter or click away to finish). "Edit text" / "Label" buttons on the floating toolbar too. Add text from Map parts > Text, delete with the bin or Delete key.
- Legend settings list every entry: type to rename, untick to hide.
- Any layer that prints names (sub-areas, neighbours, points, files) has "Change or hide names on the map" (Layer.labelText: original -> new, '' hides).
Maps
- Locator maps zoom and pan like the main map: scroll over one to zoom about the pointer; click it, then drag inside to move what it shows (its edge still moves the box); toolbar − / + / Reset; settings Zoom in/out/Reset (InsetItem.zoom/panX/panY, scene insetView).
- Main map can be hidden from Layers > On the page like everything else. Main map zoom range in the wheel commit widened to match the scale box.
Your own layers
- Layers > Add a layer > "Draw your own layer (points, lines, areas)": a new layer (colour-blind-safe colour), drawing tools Point, Line, Area, Freehand, Rectangle, Circle; shapes go into that layer until Done; Remove last shape / Clear all; legend shows a point or line symbol when the layer has only those. New tools 'point' and 'line'; Enter or double-click finishes a line; Done also finishes an unfinished line or area.
- Bug fixed during testing: drawn shapes live outside the document, so they were never auto-saved (lost on reload). They now save on every change.
Base map
- Layers > Add a layer > "Satellite base map (Sentinel-2)": EOX Sentinel-2 cloudless 2016 (CC BY 4.0, publishable; credit added automatically), reprojected into the map's projection in a web worker (new imagery.worker.ts / imagery.ts), 5 px/mm on screen, up to 10 px/mm for export. Show it Everywhere, Inside my area or Outside my area (SVG clip with the study area paths, even-odd for outside), with a strength slider.
Tested with Playwright on Savar: locator zoom 2.9× + pan, "(a) Bangladesh" label typed on the figure, title typed, 3 points + 1 line drawn and saved, satellite outside the area; no page errors.

## v0.14: QGIS-style layout manager (2026-10-13)
User sent QGIS Layout Manager screenshots: "look at the layout manager, maybe you could do better".
Added to the canvas (desktop; phones keep the simple view):
- **Tool palette** (left column, like QGIS): Select/move items, Move map content, then Add text, legend, scale bar, north arrow, locator map, picture or logo, rectangle, ellipse, line, arrow. Pick a tool, then drag a box on the page (or click to place at default size); Esc cancels (store.addKind, actions.addInBox).
- **Rulers** in mm along the top and left (new Rulers.svelte), adaptive tick spacing, red cursor marks; **guides**: drag from a ruler onto the page, drag a guide's marker to move it, drop it back on its ruler to remove it. Guides are snap targets and never print (Doc.guides).
- **Status bar**: cursor x/y in mm, selected item size and position, page size.
- **Align** (left, centre, right, top, middle, bottom) to the page margins, or to the map frame when the item sits on the map; **Bring to front / Send to back**; **Lock** (locked items cannot be moved or resized; maps still pan) — on the floating toolbar and in Layers > On the page, which now lists front-most first with forward/backward, lock and show buttons (ItemBase.locked, actions.restack/alignItem).
- **Pictures**: new item kind 'image' (logos, site photos, charts): PNG/JPEG/SVG/WebP, scaled to ≤1600 px and stored in the project; "Whole picture" or "Fill the box" (cropped by an inner svg, works in PDF), optional frame, Replace picture.
Tested with Playwright: guide at x = 100 mm from the left ruler, text dragged out at 20,8 50×8 mm, a logo dragged in, aligned right on the map frame and locked; no page errors.

## v0.15: QGIS-style map item properties (2026-10-13)
User sent the QGIS map item properties (scale, rotation, CRS, extents, grids: type, interval, line style, frame style, divisions, per-side coordinates) and asked for the best user experience.
New "Map settings" panel (MapPanel.svelte; click the map, Settings, or Layers > Main map), in collapsible sections:
- **Main properties**: Scale 1:… (type or pick), **Map rotation** (slider/number, −180…180°, Reset), frame line, Projection (CRS) with EPSG input.
- **Extent**: North/West/East/South in degrees, Apply extent, Fit to my area.
- **Grid**: one-click looks (Journal, All four sides, Zebra frame, Crosses, UTM metres); grid type Lines / Crosses / Frame only; units Latitude/longitude or Metres in the map's projected CRS (e.g. UTM zone 46N, labels "220 000 E"); interval (degrees down to 10″, or 100 m–500 km); line colour, width, dashes.
- **Grid frame**: Ticks outside / inside / both, Zebra (black and white bars split into ~5 mm steps that change at every grid line, black corners), Line only, No frame; zebra width or tick length.
- **Coordinates**: format (DM, DMS, decimal), size, distance from the frame, and for each side Show (All, Latitude/Northing, Longitude/Easting, None), Where (Outside, Inside), Text (Across, Along); overlapping labels on a side are skipped.
Engine: projection.ts frame projection takes a rotation (fromCrs/toCrs, rotated forward/inverse); terrain and satellite workers honour it; panning and wheel zoom of a rotated map move along its own axes; graticule labels now found on every edge with their axis (so rotated maps are labelled), plus intersection points; new grid.ts (settings with defaults for older maps, projected metre grid, frame/zebra/ticks/coordinate placement).
Tested: zebra frame, UTM metre grid, 20° rotation with four-side labels, crosses grid on Dhaka District; full feature sweep (search, scale, zoom to layer, 8 layouts, 6 styles, switches, undo/redo, PDF/SVG/PNG/TIFF, draw, shapefile) without page errors; svelte-check 0 errors 0 warnings; build OK.

## v0.16: coordinates on any side in one click; locator maps get the same grid (2026-10-13)
User: "give me option to change for every area, left, right, up and down, grid; treat all maps equal; customize everything".
- **Side picker** (new SidePicker.svelte): a small drawing of the map frame with Top, Left, Right, Bottom buttons; click a side to show or hide its coordinates (left/right show latitude, top/bottom longitude; the full table for each side stays under Coordinates). It is at the top of every Grid section and in a new **Grid ▾** popover on the toolbar of the main map and of any locator.
- **Locator maps treated like the main map**: country, region and "around it" locators have the same grid controls (shared GridPanel.svelte: presets, lines/crosses/frame only, interval, line style, ticks or zebra frame, coordinates per side, format, size, distance); "Add a coordinate grid to this map" creates it. The grid is built with the same graticule code through an adapter around the locator's projection (InsetScene.grid). Plus "Frame and colours": frame width, sea, land, highlighted area and line colours, Reset colours.
- MapPanel now uses the shared GridPanel; no behaviour change for the main map.
Tested: Dhaka District, main map Top and Right turned on from the toolbar popover, country locator with a zebra grid and four-side coordinates; no page errors; svelte-check 0/0; build OK.

## v0.17: "now everything is broken" — debugged and hardened (2026-10-13)
Diagnosis: a fresh load worked; the user's open tab on the dev server (localhost:5173) had been broken by Vite hot-module reload while many files were edited in a row ("Cannot read properties of undefined (reading 'fn')" in the HMR client), after a 30-second window with a transient compile error.
Fixes:
- **Stable address** for testing: launch config "studymap-stable" runs the built app (`vite preview`) on http://localhost:4173, which never changes under an open tab.
- **Safety screen** (new Root.svelte, svelte:boundary around the app): if anything fails while drawing, a calm screen offers Reload, Try again, Download my map as a backup, Start a new map (backs up first, also kept as studymap.backup.v1).
- **Friendlier clicking**: clicking on the page only selects; the side panel stays where you were. Settings open from the toolbar's Settings button, double-click, or a name in Layers (store.select(id, open) / openSettings; closing settings returns to the previous panel).
- Bug: after undo, the Place panel could show the removed Boundaries view (way 'official' chosen from study.source 'admin'); it now opens on Search.
Verified on the stable build at 1366×768: fresh-load tour (search, select, drag, every side panel, Export, reload), old-version saved map (missing new fields, missing layer, extra globe) loads without the safety screen, every palette tool, every align/order/lock button, every grid preset, rotation, 15 undos + 5 redos, and the full sweep incl. PDF/SVG/PNG/TIFF exports — no page errors.

## v0.18: real-world test of eight places; data fixes; four-step guide (2026-10-13)
User: "fix all data, layouts, datasets; look how a person makes a map easily".
Tested as a new user on the stable build (1366×768) with Sylhet District, Kathmandu, Nairobi, Sundarbans, Bangladesh (whole country), Saint Martin's Island, Lake Victoria and Lyon. Found and fixed:
- **Whole country** picked in search used the OpenStreetMap border, which runs out into the sea (Bangladesh's study area covered the Bay of Bengal). Countries now use the official geoBoundaries land outline (actions.wholeCountry).
- **Country locator of a whole-country map** was a solid orange box; when the study area covers most of the country the locator shows the region around it.
- **Overlapping parts of an area** (e.g. Sundarbans sanctuaries) printed darker where they overlapped; the study area fill is now one shape.
- **Town-sized maps were empty** (Lyon): rivers and water are added automatically under 0.4°, streets under 0.15° (quietly, in the background); deleting them stops them coming back on that map (Doc.noAutoDetail). Main rivers stand in while detailed water loads.
- **Search ranked far places first** ("Saint Martin's Island" gave Michigan): results near the current map, or the user's own country, now come first (Photon location bias plus a near-first sort), and spelling variants are searched too (Saint ↔ St., Mount ↔ Mt., Fort ↔ Ft.; OSM writes "St. Martin's Island").
- **Official boundaries only for the home country**: countries that the search results point to are loaded as well, so "Kathmandu" offers "Kathmandu District, Official boundary, Nepal" first.
Making a map easily:
- **Four-step guide** at the top of the side panel: ① Place ② Design ③ Map parts ④ Export, with the current step highlighted and finished ones ticked (new Steps.svelte), and one **Next** button at the bottom of each panel ("Next: layout and colours", "Next: what is on the map", "Next: check and download").
Also found while fixing: a shell-quoting slip had put control characters into the spelling patterns; rewritten, and the whole src/ scanned clean.
Regression on the stable build: fresh-load tour, old-version map + stress test (all tools, align/order/lock, grid presets, rotation, undo/redo), full sweep incl. PDF/SVG/PNG/TIFF — no page errors.

## v0.19: four-way bug hunt, fixes, LinkedIn images (2026-10-13)
Four parallel code reviews (map geometry; state/data/async; canvas/rendering; panels/export/import), 54 findings, each checked in code; real ones fixed:
- History: undo/redo now restore the shapes (geoms) with each step; automatic touch-ups no longer block undo; New map and Open project start a fresh history; opening a file replaces old data and runs the same upgrade as the autosave.
- Saving: a full browser store keeps the study area and hand-drawn layers and tells the user (it used to silently keep an old save).
- Races: a slow place lookup can no longer overwrite a newer choice; "Loading boundaries" no longer gets stuck; old country boundaries are not left on a new country; official-boundary picks change everything at once.
- Drawing: Cancel throws away a half-drawn area; a cancelled touch commits nothing; resize past the opposite edge no longer jumps; the "drawn inside" outline uses what is on the map; old level/units cleared.
- Locked items: no nudging, aligning or handles. Escape: reverts inline text, leaves add tools, closes the grid popover; Escape that closes a top-bar menu does nothing else. Hidden items cannot be clicked. A picture placed by a click gets 30×20 mm.
- Grid: a fixed interval far too fine for the view is coarsened (prevented a page freeze); zebra bars from one axis with a minimum length (prevented a runaway loop); decimal-degree labels have enough decimals.
- Map: cache now reacts to renamed/hidden names, a boundary layer's level and the country name; areas across 180° get their real width; region locator box limited and densified; locator extent box no longer inverts for wide frames; neighbour names never printed inside the study area, visible-area test.
- Import: Europe/Canada CSV points were wrongly swapped (now only impossible rows are corrected); "Year" no longer taken as latitude; "-91.87W", "1e2", Unicode minus parsed correctly; geoBoundaries zips with a metadata .json import.
- Satellite gaps grey instead of black; failed OSM loads not retried in a loop; bold or italic (both together are not embeddable in PDF); size fields apply when finished typing; drawing tools stay on hand-drawn layers; locator grid labels 7 pt and checked; templates only touch their own title/letter, boxes never negative, height respects the journal; scale box reads "1:50,000", "50.000", "50 000"; geographic CRS detection accepts latlong/lonlat; safety-screen reload waits for the backup download.
- One regression found by the test suite during this work (an effect re-ran on the busy message it cleared: "maximum update depth") and fixed with untrack.
Verified: parser unit checks in the browser, targeted tests (Cancel, undo with shapes, click-placed picture, lock, Escape, 1:50,000), fresh tour, old-map stress test, full sweep with all four export formats — no page errors. svelte-check 0/0, build OK.
LinkedIn: linkedin/01-cover … 05-features.png (1200×1500 carousel) and linkedin/normal/ (plain app screenshots and figures at 2×).

## v0.19.1: raw website screenshots (2026-10-13)
- linkedin/raw/: 12 plain full-window screenshots of the app at 1600x900, 2x (3200x1800): start, search, Dhaka, Design, Layers, Map parts, map settings with zebra grid, Export, drill-down, terrain, satellite, Kathmandu.
- Bug found while taking them: "Fit" page zoom ignored the palette column and rulers, so the right side of the page was cut off on laptop-sized windows. Fixed (Canvas fit).

## v0.20: full re-check and final assessment (2026-10-18)
Fresh test suite (the old scripts were lost with a cleared temp folder); now kept in tests/ with test data and a README.
Results on the built app (localhost:4173): svelte-check 0/0, build OK; core suite 23/23 PASS (official result in 20 ms, Dhaka District drawn in 1.4 s, no pan/zoom task over 200 ms, 8 layouts, 6 styles, 14 switches, palette, align/order, undo/redo, grid presets, rotation, 4 exports, caption, reload, no page errors); undo step-by-step exact; 10 real places PASS; shapefile 75 areas PASS; CSV 4 points PASS; 6 screen sizes from 360 to 1920 px PASS (no sideways scroll, page fits, no tap target under 24 px). Exports verified: PDF 538.6 × 484.7 pt = 190 × 171 mm with Arimo embedded; PNG 2244 × 2020 at 300 dpi; TIFF 4488 × 4039 at 600 dpi; SVG valid XML, no NaN, no editor elements. First load 223 KB gzip; on a 1.6 Mbit/s, 150 ms connection the search is usable after 1.7 s and the world map shows after 3.4 s.
Fixed during the check:
- Search: "Lake Victoria" showed Inya Lake (Myanmar) first; results whose name matches what was typed now come before nearby partial matches.
- Map parts > Sample points / A map file created the layer but did not open its settings (regression from v0.17's "clicking only selects"); they open again.
- Layers > Add a layer > "Your own file or points…" did nothing (scrolled to a section on another panel); it now opens Map parts at the upload buttons.
- Phones: the map's + / − buttons sat under the scale box; they are now a column beside the page.
- Design detector: section triangles redrawn (clip-path) so the anti-pattern check is clean; one advisory left (monospace font name).

## v0.21: Grid button fixed; full evaluation with Haiku testers (2026-10-18)
User: "when I click grid nothing happens; I want all functions to work perfectly; evaluate everything; use Haiku as sub-agents and Opus as main agent".
Grid bug, reproduced in the browser: the Grid popover opened but was invisible, because the floating toolbar scrolls sideways (overflow-x: auto), which also clips anything below it. Fixes in Canvas.svelte:
- The Grid popover is rendered outside the toolbar, placed under the Grid button (gridAt), closing on Escape or a click elsewhere.
- Compact toolbar under 760 px wide: icon-only buttons (labels kept for screen readers), so it fits the window.
- The map's + / − buttons go beside the page only when the window has room; otherwise they stay inside the map corner (they were cut off at 800 px).
Verified in the browser pane (800×600): popover visible; Top and Right coordinates switched on from it and drawn on the map.
Evaluation round 1 (five Haiku testers: Place, Design, Layers, Editor, Export; Opus coordinating and verifying). Export and Design reported fully; Place reported fully; Layers and Editor stopped at a usage limit and were restarted on the fixed build. Fixes made from their findings (each re-checked):
- Export: checker list on phones was cut off the left edge (now a full-width sheet); Help claimed credits print on the map by default (Help rewritten in the words used on screen, says credits go in the caption unless Credits is on); a page too large for the dpi now shows the largest dpi that works with a one-click "Use N dpi" and the checker reports it; a typed file name only applies to the area it was typed for; phones can choose the journal in Design > Page size (shared setJournal action); Download button stays in view while the panel scrolls; clearer New map question.
- Place: "Paris" picked a village in Nepal and "Dahka" a village in Iran: results now rank country/region/city/district/lake/park above villages, streets and buildings, an exact name only counts for town-size places or bigger, nearness only breaks ties; identical rows removed; repeated official names say which unit they lie in ("Gazipur Union council, in Sreepur"; winding-proof lookup); Start over also clears the title, file name and search box; clearer empty-column and Esc wording. Also found while re-testing: on phones the results list was cut off inside the bottom sheet (now part of the panel), and loading all levels of every country a search touched delayed results (other countries now load provinces and districts only, when idle).
- Design: single-column journal pages (under 130 mm) use a stacked Classic layout (map on top, locator and legend underneath) — Nature 89 mm now Ready; the font-size finding has a "Make all text N pt or larger" button (top-bar check and Export); flat-ground terrain explains itself and Terrain settings gain "Always show, even on flat ground"; "Colour each area" labels the colour row "Outline colour" and explains; smallest page 50 mm; shrinking the page re-arranges the layout.
New test tests/suite-search.js (Paris, Dahka, St. Martin's, Lake Victoria, Gazipur repeats, Start over): all PASS. Core suite 23/23 PASS.
Text on the page (found by the Editor tester, reproduced): double-clicking a text opened the box but typing went nowhere, and a second "Add text" seemed to do nothing. Cause: Svelte's autofocus only focuses when nothing else has focus, and clicking the page kept focus on the tool button (pointerdown preventDefault), so typed letters were lost and Enter pressed the "Add text" button again (switching the tool off). Fixes in Canvas.svelte: the text box focuses and selects itself (focusSelect action); clicking the page moves keyboard focus to the page (arrow keys nudge, Enter no longer presses a toolbar button); after Enter or Esc focus returns to the page. "Add text" from the tool column now makes a box that says "Text" and opens ready for typing (Canva-style) instead of a bold "(a)"; the panel-letter "(a)" stays in Map parts.
User switched helpers to Sonnet sub-agents (Opus main) after the internet connection came back; Layers and Editor testers relaunched on Sonnet.
Regression after these fixes: core 23/23 PASS; undo exact (7→10→7→10, drawn area undoes); 10 places + shapefile + CSV PASS; search 6/6 PASS; sizes 6/6 PASS and keyboard 46 stops all with a visible ring (test fixed: a field's ring on its surrounding box counts, and the page itself after Tab wraps is skipped). New tests/suite-editor.js: typing after double-click, arrow nudge, second text by click typed at once, Esc cancels, Edit text button, Grid menu opens and toggles: all PASS.

## v0.22: fonts, a resizable page, and every tester finding fixed (2026-10-18)
User: "use custom font everywhere, and preloaded fonts for journals"; "extend or change or shrink the background white canvas" (confirmed: the page). The user also switched helper agents to Sonnet (Opus main).

Fonts (the user approved downloading open-licence fonts from the Google Fonts GitHub; licences are in public/fonts):
- New lib/fonts.svelte.ts with Arimo, Tinos, Carlito, Caladea and Cousine, four styles each. A font downloads only when chosen, so the first page download is unchanged.
- You can add your own .ttf fonts. Family and style are read from the font's name and OS/2 tables. They are kept in IndexedDB (not in the undo history) and packed into saved projects. PostScript .otf files and web fonts are refused with a plain message.
- Doc.font sets the font for all text. TitleItem.font sets one text's font.
- Text is measured in the chosen font, and measured again once that font loads.
- PDF embeds every style of every font used. PNG and TIFF are drawn with them. SVG files carry the fonts you added.
- Design gains a Font section that shows which fonts the journal accepts.
- Text settings gain a font menu, a multi-line text box, and bold and italic together.
- The checker warns when a journal names fonts that are not used (Elsevier, Springer, Nature, PLOS, IEEE), with a one-click fix.

Page:
- Bars on all four edges can be dragged. The zoom is held still while dragging. The bars also work with the arrow keys.
- Design > Page size gains:
  - extend or shrink each side in 1, 5, 10 or 25 mm steps;
  - width and height boxes;
  - "Trim page to its contents";
  - page colour: White, None (see-through PNG and SVG) or any colour.
- Parts keep their place on the paper. Parts a smaller page would cut off are moved back onto it.
- The same applies after a journal change: setJournal now calls keepOnPage. The new test found this.

Editor (Sonnet tester, 13 findings):
- North arrow and scale bar could not be dragged or nudged, because automatic placement kept resetting them. A drag or nudge now pins the part.
- When parts of equal size overlap, the top one is picked.
- Lines are picked only near the line itself.
- Text wraps at its box width. Shift+Enter starts a new line and the box grows to fit.
- Esc on a new text removes it. Empty texts are removed.
- Parts added by a click stay on the page. A note appears when the existing legend, scale bar or north arrow is moved.
- Align uses the map frame only for parts that are wholly inside it.
- Clicking the grey desk deselects.
- The scale box applies a typed value when you leave it. Esc cancels.
- No focus frame appears around the page after mouse use.
- Locked parts cannot be deleted.
- Ctrl+D duplicates. Ctrl+C and Ctrl+V copy and paste.
- "All grid settings…" scrolls to the Grid section.
- The page Fit button has a spoken label.
- UTM labels were missing on the left and top. Grid lines ended exactly on the frame, and rounding dropped them. A Sonnet helper fixed grid.ts by running the lines 5 mm past the frame, clipped. The side picker now shows metre samples.

Layers and Map parts (Sonnet tester, 11 findings):
- The globe locator switch now shows the globe in a free spot instead of under the country locator.
- New titles, letters, notes, shapes, north arrows and locators go to sensible free spots instead of piling up in the map centre.
- The draw and file panel no longer overflows the side panel.
- The satellite image no longer shows colour and line controls that did nothing.
- A terrain legend text you type is kept in Elevation colours. An emptied legend text shows the layer name.
- A damaged GeoJSON file gives a plain message.
- Adding boundaries that are already on the map opens the existing layer.
- The "OpenStreetMap is busy" note clears itself.
- Wording: "1 shape", sentence-case buttons, readable names in "On the page", and full layer names on hover.

Tests:
- New tests/suite-fonts-page.js: all 25 checks PASS. The exported PDF embeds the added font and the Courier look-alike as FontFile2, with no standard-font fallback.
- tests/suite-editor.js: PASS.
- core: 23/23 PASS.
- undo: exact.
- places: 13/13 PASS.
- search: 6/6 PASS.
- sizes: 6/6 PASS. No tap target is under 24 px (the page bars were enlarged to 24 px), and all 49 keyboard stops show a focus ring.
- svelte-check: 0 errors, 0 warnings.

## v0.23: a friendlier, more professional interface, shaped by what users say (2026-10-19)
User: "user friendly UI, good experience, professional vibe; look at Reddit or forums for user comments and improve it; Opus main, Sonnet sub-agents".

Research (three Sonnet agents):
1. Reddit / forums. Reddit is blocked for search tools, so about 9 r/gis and r/QGIS threads were read through a public archive, plus HN, QGIS trackers and journal guides. Pain points:
   - inset/locator maps;
   - fiddly grids;
   - odd scale-bar steps (2.5 km);
   - clutter;
   - legends;
   - export fidelity;
   - the learning curve.
2. Tools people call easy and professional (Datawrapper, Felt, MapChart, Canva, Figma, QGIS layout; HN, review sites, vendor blogs): no sign-up, no blank start, a linear flow, smart defaults, a preflight check, clear feedback, polish.
3. A first-time-user review of the running app: friendliness 7/10, professional look 8/10, 20 ranked issues (phones worst).
Two more Sonnet agents then made isolated changes:
- Place and search: grouped results, "Change area", plain file errors.
- Page size and Layout: compact side controls, consistent buttons, layout-size note.
Opus made the rest and reviewed everything.

Changes:
- First screen:
  - rulers and tool column appear only once a map exists;
  - the check reads a neutral "Journal check" (not "Ready") before a place;
  - shorter search placeholder;
  - "Try" before the example places;
  - a short promise list: free with no sign-up, no watermark, vector PDF at journal size, files stay on your computer.
- Place:
  - results grouped under "Official boundaries" and "Other places";
  - once an area exists, the chooser folds behind "Change area" (and stays open while drawing, so Shift can add shapes);
  - plain messages for unreadable files and for no connection;
  - shapefile explained in plain words.
- Design:
  - jump chips (Style, Font, Layout, Page size) at the top of the long panel; only the panel scrolls;
  - colour-blind preview (red-green, red-weak, blue-yellow, Machado 2009 matrices). It is on screen only, never in files, and switches off when Design closes;
  - Page size: compact 2×2 side controls, same-style Trim and Arrange buttons, one-line hints;
  - layout changes that resize the page say so.
- Map parts:
  - grouped into Map essentials, On the map and Locator maps, with one-line plain hints ("Most reviewers expect one");
  - the duplicate list of scale bar, legend, grid and credits buttons is removed;
  - clearer names ("Names inside the area", "Neighbouring boundaries").
- Page editor:
  - align and order are folded into one "Arrange" menu (the toolbar went from about 16 buttons to about 9) that says whether it aligns to the page or the map frame;
  - quick labels beside the tool column;
  - a thin loading bar while map data loads;
  - "Main map" and "Locator map" names;
  - new text boxes grow sideways as you type (Canva-like) and wrap only once you set the width by hand.
- Scale bar:
  - round 1-2-5 steps only (0 2 4 6 8 km, no more 2.5);
  - numbers thin out (every tick, every other tick, or just the ends) so they never run together.
- Top bar:
  - "Saved in this browser" with a dot;
  - the check button has a ▾;
  - reminders (paste the caption) are neutral grey, not success green;
  - "Ready" is listed first;
  - File menu reads "Open a project file…" and "Download project file".
- Journal check: problems about a part have "Show me" (selects it); a part sticking out has "Move it back onto the page".
- Export: Download is disabled until a place exists; after a download a toast names the file and the caption is suggested as the next step.
- Help:
  - rewritten as four step cards that open their panels;
  - an "On the page" table;
  - keyboard shortcuts as keys;
  - four common questions;
  - one credits line;
  - the panel is titled "Help".
- Layers: icon columns line up across rows; Layers no longer lights up the "Map parts" step.
- Phones:
  - the bottom sheet is taller (58% of the screen) with a grab bar to pull it to nearly full height;
  - it opens fully while searching, so results are never hidden;
  - the steps are compact;
  - nothing scrolls sideways at 360 px.
- Drawn areas spanning several countries are called "Custom study area".
- Flat-land note shortened.

Bugs found during the work and fixed:
- The Design jump (and "All grid settings…", Layers "Your own file") used scrollIntoView, which also scrolled the window and shifted the whole app up. Only the panel scrolls now, and the window is clipped (html, body overflow: clip).
- At 360 px the new ▾ pushed Export 13 px off screen. It is hidden on narrow phones.
- The grab bar was 18 px tall. It is now 24 px.
- Speed:
  - zoom/pan had crept to 170-345 ms tasks. A profile showed d3 geoCentroid and geoContains for every neighbour label on every rebuild.
  - Fix: cached per feature (scene.ts), plus a width cache in measure.ts.
  - Core smoothness check: 169 / 159 / 186 ms over three runs (limit 200).

Tests:
- suite-core: the align test uses the Arrange menu.
- suite-undo: drawing starts with "Change area"; a new text is committed with Enter (Esc now cancels a new text, as asked in v0.22).
- svelte-check 0/0.
- core 23/23 PASS ×3, editor PASS, fonts-page 21/21 PASS, undo exact, places 13/13, search 6/6, sizes 6/6 with no tap target under 24 px and focus rings on all 46 stops.

## v0.24: bold and italic for every text, a real colour picker, refined map styles, and pro editing (2026-10-20)
User: "Font bold or italic option everywhere; better colours and user experience; a user thing and work like a pro." Opus as the main agent with Sonnet sub-agents. Ultracode workflows were used for the independent review and the fixes.

Text styles (src/lib/textstyle.ts):
- One TextStyle (bold, italic, colour) for every kind of text, each with its own defaults, so old maps look the same. The types:
  - names on the map (per layer);
  - grid coordinates (main map and locators);
  - locator labels;
  - the north arrow letters;
  - scale bar numbers;
  - the legend title and entries;
  - credits.
  Titles keep their own fields.
- Figure.svelte draws them. Text measuring follows bold where layout depends on width: label placement, the legend's automatic width, the checker and credits wrapping.
- PDF exports embed the bold face. Checked by font box: the embedded box matches Arimo-Bold, not Arimo-Regular.
- Settings: a reusable TextStyleRow (B, I, colour, Reset) in the settings of every part and layer, and in Grid settings.
- Page editor: B / I / A− / A+ buttons on the floating toolbar, and Ctrl+B / Ctrl+I (also while typing on the page).
- Design, Font: "All text at once: Regular / Bold / Italic".

Colours:
- New ColorPicker (Sonnet), used everywhere a colour is picked: layers, text, page, grid, locators, shapes and any area colour. It offers:
  - colour-blind safe (Okabe-Ito), map tones, strong (Dark2) and soft (Set2) palettes;
  - recent colours;
  - a hex box, the system picker and an eyedropper;
  - full keyboard use and phone sizes.
- Map styles (Sonnet):
  - the six styles are tuned for print: land and sea at least 10 L* apart and readable in greyscale, study fills that print distinct from the sea, lines 3:1 or better;
  - four new styles: Journal grey, Coastal blue, Earth tones and High contrast;
  - new maps start in the refined Classic colours, and a layer put back takes the current style's colours.

Pro editing:
- Shift+click selects several parts. The group can be moved, nudged, aligned to each other (Arrange: Left/Centre/Right/Top/Middle/Bottom), spaced evenly (Across/Down), duplicated and deleted, with undo.
- My styles (Sonnet):
  - save a map's look and apply it to another map;
  - share it as a file;
  - set one as the default for new maps, which applies when the first area of a new map is chosen.
- The "Exact position and size" boxes are now open by default.

Independent review (ultracode workflow v024-review-qa, Sonnet agents):
- Four finders worked in parallel: text styles, multi-select, My styles with colours and map styles, and a browser tester.
- A skeptic then tried to refute each finding. 48 agents in all.
- Result: 33 findings confirmed, 7 refuted, and 4 left unverified because of a usage limit. I checked those 4 myself.

Fixes (workflow v024-fix-verified): four Sonnet fixers, each owning disjoint files, and a skeptic re-check per group. All groups re-checked as fixed with no new problems.
- Text:
  - The legend's automatic width and the checker now include the title.
  - Ctrl+B / Ctrl+I no longer swallow Ctrl+Shift+I (DevTools) or Ctrl+Shift+B, and ignore key repeat.
  - Shortcuts and the new group toolbar B / I style every selected part.
  - Title rows have no misleading Reset.
  - "All text at once" also styles names that are turned on later.
  - The locator-label editor shows bold and italic while typing.
  - Label halos turn dark for light label colours.
  - Added fonts without a bold or italic file: the screen no longer fakes bold or italic (font-synthesis: none), the export embeds only real faces, and the checker warns.
- Multi-select:
  - Stale group ids are cleared everywhere: load, reset, undo/redo pruning, and every panel button now uses select(null).
  - Shift+click on the map or empty space keeps the group.
  - A 3 px drag threshold, so a click on a member selects just it.
  - No resize handles while grouped.
  - Pointer-cancel restores the whole group.
  - Hidden parts leave the group.
  - Duplicate keeps the stacking order.
  - Locked parts are reported.
  - Spacing refuses parts that enclose each other.
  - Ctrl+C / Ctrl+V copy and paste the whole group.
  - Shift+clicking the last part away returns the panel to its tab.
- Styles:
  - My styles keeps one look per boundary level.
  - Layout-owned settings (legend frame, zoom lines) apply only when a layout is included.
  - The title look comes from the real title.
  - A default style no longer leaves a "Study area" placeholder title.
  - A first area from "Your file" also gets the look.
  - OpenStreetMap water and roads follow every map style (greys in Black and white and High contrast).
  - New locators take the style's marker colour.
  - Locator colour pickers show the colours actually drawn.
  - A fixed grid interval too coarse for the view falls back to automatic.
- Relief: the terrain image (shading and Atlas tint) is clipped to land, so the sea keeps its colour.
- Page panel: the whole "Colour" pill opens the picker. The Design jump chips wrap instead of clipping "My styles".
- My follow-ups:
  - Ctrl+B / Ctrl+I in the on-page editor also ignore Shift, Alt and key repeat.
  - Locked-part messages explain how to unlock.
  - Group shortcuts skip hidden members.
  - A part shown again (Map parts switches, showItem, addInset) is pulled back onto the page.
  - A visible layout title wins in My styles.

Tests:
- New tests/suite-pro.js: 17/17 PASS. The test stubs window.confirm, because playwright-cli run-code stops silently at native dialogs.
- core 23/23 (smooth 149 ms), editor 7/7, fonts-page 21/21, undo exact, places 13/13, search 6/6, sizes 6/6 + keyboard 46 stops.
- svelte-check 0/0; build OK.
- An all-bold PDF embeds the Arimo Bold face; its FontBBox is −482, matching Arimo-Bold, not Regular's −544.

Browser re-test of the fixes (Sonnet, 12 checks): all 12 PASS. Shift+click group Bold and Ctrl+B; Ctrl+Shift+I passes through; Shift+click on the map keeps the group; a 1-2 px wiggle selects one member; duplicate keeps stacking order; the panel returns to its tab; the legend fits a long title; white names get a dark halo; Atlas sea stays #B7D3E4 on a coastal map; Black and white has no colour at all (OSM greys); the Page colour pill opens the picker; My styles keeps each boundary level; Escape/Delete in a picker never touch the map. From its notes, also fixed: adding OpenStreetMap water or roads that is already on the map now opens the existing layer instead of drawing a duplicate; the page colour picker is labelled "Choose a page colour". pro 17/17 and core 23/23 after these.

## v0.25: several areas on one map, tabs instead of long panels, more scale bars and styles (2026-10-20)
User: "if everything in Design is in one area users have a tough time; show Dhaka and Gazipur together, choose or merge anything; user flavour; easy to find features without scrolling; more styles, designs and scale." Opus main, two Sonnet agents (tabs; scale bars + styles).
- Several areas (Opus): "Add another area" in Place takes any search result (any level, any country, cities, lakes, parks); every search row also has "Add to map" once an area exists. The areas are listed with x to take one off. "Show as": One area (merged: new lib/dissolve.ts removes every border two areas share and chains the rest into rings; tested on adjacent squares, opposite windings, separate squares and a ring with a hole), Separate (own outlines), Coloured (own colour and legend line each). Units of one country and level stay official units; others are joined as shapes (source place, STUDY_GEOM). App resolves areas through setStudy (store.studyParts keeps the unmerged parts). Names read "Dhaka District and Gazipur District".
- Recent places ("user flavour"): the last 6 places chosen are one-click chips above the examples.
- Tabs (Sonnet): Design = Colours / Text / Layout / Page / My styles; Map parts = Essentials / On the map / Locators / Add, each with a one-line description; one section at a time; reusable SubTabs (role=tablist, arrow keys); last tab remembered; tests updated to click tabs. "Design, Font" wording now "Design, Text".
- Scale bars (Sonnet): 5 designs (Blocks, Line, Ticks, Double, Hollow) with a visual picker, numbers above or below; backing sized per design.
- Map styles (Sonnet): Pastel and Vintage (12 styles).
- Tests: new tests/suite-areas.js 10/10 PASS (two areas, one merged outline, two separate outlines, coloured legend lines, a third area joins, x removes, recent places, Design tabs, Text tab alone, 5 scale designs). core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, places 13/13, search 6/6, sizes 7/7. svelte-check 0/0, build OK.

## v0.26: all six skills run on the website, then fixed (2026-10-20)
User: "Can you run all my skills there??" Opus main. Five Sonnet reviewers ran read-only, one per skill: web-design-guidelines (43 items), impeccable audit + critique (audit 13/20, heuristics 28/40), redesign-existing-projects, design-taste-frontend + minimalist-ui, and playwright-cli end to end (no page errors; 6 bugs). Three Sonnet fixers owned separate files (Canvas; Place/Search/Layers/Edit/ColorPicker/TextStyleRow; Export/Page/Font/Map/SubTabs/Templates/Rail/Rulers/SidePicker/Elements/Style/index.html). Opus did app.css, App, SidePanel, Steps, TopBar, store, actions and placement, plus the e2e bugs.

Kept on purpose:
- The taste/minimalist advice to swap the survey-blue accent for black buttons, warm the greys and flatten the tabs was declined. It conflicts with the product's own DESIGN.md look.
- Dark mode was not added (a print-proof editor; the page must stay white).
- Native confirm() stays for New map and for deleting a font or a style. These cannot be undone.

Keyboard and screen readers:
- Navigation and focus:
  - A "Skip to the map" link, with the map area as `main#map-page`.
  - Delete and Backspace only act when the keyboard is on the page.
  - The edit panel heading takes focus.
  - Focus returns to "Change area" only after a keyboard pick.
- Menus and option groups:
  - File, Size and Check menus: focus moves to their first choice, Tab out closes them, and they have aria-haspopup/controls.
  - Arrange and Grid popovers: focus moves in, arrow, Home and End keys move between items, and Esc returns to the button.
  - Radio groups (page colour, fonts) use roving tabindex with arrow keys.
- Announcements and labels:
  - The toast uses role=alert for problems, and a single live region announces loading.
  - The page has a short label ("Map page") plus a hidden description of the figure.
  - Hidden file inputs are aria-hidden. Reset buttons, X/Y/W/H fields and colour buttons have their own names.
  - Search announces its result count, and Shift+Enter adds the active result to the map.
- Visible focus:
  - A solid focus ring on the page.
  - Rings on file-picker labels and on the "Add a layer" select.

Seeing and touching:
- Contrast:
  - Text fields and switch tracks have a 3:1 edge (--line-input).
  - --ink-3 is darker.
  - The disabled "Choose a place first" button is readable, and so are steps that are not available yet; both say why.
- Touch and small type:
  - On touch screens every control is at least 44 px.
  - Text is no smaller than 10-11 px.
  - Pressed feedback on every button family.
  - Windows high-contrast rules.
  - Reduced motion keeps colour feedback, and the load bar animates transform.

Layout:
- Desktop:
  - The steps row now names the panel, so the panel title is kept for screen readers only ("Place" was shown three times).
  - The map zoom buttons sit beside the page when there is room, and are faint on the map otherwise. They had been hiding the legend in Country overview.
  - The status bar text truncates before the scale box.
- Phone:
  - Sheet 46 dvh; the map always keeps 160 px, so it no longer vanishes at 200% zoom.
  - Rename the map from the File menu; a saved dot.
  - Export becomes an icon at 360 px.
  - The page is drawn larger (273 px on a 390 px screen, was about 190).
  - The Download button is not sticky.

States and forms:
- Undo in the toast after Start over, Delete, Delete all, removing a layer and clearing shapes.
- Page size, dpi and map-extent fields say what they changed or what is wrong, instead of silently snapping. The top-bar size limits now match the Page panel (50 to 1000 mm).
- The file name shows in full.
- "Elsevier accepts" became "Elsevier takes this format", since only the format is checked.
- Search: "The place search is slow right now…" after 6 s, and the previous results are cleared after 0.7 s so nobody picks Paris while Lake Victoria loads.
- index.html: noscript, color-scheme and Open Graph tags.

Playwright e2e bugs fixed:
- Trim cut the grid numbers. trimPage now includes drawn text outside the frames (drawnTextBox).
- New parts landed on the study area. freeBox now prefers spots that leave the area clear (store.cover from placement.studyCover) and tries the edge middles when the corners are taken.
- A switched-off locator stayed selected.
- The phone Download button covered the dpi field.

Tests:
- core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, places 13/13, sizes 7/7 (keyboard: 48 stops, all with a ring), areas 10/10, search 5/6.
- The search failure is the outside service: Photon took 5 to 46 s today. Saint Martin's Island is found correctly after 8.2 s, but the test waits 6 s.
- Extra checks: trim keeps every label on the page; Start over then Undo brings the area back; the map stays 160 px tall at 683x384; the phone step labels fit.
- svelte-check 0/0, build OK.

## v0.27: clicking the page shows its size tools (2026-10-20)
User: "when I click canvas, its properties (extend or shrink option) is not coming."
- Cause: a click on an empty part of the page only deselected. The edge handles were faint grey bars, hidden on phones and before a place was chosen.
- Now a click on an empty part of the page, or on the grey desk around it, selects the page:
  - the page gets a blue edge, and its four edge handles turn blue;
  - a "Page tools" toolbar appears: Page W × H mm, Width − +, Height − + (10 mm steps, parts kept on the page), Fit to contents (trim) and Page settings (opens Design, Page);
  - on phones the toolbar wraps onto two rows.
- Clicking any part swaps to that part's tools, and Esc closes the page tools.
- Help lists it under "On the page". SidePanel exports openDesign(part) so the page toolbar can open the Page tab.
- Tests: new tests/suite-page.js 8/8 PASS. core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, sizes 7/7 (48 keyboard stops, all with a ring). svelte-check 0/0, build OK.

## v0.28: balance and colour, on the map and in the editor (2026-10-20)
User: "overall design science and balance and coloring could be better" (both the map and the editor).

Map figure:
- Balance (Classic, and the default new map in defaultItems):
  - the side column is anchored to the map frame at both ends: the locator at the top, the legend and scale bar at the foot, level with the bottom of the map;
  - credits, when switched on, take the middle;
  - the scale bar leaves the map, which is less cluttered;
  - App's legend sizing keeps a "footed" legend's bottom edge and grows upwards (its bottom is on the map's bottom line, or just above a scale bar).
- Visual hierarchy: grid lines are drawn under the study area (Figure gridUnder), so the reference recedes behind the subject and shows faintly through its tint. Previously they were drawn over everything.
- Colours, checked on a contact sheet of all 12 styles (Sylhet):
  - Atlas study fill 0.14 → 0.06. The elevation colours show through clean, instead of a muddy olive.
  - Black and white 0.30 → 0.24, and Earth tones 0.34 → 0.26, so names stay readable over relief.

Editor:
- One colour signal at a time:
  - "Ready" is a quiet outline with a green tick; only a problem fills the pill;
  - finished steps show an ink tick, not a green circle;
  - blue is kept for where you are and the main action.
- One corner scale, applied everywhere through tokens: panel 12, card 10 (new --r-card), control 8, chip 6. Replaced 72 hard-coded radii.
- Lighter popover shadow (--shadow-2).
- Group titles 13.5 px / 650, for clearer section heads.

Tests:
- core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7, areas 10/10, page 8/8.
- places 6/13 and search 2/6: only the online-place checks failed. Photon answered in 10 to 11 s this hour (curl), past the tests' 6 s wait; the offline official-boundary checks all pass. Search code was not touched in this change.
- svelte-check 0/0, build OK.

## v0.29: new look "Field Notebook" and calmer panels (2026-10-20)
User (with four screenshots of the side panel: Design > Colours, Layers, Map parts, Layout): "this part could be better", "please give a better theme and I want whole website a good flow".

Process (impeccable skill, new-work playbook, Operate mode):
- Context was loaded, and seven grounded directions were listed from the researcher's own world: survey sheet, journal page, school atlas, thesis binding, Swiss cartography, field notebook, drawing title block.
- concept-seed (seed 810c6110) assigned candidate 6, Field notebook, and dealt 6 challengers.
  - Verdicts: Signed Route (airport wayfinding) and Plate and Text (lexicon) were competitive. Emission lines, stamp catalog, type specimen and timetable were declined, and each donated one discipline.
- A decision page (impeccable serve-question) showed 5 full cards with code-led HTML sketches (Sonnet agents) plus the 4 declined cards.
  - The user chose **Field Notebook**.
  - The direction contract was saved in .impeccable/surfaces/src-app-svelte.md.

Built (Opus shell; Sonnet for the six panels):
- Tokens (app.css):
  - cover yellow #f2c230 on the top bar and rail only (active #e0ae14, edge #c99a12);
  - graphite #2b2d2f as ink and the one main button;
  - ruling blue #2f6fb5 for selection, focus, the current step and handles;
  - margin red #c8372d as a 1px rule down the panel;
  - graphite-tinted shadows.
- Desk: graph paper ruled in the page's own millimetres (5 mm and 10 mm, plus 1 mm from 7 px/mm). It scales with zoom and lines up with the page edge, set through Canvas --mm/--ox/--oy.
- Steps: state by line form (to come is dashed, done is solid graphite with a tick, now is blue with an underline, unavailable is struck).
- Sub-tabs are words underlined in blue, sized to their text.
- The segmented control is an outlined track; the chosen option has a blue ring and wash, on one line.
- Panels:
  - Map styles: a compact 4-column grid, all 12 on screen with the current name beside the heading.
  - Layers: only the eye is always visible; reorder, zoom and delete appear on hover, focus or selection (always on touch). "Add a layer" is a dashed button.
  - Map parts switches, Export formats, My styles and Help are ruled rows, not cards.
  - Layout: tighter thumbnails.
- Strict type ladder 11.5 / 12.5 / 14 / 16 / 20 across the whole chrome, plus a single 24 px display step.

Review:
- Fresh Sonnet finish reviewer: disposition **fix**, 8 material items. All 8 were fixed:
  - unavailable steps struck through;
  - export formats as ruled rows;
  - the type ladder;
  - the title underline at 3.6:1;
  - Phosphor arrow;
  - taller phone sheet;
  - segment text on one line;
  - readable disabled main button.
- First verdict pass: 7 resolved, the ladder partial. Ladder swept. Second verdict: **ship**.
- Detector: 0 anti-patterns (only drift against the old DESIGN.md).
- The documenter rewrote DESIGN.md and .impeccable/design.json for the new world. Its drift notes were fixed: the toolbar primary is now graphite, old blue-grey shadows recoloured, and 16 px radii moved onto the scale.

Tests: all ten suites pass.
- core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7 (48 keyboard stops, all ringed), areas 10/10, page 8/8.
- places 13/13 and search 6/6 (Photon fast again).
- svelte-check 0/0, build OK.

## v0.30: smoother map, tidy left panel and size menu, proper empty page (2026-10-21)
User, with screenshots of the size menu, the empty start page and Design > Colours: "maps looks buggy and all left panel looks shit", "map feels choppy", "design should be better"; continue after a usage-limit reset.

Choppy map (measured, not guessed; Playwright + CDP, also at 4x CPU slow-down):
- Drawing data cut from 1.44 MB to 0.40 MB:
  - the country locator drew full-detail district lines with points far outside its box;
  - scene.ts insetBase now clips at the frame (clipExtent) and thins to 0.06 mm.
- Each outline is converted to the map CRS (proj4) once and kept:
  - projection.ts inCrs/crsGeom, WeakMap per feature per CRS;
  - then thinned in flat CRS units to 0.04 mm on the page (new lib/simplify.ts, cached per zoom step);
  - pan and zoom no longer re-run proj4 on outlines;
  - label areas/centres use the stored CRS geometry, and whole-outline area/centre are cached (crsMeasure).
- Result on a 4x slower CPU: the pause after a pan went from about 245 ms to 170 ms (about 40 ms at normal speed); the drag itself stays at 8 ms frames.
- What is left is ordinary path writing, Svelte DOM updates and the coordinate grid (buildGraticule); noted for later.
- The graph-paper desk was tested and costs nothing measurable.

Empty page:
- Before a place is chosen, the world map fills the whole sheet (defaultItems map w = W - 12) instead of a narrow frame beside blank paper.
- applyTemplate gained an asFigure flag: the empty page keeps the full-width world; freshLook (first area, all four ways) lays out the real figure. It is passed through applyStyle/applyDefaultStyle.
- "Start over" brings the full-width world back.

Size menu: each publisher is one row, with the name in its own column and its sizes lined up beside it; rows are ruled; the menu is 480 px wide with a taller list. Opening a menu with the mouse no longer puts a focus ring on its first chip (only keyboard opening moves focus in).

Colours panel:
- The 8 colour dots sit on one row at any panel width (grid, 28 px).
- Option groups with more than three options are an even two-column grid (an odd last one takes the full row), so there are no ragged wraps; this also covers the colour-blind check and two Edit panel groups.
- Map styles are three across with one-line names (two even lines in the narrower panel).
- The colour-blind hint is shorter.

Tests: all ten suites pass.
- core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7 (48 keyboard stops, all ringed), areas 10/10, page 8/8, places 13/13, search 6/6.
- Figures checked by eye are unchanged (Dhaka, Sylhet).
- svelte-check 0/0, build OK.

## v0.31: white cover, page drawing, calmer panels (2026-10-21)
User (screenshots of Colours, Map parts, Add, Page, My styles, the size menu): "fix this part", "yellow color looks shit", "maybe you can give better design and make it better".

Cover:
- The top bar and rail colours are now one token set in app.css (--cover, -deep, -edge, -hover, -ink, -ink-2, -chip*, -action*, -focus, -line, -mark*, -active-ink). TopBar.svelte and Rail.svelte use only these, and the menus inside the bar reset to panel ink.
- Five covers were screenshotted on the real app: yellow (then current), clean white, soft blue-grey, deep navy, field green. The user chose **clean white**.
- White is now the default; the trial covers were removed.
- The rest of Field Notebook stays: graph-paper desk, red margin rule, graphite ink and main action, ruling-blue state.

Panels:
- Page tab, "Grow or shrink one side": the page is drawn small at its real proportions (fitted in 150×100 px, size shown), with a minus/plus pair on each edge. This replaces four boxed −10/+10 groups. The aria-labels are kept ("Shrink bottom side by 10 mm" and so on).
- Disabled main button: a quiet panel-2 shape with ink-3 words, not a dark grey block (for example "Save this look" before a name is typed).
- Add tab: "Add your own" and OpenStreetMap options are ruled rows with 32 px icons, the same as the Text list; no cards.

Docs:
- DESIGN.md and .impeccable/design.json were updated by the documenter: Quiet-Cover Rule, page drawing, menus, segment grid; graphite-off removed. The stale yellow comment and the unused --accent-off token were removed from app.css.
- Surface brief contract updated (white cover, 3-column styles, 5/10 mm ruling).

Tests: all ten suites pass.
- core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7, areas 10/10, page 8/8, places 13/13, search 6/6.
- svelte-check 0/0, build OK.

## v0.32: Colours panel redesign, then every design skill run again and fixed (2026-10-21)
User: "this panel looks so ugly and wtf is red line, please fix and use best combination, u can use all 4 skills", then "run all skills for better design".

Colours panel (first pass):
- The red margin rule and its token are removed.
- Map styles are tiny real map previews (SVG in each style's colours: sea, land, dashed neighbour, river, study area), three across.
- The segmented control is a soft grey track with a white raised chosen key.
- Custom sliders with the value at the right in an `<output>`; all 23 sliders in Edit, Grid and Map converted.
- The colour-blind check is a single select.

Skills round (all six skills):
- A fresh 35-shot set (1440, 1100, phone) was reviewed by four Sonnet reviewers: impeccable critique (28/40), design-taste + minimalist-ui, redesign-existing-projects, and web-design-guidelines (25 items). Playwright took the shots and re-tested.
- Agreed findings:
  - Text says the same thing three times at the top of each tab.
  - Five "chosen" styles.
  - Six spacing rhythms and three accordion styles.
  - Bugs: disabled primary hover went dark; Place panel widened on typing; Main map boxes overflowed (grid auto column); Export overflow at 1100; Layers names truncated; page did not fit the desk at 1100 (the Canvas judged "phone" by desk width).
- Lead (app.css and the shell):
  - Shared patterns:
    - `.stack` rhythm (16 px between hairline sections, 10 px inside, `minmax(0,1fr)`, min-width guard);
    - `.acc` / `.acc.quiet` hairline accordions with +/−;
    - `.row-switch` with a global role=switch;
    - `select.input` drawn caret; placeholder colour;
    - `.btn.danger`;
    - disabled buttons never hover;
    - sliders with a 3:1 track, 18 px thumb (28 touch) and forced-colors rules;
    - the seg chosen key edge at 3:1;
    - `.msg:empty` stays in the accessibility tree;
    - `.grid2` minmax;
    - accordions in a row touch.
  - Steps: blue disc = now (always, even once done); unavailable = faded dashed (no strike); a connector line turns solid after a done step; sr "Done:".
  - Sub-tabs: words only; Design order Colours, Layout, Text, Page, My styles; a one-line note only on Layout, My styles and Locators.
  - Foot: soft edge; Download moved into the foot on Export (store.exportRun / exportLabel / exportDisabled); the disabled Next hides its arrow.
  - Canvas: phone versus desktop judged by window width (at 1100 the page fits, and rulers and tools come back); fit margin 72; toast fade/rise; toolbar wash text in accent-ink; the grid popover uses a switch.
  - Rail: one-line labels at 1100.
  - TopBar: disclosure semantics (no aria-haspopup), journal-check severity words for screen readers, check-pill hovers, dead `.busy` removed.
  - App: IconContext makes every Phosphor icon aria-hidden.
  - Weights collapsed to 400/500/600 (700 wordmark and display).
- Sonnet B (Style, Font, Templates, Page, MyStyles, Help):
  - colour-blind check as an accordion with an "On" note; paired sliders; a "+" on the any-colour dot;
  - font list as ruled rows; font info in an accordion; "Set all text to" as action buttons;
  - inline Delete/Keep (no confirm);
  - layout names only (notes in tooltips);
  - Page split into Size and Colour; page drawing in "Fine-tune one side"; "Trim to contents" / "Fill the page" (aria names kept); limit feedback;
  - My styles inline Replace and Delete;
  - Help accordions; outlined number discs.
- Sonnet C (Elements, Uploads, Layers, Export, Place, PlaceSearch):
  - repeated titles gone; north-arrow style tiles show the chosen one ("Arrow style"); verb tile names; Text as a 3-up tile row;
  - one-line upload captions; "From OpenStreetMap";
  - Layers: actions in a fading overlay, so names keep full width;
  - Export: dpi numbers only, accepts-note on the title line, file name with an in-field suffix, summary row removed, green success, Download via the foot;
  - Place: actions as one ruled list, card and boxes removed, quiet promise list;
  - search: width fixes, a "nothing found" hint instead of an error.
- Sonnet D (Edit, Grid, Map, TextStyleRow, SidePicker, ColorPicker, StudyPanel):
  - every element type in titled sections;
  - `.sec` / `.more` became `.acc`;
  - "Place automatically" as a switch in Position and size;
  - 23 checkboxes became switches;
  - X/Y/W/H label-in-name;
  - rotation as a labelled group;
  - "Fit to area"; pills to chips; the red "none" slash became ink-3.
- Follow-ups:
  - Layers: only the action buttons take clicks; the faded strip passes clicks to the name. This was found by suite-pro: a hover overlay stole the click on the name.
  - Test updates: suite-fonts-page opens "Fine-tune one side" first; suite-editor finds the grid toggle as a switch.
- Checked:
  - no sideways overflow in any tab or element panel (all sections open) at 1440, 1100 or 390;
  - DESIGN.md and design.json updated by the documenter, and the surface contract updated.

Tests:
- Full run before the follow-ups: core 23/23, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7, areas 10/10, page 8/8, places 13/13, search 6/6, pro 16/17.
- After the Layers fix: pro 17/17, editor 7/7, core 23/23; then a full re-run of the rest on the final build: fonts-page 21/21, undo exact, sizes 7/7 (48 keyboard stops, all ringed), areas 10/10, page 8/8, places 13/13, search 6/6.
- svelte-check 0/0, build OK.

## v0.33: ticks only with coordinates, rivers off, layer order fixed, drawing on the map, clearer drill-down (2026-10-21)
User: "if there is no coordinate maybe no tick box, and do not load river layer by default, and layout style will be better, also sometimes layer on/off and up/down do not work properly, and maybe I could draw or add new text and all kinds of things, think like a professional app".

- Grid ticks: `grid.ts` draws a side's tick marks only where that side writes coordinates (show `none`, or a different axis, means no ticks).
- Rivers start off: `defaultLayers()` makes Rivers `visible: false`; the automatic OpenStreetMap detail adds roads only when zoomed in (no automatic water).
- Layers up/down: `move()` steps past hidden layers, so every click changes the map; at the ends, hidden-only stretches send the layer to that end. Page parts `restack()` does the same.
- Rivers and Lakes while the detailed "Rivers and water" layer is on: their row is faded, the eye is disabled and a tooltip says why (that layer draws the water instead).
- Drawing on the map: `drawOnMap(tool)` in `actions.ts` makes (once) a "My drawing" vector layer with its own legend line, selects it and starts the point, line, area or freehand tool.
  - Entry points: a second group of four buttons in the left tool strip, and a "Draw on the map" section of four tiles in Map parts, Add. Both are disabled until a place is chosen.
  - The Add tab's shape tiles now have names (Rectangle, Circle, Line, Arrow).
- Drill-down layout (a)(b)(c):
  - `parentLevel()` in `scene.ts`: the "surroundings" locator shows the level above the study area (a district map shows its division, not the district again).
  - Panel letters like "(a)" sit top-left on a small white backing, like "(c)" on the main map; other inset labels stay bottom-left.
  - Zoom box: lighter fill (0.07) and a 0.8 mm outline; the inset's study fill is 0.45.
  - Zoom lines: a small panel-letter title no longer blocks them, they end on the stretch of the map edge that faces the inset, and they draw on top of the inset.
- Checked with a scripted run (`v34.js`): rivers off, no automatic water, 8 tick marks on the two labelled sides, the My drawing layer made and drawn into, Boundaries moved up past a hidden layer, no page errors; drill-down screenshot shows (b) as the division with both zoom lines to (c).
- DESIGN.md: new "Tool strip" component note (the two groups, the disabled map-drawing group, the My drawing layer).

Tests (full run on the final build): core 23/23, pro 17/17, fonts-page 21/21, editor 7/7, undo exact, sizes 7/7, areas 10/10, page 8/8, places 13/13, search 6/6; no page errors. svelte-check 0/0, build OK.

## v0.34 review: skills run again plus a feature study (2026-10-21, no code changed)
User: "also run skills and look for any feature is possible or not (give me list before implementing)".
- 40 fresh screenshots in `.impeccable/review/v34/` (1440, 1100, phone).
- Four Sonnet reviewers, all read-only:
  - impeccable critique plus the redesign, taste and minimalist audits: 29/40;
  - web-design-guidelines plus the impeccable audit, checked in code and live;
  - hands-on QA of 8 real flows at 1366, 1100 and 390: no console errors, and exports and autosave work;
  - a feature-gap study against QGIS, ArcGIS, Canva, MapChart, Datawrapper and Felt.
- Spot-checked by me: the red ruler line (`Rulers.svelte:111`) and the slider label bug (the `<output>` inside the label takes the label).
- Combined list in `.impeccable/review/v34/findings.md`: 19 bugs (A), 13 design items (D), 24 possible features (F), and what is not possible under the no-login, $0 rules. Sent to the user to choose from; nothing is implemented yet.

## Panels, accessibility and search pass (panel agent)
- Slider names: every `<output aria-hidden>` inside a slider label is now `<span class="val" aria-hidden="true">` (output is labelable and stole the label). Checked in the browser: all 30 distinct sliders have exactly one label and a name (Map rotation now sits in its own hidden-text label). DESIGN.md updated.
- Export: the file name is one field drawn as a flex row, the name ends in an ellipsis and the extension sits after it; the full name is in the title.
- Style name "Black & white" (fits the tile); suite-core updated.
- Layers: on touch (hover: none or coarse) a row is swatch, name, dots, eye; the dots open move, zoom and delete on a line under the row. Rivers and Lakes under "Rivers and water" say "Drawn by Rivers and water" under the name; the eye is aria-disabled, linked by aria-describedby, and is not "pressed". Smooth scroll respects reduced motion.
- app.css: forced-colours outline for chosen things, 16 px fields on touch, 44 px touch targets (Layers add, search clear, example chips, Add to map, panel close, ticks in the legend entries, .check rows), text-wrap: pretty for hint-like text.
- Curly quotes in “My drawing”; Help describes the new tool strip (menus, drawing keys); search results name the parent ("in Dhaka Division") and put the country once in the group heading.
- tests/suite-places.js: fresh() clears storage from favicon.svg, because the app now saves its map when the page is left and brought the old map back.

## v0.35 round 1: every bug from the review, a new tool strip, and "click anything, change anything" (2026-10-21)
User: "when I click any feature I should be able to customize everything, A to Z should be customizable … and I want all". Plan and status: `.impeccable/review/v34/findings.md`.

Canvas agent (`Canvas.svelte`):
- Tool strip: 7 buttons (Select, Hand, Text, Map parts, Shapes, Picture, Draw on the map); the three groups open labelled menus (keyboard, Esc, last-used icon); the strip scrolls with an edge fade on short screens.
- Drawing:
  - Double-click never leaves the tool.
  - Ctrl+Z and Backspace remove the last point while a line or area is in progress.
  - Esc finishes a valid shape.
- Phone drawing:
  - Done always shows.
  - The sheet closes while drawing and reopens after.
- Toasts:
  - Width is max-content up to 560 px.
  - Drawing hints clear when the tool ends; plain notes go in about 4 s.
- The map zoom (+ − fit) moved off the figure into the scale box.
- Selected-part toolbar: "Hide" labelled, a hairline, then Delete (red on hover).
- forced-colors styles.
- Tests: suite-core, suite-fonts-page and suite-undo open the tool menus first.

Panels agent: slider names, export file name, "Black & white", Layers touch rows and the aria-disabled eye, forced colours, 16 px fields and 44 px targets on touch, text-wrap, Help for the new tools, "in Dhaka Division" in search results (see the section above).

Opus (lib, Figure, App):
- Ruler hover line in Ruling Blue (was red).
- `deleteLayer` stops a draw tool aimed at that layer.
- Autosave:
  - `store.saving` with "Saving…" and a hollow dot in the top bar;
  - `store.flush()` on pagehide and when the page is hidden;
  - idle save within 1 s.
- Status notes stay 3.5–9 s by length (was 9 s).
- Rivers and lakes are fetched the first time their layer is on (1.8 MB gz no longer on every visit).
- Locators:
  - `togglePart()`: a part shown again moves to a free spot if covered (a globe locator under the country locator).
  - `cornerTries` also tries just under parts in a side column and beside parts in a bottom strip.
  - Overlap warnings name the locator ("Globe locator and Country locator overlap").
- New text: a Title goes above the map (the map moves down to make room when needed), and a note goes under the coordinates; both keep clear of grid labels.
- Drill-down: `InsetItem.marks`; (a) outlines the ground of (b) (`insetOutline` inverts (b)'s frame), with zoom lines (a)→(b) as well as (b)→(c).
- Labels:
  - names of neighbours stay outside the study outline and names inside stay inside, nudged up to two line heights;
  - sub-area names are left out when the study area is too small to hold them (Country overview).
- Click anything, change anything (F0):
  - `lib/pick.ts` finds the name, point, line or area under the pointer in the drawn figure; Figure tags features with `data-pick` (stripped on export).
  - The first click selects the map; a click on the selected map picks a feature.
  - The panel shows `FeaturePanel`: its own fill and outline colour, show or hide, the name text, show the name, "put the name back".
  - A dashed blue box marks the pick; a picked name drags to a new place (`featureStyle.labelDx/Dy`, kept exactly where put).
  - Model: `Layer.featureStyle` (fill, stroke, hidden, label offset); Figure paints per-feature fills (also over the merged study fill).
- Every page part: `ItemBase.look` (background and strength, border and width, room inside, rounded corners, see-through, turn) via `AppearanceSection`, drawn by a wrapper `<g>` in Figure.
- Shapes (`ShapeSection`):
  - outline and fill colours separate;
  - solid, dashed or dotted lines;
  - rounded rectangle corners;
  - arrow heads at the end, start, both or none, filled or open, 50–300% size;
  - a filled head no longer lets the line poke through.
- Checked (`v35.js`):
  - the rivers file is not fetched;
  - clicking the name Savar opens "Savar, Name in Sub-areas", and dragging it moves it 6 mm;
  - a picked area takes its own fill;
  - arrow heads at both ends;
  - (a) marks (b), confirmed in a screenshot with lines a→b→c;
  - no page errors.

## v0.36 round 2, Opus part: layout, checks, rotation, My maps, share links, offline and new data tools (2026-10-21)
- D9 Classic layout: on a page 130 mm or taller the country locator is a 48 × 64 mm frame (was 52), so the side column has no empty middle.
- D12: the Okabe-Ito yellow is left out of the area colours and of new point layers.
- D13 Journal check: the dpi error offers "Use N dpi", and the format note ("PNG is fine for slides, posters and the web") offers "Use PDF/TIFF".
- F6 rotation on the canvas:
  - a turn handle on a stalk above any selected part (not the map); it snaps to quarter turns, and Shift gives every 15°;
  - the selection box and handles turn with the part;
  - resizing a turned part works along its own sides, with the opposite corner kept in place;
  - a click hits the turned box.
- F15 page editing:
  - a box dragged across empty page (or with Shift across the map) picks every part inside it;
  - Group / Ungroup (Ctrl+G, Ctrl+Shift+G, toolbar, menu): a click on a grouped part picks the group, and a second click picks that part only;
  - a right-click menu (also the menu key or Shift+F10) for a part (Settings, Copy, Duplicate, order, Group/Ungroup, Lock, Hide, Delete), for the map (Map settings, Fit to the area, Move in its frame, Paste) and for the page (Paste, Page size, Select all).
- F13 Excel: `.xlsx` workbooks open like a CSV (first sheet, via `lib/xlsx.ts` on the already-installed `but-unzip`); `.xls` and `.ods` get a clear "save as .xlsx or CSV" message. GeoPackage still needs sql.js (a new download), left for now.
- F3 `lib/facts.ts` + `PaperPack.svelte`: area (km² or ha), boundary length, centre and bounds in D°M′S″, sentences for the study-area section, the methods and the alt text, plus "Put the area and centre on the map".
- F4 My maps:
  - `lib/library.ts` (IndexedDB: maps and versions, a 320 px picture);
  - the app keeps the open map there 2.5 s after each save (`store.onSaved`), with the picture at most every 20 s;
  - `store.mapId` lives outside the document (undo never changes it), and a new map or an opened file gets its own entry;
  - `MapsDialog.svelte`: cards to open, copy and delete, "New map", and named versions ("Before reviewer 2") to keep and go back to.
- F17 `lib/zip.ts` (stored zip writer) and `exportBundle()`: PDF, TIFF or PNG, SVG, the caption and the project in one .zip.
- F22 `lib/share.ts`: a link carrying the map (deflate + base64url after #m=). Opening it keeps the map that was open in My maps first. Drawn shapes go too while small, imported files do not (listed).
- F18 offline: `public/manifest.webmanifest`, 192 and 512 px icons, and `public/sw.js`:
  - the page comes from the network first;
  - hashed code is served from the kept copy;
  - bundled data and fonts are served from the copy and refreshed behind;
  - boundaries, terrain, imagery and epsg.io come from the network first with an offline copy (700 kept at most);
  - registered in main.ts.
- F10 towns: OSM theme `places` (city and town; village and suburb on small maps; English names where tagged) as a points layer "Towns and cities", fetched for the view like the OSM detail. Town names give way to area names; a city beats a town beats a village.
- F11 contours: the terrain worker traces contour lines on a smoothed grid (marching squares, joined and simplified) and turns them into lon/lat. `addContours()` makes a "Contours" layer; the interval is 0 = chosen from the relief; every fifth line is heavier; the terrain credit is added.
- F12 `addRings(km[], around)`: dashed distance rings round the study centre or up to 60 sites.
- F8 checked: NASA GIBS MODIS/VIIRS true colour (250–375 m) answers with open CORS. HLS 30 m is daily granules with gaps (most days blank over Dhaka), so a recent image needs a many-date composite: moved to round 4.
- Checked on a separate lead build (port 4180, `dist-lead`):
  - v36: an Excel file gives 2 points; the map is kept in My maps with a picture; the turn handle gives 90°;
  - v37: the box picks the 3 side-column parts; grouping and a click on a grouped part picks all 3; the right-click menus for a part and for the page; Esc closes.

## v0.35 round 2: main map panel, legend rows and per-part options (settings agent)
User: "when I click any feature I should be able to customize everything, A to Z". Every new option is optional and unset means today's look (a fresh map's figure is unchanged: same markup, checked against a snapshot).
- Main map panel (`EditPanel`, `MapPanel`, `GridPanel`):
  - the panel head (back, title, delete) is sticky, with its own white to the leaf's edges and a hairline once the body has scrolled under it;
  - order is now: Main properties, Area shown, then Coordinate grid (the switch, then Quick looks with a line explaining the Zebra frame), then a closed "Fine-tune the grid" holding sides, type, units, interval, line, and two quiet accordions inside it ("Frame round the map", "Coordinate labels");
  - rotation is one row: slider, number box, Reset (the "0°" in the label is gone);
  - plain words: "Extent" is "Area shown" (Apply, Fit to my area), "Projection (CRS)" is "Projection" with a one-line hint;
  - the main map gets a frame colour beside the frame line.
- Legend entries (`panels/EntryList.svelte`): 34 px ruled rows like the Layers list (swatch, name, eye); the name is plain text that becomes a field on click or Tab, keeping its accessible name ("Legend text for X", "Show X in the legend"). The same list now serves "Change or hide names on the map".
- Per-part options, each in a quiet closed "More options" (Figure.svelte draws them, EditPanel sets them):
  - Text: capital letters (a switch in Style), line spacing, halo (white, dark or any colour, and its width), and a "Special characters" row (² ³ ° ′ ″ ± µ –) that puts the sign at the cursor (`panels/SpecialChars.svelte`);
  - Legend: columns (Automatic, 1, 2, 3), symbol size, row spacing, title position; the maths is `legendLayout()` in `lib/textstyle.ts`, shared by the figure (and meant for the checker and the box fitting);
  - Scale bar: dark and light block colours, bar height, the unit as written ("kilometres");
  - North arrow: arrow colour, show the N (and E, S, W on a rose), letter size;
  - Locator: frame colour (with the existing frame width), zoom box line width and fill strength, zoom-line width and dashed or solid;
  - Credits: left, centre or right text;
  - Names on the map (any layer): halo on or off and its colour, and letter spacing for area names. The PDF writer ignores CSS letter-spacing, so spaced names are written as a `textLength` (every output understands it) and set from their left end.
- Figure and turning: the locator's zoom lines are drawn outside the part's turn box and start at the zoom box wherever the turned locator carries it; every other part draws inside the wrapper `<g>` and turns with it.
- Model: optional fields only in `store.svelte.ts` (`LayerStyle.labelHalo`, `labelHaloColor`, `labelSpacing`; `MapItem.frameColor`; `InsetItem.frameColor`, `extentPt`, `extentFill`, `connectPt`, `connectDash`; `NorthItem.color`, `hideN`, `nSize`; `ScaleItem.barDark`, `barLight`, `barH`, `unitText`; `LegendItem.cols`, `symbolSize`, `rowGap`, `titleAlign`; `CreditsItem.align`; `TitleItem.lineGap`, `halo`, `haloPt`, `upper`).
- Needs the lib agent: the checker and the box fitting must use the new sizes (see the final report: `check.ts`, `App.svelte` legend and text effects, `scene.ts` label widths and `buildScale`).

## v0.36 round 2, navigation and shell (nav agent, 2026-10-21)
- D1 one navigation: the rail is the only one. Place, Design, Map parts, Export, and Help at the bottom (`Rail.svelte`).
  - A done step carries a 14 px graphite tick (same rules as the old step row: the place exists, the step was opened, you moved past it; Place is done once the place exists). Help and element settings keep the step you were on; the ticks start again on a new map.
  - The current step is the washed tab, with `aria-current="step"` (Help: `page`); it is also `aria-pressed` (the same button hides the panel). The rail is a labelled nav ("Steps to make your map"), every tab has a tooltip, tabs are 58 px (54 px on phones).
  - `Steps.svelte` is gone. The leaf's head is now the panel title, "Step 2 of 4" in a quiet note, and the close button (42 px); on phones it folds into the grab handle's row, leaving only the close button.
  - Layers is the last part of Map parts (Essentials, On the map, Inset maps, Add, Layers), next to Add where a new layer lands. The Tab type lost 'layers'; `openTab()` now also closes the panel from the old Style, Text and Uploads names.
  - New `components/shell.svelte.ts`: which part of Design and Map parts is open (`openDesign` is still exported from SidePanel for the page toolbar), `openParts()`, the My maps window flag, `stepOf()`, `startNewMap()`, `openKeptMap()`.
- D2 less scrolling at 1366x768 (the panel body 530 to 560 px: head 59 to 42, foot 69 to 56 with a 40 px button):
  - the colour-blind check moved from Colours to the Journal check menu (a row under the findings, same select and note); the preview now stays on while you change step (the Design panel no longer switches it off) and the page's own "Turn off" note shows it;
  - Map parts, Add: "Add your own" and "Add detail from OpenStreetMap" are quiet closed accordions ("Your own file or points" in Add a layer opens the first one).
  - Scrolling left at 1366x768, before to after: Colours 232 to 121 px, Layout 113 to 75, Map parts 0 (Add 385 to 26; 208 with Add your own open), Layers 146 to 0, Export 58 to 88 (the new "Text for your paper" row). At 1440x900 Colours and Layers need no scrolling.
- D3 one home per job: the Layers panel lists only the map's layers (the "On the page" list is gone, and its heading "On the map" too, since the tab is named). Main map settings has a row at the end of Essentials, because the Layers list was its only way in from the panel. Essentials shows the same five named north arrows as the arrow's own settings (Arrow, Rose, Star, Compass, Simple), in one row, 3 + 2 on the 300 px panel.
- D10 plain words: the tab is "Inset maps" (switches "Country inset", "Globe inset"); Help says inset maps. No other GIS words were on show in these files.
- D11 phones: once a place exists the sheet is at most 40 % of the screen (390x844: 338 px with the map 386 px tall, was 456 and 268); 54 % while there is no place; the handle still makes it taller; the close button is 44 px; no sideways scrolling at 360x732 or 390x844.
- Narrow panel (300 px): the five sub-tab names are 11.5 px with narrower margins, so none is cut short (checked at 761, 800, 1024 and 1100 px).
- I1 My maps: File, "My maps…" is first; File, New map has no `confirm()` (the map on screen is already kept, and a note says so); the empty Place panel shows the three newest kept maps (picture, name, when, Open) and "All my maps"; `MapsDialog` is mounted in `TopBar`.
- I2 Export: `PaperPack` sits in a closed quiet accordion "Text for your paper" under the figure caption.
- DESIGN.md: steps, rail ticks, head, sub-tabs, foot, Add groups, the colour-blind check and the phone sheet are rewritten to match.
- tests: the Layers, Locators and Main map steps follow their new places (suite-core, suite-pro, suite-places); new `suite-nav.js` (53 checks: rail, ticks, aria-current, Next, foot size, Layers, arrows, folded Add, colour-blind preview, My maps open, copy, version, new map, Your maps, paper text, the phone sheet at 390x844 and 360x732).
- Checked: svelte-check 0 errors; every suite passes (core 23, pro 17, fonts-page 21, editor 7, sizes 7, areas 10, page 8, places 13, search 6, nav 53; undo prints its notes). fonts-page missed its PDF download once under load and passed on a rerun.
- Found, not mine to fix: after an edit and an immediate New map, "Untitled map" is written into My maps by the 2.5 s keep timer in `App.svelte` (it never checks that the map is still there). Fix: clear `keepTimer` before the early return in `store.onSaved`, and return from the timer when `store.doc.study.source === 'none'`.

## v0.36 round 2, wiring and fixes (Opus, 2026-10-21 evening)
- Follow-ups from the Edit agent:
  - check.ts and App's legend fit use `legendLayout()` (columns, swatch size, row spacing);
  - a multi-column legend beside the map only ever grows wider to hold its columns;
  - text boxes measure `shownText()` (capitals) and `lineGap`;
  - scene label boxes include letter spacing;
  - `buildScale` leaves room for a written-out unit.
- Follow-ups from the Nav agent:
  - My maps no longer keeps an empty "Untitled map" when New map follows an edit within 2.5 s;
  - MapsDialog's New map is the File one (`startNewMap`: default style);
  - "Add locator map" is now "Add inset map" (tool menu, toolbar zoom names, tests).
- Wired up:
  - Layers, Add a layer, a new "Places, relief and distance" group: Towns and cities, Contour lines, distance rings round the area or round each points layer;
  - two NASA satellite choices: the recent dry season (HLS 30 m composite) and a chosen day (VIIRS);
  - "What is the map about?" recipe chips on the Place panel;
  - File, Copy a share link;
  - "Printed in black and white" in the Journal check preview;
  - Export, "Everything at once": PDF, TIFF at the journal's dpi, SVG, caption and project in one zip;
  - `<Tour />` in App.
- New:
  - F5 leader lines: a name dragged more than 2.5 mm from its place gets a thin line and a dot back to it, with a switch in the feature card;
  - F14 Main map, Area shown, "Round the study area": Show all, Fade (white 62% veil) or Only the area;
  - F8: an HLS 30 m composite of a season (S30 + L30, up to 30 days every other day; per pixel the 40th percentile of the days that saw the ground, so no clouds and no shadows), with progress in the busy bar and at most about 900 tile requests;
  - VIIRS and MODIS for a chosen day, credited by date.
- Fixes:
  - OpenStreetMap layers the user asked for are retried 3 times, 30 s apart, when every Overpass server is busy (seen today: 502, 504 and timeouts on all four);
  - distance rings use round distances up to half the larger side of the area (were up to 100 km on Dhaka);
  - contour intervals are never under 10 m (flat deltas drew noise at 5 m);
  - the tour closes on the first click or key outside it, and never shows in automated or headless browsers.
- Checked on a second lead build (port 4181, `dist-lead2`), `v38`:
  - the recipe chips show; Urban area adds roads and towns (the towns stayed empty: Overpass down, see above);
  - 601 contour lines (at 5 m before the fix);
  - distance rings;
  - a share link of 2,124 characters reopens the same map, rings included, in a cleared browser;
  - the zip holds 5 files (PDF 0.34 MB, 600 dpi TIFF 3.0 MB, SVG, caption, project) and passes a zip test;
  - no page errors.

## v0.37: colour sample sites and areas from a table (data agent, 2026-10-21)
Two ways to style a map from a table of numbers or words. Every option starts off, so existing maps do not change (the markup of a fresh Sylhet map with a points layer is identical to the one before, compared tag by tag).

- F1 Sample sites (a points layer, or points in a file), in the layer's settings, new section "Style by a column" (`panels/PointsStylePanel.svelte`, logic in `lib/marks.ts`):
  - (a) Colour by: each different value of a column (at most 10) gets a colour from a colour-blind-safe set (Okabe-Ito without its yellow, then Tol "bright"), in the order the values first appear; columns with more than 10 values are listed but cannot be chosen. Each value has its colour picker and its legend text; an optional heading above the entries. The layer's single "Sample site" line is replaced by one line per value that is on the map.
  - (b) Symbol by: up to 4 values, circle, triangle, square, diamond (each can be changed); with the same column as the colour, the legend shows coloured shapes.
  - (c) Size by a number column: smallest and largest symbol (pt); "Width" or "Area (square root)" scaling (the area of each circle follows the number); a size key in the legend (a heading and three round example values, drawn at their true size), switch and heading editable. Sites with no number are drawn at the smallest size, and the panel says so.
  - (d) Numbered markers: "Numbers inside", the number is the row (1, 2, 3 in table order) or a column (an ID); the circle grows to hold it, white or dark text by the colour; size of the number 5–10 pt; the names beside the sites go off (the "Label points with" list brings them back); legend entry "1–9 Sampling sites" (the range can be switched off). Written as plain SVG text with `text-anchor="middle"` and a y offset (no dominant-baseline), so the PDF shows the numbers centred.
  - (e) Drawn points ("My layer", "My drawing") and points in a file now get the Symbols section (shape, size) too, and a Symbol opacity slider: drawn points were drawn at the fill opacity of the areas (20%), so they were nearly invisible; symbols of a drawing are now fully solid unless set (`LayerStyle.symbolOpacity`). A drawn shape is picked by its place in its layer (`#0`, `#1`…) until it has a name; the "this feature" card has a Name field that writes `properties.name` (and turns "Show area names" on), the shape's own colours and moved name follow it to its new name; "Remove last shape" and "Clear all" forget the looks of the shapes they remove. A look saved before shapes had keys (for all unnamed ones) still applies.
- F2 Colour areas by a table (choropleth), for the Sub-areas layer and for official Boundaries layers, in the layer's settings, new section "Colour areas by a value" (`panels/ChoroplethPanel.svelte`, maths in `lib/classify.ts`):
  - paste a table or open a CSV or Excel (.xlsx) file (comma, tab and semicolon are read; first row = headers; at most 6,000 rows); "Try an example" fills a table with the layer's own area names;
  - the name column and the value column are guessed and can be changed; names are matched ignoring case, spaces, accents and punctuation, then known variant spellings (Chittagong/Chattogram, Comilla/Cumilla, Barisal/Barishal, Bogra/Bogura, Jessore/Jashore, gonj/ganj, Keranigonj...), then without "Upazila", "Thana" or "District"; the panel says "Matched 11 of 13 rows" and lists the names that did not match, each with a small list of the areas still free to pick the right one;
  - classes 3–7: equal intervals, quantiles, natural breaks (Fisher-Jenks, written in the file), limits typed in, or "each value its own colour" (words; each value's colour and legend text can be changed); palettes Viridis, Blues, Greens, Oranges and an orange-to-purple diverging one (all colour-blind safe), reverse, colour strength;
  - areas with no value are light grey with diagonal hatching (a switch) and a "No data" legend line (its text can be changed);
  - the legend has a heading (the value column's name, editable) and one line per class with thousands separators and enough decimals to keep the limits apart ("260,000–330,000"); a name on a dark colour turns white;
  - stored on the layer as `layer.choro = { table, nameCol, field, fix, method, classes, palette, reverse, breaks, title, opacity, cats, noDataLabel, noDataHatch }`: the colours are worked out when drawing and never written into `featureStyle`, so a palette change recolours every area, and a colour set by hand on one area (click it) still wins. Applying a table moves the layer just above the study area, so points and drawings stay on top of the opaque colours.
- Legend: one shared plan (`lib/legend.ts`: `legendRows`, `legendPlan`, `legendNeed`) for the figure, the legend box fitting in `App.svelte` and the journal check in `check.ts`. Lines of the usual height go exactly where `legendLayout` put them (so existing legends are unchanged); a heading stays with the line after it and size keys have taller lines.
- Scene (`lib/scene.ts`): a point carries its table row, its radius and its key; labels sit beside the marker's own size; every boundary layer lists all its names (`allNames`) for matching, drawn or not.
- Checked on the lead build (port 4180): `svelte-check` 0 errors; suites core 23, pro 17, fonts-page 21, editor 7, undo, sizes 7, areas 10, page 8 and the new `tests/suite-data.js` 30 all pass, no page errors (the tests' `/^Download/` button now also matches "Download all as .zip", so the runs used copies with `/^Download (PDF|SVG|PNG|TIFF)/`). Sylhet: colour by type, symbol by type, size by nitrate (square-root), numbers 1–9, and Dhaka District with a table of upazilas (a misspelt name and one that is not on the map), exported to PDF, SVG and PNG; the PDF was opened in the browser's viewer and shows the symbols, the numbers centred in their circles, the size key, the class colours, the hatching and the legend.
- Round 2 close (Opus):
  - tests click "Download PDF/SVG/PNG/TIFF" (Export now has a second, zip, button);
  - suite-data is listed in tests/README;
  - suite-places waits 40 s for foreign official boundaries (Nepal's lists were slow: GitHub media answered 503 once);
  - new drawing layers go above the study and boundary layers (a coloured Sub-areas layer hid them);
  - new choropleths default to Blues (Viridis, which ends in yellow, is one click away);
  - the legend's Entries list says which layers take their lines from a table, with a link to that layer.
- Full run on the final build (port 4173): core 23, pro 17, fonts-page 21, editor 7, undo exact, sizes 7, areas 10, page 8, places 13 (after the longer wait; St. Martin's and Kathmandu each failed once on slow online services), search 6, nav 53, data 30.

## v0.37.1: fixes from the owner's screenshots ("wtfff", 2026-10-21 night)
- Drill-down, panel (b), when the area was picked from the place search (Moulvibazar District as an OSM area: its level unknown):
  - Before: (b) looked one level up from "district" and found the district itself, so it showed the district again, (a) outlined that, and the zoom lines made no sense.
  - Now: (b) takes the finest official unit round the area that is more than 1.6 times its size, looking up level by level (App loads those levels), so it gets the Sylhet division.
  - Checked: v39 screenshot `covers/drill-maulvi.png`.
- An upazila map's country locator draws district lines (level 2), not every upazila of the country (`insetData`); App loads level 2 for it.
- Names covered by layers drawn later (Rangamati: the lake over the sub-area names): asked the Parts agent, who owns Figure.svelte now, to draw all labels in one final pass above every layer.
- Screenshots 2 and 3 of that message show the old interface (step row, Layers on the rail): a tab not reloaded since the update.

## v0.38: Table of sites and Elevation profile, and names above every layer (parts agent, 2026-10-21 night)
Two new page parts, a small group "Tables and charts" in Map parts, Add (two tiles, off until there is something to make them from, with a one-line hint why) and two entries in the tool strip's Map parts menu (greyed with the reason as tooltip). Nothing changes on a map that does not use them.

- Table of sites (`TableItem`, `kind: 'table'`; settings in `panels/TableSection.svelte`):
  - lists the points of a chosen points layer (or a file or drawing that holds points), one row per site in the order of its table; the layer is a select in its settings;
  - columns are ruled rows with switches, in the order they print (up and down arrows reorder them): the table's own columns, "No." (the numbers on the markers when the layer uses them, `numberText`, else 1, 2, 3), "Latitude" and "Longitude" (23°45′12″N or 23.7534°N, four places, with the hemisphere letter); a new table starts with the label column (or the first text column), latitude and longitude, and with No. first when the markers are numbered; the last column cannot be switched off;
  - look: header row bold over a hairline, numbers right-aligned (a column whose values are all numbers, and No., Latitude, Longitude), optional light bands on every second row (#EFEFEC), optional hairline frame, optional bold caption line above, text size 5–12 pt (starts at 7 pt or the journal's minimum, whichever is larger), bold, italic and colour of the rows, the map font; the box round it uses the same "Box, see-through and turn" and "Position and size" as every part;
  - the box is as wide as its columns and as tall as its rows ("Fit the box to the table", on until the box is sized by hand: dragging a handle or typing W or H switches it off; More options switches it on again); a table that grows keeps its right edge when it sits in the right half of the page, and moves up or left rather than off the page; rows that do not fit are left out and words are cut short with "…" when the box is narrower than its columns;
  - the journal check: "The table has more rows than fit its box: 1 of 8 are shown…" and "The table is narrower than its columns…", each with the one-click repair "Fit the box to the table"; the text size is checked against the journal minimum like every `labelPt`.
- Elevation profile (`ProfileItem`, `kind: 'profile'`; settings in `panels/ProfileSection.svelte`):
  - data: the terrain worker has a new request (`ProfileRequest`, `elevationProfile` in `terrain.ts`): 200 samples evenly spaced along the line's great-circle length (slerp between vertices), heights from the Mapterhorn tiles read the way the relief is read (`fetchTile`, `lonLatToWorld`, bilinear), zoom chosen for a pixel of about 30 m and stepped down when a tile is missing or the line needs more than 36 tiles; cached by line key + sample count; returns distance (km) and height (m), the length and the zoom;
  - the heights are kept in the part itself (`data`, about 5 KB), written without an Undo step of their own, so a saved map, a reload and an export never wait for the network; the desk reads them (`syncProfiles` in `lib/figparts.svelte.ts`, an effect in Canvas) when a profile is added, its line is changed or moved; a failed read is not retried for 20 s and has a "Try again" button; `profilesReady()` waits for the reads (see "Needed elsewhere");
  - the line: any LineString (or MultiLineString) of a vector layer, named in the list by layer and its own name or number ("My drawing, line 2 (12.4 km)"); contour lines and distance rings are left out; the part points at "layerId|n", so another shape added later never renumbers it;
  - drawing (pure SVG, `lib/figparts.ts` `profileLayout`): axes with round ticks (1, 2, 5, 10 times a power of ten; distance in km, height in m), light horizontal grid, the profile with a light fill, optional lowest and highest points (a dot and the height, above the highest and below the lowest, beside the point when there is no room), "A" and "B" over the two ends of the chart and, in the main map's drawing, a dot with the letter just beyond each end of the line (white halo), "Vertical exaggeration 50×" worked out from the box (the chart always fits its box, the number is text only), axis titles and grid switchable under More options; text at `labelPt` in the map font, plain y offsets, rotated y title with `transform`;
  - settings: the line, line colour (colour-blind-safe dots and any colour), fill under the line with its own colour and strength, A and B, lowest and highest, exaggeration text, text size and style, line width.
- Both are placed like a legend (`addTable`, `addProfile` in `actions.ts`, beside the map or in a corner clear of the study area; a part that lands on the map gets a white backing), by the Add tiles or by dragging a box with the tool strip; bold, italic and size from the toolbar and "All text" reach them; copy, duplicate, group, align and the Box settings work as for every part.
- Names above every layer (Figure.svelte, asked by Opus): place names were drawn inside each layer's own group, so a layer drawn later covered the names under it (Rangamati: the lake over the sub-area names). Every layer's names (halo text, text, leader lines and dots, `data-pick`) are now drawn in one pass after all the layers, in the same layer order, inside the map's clip and content group, before the area veil, hatching, study outline and grid. A fresh map's markup is the same apart from the order of the names; the colours of a colour-by-value layer are worked out once (`choroOf`) for both passes. Checked with a filled area drawn over the sub-areas of Sylhet: every name stays readable above it.
- Checked on the lead build (port 4180): `svelte-check` 0 errors; core 23, pro 17, fonts-page 21, editor 7, undo (notes), data 30, nav 53 and the new `tests/suite-parts.js` 60 all pass, no page errors. Sylhet District with 8 sites and a 60 km line across the hills to the Meghalaya border (heights 8 to 449 m, z11, about 35 m per pixel): table and chart seen on screen and in the SVG, PNG (600 dpi) and PDF exports; the PDF was drawn with pdf.js and shows the same chart, the rotated "Elevation (m)", A and B on the map and the table, with all their words in the PDF's text; the phone sheet (390 px) has no sideways scroll.
- Limits:
  - the Mapterhorn tiles need the network the first time (the heights stay with the map afterwards); on a very long line the zoom drops and the pixel grows;
  - the profile follows one line at a time, and a line is read with 200 samples whatever its length;
  - a table with hundreds of rows is cut to the page (the check says how many are left out); there is no continuation onto a second page;
  - the table's header is the column's name as it is in the file ("site", "nitrate").
- Needed elsewhere (reported to Opus): `scene.ts` `creditsText` adds the terrain credit when a profile is on the page; `App.svelte` `store.beforeExport` waits for `profilesReady()`; DESIGN.md can mention the new group and the white-backing rule.

## v0.38.1: parts follow-ups and the preview restarted (2026-10-22)
- Applied the Parts agent's asks: the terrain credit is added when an elevation profile is on the page (scene.ts `creditsText`), and `store.beforeExport` waits for `profilesReady()`, so an export never prints "Reading the ground height…".
- The preview server on port 4173 had stopped (the session restarted); started again with `studymap-stable`.
- Full run on the preview build (port 4173, 2026-10-22): core 23, pro 17, fonts-page 21, editor 7, undo exact, sizes 7, areas 10, page 8, places 13, search 6, nav 53, data 30, parts 60; no page errors.

## v0.39: more than one map on a page, the detail map (maps agent, 2026-10-22)
A second (and further) map frame: a zoomed-in detail of the study area with a zoom box and lines on the main map, or one more panel of the same ground. A page with one map is drawn exactly as before (the SVG of Dhaka District in the default, Drill-down and Side by side layouts is the same before and after, apart from two empty comment nodes of the template).

- Design (the simplest that holds):
  - a new part kind `detail` (`DetailItem`), not a second `map`: everything that treats "the map" as the one frame (placement, templates, My styles, the check) keeps doing so, and every `kind !== 'map'` rule (move, resize, delete, duplicate, hide, group, align, marquee) already treats a detail map as an ordinary part;
  - its view is the ground at the middle of its frame (`centre`, lon/lat) and its printed scale (`scale`, 1 : n), so resizing the frame shows more or less ground at the same scale and a change of projection or turn of the main map never moves it; it always uses the main map's projection and turn, so the zoom box is a plain rectangle (`fromCrs(toCrs)`, no proj4);
  - one layer list: it draws the same layers and styles (its settings say so); `buildDetail` runs the main map's own layer drawing (`drawFrame`, split out of `buildMainUncached`) through the detail's frame projection, with a cache per frame (`remembered`), and `placeLabels` places its own names (names moved by hand on the main map belong to the main map only);
  - the main map's drawing moved to `components/MapFrame.svelte` (the main map and every detail map use it; shared helpers in `lib/figdraw.ts`); ids of a detail map's clip paths carry its id, the main map keeps its plain ids; `lib/frames.svelte.ts` shares the drawn scenes with the panels and actions (a detail map's settings show its scale, a new one starts from the main map's).
- M1 Add: Map parts, Add, new group "More maps" with the tile "Detail map"; Inset maps has a fourth tile "Detail" and a switch row for each detail map (a hidden one comes back from there); the tool strip's Map parts menu has "Detail map" (click, or drag a box on the page for its place). First view: 3 times as close as the main map at the middle of the study area, or round the feature picked on the map (a point: centred on it). It lands in a free spot (beside the map when the page has room), right after the main map in the stacking order. Own frame (width, colour), grid (off at first, with every option of the main map's grid), panel letter or caption, optional "1:60,000" in the corner. Scale bar: "Measures: The main map / Detail map 1" in its settings (`ScaleItem.of`).
- M2 Zoom box and lines: on the main map the box is drawn like a locator's zoom box (outline, faint fill, colour from the locator marker), with lines from the box's facing corners to the facing edge of the detail frame (`facingSegs`, now shared with the locator's `connectors`); on by default, switchable (box, lines, colour, line widths, fill, dashes). Lines run behind parts that sit on the main map and are left out (with a note in the settings and the journal check) when they would cross a part outside it.
- M3 Editing: select it like any part; dragging inside the selected detail map moves its content (instant preview, one rebuild at the end), the wheel over it zooms it about the pointer, the tool bar and the scale box (which then reads "Detail scale 1:") have Zoom in and out and Fit; settings: scale field and list, Zoom in and out, "Fit to the study area" (the same ground in a second panel), "Choose on the main map" (drag a box on the main map, then the detail map shows that area), zoom box, label, frame, grid. No turn and no "Box, see-through and turn" for a map frame. A new place sends a detail map that looked at the old one to the middle of the new area.
- M4 Names: each frame places its own names; a click on a name or area inside a selected detail map picks it (`pickAt` takes the frame; the pick box is drawn on that frame).
- M5 Relief and satellite pictures are made for each detail map like the main map's (a cache per frame, print quality at export).
- M6 Check and placement: the journal check counts a detail map's label and grid text sizes, overlaps (with locators, legend, scale bar; a detail map on the main map is fine), parts out of the page, and says when a detail map is not closer than the main map or its lines are left out; automatic placement of north arrow, scale bar and legend still uses the main map and keeps clear of a detail map.
- Files: new `components/MapFrame.svelte`, `components/panels/DetailPanel.svelte`, `lib/frames.svelte.ts`, `lib/figdraw.ts`, `tests/suite-maps.js`; changed `lib/scene.ts`, `lib/store.svelte.ts` (types, `detailGrid`, `upgrade`), `lib/actions.ts`, `lib/pick.ts`, `lib/check.ts`, `lib/placement.ts`, `components/Figure.svelte`, `Canvas.svelte`, `App.svelte`, `panels/EditPanel.svelte`, `panels/ElementsPanel.svelte`, `tests/README.md`.
- Checked on the lead build (port 4180): `svelte-check` 0 errors; core 23, pro 17, fonts-page 21, editor 7, undo (notes), data 30, nav 53, parts 60, sizes 7, areas 10, page 8 and the new `tests/suite-maps.js` 79 all pass, no page errors. Dhaka District with a detail map of the city (Mohammadpur, Lalbagh, Hazaribagh, Ramna at 1:232,000 and 1:60,000) beside a narrowed main map: seen on screen, in the SVG, PNG and PDF (opened in the browser's viewer: frame, letter tab, scale text, zoom box and lines are as on screen). Sylhet with shaded relief, a rotated main map and a geographic projection also drawn correctly. Three detail maps: a zoom redraws in about 2 frames.
- Limits:
  - all frames share one layer list (a layer cannot be on in one frame and off in another: a small next step: the frame's scene would skip the layers it hides);
  - drawing tools and moving a name by hand work on the main map only; the turn of a map frame is not offered;
  - a layout change or a new journal size does not move detail maps (they stay where they are, kept on the page);
  - "My styles" and the map-style switch do not know detail maps yet (see "Needed elsewhere").
- Needed elsewhere (reported to Opus): `themes.ts` `applyTheme` and `StylePanel.svelte` could give `DetailItem.boxColor` the colour they give a locator's `extentColor`; `facts.ts` could mention a detail map in the caption; `mystyles.ts` could save a detail map's frame and grid; DESIGN.md and Help can name the new part (Map parts, Add, "More maps"; Inset maps, "Detail"); `export.ts` needs nothing (clip ids are unique, no new attributes).

## v0.39.1: detail-map follow-ups (Opus, 2026-10-22)
- A map style (themes.ts `applyTheme`) and the Colours panel's inset colour now recolour a detail map's zoom box (`boxColor`) as they do the locators' (`extentColor`).
- The alt text (facts.ts) says when a detail map enlarges part of the area.
- Help, Map parts: names the Add tab's tables, charts and "More maps" detail map.

## v0.40 (in progress): Bangla interface (F21)
- `lib/i18n.svelte.ts`:
  - `t(en, vars)` looks the English text up in three dictionaries (`lib/i18n/bn-shell.ts`, `bn-panels.ts`, `bn-parts.ts`) when the editor is in Bangla, and falls back to English;
  - `i18n.set()` keeps the choice in this browser and sets `<html lang>`;
  - `bnDigits()` is there for fixed Bangla texts.
- The top bar has a language button ("বাংলা" / "English").
- The UI font stack adds Nirmala UI (Windows), Noto Sans Bengali, Hind Siliguri and Vrinda for Bangla script.
- The figure is not translated: names, legend, credits and the paper sentences stay as written (journals want English, and the PDF writer cannot shape Bangla conjuncts).
- Three Sonnet translators work at the same time on separate files (shell and canvas; step panels; part settings), each with its own dictionary and a shared glossary.

## v0.40 final: Bangla stopped, final build (2026-10-22)
- The owner did not ask for a Bangla interface (it was item F21 of the list, read into "I want all"). The translators were stopped, the language button is removed, and `i18n` is fixed to English. The `t()` calls already added return the English text unchanged.
- Final build on port 4173. All 14 suites pass: core 23, pro 17, fonts-page 21, editor 7, undo exact, sizes 7, areas 10, page 8, places 13, search 6, nav 53, data 30, parts 60, maps 79. svelte-check 0/0.
- Not done (waiting for the owner's yes to download): GeoTIFF layers (geotiff), GeoPackage (sql.js), and the disputed-border views (Natural Earth worldview data).
- Top bar: the map name and its saved status are centred in the bar (`.title` margin-left auto, centred text), so the space on both sides is even (the owner: "the gap in top is looking ugly").

## Final design pass (Sonnet, 2026-10-22)
- Skills run on fresh shots (1440x900, 1366x768, 390x844: empty, Dhaka District, every rail step and tab, selected part and main map settings, File menu, journal check, My maps): impeccable (critique and polish references, craft floor), redesign-existing-projects audit, minimalist-ui, design-taste-frontend (editor parts), web-design-guidelines (Vercel rules). Plus a DOM scan for clipped text and small targets and a keyboard-focus scan of every step. Shots: `scratchpad/fin/` (before) and `scratchpad/fin/after/`.
- Found and fixed (CSS only; figure, names and accessible names untouched):
  - `panels/EditPanel.svelte`: the part settings head sat 8 px lower than the other steps' heads and jumped up when the body scrolled; it now pulls over the body's padding (`top: 0`, negative top margin) so the title stays at the same place. North arrow style (five choices) was 2+2+1 with "Simple" alone across the row; now 3+2 (`.seg.five`).
  - `app.css`: segmented controls (`.seg`) are equal-width keys (grid), widening only where a name needs it; before, a short word such as "Solid" was a thin key beside "Colour each area".
  - `panels/SubTabs.svelte`: tabs have a 28 px minimum width (Text and Add were 21-23 px wide on the narrow 300 px panel, under the 24 px target).
  - `MapsDialog.svelte` ("New map" card), `FileAreaPanel.svelte` (drop zone), `panels/SidePicker.svelte` (empty sides): dashed edges use Line Input, as DESIGN.md says for dashed outlines (they were too faint, below 3:1).
- Checked and left as they are: focus rings (every control shows one, some on an inner tile or wrapper), layer rows, top bar spacing at 1366/1100/900/390 (no overlap, no wrap), Detail map tile (three columns like the Text row).
- Top bar, second try: the map name field fills the room between the left tools and the right ones (no dashed line, a light box only on hover), and "Saved in this browser" sits at the start of the right group, next to the page size. No empty stretch is left in the bar.
- Side column gap (the owner: "still gap"): a locator at the top of the column beside the map now grows down to 5 mm above the legend (or the part under it). Its height is capped at 2.2 times its width and is never changed once moved or sized by hand (App effect). Checked on Manikganj Sadar.
- The gap above the ruler (what the owner meant): the 64 px band over the rulers is gone (`TOP = 0`). The rulers meet the top bar; the page area starts under the ruler (`.scroller.chrome` inset 20 px, 64 px padding top and bottom); the selection toolbar floats at 30 px over the paper.
- The side-column locator growth is undone at the owner's request (it was not asked for, and it broke the detail-map zoom lines).
- All 14 suites pass: core 23, pro 17, fonts-page 21, editor 7, undo exact, sizes 7, areas 10, page 8, places 13, search 6, nav 53, data 30, parts 60, maps 79.

## v0.40.1: boundaries that line up (2026-10-24)
User: "shape file is not aligning each other, fix it" (Moulvibazar picked from the place search: the OSM outline against the geoBoundaries lines).
- `choosePlace`: an OSM outline that is an official unit is replaced by it (`officialMatch`):
  - the unit must hold the outline's centre and be within 15% of its area, looking from the division level down;
  - the outline is rewound first (a reversed ring had put the centre on the far side of the globe);
  - levels with over 6,000 units are skipped, and the search is capped at 3.5 s (Lyon would wait on France's files);
  - if the official area cannot be used, the OSM outline stays.
- App `alignedStudy`: an official area is drawn from the union (`dissolve`) of its official sub-areas when they make up the area within 8%. The outline and the upazila lines then come from one file (Juri's eastern edge no longer shows a second line).
- MapFrame: the home country's official units are painted in its land colour over the world outline, so the slivers where Natural Earth and the official borders differ are land.
- Left as is: small white gaps on the India side of the border, where the world map's India shape stops short of the official Bangladesh border.
- Tests: all 14 suites pass (places 13/13 after the time cap).
- Second pass ("still not aligned"): the light patches beside the district were Natural Earth's Bangladesh reaching past the official border.
  - With official district lines on, the world outline of the home country is drawn like a neighbour (fill2, no outline), and no country outlines are drawn, so the official lines alone mark the border.
  - Home land comes only from the official units (MapFrame `adminLand`).
  - The inland-background attempt was removed again (it did not help).
- All 14 suites pass.
- Insets (a) and (b) (the owner: "but a and b??"):
  - the small maps get the study area from the district file, matching their own district lines;
  - their division and country outlines are merged (`dissolve`) from the official units at the study area's level, which App now loads for them;
  - the world map's border strokes are left out there (`official`).
  - Checked in an enlarged capture of (b). All 14 suites pass.
- Legend (the owner: "why you changed legend position"): it had moved on its own (automatic placement after the outline changed).
  - Drill-down layout: the legend is back at the top right of (c), with the north arrow at the top left under "(c)", and both are pinned so they never jump.
  - A pinned legend that fits its width keeps its right edge.
  - Other layouts are unchanged (pinning everywhere made a legend overlap a detail map).
  - Tests: maps 79, core 23 and pro 17 after the change; the other suites passed in the run just before.
- Drill-down, at the owner's request: the legend sits at the bottom right of (c) with the scale bar under it, and the north arrow at the top left under "(c)". All three are pinned.
