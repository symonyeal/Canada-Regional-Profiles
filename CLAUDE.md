# Working contract

Read before changing anything. [README](README.md) states what the dashboard shows;
[Decisions](docs/DECISIONS.md) states why it is that way; [Validation](docs/VALIDATION.md)
states what must be, and has been, checked. This file states the rules a change must
not break. Codex reads the same file through [AGENTS.md](AGENTS.md).

## Always on

| Rule | Reason |
| --- | --- |
| Report no outcome that was not read back from the result that produced it. | A requested tolerance is not a result. |
| Name a failed run by its status, never by its cause until the cause is shown. | Malformed data and a genuine infeasibility end the same way. |
| Cite only what [Sources](docs/SOURCES.md) records, and add the entry in the change that uses it. | A method is validated by the source it implements, not by the code that ran it. |
| Add a dependency only after measurement. Use the system Python 3.14; no virtual environment. | numpy and scipy come first. |
| State what was measured and what was not. | "Not measured" is a finding. A projection is not a measurement. |
| Every observed value on the live site comes from a public API named under its exhibit; no observation bundles or typed-in figures. Boundary geometry is the one static input (`site/boundaries/`). | The owner requested runtime data, without downloaded static datasets; boundaries were approved as static geometry on 2026-10-24 because the boundary service fails about half its connections. |
| Jurisdictions follow the order of `regions.PT`: territories first, then west to east. | Coverage was requested one province or territory at a time, territories first; all thirteen are built. |
| Read Statistics Canada files through `analysis/statcan.py`. | The files mix UTF-8 and cp1252 bytes behind a byte-order mark; `text()` repairs them in one place. |

## The live model is written once

The website is `site/index.html`, `site/style.css` and ES modules in `site/js/`: `transport.js` (shared request cache,
concurrency, retries and errors), `api.js` (Census SDMX, WDS and OECD adapters), `model.js`, `regional-model.js`
and `trend-model.js` (pure calculation: findings, ranks, annual periods, similarity, sector base, shift-share), `census.js` (characteristic
identifiers per exhibit), `state.js` (URL state), `geo.js` (boundary files, maps, spatial services),
`ui.js` and `charts.js` (components and exhibits, each with a data table and CSV), and one module
per tool in `site/js/tools/`. `app.js` owns geography, history and lazy mounting. Docs/REFERENCE.md
is the visual and behavioural specification. Never relabel provincial observations as local values.

`tools/business.js` owns industry Business Counts reads and missing-cell rules; `tools/sectors.js` renders
resident-sector exhibits from plain profiles. Promise caches use `transport.memoRequest`: an old failed read
must not remove a replacement created by Refresh. Annual charts and their tables retain omitted calendar years.

`site/boundaries/` is quantized TopoJSON built by `tools/boundaries` (Rust) from the 2021 cartographic boundary
service; it holds geometry, DGUIDs and names only. `neighbours-<pr>.json` is derived from those files by the `neighbours`
binary of the same crate. Rebuild it only when the boundary vintage changes, and commit the
output: deployment does not run the builder.

Browser checks live in `tests/browser/` (`workflows.mjs`, `sweep.mjs`); they need `npm install`
and a Chromium-based browser and are run locally, not in CI.
`regressions.mjs` checks suppression and calendar gaps with synthetic inputs; `visuals.mjs` checks maps and charts.

`analysis/` is the historical offline implementation. Its size-class formula and classification
are comparison references; the live site does not run its fetch/build pipeline. Do not regenerate
or commit `site/data/*.js`. `site/classification.json` is taxonomy configuration, not observations.

## Code

Code transcribes the mathematics: symbol names from the documents, the problem stated in
each public docstring, loops whose condition is the stopping rule, comments that cite the
source. Mathematical outcomes are return values, not exceptions.

## Before a change is finished

```text
node --test tests/*.test.js
cargo test --release --manifest-path tools/boundaries/Cargo.toml
python -m pytest -q -m "not slow"
python -m ruff check .
python -m pip check
```

Run `tests/browser/workflows.mjs` and `sweep.mjs` for runtime-data or interaction changes, covering municipal selection,
shared URLs, missing data and source failure. Historical `-m slow` build checks require the old
download collection and apply only when changing that offline pipeline. A behavioural change
states its measured effect, jurisdiction and revision; do not claim exact reference parity
without a complete rendered comparison.
