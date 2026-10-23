# Coverage and comparison with the reference

The page reproduces the nine tools of the [reference](REFERENCE.md) in its order and composition, for Canada, all 13 provinces and territories and local Census geographies. Every observation is requested from a public service when the tool is shown. Status: **reproduced** (same behaviour and, for Manitoba, the same values where the definitions match), **replacement** (a public-data equivalent that measures something stated on screen), **not reproduced** (the input is not public).

## Feature matrix

| Tool and feature | Reference | This site | Status | Check (Manitoba unless stated) |
| --- | --- | --- | --- | --- |
| Page | Title band, nine headed sections | Same order; title band carries geography selection, comparison area, copy link and refresh; sticky section links | reproduced | Rendered at 1440, 768 and 390 px; no horizontal page overflow |
| **Logistics**: layout | Left panel with five network cards, map right | Same; accent per network | reproduced | Captures of all five tabs |
| Airport card | OAG international and domestic route counts, arcs | Passengers and international/transborder passengers (23-10-0253) at NAV CANADA airports; all published airports listed, unmapped ones marked | replacement | YWG 4.3 M passengers (2025); routes and frequencies not shown |
| Drive time | 2, 4, 8 hours | 30 and 60 minutes (Valhalla, OpenStreetMap roads); off switch; note when a site has no road connection | replacement | Public server caps contours at 60 minutes |
| Major roads | Highways, major locations with population | National Highway System (Transport Canada); metropolitan areas and agglomerations with Census population | replacement | Winnipeg 834,678 (2021) |
| Sea ports | Port of Churchill, Thunder Bay | Ports and seaports recorded in Wikidata inside the province | replacement | Port of Churchill listed; not an official inventory |
| Rail | Rail lines, intermodal terminal card | National Railway Network lines (CanVec) | replacement | Terminals not mapped |
| Broadband | Census-subdivision download-speed choropleth | Atlas of Canada coverage areas by speed tier, latest year (2024) | replacement | Areas with service, not household shares |
| **Community profile**: six dashboards | Fixed grids, icon rail | Same grids and rail; each card loads independently | reproduced | All six captured |
| Economic KPIs | LFS participation, unemployment, employment; population; family income labelled household | Same tables; family income labelled as family income; Census 2021 fallback for levels without the series | reproduced | 15/15 participation and unemployment within display rounding, 15/15 employment exact, 12/12 income years exact |
| Establishments | Business Register series 2018–2026 | June Business Counts releases (national tables for provinces, CMA/CSD tables for those levels) | replacement | 0/9 years equal; reference universe undocumented |
| Household income distribution | Five bands vs Canada | Same bands as complete sums of published 2020 income groups | reproduced | 10/10 shares within 0.05 points |
| Top sectors, industry treemap, occupations, education | Census 2021 | Same characteristics | reproduced | 9/9, 20/20, 5/5, 4/4 exact |
| Resident, household, dwelling, livability distributions | Census 2021 with Canada ticks | Same; three tenure categories (band housing shown) | reproduced | Age bands 8/9 within rounding (reference "80 and older" is 85+); construction 16/16, commuting 6/6, place of work 3/3, home ownership 4/4 |
| Mean commuting time | 22.8 min, undocumented method | Share of commutes under 30 minutes | replacement | The Census Profile publishes duration bands only |
| Climate | Winnipeg 1991–2020 normals | ECCC station nearest the area (or its largest metropolitan area), period read from the record (1981–2010); station selectable | replacement | Station and distance stated |
| Resident and household maps | Age and household-income sliders | Same, census-subdivision choropleth; card reports the area's own published total | reproduced | Card 861,265 for ages 10–59 vs reference 865,770 (sum of CSDs) |
| **Community explorer** | Search, type chips, logos, boundary map, external pages | Search, type chips, initials, boundary map, coordinated selection, Census panel, opens the community's own profile; all census subdivisions | reproduced, extended | Duplicate names shown with type and CSD code |
| **Market**: consumers, dwellings, businesses | Range sliders and toggle lists; one active filter; 123/% | Same filters, ramps and toggle; businesses from the CMA/CSD Business Counts table | reproduced | $30K–$70K: 433,775 (province total) vs 433,675 (reference sum of CSDs) |
| **Workforce** indicators and catchment | Treemap, occupations, education; three catchment maps | Same | reproduced | Reference catchment map did not render during inspection |
| **Industry insights** | Banner opening a full-screen application | Same structure: selection (search, browse by sector), trends, benchmarks, location | reproduced | Trends: SEPH employment, establishments, establishment LQ, GDP (provinces), weekly earnings |
| Benchmarks | Financial performance ("No data available") | Payroll-employment LQ by province and territory; note that financial benchmarks are not in the data service | replacement | |
| **Fast-growing industries** | Option cards; bubbles and list | Same; SEPH 2020–2025 absolute change | reproduced | All: 19/20 values exact; 4821 not published by SEPH |
| **Largest industries** | Option cards; treemap, bars, list | Same; treemap grouped by sector | reproduced | All: 20/20 values and ranks exact |
| LQ | About 1.093 × standard | Standard SEPH LQ: area share of the industrial aggregate over Canada's share | differs | 0/57 equal; four denominators tested |
| Traded/local | Localintel classification | Mapped Delgado–Porter–Stern clusters (approximate) | replacement | 51/55 labels agree |
| **Talent pipeline** | Groupings with counts, institution map, students in reach | Groupings as published (37-10-0011), filters for institution type and registration, trend; institutions from OpenStreetMap with exact-name matching | reproduced, replacement for locations | Ranking of groupings matches; totals differ in period |
| Local geographies | Province client | Canada, provinces, territories, CSDs, CDs, CMAs/CAs (including provincial parts), economic regions, population centres | extended | Sweep in [VALIDATION.md](VALIDATION.md) |

## Data availability by level

| Exhibit family | Canada | Province/territory | CMA/CA | CSD | CD | ER | Population centre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Census Profile exhibits and maps | yes | yes | yes | yes | yes | yes | yes |
| LFS annual series | yes | yes | Census fallback | Census fallback | Census fallback | yes | Census fallback |
| Population estimates | yes | yes | yes | yes | yes | to 2022 | Census only |
| Tax-filer income series | yes | yes | yes | Census fallback | Census fallback | Census fallback | Census fallback |
| Payroll industries (SEPH) | yes | yes (suppressed cells stay missing) | Business Register estimates | Business Register estimates | not published | not published | not published |
| Establishments | yes | yes | yes | yes where published | not published | not published | not published |
| Enrolments | Canada | province; territories combined for groupings | province of the area | province of the area | province of the area | province of the area | province of the area |

When a source does not publish a level, the card says so and, for industries, offers the province. Provincial values are never shown under a local name.

## Known gaps

| Gap | Public sources checked | Outcome |
| --- | --- | --- |
| OAG routes, destinations and frequencies | StatCan 23-10-0253, Transport Canada airports | Passengers shown instead; routes not reproduced |
| Drive-time areas beyond one hour | FOSSGIS Valhalla (60-minute cap), OSRM demo (no isochrones) | 30 and 60 minutes only |
| Broadband household aggregates | ISED service (token required), NRCan Atlas coverage service | Coverage areas only |
| Ports and terminals | Wikidata, OpenStreetMap; no federal port or terminal service with CORS | Ports from Wikidata; terminals not mapped |
| Institution locations | ODEF is a download only; OpenStreetMap via Overpass (slow at times) | Exact-name matches; whole-institution counts, never campus allocations |
| Talent totals | 37-10-0011, 37-10-0277 | Groupings published directly; reference total (63,027) matches no published year |
| Rail industry 4821 and other suppressed SEPH cells | SEPH 14-10-0202 | Not shown; reference fills them by estimate |
| LQ factor | Four denominators tested | Unexplained; standard LQ shown |
| Traded/local | DPS cluster mapping | 51/55 agreement; labelled approximate |
| 1991–2020 climate normals | ECCC climate-normals collection | Not served; 1981–2010 shown with its period |
