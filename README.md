# Canada Regional Profiles

**Site: https://symonyeal.github.io/Canada-Regional-Profiles/**

## In plain terms

Regional development agencies publish "why invest here" dashboards. One is Advance Rural Manitoba's
[Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/), assembled from eight
embedded tools sold by a commercial platform. This project reverse engineers that dashboard: its
layout, its charts, and the data and formulas behind each number. It then rebuilds the dashboard
from public data for every province and territory. Coverage starts with the territories and runs
west to east, and includes a profile for every municipality and First Nations reserve (census
subdivision).

The page has the reference's sections, in its order:
- **Logistics.** Airports, roads, ports, rail and broadband.
- **Community profile.** Economic, resident, household, dwelling, workforce and livability
  dashboards, for the jurisdiction or any community.
- **Community explorer.**
- **Market.** Consumers, dwellings and businesses, counted on a map for any criteria.
- **Workforce.** Indicators and a catchment map.
- **Industries.** Fastest growing and largest, each split into traded and local.
- **Talent pipeline.**

**How exact it is.** For Manitoba, the reference's own location, the rebuild reproduces the
reference to the unit wherever it uses public data:
- The 20 largest industries and their employment: SEPH 2025, same order.
- The fastest-growing industries: change since 2020. One, rail transportation, comes from data
  that is not public.
- The education donuts (59.3%, 28.8%, 5.5%, 2.9%), the residents'-industry treemap and the
  occupation ranking.
- Labour force participation (66.6%) and median family income ($97,040).

`tests/test_build.py` checks all of these against the reference's recorded responses.

**What this does not show.**
- The reference's airport route counts (OAG) and drive-time areas are proprietary. Here airports
  show passenger counts instead, and there are no drive-time areas.
- Industries whose employment Statistics Canada suppresses are not listed. In the territories that
  is most of them.
- The traded/local labels follow a United States classification mapped to Canadian industry codes.
  They agree with the reference's labels on 93% of its Manitoba industries.
- Its location quotients differ from the reference's by a constant factor of about 1.09, whose
  source is unidentified.
- Northern port lists are incomplete.

## Overview

`docs/REFERENCE.md` records the reverse-engineered reference: every embed, endpoint, chart type,
dataset and colour. `analysis/build_site.py` writes three files per jurisdiction:
- `site/data/<CODE>.js`: logistics, profile, industries and talent.
- `site/data/<CODE>-csd.js`: Census Profile values, business counts and climate by census subdivision.
- `site/data/<CODE>-geo.js`: boundaries.

The page (`site/app.js`, ECharts) filters, sums the census bins a visitor selects, classes the map
by Jenks natural breaks, and draws.

| Part | Module | Method or source |
| --- | --- | --- |
| Industry employment, change, LQ, traded flag | `analysis/build_site.py`, `analysis/industry.py` | SEPH 14-10-0202; Delgado, Porter and Stern (2016) |
| Census Profile by jurisdiction, division and subdivision | `analysis/census.py` | Statistics Canada Census Profile SDMX API |
| Community profile series, explorer, market data | `analysis/profile.py` | LFS 14-10-0464, 17-10-0005/0155, 11-10-0009, Business Register |
| Talent pipeline | `analysis/talent.py` | PSIS 37-10-0277, CIP 2021 primary groupings, ODEF |
| Map layers, projection | `analysis/logistics.py`, `analysis/geo.py` | Atlas of Canada 1:1M; Snyder (1987) §15 |
| Boundaries, climate | `analysis/boundaries.py`, `analysis/climate.py` | StatCan cartographic boundary files; ECCC normals |

Run:

```text
py -3.14 -m pip install -r requirements.txt
py -3.14 analysis/fetch.py              # public files into data/fetched (gitignored); census, boundaries and
                                        # climate are fetched on first use by their modules
py -3.14 -m analysis.build_site         # writes site/data/*.js (generated, committed), about 6 minutes
py -3.14 -m pytest -q                   # -m slow reproduces the reference's Manitoba numbers
```
