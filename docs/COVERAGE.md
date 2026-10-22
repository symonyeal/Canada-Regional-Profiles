# Reference coverage

The live site implements the nine reference tools across Canada, provinces/territories and official local Census geographies. Recovered reference charts and API definitions are recorded in [REFERENCE.md](REFERENCE.md). All displayed observations are requested from public services at runtime; no observation bundles are published with the site.

| Embedded tool | Live application module | Remaining difference |
| --- | --- | --- |
| tool-advantages-logistics | maps.js | OSM facilities and road basemap; no OAG scheduled-route counts or flight frequencies; no broadband household aggregate |
| frameset-community-profile | profiles.js: community; climate.js | Six reference dashboards and additional demographic charts. Annual series retain their published geographic scope; climate is an explicitly selected station, with period read from ECCC metadata. |
| gateway-community-explorer | explorer.js | Official geography search and multi-area comparison; no proprietary custom areas |
| frameset-market-advantages | catchment.js; profiles.js: market | Consumer, dwelling and business choropleths, selectable bins, counts/shares and natural breaks. One marginal distribution at a time; no inferred intersections. Canada maps provinces; provinces map municipalities. |
| frameset-workforce-advantages | profiles.js: workforce; catchment.js | Four education donuts, resident-industry treemap, top-five occupations and catchment maps. Detailed education/commuting and LFS trends are additional views. |
| gateway-industry-insights | industries.js: insights | LQ, growth bubbles and treemap. SEPH is default at national/provincial level; municipal midpoint estimates remain a separately labelled option. |
| frame-fast-growing-industries | industries.js: growing | SEPH annual five-year comparison or matched Business Counts releases; sector-coloured bubbles. Missing or recoded industries stay unavailable. |
| frame-largest-industries | industries.js: largest | Top-20 sector-grouped treemap, rankings and list. SEPH employment, Business Register estimates and employer-location counts are distinct choices. Traded/local mapping is approximate. |
| tool-advantages-talent-pipeline | talent.js; campus.js | PSIS fields, trends, filters and institution map. Groups require all components; independent total retained. Exact facility-name coverage is incomplete; counts describe institutions, not individual campuses. |

Geography controls cover Canada, provinces/territories, municipalities, census divisions, metropolitan areas/agglomerations, economic regions and population centres. Public tables have different geographic coverage. Broader source scopes are labelled rather than presented as local observations. The explorer provides comparisons, with geographic maps in the catchment tools rather than its own boundary map.

Live Manitoba checks matched the recorded top-20 largest-industry codes/counts, annual participation, family income, four education numerators and resident-industry sector counts. These checks do not establish 100% reproduction, pixel-for-pixel agreement or identical results for every filter and geography. Proprietary OAG routes, drive-time areas, complete facility inventories, custom-area aggregation and live broadband household aggregates remain gaps. See [VALIDATION.md](VALIDATION.md).
