# Sources

A method is validated by the source it implements. Cite only what this file records, and
add the entry in the change that uses it. Status is **inspected** (read for this project,
with what was read and when) or **cited** (not yet read).

## Reference

| Source | Used for | Status |
| --- | --- | --- |
| Advance Rural Manitoba, *Why Rural Manitoba* (advanceruralmanitoba.ca/why-rural-manitoba), embeds by Localintel (ecdev.org) | the dashboard reproduced: layout, chart types, palette, data definitions (`docs/REFERENCE.md`); recorded Manitoba numbers (`tests/fixtures/reference_mb.json`) | inspected 2026-10-22: eight embeds rendered and their API traffic recorded |

## Methods

| Source | Used for | Status |
| --- | --- | --- |
| Snyder, J. P., *Map Projections: A Working Manual*, USGS Professional Paper 1395, 1987 | §15 Lambert conformal conic (`geo.py`; spherical form in `site/app.js`); worked example pp. 296-297 is `tests/test_geo.py` | cited; worked example reproduced to 0.1 m |
| Douglas, D. H. and Peucker, T. K., *Cartographica* 10(2), 1973 | line simplification of map layers (`logistics.dp`) | cited |
| Jenks, G. F., "The data model concept in statistical mapping", *International Yearbook of Cartography* 7, 1967; Fisher, W. D., *JASA* 53, 1958 | natural-breaks classes of the choropleths (`site/app.js: jenks`), as the reference's `natural_break` legend | cited |
| Delgado, M., Porter, M. E. and Stern, S., "Defining clusters of related industries", *Journal of Economic Geography* 16(1), 2016 | traded/local classification (`industry.traded_share`, `industry.traded`) | cited; traded 6-digit list from the tabulation below |
| milocortes/InvESt_complexity (GitHub, commit fd4d430), `porter_transables_cluster_clases_NAICS_2017.md` | the 668 NAICS US 2017 codes in DPS traded clusters (`data/dps_traded_naics_us2017.txt`) | inspected 2026-10-22: 51 clusters; all codes are valid US 2017 codes |
| US Census Bureau, `2-6 digit_2017_Codes.xlsx` | all 1,057 NAICS US 2017 6-digit codes (`data/naics_us2017_6digit.txt`) | inspected 2026-10-22 |
| Krugman, P., *Geography and Trade*, 1991; Jensen, J. B. and Kletzer, L. G., *Brookings Trade Forum* 2005; Ellison, G. and Glaeser, E. L., *JPE* 105(5), 1997 | concentration-based traded/local tests, refused (DECISIONS) | cited |

## Data

### Live application services (inspected 2026-10-22)

| Public source | Runtime use | Inspection |
| --- | --- | --- |
| [Statistics Canada developers](https://www.statcan.gc.ca/en/developers) and [Census Profile WDS guide](https://www12.statcan.gc.ca/wds-sdw/2021profile-profil2021-eng.cfm) | Profile data and geography membership | Official developer page read; live SDMX requests returned 200 with the GitHub Pages CORS origin. The guide page itself presented a browser security check on this network. |
| [Census Profile SDMX endpoint](https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/all/all/latest) | DF_PR, DF_CD, DF_CSD, DF_CMACA, DF_ER and DF_POPCNTR; published characteristic, gender, statistic and source-note dimensions | Dataflow metadata and sample data read. Dimension order is FREQ, REF_AREA, GENDER, CHARACTERISTIC, STATISTIC. |
| [Statistics Canada Web Data Service](https://www.statcan.gc.ca/en/developers/wds) | Live catalogue, cube metadata and selected coordinates | Official method list read; getAllCubesListLite, getCubeMetadata and getDataFromCubePidCoordAndLatestNPeriods queried. CORS accepted. |
| [Live table catalogue](https://www150.statcan.gc.ca/t1/wds/rest/getAllCubesListLite) | Discover current Business Counts releases and same-month five-year baseline | Read; national/province and CMA/CSD table families are matched separately. |
| [Statistics Canada Census boundaries](https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer) | Selected boundary geometry via public ArcGIS form POST | Service/layer metadata and Winnipeg GeoJSON query read; GET query URLs returned application errors, form POST returned 200 with CORS. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) and [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Live basemap and bounded facility queries | Network features are volunteered map data, not complete inventories. The map displays service errors rather than fabricated facilities. |
| [ISED National Broadband Data](https://open.canada.ca/data/en/dataset/00a331db-121b-445d-b119-35dbbe3eedd9) | Official broadband map link | Catalogue read. Large bulk-download resources are not used by the live site. The interactive map was blocked by this machine's network; no live household aggregate is claimed. |

### Historical offline inputs

The following inputs document the original Python build. They are not downloaded or served by the live application. The live application queries Business Counts and PSIS through WDS, population estimates through 17-10-0009, and Labour Force Survey rates through 14-10-0287/0292.

| Source | Used for | Status |
| --- | --- | --- |
| Statistics Canada, Survey of Employment, Payrolls and Hours, employment by industry, annual (14-10-0202) | largest and fastest-growing industries, LQ | inspected 2026-10-22: reproduces the reference's values; no rail (482) |
| Statistics Canada, Census Profile 2021, SDMX API (api.statcan.gc.ca/census-recensement/profile/sdmx), dataflows DF_PR, DF_CD, DF_CSD; codelist CL_CHARACTERISTIC | community profile, market, workforce | inspected 2026-10-22: 2,631 characteristics; 165 used |
| Statistics Canada, Labour Force Survey by province, territory and economic region, annual (14-10-0464) | participation, unemployment, employment series | inspected 2026-10-22 |
| Statistics Canada, population estimates on July 1 (17-10-0005; census subdivisions 17-10-0155) | population series | inspected 2026-10-22 |
| Statistics Canada, selected income characteristics of census families (11-10-0009) | median total income series | inspected 2026-10-22 |
| Statistics Canada, Canadian Business Counts with employees, June 2016 to June 2026 (33-10-0040 … 33-10-1174); by census subdivision, June 2026 (33-10-1176) | establishment series; businesses by subdivision; traded weights | inspected 2026-10-22 |
| Statistics Canada, Postsecondary enrolments by detailed field, institution and characteristics (37-10-0277) | talent pipeline | inspected 2026-10-22: 2009/10 to 2024/25; 25.8 GB, sliced once |
| Statistics Canada, Variant of CIP Canada 2021 Version 1.0 – Primary groupings (statcan.gc.ca/en/media/4226) | grouping of fields of study | inspected 2026-10-22: series 30 split by subseries |
| Statistics Canada, Open Database of Educational Facilities v2.1 (37-26-0001) | campus locations | inspected 2026-10-22 |
| Statistics Canada, 2021 cartographic boundary files, ArcGIS REST (geo.statcan.gc.ca) | jurisdiction and subdivision boundaries | inspected 2026-10-22: some field lists fail server-side |
| Statistics Canada, Standard Geographical Classification 2021, Appendix B | census subdivision type names | inspected 2026-10-22 |
| Statistics Canada, Air passenger traffic at Canadian airports, annual (23-10-0253) | airport passengers by sector | inspected 2026-10-22: many airport-years suppressed |
| Environment and Climate Change Canada, Canadian Climate Normals 1981–2010 (api.weather.gc.ca, collection climate-normals) | climate summary | inspected 2026-10-22: no Iqaluit station |
| Natural Resources Canada, Atlas of Canada 1:1,000,000: Roads, Railways, Boundary Polygons (2017) | road and rail layers | inspected 2026-10-22 |
| ISED, National Broadband Data, PHH Speeds (current, 2026-05-12) and Pseudo-Household Demographic Distribution 2021 | broadband availability | inspected 2026-10-22 |
| OurAirports, `airports.csv` (public domain) | airports with scheduled service | inspected 2026-10-22 |
| NGA, World Port Index (Pub. 150); Fisheries and Oceans Canada, Small Craft Harbours | ports | inspected 2026-10-22 |
