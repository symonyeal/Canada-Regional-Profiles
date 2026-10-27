# Canada Regional Profiles

[Open the dashboard](https://symonyeal.github.io/Canada-Regional-Profiles/)

Compare population, work, housing and industries across Canada, provinces and territories, and local Census geographies. Choose a place and a benchmark; the address bar preserves the selection and view for sharing.

The page queries public sources when a view opens. It ships no downloaded observations and holds results only in the open tab. **Refresh data**, under **Data and sources**, queries the sources again. A simplified copy of Statistics Canada's 2021 cartographic boundaries is served with the page; it contains geometry and identifiers, not observations.

## Views

| View | What it answers |
| --- | --- |
| Overview | How do population, employment, household income and tenant shelter costs compare? Canada shows employment rates across all thirteen provinces and territories. A regional view shows its benchmark differences. Recent annual population estimates open separately. |
| People and work | How do age, resident industries, occupations and qualifications differ? Industry and occupation shares include benchmark marks. Education indicators explicitly state that their categories overlap. |
| Housing and incomes | How do household income bands, composition, housing stock, costs and commuting compare? Every exhibit states its population and period. |
| Industries | Which industries are largest, adding or losing jobs, or specialized? Rankings show full names, values, changes and a separate starting base for job-change comparisons. Click an industry for employment history, earnings and other detail. |
| Compare | Compare up to three peers with the selected region, at the same geography level and Census period. Canada shows all provinces and territories. Shareable links preserve peers and the chosen chart measure. |

**Explore map** opens distribution maps and the community finder on demand. Logistics and enrolments are no longer primary sections. Old section links route to their relevant consolidated view. Each exhibit keeps a source menu, data table and CSV export.

## What the numbers are

- Overview and peer comparisons use Census 2021, with 2020 household incomes. A live request does not make these current-year observations. Differences in rates are percentage points, labelled pp.
- Recent population, income and industry time series state their own periods. Family income and household income describe different populations and retain distinct labels.
- Industry rankings use published SEPH payroll employment for Canada and provinces/territories. Municipal and metro rankings use separately labelled Business Register size-class estimates. Other levels state that industry employment is unavailable and offer the province. These measures are not combined in peer comparisons.
- Suppression and failed requests remain unavailable, never zero. Industry rankings cover published industries only; unknown history does not become zero growth.
- Job-change rankings show the largest published gains and losses over the existing five-year period. Percentage change is undefined for a zero baseline. A 2020 baseline carries a recovery warning; the industry detail shows the annual series.
- Employment specialization compares the region's industry employment share with Canada's share. National specialization directs the reader to an industry's interprovincial benchmarks. Traded/local is an optional approximate US-based classification.
- Tenant shelter costs describe tenant households, and dwelling values describe owner households. Their medians are not combined into an invented housing-cost-burden rate.
- Optional maps sum bins from one active distribution. Age, income and other filters are not combined into unpublished joint counts.

The earlier reference was Advance Rural Manitoba's [Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/). The owner approved the five-view regional brief on 26 October 2026; reference composition and visual identity are no longer acceptance requirements. Historical reference comparisons remain documented separately.

Details: [reference](docs/REFERENCE.md), [coverage](docs/COVERAGE.md), [sources](docs/SOURCES.md), [decisions](docs/DECISIONS.md), [validation](docs/VALIDATION.md).

## Run locally

Serve `site/` with any static server, for example with Python:

```text
python -m http.server 8765 --directory site
```

Open http://localhost:8765/. The page needs internet access to the public sources, the basemap and the map library CDN.

Checks (Node 22 or later):

```text
node --test tests/*.test.js
cargo test --release --manifest-path tools/boundaries/Cargo.toml
npm install
node tests/browser/workflows.mjs http://localhost:8765/ <evidence-folder>/workflows.json
node tests/browser/sweep.mjs http://localhost:8765/ <evidence-folder>/sweep.json
```

The browser checks use `playwright-core` with an installed Chromium-based browser; set `BROWSER` to its path if it is not Edge at the default Windows location.

GitHub Actions publishes `site/` to GitHub Pages on changes to main.

## Boundary files

`site/boundaries/` holds census subdivisions and divisions per province or territory, provinces for Canada, and economic regions, metropolitan-area parts and population-centre parts per province, as quantized TopoJSON (7.2 MB compressed in all; each Nunavut file up to 0.8 MB, every other file 0.41 MB or less). `tools/boundaries` builds them (Rust, cargo):

```text
cargo run --release --manifest-path tools/boundaries/Cargo.toml -- <cache-dir> site/boundaries
```

It pages through the 2021 cartographic boundary service into `<cache-dir>` (resumable; about 150 MB), joins neighbouring subdivisions into shared arcs, forms divisions and provinces as their unions, removes islands and holes under 0.5 km² (25 km² on the Canada map) and simplifies each arc once (Visvalingam–Whyatt), so neighbours keep identical borders. It stops if a division or province differs in area from the sum of its subdivisions by more than 1 %. From a full cache it runs in about 80 s.

## Historical analysis

`analysis/` is an earlier offline Python build kept for its comparison records. The website does not use it. Its unit checks run with `python -m pytest -q -m "not slow"`; the slow checks need a download collection that is not part of this repository.
