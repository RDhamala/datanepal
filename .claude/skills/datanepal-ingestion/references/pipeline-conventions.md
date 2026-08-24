# Canonical observation model — mapping a new dataset onto it

Full rationale: [`docs/adr/0003-canonical-observation-model.md`](../../../../docs/adr/0003-canonical-observation-model.md)
and `docs/architecture.md` §4. This file is the quick "which field does my new
dataset's weird bit go in" reference.

```
observations
  observation_id    deterministic hash of the natural key — don't invent a
                     surrogate sequence; two runs must produce the same id
  dataset_id        → datasets (provenance, licence)
  indicator_id      → indicators (meaning, unit policy, additivity)
  place_id          → places, NULLABLE — not every measurement is geographic
  period_start/end  dates, not integer years — a fiscal year (mid-July to
                     mid-July) or a weekly commodity price can't be a bare year
  value_numeric / value_text   one or the other; value_text for something like
                     a winning party name
  unit_id           → units — currency and price basis live here (usd_current
                     vs usd_constant_2015 are different units, never a shared
                     unit with a flag)
  status            actual | provisional | estimate | projection | forecast |
                     suppressed | not_collected — a NULL with status=suppressed
                     is information; a NULL with status=actual is a bug
  dimension_key     sorted fingerprint, e.g. age_band=all|sex=female, or "none"
```

**Dimensions are data, not columns.** A new dataset that needs a breakdown
(ministry, candidate, commodity, facility type) adds rows to `dimension_members`
via `observation_dimensions` — it never adds a column to the fact table. This is
what let census, budget, election, school, health, and commodity-price data all
validate against one schema without a single dataset-specific column.

**`is_additive` on the indicator** is the guard against the single most common
way to produce a confidently wrong number: summing a rate, or unweighted-averaging
a per-capita figure across places. Set it correctly when adding an indicator —
`datanepal-data-quality` and `datanepal-dataviz` both depend on it downstream
(rates can't be totalled in `ComparePanel`, can't be summed to a national figure
without recomputing from components — see the `census_literacy_national`
pattern in `datanepal-topic-page`'s reference).

## Already-validated dataset shapes

If your new dataset resembles one of these, the pattern for representing it is
proven — don't redesign it:

local-level census population · national monthly inflation · remittance inflows
· federal budget by category (hierarchical `parent_member_id`, unused so far but
supported) · election candidate results (`value_text` for a winning party) ·
school counts by type · health facility counts · commodity prices over time.

Not yet loaded even though the schema supports them: electoral constituencies
and market points as place types, hierarchical dimension members, historical
geography crosswalks.
