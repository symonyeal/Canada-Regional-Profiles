# Decisions

Each entry: the decision, the alternatives measured, the measurement, the date.

**2026-10-22. Reproduce the reference by reverse engineering, not by resemblance.** Every embed on the
reference page was rendered in headless Edge and its network traffic recorded over the Chrome
DevTools Protocol (`docs/REFERENCE.md`). The rebuild follows the recovered layout, chart types,
palette and data definitions. Where the reference uses public data, the numbers are checked against
its recorded responses (`tests/fixtures/reference_mb.json`, `tests/test_build.py`).

**2026-10-22. Industry employment is SEPH, not a Business Register estimate.** The reference labels
its source "Statistics Canada – Business Register". Its numbers, however, are SEPH (table 14-10-0202,
all employees, 2025): 20 of 20 largest industries in Manitoba match to the job, and the change is
2025 minus 2020. The first version estimated employment from Business Register size classes by
class midpoints. That estimate ran a median 1.32 times SEPH, with correlation 0.78, and was
replaced. Bounded least-squares calibration of the class means to SEPH was also tried. With 166 of
310 Manitoba cells suppressed, it put the estimated cells into the top 20 (13 of 20 overlap), so
suppressed cells are left out, as the reference leaves them out.

**2026-10-22. Location quotient: totals are the SEPH industrial aggregate [00-91N].** The reference's
LQ exceeds this definition by a constant factor of about 1.09 across industries (1.41 against 1.29
for 6111). Other denominators were measured, each as mean and maximum absolute error against the
reference: published-cell sums (0.18; 0.50), sector and subsector sums (0.15 and 0.11), and the
aggregate (0.13; 0.37). None reproduces it, and the standard definition is kept.

**2026-10-22. Traded/local from Delgado, Porter and Stern (2016), mapped by longest NAICS prefix.**
The official downloads are gone: clustermapping.us is a parked domain and clustermap.ca does not
resolve (both checked 2026-10-22). The traded 6-digit list comes from a third-party tabulation
(`data/dps_traded_naics_us2017.txt`; 668 of 1,057 US codes). Measured against the reference's 55
labelled Manitoba industries, it agrees on 92.7%. A 4-digit unweighted rule scored 92.7% to 94.5%
depending on its threshold. That is no better once the threshold is fitted to the same labels, so the
first rule is kept.

**2026-10-22. Census through the Census Profile SDMX API.** www12.statcan.gc.ca, which serves the Census
Profile files and the Census Dictionary, is behind a browser challenge. The SDMX API
(api.statcan.gc.ca) serves the same characteristics for Canada, provinces, divisions and
subdivisions. Education uses the population aged 25 to 64: on that universe the reference's four
donuts reproduce exactly (59.3%, 28.8%, 5.5%, 2.9%); on 15+ they do not (50.2% postsecondary).

**2026-10-22. Market and catchment maps sum one dimension at a time.** The Census Profile publishes
marginals (income bins, age bins, …), not cross-tabulations, so the open filter dimension alone sets
the target. The reference's `census-sum` endpoint likewise sums a list of characteristics.

**2026-10-22. Talent: CIP primary groupings from Statistics Canada's variant; campuses by idf matching.**
The variant maps whole 2-digit series, except series 30, which it splits by subseries; the PSIS slice
keeps those subseries. Each public facility in the Open Database of Educational Facilities is
assigned to the institution maximising, lexicographically, its matched-word idf and then its
negated unmatched-word idf. Private facilities are used only on a whole-name match. 199 of 235
institutions are located. Manitoba's total matches the reference's 63.0K in 2022/23 (63,162). Its
grouping figures differ by up to 4%, so the reference's talent dataset is not exactly table
37-10-0277.

**2026-10-22. Maps in ECharts `geo` with a Lambert conformal conic projection (49°, 77°).** Measured:
Plotly `scattermap` (MapLibre, WebGL) drew neither traces nor a fitted view in headless Edge. ECharts
draws SVG-like canvas maps from GeoJSON without tiles and opens from `file://`. Boundaries are
generalised by the server to a page-weight cap (0.5 MB outline, 1.5 MB subdivisions); small islands
are pruned where needed (Nunavut: 4.5 MB to 0.14 MB).

**2026-10-22. Airport passengers instead of OAG connections.** OAG route counts are proprietary. Table
23-10-0253 gives passengers by sector (domestic, transborder, other international); many
airport-years are suppressed, so each airport shows its latest published year.

## Open

- Drive-time areas around airports and the workforce catchment (the reference's
  `reference/drivetime`) are not reproduced; they need a routing engine.
- Rail transportation (4821) in the reference's fastest-growing list is not in SEPH table 14-10-0202.
- Ports: neither the World Port Index nor DFO's small craft harbours list Iqaluit's deep-sea port,
  Tuktoyaktuk, or the Skagway gateway to Yukon.
- Iqaluit has no station in the ECCC climate-normals API; its profile shows the nearest complete
  station and its distance.
- 36 institutions have no matching facility in ODEF and are listed but not mapped.

## Tested and refused

**2026-10-22. Traded/local by geographic concentration.** Ran on Business Register counts for 293
census divisions, 4-digit NAICS, against the DPS labels (258 groups matched, 175 traded):
- Krugman's locational Gini: every industry scored ≥ 0.10, median 0.54.
- Ellison–Glaeser γ: at its best threshold it agreed with DPS on 70.5% of groups, against 67.8% for
  labelling every group traded.

**2026-10-22. Business Register size-class estimates of industry employment** (above): replaced by SEPH.
