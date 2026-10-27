# StudyMap — final report (13 October 2026)

**StudyMap** is a free website that makes publication-ready study area maps in the browser. It needs no login, costs nothing to run, and is open source (MIT).

To test it on this computer, open **http://localhost:4173**. That is the stable built version.

## What it does

1. **Place.**
   - Search any place on Earth.
   - Official boundaries from geoBoundaries (232 countries, every admin level) are found directly by name, and the level is chosen automatically.
   - Alternatively, use your own file (shapefile from DIVA-GIS or GADM, GeoJSON, KML, CSV points) or draw the area by hand.
2. **Design.**
   - Map styles: Classic, Terrain, Atlas, Soft grey, Black and white, Field green.
   - Layouts: Classic, Inset in corner, Locators below, With title, Side by side, Drill-down (a)(b)(c), Country overview, Minimal. The layouts are modelled on published study area figures.
   - Page size can be any width and height, and the page can be extended.
3. **Map parts.**
   - On/off switches for every part of the map.
   - Layers: add official boundaries at any level, rivers, lakes, roads, shaded relief, a Sentinel-2 satellite base map (everywhere, inside or outside the area), your own files, or your own drawn layers. Any layer can be deleted.
   - Text can be edited on the figure itself. Pictures and logos, shapes and arrows can be added.
4. **Export.**
   - Vector PDF and SVG, plus PNG and TIFF at any resolution from 72 to 2400 dpi.
   - Journal sizes for Elsevier, Springer, MDPI, Wiley and others.
   - A checker tests font sizes, line widths, dpi, overlapping parts and data credits.
   - The figure caption is written automatically, with the data credits.
   - File names are clear, for example `Dhaka_District_study_area_190x150mm_600dpi.tif`.

**A QGIS-style layout editor** is built in:
- tool palette, rulers and guides, align, lock, bring to front or send to back, and a status bar;
- map scale box (1:50,000), map rotation, zoom to layer, and an extent typed in degrees;
- grids in degrees or UTM metres, using lines, crosses, ticks or a zebra frame, with coordinates switched on or off for each side;
- locator maps that zoom and move like the main map and have their own grid.

**Easy to use:**
- a four-step guide with a **Next** button;
- automatic placement that keeps the legend, north arrow and scale bar off the study area;
- undo and redo;
- autosave;
- a safety screen with a backup if anything ever fails.

## Bug hunt (v0.19)

Four separate code reviews ran in parallel:
1. map geometry;
2. data, saving and loading;
3. the editing canvas;
4. panels, export and import.

They produced 54 findings. Each finding was checked against the code, and the real ones were fixed. The most important fixes:

- **Undo:**
  - undo now brings back the shapes as well as the settings;
  - opening a project or starting a new map gives a clean history.
- **Saving:** the study area is never silently lost when browser storage is full.
- **Freezes and loops:** a page freeze with a very fine grid and a runaway loop in the zebra frame were both removed.
- **CSV points:** points from Europe and Canada were moved into the sea, "Year" was read as latitude, and "-91.87W" read the wrong way. All three are fixed.
- **Drawing:**
  - Cancel keeps nothing;
  - a slow search answer can no longer replace a newer choice.
- **Satellite image:** gaps in the image are grey instead of black.
- **Typing:** size fields no longer jump while you type, and the scale box understands "1:50,000".

**Tests run (Playwright, on the built version):**
- parser checks;
- targeted checks for each fix;
- a first-time-user tour;
- an old saved map;
- a stress test of every tool, 15 undos, and all layouts and styles;
- PDF, SVG, PNG and TIFF export.

No errors. Type check: 0 errors, 0 warnings. The build passes.

## LinkedIn images (in the `linkedin/` folder)

| File | Content |
|---|---|
| 01-cover.png | "Publication-ready study area maps", Savar drill-down figure |
| 02-styles.png | Six looks: Classic, Black and white, Terrain, Satellite, Zebra grid, Kathmandu |
| 03-editor.png | The app with its four steps, plus the map settings |
| 04-layouts.png | Country overview (Bhola) |
| 05-features.png | What you get |
| normal/ | Plain app screenshots and full-size figures |

All five slides are 1200×1500 px, the 4:5 portrait size that LinkedIn carousels and posts use.

## Data and licences

| Data | Source | Licence |
|---|---|---|
| Countries, rivers, lakes | Natural Earth | Public domain |
| Official boundaries | geoBoundaries gbOpen | CC BY / ODbL, varies by country |
| Places, detailed rivers and roads | OpenStreetMap | ODbL |
| Elevation | Copernicus GLO-30 via Mapterhorn | |
| Satellite imagery | Sentinel-2 cloudless 2016 by EOX | CC BY 4.0 |
| Map fonts (Arimo, Tinos, Carlito, Caladea, Cousine) | Google Fonts | Apache 2.0 (Arimo), SIL OFL (others); licences in public/fonts |

Credits are added to every figure caption automatically.

## Known limits and next steps

- Detailed rivers and roads come from free OpenStreetMap servers. When those servers are busy, the detail can take up to a minute to load.
- Areas that cross the 180° meridian or include a pole are handled for the area itself. Very wide custom projections can still show long lines across the map.
- Only one item can be selected at a time; QGIS can select several.
- **Next:** put the site online for free (Cloudflare Pages or GitHub Pages), add points coloured by category, add Bangla language, and support GeoPackage files.

The full history of every change is in [WORKLOG.md](WORKLOG.md).

## Final assessment (18 October 2026)

**Verdict: ready for a beta.** The tool is ready to share with colleagues and researchers and to collect feedback. It is not yet ready for a large public launch; see "Before a public launch" below.

| Area | Rating | Evidence |
|---|---|---|
| Map quality | 9/10 | Exact journal sizes. Vector PDF with embedded fonts. Correct dpi. Grids, scale, north arrow, locators and an automatic caption with credits. |
| Ease of use | 8/10 | Four-step guide with a Next button, instant search of official boundaries, automatic placement, and a safety screen. The advanced panels (Layers, Map settings) take some learning. |
| Reliability | 8/10 | All automated tests pass and four code reviews were done. It depends on free outside services (search, boundaries, terrain, satellite, OpenStreetMap). |
| Speed | 9/10 | 223 KB first download. Usable in 1.7 s on a slow connection. A district map in 1.4 s. Smooth panning. |
| Devices | 7/10 | Works without layout problems from 360 px phones to large screens. Detailed editing is best on a laptop. |
| Accessibility | 7/10 | Keyboard reachable, visible focus, tap targets 24 px or larger. The map itself is a picture for screen readers. |
| Cost and privacy | 10/10 | No login and no server. Files stay in the browser. Running cost is $0. |

**Before a public launch:**
1. Put the project under version control (Git and GitHub). It is currently a plain folder with no history or backup.
2. Deploy it (Cloudflare Pages or GitHub Pages, free) to get a public link.
3. Check the fair-use rules of the free services before heavy traffic: OpenStreetMap Nominatim allows at most 1 request per second and no bulk use; Photon and Overpass are public fair-use servers.
4. Let 5 to 10 real researchers make a figure and note where they get stuck.

**Next features, by value:** points coloured by category; selecting several items at once; dragging individual labels; Bangla language; GeoPackage files.

## Full evaluation of every function (18 October 2026, v0.21 to v0.22)

**How it was tested.** Five helper testers each took one area and used the site the way a researcher would, without reading the code. Round 1 used Haiku. Layers and Editor were finished on Sonnet after a network outage. Each tester ran 75 to 190 scripted browser checks. Every bug they reported was reproduced, fixed and checked again. Opus coordinated and made the fixes. Seven automated test files in `tests/` now cover all of this, and all of them pass.

| Area | Tested | Bugs found | Fixed | Still open (minor) |
|---|---|---|---|---|
| Place and search | Typing, misspellings, repeated names, islands, lakes, other countries, Start over, phones | 7. Paris and Dahka picked villages. Duplicate rows. No parent name on repeated names. Start over kept the title. Phone list cut off. Slow results. | 7 | none |
| Design (style, layout, journal, fonts, page) | All styles and layouts, every journal size, small pages, flat land, colour per area, fonts, page size | 6, plus new requests | 6 | none |
| Layers and Map parts | Every layer on and off, delete, undo, add, settings, legend, locators, files, points, satellite image | 11 | 10 | Zoom to Boundaries shows the whole country |
| Page editor and Grid | Select, move, resize, nudge, delete, undo, all tools, text, lock, align, order, map zoom, scale box, grid on main and locator maps, page zoom | 13. Grid button invisible. Typed text lost. North arrow and scale bar would not move. Wrong part picked. Lines picked from far away. No line breaks. UTM labels missing on the left. Align jumped. Empty texts left behind. Parts placed off the page. Plus desk click, scale box and focus frame. | 13 | Only one part can be selected at a time |
| Export, files, help, phones | PDF, SVG, PNG and TIFF sizes and dpi, embedded fonts, file names, pages too large, journal checker, help text, screens from 360 px to 1920 px | 6 | 6 | none |

**New in v0.22 (requested):**
- **Journal fonts.** Five free look-alike fonts, each with the same letter widths as a font journals name:

  | Font journals name | Look-alike included |
  |---|---|
  | Arial / Helvetica | Arimo |
  | Times New Roman | Tinos |
  | Calibri | Carlito |
  | Cambria | Caladea |
  | Courier New | Cousine |

  Each comes in regular, bold, italic and bold italic.
- **Your own font.** You can add your own font as a .ttf file. It is kept in your browser and inside saved projects.
- **Fonts everywhere.** One font applies to all text, and any single text can have its own. Every font used is embedded in the PDF, so no text falls back to a standard font.
- **Journal font check.** The checker warns when a journal names other fonts (Elsevier, Springer, Nature, PLOS, IEEE). It offers a one-click fix.
- **Page size.** Drag any edge of the white page to make it bigger or smaller. You can also extend or shrink each side in steps of 1, 5, 10 or 25 mm, or trim the page to its contents.
- **Parts stay on the page.** Parts keep their place on the paper. Anything a smaller page would cut off is moved back onto it. This also applies after changing the journal size.
- **Page colour.** The page can be white, any colour, or see-through ("None") for PNG and SVG.
- **Text.** Text wraps at the box width, Shift+Enter starts a new line, and the box grows to fit.
- **Shortcuts.** Ctrl+D duplicates a part. Ctrl+C and Ctrl+V copy and paste it.

**Remaining limits:**
- Only one part can be selected at a time.
- Deleting a layer has no confirmation (Ctrl+Z brings it back).
- Adding your own file from Layers takes three clicks.
- At a 1024 px window the status line is cut short.
- PostScript-style .otf fonts cannot be embedded. Use the .ttf version of the font.
- Detailed rivers and roads depend on the free OpenStreetMap servers, which are sometimes busy.

## Interface polish from user research (19 October 2026, v0.23)

**What users say.** Three Sonnet helpers did the research.
- **Reddit and forums.** One helper read r/gis and r/QGIS threads through an archive, because Reddit blocks search tools, plus Hacker News and QGIS trackers. People struggle most with:
  - inset maps;
  - fiddly coordinate grids;
  - odd scale-bar steps (2.5 km);
  - clutter;
  - a steep learning curve.
- **Tools people call easy and professional.** One helper looked at reviews of Datawrapper, Felt, MapChart, Canva and Figma. What people praise:
  - no sign-up;
  - no blank start;
  - a step-by-step flow;
  - smart defaults;
  - a preflight check;
  - clear feedback.
- **First-time-user review.** One helper tested the running site. It scored friendliness 7/10 and professional look 8/10, and listed 20 issues; phones were the weakest area.

**What changed (highlights).**
- **First screen:**
  - no rulers or tools until there is a map;
  - a neutral "Journal check";
  - "Try" example places;
  - a short promise: free, no sign-up, no watermark, journal-size vector PDF, files stay on your computer.
- **Search:** results are grouped into "Official boundaries" and "Other places". Once an area is chosen, the chooser folds behind "Change area".
- **Design:**
  - jump chips: Style, Font, Layout, Page size;
  - a colour-blind preview, shown on screen only;
  - a simpler Page size panel.
- **Map parts:** three clear groups (Map essentials, On the map, Locator maps), each switch with a one-line plain hint.
- **Page editor:**
  - one "Arrange" menu instead of eight small buttons;
  - quick labels on the tools;
  - a loading bar;
  - new texts grow sideways as you type.
- **Scale bar:** round steps only (0 2 4 6 8 km), and its numbers never collide.
- **Top bar:** "Saved in this browser". Journal check reminders are grey rather than green, and each problem has a "Show me" button. The File menu says what it does: "Download project file".
- **Export:** a clear message after each download, and no download of an empty map.
- **Help:** step cards, a gesture table, keyboard shortcuts and common questions.
- **Phones:** a taller bottom sheet with a grab bar, opening fully while searching. Nothing scrolls sideways at 360 px.
- **Speed:** zooming had slowed to 170–345 ms pauses. Map labels were recalculating shapes that never change; that work is now cached, and the pauses are back under 200 ms.

**Tests.** All 8 suites pass:

| Suite | Result |
|---|---|
| core | 23/23, three runs |
| editor | pass |
| fonts and page | 21/21 |
| undo | exact |
| places | 13/13 |
| search | 6/6 |
| screen sizes | 6/6, no tap target under 24 px |
| keyboard | focus ring on all 46 stops |

## Text styles, colours and pro editing (20 October 2026, v0.24)

**Asked for:**
- bold or italic for every text;
- better colours and user experience;
- working like a professional tool.

**Bold, italic and colour everywhere:**
- **Which text:** names on the map, grid coordinates, the legend title and entries, scale bar numbers, the north arrow letters, locator labels, credits and titles.
- **Where to change it:**
  - in each part's settings;
  - on the floating toolbar (B, I, A−, A+);
  - with Ctrl+B and Ctrl+I;
  - all at once (Design, Font, "All text at once").
- **Layout:** bold text is measured as bold, so legends and labels make room for it.
- **Export:** the PDF embeds the real bold and italic font faces.

**Colours:**
- **Colour picker:** one picker everywhere, with:
  - colour-blind-safe, map-tone, strong and soft palettes;
  - recent colours;
  - a hex box, the system picker and an eyedropper.
- **Map styles:** 10 styles in all, retuned for print (they also read in greyscale). Four are new: Journal grey, Coastal blue, Earth tones and High contrast.
- **Following the style:** OpenStreetMap detail and locator markers now follow the map style.
- **Relief:** shaded relief no longer covers the sea.

**Professional editing:**
- **Shift+click:** select several parts, then move, nudge, align, space evenly, duplicate, delete, copy or style them together.
- **My styles:** save a map's look, apply it to the next map so a series matches, share it as a file, or make it the default for new maps.

**How it was checked:**
- **Review:** an ultracode review workflow with 48 Sonnet agents (code reviewers with different focuses, a browser tester, and a skeptic for every finding) confirmed 33 problems.
- **Fixes:** four Sonnet fixers, each owning separate files, fixed all 33, each group re-checked by a skeptic. A final browser re-test passed 12 of 12.
- **Tests:** all nine test suites pass, including a new one for these features (tests/suite-pro.js, 17 checks).

**Known limits:**
- A font you add needs its own bold or italic file to print bold or italic. The checker says when one is missing.
- Applying a map style recolours boundary lines you had changed by hand.

## Several areas, tabs and more designs (20 October 2026, v0.25)
- **Several areas on one map:** add any place next to the one you have (Dhaka and Gazipur, a city and a district, two countries) and show them as one merged area, separate outlines, or each in its own colour with its own legend line. Take any area off with x.
- **Recent places:** your last places are one click away.
- **Tabs instead of long scrolling:** Design (Colours, Text, Layout, Page, My styles) and Map parts (Essentials, On the map, Locators, Add) show one section at a time, each with a one-line description of what is there.
- **More designs:** 5 scale bar designs with numbers above or below, and 12 map styles (new: Pastel and Vintage).
- **Tests:** all ten suites pass, including the new tests/suite-areas.js.

## All six skills run on the website (20 October 2026, v0.26)
Each skill reviewed the live site, then the findings were fixed. In plain words:
- **Easier to use with a keyboard or screen reader:**
  - A "Skip to the map" link.
  - Menus and popovers you can move through with the arrow keys.
  - Clear names on every button.
  - Messages that are read out.
- **Easier to see and tap:**
  - Text boxes have visible edges.
  - Greyed-out buttons are still readable and say why they are off.
  - Phone buttons are finger-sized.
  - The map is bigger on phones and never disappears when the page is zoomed in.
- **Safer:** Start over, Delete and Remove now show an **Undo** button. Wrong sizes or dpi values explain themselves instead of silently changing.
- **Tidier:**
  - "Place" no longer appears three times.
  - The zoom buttons no longer cover the legend.
  - The file name shows in full.
  - You can rename the map on a phone.
- **Bugs found by the browser test and fixed:**
  - Trim cut off the grid numbers.
  - New parts were dropped on top of the study area.
  - A switched-off locator stayed selected.
  - The phone Download button covered a field.
- **Search:** when the free place search is slow, the app now says so, and it no longer leaves old results on screen.
- **Tests:** eight of nine suites pass fully. The search suite misses one place only because the free search service answered slowly today.

## Click the page to resize it (20 October 2026, v0.27)
- Click any empty part of the page, or the grey area around it: the page gets a blue edge and a toolbar with **Width − +**, **Height − +**, **Fit to contents** and **Page settings**. The edge handles turn blue so you can also drag them. Works on phones too.

## Balance and colour (20 October 2026, v0.28)
- **Map layout:** the side column now lines up with the map: the locator at the top, the legend and scale bar at the bottom, level with the map frame. The map itself is less cluttered.
- **What the eye sees first:** the coordinate grid sits under your study area instead of on top of it, so your area stands out and the grid stays in the background.
- **Map styles:** Atlas, Black and white and Earth tones use a lighter fill, so relief and place names read clearly.
- **Editor:** calmer colours (green only for a tick, blue for where you are and what to do next), the same corner rounding everywhere, lighter shadows and clearer section headings.

## New look: Field Notebook (20 October 2026, v0.29)
You chose this look from five on the choice page.
- **The look:** a yellow notebook cover (top bar and left side), white panels with a thin red margin line, and dark pencil-grey for the main buttons. The desk behind your page is graph paper in real millimetres: it grows with zoom and lines up with the page edge.
- **Panels you pointed at:**
  - all 12 map styles now fit on screen in a compact grid;
  - the Layers list shows only the eye until you point at a row;
  - Map parts, Export, My styles and Help use calm ruled rows instead of boxes inside boxes.
- **Flow:** the four steps show their state at a glance: done (solid tick), now (blue), to come (dashed), not yet possible (struck through).
- **Checked:** an independent design review asked for 8 fixes; all were made and it signed off. All ten test suites pass.

## Smoother map and tidier panels (21 October 2026, v0.30)
- **Smoother map:** the map now carries about a quarter of the drawing data, and outlines are converted once and reused. The pause after a pan or zoom is about 30% shorter on a slow laptop, and hard to notice on a normal one. Maps look exactly the same.
- **Empty start page:** before you choose a place, the world fills the page instead of a narrow frame.
- **Journal size menu:** each publisher on one row with its sizes neatly beside it.
- **Colours panel:** all colour dots on one row, no uneven button rows, and map styles three across with readable names.
- **Tests:** all ten suites pass.

## White cover and calmer panels (21 October 2026, v0.31)
- **No more yellow:** you compared five colours on real screenshots and chose clean white for the top bar and left strip. The graph-paper desk and the notebook details stay.
- **Page tab:** a small drawing of your page with − and + on each edge replaces the grid of eight boxed buttons.
- **Buttons you cannot press yet** are a light grey shape, not a heavy dark block.
- **Add tab:** every option is a clean row with an icon.
- **Tests:** all ten suites pass.

## Every design skill run again (21 October 2026, v0.32)
- **Red line removed.** Map styles show as tiny maps in their own colours; buttons, sliders and drop-downs have one calm, consistent look.
- **Calmer panels:**
  - every tab uses the same spacing, quiet +/− sections and on/off switches;
  - tabs no longer repeat their own name;
  - Colours, Layout, Page and Help fit with little or no scrolling;
  - settings for a selected part (legend, scale bar, main map) have clear sections.
- **Better flow:** the four steps are joined by a line that fills in as you go, and every step's main button (Next, or Download on Export) sits in the same place at the bottom.
- **Fixed:**
  - a greyed-out button turning dark on hover;
  - the Place panel growing while you type;
  - boxes cut off in the map settings;
  - Layers names cut short;
  - the page not fitting the screen on 1100 px laptops.
- **Tests:** all suites pass.

## Drawing on the map and cleaner defaults (21 October 2026, v0.33)
- **Tick marks** appear only on sides that show coordinates.
- **Rivers start off.** Turn them on in Map parts, Layers. The detailed water no longer loads by itself.
- **Layers up and down** now move past hidden layers, so every click changes the map. Rivers and Lakes say why their eye is greyed out while "Rivers and water" is on.
- **Draw on the map:** points, lines, areas and freehand, from the left tool strip or Map parts, Add. Shapes go into a "My drawing" layer with its own legend line and colours.
- **Drill-down figures (a)(b)(c):**
  - (b) shows the division around your district (not the district again);
  - all panel letters sit top-left;
  - the zoom box is lighter;
  - the zoom lines run cleanly from the box to the next map.
- **Tests:** all ten suites pass.

## Everything from the review, round by round (21 October 2026, v0.35–v0.37)
You asked for all of the list (problems, design and features), and for "click anything and change anything".

**Click anything, change anything**
- Click the map once to select it, then click any name, river, point or area on it: that one thing gets its own settings (its own colours, its name, show or hide).
- Drag a name to move it. A name moved far away gets a thin pointer line back to its place.
- Every part has "More options" and "Box, see-through and turn":
  - a background, a border and rounded corners;
  - see-through and rotation (a turn handle on the page);
  - line spacing and outlined letters for text;
  - legend columns;
  - scale-bar and north-arrow colours;
  - the inset-map frame.
- Arrows can have heads at either or both ends, filled or open; lines can be dotted.
- Special characters (², °, ′, ±) for km², °C and 23°45′N.

**Working like professional software**
- One menu on the left (Place, Design, Map parts, Export). Layers moved into Map parts. Much less scrolling.
- New tool strip with named menus (Text, Map parts, Shapes, Picture, Draw on the map).
- Drag a box to select several parts, group them (Ctrl+G), and right-click for a menu.
- Drawing: Backspace or Ctrl+Z removes the last point, and Esc finishes.
- "Saving…" in the top bar; your last change is kept even if you close the page at once.

**Your data**
- Sample sites from CSV or Excel (.xlsx) can be:
  - coloured, shaped or sized by a column;
  - drawn as numbered circles (1, 2, 3).
- Colour areas from a table, for example the population of each upazila:
  - choose the classes (equal, quantiles or natural breaks) and the colours;
  - fix names that don't match from a list;
  - a "No data" pattern for missing areas.
- New layers:
  - towns and cities;
  - contour lines;
  - distance rings;
  - recent NASA satellite pictures (a clear dry-season picture at 30 m, or a chosen day).
- "What is the map about?" buttons set the map up for sampling sites, rivers, coasts, cities or hills.
- Fade or hide everything outside the study area.

**For your paper**
- Export, "Text for your paper": area in km², boundary length, centre coordinates, plus ready sentences for the study area, the methods and the alt text.
- "Download all as .zip": PDF, TIFF, SVG, caption and project file together.
- The journal check offers one-click fixes ("Use PDF", "Use 500 dpi"). It warns when two colours look alike in black-and-white print, and has a black-and-white preview.

**Never lose a map**
- File, My maps: every map kept in your browser with a picture. Copy them, and keep named versions ("Before reviewer 2") to go back to.
- File, Copy a share link: the whole map travels inside the link. Nothing is uploaded.
- Works offline after the first visit and can be installed like an app.
- A short tour on the first visit, and three finished example maps to start from.

**Fixed**
- The red ruler line is now blue.
- Screen-reader names for every slider.
- The globe locator no longer hides under the country map.
- Names no longer cross the study-area outline.
- New text no longer lands on the map edge.
- The drill-down now joins (a) to (b) to (c).
- Choosing a town (for example Savar) now gives its upazila, not the whole district.
- Rivers load only when turned on.
- The yellow colour was removed from the choices.

**Tests:** all twelve groups pass (two new ones cover the navigation and the data styling). The only exceptions were places that the free online search was too slow to return; a different place failed on each run.

## More maps, tables and charts (22 October 2026, v0.38–v0.39)
- **Detail map:** Map parts, Add, More maps.
  - A second map frame that enlarges part of your area (the city thanas, a cluster of sites), with a box on the main map and lines to the detail.
  - Pan it by dragging, zoom it with the wheel, type its scale, or "Choose on the main map" by dragging a box.
  - It gets its own names, grid and letter, and relief or satellite pictures too. A scale bar can measure either map.
- **Table of sites:** your sample sites as a table on the page (number, name, latitude and longitude in degrees, minutes and seconds, any other column), sized to fit, with zebra rows and a caption if you want them.
- **Elevation profile:** draw a line on the map, then add the profile. You get a small chart of the ground height along it, with A and B marked at both ends on the map.
- **Names on top:** place names are always drawn above every layer (the Rangamati lake no longer covers them).
- **Drill-down:** panel (b) is always the area around yours, even when you picked your area from the place search.
- **Tests:** fourteen groups, including new ones for parts and maps.

## Final version (22 October 2026, v0.40)
- Everything from the review list is in, except the Bangla interface (not wanted) and three items that need a free download first: your own raster files (GeoTIFF), GeoPackage files, and the disputed-border views.
- All 14 test groups pass.
