# Canada Regional Profiles

[Open the dashboard](https://symonyeal.github.io/Canada-Regional-Profiles/)

## Problem

- Compare Canadian provinces, territories, municipalities, census divisions, metropolitan areas, economic regions and population centres.
- Rank places among comparable areas, decompose payroll job change, and identify similar places and neighbours.
- The address bar stores the selection and view in a shareable URL.
- Began as a rebuild of Advance Rural Manitoba's [Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/); reference comparisons are documented separately.

## Data handling

- The page queries Statistics Canada and the OECD when a view opens. It ships no downloaded observations and holds results only in the open tab. **Refresh data**, under **Data and sources**, queries the sources again.
- Two kinds of geometry are served with the page: a simplified copy of the 2021 cartographic boundaries, and each area's list of bordering areas derived from it. Neither contains observations.
- Suppression and failed requests remain unavailable, never zero.
- Cards load independently, so a slow source leaves other measures visible. Boundaries remain visible when the basemap is unavailable.

## Views

| View | Content |
| --- | --- |
| Findings | Latest annual measures ranked among comparable areas for the same year, with the benchmark and change over the preceding five years. Census 2021 findings (population, work, income, housing, people, commuting) give value, cohort rank, benchmark and cohort distribution. The Canada view ranks provinces and territories on the largest differences. Annual charts compare a selected period with the benchmark and cohort. Resident-sector shares. |
| Economy | Payroll job changes from a chosen base year (2019 by default) to the latest year, split into national growth, sector mix and regional shift, for provinces and territories. Resident-sector shares against the benchmark at all geography levels. Detailed industries by specialization, size or change. |
| Compare | The place against its five most similar areas, its neighbours (municipalities and census divisions) or up to three reader-selected peers of the same level. Annual comparisons use years published for every area shown. |
| Detail | Residents, work and education, households, housing stock, costs and commuting against the benchmark. |

- **Explore map** opens distribution maps and the community finder on demand. Each exhibit has a source menu, data table and CSV export.
- Each latest-year finding has a line chart of up to fifteen recent years with its own labelled axis and source.
- **Across comparable areas** shows two selectable Census rankings with named regions, values and benchmark marks. Large cohorts show the six highest, six lowest and selected area; the source menu keeps the complete ranking.
- **Benchmark**: Canada, the selected area's province or territory, any named province or territory, or another region of the same geography type anywhere in Canada. **Another region…** searches census divisions/counties, municipalities, metropolitan areas, economic regions or population centres at the selected area's level.
- The benchmark carries through profile findings, annual comparisons, regional ranking marks, resident-sector comparisons and Detail, and is kept in shared links and browser history. Payroll shift-share and detailed-industry employment LQ keep their labelled Canada reference.

## Methods

- Findings open with the latest published year of each annual measure; the place, its benchmark and its cohort are compared in that year, and change runs from the first published year in the five before it.
- Census findings, comparisons and sector shares use Census 2021, with 2020 incomes. The Census Profile service publishes only the 2021 cycle, so Census measures have one year; a live request does not make them current. Rate differences are percentage points (pp).
- **Over time** uses annual Statistics Canada tables, each read over every year it publishes:
  - population, median age and share aged 65 and over: July 1 population estimates (2021 boundaries; municipalities: population only);
  - immigrants per 1,000 residents: components of population change;
  - employment and unemployment rates: Labour Force Survey (provinces, territories where published, economic regions, metropolitan areas);
  - median census family income and low-income rate (CFLIM-AT): tax data (provinces, metropolitan areas and agglomerations);
  - two-bedroom average rent: CMHC rental market survey;
  - OECD Regional Statistics API: real GDP and real household disposable income per person, life expectancy, homicides per 100,000 (provinces and territories, compiled by the OECD from Statistics Canada data), mean air temperature (provinces and census divisions, ERA5 reanalysis).
- These are separate surveys with their own definitions and are labelled as such. The selectable range is the set of years in which every area shown publishes a value; an area that publishes none is listed and left out rather than emptying the range.
- Change: counts and dollars in per cent with a compound annual rate, rates in percentage points, temperature as the least-squares trend per decade. Tax-filer and CMHC dollars are current; OECD dollars are constant 2020 prices.
- **Cohort**: the set a place is ranked in. Municipalities (census subdivisions) with at least 1,000 residents, or census divisions, within the province; all metropolitan areas and agglomerations, economic regions or population centres in Canada; the thirteen provinces and territories for a province, territory or Canada. Ranks count areas with a published value; 1 is the highest.
- Distinctiveness: how far a finding's rank lies from the cohort's middle. The headline shows the most distinctive measure of each theme. For Canada it shows the measures with the largest spread across provinces and territories (coefficient of variation).
- **Most similar** areas: nearest in the cohort on nine standardised measures: population and median household income (logarithms), population growth, median age, employment rate, renter share, bachelor's degree share, immigrant share, Indigenous identity share.
- **Neighbours** share a border of positive length; neighbours across a provincial border are not listed.
- **Payroll job change** (provinces and territories): SEPH 14-10-0202 annual averages for 20 NAICS sectors in a chosen base and end year, by default 2019 and the latest. Shift-share (Dunn 1960) splits each sector's change into national growth, sector mix and regional shift; changes of suppressed sectors are reported as unattributed, never as zero. SEPH covers forestry and logging, not agriculture.
- **Resident sectors** count the Census labour force by place of residence, not jobs located in the area. LQ is the sector's share over the benchmark's share. The mix difference D = ½ Σ |s − S| is the share of workers who would have to change sector to match the benchmark.
- Detailed industries: SEPH payroll employment for Canada, provinces and territories; Business Register size-class estimates, labelled as estimates, for metropolitan areas and municipalities. Other levels say that industry employment is not published and offer the province.
- Tenant shelter costs describe tenant households; dwelling values describe owner households.

## Execution

- Serve `site/` with any static server, then open http://localhost:8772/. The page needs internet access to the public sources, the basemap and the map library CDN.

```text
python -m http.server 8772 --directory site
```

- Checks need Node 22 or later. `tests/fixtures/record.mjs` re-records the responses the golden tests replay; `sweep.mjs` exits non-zero on a page error, a failed card or a card still loading.

```text
node --test tests/*.test.js   # includes the golden tests on the recorded responses in tests/fixtures
cargo test --release --manifest-path tools/boundaries/Cargo.toml
cargo fmt --check --manifest-path tools/boundaries/Cargo.toml
cargo clippy --release --all-targets --manifest-path tools/boundaries/Cargo.toml -- -D warnings
npm install
node tests/browser/workflows.mjs http://localhost:8772/ <evidence-folder>/workflows.json
node tests/browser/visuals.mjs http://localhost:8772/ <evidence-folder>/visuals.json
node tests/browser/sweep.mjs http://localhost:8772/ <evidence-folder>/sweep.json
node tests/browser/regressions.mjs http://localhost:8772/ <evidence-folder>/regressions.json
```

- The browser checks use `playwright-core` with an installed Chromium-based browser; set `BROWSER` to its path if it is not Edge at the default Windows location.
- GitHub Actions publishes `site/` to GitHub Pages on changes to main.

## Boundary files

- `site/boundaries/` holds census subdivisions and divisions per province or territory, provinces for Canada, and economic regions, metropolitan-area parts and population-centre parts per province, as quantized TopoJSON (7.2 MB compressed in all; each Nunavut file up to 0.8 MB, every other file 0.41 MB or less).
- `tools/boundaries` builds them (Rust, cargo):

```text
cargo run --release --manifest-path tools/boundaries/Cargo.toml -- <cache-dir> site/boundaries
```

- It pages through the 2021 cartographic boundary service into `<cache-dir>` (resumable; about 150 MB), joins neighbouring subdivisions into shared arcs, forms divisions and provinces as their unions, removes islands and holes under 0.5 km² (25 km² on the Canada map) and simplifies each arc once (Visvalingam–Whyatt), so neighbours keep identical borders.
- It stops if a division or province differs in area from the sum of its subdivisions by more than 1 %. From a full cache it runs in about 80 s.
- `neighbours-<pr>.json` lists, for each subdivision and division, the areas that share an arc with it in the committed files. Rebuild it after the boundary files:

```text
cargo run --release --manifest-path tools/boundaries/Cargo.toml --bin neighbours -- site/boundaries
```

## Further documents

[Reference](docs/REFERENCE.md), [coverage](docs/COVERAGE.md), [sources](docs/SOURCES.md), [decisions](docs/DECISIONS.md), [validation](docs/VALIDATION.md).
