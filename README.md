# Canada Regional Profiles

**Site: https://symonyeal.github.io/Canada-Regional-Profiles/**

## In plain terms

Regional development agencies publish "why invest here" dashboards. They show how a region
connects to the world, who works there, which industries are largest and growing, where talent
is trained, and how large the local market is. One example is Advance Rural Manitoba's
[Why Rural Manitoba](https://advanceruralmanitoba.ca/why-rural-manitoba/), built on a commercial
platform. This project rebuilds that dashboard from public data alone, for every province and
territory. It adds them one at a time, starting with the three territories.

**What we found (territories, June 2026 business counts).**

| | Yukon | Northwest Territories | Nunavut |
| --- | --- | --- | --- |
| Residents, July 2026 | 50,356 | 45,904 | 43,091 |
| Households where 50/10 Mbps internet is available | 94% | 93% | 0% (99.9% have LTE) |
| Airports with scheduled passenger service | 4 | 19 | 25 |
| Largest traded industry group (estimated employees) | Traveller accommodation | Non-metallic mineral mining (diamonds) | Metal ore mining |
| Participation rate, 2021 (Canada 63.7%) | 71.8% | 70.7% | 58.6% |

Public administration is the largest employer in all three territories.

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
