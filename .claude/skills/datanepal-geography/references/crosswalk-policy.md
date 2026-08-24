# Crosswalk test policy

Existing tests, and what each guards — model any new crosswalk's tests on these:

| Test | Guards against |
|---|---|
| `assert_nso_census_join_is_total` | Any local unit failing to resolve through the census crosswalk — a silent partial join, the failure mode called out in `datanepal-ingestion` as the one to fear most. |
| `assert_nso_crosswalk_is_unique` | A 1:many join hiding as 1:1 (caught the Wikidata names crosswalk producing 755 rows for 753 places). |
| `assert_place_hierarchy_is_acyclic` | An explicit `parent_place_id` chain looping — a real risk once parents are explicit keys rather than P-code substrings, since a substring hierarchy can't cycle but an explicit-key one can. |
| `assert_boundary_coverage` | Every place that should have geometry actually has it. |
| `assert_geography_completeness` | The known place counts (7 provinces, 77 districts, 753 local units) actually hold. |
| `assert_census_local_units_reconcile` | Local-unit sums plus the institutional-population carve-out reconcile to the district/national total — the accounting identity that makes "local units sum to 28,925,480, not 29,164,578" a tested fact rather than a silent shortfall. |
| `assert_population_hierarchy_sums` | Province sums equal district sums equal the national total for population — the general form of the reconciliation technique used for literacy, budget aggregates, or any other additive figure built bottom-up. |

## Writing a new crosswalk's tests

At minimum:
1. **Totality** — every source row (or every canonical place expected to have a
   source row) resolves. Fail the build, don't warn.
2. **Uniqueness** — one source id maps to exactly one `place_id`, and vice versa
   unless the crosswalk is genuinely many-to-one (document why if so).
3. **Type agreement**, if the source encodes a place type — cross-check it
   against `places.place_type` rather than trusting one side blindly.
4. **A seed file for named exceptions**, if any exist, each row commented with
   why it couldn't resolve automatically. A seed file with an unexplained row is
   a future maintainer's mystery.
