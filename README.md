# Canada Regional Profiles

**Site: https://symonyeal.github.io/Canada-Regional-Profiles/**

## In plain terms

Regional development agencies publish "why invest here" dashboards. They show how a region
connects to the world, who works there, which industries are largest and growing, where talent
is trained, and how large the local market is. One example is Advance Rural Manitoba's
[Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/), built on a commercial
platform. This project rebuilds that dashboard from public data alone, for every province and
territory: the three territories first, then the provinces from west to east.

**What we found.** All thirteen provinces and territories are built. Population is for July 2026,
employer business locations for June 2026, and 50/10 Mbps is the share of households where that
speed is available.

| | Residents | Employer locations | 50/10 Mbps | Participation 2021 | Largest traded industry group |
| --- | --- | --- | --- | --- | --- |
| Yukon | 50,356 | 1,979 | 94% | 71.8% | Traveller accommodation |
| Northwest Territories | 45,904 | 1,599 | 93% | 70.7% | Non-metallic mineral mining and quarrying |
| Nunavut | 43,091 | 751 | 0% (99.9% have LTE) | 58.6% | Metal ore mining |
| British Columbia | 5,710,598 | 218,192 | 98% | 63.3% | Computer systems design and related services |
| Alberta | 5,101,050 | 180,659 | 98% | 68.0% | Support activities for mining, and oil and gas extraction |
| Saskatchewan | 1,278,402 | 43,184 | 91% | 65.4% | Management of companies and enterprises |
| Manitoba | 1,517,379 | 44,135 | 96% | 64.4% | Management of companies and enterprises |
| Ontario | 16,262,121 | 511,212 | 98% | 62.8% | Computer systems design and related services |
| Quebec | 9,067,114 | 279,405 | 99% | 64.1% | Computer systems design and related services |
| New Brunswick | 883,522 | 26,601 | 96% | 60.1% | Management of companies and enterprises |
| Nova Scotia | 1,103,419 | 33,100 | 98% | 59.5% | Fishing |
| Prince Edward Island | 182,989 | 6,865 | 98% | 65.8% | Food merchant wholesalers |
| Newfoundland and Labrador | 552,462 | 18,736 | 92% | 56.1% | Seafood product preparation and packaging |

Public administration is the largest employer in the territories. In every province, the
largest is restaurants and other eating places.

**What this does not show.** Employment by industry is *estimated*. The Business Register counts
businesses by size class (1–4 employees, 5–9, …), not their exact employees. We use each class's
midpoint and count the open class (500+) at 500, so totals that include it are lower bounds.
Traded versus local follows a United States classification mapped to Canadian codes. Port lists
miss some northern marine facilities, such as Iqaluit's deep-sea port. Passenger counts are
suppressed for many airports, including Whitehorse.

## Overview

`analysis/build_site.py` writes one data file per jurisdiction. The page has six sections, as in
the reference: logistics, workforce, largest industries, fastest-growing industries, talent
pipeline and market.

Let N ∈ ℕ^{k×8} count the employer locations of k industries in the Business Register's size
classes [l_j, u_j]. Then

  e = N m,  N l ≤ e ≤ N u,  LQ_i = (e_i / Σe) / (E_i / ΣE),

with m the class midpoints (the 500+ class at 500) and E the same for Canada. Industry i is
*traded* when its Canadian 6-digit codes, weighted by national employment, have a mean traded
share of at least ½. A code's traded share is the fraction of matching NAICS US 2017 codes in a
traded cluster of Delgado, Porter and Stern (2016), matched on the longest shared prefix. Mapped
this way, traded industries hold 35.4% of Canadian estimated employment.

| Part | Module | Source |
| --- | --- | --- |
| Size-class employment, LQ, growth, traded flag | `analysis/industry.py` | Delgado, Porter and Stern (2016) |
| Lambert conformal conic, point in polygon | `analysis/geo.py` | Snyder (1987) §15 |
| Roads, rail, ports, airports, broadband | `analysis/logistics.py` | Douglas and Peucker (1973) |
| Statistics Canada readers | `analysis/statcan.py` | — |

Run:

```text
py -3.14 -m pip install -r requirements.txt
py -3.14 analysis/fetch.py              # about 4 GB of public files into data/fetched (gitignored)
py -3.14 -m analysis.build_site         # writes site/data/*.js (generated, committed)
py -3.14 -m pytest -q
```
