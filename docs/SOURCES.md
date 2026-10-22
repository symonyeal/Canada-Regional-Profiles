# Sources

A method is validated by the source it implements. Cite only what this file records, and
add the entry in the change that uses it. Status is **inspected** (read for this project,
with what was read and when) or **cited** (not yet read).

## Methods

| Source | Used for | Status |
| --- | --- | --- |
| Snyder, J. P., *Map Projections: A Working Manual*, USGS Professional Paper 1395, 1987 | §15 Lambert conformal conic, eqs. 14-15, 15-1 to 15-11, 7-9; worked example pp. 295-297 is `tests/test_geo.py` | cited; worked example reproduced to 0.1 m, 2026-10-22 |
| Douglas, D. H. and Peucker, T. K., "Algorithms for the reduction of the number of points required to represent a digitized line", *Cartographica* 10(2), 1973 | line simplification of map layers (`logistics.dp`) | cited |
| Krugman, P., *Geography and Trade*, MIT Press, 1991 | locational Gini, tested and refused (DECISIONS) | cited |
| Jensen, J. B. and Kletzer, L. G., "Tradable Services: Understanding the Scope and Impact of Services Offshoring", *Brookings Trade Forum* 2005 | concentration threshold 0.1, tested and refused (DECISIONS) | cited |
| Delgado, M., Porter, M. E. and Stern, S., "Defining clusters of related industries", *Journal of Economic Geography* 16(1), 2016 | traded/local classification (`industry.traded_share`, `industry.traded`) | cited; traded 6-digit list taken from the tabulation below |
| Ellison, G. and Glaeser, E. L., "Geographic concentration in U.S. manufacturing industries", *Journal of Political Economy* 105(5), 1997 | γ index, tested and refused (DECISIONS) | cited |
| milocortes/InvESt_complexity (GitHub, commit fd4d430), `porter_transables_cluster_clases_NAICS_2017.md` | the 668 NAICS US 2017 codes in DPS traded clusters (`data/dps_traded_naics_us2017.txt`) | inspected 2026-10-22: 51 clusters; all codes are valid US 2017 codes |
| US Census Bureau, `2-6 digit_2017_Codes.xlsx` | all 1,057 NAICS US 2017 6-digit codes (`data/naics_us2017_6digit.txt`) | inspected 2026-10-22 |

## Data

| Source | Used for | Status |
| --- | --- | --- |
| Statistics Canada, Canadian Business Counts, with employees, June 2026 (table 33-10-1174-01) and June 2021 (33-10-0395-01) | largest and fastest-growing industries; business tiles | inspected 2026-10-22: NAICS to 6 digits, eight size classes |
| Statistics Canada, Canadian Business Counts, with employees, by CMA and CSD, June 2026 (33-10-1176-01) | concentration test, refused (DECISIONS) | inspected 2026-10-22: 3,307 CSDs, NAICS to 4 digits |
| Statistics Canada, Postsecondary enrolments by detailed field of study, institution, and program and student characteristics (37-10-0277-01) | talent pipeline | inspected 2026-10-22: 2009/10 to 2024/25; 25.8 GB, sliced once |
| Statistics Canada, Air passenger traffic at Canadian airports, annual (23-10-0253-01) | airport passengers | inspected 2026-10-22: many airport-years suppressed |
| Statistics Canada, Census of Population 2021: 98-10-0004 (population and dwellings), 98-10-0022 (age), 98-10-0400 (labour force by education), 98-10-0293 (Indigenous identity), 98-10-0057 (household income), 98-10-0240 (dwelling type by tenure) | workforce and market tiles; census-division names | inspected 2026-10-22: wide format, DGUID levels 0000/0002/0003/0005 |
| Statistics Canada, Labour Force Survey, territories, three-month moving average (14-10-0292-01) | latest employment and unemployment rate | inspected 2026-10-22 |
| Statistics Canada, Population estimates, quarterly (17-10-0009-01) | current population and five-year growth | inspected 2026-10-22 |
| Natural Resources Canada, Atlas of Canada National Scale Data 1:1,000,000: Roads, Railways, Boundary Polygons (2017) | road, rail and boundary layers | inspected 2026-10-22: fields TYPE, CARTO, POL_DIV; NAD83 Canada Atlas Lambert |
| ISED, National Broadband Data, PHH Speeds (current, 2026-05-12) and Pseudo-Household Demographic Distribution 2021 | share of households with 50/10 Mbps | inspected 2026-10-22: data dictionaries |
| OurAirports, `airports.csv` (public domain) | airports with scheduled service | inspected 2026-10-22 |
| NGA, World Port Index (Pub. 150) | ports | inspected 2026-10-22: no Yukon or NWT entries |
| Fisheries and Oceans Canada, Small Craft Harbours Locations and Information | harbours | inspected 2026-10-22 |
| Localintel, Advance Rural Manitoba, *Why Rural Manitoba* (advanceruralmanitoba.ca/why-rural-manitoba) | the dashboard layout reproduced here: six panels and their data sources | inspected 2026-10-22 |
