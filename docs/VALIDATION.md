# Validation

What must be checked, how, and what has been. A check is a certificate (feasibility, a
known value from a source, a partition that must reconstruct its total), never an output snapshot.

## Reproduction of the reference (Manitoba, `tests/test_build.py`, marked slow)

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
