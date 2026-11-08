# Coverage and comparison with the reference

The 2026-10-29 internal-consistency audit corrected WDS scaling of missing values, Business Counts map cells
and specialization denominators, resident-sector summaries, and annual chart calendars. These changes preserve
source definitions and geography coverage. See [Validation](VALIDATION.md) for the checks and sampling limits.

The current interface has four views: Findings, Economy, Compare and Detail ([Decisions](DECISIONS.md), 2026-10-26). Optional maps contain the distribution explorer and community finder. Findings and Compare include annual measures over a chosen range; the years below are the first published, as of 2026-10-26.

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

The matrix below compares the exhibits that the current views still draw with the original reference ([REFERENCE.md](REFERENCE.md)). The reference's logistics and talent sections are not reproduced.

## Reference feature matrix

The 2026-10-25 visual redesign intentionally changes the page styling: ivory and green surfaces, copper comparisons, serif headings, a geography panel and numbered navigation. The following matrix records functional and data coverage against the original reference; it does not claim visual identity. See [Decisions](DECISIONS.md).

| Tool and feature | Reference | This site | Status | Check (Manitoba unless stated) |
| --- | --- | --- | --- | --- |
| Page | Title band, nine headed sections | Four views; the title band carries geography selection, comparison area, copy link and refresh; sticky section links | replacement | Rendered at 1440, 768 and 390 px; no horizontal page overflow |
| **Community profile**: six dashboards | Fixed grids, icon rail | Same grids and rail; each card loads independently | reproduced | All six captured |
| Economic KPIs | LFS participation, unemployment, employment; population; family income labelled household | Same tables; family income labelled as family income; Census 2021 fallback for levels without the series | reproduced | 15/15 participation and unemployment within display rounding, 15/15 employment exact, 12/12 income years exact |
| Establishments | Business Register series 2018–2026 | June Business Counts releases (national tables for provinces, CMA/CSD tables for those levels) | replacement | 0/9 years equal; reference universe undocumented |
| Household income distribution | Five bands vs Canada | Same bands as complete sums of published 2020 income groups | reproduced | 10/10 shares within 0.05 points |
| Top sectors, industry treemap, occupations, education | Census 2021 | Same characteristics | reproduced | 9/9, 20/20, 5/5, 4/4 exact |
| Resident, household, dwelling, livability distributions | Census 2021 with Canada ticks | Same; three tenure categories (band housing shown) | reproduced | Age bands 8/9 within rounding (reference "80 and older" is 85+); construction 16/16, commuting 6/6, place of work 3/3, home ownership 4/4 |
| Mean commuting time | 22.8 min, undocumented method | Share of commutes under 30 minutes | replacement | The Census Profile publishes duration bands only |
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

When a source does not publish a level, the card says so and, for industries, offers the province. Provincial values are never shown under a local name.

## Known gaps

| Gap | Public sources checked | Outcome |
| --- | --- | --- |
| Rail industry 4821 and other suppressed SEPH cells | SEPH 14-10-0202 | Not shown; reference fills them by estimate |
| LQ factor | Four denominators tested | Unexplained; standard LQ shown |
| Traded/local | DPS cluster mapping | 51/55 agreement; labelled approximate |
