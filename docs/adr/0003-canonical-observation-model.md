# ADR-0003: One observation model with extensible dimensions

**Status:** Accepted · 2026-08-23 · Supersedes the initial fixed-column design

## Context

The first fact table carried `sex` and `age_band` as real columns:

```
place_pcode · admin_level · indicator_code · period · sex · age_band · value · unit · source_id
```

That was defensible while population was the only dataset. Stress-tested against
eight realistic future dataset types, it failed seven:

| Dataset | Failure |
|---|---|
| National monthly inflation | `period` is an integer year; `sex`/`age_band` meaningless nulls |
| Remittance inflows | no currency, no current-vs-constant price basis |
| Federal budget by category | no dimensions; Nepali fiscal year spans two Gregorian years |
| Election candidate results | no dimensions; winner is categorical, not numeric |
| School counts by type | no dimensions (level, management) |
| Health facility counts | no dimensions (facility type, ownership) |
| Commodity prices | no dimensions, no currency, sub-annual periods |

Adding a column per dimension produces a table of dozens of mostly-null columns
where each dataset invents its own incompatible subset.

## Decision

A narrow universal fact table plus a long dimension table.

- Dimensions live in `observation_dimensions`, validated against
  `dimension_members`. A new dataset adds members, never columns.
- `dimension_key` — a sorted fingerprint like `age_band=all|sex=female`, or
  `none` — sits on the fact so duplicate detection and page filtering need no
  join.
- `period_start` / `period_end` are dates with a `period_type` discriminator.
- `value_numeric` and `value_text` are separate; some observations are
  categorical.
- Currency and price basis are attributes of `unit_id`, not their own columns:
  `usd_current` and `usd_constant_2015` are different units.
- `status` distinguishes suppressed from zero from unobserved.
- `place_id` is nullable.
- `is_additive` on `indicators` records whether summing across places is
  meaningful.

## Consequences

**Good.** All eight shapes are representable. A new dataset needs a connector, a
staging model, and dimension members — no schema migration. One frontend
component renders any indicator. Invalid dimension members fail the build.

**Costs.** Reconstructing a wide view of one dataset requires a join or a
`dimension_key` match. Totals coexist with components (`sex='all'` alongside
`'female'`), so consumers must filter rather than sum — the standard long-format
trade-off, cheaper than materialising every rollup. `dimension_key` duplicates
information held in `observation_dimensions`, deliberately.

**Reversal cost.** Very high. Every dataset and every consumer depends on this
shape. Getting it wrong at dataset two costs a rewrite; at dataset twenty it
costs a rewrite plus every downstream integration.

## Alternatives rejected

**Generic slots** (`dim1_key`, `dim1_value`, …): a fixed arbitrary limit, and
meaningless column names.

**A JSON or MAP column for dimensions:** queryable in DuckDB, but validation
becomes awkward and Parquet MAP support across readers is uneven. The long table
gives a plain foreign key, which is what makes the validation test trivial.

**Per-dataset fact tables:** each dataset stays ergonomic, but nothing is
comparable across datasets, which is the entire point of the platform.
