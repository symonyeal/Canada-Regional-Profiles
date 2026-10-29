# Decisions

## 2026-10-29: shared request and missing-data rules

- Request policy lives in `transport.js`; source adapters remain in `api.js`. Errors, retries and request limits
  retain their existing defaults. All refreshable promise caches use the same helper, which evicts a failure only
  if it is still the cached promise. Text and JSON responses have separate cache identities.
- Business Counts industry reads and map-cell rules live in `tools/business.js`; resident-sector exhibits live
  in `tools/sectors.js`. The views consume shared definitions instead of owning separate cache policies.
- Empty or nonnumeric WDS observations remain missing after scaling. A missing business-industry count becomes
  zero only if the published classified total is zero. Specialization ratios need published totals or complete
  partitions; filtering suppressed industries cannot establish a denominator.
- Annual charts use a complete calendar axis inside the selected range. Omitted years remain gaps, and the
  data table retains them. A series with a nonpositive base cannot be indexed; its published values remain in
  the table. Temperature-change ranks require both range endpoints and at least three finite years, matching
  the stated same-period cohort rule.

## 2026-10-27: configurable regional benchmarks

The owner identified province-to-province and county-to-county configurability as vital before publication.

- The main benchmark control includes every province and territory, plus a searchable same-level choice for local and regional geographies across Canada. Geography type is visible in the main search controls. Census divisions include counties and other regional structures; the label says both.
- A benchmark's official geography identifier is stored in the existing `bench` URL parameter. Reload and browser history restore its name and value. A geography change preserves a compatible benchmark and resets a self-comparison or incompatible level to Canada. The existing parent-province mode continues to follow the selected area.
- Findings, annual comparisons, Census ranking marks, resident-sector comparisons and Detail use the chosen benchmark. Population findings also show another same-level area's count; a count against Canada's total remains omitted. Compare marks an existing peer as the benchmark instead of adding it twice.
- Cohort ranks retain their stated populations. Choosing a county in another province as the benchmark does not relabel the selected county's provincial cohort. Payroll shift-share and detailed employment LQ retain their stated Canada reference.

## 2026-10-27: visible maps and charts beside the findings

The owner reported a blank map and missing visualizations, and requested broader visual evidence alongside the insights.

- The map library's stylesheet is loaded after the site's CSS. Its positioning rule collapsed the map viewport to zero height; the site's viewport rule now has higher specificity. The regression check measures the viewport and canvas, rather than accepting the presence of a map element as evidence of rendering.
- Basemap requests have one ten-second attempt. Failure leaves the Census boundaries usable, with a visible notice. Reopening retries a failed style request. Closing a map invalidates pending community work before disposing it.
- Annual findings draw independently. Each has a history of up to fifteen recent years with a labelled axis, visible source, data table and CSV for the plotted years. The Over time panel retains its full history and benchmark comparison.
- Two selectable Census rankings show regional names and exact values. All published regions appear for cohorts of fifteen or fewer; larger cohorts show the six highest, six lowest and selected area, with the complete ranking in the data table and CSV. Missing profiles stay unavailable.
- On narrow screens the distribution map precedes the filter list. Clicking a province on Canada's distribution map opens a provincial profile; subdivision maps open municipal profiles.

## 2026-10-27: latest year first

The owner reported that the site "still only shows 2021 in the front": the annual series sat below the Census findings, in a panel showing one measure at a time.

- **Findings open with the latest published year.** One card per annual measure published at the area's level (twelve for a province, one for a municipality), in catalogue order rather than by distinctiveness, since every card is current. Temperature is left to the Over time panel: one year's mean measures weather.
- **Comparisons are same-period.** The year is the last one the selected area publishes; the benchmark and the cohort are read in that year, and an area without it is left out of the rank, which then says "publishing it". Change runs from the first published year in the five before.
- **One read per measure** covers the area, its benchmark and its cohort, so cohorts do not wait for the Census profiles (the cohort's area list is now separate from its profiles). A failing source names its measures and leaves the others drawn.
- Population cards carry no benchmark difference or benchmark tick: a count against Canada's is not a comparison.

## 2026-10-26: years beyond Census 2021

The owner asked why only 2021 data was shown and asked for the longest history common to the places compared, shown as a selectable range, including sources outside Statistics Canada.

- **Census measures stay single-year.** The Census Profile SDMX service publishes only the 2021 cycle (14 dataflows, all 2021), and earlier profiles use other boundaries. Findings and Compare keep their Census cross-sections and say so.
- **Annual measures come from tables that publish every year.** Population, median age and the share aged 65 and over (July 1 estimates), immigrants per 1,000 residents (components of change), employment and unemployment rates (Labour Force Survey), median census family income and the CFLIM-AT low-income rate (tax data), and two-bedroom rent (CMHC). Each table is read over all its published years, found from its metadata, instead of the earlier fixed 12, 15 or 16 periods. Sub-provincial population and components tables are on 2021 boundaries, the same as the Census geography; the economic-region estimates moved from the inactive 2016-boundary table 17-10-0137, which ends in 2022, to 17-10-0150.
- **The OECD adds measures Statistics Canada does not publish annually by region in one place.** Real GDP and real disposable income per person, life expectancy and homicides (provinces and territories) and mean air temperature (provinces and census divisions). OECD region codes are the Census codes behind a CA prefix, so no lookup table is needed. The OECD compiles the Canadian economic and demographic figures from Statistics Canada data; the temperature series is ERA5. ECCC's homogenized station climate data (GeoMet) and IRCC's open data were inspected and not used: stations are points, not areas, and IRCC files start in 2015 while the components tables cover immigration from 2001 at more levels.
- **The range is the intersection of published years.** For the areas shown (the place and its benchmark in Findings; the place, its comparison set and the benchmark in Compare), the years in which every area has a finite value. An area that publishes nothing for a measure is named and left out instead of emptying the range; suppression and gaps are never zero. Cohort ranks use the cohort's areas with both ends of the range published and state how many that is.
- **Change matches the measure.** Counts and dollars change in per cent with a compound annual rate; rates in percentage points; temperature as the least-squares trend per decade over every year in the range, because single years differ by a degree or more and an endpoint comparison would mostly measure weather.
- **Charts index counts to the range's first year** when areas of different size share an axis; the table keeps the published values. Other areas in a comparison are grey context lines, the selected area green and the benchmark copper.
- **Payroll shift-share takes any base and end year** with published totals for the area and Canada (2001–2025), defaulting to 2019 and the latest year.
- Measure and range are shared in the address (`tm`, `yr`, `py`); a range snaps to the nearest common years when the selection changes.

## 2026-10-26: findings instead of inventories

The owner asked to simplify the site and give concrete insight; logistics and similar inventories did not explain a place. A list of airports, roads or enrolments, or a table of values beside a benchmark, leaves the reader to judge whether a difference matters. Each view now answers a question with a ranked, sourced statement.

- **Findings rank a place within its cohort.** A value is distinctive when its rank lies far from the cohort's middle, |F(x) − ½| with F the mid-distribution function. One finding per theme keeps the headline balanced (six themes, 20 Census measures); the full table holds every measure with its rank. Cohorts are same-level areas: a province's municipalities with at least 1,000 residents (counts below that are dominated by Census random rounding to multiples of five) or its census divisions; all metropolitan areas and agglomerations, economic regions or population centres; the thirteen provinces and territories. The selected area joins its cohort when outside it. Cohort profiles are requested 120 areas at a time with the 30 characteristics the measures use: Quebec's 661 municipalities take six requests; on 2026-10-26 one request of 120 areas took 3.4 to 5.8 s and six parallel requests of 60 took 8.0 s. The benchmark comparison draws first and ranks fill in.
- **Canada has no cohort of its own.** Its findings name the provinces and territories at each end of the measures on which they differ most (coefficient of variation).
- **Payroll change is decomposed.** Shift-share on SEPH sectors since 2019 states how much of a province's change follows national growth, its sector mix, or performance beyond the same sectors nationally. 2019 precedes the pandemic; the five-year window of the detailed ranking starts in 2020, a trough. The 20 sectors partition the aggregate excluding unclassified businesses [11-91N]; WDS batch responses are joined by coordinate, not order.
- **Resident sectors give every level an economic profile.** SEPH stops at provinces, and Business Register estimates exist only for municipalities and metropolitan areas; the Census labour force by sector exists everywhere. It counts residents, not local jobs, and says so.
- **Peers are found, not only chosen.** Most similar areas are nearest in standardised measures within the cohort; neighbours come from the boundary topology. Chosen peers remain.
- **Rust where it pays: adjacency.** `tools/boundaries` gained a `neighbours` binary that derives rook adjacency from the shared arcs of the committed TopoJSON (an arc used by two areas is a common border of positive length) and writes 13 small files (2 to 158 KB). The page then lists neighbours without loading geometry. Runtime arithmetic (ranks over at most 1,026 areas, nearest neighbours over 9 measures) stays in JavaScript: its cost is microseconds against seconds of network time, as measured on 2026-10-25.
- **Removed.** The logistics and talent modules (unreachable since the five-view brief), their adapters (air traffic, enrolments, geo.ca services, Valhalla, Wikidata), the economic dashboard, embedded profile maps, climate normals, the treemap, bubble and climate charts, unused icons and the style rules of 49 classes no file references. People and Housing merge into Detail; old links route to the view that holds them.

## 2026-10-25: atlas design

The owner requested a complete visual upgrade. The interface now uses ivory backgrounds, forest green marks, copper comparisons, DM Serif Display headings and DM Sans controls and data labels. Numbered, left-aligned section headings and a separate geography panel establish a consistent hierarchy across the nine tools. Selected options use borders and labels as well as colour.

Chart colours are declared in `site/js/palette.js`; CSS holds the matching interface tokens. Maps share a sequential green scale; benchmark marks use copper. Treemap and stacked-bar text chooses black or white from the fill's relative luminance, with a threshold of 0.179. The masthead outline is derived from the committed 2021 provincial boundaries in a Lambert azimuthal equal-area projection centred on Canada; it contains no observations. The existing SVG charts, MapLibre maps, public data adapters, tables and CSV exports remain in use.

This design intentionally departs from the reference's typography, brown palette and centred uppercase headings. The reference remains the record of the original tool behaviour and data definitions.

## 2026-10-25: speed and reliability pass

A profiler recorded each section's time to settle, its requests, bytes and failures, for Manitoba, Quebec and Montréal. Computation was not the cost: natural breaks over 1,282 subdivisions took 12 ms, decoding the subdivision list 21 ms and parsing the 5 MB table catalogue 9 ms, so no client code moved to Rust or WebAssembly. A V8 profile on 2026-10-25 confirmed it: with every tool mounted, site modules used 0.3 to 0.5 s of a 35 s load, against 1.3 to 2.7 s of map rendering, and the largest site cost is the browser's own JSON parser. A WebAssembly kernel would have to copy its results back into JavaScript objects. Rust stays where it pays: the offline boundary builder. Time went to the network: boundary requests refused by the server, Statistics Canada connections that hung for 20 to 35 s, 33 Census requests for one Quebec map, and an Overpass query that waited 90 s and then failed.

- **Boundaries are served with the page.** The boundary service fails about half of its connections, without CORS headers, and its full-resolution Arctic subdivisions are too large to serve. `tools/boundaries` (Rust) pages through it once, snaps geometry to its 1e-4° grid, builds shared arcs, dissolves divisions and provinces from subdivisions, and writes simplified TopoJSON to `site/boundaries/` (7.2 MB compressed for every level and province). The 2021 vintage is fixed, so the files are committed rather than built on deploy. They hold geometry, DGUIDs and names only; every observation is still requested at runtime. The owner approved this exception on 2026-10-24.
- **Dissolve counts net arc use.** A division is the union of its subdivisions: arcs used in both directions cancel. Counting uses instead of net direction lost Manitoba's outline, because grid snapping lays thin subdivisions onto a neighbour's border. The builder now stops when a union's area differs from the sum of its parts by more than 1 %; all differ by less than 0.001 %.
- **Statistics Canada reads are hedged.** A request with no answer after 6 s is sent again and the first answer kept (Dean and Barroso 2013). Retries wait a random 0.4–0.8, 0.8–1.6 and 1.6–3.2 s, up to four attempts. Cancelled copies appear as aborted requests in browser tools; they are not failures.
- **Census maps ask for 120 areas per request.** A request costs about 2 s plus 6 ms per area (40 areas 2.3 s, 120 areas 2.5 s, 240 areas 3.8 s; 2026-10-24), so 120 areas cut Quebec's 33 requests to 11 with URLs near 2 kB.
- **Institution locations come from Wikidata.** Overpass refused connections on its main server and returned HTTP 504 after 268 s on a mirror. Wikidata answers the same question (items in subclasses of higher education institution, in Canada, with coordinates, not dissolved) in under 15 s uncached; names match on the label or any English or French alias.
- **Climate normals are requested per series.** A station publishes up to about 1,400 normals; the earlier single request of 500 rows could omit precipitation or temperatures, which left the chart empty for Winnipeg.
- **Dashboards grow instead of clipping.** Grid rows take at least their content's height and the frame keeps the reference's 765 px as a minimum. The fixed rows had hidden the last bars of place of work and clipped the economic KPI cards.
- **Basemap labels use Latin script.** The basemap style adds a second line of non-Latin names, which made each map fetch about 1 MB of extra glyph ranges.
- Bubble charts label the six right-most industries where a label fits; the tooltip and list still name every point.

## 2026-10-22: rebuild the client on the reference's composition

The previous live client used a generic layout: a large title band, a sidebar of routes, Plotly charts with toolbars, a rainbow sector treemap and one tool per page. None of its exhibits followed the reference's composition, and its market and talent maps failed on the deployed site because boundary requests were refused. The client was rewritten rather than patched. The verified adapters (SDMX decoding, WDS coordinates, sparse-count reconciliation, natural breaks, midpoint estimates) and their tests were kept.

- One page in the reference's section order. Each tool mounts when it nears the viewport, as the reference's iframes load.
- Charts are SVG and HTML drawn at their measured size and redrawn on resize. They follow the reference's geometry: bar lists with benchmark ticks, KPI sparklines, grouped columns, 100 % stacked bars, squarified treemaps, a bubble chart with drag-to-zoom. Every chart has a menu with a data table, a CSV export and its source, geography, period and universe.
- Maps use MapLibre with the OpenFreeMap basemap, recoloured toward the reference's light map. Every overlay host was checked for cross-origin access from the Pages origin.
- Instrument Sans and the reference's greys, radii and browns; Montserrat for section headings. The project keeps its own name and attribution. No reference branding, logos or photographs are used.
- At 820 px and below, rails become horizontal tabs and option cards become a drop-down. Tabs keep the exhibit one tap away; the reference's mobile embeds use drill-in lists instead.

## Geography and state

Census DGUIDs select profiles; WDS classification codes match tables; display names never join. Census agglomerations use schema S0504 and cross-border parts S0505/S0506, which the earlier client rejected. The boundary layers key metropolitan areas and population centres by provincial part, so whole areas are selected by `CMAUID` or `PCUID`.

The URL holds the geography, the comparison area and every view choice; defaults are omitted. A geography change adds a history entry. View and filter changes replace the current entry, so Back returns to the previous place rather than stepping through every filter. A new geography keeps view choices but clears facility and area selections that belonged to the old one. Malformed parameters fall back to defaults.

Each tool keeps a generation counter; work started for an older selection never draws. Each card loads on its own. A failed benchmark removes only the comparison marks; a failed boundary request leaves the card, legend and table; a failed Census request does not stop payroll, logistics or talent exhibits. Retry asks the source again; a combination a source does not publish is shown as such, without Retry.

## Requests

Transient failures (network, timeout, HTTP 5xx, 429) are retried a bounded number of times; unsupported and malformed responses are not. Failed requests are evicted from the in-memory cache, and Refresh clears it. Requests are limited per host (one at a time for Valhalla).

The StatCan boundary server returns HTTP 500 without CORS headers for about half of new connections and for any explicit field list; a browser reports both as a network failure. Until 2026-10-25 the page queried it with four parallel copies per retry; boundaries are now served with the page (see above).

Statistics Canada's Web Data Service has also refused every connection for about 15 s after heavy use (observed 2026-10-25, with resets and responses lacking CORS headers). Requests to Statistics Canada hosts therefore make seven attempts, waiting 20 to 28 s in all, and other hosts four. A successful request costs nothing extra; a failing one shows its error about 20 s later than before.

Census requests list the 172 characteristics the exhibits use: about 100 KB and 1 to 1.6 s per area instead of 3 MB and about 9.6 s for the full profile. WDS data points report a scalar factor of 0 for series published in thousands; the member's unit of measure supplies the scale. The earlier client showed annual LFS employment as 736.2 instead of 736,200.

## Definitions

- Payroll industries use SEPH 14-10-0202, the reference's actual source. Suppressed cells stay missing, with a count under the exhibit. The reference shows estimated values for some suppressed industries (4821, 5511, 3231); those estimates are not public.
- LQ uses the published industrial aggregate [00-91N] for the area and for Canada. The reference's LQs are about 1.093 times larger; denominators of published industries only, jointly published industries, and a mixed form were tested and none reproduces them.
- Fast-growing industries rank by absolute change over five years, as the reference does.
- Traded/local is approximate: a four-digit industry is traded when at least half of its US six-digit descendants are in Delgado–Porter–Stern traded clusters. This agrees with 51 of the reference's 55 labels. A strict-majority rule also gives 51.
- Metropolitan areas and municipalities use Business Register size classes at midpoints (500 for 500+), labelled as estimated employees. Census divisions, economic regions and population centres have no industry employment source; the panel says so and offers the province.
- Family income (11-10-0009) is labelled family income. Census household income is used only where the tax series is not published, and is labelled with its 2020 income year.
- Market and catchment cards report the selected area's own published totals; the map shows census subdivisions for context. Only the open filter defines the target; filters are never combined into an unpublished joint count. Shares divide by the published universe total.
- Enrolment groupings come from 37-10-0011, which publishes CIP primary groupings directly (territories combined). Institution figures come from 37-10-0277; an institution's grouping is shown only when every component is published, and only at a Wikidata institution whose label or English or French alias matches its name after folding case, accents and punctuation. Counts are whole-institution counts.
- Climate uses the ECCC station with complete monthly precipitation and temperature normals nearest the area's centroid (for a province, its largest metropolitan area). The period comes from the record (1981–2010).
- The Census Profile has no mean commuting time; the share of commutes under 30 minutes is shown instead.
- Drive times are 30 and 60 minutes (the public Valhalla limit), not the reference's 2, 4 and 8 hours.

## Historical pipeline

`analysis/` is the earlier offline Python build. It is not used by the website or its deployment and is kept for its comparison records and tests.


## 2026-10-26: regional brief and peer comparison

The owner approved replacing the nine-tool catalogue with Overview, People and work, Housing and incomes, Industries, and Compare. The compact header leads to dated observations. Logistics and enrolments leave primary navigation; distribution maps and the community finder open only on request. The map library is also requested only then.

Overview and peer comparisons use a common Census 2021 period, with 2020 income. Recent annual population estimates are separate. Peers must have the same geography level and are preserved in shared URLs; a geography change clears them. Canada compares all thirteen provinces and territories, retaining the territory-first order.

One industry workspace uses the existing payroll and employee-estimate adapters. The default ranking uses bars and full names; job-change rankings include up to ten gains and ten losses with published history. The five-year baseline is preserved and explicitly labelled, including the implications of a 2020 start. The industry detail remains available directly from a row. National specialization leads to industry-specific provincial benchmarks rather than a Canada-to-itself LQ.

Resident labour-force sectors and occupations use shares and benchmark marks. Their exports retain the underlying counts alongside shares. Qualification categories keep their published nested definitions and now explain their overlap beside the chart. Household income distribution remains a comparison; repeated profile maps and the duplicate workforce view are removed from the main flow. Climate is omitted from the general housing view rather than given an empty national panel.

This is an approved presentation and navigation change, including which rows are selected for job-change rankings. The source adapters, industry estimator, missing-value reconciliation and five-year source pairing are unchanged. It is not a claim of complete numerical parity across every geography and filter.
