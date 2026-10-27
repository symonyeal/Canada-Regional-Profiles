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
| Statistics Canada, [Census Profile 2021 SDMX API](https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/all/all/latest) (DF_PR, DF_CD, DF_CSD, DF_CMACA, DF_ER, DF_POPCNTR) | every Census exhibit, market and catchment maps, geography lists | inspected: dimension order FREQ, REF_AREA, GENDER, CHARACTERISTIC, STATISTIC; requests list the 181 characteristics used (about 100 KB per area instead of 3 MB); cohort requests list the 30 behind the findings, 120 areas per request |
| Statistics Canada, [Web Data Service](https://www.statcan.gc.ca/en/developers/wds): getAllCubesListLite, getCubeMetadata, getDataFromCubePidCoordAndLatestNPeriods, getSeriesInfoFromCubePidCoord, getCodeSets | all table series below | inspected: data points report `scalarFactorCode` 0 for series in thousands; the member unit of measure (getCodeSets) carries the scale |
| Table [14-10-0202](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1410020201), Employment by industry, annual (SEPH) | detailed industries, LQ, industry trends and benchmarks; shift-share by sector | inspected: 4-digit NAICS, all employees, industrial aggregate [00-91N]; 20 sectors partition [11-91N] (codes such as `22,221` and `11N`; forestry and logging, not agriculture), 2019–2025 published (2026-10-26) |
| Table 14-10-0204, Average weekly earnings by industry, annual | industry trends | inspected |
| Table 36-10-0711, GDP at basic prices by industry, provinces and territories | industry trends (provinces only) | inspected |
| Tables 14-10-0464 (LFS annual, provinces and economic regions), 17-10-0005, 17-10-0155, 17-10-0148, 17-10-0152, 17-10-0137 (population), 11-10-0008 and 11-10-0009 (tax-filer income) | community-profile time series | inspected |
| Canadian Business Counts, with employees (June and December releases; national and CMA/CSD tables, discovered in the live catalogue) | establishments, business map, local employee estimates, insights location | inspected: zero series are omitted and are inferred only where published totals reconcile |
| Census Profile 2021 characteristics behind the findings: 1, 3, 37, 40, 229, 331, 1388–1389, 1400, 1402, 1426, 1434–1435, 1437, 1465–1466, 1474, 1478, 1480, 1513, 1515, 1522, 2014, 2024, 2229–2230, 2598–2599, 2603, 2607; sectors 2261–2281 | findings, comparisons, resident sectors | inspected 2026-10-26 from the full Manitoba profile (2,631 characteristics) |
| Statistics Canada, [2021 cartographic boundary files](https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer) | all boundaries, as the simplified copy in `site/boundaries/` built by `tools/boundaries` | inspected 2026-10-24: about half of new connections return HTTP 500 without CORS headers; explicit field lists always fail; full-resolution Arctic subdivisions are too large to serve (Qikiqtaaluk, Unorganized: 25 MB quantized), so geometry is requested on a 1e-4° grid, on which neighbours share positions exactly; metropolitan areas and population centres are keyed by provincial part (CMAPUID, PCUID). The www12 shapefile downloads answer scripts with a bot challenge (HTTP 403) |
| [OpenFreeMap](https://openfreemap.org/) Positron style and tiles | basemap | inspected |

## Methods and classifications

| Source | Used for | Status |
| --- | --- | --- |
| Heckbert, P. S., "Nice numbers for graph labels", *Graphics Gems*, 1990 | axis ticks (`model.niceTicks`) | cited |
| Jenks, G. F., *International Yearbook of Cartography* 7, 1967; Fisher, W. D., *JASA* 53, 1958 | natural-break map classes (`model.jenks`), as the reference's `natural_break` legend | cited |
| Delgado, M., Porter, M. E. and Stern, S., "Defining clusters of related industries", *Journal of Economic Geography* 16(1), 2016 | traded/local classification | cited; traded six-digit list below |
| milocortes/InvESt_complexity (GitHub, commit fd4d430), `porter_transables_cluster_clases_NAICS_2017.md` | the 668 NAICS US 2017 codes in traded clusters (`site/classification.json`) | inspected 2026-10-22 |
| US Census Bureau, `2-6 digit_2017_Codes.xlsx` | all 1,057 NAICS US 2017 six-digit codes (`site/classification.json`) | inspected 2026-10-22 |
| Lucide icons v0.460.0 (ISC licence) | interface icons (`site/js/icons.js`) | inspected |
| Snyder, J. P., *Map Projections: A Working Manual*, USGS Professional Paper 1395, 1987 | Lambert conformal conic in the historical `analysis/geo.py` | cited; worked example reproduced in `tests/test_geo.py` |
| Visvalingam, M. and Whyatt, J. D., "Line generalisation by repeated elimination of points", *The Cartographic Journal* 30(1), 1993 | boundary simplification (`tools/boundaries/src/simplify.rs`), with the monotone area correction of Bostock's topojson | cited; removal order and monotonicity tested |
| Bostock, M., [TopoJSON specification](https://github.com/topojson/topojson-specification) and topojson-server join/cut | shared-arc topology, quantized delta-encoded arcs (`tools/boundaries`, `site/js/geo.js`) | inspected 2026-10-24 |
| Dunn, E. S., "A statistical and analytical technique for regional analysis", *Papers and Proceedings of the Regional Science Association* 6, 1960 | shift-share decomposition (`regional-model.shiftShare`) | cited; additivity tested |
| Krugman, P., *Geography and Trade*, MIT Press, 1991 | specialisation (dissimilarity) index D = ½ Σ \|s − S\| (`regional-model.sectorBase`) | cited |
| Dean, J. and Barroso, L. A., "The tail at scale", *Communications of the ACM* 56(2), 2013 | hedged Statistics Canada requests (`site/js/api.js`) | cited |
| Douglas, D. H. and Peucker, T. K., *Cartographica* 10(2), 1973 | line simplification in the historical `analysis/logistics.py` | cited |

## Retired services

Until 2026-10-26 the logistics, talent and climate exhibits also queried Statistics Canada tables 23-10-0253, 37-10-0011 and 37-10-0277, Transport Canada and Natural Resources Canada services on geo.ca, CanVec, ECCC climate normals, the FOSSGIS Valhalla server and the Wikidata Query Service. Their inspection notes are in this file's history.

## Historical offline inputs

`analysis/` and its tests document an earlier offline build that downloaded source files (SEPH 14-10-0202, Census Profile, LFS 14-10-0464, Business Counts, PSIS 37-10-0277, ODEF, NRCan Atlas layers, ISED broadband files, OurAirports, World Port Index). The website neither downloads nor serves them.
