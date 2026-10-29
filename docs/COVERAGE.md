# Coverage and comparison with the reference

The 2026-10-29 internal-consistency audit corrected WDS scaling of missing values, Business Counts map cells
and specialization denominators, resident-sector summaries, and annual chart calendars. These changes preserve
source definitions and geography coverage. See [Validation](VALIDATION.md) for the checks and sampling limits.

The current interface has four views: Findings, Economy, Compare and Detail ([Decisions](DECISIONS.md), 2026-10-26). Optional maps contain the distribution explorer and community finder. Logistics, enrolments and station climate normals are no longer shown. Findings and Compare include annual measures over a chosen range; the years below are the first published, as of 2026-10-26.

| Exhibit | Canada | Province/territory | CMA/CA | CSD | CD | ER | Population centre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Findings with ranks | spread across provinces | among 13 | among 152 whole areas | province's CSDs with 1,000+ residents | province's CDs | among 76 | among 1,026 |
| Resident sectors (Census) | shares only | yes | yes | yes | yes | yes | yes |
| Payroll shift-share (SEPH) | sector change | yes | no | no | no | no | no |
| Most similar areas | no (all provinces listed) | yes | yes | yes | yes | yes | yes |
| Neighbours | no | no | no | yes, within the province | yes, within the province | no | no |
| Detailed industries | SEPH | SEPH | Business Register estimates | Business Register estimates | not published | not published | not published |
| Over time: population | 1971– | 1971– | 2001– | 2001– | 2001– | 2001– | no |
| Over time: median age, 65+ share | 1971– | 1971– | 2001– | no | 2001– | 2001– | no |
| Over time: immigrants per 1,000 | 1971– | 1971– | 2001– | no | 2001– | 2001– | no |
| Over time: employment, unemployment (LFS) | 1976– | 1976–, provinces only | CMAs 2011–, not CAs | no | no | 2011– | no |
| Over time: family income, low income (tax) | 2000– | 2000– | 2000– (some CAs later) | no | no | no | no |
| Over time: two-bedroom rent (CMHC) | no | no | 1992– | no | no | no | no |
| Over time: real GDP, real disposable income, life expectancy, homicides (OECD) | yes | yes (Yukon life expectancy to 2015) | no | no | no | no | no |
| Over time: mean air temperature (OECD, ERA5) | 1981– | 1981– | no | no | 1981– | no | no |

The matrix below is the historical nine-tool reference comparison, retained to document sources and differences. It does not describe the current navigation or claim that retired views remain visible.

## Historical reference feature matrix

The 2026-10-25 visual redesign intentionally changes the page styling: ivory and green surfaces, copper comparisons, serif headings, a geography panel and numbered navigation. The following matrix records functional and data coverage against the original reference; it does not claim visual identity. See [Decisions](DECISIONS.md).

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
| **Talent pipeline** | Groupings with counts, institution map, students in reach | Groupings as published (37-10-0011), filters for institution type and registration, trend; institutions from Wikidata, matched on name or alias | reproduced, replacement for locations | Ranking of groupings matches; totals differ in period |
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
| Institution locations | ODEF is a download only; OpenStreetMap via Overpass failed or timed out (2026-10-24) | Wikidata items matched on English or French name or alias; whole-institution counts, never campus allocations |
| Talent totals | 37-10-0011, 37-10-0277 | Groupings published directly; reference total (63,027) matches no published year |
| Rail industry 4821 and other suppressed SEPH cells | SEPH 14-10-0202 | Not shown; reference fills them by estimate |
| LQ factor | Four denominators tested | Unexplained; standard LQ shown |
| Traded/local | DPS cluster mapping | 51/55 agreement; labelled approximate |
| 1991–2020 climate normals | ECCC climate-normals collection | Not served; 1981–2010 shown with its period |
