# Reference dashboard

The site presents Findings, Economy, Compare and Detail views ([DECISIONS.md](DECISIONS.md), 2026-10-26). This file records the page it was first compared against, for the data definitions that the current views still use. Its composition and styling are not the current specification.

The reference is [Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/) by Advance Rural Manitoba. Each tool on that page is an embedded Localintel (ecdev.org) application parameterised by `location=ca-pr-46` (Manitoba). It was rendered in Edge on 2026-10-22 at 1440, 768 and 390 px wide, every control was exercised, and the embeds' API responses were recorded.

A headless browser receives HTTP 406 from `rmed.ecdev.org/embed/*`; with a desktop user agent the embeds redirect to `app.ecdev.org` and render.

## Sections that the current views draw on

| Section heading | Embed | Current view |
| --- | --- | --- |
| Ideal Demographics | `frameset-community-profile` | Detail |
| Vast Resources | `gateway-community-explorer` | Distribution explorer and community finder (maps, on request) |
| Marketplace Vibrancy | `frameset-market-advantages` | Distribution explorer |
| Skilled Workers | `frameset-workforce-advantages` | Detail (resident sectors) |
| Industry Insights | `gateway-industry-insights` | Economy |
| Fast Growing Industries | `frame-fast-growing-industries` | Economy |
| Diversity of Industry | `frame-largest-industries` | Economy |

The reference has two further sections, logistics and a talent pipeline, which the site no longer shows ([DECISIONS.md](DECISIONS.md)).

## Embeds

**Community profile.** An icon rail with six dashboards on fixed grids.
- Economic: participation (LFS 14-10-0461/0464, 2011 to 2025), population (17-10-0005, bars), "median household income" (11-10-0009, which is the census-family table), household income in five bands against Canada, unemployment, total employment (LFS), establishments (Business Register, 2018 to 2026), top nine Census sectors.
- Resident: population, median individual income (11-10-0008), median age, an age-range map, and age in ten-year bands against Canada.
- Household: median income, average size, number of households, a household-income map, household type, and household size as 100 % bars.
- Dwelling: owner and renter shares, construction period, dwelling type.
- Workforce: resident industry treemap, top five occupations, four education bars on a 0 to 100 % axis (population aged 25 to 64).
- Livability: median property value, median monthly rent, mean commuting time, mode of transport, place of work.

**Community explorer.** Search, chips by municipal type, a list of 137 client-selected communities with logos, and a boundary map with red dots. Each community opens an external page on the client's website.

**Market.** Rail with Consumers, Dwellings and Businesses. Accordion filter cards: range sliders for ordered bins (individual income, age, household income, construction period, bedrooms) and toggle lists with All and None for categories (household type, structure type, tenure, industry). The open card alone defines the target. Data: `map-data/census-sum/ca/rmed/csd/1/ca-pr-46/<characteristics>` sums selected Census characteristics per census subdivision.

**Workforce.** Rail with Indicators (the workforce dashboard) and Catchment (education, occupation and industry maps with toggles). The catchment map did not render during this inspection; the filters did.

**Industry insights.** A banner with "Search for an industry" and "Browse all industries". Both open a full-screen application with a rail: Industry selection, Trends (employment by industry, establishments, establishment LQ, GDP by industry, average weekly earnings), Benchmarks (financial performance; it showed "No data available") and Location (businesses by size class and a census-subdivision map).

**Fast-growing and largest industries.** Left: title, description and three option cards (All, Traded, Local). Right: a chart card. Largest: Treemap, Bars or List. Fast-growing: Chart or List, with bubbles at x = employment change 2020 to 2025, y = employment 2025, area proportional to jobs, coloured Traded (dark) or Local (light). Lists show rank, industry, NAICS, five-year change, jobs and LQ. Data: `data/industryadvantagedata/rmed?locationId=ca-pr-46` gives 20 industries per set with `code, title, tradedLocal, employmentCount, employmentLq` and `employmentChange`. Source label: "Statistics Canada - Business Register"; the values are SEPH payroll employment.

## Reference defects and undocumented definitions

| Exhibit | Observation |
| --- | --- |
| Median household income | Uses 11-10-0009, median total income of census families, under a household label. |
| Age distribution, "80 and older" | 2.0 % for Manitoba, which equals 85 and over; the Census sum of 80–84 and 85+ is 4.2 %. |
| Mean commuting time | 22.8 minutes from "Census Profile", which publishes duration bands only; the method is not stated. |
| Largest and fast-growing industries | Values for NAICS 4821, 5511 and 3231 that SEPH does not publish for Manitoba, so suppressed cells are filled by an unpublished estimate. LQs are about 1.093 times the standard SEPH LQ, and four tested denominators fail to reproduce them. |
| Establishments | Neither the total nor the classified subtotal of any June or December Business Counts release reproduces the series. |

Recorded responses and captures are kept with the project's working evidence, outside this repository. The committed inputs for the golden tests are in `tests/fixtures/`.
