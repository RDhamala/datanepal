# Quality checklist — existing tests as the template

`transform/tests/*.sql`, run via `dbt build`. Use this table both to know what's
already enforced and as a pattern for a new dataset's tests.

| Test | Category | Guards |
|---|---|---|
| `assert_dimension_members_are_declared` | Identity | An observation only uses dimension members that actually exist in `dimension_members` — extensible dimensions don't silently become free text. |
| `assert_nso_crosswalk_is_unique` | Identity | 1:many join hiding as 1:1 (see `datanepal-geography`). |
| `assert_place_hierarchy_is_acyclic` | Geography | Explicit `parent_place_id` chains never loop. |
| `assert_geography_completeness` | Geography | Known place counts (7/77/753) hold. |
| `assert_boundary_coverage` | Geography | Places that should have geometry have it. |
| `assert_nso_census_join_is_total` | Geography | No local unit silently fails to resolve through the census crosswalk. |
| `assert_census_local_units_reconcile` | Values / Time | Local-unit sums plus the institutional carve-out reconcile to the national total — turns a plausible-looking shortfall into a tested identity. |
| `assert_population_hierarchy_sums` | Values | Province sums = district sums = national total, for any bottom-up-built additive figure. |
| `assert_literacy_composition_sums` | Values | A composition's categories sum to its stated base population, zero tolerance. |
| `assert_literacy_statuses_are_exhaustive` | Values | Every population_5plus person is accounted for by exactly one literacy-status category. |
| `assert_observation_values_are_explained` | Values | A NULL value always carries a `status` that explains it (`suppressed`, `not_collected`) — a NULL with `status = actual` fails. |
| `assert_non_additive_indicators_are_flagged` | Values | An indicator that can't be summed (a rate) is actually marked `is_additive = false`, so nothing downstream sums it by accident. |
| `assert_no_licence_contamination` | Licensing | A share-alike source never feeds a table not itself marked share-alike. |
| `assert_rights_reviewed_before_publication` | Licensing | Nothing publishes from a source whose rights review hasn't cleared. |

## Adding tests for a new dataset

At minimum, cover:
1. A **shape** test (the connector's own boundary assertion, e.g. "N places",
   "M measures per place" — owned by `datanepal-ingestion` but worth a dbt-level
   test too, since the connector-level check only runs at ingest time)
2. A **uniqueness** test on the natural key
3. A **reconciliation** test against a real, external number if one exists
   (independent published total, known category exhaustiveness, a sum that
   should equal a parent's sum) — this is the highest-value test category,
   because it's the only one that catches "internally consistent but uniformly
   wrong"
4. A **non-additive flag check** if the indicator is a rate, ratio, or index

## Regression checks on refresh

Before trusting a refreshed dataset: compare row counts to the prior run
(explain any large swing), confirm no indicator present last time has silently
vanished, and spot-check at least one aggregate against its independently known
value the same way the literacy and population reconciliations were verified.
