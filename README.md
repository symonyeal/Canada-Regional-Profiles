# Canada Regional Profiles

[Open the dashboard](https://symonyeal.github.io/Canada-Regional-Profiles/)

Explore Canadian communities, industries, workforce, housing, incomes, transport and education. Choose Canada, a province or territory, or a local Census geography. The selection carries across the profile tools and into a shareable URL.

The site queries public APIs when opened. It does not ship downloaded observations or prebuilt province data files. Requests are cached in this browser tab's memory; **Refresh** queries them again. No API key, account, server or scheduled dataset build is required.

## What is available

| Tool | Views and controls |
| --- | --- |
| Community profile | Population, age pyramid, housing, household size, tenure, languages, immigration and Indigenous identity; quarterly population estimates for Canada and provinces/territories |
| Logistics and access | Official boundaries, live road basemap, mapped airports, rail stations, harbours and postsecondary facilities; official broadband map link |
| Community explorer | Search and compare municipalities, census divisions, metro/agglomeration areas, economic regions and population centres; population filters and local profile links |
| Market | Household income distributions, housing costs, suitability, condition, construction periods, mobility and citizenship |
| Workforce | Labour rates, NOC occupations, NAICS sectors, education and commuting; Census gender filters and recent Labour Force Survey trends |
| Industry insights | Location quotients, specialization/growth bubbles and industry treemap |
| Fast-growing industries | Matched five-year Business Register comparisons, absolute/percentage change and minimum-base filter |
| Largest industries | Employer locations and estimated employees; NAICS detail, traded/local filters and estimate bounds |
| Talent pipeline | Institutional enrolments by field and period; institution type, institution, student status, registration and gender filters; local resident qualifications separately |
| All characteristics | Search the full published Census Profile, read source notes and export selected characteristics |

Charts include data tables and CSV exports. The data-and-coverage page names each public source and records requests made during the browser session.

## Scope and differences from the reference

The starting point is [Advance Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/), whose page embeds nine Localintel tools. This project provides independently implemented public-data counterparts. Exact chart parity is **unverified**: the reference's embedded tools returned HTTP 406 and browser navigation errors during inspection on 2026-10-22.

- Census profiles use 2021 boundaries and observations. Census income is for 2020. A live request does not make those observations current-year estimates.
- Business Register employee counts are estimates from size classes. Midpoints are used, with 500 for the open 500+ class. That class has no finite upper bound. These are not payroll job counts.
- The Business Register API omits many zero series. A missing cell becomes zero only when a published row total or size-class subtotal establishes it. Unresolved missing cells remain missing.
- Business Counts publishes Canada/provinces and selected metro/municipality geographies. Unsupported local levels show a labelled Census resident-labour-force sector view; provincial data are never relabelled as municipal data.
- Traded/local follows the draft's mapped Delgado, Porter and Stern classification. The NAICS rule lists are configuration, not downloaded observations. Localintel's own classification is not reproduced.
- Growth compares the latest Business Counts release found in the live catalogue with the same month five years earlier. Recoded or suppressed industries may have no comparison. The draft's minimum baseline of 20 estimated employees remains the default.
- PSIS describes the institution or provincial school population. A municipal selection does not turn a provincial enrolment total into a municipal one. Enrolments are registrations, not graduates or unique people.
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
