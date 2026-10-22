# Validation

The runtime website and the historical offline pipeline have separate checks. Historical build results below are inherited records, not evidence that the live client reproduces every reference value.

## Runtime client, 2026-10-22

- `node --test tests/live.test.js`: 19 passing tests. These cover SDMX dimension order, suppression, complete-component sums, midpoint bounds, LQ, release pairing, geography IDs, cross-border metros, CSV quoting, request retry caching, sparse zero reconciliation, decimal precision, marginal filter counts and natural-break classes.
- `python -m pytest -q -m "not slow"`: 11 passed, 6 deselected. `ruff check .` passed; `pip check` reported no broken requirements. The historical slow build was not run: it requires downloaded observations and is not used by deployment.
- Live Edge requests were compared with `tests/fixtures/reference_mb.json`: latest largest-industry top-20 codes and counts, annual participation, family income, the four education numerators and all resident-industry sector counts matched. The evidence is in the working folder's `canada-regional-evidence/reference-live-comparison.json`. This checks those Manitoba predicates, not all ranks, LQs, years, classifications or jurisdictions.
- Browser smoke checks exercised all nine tool routes plus the full-profile browser, across Canada, Ontario, Manitoba, Winnipeg, Yukon and Northwest Territories. Ontario's market map returned its municipal coverage; the shared municipal URL survived reload. Mobile viewport checks found no horizontal overflow. External services were queried from Edge, including WDS POST and Census SDMX CORS requests.
- An independent review found incomplete PSIS sums and a needless Business Counts dependency in SEPH mode. Groups now require all components, using the same rule for institution markers. Field-group changes clear map program selection. Employer-location charts use location units.
- Focused Edge acceptance checks passed for the live Yukon climate charts/station selection, SEPH with catalogue requests blocked, talent grouping/program reset, workforce gender changes, catchment bin persistence, employer-location growth units, deliberate Census failure followed by successful retry, rapid province changes, Winnipeg selection/reload and a 390-pixel viewport. Deliberately blocking map boundaries preserved the catchment values, filters and downloads. Evidence: `final-browser-results.json` records the earlier run through climate/talent/workforce; `remaining-browser-results.json` records the successful remaining checks. Earlier failed attempts are retained rather than overwritten as successes.

Runtime observations are not saved under `site/`. Browser evidence and screenshots are retained outside the repository in the project work folder. Source outages, complete geographic coverage, OSM name matches and exact reference visual parity are not certified by these checks.

## Historical offline reference comparison (Manitoba, `tests/test_build.py`, marked slow)

| Reference exhibit | Reference value (recorded 2026-10-22) | Rebuild | Status |
| --- | --- | --- | --- |
| Largest industries, all, top 20 | codes and `employmentCount` | SEPH 2025 | identical codes, order and values |
| Fastest growing, all, top 20 | `employmentChange` | SEPH 2025 − 2020 | identical for 19; 4821 not in SEPH |
| Education donuts | 59.3%, 28.8%, 5.5%, 2.9% (counts 400,915 / 194,545 / 36,920 / 19,495) | Census 25–64 | identical counts |
| Residents' industry treemap | 20 sector counts | Census Profile 2261 group | identical |
| Labour force participation | 66.8 (2024), 66.6 (2025) | LFS 14-10-0464 | identical |
| Median household income KPI | 92,980 (2022), 97,040 (2023) | 11-10-0009, all families | identical |
| Talent: all programs | 63.0K | PSIS 2022/23: 63,162 | total matches; groups within 4%, not identical |
| Location quotients | e.g. 1.41 (6111) | 1.29 | constant factor ≈ 1.09, not reproduced |
| Traded/local labels | 55 industries | DPS mapping | 92.7% agree |

## Certificates

| Claim | Check | Status |
| --- | --- | --- |
| LCC inverse and forward are Snyder's | worked example pp. 296-297 to 1e-6° and 0.1 m (`tests/test_geo.py`) | passes |
| Point-in-polygon follows the even-odd rule | square with hole (`tests/test_geo.py`) | passes |
| Census groups partition their parents | `profile.certify_groups`: children sum to the parent within random rounding, every build | holds for all 13 |
| Broadband: division and hexagon sums equal the household total | assertion in `logistics.broadband` | holds for all 13 |
| Airport passengers attach to the right airport | `tests/test_airports.py` | passes |
| Campus assignment prefers the more specific institution | `tests/test_talent.py` | passes |
| Site renders without console errors | headless Edge, YT, NU, BC, MB, MB/4607062, ON, QC, NL, 2026-10-22 | no errors; screenshots inspected |
