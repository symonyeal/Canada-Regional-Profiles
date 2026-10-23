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
| Every observed value on the live site comes from a public API named under its exhibit; no observation bundles or typed-in figures. | The owner requested runtime data, without downloaded static datasets. |
| Jurisdictions follow the order of `regions.PT`: territories first, then west to east. | Coverage was requested one province or territory at a time, territories first; all thirteen are built. |
| Read Statistics Canada files through `analysis/statcan.py`. | The files mix UTF-8 and cp1252 bytes behind a byte-order mark; `text()` repairs them in one place. |

## The live model is written once

The website is `site/index.html`, `site/style.css` and ES modules in `site/js/`: `api.js` (requests,
retries, Census SDMX and WDS adapters), `model.js` (pure calculation), `census.js` (characteristic
identifiers per exhibit), `state.js` (URL state), `geo.js` (boundaries, maps, spatial services),
`ui.js` and `charts.js` (components and exhibits, each with a data table and CSV), and one module
per tool in `site/js/tools/`. `app.js` owns geography, history and lazy mounting. Docs/REFERENCE.md
is the visual and behavioural specification. Never relabel provincial observations as local values.

Browser checks live in `tests/browser/` (`workflows.mjs`, `sweep.mjs`); they need `npm install`
and a Chromium-based browser and are run locally, not in CI.

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
python -m pytest -q -m "not slow"
python -m ruff check .
python -m pip check
```

Run `tests/browser/workflows.mjs` and `sweep.mjs` for runtime-data or interaction changes, covering municipal selection,
shared URLs, missing data and source failure. Historical `-m slow` build checks require the old
download collection and apply only when changing that offline pipeline. A behavioural change
states its measured effect, jurisdiction and revision; do not claim exact reference parity
without a complete rendered comparison.
