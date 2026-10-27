# Reference dashboard

The owner approved a five-view regional brief on 26 October 2026. The current layout follows that decision in [DECISIONS.md](DECISIONS.md); the nine-section composition below is a historical source reference, not the current visual specification. Data definitions remain relevant.

The reference is [Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/) by Advance Rural Manitoba. Each tool on that page is an embedded Localintel (ecdev.org) application parameterised by `location=ca-pr-46` (Manitoba). It was rendered in Edge on 2026-10-22 at 1440, 768 and 390 px wide, every control was exercised, and the embeds' API responses were recorded.

A headless browser receives HTTP 406 from `rmed.ecdev.org/embed/*`; with a desktop user agent the embeds redirect to `app.ecdev.org` and render. Earlier notes that "the embeds failed" described that block, not an outage.

## Page

A title band ("Why Manitoba?"), then nine headed sections in this order. Each heading is uppercase and centred over a short dashed rule and a paragraph; the embed sits below at 1340 px wide.

| Section heading | Embed | Here |
| --- | --- | --- |
| Logistics by Design | `tool-advantages-logistics` | Logistics and access |
| Ideal Demographics | `frameset-community-profile` | Community profile |
| Vast Resources | `gateway-community-explorer` | Community explorer |
| Marketplace Vibrancy | `frameset-market-advantages` | Market |
| Skilled Workers | `frameset-workforce-advantages` | Workforce |
| Industry Insights | `gateway-industry-insights` | Industry insights |
| Fast Growing Industries | `frame-fast-growing-industries` | Fast-growing industries |
| Diversity of Industry | `frame-largest-industries` | Largest industries |
| Talent Pipeline | `tool-advantages-talent-pipeline` | Talent pipeline |

There are nine embeds. An earlier inventory listed eight because it missed `gateway-industry-insights`.

## Visual language

The list below records the original reference. The visual redesign requested on 2026-10-25 replaces its typography, brown palette and centred headings with the atlas design recorded in [Decisions](DECISIONS.md). Tool order and data definitions still follow this document.

- Embed type: Instrument Sans. Titles 20 to 25 px at weight 650 with about −0.03 em tracking; body 12.5 to 13 px. Ink #0f1622, body #475467, muted #667085.
- Cards: white, 1 px #eaecf0 border, 14 px radius; frames 16 px radius. Selected cards: dark outline or a #f4f2f0 tint.
- Client theme (`reference/client/rmed/customStyle`): chart colours #7d622e and #473729.
- Charts are monochrome brown. Bar lists use #473729 bars on a #f2f4f7 track, with a benchmark tick and dot for the comparison area. Treemaps shade from #473729 to #f1e9e2 by value; the largest-industries treemap groups tiles by sector under sector labels. The blockConfig still names `colorField: sectorId`, but the rendered treemap is brown.
- Logistics tabs each carry their own accent: airport #4a5bd4, road #b4832b, port #12867b, rail #c0504a, broadband #9c3b84.
- Market maps use one colour ramp per filter, natural-break classes, a legend with minimum and maximum, a "Total …" card and a 123 / % toggle.
- Maps: Mapbox light basemap, dashed province outline, rounded white controls at the top right.

At 390 px the framesets become drill-in lists, industry option cards become a drop-down, and logistics shows its network list.

## Embeds

**Logistics.** Left panel (eyebrow, title, description, five network cards); map on the right.
- Airport: a card for the selected airport (name, IATA badge, international and domestic route counts), arcs to destinations, and drive-time polygons at 2, 4 and 8 hours. Route data are OAG (`reference/location/airport`, `reference/flightroutes/YWG`); drive times come from `reference/drivetime/lat,lon`.
- Road: major locations with population, highway lines and drive times.
- Sea port: ports (Churchill and Thunder Bay for Manitoba) and drive times.
- Rail: North American rail lines (HIFLD and the Canadian National Railway Network) and the selected intermodal terminal.
- Broadband: a census-subdivision choropleth of download speed (5 to 50+ Mbps).

**Community profile.** An icon rail with six dashboards on fixed grids.
- Economic: participation (LFS 14-10-0461/0464, 2011 to 2025), population (17-10-0005, bars), "median household income" (11-10-0009, which is the census-family table), household income in five bands against Canada, unemployment, total employment (LFS), establishments (Business Register, 2018 to 2026), top nine Census sectors.
- Resident: population, median individual income (11-10-0008), median age, an age-range map, and age in ten-year bands against Canada.
- Household: median income, average size, number of households, a household-income map, household type, and household size as 100 % bars.
- Dwelling: owner and renter shares, construction period, dwelling type.
- Workforce: resident industry treemap, top five occupations, four education bars on a 0 to 100 % axis (population aged 25 to 64).
- Livability: median property value, median monthly rent, mean commuting time, climate summary (Winnipeg station, normals labelled 2020), mode of transport, place of work.

**Community explorer.** Search, chips by municipal type, a list of 137 client-selected communities with logos, and a boundary map with red dots. Each community opens an external page on the client's website.

**Market.** Rail with Consumers, Dwellings and Businesses. Accordion filter cards: range sliders for ordered bins (individual income, age, household income, construction period, bedrooms) and toggle lists with All and None for categories (household type, structure type, tenure, industry). The open card alone defines the target. Data: `map-data/census-sum/ca/rmed/csd/1/ca-pr-46/<characteristics>` sums selected Census characteristics per census subdivision.

**Workforce.** Rail with Indicators (the workforce dashboard) and Catchment (education, occupation and industry maps with toggles). The catchment map did not render during this inspection; the filters did.

**Industry insights.** A banner with "Search for an industry" and "Browse all industries". Both open a full-screen application with a rail: Industry selection, Trends (employment by industry, establishments, establishment LQ, GDP by industry, average weekly earnings), Benchmarks (financial performance; it showed "No data available") and Location (businesses by size class and a census-subdivision map).

**Fast-growing and largest industries.** Left: title, description and three option cards (All, Traded, Local). Right: a chart card. Largest: Treemap, Bars or List. Fast-growing: Chart or List, with bubbles at x = employment change 2020 to 2025, y = employment 2025, area ∝ jobs, coloured Traded (dark) or Local (light). Lists show rank, industry, NAICS, five-year change, jobs and LQ. Data: `data/industryadvantagedata/rmed?locationId=ca-pr-46` gives 20 industries per set with `code, title, tradedLocal, employmentCount, employmentLq` and `employmentChange`. Source label: "Statistics Canada - Business Register"; the values are SEPH payroll employment.

**Talent pipeline.** Left: CIP primary groupings with student counts. Right: a map of institutions sized by students and a "Students in reach" card. Dataset `edgov-institution-programs` (year 2024: all programs 63,027; Humanities 10,143).

## Reference defects and undocumented definitions

| Exhibit | Observation |
| --- | --- |
| Median household income | Uses 11-10-0009, median total income of census families, under a household label. |
| Age distribution, "80 and older" | 2.0 % for Manitoba, which equals 85 and over; the Census sum of 80–84 and 85+ is 4.2 %. |
| Mean commuting time | 22.8 minutes from "Census Profile", which publishes duration bands only; the method is not stated. |
| Climate | Winnipeg normals labelled 2020 (1991–2020); the public ECCC normals service serves 1981–2010. |
| Largest and fast-growing industries | Values for NAICS 4821, 5511 and 3231 that SEPH does not publish for Manitoba, so suppressed cells are filled by an unpublished estimate. LQs are about 1.093 times the standard SEPH LQ, and four tested denominators fail to reproduce them. |
| Establishments | Neither the total nor the classified subtotal of any June or December Business Counts release reproduces the series. |
| Talent total | 63,027 labelled 2024 matches no published Manitoba total in 37-10-0011 for 2015 to 2024. |

Recorded responses and captures are kept with the project's working evidence, outside this repository.
