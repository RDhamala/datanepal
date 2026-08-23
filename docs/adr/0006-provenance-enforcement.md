# ADR-0006: Provenance enforced at the publication boundary

**Status:** Accepted · 2026-08-23

## Context

An aggregate with no stated source, licence, or reference period is not citable,
and citability is most of what separates a data platform from a collection of
charts. Documentation that is merely encouraged drifts, and provenance that has
drifted is worse than provenance that is absent, because it still looks
authoritative.

The first implementation attached provenance to each *published table*. That
conflates two different things: a source dataset (COD-AB) can feed several
published tables (`places`, `geography`, `protected_areas`), and a table can draw
on several sources.

## Decision

Provenance attaches to the **source dataset**, in `catalog/sources/*.yml`:
publisher, URL, licence, retrieval date, vintage, methodology, whether the
publisher revises published values.

Published tables declare which sources they draw on, in
`catalog/tables/*.yml`. `catalog/sync_seeds.py` projects both into dbt seeds, so
there is one source of truth and dbt can join against it.

Enforcement, not encouragement:

- `publish/export.py` **refuses to publish** a table with no catalog entry.
- Every observation's `dataset_id` is a tested foreign key to `datasets`.
- Every dataset's `licence_id` is a tested foreign key to `licences`.
- Every indicator must have a unit and an explicit additivity policy.
- JSON Schemas validate both catalog directories; CI runs the validator.

The chain is therefore: published observation → dataset → publisher, URL,
licence, retrieval date — with each link a constraint rather than a convention.

## Consequences

**Good.** Adding a dataset without documenting it is not possible; the build
fails. The manifest exposes full provenance to consumers, so citation does not
require reading the repository. Every figure on the site can name its publisher,
period, and retrieval date.

**Costs.** Friction when adding a source — a YAML file is required before
anything publishes. That friction is the point. `sync_seeds.py` must run before
dbt, which is one more build step to remember (it is in the Makefile and CI).

**Reversal cost.** Low mechanically, high culturally. Removing the enforcement is
a few lines; re-establishing the discipline after a period of undocumented
datasets means auditing everything already published.

## Notes

`unknown` is a valid licence value and is ranked maximally restrictive. Recording
"we could not find the terms" is honest; guessing is not. `gov-open` marks
government data published without explicit terms — treated as reusable with
attribution, and flagged to users as unverified.
