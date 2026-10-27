# Data sources and credits

StudyMap writes the right credit line into every exported figure automatically. This file lists every source and its terms.

| Data | Source | Licence | Credit printed on the map |
|---|---|---|---|
| Countries, rivers, lakes, disputed areas (bundled in `public/data/`) | [Natural Earth](https://www.naturalearthdata.com/) | Public domain | "Natural Earth" (optional, added as courtesy) |
| Administrative boundaries (country, division, district, sub-district and lower) | [geoBoundaries gbOpen](https://www.geoboundaries.org/), loaded at runtime | CC BY or ODbL, depending on the country and level. The exact licence is read from the API and printed. | "geoBoundaries (licence)" |
| Elevation and hillshade | [Mapterhorn](https://mapterhorn.com/) terrain tiles, loaded at runtime. Built from Copernicus GLO-30 worldwide plus national sources | Copernicus licence (free, open) | "Elevation: Mapterhorn, containing modified Copernicus GLO-30 data (© DLR e.V., © Airbus DS, provided under COPERNICUS by the EU and ESA)" |
| Satellite imagery, 2016 (optional) | [Sentinel-2 cloudless 2016](https://s2maps.eu/) by EOX IT Services, loaded at runtime | CC BY 4.0 (the 2016 edition; later editions are non-commercial and are not used) | "Imagery: Sentinel-2 cloudless 2016 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0" |
| Satellite imagery of a chosen day or season (optional) | [NASA GIBS](https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api): VIIRS, MODIS and Harmonized Landsat Sentinel-2 (HLS), loaded at runtime | NASA data, no restrictions; credit requested | "Imagery: NASA EOSDIS GIBS, …" with the product and date |
| Detailed rivers, water bodies, roads (optional) | [OpenStreetMap](https://www.openstreetmap.org/), through the Overpass API | ODbL. A figure is a "Produced Work". | "© OpenStreetMap contributors (openstreetmap.org/copyright)" |
| Place search | [Photon](https://photon.komoot.io/) (komoot) for suggestions and [Nominatim](https://nominatim.org/) for outlines, both built on OpenStreetMap | ODbL | Covered by the OpenStreetMap credit when an outline is used |
| Map fonts (`src/assets/fonts/`): Arimo, Tinos, Cousine, Carlito, Caladea | Google Fonts / Chrome OS core fonts (metric-compatible with Arial, Times New Roman, Courier New, Calibri and Cambria) | Arimo: Apache 2.0. Tinos, Cousine, Carlito, Caladea: SIL Open Font License 1.1 (texts in `public/fonts/`) | Not needed |
| Interface font, Geist | [@fontsource-variable/geist](https://fontsource.org/fonts/geist) | SIL Open Font License 1.1 | Not needed |
| EPSG definitions for codes not built in | [epsg.io](https://epsg.io/), loaded on demand | | Not needed |

## Deliberately not used

- **GADM.** Its licence bans redistribution.
- **UN SALB and UN Geodata.** Non-commercial only.
- **WDPA.** No redistribution through web services.
- **Google, Mapbox, MapTiler and Stadia free tiers.** Their terms limit print or static export.
- **The OpenStreetMap standard tile server.** Its usage policy forbids this kind of export rendering.

See `RESEARCH.md` section 4 for the details.
