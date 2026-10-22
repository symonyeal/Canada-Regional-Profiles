# Decisions

Each entry: the decision, the alternatives measured, the measurement, the date.

**2026-10-22. Reproduce the reference's six panels from public sources.** The reference page
(advanceruralmanitoba.ca/why-rural-manitoba) embeds six Localintel tools:
`tool-advantages-logistics`, `frameset-workforce-advantages`, `frame-largest-industries`,
`frame-fast-growing-industries`, `tool-advantages-talent-pipeline` and
`frameset-market-advantages`. Rendered on 2026-10-22, they cite Statistics Canada's Business
Register (2025; 2020–2025), PSIS (2025) and OAG aviation data (proprietary). Here OAG route counts
are replaced by Statistics Canada passenger traffic.

**2026-10-22. Employment from size classes by midpoints; 500+ at 500.** Bounds N l ≤ e ≤ N u are
carried to the hover. Not measured: the error of the midpoint estimate against payroll employment.

**2026-10-22. Traded/local from Delgado, Porter and Stern (2016), mapped by longest NAICS prefix.**
The official downloads are gone: clustermapping.us is a parked domain and clustermap.ca does not
resolve (both checked 2026-10-22). The traded 6-digit list comes from a third-party tabulation
(`data/dps_traded_naics_us2017.txt`; 668 of 1,057 US codes). Codes in sectors numbered differently
in Canada (41 wholesale, 91 public administration) fall back to the US sector (42, 92). Result:
traded industries hold 35.4% of Canadian estimated employment in June 2026.

**2026-10-22. Map in Plotly `scattergeo`, Lambert conformal conic (49°, 77°).** Measured:
`scattermap` (MapLibre, WebGL) drew neither traces nor a fitted view in headless Edge, with or
without SwiftShader. The SVG map renders, needs no tile server, and opens from `file://`.

**2026-10-22. Airport passengers: latest published year per airport.** Table 23-10-0253 suppresses
many airport-years (Whitehorse in every year 2020–2025, Iqaluit since 2022). Each airport shows its
latest published year beside the value, and the jurisdiction total shows the current year.
Matching to OurAirports uses the qualifier after "/" where a city has several airports.

**2026-10-22. Workforce regions are census divisions.** Generic NWT names ("Region 1") are
completed by each division's most populous subdivision, read from table 98-10-0004.

## Open

- Ports: neither the World Port Index nor DFO's small craft harbours list Iqaluit's deep-sea
  port, Tuktoyaktuk, or the Skagway gateway to Yukon.
- Growth for industries recoded between NAICS 2017 and 2022 (for example, retail 4561, 4581) is not
  shown, because no 2021 value exists under the new code.

## Tested and refused

**2026-10-22. Traded/local by geographic concentration.** Ran on Business Register counts for 293
census divisions, 4-digit NAICS, against the DPS labels (258 groups matched, 175 traded):
- Krugman's locational Gini: every industry scored ≥ 0.10, median 0.54. Lumpy small regions
  inflate it, so Jensen and Kletzer's 0.1 threshold classed every industry traded.
- Ellison–Glaeser γ, with the plant Herfindahl taken from size classes: at its best threshold
  (γ ≥ 0.002) it agreed with DPS on 70.5% of groups. Labelling every group traded agrees on 67.8%.

Refused as no better than the base rate.
