---
name: datanepal-data-quality
description: Use when adding dbt tests for a dataset, reviewing a newly ingested dataset before it publishes, validating a data refresh or revision, debugging a suspicious or unexpectedly changed value (e.g. "why did population drop after the refresh"), or deciding whether published data is safe to ship. Owns validation and the publication gate; datanepal-ingestion owns building the pipeline, datanepal-geography owns join correctness specifically.
---

# DataNepal data quality

**"The pipeline ran successfully" is not the definition of quality.** This
project has already shipped a case where every internal consistency check
passed and the data was still wrong — see below. Quality means structural,
semantic, geographic, temporal, and provenance correctness together, checked
against something *external* to the pipeline, not just against itself.

## The founding lesson

The COD-PS top age band is spelled `80Plus`; the ingest regex expected `80PL`,
silently dropping 262,948 people over 80. Place counts were correct. The
national/province/district hierarchy still reconciled — **because every file
was missing the same cohort, so internal agreement was satisfied by uniformly
wrong data.** It was caught by rendering the age pyramid and counting the bars,
not by a passing test suite. The rule this produced: **assert against
externally known expectations** — 7 provinces, 77 districts, 753 local units, a
known measure count per place, a known national total — never only internal
agreement.

## Standard checks

Full checklist: [`references/quality-checklist.md`](references/quality-checklist.md).

- **Identity** — unique source ids, valid canonical ids, no ambiguous crosswalk
  entries (see `datanepal-geography`)
- **Observations** — valid indicator/unit/period/dimension combination, no
  unintended duplicates on the natural key
- **Values** — null behaviour matches `status` (a NULL with `status=suppressed`
  is information; a NULL with `status=actual` is a bug), impossible ranges,
  percentages outside 0–100 where that's meaningful, subtotals/totals
  reconciling
- **Geography** — valid parents, expected entity counts, no orphans, correct
  level
- **Time** — expected periods present, no duplicate periods, revisions handled
  as revisions not new rows (see `docs/adr/0004-revision-history.md`)
- **Provenance** — every observation traces to a dataset, a catalog source
  entry, and (transitively) a publisher
- **Licensing** — `rights_review_status` cleared before anything derived from
  the source is published
- **Regression** — no unexplained major row-count swing, no indicator that
  silently disappeared, no implausibly large jump

## Distinguish invalid / suspicious / plausible

Don't blindly fail the build on every statistical anomaly, and don't wave every
anomaly through either. Two real, opposite examples from this project:

- **A real, explainable drop that looks alarming**: local-unit population sums
  to 28,925,480 against a national total of 29,164,578 — a 239,098 gap. This is
  correct: institutional population (barracks, hostels, prisons, hospitals)
  belongs to no local unit and is carried at district level as
  `residence_type = institutional`. `assert_census_local_units_reconcile` turns
  this from "looks like missing data" into a tested accounting identity.
- **A drop that looked fine and wasn't**: the `80Plus`/`80PL` case above — no row
  count anomaly, no failed test, just quietly wrong.

The distinguishing move is the same both times: **reconcile against an
independent, external figure** (NSO's own published national rate, a known age
distribution, a known place count) rather than trusting that the pipeline's own
numbers agreeing with each other means they're right.

## Publication gate

`publish/export.py` refuses to publish a table with no catalog entry. A critical
test failure must block publication outright; a warning-level anomaly should
surface clearly (in the build output, in the catalog caveats) rather than being
silently absorbed. Never publish a value because "the pipeline finished" if a
test is failing on it.

## Reference

[`references/quality-checklist.md`](references/quality-checklist.md) — the
concrete `assert_*` tests already enforced (`transform/tests/`) mapped to what
each one guards, as a template for writing new ones on a new dataset.
