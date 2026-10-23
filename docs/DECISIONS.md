# Decisions

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

Transient failures (network, timeout, HTTP 5xx, 429) are retried a bounded number of times; unsupported and malformed responses are not. Failed requests are evicted from the in-memory cache, and Refresh clears it. Requests are limited per host (one at a time for Overpass and Valhalla).

The StatCan boundary server returns HTTP 500 without CORS headers for about half of new connections and for any explicit field list; a browser reports both as a network failure. Boundary queries ask for all fields, and each retry sends four parallel copies, keeping the first answer. In six fresh browser sessions every boundary request then succeeded, one after 12 failed attempts.

Census requests list the 172 characteristics the exhibits use: about 100 KB and 1 to 1.6 s per area instead of 3 MB and about 9.6 s for the full profile. WDS data points report a scalar factor of 0 for series published in thousands; the member's unit of measure supplies the scale. The earlier client showed annual LFS employment as 736.2 instead of 736,200.

## Definitions

- Payroll industries use SEPH 14-10-0202, the reference's actual source. Suppressed cells stay missing, with a count under the exhibit. The reference shows estimated values for some suppressed industries (4821, 5511, 3231); those estimates are not public.
- LQ uses the published industrial aggregate [00-91N] for the area and for Canada. The reference's LQs are about 1.093 times larger; denominators of published industries only, jointly published industries, and a mixed form were tested and none reproduces them.
- Fast-growing industries rank by absolute change over five years, as the reference does.
- Traded/local is approximate: a four-digit industry is traded when at least half of its US six-digit descendants are in Delgado–Porter–Stern traded clusters. This agrees with 51 of the reference's 55 labels. A strict-majority rule also gives 51.
- Metropolitan areas and municipalities use Business Register size classes at midpoints (500 for 500+), labelled as estimated employees. Census divisions, economic regions and population centres have no industry employment source; the panel says so and offers the province.
- Family income (11-10-0009) is labelled family income. Census household income is used only where the tax series is not published, and is labelled with its 2020 income year.
- Market and catchment cards report the selected area's own published totals; the map shows census subdivisions for context. Only the open filter defines the target; filters are never combined into an unpublished joint count. Shares divide by the published universe total.
- Enrolment groupings come from 37-10-0011, which publishes CIP primary groupings directly (territories combined). Institution figures come from 37-10-0277; an institution's grouping is shown only when every component is published, and only at a facility whose OpenStreetMap name matches exactly. Counts are whole-institution counts.
- Climate uses the ECCC station with complete monthly precipitation and temperature normals nearest the area's centroid (for a province, its largest metropolitan area). The period comes from the record (1981–2010).
- The Census Profile has no mean commuting time; the share of commutes under 30 minutes is shown instead.
- Drive times are 30 and 60 minutes (the public Valhalla limit), not the reference's 2, 4 and 8 hours.

## Historical pipeline

`analysis/` is the earlier offline Python build. It is not used by the website or its deployment and is kept for its comparison records and tests.
