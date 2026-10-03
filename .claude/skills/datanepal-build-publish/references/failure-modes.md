# Build and publish failure modes

Ordered by how often they have actually happened here.

## 1. Stale `publish/dist` (silent)

**Symptom.** A dbt model change is live in the warehouse, but web tests,
`next build`, and any rendered page show the old values — or, if a column was
added, fail in ways that look like application bugs (`expected [] to have
length 77`).

**Cause.** `web/lib/data.ts` sets `DIST = ../publish/dist`. It never reads the
warehouse. Nothing in the web build knows the warehouse moved on.

**Fix.** `make publish`. **Prevention.** Treat `make build` without
`make publish` as an incomplete action whenever the change needs to be visible
to `web/`.

## 2. Partial load (silent, the one to fear)

**Symptom.** None. Row counts look plausible, hierarchies reconcile, every test
passes.

**Real case.** The COD-PS top age band is spelled `80Plus`; the ingest regex
expected `80PL`, so 262,948 people over 80 were dropped. National, province and
district figures still reconciled — every file was missing the same cohort. It
was caught by rendering the chart and counting the bars.

**Detection.** Assert against externally known expectations, never internal
agreement: 7 / 77 / 753 / 54, the census totals, and per-source row counts that
should be stable between refreshes. A refresh that changes a count by a few
percent with no upstream announcement is a finding.

## 3. Catalog and seed desync

**Symptom.** `dbt run` fails on a missing seed column, or `publish.export`
refuses a table that visibly has a catalog entry.

**Cause.** `catalog/` is the single source of truth and is *projected* into dbt
seeds by `catalog.sync_seeds`. Editing a catalog YAML without re-projecting
leaves dbt reading the old projection.

**Fix.** `make catalog`, which `make build` already does for you — so this
mostly bites when a bare `dbt run` was used instead of the Make target.

## 4. Schema drift from upstream

**Symptom.** A connector's shape guard fails on a refresh that previously
worked.

**This is working as designed.** Fail loudly at ingestion rather than
propagating a changed shape into the marts. Scale the guard to what the source
actually has now (see `Scale the World Bank connector's shape guard to the
indicators it actually has`), and record the change — do not widen the guard
until it stops complaining.

## 5. A new mart that will not publish

**Symptom.** `publish.export` exits refusing the table.

**Cause, in order of likelihood.** No `catalog/tables/<table>.yml`; the entry
omits source, licence, vintage or caveats; `contains_personal_data` is missing
or true (the schema requires false); the licence string is not one the rank
table knows.

Where a source states no licence, record `unknown` — never guess. `unknown` is
the most restrictive rank and will correctly constrain anything downstream.

## 6. Network and proxy

**Symptom.** `make ingest` fails with certificate errors; `make build` is fine.

**Cause.** `httpx` ignores `REQUESTS_CA_BUNDLE` and `UV_NATIVE_TLS` by default.
Connectors must route through the shared `_verify()` helper; a new connector
that builds its own client will fail here and only here.
