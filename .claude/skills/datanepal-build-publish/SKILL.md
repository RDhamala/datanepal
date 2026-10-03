---
name: datanepal-build-publish
description: Use whenever a change touches transform/, ingestion/, catalog/ or seeds and you need the result to actually exist -- running make build, make publish or make all, rebuilding the warehouse, re-exporting publish/dist, debugging "my dbt model changed but the site/test still shows the old number", deciding whether a refresh needs re-ingestion, or committing regenerated publish/dist. Also use before claiming any data-side change is verified, because web tests and next build read publish/dist and will silently pass against the previous build. Owns the pipeline run loop and the publication gate's mechanics; datanepal-ingestion owns writing the models, datanepal-data-quality owns what to assert.
---

# DataNepal build and publish

**The single most expensive mistake in this repo is editing a model and then
trusting a test that read the previous build.** `web/lib/data.ts` points at
`publish/dist/`, not at the warehouse. Change `int_places.sql`, run vitest, see
green — you have proved something about August's data. A change is not real
until it has been through `make build && make publish`.

That is not hypothetical: the ADR-0008 temporal-place work added an
`is_current` column, `places()` began filtering on it, and 21 of 55 web tests
failed with `expected [] to have a length of 77` purely because `publish/dist`
predated the model change.

## The pipeline

```
catalog ──► ingest ──► build ──► revisions ──► publish
   │           │          │          │            │
 catalog/   sources    dbt seed   append-only   publish/dist
 → seeds    → duckdb   run, test   history      parquet + json
```

Everything is a Make target; read the `Makefile` rather than reconstructing the
commands. `make all` is the whole chain and is what the monthly GitHub Action
runs.

## What to run, given what you changed

Pick the shortest chain that makes your change real. Re-ingesting is not free —
it hits every upstream source over the network, behind a TLS-inspecting proxy,
for data that usually has not changed.

| You changed | Run | Why |
|---|---|---|
| A dbt model, test, or macro | `make build` | Warehouse is already on disk; this re-runs and re-tests against it |
| A seed CSV | `make build` | `dbt seed` is part of the target |
| `catalog/**/*.yml` | `make build` | The target runs `catalog` first, projecting YAML into seeds |
| A connector in `ingestion/sources/` | `make ingest && make build` | Only path that re-reads the source |
| Anything above, and you need the site or web tests to see it | append `&& make publish` | `publish/dist` is what `web/` reads |
| Only `web/**` | nothing here | `cd web && npm run check` |

`make revisions` folds the current build into append-only history. Run it as
part of `make all` on a real data refresh; skip it for model-shape changes that
do not alter values, since it writes to a committed artefact.

Avoid `make clean` unless you intend to re-ingest everything — it deletes the
warehouse, and rebuilding it means pulling every source again.

## Verifying, not assuming

`dbt test` passing means the assertions held. It does not mean the numbers are
right, and it does not mean `publish/dist` was regenerated. After a build that
matters, check the externally-known counts rather than internal agreement:
**7 provinces · 77 districts · 753 local units · 54 measures per place**, and
the census national total 29,164,578 against the local-unit sum 28,925,480.
See `datanepal-data-quality` for the full gate.

Two cheap confirmations that the export actually happened:

- `ls -la publish/dist/` — the mtimes should be from this run, not last month's.
- `git diff --stat publish/dist/` — a shape change should show here. *No diff
  after a model change that should have altered values is a finding, not a
  relief.*

Then run the side that consumes it: `cd web && npm test`.

## The publication gate

`publish/export.py` enforces two things rather than documenting them, and both
surface as a refusal to publish rather than a warning:

1. **No catalog entry, no publication.** A new mart needs
   `catalog/tables/<table>.yml` with source, licence, vintage, caveats, and
   `contains_personal_data: false`. Adding the model is not the last step.
2. **Licence is computed, never restated.** The effective licence of a table is
   derived from the sources feeding it, most restrictive winning. If a
   share-alike source ever reaches a table, the manifest says so whether or not
   anyone remembered.

`publish/dist` is **committed on purpose** (see `docs/adr/0001`): it gives
published figures a version history and lets Cloudflare Pages build with Node
alone. It is still a generated artefact — regenerate it, never hand-edit it.

## Environment

Python 3.12 (3.14 breaks dbt) and `dbt-core` pinned below 1.10; the venv
currently holds 1.9.11 and the "update available" notice is not an invitation.
Behind the corporate proxy, connectors honour `UV_NATIVE_TLS` and
`REQUESTS_CA_BUNDLE` through a `_verify()` helper because `httpx` ignores both
by default — these are set in `.claude/settings.local.json`.

## When a build fails

Read `references/failure-modes.md` for the recurring ones — partial loads,
schema drift, `catalog`/seed desync, and the "tests pass but dist is stale"
case above. The one worth internalising here: **a partial load raises no error
and produces no obviously wrong row count.** It under-reports quietly, and so
does every per-capita figure derived from it. That is why the counts above are
asserted rather than eyeballed.
