# StudyMap tests

**On Windows:** double-click `test.bat` in the project folder. It installs what it needs the first time, then runs everything. `test.bat core undo` runs only those suites.

**Anywhere (Windows, macOS, Linux):**

    npm test                       quick checks, then every browser suite
    npm run test:unit              quick checks only (map maths, file import, project files; a few seconds)
    node tests/run.mjs core undo   only these browser suites
    node tests/run.mjs --show      with the browser window open

The first time, run `npx playwright install chromium` to get the test browser.

`tests/run.mjs` builds the app, serves it at http://localhost:4173 (that port must be free), runs each suite in Chromium and prints its PASS / FAIL lines. The full report goes to `out/report.txt`, exported files to `out/`, screenshots to `shots/`. Many suites need the internet (place search, boundaries, terrain tiles), so a slow connection can fail a timing check.

`unit.mjs` checks the map maths without a browser: UTM zones (Norway, Svalbard, poles), maps across the 180° meridian and over a pole, the north arrow, ellipsoid distances, swapped latitude and longitude in a CSV, raster size limits, damaged project files, and undo/redo.

Each suite is one `async page => { ... }` script, so it also runs with Playwright CLI from this folder:

    playwright-cli open
    playwright-cli --raw run-code --filename=suite-core.js
    playwright-cli close

| Script | Checks |
|---|---|
| suite-core.js | search speed, journal check, smooth pan/zoom, scale box, all layouts and styles, switches, palette tools, align/order, undo/redo, grid presets, rotation, PDF/SVG/PNG/TIFF export (files saved to out/), caption, reload |
| suite-undo.js | undo and redo step by step, including undoing a drawn area |
| suite-places.js | ten real places (Dhaka, Chittagong, St. Martin's Island, Sylhet, Sundarbans, Bangladesh, Kathmandu, Nairobi, Lake Victoria, Lyon), a shapefile (data/npl2.*) and CSV points (data/points.csv) |
| suite-search.js | search ranking (Paris, a misspelt Dahka, St. Martin's, Lake Victoria, repeated Gazipur names) and Start over |
| suite-editor.js | typing into a new or double-clicked text, Esc, arrow nudge, the Edit text button, the Grid menu on/off |
| suite-fonts-page.js | editor fixes (north arrow / scale bar drag and nudge, Ctrl+D, top part wins, line picking, two-line text, Esc, grey desk), fonts (journal look-alikes, journal font check, your own .ttf, per-text font, PDF export to out/fonts-test.pdf) and the page (drag edges, side buttons, trim, see-through colour). List the PDF fonts with: grep -a -o "/BaseFont */[A-Za-z0-9+_-]*" out/fonts-test.pdf |
| suite-pro.js | bold / italic on every text (toolbar, settings rows, Ctrl+B, All text at once), PDF with bold text (out/pro-bold.pdf), Shift+click groups (Arrange Left, equal spaces, drag together, Delete, undo), My styles (save, apply, default for new maps) |
| suite-areas.js | several areas (add, merge, separate, coloured, remove), recent places, Design tabs, scale bar designs |
| suite-page.js | a click on an empty part of the page or the desk shows the page tools (wider, narrower, taller, shorter, fit to contents, page settings), on desktop and phone |
| suite-nav.js | the one rail (Place, Design, Map parts, Export, Help) with step ticks and aria-current, Next walking the steps, the 56 px foot, Layers inside Map parts, five named north arrows, folded Add groups, the colour-blind preview in the Journal check menu, My maps (File menu, new map without a question, Your maps on Place, open, copy, versions), Text for your paper on Export, the 40% phone sheet |
| suite-data.js | style by a column (colour, symbol, size key, numbered markers) for sample sites and drawn points, and colour areas from a table (matching, unmatched names, classes, palettes, no data, legend) |
| suite-parts.js | the table of sample sites (columns on and off and in order, coordinate formats, No. column matching numbered markers, zebra, frame, caption, box fitting its rows, rows left out and the check that says so) and the elevation profile (a line drawn on the map, 200 heights read from the terrain tiles, axes, A and B on the chart and on the map, lowest and highest points, vertical exaggeration text, colours), the tool strip menu and the Add tiles waiting for sample points and a line, SVG / PDF / PNG export, a reload, delete and undo; map names drawn above every layer. Needs the network for the terrain tiles |
| suite-maps.js | more than one map on a page: a detail map (a second frame with the same layers at its own place and scale) added from Map parts, Add, its zoom box and lines on the main map (switches, colour, dashes), the page given room beside the main map, its scale (typed, Zoom in and out, Fit to the study area, a box dragged on the main map), dragging inside it, the wheel over it, picking a name inside it, its label, scale text, frame and grid, the scale bar measuring it, duplicate, hide and bring back, delete, the journal check, a new place moving it, a reload, undo, and SVG / PDF / PNG export (unique clip ids, same texts) |
| suite-sizes.js | no sideways scrolling and page fits from 360 px phones to 1920 px desktops, tap target sizes, keyboard focus |

Each prints PASS / FAIL lines. Screenshots go to shots/.
