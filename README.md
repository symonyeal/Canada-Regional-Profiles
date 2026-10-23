# Canada Regional Profiles

[Open the dashboard](https://symonyeal.github.io/Canada-Regional-Profiles/)

Logistics, demographics, markets, workforce, industries and postsecondary enrolments for Canada, each province and territory, and local Census geographies. Choose a place once; every tool on the page follows it, and the address bar keeps the selection and views for sharing.

The page asks public services for its data when it is opened. It ships no downloaded observations, needs no account or server, and holds results only in the open tab; **Refresh data** asks the sources again.

## Tools

| Tool | What it shows |
| --- | --- |
| Logistics and access | Airports with passenger traffic, the National Highway System, ports, railways and high-speed internet coverage, with 30- and 60-minute drive-time areas |
| Community profile | Economic, resident, household, dwelling, workforce and livability dashboards, compared with Canada or the province |
| Community explorer | Search and filter census subdivisions by name and municipal type, see them on the map and open their profiles |
| Market | Consumers, dwellings and businesses in chosen Census groups or industries, mapped by census subdivision, as counts or shares |
| Workforce | Resident industries, occupations and education, and catchment maps of chosen groups |
| Industry insights | For any industry: employment trend, business counts, specialization, output and earnings, and where its businesses are |
| Fast-growing industries | Industries adding the most payroll jobs over five years, as a bubble chart or list, for all, traded or local industries |
| Largest industries | Industries with the most payroll jobs, as a treemap grouped by sector, bars or list |
| Talent pipeline | Postsecondary enrolments by field of study and institution |

Every chart has a menu with its data table, a CSV download, and its source, geography, reference period and population.

## What the numbers are

- Census exhibits use the 2021 Census and 2020 incomes. Time series show their own published years.
- Payroll industries use the Survey of Employment, Payrolls and Hours (table 14-10-0202) for Canada and provinces. Suppressed industries stay missing and are counted under the exhibit. Metropolitan areas and municipalities show Business Register employee estimates, labelled as estimates. Other levels say that no industry source is published.
- Traded and local industries follow a mapped US cluster classification and are approximate.
- Enrolments describe institutions and provinces, not the residents of a municipality. Institution figures are whole-institution counts.
- Maps of facilities use Transport Canada, Natural Resources Canada, OpenStreetMap and Wikidata. These are not complete inventories, and each map says what it shows.
- The page is modelled on Advance Rural Manitoba's [Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/). Scheduled flight routes, drive times beyond an hour and household broadband shares are not public, so the page shows passengers, one-hour drive times and coverage areas instead.

Details: [reference](docs/REFERENCE.md), [coverage and comparison](docs/COVERAGE.md), [sources](docs/SOURCES.md), [decisions](docs/DECISIONS.md), [validation](docs/VALIDATION.md).

## Run locally

Serve `site/` with any static server, for example with Python:

```text
python -m http.server 8765 --directory site
```

Open http://localhost:8765/. The page needs internet access to the public sources, the basemap and the map library CDN.

Checks (Node 22 or later):

```text
node --test tests/*.test.js
npm install
node tests/browser/workflows.mjs http://localhost:8765/ workflows.json
node tests/browser/sweep.mjs http://localhost:8765/ sweep.json
```

The browser checks use `playwright-core` with an installed Chromium-based browser; set `BROWSER` to its path if it is not Edge at the default Windows location.

GitHub Actions publishes `site/` to GitHub Pages on changes to main.

## Historical analysis

`analysis/` is an earlier offline Python build kept for its comparison records. The website does not use it. Its unit checks run with `python -m pytest -q -m "not slow"`; the slow checks need a download collection that is not part of this repository.
