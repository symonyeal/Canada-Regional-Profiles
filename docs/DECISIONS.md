# Decisions

## 2026-10-25: speed and reliability pass

A profiler recorded each section's time to settle, its requests, bytes and failures, for Manitoba, Quebec and Montréal. Computation was not the cost: natural breaks over 1,282 subdivisions took 12 ms, decoding the subdivision list 21 ms and parsing the 5 MB table catalogue 9 ms, so no client code moved to Rust or WebAssembly. Time went to the network: boundary requests refused by the server, Statistics Canada connections that hung for 20 to 35 s, 33 Census requests for one Quebec map, and an Overpass query that waited 90 s and then failed.

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
