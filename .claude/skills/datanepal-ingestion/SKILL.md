---
name: datanepal-ingestion
description: Use when adding a new source connector, ingesting a new dataset, modifying ingestion logic, creating or editing staging/intermediate/marts dbt models, updating a catalog entry for a source or table, or handling schema drift from an upstream source. Owns the source-to-canonical pipeline; for reconciling a source's geographic identifiers to the spine see datanepal-geography, for what to test see datanepal-data-quality, for whether a source is worth ingesting see datanepal-source-research (do that first).
---

# DataNepal ingestion

Full pipeline and layer rules: [`docs/architecture.md`](../../../docs/architecture.md)
§§2–4, and the "Adding a dataset" checklist in
[`CLAUDE.md`](../../../CLAUDE.md). This skill is the distilled, opinionated
version — read those for the reasoning behind each rule.

## Pipeline (don't skip a layer)

```
SOURCE → ingestion/sources/*.py (dlt) → raw_* tables → staging/ (view, rename+type+trim, no joins)
       → intermediate/ (canonical shape, conformance, crosswalks) → marts/ (public contract) → catalog + export
```

1. Connector in `ingestion/sources/`, registered in `ingestion/run.py`
2. Declare raw tables in `transform/models/staging/_sources.yml`
3. Staging model — rename, type, trim; **no joins here**
4. Conform to the spine — P-code, or a tested crosswalk (this is the step that
   matters: a dataset that doesn't conform can't be joined against anything,
   which defeats the point of centralising it — see `datanepal-geography`)
5. Union into `int_observations` in the canonical observation shape
6. Mart + dbt tests
7. `catalog/datasets/<table>.yml` — the export refuses to publish without one

## RAW is immutable

Preserve the original file/response, URL, retrieval timestamp, and source
metadata exactly as received. **Never manually "clean" a raw file.** Cleaning,
renaming, typing all happen in staging, where they're versioned and reviewable —
not by hand-editing what was actually received from the source.

## Validate shape at the boundary, not downstream

Every connector asserts against an **externally known expectation** before
yielding, because internal consistency alone has already produced a confidently
wrong dataset once on this project: the COD-PS top age band was spelled
`80Plus`, the ingest regex expected `80PL`, and 262,948 people over 80 were
silently dropped — place counts and the province/district hierarchy still
reconciled perfectly, because every file was missing the same cohort. It was
only caught by rendering the pyramid and counting the bars.

Concretely, existing connectors assert: `hdx_admin` → exactly 7 provinces, 77
districts, 753 local units; `hdx_population` → 54 measures per place;
`worldbank` → a minimum observation count; `wikidata_names` → a minimum row
count against the SPARQL result. A new connector needs its own version of this —
**a number derived from what the source is known to actually contain**, not from
what happened to load this time.

**A partial load is the failure mode to fear most**, because it raises no error
and produces no obviously-wrong row count — it just quietly under-reports, and
so does every figure derived from it.

## Source-specific mess stays inside the source boundary

Messy, source-specific logic is fine inside a connector or its staging model.
The actual requirement: **that mess must converge onto the stable canonical
contract** (the observation model in `docs/architecture.md` §4) by the time it
reaches `intermediate/`. Don't expect every dataset to need exactly one
connector and one crosswalk — some need none (already P-coded), some need a
real crosswalk, and the NSO census needed a fully-reasoned name-matching
exception (owned by `datanepal-geography`).

## Determinism and idempotence

Transformations should be reproducible and safe to re-run. The revision system
depends on this: **only a change in `value_numeric`, `value_text`, or `status`
creates a new revision row.** Re-running the pipeline against unchanged source
data must produce zero new revisions — if it doesn't, something in the pipeline
isn't actually deterministic, and history fills with noise instead of signal.

## Schema drift

Detect meaningful upstream changes and **fail loudly**, don't silently
reinterpret a changed column, unit, or code. If a source changes shape, that's a
test failure, not a quiet remap.

## Licensing gate

Don't ingest and publish anything whose `rights_review_status` hasn't cleared
review (see `datanepal-source-research` for the fields). Licence precedence
across sources feeding one table is mechanical and enforced —
`cc0-1.0 < cc-by-4.0 < cc-by-igo-3.0 < gov-open < cc-by-sa-4.0 < odbl-1.0 <
unknown` — the most restrictive wins, automatically, at export. `unknown` is a
real, legitimate value when a source states no licence; never guess one to fill
the field.

## Testing

Every new connector/model needs its own shape, null, uniqueness, and
referential-integrity tests, plus source-specific invariants (see the
`80Plus`/`80PL` example above for why "it built successfully" isn't enough).
Full testing philosophy and what's already enforced: `datanepal-data-quality`.

## Environment

Behind a TLS-inspecting corporate proxy — `httpx` ignores the conventional CA
env vars, so every connector calls a local `_verify()` helper honouring
`REQUESTS_CA_BUNDLE`. Follow that existing pattern in any new connector rather
than reinventing TLS handling per source.

## Reference

[`references/pipeline-conventions.md`](references/pipeline-conventions.md) — the
canonical observation model fields and what each one is for, for when you're
deciding how a new dataset maps onto it.
