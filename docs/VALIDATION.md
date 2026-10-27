# Validation

What was checked, how, and the result. Runtime checks of the website are separate from the historical offline pipeline's records. Evidence files (browser reports, captures, recorded reference responses) are kept with the project's working files, outside this repository.

## Configurable benchmarks (2026-10-27)

- 56 JavaScript tests passed, including a new benchmark case covering same-level and provincial choices, cross-province counties, invalid levels, self-comparisons, URL round trips and changes of geography. Eleven Python tests passed (six historical slow checks deselected), plus Ruff and the dependency check.
- The complete local browser suite passed 27 of 27 against live sources with in-process response reuse. New workflows verify Manitoba against Ontario across Findings, annual trends, Detail, Compare and reload; Manitoba Division No. 11 against Toronto census division through keyboard search, geography changes, Back and reload; and Steinbach against Winnipeg on a 390 px phone layout. Ontario's displayed Census employment benchmark is checked against its own live adapter value.
- All six map/chart regression checks passed again with configurable benchmarks present. The prior 19-geography smoke check and Rust results above apply to the map/chart revision; they were not repeated for benchmark selection, which changes no boundary geometry or Rust code.
- An earlier suite run passed 26 of 27: the peer-removal check counted rows from both the Census comparison and an annual-data table. Its selector now checks the first comparison table, and both its separate regression and the complete corrected suite passed. One later screenshot attempt timed out waiting for Census; source availability is not certified by these successful runs.
- Province and county benchmark controls were captured at 1440, 768 and 390 px with no page exceptions or horizontal overflow. The final phone controls use a full-width geography-type field and a short benchmark choice label.
- Live release checks compare the deployed assets with the committed blobs and run browser checks on the public URL; run-specific evidence is retained with the working files.

## Map and chart debugging (2026-10-27)

- Reproduced the deployed blank map. Data, legend and boundaries loaded, but the map container measured 772 × 0 px while its canvas measured 772 × 300 px. The delayed MapLibre stylesheet changed the map's position to relative. The new browser regression failed on this zero-height viewport at desktop and phone widths.
- Local map checks measured 772 × 679 px at desktop and 354 × 418 px on a phone, with matching canvas dimensions. With the entire basemap host blocked, 233 boundary features were rendered. Switching map tools and Escape closing produced no page exceptions. A real click on Alberta in the national map opened its provincial profile.
- Six new browser checks passed: delayed stylesheet, basemap failure and map disposal, phone viewport, national map selection, a deliberately pending OECD source with Statistics Canada findings already visible, and selectable Census rankings. Manitoba's displayed Census employment rate, 59.1%, matched the live adapter value of 59.1.
- Existing browser workflows: 24 of 24 passed against live public sources with in-process response reuse. These cover municipal selection, benchmark selection, history, shared URLs, same-level peers, industries, detail focus, exports, Census failure and recovery, and the four views at 1440, 768 and 390 px.
- Coverage smoke check: 19 geographies (Canada, all thirteen provinces and territories, a municipality, a census division, a cross-border metropolitan area, an economic region and a population centre), four views each, with zero page exceptions. The only reported failure panels were the three intended unpublished-industry states. Some annual slots were still loading when recorded; this is a navigation and scope smoke check, not full source-availability certification.
- Local checks: 55 JavaScript tests, 10 Rust tests and 11 Python tests passed; six historical slow Python checks deselected. Ruff and the installed-dependency check passed. The Rust tests used the existing workspace Cargo cache in offline mode after the default registry connection failed.
- Two visual rounds inspected the current findings and maps. The second captured histories, regional rankings and maps at 1440, 768 and 390 px and checked all four views: no page exceptions or horizontal overflow. The site retains its light theme; no full accessibility or dark-theme audit was performed. The new context bars measured 3.57:1 against white and 3.12:1 against their track; muted text measured 4.65:1 against the page.
- Live publication is checked separately from these local results.

## Latest year in Findings (2026-10-27)

- Local checks: 55 JavaScript tests, one new (latest year, same-year benchmark and cohort values, change start moved past a gap, nothing published).
- Browser workflows on the final code, local server against live sources: 24 of 24 passed, two new: Manitoba's unemployment card shows the adapter's last published value and year (5.9 %, 2025, 3rd lowest of 10 provinces and territories publishing it) and "Latest published year" is the first heading; Steinbach leads with its 2025 population, 3rd highest of 148 Manitoba municipalities with 1,000+ residents. The Census-outage check now also requires the annual cards to draw while Census is blocked.
- Sweep: 19 geographies, no page errors or failed Findings slots.
- Time to a complete latest block from page load, local server: Canada 5.8 s, Manitoba 5.7 s, Quebec 5.5 s, Ottawa–Gatineau 5.8 s, Steinbach 7.5 s, Division No. 11 3.9 s. After the sweep the OECD API refused connections; the four OECD cards were named as unavailable and the eight Statistics Canada cards drew.
- Visual: Manitoba at 1440 and 390 px, no horizontal overflow. No dark-theme or full accessibility audit.

## Annual ranges and OECD sources (2026-10-26)

- Cause of the 2021-only view: the Census Profile SDMX service lists 14 dataflows, all 2021; Findings and Compare used only it, and the annual series elsewhere were cut to the last 12, 15 or 16 periods. Economic-region population read 17-10-0137 (2016 boundaries, inactive, ends 2022).
- Local checks: 54 JavaScript tests, 7 of them new (common years with gaps, zeros and areas publishing nothing; range snapping; per cent, compound rate and point changes; least-squares slope per decade on an exact line; share and rate terms; source catalogue; URL state).
- Every annual measure through the site's adapters in the browser, one area per level (Canada, Manitoba, Yukon, Winnipeg CMA, Ottawa–Gatineau Ontario part, Portage la Prairie CA, Division No. 11, Southeast ER, Steinbach): published spans as in [COVERAGE.md](COVERAGE.md); the Labour Force Survey tables publish no territory and no CA. Immigration periods checked against the table footnote (2025 is 2025/2026, 368,224 immigrants to Canada).
- OECD adapter: six requests from the page, all HTTP 200, 1.1–1.6 s. The Northwest Territories and Nunavut carry 0 marked as normal values before 1999 in income (1991–1998) and homicides (1995–1998); the adapter drops those years. Yukon's zero-homicide years stay.
- Browser workflows against live sources: 22 of 22 passed on the final code, including four new checks (Manitoba population 1971–2026 with its Canada benchmark and a shared `tm`/`yr` range; Steinbach 2001–2025, +124.3 %, 7th of 148 Manitoba municipalities with 1,000+ residents; the economic region reads 17-10-0150 and never 17-10-0137; the payroll range starts in 2001).
- Sweep: Canada, the 13 provinces and territories, Winnipeg (CSD), Division No. 11, Ottawa–Gatineau, Winnipeg economic region and Brandon population centre rendered all four views with no page errors. The default annual panel spans 1971–2026 for Canada and the provinces and Yukon, 1991–2026 for the Northwest Territories and Nunavut, 2001–2025 below the provinces, and says that no annual series exists for a population centre.
- Visual: captures of Findings (Manitoba, Steinbach at 390 px, Division No. 11 temperature), Compare (Canada employment, Steinbach) and Economy (Manitoba, 2015–2025) checked for overlap; the x-axis end label no longer collides and comparison lines are distinguishable by role. No dark-theme or full accessibility audit.
- Statistics Canada's WDS served its unavailable page without CORS headers for about 70 minutes from 01:55 UTC on 2026-10-27; all live checks above ran after it recovered.

## Findings, economy and peers (2026-10-26)

- Local checks: 47 JavaScript tests (standing and rank text, headline selection, national spread, similarity, sector base and D, shift-share additivity, legacy links), 10 Rust tests (9 boundary, 1 adjacency), 11 Python tests (6 slow deselected), Ruff and the dependency check passed.
- Shift-share against live SEPH (2019 and 2025): Alberta publishes all 20 sectors and its unattributed remainder is 0, so the sectors sum to the [11-91N] aggregate in both years; Canada's mix and regional terms are −1 and 0 jobs (rounding). Manitoba: +17,358 jobs; 44,400 at Canada's rate (7.26 %), sector mix +2,964, regional shift −30,088, three suppressed sectors +83.
- Adjacency: 13 files, 34 to 1,380 areas each; Winnipeg's seven neighbours (Ritchot, Macdonald, Headingley, Springfield, East St. Paul, West St. Paul, Rosser) and Steinbach's two (Hanover, La Broquerie) inspected. Isolated areas (islands): 8 of 262 in Manitoba, 16 of 1,380 in Quebec.
- Browser workflows against live sources: 18 of 18 passed in two full runs, the second on the final code (findings and ranks, national spread, municipal cohort with similar places and neighbours, payroll decomposition, legacy links, CSV agreement, industry detail, chosen peers, keyboard selection, history, Census outage recovery, unsupported levels, suppression, optional maps, 1440/768/390 px). Between them, isolated reruns of the outage check failed twice while WDS refused browser connections without CORS headers after the test load (curl reached it at the same time); the final full run passed after WDS recovered.
- Sweep: Canada, the 13 provinces and territories, Winnipeg (CSD), Division No. 11, Ottawa–Gatineau, Winnipeg economic region and Brandon population centre rendered all four views with no page errors. The three detailed-industry failure panels are the unpublished-level states for a census division, an economic region and a population centre. Some Detail annual series were still loading when recorded.
- Time to first finding and to ranks, one run each (2026-10-26, Statistics Canada answering slowly): Manitoba 4.0 s and 5.5 s; Montréal 10.1 s and 23.9 s; Toronto 13.8 s and 24.8 s, against 31.8 s and 51.1 s before the profile request started in parallel with the geography list. Network-dominated; not a benchmark.
- Economy folds its two 20-sector tables under summary lines; the payroll table orders published sectors by regional shift and lists suppressed ones last.
- Visual: findings for Steinbach, Manitoba and Canada, Compare for Steinbach (similar: Morden, Winkler, Brandon, Altona, Portage la Prairie), Economy for Manitoba and Alberta, captured at 1280 px. No dark-theme or full accessibility audit.

## Regional brief (2026-10-26)

- Required local checks: 41 JavaScript tests, 9 Rust boundary tests and 11 Python tests passed; 6 historical slow Python tests deselected. Ruff and the installed-dependency check passed. Rust required a network setting to skip unavailable certificate-revocation lookups; certificate verification stayed enabled.
- The source API adapter, pure numerical model and taxonomy configuration have no diff against the implementation baseline. This does not establish numerical parity across every geography/filter. The display now uses resident-sector/occupation shares and an approved gains/losses selection.
- Browser interactions: 16 of 16 passed using captured successful public Census/SEPH responses, with live requests for cache misses. This checks navigation, legacy URLs, same-level peer selection and reload/removal, keyboard place selection, benchmark selection, history, industry detail/focus, table/CSV agreement, optional maps, source-failure recovery and 1440/768/390px page width. Captures are local test evidence and are not shipped with the site.
- Direct-source runs are separate: the initial run passed 12 of 16; a later live-source run passed 14 of 16. The two remaining timeouts in that later run show seven network refusals from WDS metadata requests in their request logs. A separate live probe rendered the same legacy industry link successfully. Do not call these live-source runs fully passing. An intermediate replay was 15 of 16 because its text assertion expected lowercase while CSS displayed uppercase; the corrected assertion passed in the final 16-of-16 run.
- A live coverage smoke run sampled Canada, Nunavut, Manitoba, Winnipeg municipality and Manitoba Division No. 11 across the five views. There were no page JavaScript exceptions. Some annual-series slots were still loading when recorded. The division's industry panel correctly reported unavailable local industry employment and offered the province. This is a sampled smoke check, not complete coverage certification.
- Visual inspection: five views captured at 1440, 768 and 390px, with no horizontal page overflow, no page exceptions and no visible main-content text under 12px in the final probe. Two earlier rounds were retained. The final phone-label check separately verifies that qualification labels wrap. The site retains its explicit light theme; no complete accessibility or dark-theme audit was performed.
- The industry-detail shared URL was separately reloaded after correcting its consolidated-section route; the expanded row/detail/focus/reload check passed.
- Palette checks against the cream page measured ink 13.34:1, body 6.28:1, muted text 4.65:1, forest green 8.02:1 and copper 5.12:1. These are token-pair checks, not a complete contrast audit.
- Source availability remains variable. A successful interaction replay does not establish the reliability of the upstream public services. No load-time improvement or exhaustive numerical parity is claimed.

## Gate

### Atlas design (2026-10-25)

- Required checks: 37 JavaScript tests, 9 Rust tests and 11 Python tests passed; 6 slow Python tests deselected. Ruff and the dependency check passed.
- Browser workflows: 19 of 19 passed on the redesigned client, including shared URLs, history, keyboard selection, benchmark changes, CSV agreement and recovery from source failures.
- Responsive review: all nine sections at 1440, 768 and 390 px, all six community dashboards at those widths, the industry trends overlay at those widths, and the geography controls with Newfoundland and Labrador at 320 px. No horizontal page overflow or page errors in the final review. The industry exhibit grid now permits its content to shrink when the viewport narrows; the industry overlay gives charts their full height and lets the panel scroll.
- Contrast: black or white text on 256 interpolated treemap fills had a minimum ratio of 4.61:1; forest green and copper against white measured 8.57:1 and 5.46:1. This is a palette check, not a complete accessibility audit.
- Coverage sweep: Canada and all 13 provinces and territories rendered all nine tools without failure panels or JavaScript errors.
- Reference appearance: intentionally changed at the owner's request; no claim of visual identity with the reference.

| Check | Command | Result (2026-10-25) |
| --- | --- | --- |
| JavaScript unit and behaviour tests | `node --test tests/*.test.js` | 37 passed, 0 failed |
| Boundary builder tests | `cargo test --release --manifest-path tools/boundaries/Cargo.toml` | 9 passed, 0 failed |
| Python unit checks (historical analysis) | `python -m pytest -q -m "not slow"` | 11 passed, 6 deselected |
| Lint | `python -m ruff check .` | passed |
| Dependencies | `python -m pip check` | no broken requirements |
| Browser workflows | `node tests/browser/workflows.mjs <url> <report>` | 19 of 19 passed (local) |
| Coverage sweep | `node tests/browser/sweep.mjs <url> <report>` | 21 geographies × 9 tools: every tool rendered (local) |

The new tests were checked against the defects they target: restoring the omitted agglomeration schemas and the DGUID-only boundary query made exactly the three targeted tests fail, and restoring the positional join of batched WDS responses made the batch-order test fail.

## Speed and reliability pass (local build, 2026-10-25)

Each section of the page was mounted in turn and timed until it had no loading indicator and no new data request for 1.5 s (Edge, 1440 px, local static server, public sources). Before: 2026-10-24, the previous client.

| Geography | Before | After |
| --- | --- | --- |
| Manitoba | 22.6 s, 191 requests, 6 failed; institution locations failed | 21.7 s, 119 requests, 0 failed; 18 institution locations, 9 of 12 institutions matched |
| Quebec | 43.9 s with 48 failed requests; 159 s on a second run (Overpass wait of 90 s) | 41.6 s, 140 requests |
| Montréal | 46.3 s, 232 requests, 43 failed (37 in logistics; the airport source was unreachable) | 44.5 s, 206 requests |

After the change, "failed" requests are hedge copies cancelled once the other copy answered. The remaining time is Statistics Canada's: the Quebec explorer and market maps wait on 11 Census requests of 120 subdivisions, each 5 to 8 s when sent together, and the market map fills after 20 to 35 s.

- Boundary files: divisions and provinces are within 0.001 % of the summed area of their subdivisions. Each province outline contains its Wikidata institutions (489 of 492; the other three lie offshore or outside every outline). The first build lost Manitoba's outline; the builder now stops on a difference over 1 %.
- Screens at 1440 px: market (Quebec, Nunavut), explorer and talent (Manitoba), logistics (Montréal), and the economic, household, dwelling and livability dashboards for Manitoba; at 390 px: the economic and livability dashboards, market and fast-growing industries for Manitoba. No clipped cards and no horizontal overflow. The climate chart was empty for Winnipeg because a 500-row request omitted its series; it now draws.
- Workflows 13 of 13 and the 21-geography sweep passed. Census division, economic region and population centre industry panels state that the level is not published, as intended.
- Deployed (2b53530): GitHub Actions `checks` (with the cargo tests) and `pages` succeeded; the Pages URL served the boundary files, gzip-encoded (Nunavut subdivisions 2.9 MB, 0.83 MB transferred). Workflows 13 of 13. Manitoba settled in 16.5 s (119 requests, 0 failed; 18 institution locations); Quebec in 24.5 s (138 requests; the 5 failed were cancelled hedge copies; 137 institution locations, 65 of 94 institutions matched).
- Not measured at the time: a 768 px pass, and a deployed sweep of all 21 geographies. Both were run in the debug pass below.

## Debug pass (deployed c68abbf and local fixes, 2026-10-25)

- Deployed files: all 22 page files under `site/` (boundaries excluded) are byte-identical to the committed blobs, and so is every eighth boundary file.
- Deployed workflows: 13 of 13. Deployed sweep, 21 geographies × 9 tools: every tool rendered except five panels in British Columbia, Alberta and Division No. 11 that reported "could not be reached" for `www150.statcan.gc.ca`; Ottawa–Gatineau was still loading three panels at 25 s. Three re-runs for British Columbia and two for Ottawa–Gatineau had 0 failed requests. The deployed workflows at efa76b9 then failed once the same way (Nunavut industries). A request log of the next Nunavut load showed the cause: every WDS connection was reset or refused from 1.8 s to 16.7 s after the page opened (28 requests), and the next two loads had none. The client stopped after four attempts, about 3 to 6 s of waiting. StatCan requests now make seven attempts (20 to 28 s of waiting, each wait at most 8 s). A workflow replays the burst by resetting every WDS request for 15 s: the previous build showed the failure panel after 5.9 s; the new one rendered Nunavut's industries after 19.6 s and 10 resets.
- Deployed bb39fda: `checks` and `pages` succeeded; page files byte-identical to the commit; workflows 16 of 16; sweep of 21 geographies × 9 tools with every tool rendered. The only failure panels are the intended ones: industry employment is not published for census divisions, economic regions or population centres.
- Workforce indicators treemap: tiles below the 20 × 18 px padding box were enlarged past their rectangles (border-box), so the smallest sectors ran 5 to 15 px past the chart edge at 1440, 768 and 390 px; tiles 30 to 48 px tall drew value over label. Tiles now carry text only where it fits and drop padding otherwise. The Education levels labels lacked an ellipsis because `text-overflow` does not apply to a flex box. Three width checks in the workflows failed on the previous build (1, 2 and 3 tiles) and pass now.
- 390, 768 and 1440 px (Manitoba, Nunavut, Winnipeg; deployed): no horizontal overflow and no page errors. At 820 px and below the Explorer map was 420 px tall in a 380 px grid row and covered the first 40 px of the community list; fixed, checked at 768 and 390 px, and added as a workflow.
- Explorer on Canada: selecting a community left its panel at "Loading Census 2021 indicators…", because the stale-response guard compared with an id set only when the province map was drawn. Fixed and added as a workflow.
- Main-thread CPU (local, every tool mounted, V8 profile): Quebec 35.0 s wall, of which site modules 0.54 s, MapLibre 2.7 s and idle (network) 30.6 s; Ontario 0.49 s, 2.5 s and 30.3 s; Canada 0.28 s, 1.3 s and 31.8 s. The largest site costs were JSON parsing in `exchange` (65–99 ms) and point-in-polygon tests (60–69 ms). A bounding-box test before the ray cast reduced the latter to 28 ms in Quebec and Ontario.

## Browser workflows (local build, 2026-10-23)

| Workflow | Result |
| --- | --- |
| A shared URL reconstructs geography, section and industry view | pass |
| Option cards and view toggles update the exhibit and the URL | pass |
| Geography changes add history entries; Back and Forward restore them | pass |
| Four quick province changes end on the last one, with no stale text | pass |
| Keyboard combobox selects a municipality; reload keeps it | pass |
| Malformed parameters fall back to Canada and valid defaults | pass |
| Provincial benchmark for a municipality | pass |
| Chart list, data table and CSV give the same leading values | pass |
| Census outage: Census cards fail, payroll industries render, Retry recovers | pass after a fix (Retry had re-awaited the failed request) |
| Boundary outage: market card, legend and 239-row table remain | pass |
| Visible keyboard focus | pass |
| Nunavut: published industries with a suppression count (290 of 309 suppressed) | pass |
| Census division: industry panel explains the level and offers the province | pass |

The first run passed 9 of 13; three failures were defects in the checks and one was the Retry defect. Both runs are kept.

## Coverage sweep (local build, 2026-10-23)

Canada, the 13 provinces and territories, and seven local samples: a municipality (Winnipeg), a census division (Division No. 11), a cross-border metropolitan area (Ottawa – Gatineau), an economic region, a population centre (Brandon), a small northern community (Iqaluit) and a duplicate name (Richmond, British Columbia). Every tool was mounted and its state recorded after 25 s.

- First run: all nine tools rendered for Canada and all 13 jurisdictions except the explorer in British Columbia and Ontario, where a boundary failure replaced the community list. Local samples showed establishments as an error where Business Counts publish CMA and CSD values.
- Fixes: the list no longer depends on boundaries; establishments use the CMA/CSD tables; unpublished combinations are shown as such; boundary retries race four connections.
- Second and third runs of the affected geographies: all tools rendered. Census division, economic region and population centre industry panels state that the level is not published, as intended. Institution locations depend on the public Overpass server, which was slow or returned errors in some runs; the panel says so and the enrolment figures are unaffected.

Sampled local checks cover one geography of each level, not every municipality.

## Deployed site checks (46d63cf; fix verification at 2ff30cc, 2026-10-23)

- GitHub Actions `checks` and `pages` succeeded for the commit; the public URL served the new page and its modules under the project path, and the previous `app.js` returned 404.
- Browser workflows against https://symonyeal.github.io/Canada-Regional-Profiles/: 13 of 13 passed.
- Sweep of the same 21 geographies: every tool rendered. Industry panels for the census division, economic region and population centre stated that the level is not published. In this run the boundary service refused all retries for Alberta and Newfoundland and Labrador; their market and explorer maps showed the boundary note while cards, lists and tables remained. Institution locations waited on or failed at the public Overpass server in most provinces; enrolments were unaffected.
- The sweep exposed one defect: establishments joined batched WDS responses by position, so Iqaluit showed no value. Responses are now joined by product (Iqaluit: 323 locations, June 2026), with a regression test. After deploying that fix (2ff30cc), Iqaluit, Alberta and Newfoundland and Labrador were swept again: every tool rendered, including both provinces' boundaries.

## Manitoba against the reference (2026-10-23)

The site's own modules computed live values, compared field by field with reference responses recorded on 2026-10-22. Periods match unless stated.

| Exhibit | Result |
| --- | --- |
| Largest industries, all (SEPH 2025) | 20/20 values and ranks exact |
| Fast-growing industries, all (2020–2025) | 19/20 changes exact; 4821 is not published by SEPH, so six later ranks shift by one |
| Traded and local sets | Values exact where both publish; ranks differ where classifications disagree (51/55 labels agree) or the reference fills suppressed industries (4821, 5511, 3231) |
| Location quotients | 0/57 equal; reference ≈ 1.093 × standard LQ; four denominators tested |
| LFS participation and unemployment, 2011–2025 | 30/30 within display rounding |
| LFS employment, 2011–2025 | 15/15 exact (after the unit fix) |
| Median family and individual income, 2012–2023 | 24/24 exact; earlier years are outside the requested window |
| Population, July 1 | 11 years exact; 2022–2025 differ because Statistics Canada revised the estimates after the reference retrieved them |
| Establishments 2018–2026 | 0/9 equal; neither total nor classified subtotal of either release month reproduces the reference |
| Census distributions and KPIs (income bands, sectors, industry treemap, occupations, education, construction, tenure, commuting, place of work, households, median age, rent, dwelling value) | 98 of 100 exact or within display rounding; the two differences are the reference's "80 and older" band (85+ only) for Manitoba and Canada |
| Market card, individual income $30K–$70K | 433,775 (provincial total) vs 433,675 (reference sum of census subdivisions) |
| Talent total | 37-10-0011 publishes no Manitoba year equal to the reference's 63,027; groupings rank in the same order |

## Responsive and accessibility checks

Rendered at 1440, 768 and 390 px for Manitoba with every tool mounted: no horizontal page overflow at any width. Tables scroll within their containers. Charts and maps redraw when their containers resize. Focus outlines are 2 px solid. Controls are native buttons, inputs and selects; range sliders are two native range inputs with value text; every chart has a data table in its menu; tooltips also open on keyboard focus. Motion runs only when reduced motion is not requested. A 1440 px window at 200 % zoom is a 720 px layout; rendered at 720 px with every tool mounted, the page had no horizontal overflow. Contrast of chart labels on filled marks is chosen by luminance. A full WCAG audit was not run.

## Performance

Manitoba economic dashboard, time until every card has left its loading state, three runs each:

| Client | Cold | Warm (return after another province) |
| --- | --- | --- |
| Previous client (GitHub Pages) | 16.4–18.9 s | 0.31 s |
| This client (local static server) | 4.1–4.4 s | 0.26–0.43 s |
| This client (GitHub Pages, 2ff30cc) | 4.2–4.9 s | 0.35–0.50 s |

The main previous delay was the full Census profile (about 3 MB and 9.6 s per area, twice). Census requests now list the 172 characteristics used.

## Historical offline pipeline

`tests/test_build.py` (marked slow) checked the earlier offline build against the reference using downloaded inputs. It was not run: its inputs are not part of the website and the code it tests did not change.
