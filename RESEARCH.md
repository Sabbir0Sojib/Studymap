# Study Area Map Maker: Research and Plan

Researched on 2026-10-12. Five topics were researched in parallel, and the findings are combined here.
Links to every source are in section 9.

---

## 1. The short answer

**The idea is good, but you are not the first.**

Since 2025, several free study area map tools have appeared (section 2). Two of them are close to your idea.
None of them reaches QGIS or ArcGIS quality yet, and that is your opening.

**Win on quality, not on being free.**

Your tool should be the only free one that gives all of these:

1. **True vector export.** PDF, SVG and EPS that stay sharp at any zoom, plus TIFF and PNG at 300 to 1200 dpi.
2. **Any map projection.** Including UTM, Lambert, Albers and national grids such as BTM for Bangladesh.
3. **Correct cartography by default.** Correct coordinate grids in DMS (degrees, minutes, seconds), scale bars that warn you when they are wrong, the projection stated automatically, and colourblind-safe colours.
4. **Locator insets that build themselves.** Country → division → district → site, with extent boxes and connector lines.
5. **Boundaries down to small units** (upazila, union, village), from data that is legal to use.
6. **Journal presets.** Pick "Elsevier, single column" and the size, dpi, fonts and line widths are set for you.
7. **Your own data, with no errors.** Paste coordinates, or upload CSV, Excel, Shapefile, KML or GeoPackage.
8. **Credits written for you.** The data attribution text is added to every export automatically.

**It can be built and run for $0, with no credit card.**

All of it runs in the user's browser on free static hosting. There are no servers to pay for.

---

## 2. Competitors

| Tool | What it is | Strong points | Weak points (your opening) |
|---|---|---|---|
| **AcadGIS** (July 2026) | Free web app and Python package | Country → state → district layouts, terrain, land cover, PNG/PDF/SVG | Uses **GADM** boundaries, which ban commercial use and re-hosting. Fixed 300 dpi. No projection choice seen. |
| **CalculatGeek Study Area Map Maker** | Free browser tool | Many inset layouts, 5 projections, CSV points | No basemap and no terrain; PDF only 200 dpi; no shapefile upload |
| **Study Area Map Generator** (journal paper, Oct 2025) | Free Python web app | Simple, well liked (91% of the 92 users surveyed would recommend it) | Country or city level only, PNG only, basic scale bar, blurry basemap |
| **UTM Study Area Mapper** | Web tool | Templates, shapefile upload | PNG only |
| **Datawrapper locator maps** | Commercial web tool | Very polished | Vector export is paid; no grid; Mercator projection only |
| **Felt, Mapbox, ArcGIS** | Paid | Powerful | Cost money, and exports are limited |
| **QGIS** | Free desktop GIS | Full quality | Hard to learn; users take days or months to finish a map |
| **R / Python / GMT** | Code | Reproducible | You need to know how to code |

**What users struggle with** (taken from YouTube comments on tutorials, plus papers):

- Finding boundaries for small areas like upazilas, wards and mouzas. This is the biggest pain.
- Coordinate grid labels in QGIS are confusing, and the DMS format is hard to set up.
- Their own GPS points don't show up on the map.
- It takes days or even months: "3 days tried but fail… stop myself to submit thesis."
- Blurry basemaps and low-quality exports.
- Kashmir and other disputed borders.

**Signs of demand:**

- About 40 YouTube tutorials on "study area map" have about 2.8 million views in total. Many of them are in Bangla, Hindi, Nepali or Sinhala.
- Fiverr has 367 gigs selling study area maps for $5 to $45 each. People pay money for this.
- Interest peaks in April and May, which is thesis season.

---

## 3. What "publication grade" means

### What journals ask for

| Rule | Typical requirement |
|---|---|
| Width | Single column 84–90 mm, 1.5 column about 140 mm, double column 174–190 mm |
| Resolution | 300 dpi for images, 600 dpi for combined image and line art, 1000–1200 dpi for line art |
| Formats | Vector: PDF, EPS or SVG with fonts embedded. Raster: TIFF (LZW compression) or PNG |
| Fonts | Arial or Helvetica, at least 7–8 pt, one font family throughout |
| Lines | At least 0.25–0.3 pt thick |
| Colour | RGB (CMYK is rarely required) |
| File size | Often 5–10 MB at most |
| Special rules | PLOS accepts only TIFF or EPS and rejects Google basemaps. MDPI *Remote Sensing* requires a scale, north arrow and coordinates. |

### What every study area map should have

- Main map with a frame (neatline)
- One to three locator insets, each with an extent box
- North arrow, or a coordinate grid
- Scale bar, kept simple, with the units written out
- Coordinate grid with labels in degrees, such as 23°45′N
- Legend
- Labels with a halo so they stay readable
- Hillshade or elevation shading
- Sample or station points, rivers and roads
- Data credits, and the projection with its EPSG code

### Mistakes reviewers point out, which the tool should prevent

- **The projection is not stated.** A 2026 preprint (not yet peer reviewed) of 299 published maps found that only 1.7% named their projection.
- **Scale bars on Web Mercator or latitude/longitude maps are wrong.** The tool should warn about this or calculate the scale correctly.
- **Rainbow and red-green colour scales.** 55% of geoscience papers in one study used them.
- **Text that is too small, blurry exports, and too many different fonts.**

### Disputed borders

Springer Nature, Elsevier, MDPI and Frontiers all stay "neutral on jurisdictional claims." India has a law against publishing maps of India that don't match the Survey of India.

The tool should:

- Use Natural Earth's de facto borders by default.
- Offer a "worldview" switch (Natural Earth includes India, China, Pakistan and other viewpoints).
- Allow drawing disputed borders as dashed lines, or hiding them.
- Offer an optional disclaimer line.

---

## 4. Map data that is free AND legal in published papers

### Safe to use

| Need | Source | License |
|---|---|---|
| World and country borders | **Natural Earth** | Public domain, no credit needed |
| States, districts, upazilas, unions, villages | **geoBoundaries (gbOpen)** | CC BY 4.0, but every layer has its own license, so read it and print it. India's districts and villages are ODbL. |
| Alternative borders | World Bank Official Boundaries | CC BY 4.0 |
| Elevation and hillshade | **Mapterhorn** terrain tiles (Copernicus 30 m) | Open, with credit. Works directly in the browser. |
| Ocean depth | GEBCO 2026 | Public domain, with credit |
| Street-style basemap | **OpenFreeMap**, or your own Protomaps file | OpenStreetMap (ODbL), with credit |
| Satellite imagery | Sentinel-2 cloudless **2016 only** (EOX), NASA GIBS, Landsat | CC BY or public domain |
| Rivers and lakes | Natural Earth | Public domain |
| Land cover | ESA WorldCover, Esri/IO 10 m land cover | CC BY 4.0 (must be pre-converted into tiles first) |
| Climate zones | Köppen-Geiger V3 (Beck 2023) | CC BY 4.0 |

### Do NOT host or serve these in the app

- **GADM.** Re-hosting and commercial use are banned. A user may upload their own copy.
- **UN SALB and UN Geodata.** Non-commercial only, and SALB forbids simplifying the shapes.
- **WDPA protected areas.** Re-distribution is banned, so users must upload it themselves.
- **Basemaps that ban print or export on their free plans:** MapTiler, Stadia, Mapbox and Google.
- **The OpenStreetMap standard tile server.** Its policy bans the kind of high-resolution export rendering this tool does.
- **Sentinel-2 cloudless 2017–2025.** Non-commercial and ShareAlike.
- **Thunderforest.** Its images are ShareAlike, which conflicts with journal copyright.
- **HydroRIVERS.** It may only be redistributed with its own license terms attached, so handle it carefully.

### OpenStreetMap in a printed figure

A map image made from OSM data is a "Produced Work," and the image can be published under any copyright.
Two things must be printed with it: "© OpenStreetMap contributors" and the address openstreetmap.org/copyright.

**The tool will write all of these credits into each export automatically.**

---

## 5. Technology

### Main decision: draw the whole map page as one vector image (SVG), measured in millimetres

| Option | Can it use any projection? | True vector export? | Verdict |
|---|---|---|---|
| MapLibre GL JS | No (only Web Mercator and globe) | No (pixels only) | Only for a quick preview |
| OpenLayers | Yes | No (pixels only) | Optional, for picking the area interactively |
| **D3-geo + proj4js** | **Yes, any EPSG code** | **Yes, native SVG** | **Main engine** |
| Mapbox GL | Limited | No | Avoid: proprietary, needs a key |

Why this approach:

- **The editor and the export are the same thing**, so what you see is exactly what you get.
- **Exact sizes come for free.** The page is set as, for example, 170 mm wide.
- **One drawing gives every format:** SVG, PDF and EPS, plus TIFF and PNG at any dpi.

### Building blocks (all free and open source)

| Job | Library |
|---|---|
| App framework | Svelte 5 or React 19, with Vite and TypeScript |
| Projections | proj4js, plus a built-in list of all 7,352 EPSG codes (works offline) |
| Map drawing | d3-geo, d3-geo-projection |
| Drag and resize layout items | interact.js |
| Vector PDF | jsPDF + svg2pdf.js, or PDFKit later (better fonts, CMYK colours) |
| High-dpi TIFF and PNG | Draw in tiles, then write TIFF with UTIF.js (with the dpi tag set). Browsers can't draw one huge image, and iPhones cap out at 16.7 megapixels. |
| Import files | shpjs (Shapefile), togeojson (KML/GPX), papaparse (CSV), SheetJS (Excel), geopackage, geotiff.js |
| Simplify detailed borders | mapshaper |
| Hillshade | Fetch terrain tiles, re-project them, shade them in the background, and place the result into the SVG |
| Contour lines | d3-contour |
| Saving | Project file (.json) and automatic saving in the browser |

### Projects to learn from

- **Map-O-Matic** (MIT license). The closest open-source project to this idea.
- **Layout-Composer / GeoLibre** (MIT license). DMS grids, insets, PDF export.
- **maplibre-gl-export** and **mapshaper**.
- **qgis-js.** Real QGIS running in the browser, but it has no print layouts yet, so it isn't usable now.

### Hard parts and risks

1. **High-dpi export uses a lot of memory.** It must be drawn in tiles, with a lower maximum dpi on phones.
2. **Very detailed borders make SVG slow.** Simplify them to suit the export size.
3. **Grid labels must use exact maths** (with proj4), not D3's simplified sphere.
4. **Automatic label placement is hard.** Version 1 uses manual labels.
5. **EPS and CMYK can only be basic.** Be honest with users about this.

---

## 6. Running it for $0

**Hosting the app**

| Option | Notes |
|---|---|
| **Cloudflare Pages** (main host) | Unlimited bandwidth, no card needed, and it can't send you a surprise bill |
| GitHub Pages (backup copy) | |
| Vercel | Fine for donations ("asking for donations is not commercial use") |

**Large data files**

- Small, simplified border files go inside the app itself.
- Large files go on **Hugging Face datasets** or **Source Cooperative**. Both are tested and work with the browser, and neither needs a card.
- Basemap: OpenFreeMap. Terrain: Mapterhorn.
- Avoid Cloudflare R2 for now. It needs a card and has no spending cap.

**Domain**

Start free on `yourname.pages.dev`. Later, buy a .com or .org for about BDT 1,000–1,750 a year from a Bangladeshi reseller that accepts bKash.

**Safety**

Use only services that pause or slow down when a limit is reached, rather than sending a bill. The app should still export maps when a basemap is down.

**Money that works from Bangladesh**

| Option | Status |
|---|---|
| PayPal, Stripe, Ko-fi, Buy Me a Coffee, Liberapay, GitHub Sponsors (direct) | Not available from Bangladesh |
| **Open Collective** (through Open Source Collective) | Pays out through Payoneer, and also unlocks GitHub Sponsors |
| **Patreon** | Pays out through Payoneer |
| **bKash QR code** | For local supporters |
| **Grants** | OSGeo community grants, NumFOCUS small grants, and Google Summer of Code after about one year |
| NLnet | Only with a European partner |

**Getting known**

- Put a small "Made with …" credit and a suggested citation on every export.
- Add a `CITATION.cff` file to the code repository, and get a DOI through Zenodo.
- After 6 months of public development, publish a software paper. JOSS is free. SoftwareX may waive its fee through Research4Life.
- Make YouTube tutorials in **Bangla, Hindi and English**, since that's where the audience already is.
- Post on r/gis, r/QGIS, ResearchGate and LinkedIn.
- Run workshops at universities in Bangladesh.
- Make one web page per country or district ("Study area map of Sylhet") so search engines find it.

**License and privacy**

- License the code as MIT or MPL-2.0.
- There are no user accounts, and maps are made on the user's own computer, so almost no personal data is collected.
- Analytics: Cloudflare Web Analytics or GoatCounter (free, no cookies).

---

## 7. The plan

### Phase 0: Foundations (week 1)

- [ ] Choose a name.
- [ ] Set up a GitHub organisation and repository, with an MIT or MPL license.
- [ ] Set up Vite, Svelte or React, and TypeScript.
- [ ] Deploy automatically to Cloudflare Pages.
- [ ] Design the look of the app with the installed design skills (taste, minimalist, impeccable).

### Phase 1: The core map (weeks 2–5). The prototype.

- [ ] A layout page in mm, with journal size presets.
- [ ] One map frame. Choose the country and admin level from Natural Earth or geoBoundaries. Highlight the study area.
- [ ] Any projection (EPSG search), with sensible auto-suggestions such as the right UTM zone or a national grid.
- [ ] Coordinate grid with DMS labels and N/S/E/W letters.
- [ ] North arrow (a few clean styles).
- [ ] Scale bar that is calculated correctly and warns when it would be misleading.
- [ ] Export: SVG and vector PDF.
- [ ] Testing: Playwright tests that export a map and check its size and dpi.

### Phase 2: Publication ready (weeks 6–10). First public release (v1.0).

- [ ] Locator insets (one to three), with automatic extent boxes and connector lines.
- [ ] Your own points: paste them or upload CSV or Excel, with automatic detection of DMS and decimal degrees, and checks for mistakes.
- [ ] Upload Shapefile, KML or GeoJSON.
- [ ] Legend, text boxes, and labels with halos.
- [ ] Hillshade from Mapterhorn.
- [ ] High-dpi TIFF and PNG (300–1200 dpi, drawn in tiles, with the dpi tag set).
- [ ] Automatic credits text and a projection note.
- [ ] Colourblind-safe colour sets, a colourblindness preview, and a warning when a rainbow colour scale is chosen.
- [ ] Journal checker: "text below 7 pt", "file over 10 MB" and similar warnings.
- [ ] Save and open project files, and automatic saving in the browser.
- [ ] Disputed border options and a disclaimer.
- [ ] Full design review and accessibility review (the impeccable and Vercel guideline skills).

### Phase 3: Growth (months 3–6)

- [ ] Templates: one-click styles such as "Classic thesis", "Minimal" and "Nature style".
- [ ] More layers: basemap (OpenFreeMap), satellite (2016 cloudless, NASA), land cover, rivers, contour lines.
- [ ] Bangla interface (and later Hindi and Spanish).
- [ ] Country and district landing pages for search engines, and YouTube tutorials.
- [ ] Open Collective, Patreon and bKash pages. CITATION.cff and a Zenodo DOI.
- [ ] A paper for JOSS (needs 6 months of history) or SoftwareX.

### Later ideas

- EPS export
- Map series (one map per district)
- Charts and tables inside the layout
- Automatic label placement
- Contour lines
- Offline app (PWA)
- Shareable style links

---

## 8. Decisions you need to make

1. **Name** of the website.
2. **Framework:** Svelte (simpler code) or React (more tutorials and help online). Recommendation: **Svelte**.
3. **Code license:** MIT (most open) or MPL-2.0 (changes to your files must stay open). Recommendation: **MIT**.
4. **Open source from day one?** Recommended. It is needed for grants, Open Collective, JOSS and trust.
5. **First country to polish:** Bangladesh (upazila and union level), then expand.

---

## 9. Sources

### Competitors

- AcadGIS: https://app.acadgis.com · https://arxiv.org/abs/2607.10017
- CalculatGeek: https://calculatgeek.com/study-area-map-generator-online/
- Study Area Map Generator: https://doi.org/10.3390/ijgi14100387
- UTM Study Area Mapper: https://dev.kstutm.com/studyarea/
- Datawrapper pricing: https://www.datawrapper.de/pricing
- Fiverr gigs: https://www.fiverr.com/search/gigs?query=study%20area%20map
- Map projection survey (2026 preprint): https://egusphere.copernicus.org/preprints/2026/egusphere-2026-4209/

### Journal rules

- Elsevier: https://www.elsevier.com/about/policies-and-standards/author/artwork-and-media-instructions/artwork-sizing
- Springer: https://link.springer.com/journal/10661/submission-guidelines
- Nature: https://research-figure-guide.nature.com/figures/preparing-figures-our-specifications/
- PLOS: https://journals.plos.org/plosone/s/figures
- MDPI *Remote Sensing*: https://www.mdpi.com/journal/remotesensing/instructions
- Copernicus: https://publications.copernicus.org/for_authors/manuscript_preparation.html
- Journal of Maps common errors: https://files.taylorandfrancis.com/TJOM-Common-Errors.pdf

### Colour and disputed borders

- Crameri et al. 2020: https://doi.org/10.1038/s41467-020-19160-7
- ColorBrewer: https://colorbrewer2.org/
- Natural Earth disputed boundaries: https://www.naturalearthdata.com/about/disputed-boundaries-policy/

### Data

- Natural Earth terms: https://www.naturalearthdata.com/about/terms-of-use/
- geoBoundaries API: https://www.geoboundaries.org/api.html
- GADM license: https://gadm.org/license.html
- Mapterhorn: https://mapterhorn.com/data-access/
- OpenFreeMap: https://openfreemap.org/
- OSM tile usage policy: https://operations.osmfoundation.org/policies/tiles/
- OSM Produced Work guideline: https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline
- OSM attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- Copernicus DEM license: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf
- EOX cloudless license: https://cloudless.eox.at/documentation/license
- WDPA legal terms: https://www.protectedplanet.net/en/legal

### Technology

- MapLibre roadmap: https://maplibre.org/roadmap/maplibre-gl-js/
- D3 projections: https://d3js.org/d3-geo/projection
- svg2pdf.js: https://github.com/yWorks/svg2pdf.js
- PDFKit: https://github.com/foliojs/pdfkit
- Browser canvas size limits: https://github.com/jhildenbiddle/canvas-size
- Map-O-Matic: https://github.com/JCinnamon/map-o-matic
- qgis-js: https://github.com/qgis/qgis-js

### Hosting and funding

- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Hugging Face storage limits: https://huggingface.co/docs/hub/storage-limits
- Open Source Collective: https://docs.oscollective.org/getting-started/acceptance-criteria
- OSGeo 2026 budget: https://wiki.osgeo.org/wiki/OSGeo_Budget_2026
- JOSS: https://joss.readthedocs.io/en/latest/submitting.html

### Not fully verified

- Reddit, StackExchange and ResearchGate pages blocked automated reading.
- Some AGU, Nature and IEEE figures came from search snippets.
- Patreon payout to Bangladesh should be checked before relying on it.
