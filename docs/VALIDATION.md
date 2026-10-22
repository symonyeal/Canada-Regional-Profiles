# Validation

What must be checked, how, and what has been. A check is a certificate (feasibility, a
known value from a source, a partition that must reconstruct its total), never an output snapshot.

| Claim | Check | Status |
| --- | --- | --- |
| LCC inverse and forward are Snyder's | worked example pp. 296-297 to 1e-6° and 0.1 m (`tests/test_geo.py`) | passes 2026-10-22 |
| Point-in-polygon follows the even-odd rule | square with hole (`tests/test_geo.py`) | passes |
| Midpoint estimate lies within its class bounds | `tests/test_industry.py` | passes |
| Σ_i (E_i/ΣE) LQ_i = 1 | `tests/test_industry.py` | passes |
| NAICS levels 2, 3, 4 partition the same locations and estimated employment | assertion in `build_site.industries` | holds for YT, NT, NU |
| Size classes partition the business total | assertion in `build_site.market` | holds for YT, NT, NU |
| Broadband: census-division and hexagon sums equal the household total | assertion in `logistics.broadband` | holds for YT, NT, NU |
| Traded share of Canadian employment near DPS's US figure (about 36%) | printed by `build_site` | 35.4%, measured 2026-10-22; DPS figure cited, not inspected |
| Pseudo-household totals match Census 2021 occupied dwellings | compare `broadband.households` with 98-10-0004 | YT 17,181 vs 17,185; not yet asserted |
| Site renders | headless Edge screenshot of NT, 2026-10-22 | map, charts, tiles drawn |
