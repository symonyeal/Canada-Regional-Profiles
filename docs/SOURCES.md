# Sources

A method is validated by the source it implements. Cite only what this file records, and add the entry in the change that uses it. Status is **inspected** (read for this project, with what was read and when) or **cited** (not yet read).

## Reference

| Source | Used for | Status |
| --- | --- | --- |
| Advance Rural Manitoba, *Why Rural Manitoba* (advanceruralmanitoba.ca/why-rural-manitoba), embeds by Localintel (ecdev.org) | the dashboard reproduced: composition, interactions, palette, chart definitions ([REFERENCE.md](REFERENCE.md)); Manitoba values compared in [VALIDATION.md](VALIDATION.md) | inspected 2026-10-22: nine embeds rendered at three widths, controls exercised, API responses recorded |

## Runtime services

Each is queried from the visitor's browser when the exhibit is shown. All were checked from the GitHub Pages origin on 2026-10-22 for cross-origin access.

| Service | Used for | Status |
| --- | --- | --- |
| Statistics Canada, [Census Profile 2021 SDMX API](https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/all/all/latest) (DF_PR, DF_CD, DF_CSD, DF_CMACA, DF_ER, DF_POPCNTR) | every Census exhibit, market and catchment maps, geography lists | inspected: dimension order FREQ, REF_AREA, GENDER, CHARACTERISTIC, STATISTIC; requests list the 172 characteristics used (about 100 KB per area instead of 3 MB) |
| Statistics Canada, [Web Data Service](https://www.statcan.gc.ca/en/developers/wds): getAllCubesListLite, getCubeMetadata, getDataFromCubePidCoordAndLatestNPeriods, getSeriesInfoFromCubePidCoord, getCodeSets | all table series below | inspected: data points report `scalarFactorCode` 0 for series in thousands; the member unit of measure (getCodeSets) carries the scale |
| Table [14-10-0202](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410020201), Employment by industry, annual (SEPH) | largest and fast-growing industries, LQ, industry trends and benchmarks | inspected: 4-digit NAICS, all employees, industrial aggregate [00-91N] |
| Table 14-10-0204, Average weekly earnings by industry, annual | industry trends | inspected |
| Table 36-10-0711, GDP at basic prices by industry, provinces and territories | industry trends (provinces only) | inspected |
| Tables 14-10-0464 (LFS annual, provinces and economic regions), 17-10-0005, 17-10-0155, 17-10-0148, 17-10-0152, 17-10-0137 (population), 11-10-0008 and 11-10-0009 (tax-filer income) | community-profile time series | inspected |
| Canadian Business Counts, with employees (June and December releases; national and CMA/CSD tables, discovered in the live catalogue) | establishments, business map, local employee estimates, insights location | inspected: zero series are omitted and are inferred only where published totals reconcile |
| Tables [37-10-0011](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3710001101) (enrolments by CIP primary grouping) and 37-10-0277 (by institution and detailed field) | talent pipeline | inspected: 37-10-0011 publishes the groupings directly for Canada, provinces and the territories combined |
| Table 23-10-0253, Air passenger traffic at Canadian airports, annual | airport card and list | inspected: many airport-years suppressed |
| Statistics Canada, [2021 cartographic boundary files](https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer) | all boundaries | inspected: about half of new connections return HTTP 500 without CORS headers; explicit field lists always fail; metropolitan areas and population centres are keyed by provincial part (CMAPUID, PCUID) |
| Transport Canada on geo.ca: [Canadian airports with air navigation services](https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer) and [National Highway System](https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canada_national_highway_system_en/MapServer) | airport locations; highway layer | inspected: 93 airports with IATA/ICAO; dynamic layers supported |
| Natural Resources Canada on geo.ca: [High-speed internet coverage](https://maps-cartes.services.geo.ca/server_serveur/rest/services/NRCan/High_Speed_Internet_haute_vitesse/MapServer) (Atlas of Canada, ISED data, 2018–2024) | broadband layer | inspected: 4 speed tiers × 7 years |
| Natural Resources Canada, [CanVec web map service](https://maps.geogratis.gc.ca/wms/canvec_en) | railway lines (National Railway Network) | inspected |
| Environment and Climate Change Canada, [climate normals](https://api.weather.gc.ca/collections/climate-normals) | climate summary | inspected: collection and records state 1981–2010 |
| FOSSGIS [Valhalla](https://valhalla1.openstreetmap.de/) public server (OpenStreetMap) | 30- and 60-minute drive-time areas | inspected: contours capped at 60 minutes |
| [Overpass API](https://overpass-api.de/) (OpenStreetMap) | university and college locations | inspected: answers in 1 to 60 s; returns 502 at times |
| [Wikidata Query Service](https://query.wikidata.org/) | port locations (items that are ports or seaports in Canada) | inspected: subclass queries include marinas, so only direct instances are used |
| [OpenFreeMap](https://openfreemap.org/) Positron style and tiles | basemap | inspected |

## Methods and classifications

| Source | Used for | Status |
| --- | --- | --- |
| Bruls, M., Huizing, K. and van Wijk, J. J., "Squarified treemaps", *Data Visualization 2000* (Springer) | treemap layout (`model.squarify`) | cited; area and tiling invariants tested |
| Heckbert, P. S., "Nice numbers for graph labels", *Graphics Gems*, 1990 | axis ticks (`model.niceTicks`) | cited |
| Jenks, G. F., *International Yearbook of Cartography* 7, 1967; Fisher, W. D., *JASA* 53, 1958 | natural-break map classes (`model.jenks`), as the reference's `natural_break` legend | cited |
| Delgado, M., Porter, M. E. and Stern, S., "Defining clusters of related industries", *Journal of Economic Geography* 16(1), 2016 | traded/local classification | cited; traded six-digit list below |
| milocortes/InvESt_complexity (GitHub, commit fd4d430), `porter_transables_cluster_clases_NAICS_2017.md` | the 668 NAICS US 2017 codes in traded clusters (`site/classification.json`) | inspected 2026-10-22 |
| US Census Bureau, `2-6 digit_2017_Codes.xlsx` | all 1,057 NAICS US 2017 six-digit codes (`site/classification.json`) | inspected 2026-10-22 |
| Statistics Canada, Variant of CIP Canada 2021 Version 1.0 – Primary groupings | institution-level grouping in the talent map (`site/classification.json`) | inspected 2026-10-22 |
| Lucide icons v0.460.0 (ISC licence) | interface icons (`site/js/icons.js`) | inspected |
| Snyder, J. P., *Map Projections: A Working Manual*, USGS Professional Paper 1395, 1987 | Lambert conformal conic in the historical `analysis/geo.py` | cited; worked example reproduced in `tests/test_geo.py` |
| Douglas, D. H. and Peucker, T. K., *Cartographica* 10(2), 1973 | line simplification in the historical `analysis/logistics.py` | cited |

## Historical offline inputs

`analysis/` and its tests document an earlier offline build that downloaded source files (SEPH 14-10-0202, Census Profile, LFS 14-10-0464, Business Counts, PSIS 37-10-0277, ODEF, NRCan Atlas layers, ISED broadband files, OurAirports, World Port Index). The website neither downloads nor serves them.
