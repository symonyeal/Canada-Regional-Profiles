# Reference dashboard, reverse engineered

Source: advanceruralmanitoba.ca/why-rural-manitoba, inspected 2026-10-22 by rendering each embed in
headless Edge and recording its network traffic over the Chrome DevTools Protocol. The page is a
WordPress site; every exhibit is a Localintel ("ecdev.org") Angular embed loaded by
`api.ecdev.org/includes/js/block-embed-loader.js`, parameterised by `location=ca-pr-46` (Manitoba).

## Page

Header "Why Manitoba?", then a tab bar: Logistics & Access, Work Force, Largest Industries, Fastest
Growing Industries, Talent Pipeline, Community Profile. Then nine headed sections, eight of them with
an embed:

| Section heading | Embed | Here |
| --- | --- | --- |
| Logistics by Design | `tool-advantages-logistics` | §1 |
| Ideal Demographics | `frameset-community-profile` | §2 |
| Vast Resources | `gateway-community-explorer` | §3 |
| Marketplace Vibrancy | `frameset-market-advantages` | §4 |
| Skilled Workers | `frameset-workforce-advantages` | §5 |
| Industry Insights | — (text) | |
| Fast Growing Industries | `frame-fast-growing-industries` | §6 |
| Diversity of Industry | `frame-largest-industries` | §7 |
| Talent Pipeline | `tool-advantages-talent-pipeline` | §8 |

Theme (`reference/client/rmed/customStyle`): chart colours #7d622e, #473729; active tab #473729
with white text. Sector palette (blockConfig `chart-gen2-largest-industries`): 11 #3A9E52, 21 #696969,
22 #BFB028, 23 #BE8417, 31-33 #8769FF, 41/42 #AB2F62, 44-45 #FE5F4E, 48-49 #63C7B2, 51 #FFEC36,
52 #13DABC, 53 #0D68BF, 54 #BEC0C3, 55 #BE473A, 56 #0DA38C, 61 #FEB11F, 62 #128bff, 71 #E54084,
72 #4ED36E, 81 #564EFE.

## Embeds

**§1 Logistics** (`tool-advantages-logistics`). Left: title, description, five stacked tabs
(Airport, Major Road, Sea Port, Rail and Freight, Broadband Network). Right: map. Airport tab: a card
for the selected airport (name, IATA, international and domestic connection counts from
`reference/location/airport`, OAG), arcs to destinations (`reference/flightroutes/YWG`), and a
drive-time polygon (`reference/drivetime/lat,lon`). Broadband: `map-broadband-simple`.

**§2 Community profile** (`frameset-community-profile`). Icon rail of six dashboards:
- Economic: participation-rate KPI with sparkline (LFS 14-10-0461/0464), population KPI with bars
  (17-10-0005), median household income KPI (11-10-0009), household income distribution against
  Canada (Census), unemployment rate, total employment (LFS), total establishments (Business
  Register), top employment sectors (Census).
- Resident: population, median individual income (11-10-0008), median age, population map, age
  distribution.
- Household: median income, average size, number of households, income map, size distribution.
- Dwelling: home ownership pie, construction period, dwelling type.
- Workforce: education donuts, industry treemap, top occupations.
- Livability: average owner and renter costs, mean commute time, climate normals (ECCC), commuting
  mode.

**§3 Community explorer** (`gateway-community-explorer`). Search box, chips by municipal type (City,
Local Government District, Municipality, Rural Municipality, Town, Village), a list of communities,
and a boundary map; each community opens its own community profile.

**§4 Market** (`frameset-market-advantages`). Icon rail: Local Consumers, Local Dwellings, Local
Businesses. Each has accordion filters and a census-subdivision choropleth (natural breaks, six
classes #FFFFB2 to #BD0026, # or % toggle) with "Total" and "Target" counts. The data come from
`map-data/census-sum/ca/<client>/csd/1/<location>/<characteristics>`, which sums the selected Census
Profile characteristics per census subdivision. Filters:
- Consumers: individual income (12 bins), individual age, household income, household type.
- Dwellings: construction period, structure type, tenure, number of bedrooms.
- Businesses: industry and size.

**§5 Workforce** (`frameset-workforce-advantages`). Icon rail: Indicators (education donuts for
postsecondary, bachelor's or higher, master's or higher, other above bachelor; a treemap of residents'
industry of employment; an inverted bar of top occupations), and Catchment (a choropleth with
education, occupation and industry filters).

**§6 Fast growing industries** and **§7 Largest industries** (`frame-*`). Left: title, description,
three option cards (All, Traded, Local, each with a sentence). Right: Chart/List toggle. Data:
`data/industryadvantagedata/<client>?locationId=…` returns `{startYear 2020, endYear 2025, largest:
{all, traded, local}, fastest: {all, traded, local}}`, each a list of 20 four-digit NAICS industries
with `code, title, tradedLocal, employmentCount, employmentLq`, plus `employmentChange` for fastest.
"Fastest" ranks by absolute change. Largest is a treemap grouped by sector; fastest is a bubble chart
(x = employment change, y = employment, colour = sector, sizeFactor 25) with zoom sliders. Source:
"Statistics Canada - Business Register".

**§8 Talent pipeline** (`tool-advantages-talent-pipeline`). Left: a list of CIP primary groupings with
student counts (All Programs 63.0K, Humanities 10.1K, …). Right: a map of institutions. Dataset
`edgov-institution-programs`, source "Statistics Canada - PSIS".

## Open replacements

| Reference input | Here |
| --- | --- |
| OAG connections and routes | Statistics Canada passengers by sector, table 23-10-0253 |
| Drive-time isochrones | not reproduced |
| Census Profile (`census-sum`) | Census Profile SDMX API (`api.statcan.gc.ca/census-recensement/profile/sdmx`), dataflows DF_PR, DF_CD, DF_CSD |
| Boundaries (vector tiles) | StatCan 2021 cartographic boundary files, ArcGIS REST, simplified |
| Institution locations | Open Database of Educational Facilities v2.1 |
| Climate normals | ECCC Canadian Climate Normals 1991–2020 |


## Runtime implementation follow-up, 2026-10-22

The later live client retains these recovered definitions and chart types. Independent live requests matched the recorded Manitoba top-20 industry codes and employment, annual participation, family income, education numerators and Census industry distribution. This establishes those comparisons, not universal visual parity or an independent verification of every proprietary reference response.

The ECCC collection used by the original climate module identifies itself as **1981-2010**, not 1991-2020: https://api.weather.gc.ca/collections/climate-normals?f=json . The live client reads that period from collection metadata and labels the selected station. The 1991-2020 mentions above record the earlier intended source and must not be read as the actual period returned by this API.
