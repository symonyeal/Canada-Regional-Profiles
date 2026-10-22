# Decisions

## 2026-10-22: query the source when the page is used

The owner requested runtime public data, national and local coverage, and a push to main. The website now queries Census Profile SDMX and Statistics Canada WDS directly from the browser. Both services accepted the GitHub Pages origin during probes. No backend, account, secret, generated data bundle or persistent browser data store is required.

The former `site/data/*.js` files were removed from the served tree. Their originals and the previous presentation were archived locally under `Useful Misc/_archive/20261022-canada-static-draft/site`; Git history retains the published revision. The old Python analysis remains available explicitly as an offline reference, outside the live application path.

## Geography follows source identifiers

Census DGUIDs select profiles. WDS classification codes match Business Register geographies. Display names are never join keys. Province/territory order retains the draft's territories-first, west-to-east order. Metro areas can cross provincial borders; their source membership controls filtering.

The selected local geography carries through navigation. A provider's unsupported area is labelled unavailable, or receives a labelled Census sector view. Provincial data are never shown under a municipal label.

## Missing values and sparse business series

Blank or absent Census observations remain missing. WDS omits zero series in Business Counts. Missing size-class cells are inferred as zero only when either their published row total equals the sum of published nonnegative classes, or their published class subtotal equals the sum across the complete same-level industry partition. Otherwise the estimate remains unavailable. No source error is converted into a zero profile.

## Industry estimates preserve the draft's constants

Employee estimates use class midpoints and 500 for each 500+ location. A positive open-class count gives an unbounded upper estimate. Traded/local uses the draft's longest-prefix US mapping with Canadian national employment weights. The lists contain taxonomy rules only. The growth-rate baseline threshold is adjustable and defaults to the draft's 20 estimated employees.

Business Counts releases are discovered from the current catalogue, with the same June/December release five years earlier as baseline. Recoded industries remain unmatched. LQ uses the complete same-level national partition before display or trade filters.

## Dates describe observations

Census observations retain their 2021 date and income retains its 2020 date. LFS and quarterly population observations show their published periods. PSIS dates describe school-year enrolment observations, not graduation or a municipal population. Retrieval time is shown separately.

## Independent visual implementation

The reference's nine embeds were inventoried. Direct inspection failed on this network; the incoming reference reconstruction supplied chart definitions and recorded responses. The implementation uses those definitions with public services, charts, tables, controls, source links and CSV exports. Exact visual parity remains unverified. OAG schedules, proprietary classifications, custom area aggregations and an unverified broadband aggregate are not invented.

## Request lifetime

A render owns its own DOM root. Navigating replaces that root, and late results cannot replace the newer selection. In-flight requests share a memory cache, failed requests are evicted, timeouts and retries are bounded, and map requests are capped. The shared URL preserves geography, comparison and module controls.


## Incoming reference reconstruction retained

During this work origin/main advanced to a467cad. It added recovered chart definitions, a reference fixture and expanded historical analysis. The live client was rebased onto that revision; the analysis, source records and fixtures remain. Incoming generated observations were removed from the served tree, with the entire incoming revision retained in local evidence and Git history.

The live industry default follows the recovered SEPH definition. Its industrial aggregate including unclassified businesses supplies LQ denominators. Largest industries use a sector treemap, fastest-growing industries use employment/growth bubbles, and workforce uses the recorded education denominators and resident-labour-force universes. Business Register estimates remain separate. Target maps sum only one active marginal distribution; they do not manufacture joint income/age counts.

The ECCC collection's metadata identifies 1981-2010 normals. The live site shows that period and the selected station rather than repeating the earlier intended 1991-2020 label. Facility maps use live OSM queries instead of a downloaded ODEF file; exact school-name matches are explicit, and no campus allocation is inferred.
