# Reference coverage

The reference page exposes nine embedded Localintel tool URLs. Their interiors could not be inspected on 2026-10-22: direct HTTP requests returned 406, and Edge embedded-frame navigation also failed. This inventory establishes tool coverage, not exact chart or data equivalence.

| Embedded tool | Live application module | Remaining difference |
| --- | --- | --- |
| tool-advantages-logistics | maps.js | OSM facilities and road basemap; no OAG scheduled-route counts or flight frequencies; no broadband household aggregate |
| frameset-community-profile | profiles.js: community | Public Census demographic/housing profile; proprietary chart parity unverified |
| gateway-community-explorer | explorer.js | Official geography search and multi-area comparison; no proprietary custom areas |
| frameset-market-advantages | profiles.js: market | Census household and dwelling measures; current property prices are not inferred |
| frameset-workforce-advantages | profiles.js: workforce | Census resident labour force, education, occupations and commuting; LFS trends at national/provincial level |
| gateway-industry-insights | industries.js: insights | Midpoint estimates, LQ, growth bubbles and treemap; mapped traded/local classification |
| frame-fast-growing-industries | industries.js: growing | Same-month five-year Business Counts comparison; unavailable recoded industries stay missing |
| frame-largest-industries | industries.js: largest | Live Business Counts at published geographies; Census sector fallback for other local levels |
| tool-advantages-talent-pipeline | talent.js | PSIS institutions and fields; municipal resident qualifications remain separate |

All nine modules are implemented. This does not establish 100% reproduction of the reference. Exact visual comparison, proprietary measures, complete transport inventories, custom-area aggregation and live broadband household aggregates remain outside the verified coverage.
