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

The runtime is `site/index.html`, `site/style.css` and ES modules in `site/js/`. `transport.js` owns request caching,
concurrency, retries and errors; `api.js` owns source formats, series, cohorts and industry reads. Views do not
cache derived source results and hold no table coordinates or members. `model.js`, `regional-model.js` and
`trend-model.js` are pure calculations; `model.js` also owns province identifiers (`provinceGeo`, `provinceOf`).
`census.js` defines characteristic identifiers and bins and imports no model. `ui.js` owns DOM components, icons,
async slots and keyboard search; `charts.js` draws exhibits; `geo.js` owns maps and every file in
`site/boundaries/`; `state.js` validates URLs. View modules live in `tools/`; `profile.js` includes resident-sector exhibits. `app.js` owns navigation,
geography and lazy mounting. Never relabel provincial observations as local values.

Refresh clears the request cache before updating views. Pending-request caches use `transport.memoRequest`:
an old failure cannot remove a replacement. Annual charts and their tables retain omitted calendar years.
Docs/REFERENCE.md records the original reference; later interface decisions are in docs/DECISIONS.md.

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
