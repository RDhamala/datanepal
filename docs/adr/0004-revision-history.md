# ADR-0004: Append-only revision history in a committed file

**Status:** Accepted · 2026-08-23

## Context

Sources restate figures. The World Bank revises national accounts — its API
reports a `lastupdated` date per indicator. UNFPA reprojects populations.
Budgets move from provisional to final.

A refresh that overwrites the previous value destroys the ability to answer
"what did this say before, and when did it change?" That is both a credibility
requirement for a statistics platform and, per `docs/product.md`, a capability
that **cannot be reconstructed later**. History either starts being captured now
or it does not exist.

The obvious mechanism — dbt snapshots — requires a database that persists
between runs. The warehouse is rebuilt from scratch every build, so it cannot
hold history.

## Decision

Maintain an append-only Parquet file, `history/observation_history.parquet`,
committed to git. One row per `(observation_id, revision)`.

`publish/revisions.py` folds each build into it: unchanged observations are left
alone, changed ones get `revision + 1` with the previous row marked
`is_current = false` and stamped `superseded_at`.

Only `value_numeric`, `value_text`, or `status` changing creates a revision. A
change in unit or period is a *different observation* with its own id.

## Consequences

**Good.** Git provides the audit trail for free — every value change is a
reviewable diff, attributable to a commit and a date. No database to operate.
Re-running the pipeline is idempotent. History is published, so consumers can use
it too.

**Costs.** The history file grows monotonically and is committed, so it
contributes to repository weight — the trigger to move `publish/dist` and history
to object storage is ~100 MB. Revision detection is a full comparison of the
current build against history, which is fine at millions of rows and would need
partitioning far beyond that.

**Reversal cost.** Low to change mechanism, **infinite to backfill**. Switching
to a database-backed approach later is straightforward. Recovering history not
captured is impossible. That asymmetry is why this was built during an
architecture pass rather than deferred to when a revision first arrives.

## Notes

`published_at` records the publisher's own vintage date where supplied,
distinguishing "the publisher restated this" from "we noticed it later". Five
tests cover first-load, idempotence, detection with preservation,
single-current-revision, and status-only changes.
