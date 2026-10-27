# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated ("best possible"). Chosen: Svelte 5 + Vite + TypeScript, built as a static site with no server. Maps are drawn with d3-geo + proj4 into one SVG page measured in millimetres. Hosting: Cloudflare Pages, mirrored on GitHub Pages. Reasoning is in RESEARCH.md section 5.

## Users

Researchers, master's and PhD students, and anyone writing a paper, thesis or report who needs a study area (location) map figure. Most have no GIS training. Many are in South Asia and other low-budget settings, with slow connections and no money for ArcGIS. They often arrive under deadline pressure: a thesis due, or a reviewer asking for a better map.

## Product Purpose

StudyMap makes a publication-grade study area map in minutes, in the browser, with no login and no cost. Quality must match a figure made in QGIS or ArcGIS Pro. Success means a student exports a figure that a journal accepts on the first try.

## Positioning

The only free tool that combines:
- true vector export (PDF and SVG) plus 300 to 1200 dpi raster;
- any map projection (EPSG), including national grids;
- cartographically correct grids, scale bars and insets by default;
- journal-size presets;
- legally clean boundary data down to small units.

Competitors (AcadGIS, CalculatGeek, Study Area Map Generator) each lack several of these. See RESEARCH.md section 2.

## Operating Context

- Users pick a country and admin unit, or upload their own boundary or points.
- They style the map and add insets, grid, scale bar, north arrow and legend.
- They export at an exact journal width (for example 85 mm or 170 mm), then put the file into Word, LaTeX or a journal submission system.
- Maps often need re-editing after reviewer comments.

## Capabilities and Constraints

- **No login, ever.** Everything runs client-side, and user data never leaves the browser.
- **$0 running cost.** Static hosting only, with no paid APIs and no card-billed services.
- **Data licensing must allow publication in commercial journals.**
  - Allowed: Natural Earth, geoBoundaries gbOpen, Mapterhorn and OpenFreeMap.
  - Never hosted: GADM, UN SALB, WDPA.
- **Credits are generated automatically** for every export.
- **Open source**, MIT license.
- **Undecided:** domain, final logo, and languages beyond English (Bangla planned).

## Brand Commitments

Name: StudyMap (working name, chosen by the user).

## Evidence on Hand

- RESEARCH.md (competitors, journal requirements, data licenses, technology, hosting).
- No users, testimonials or usage numbers exist yet. Do not invent them.

## Product Principles

1. **Correct by default.** The map should be journal-ready without the user knowing cartography rules, and the tool should warn when something would be wrong.
2. **The figure is the product.** What is on screen is exactly what gets exported, in millimetres.
3. **Free and private.** No login, no tracking of content, works on a slow connection.
4. **Every choice is still editable.** Good defaults never lock the user out of full control.

## Accessibility & Inclusion

- The interface follows WCAG 2.2 AA.
- Exported maps default to colourblind-safe palettes.
- The interface must work on low-end laptops and slow networks.
