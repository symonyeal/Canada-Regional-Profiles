# Canada Regional Profiles

[Open the dashboard](https://symonyeal.github.io/Canada-Regional-Profiles/)

Explore Canadian communities, industries, workforce, housing, incomes, transport and education. Choose Canada, a province or territory, or a local Census geography. The selection carries across the profile tools and into a shareable URL.

The site queries public APIs when opened. It does not ship downloaded observations or prebuilt province data files. Requests are cached in this browser tab's memory; **Refresh** queries them again. No API key, account, server or scheduled dataset build is required.

## What is available

| Tool | Views and controls |
| --- | --- |
| Community profile | Economic, resident, household, dwelling, workforce and livability dashboards; annual trends, education donuts, sector treemaps, climate stations and additional demographic charts |
| Logistics and access | Official boundaries, live road/rail basemaps, airports, harbours and postsecondary facilities; live airport passenger-sector counts; official broadband map link |
| Community explorer | Search and compare municipalities, census divisions, metro/agglomeration areas, economic regions and population centres; municipal-type and population filters |
| Market | Consumer, dwelling and business choropleths with selectable Census/Business Register bins, counts or shares, and up to six natural-break classes; additional income/housing profiles |
| Workforce | Education donuts, resident-industry treemap, top occupations, filtered catchment maps and additional labour/commuting indicators; Census gender filters and recent Labour Force Survey trends |
| Industry insights | Location quotients, specialization/growth bubbles and industry treemap |
| Fast-growing industries | SEPH employment/growth bubbles; optional Business Register comparisons, absolute/percentage change and minimum-base filter |
| Largest industries | Published SEPH employment by default, with sector treemap and list; separate Business Register counts/estimates; NAICS and traded/local filters |
| Talent pipeline | CIP primary grouping and detailed-field enrolments, trends and mapped facilities; institution, student, registration, gender and program filters |
| All characteristics | Search the full published Census Profile, read source notes and export selected characteristics |

Charts include data tables and CSV exports. The data-and-coverage page names each public source and records requests made during the browser session.

## Scope and differences from the reference

The starting point is [Advance Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/). Recovered chart definitions and recorded reference responses are in [REFERENCE.md](docs/REFERENCE.md). The live client uses those definitions; Manitoba checks matched the largest-industry top-20 codes/counts, education counts, resident-industry counts, annual participation and family-income series. Full visual/data parity across every geography is not established.

- Census profiles use 2021 boundaries and observations. Census income is for 2020. A live request does not make those observations current-year estimates.
- Published industry employment defaults to SEPH 14-10-0202, the source recovered from the reference. Its latest annual period is compared with five years earlier. SEPH suppresses many industries, particularly in territories, and does not publish municipal results in this table.
- Business Register employee counts are a separate selectable estimate from size classes. Midpoints are used, with 500 for the open 500+ class. That class has no finite upper bound. These are not payroll job counts.
- The Business Register API omits many zero series. A missing cell becomes zero only when a published row total or size-class subtotal establishes it. Unresolved missing cells remain missing.
- Business Counts publishes Canada/provinces and selected metro/municipality geographies. Unsupported local levels show a labelled Census resident-labour-force sector view; provincial data are never relabelled as municipal data.
- Traded/local follows the draft's mapped Delgado, Porter and Stern classification. The NAICS rule lists are configuration, not downloaded observations. Localintel's own classification is not reproduced.
- Business Register growth compares the latest Business Counts release found in the live catalogue with the same month five years earlier. Recoded or suppressed industries may have no comparison. The draft's minimum baseline of 20 estimated employees remains the default.
- Climate normals use the period in the live ECCC collection metadata (1981-2010 when inspected), at the explicitly selected station. They are not a province-wide climate average.
- PSIS describes the institution or provincial school population. A municipal selection does not turn a provincial enrolment total into a municipal one. Enrolments are registrations, not graduates or unique people.
- Institution markers use live OSM facilities. Enrolments attach only to exact institution-name matches; they are whole-institution counts, never a fabricated campus allocation.
- OSM features are incomplete, and map queries are capped at 500 results within the viewport. They are not regional facility inventories. OAG flight schedules and frequencies are proprietary and are not reproduced.
- Broadband links to the official ISED map. A live household coverage aggregate is not connected. The ISED map was blocked by this machine's network during verification.

See [sources](docs/SOURCES.md), [decisions](docs/DECISIONS.md), [coverage](docs/COVERAGE.md) and [validation](docs/VALIDATION.md).

## Run locally

Use Node 22+ for the dependency-free JavaScript tests. Serve the site with the system Python:

```text
python -m http.server 8765 --directory site
node --test tests/*.test.js
```

Open http://localhost:8765/. The application needs internet access to Statistics Canada, OpenStreetMap, the map service and the chart/map library CDNs. Source outages produce retry states and never trigger a static-data fallback.

GitHub Actions publishes `site/` directly to GitHub Pages on changes to main.

## Historical analysis

`analysis/` retains the original offline Python model for reference and numerical comparison. It is not used by the website or its deployment. Running `analysis/fetch.py` explicitly downloads large source files, and `analysis/build_site.py` explicitly rebuilds the former static outputs; neither belongs to the live workflow.

For its existing unit checks:

```text
python -m pip install -r requirements.txt
python -m pytest -q -m "not slow"
python -m ruff check .
python -m pip check
```

The slow historical build checks require the former downloaded input collection. They do not verify the live site.
