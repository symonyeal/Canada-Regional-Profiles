# Validation

What was checked, how, and the result. Runtime checks of the website are separate from the historical offline pipeline's records. Evidence files (browser reports, captures, recorded reference responses) are kept with the project's working files, outside this repository.

## Gate

| Check | Command | Result (2026-10-23) |
| --- | --- | --- |
| JavaScript unit and behaviour tests | `node --test tests/*.test.js` | 33 passed, 0 failed |
| Python unit checks (historical analysis) | `python -m pytest -q -m "not slow"` | 11 passed, 6 deselected |
| Lint | `python -m ruff check .` | passed |
| Dependencies | `python -m pip check` | no broken requirements |
| Browser workflows | `node tests/browser/workflows.mjs <url> <report>` | 13 checks; see below |
| Coverage sweep | `node tests/browser/sweep.mjs <url> <report>` | 21 geographies × 9 tools; see below |

The new tests were checked against the defects they target: restoring the omitted agglomeration schemas and the DGUID-only boundary query made exactly the three targeted tests fail, and restoring the positional join of batched WDS responses made the batch-order test fail.

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

## Deployed site (46d63cf, 2026-10-23)

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
