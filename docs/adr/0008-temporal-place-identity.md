# ADR-0008: Places are valid over an interval, and successions are data

**Status:** Accepted · 2026-09-01 · Extends [ADR-0002](0002-canonical-geography-identity.md)

## Context

ADR-0002 put `valid_from`, `valid_to` and `superseded_by_place_id` on `places`
and left them NULL, deliberately: carrying the columns cost nothing and avoided
a migration that would touch every observation later. That bet is now due.

Nepal's geography changed twice in living memory, and the platform cannot
currently represent either change:

- The 2015 constitution created seven provinces and split two districts —
  Nawalparasi into Nawalparasi East (Gandaki) and Nawalparasi West (Lumbini),
  Rukum into Rukum East (Lumbini) and Rukum West (Karnali). Nepal went from 75
  districts to 77.
- The 2017 restructuring replaced 3,915 VDCs and 58 municipalities with local
  units, gazetted as 744 on 10 March 2017 and later revised to 753.

Today the spine has exactly one geography: the current one. Three consequences,
in increasing order of seriousness.

**Pre-2017 data cannot be ingested at all.** The 2011 census, historical
budgets, and past election results key on places that do not exist in `places`.
There is nowhere to put them. Every one of those is a dataset the platform
should eventually hold.

**A place that changes has no way to say so.** If OCHA merges two rural
municipalities in a future revision, the current model can only delete a row.
The observations attached to it would fail their foreign key, and the fact that
the place ever existed would be gone from a platform whose entire premise is
that superseded values are kept with the date they were replaced (ADR-0004).
Revision history for values and amnesia for places is not a coherent position.

**"77 districts" is asserted, not dated.** `assert_geography_completeness`
compares against `np_provinces.expected_districts`. That test is correct today
and silently means "77 as of now" — it has no way to express that 75 was also
correct, before 2015.

## Decision

Three things, in the order they depend on each other.

**1. Every place carries a validity interval.** `[valid_from, valid_to)`,
half-open. `valid_to IS NULL` means currently valid. `valid_from IS NULL` means
valid for every period this platform covers — used only for the country, which
must accept World Bank series back to 1960.

Defaults are seeded per admin level in `place_validity.csv` with the instrument
that created them, rather than hardcoded in SQL, because they are facts with
citations and one of them is uncertain (see Consequences).

**2. Places that no longer exist stay in `places`, flagged.** `is_current` is
derived from the interval, not stored independently — a second source of truth
for the same fact is how the two drift. Historical places live in
`historical_places.csv` and are unioned into `int_places` in the same shape as
current ones, so they get the same surrogate-id derivation, the same tests, and
the same crosswalk layer.

They are seeded rather than derived because no source publishes them: the COD
carries current geography only. Two rows to start — the pre-2015 Nawalparasi and
Rukum districts — which is enough to exercise every part of the model against
real, verifiable history rather than a hypothetical.

**3. Successions are an edge table, not a column.** `place_successions` holds
one row per (predecessor, successor) with a type and an effective date. A split
is one predecessor and several successors; a merge is the reverse. A column
cannot express either.

`superseded_by_place_id` stays on `places` and becomes *derived*: the single
successor where a place has exactly one, NULL otherwise. It is a convenience for
the 1:1 rename case, and the edge table is authoritative.

**`place_successions` records the relationship and refuses to invent the
number.** `share_basis` and `share_value` exist for the case where the split is
exact — a whole VDC moving intact into one new local unit is `share_value = 1.0`
on basis `whole_unit`. Where apportioning a predecessor's value across
successors would require estimation, `share_value` is NULL and stays NULL.
Old Nawalparasi's 1991 population cannot be divided between East and West
without a model, and this platform does not publish modelled figures beside
enumerated ones without saying so. Consumers who want an apportionment can build
one from the edges; they will not find one here presented as fact.

## Alternatives considered

**A separate `places_historical` table.** Nothing current breaks, which is the
appeal. Rejected: successions would span two tables, so every query about
lineage becomes a union, and the crosswalk layer would need duplicating. Worse,
it makes "is this place current" a question of which table you read, which is
exactly the kind of implicit knowledge the surrogate-id design exists to remove.

**Type 2 slowly-changing dimension on `places`, one row per version.** The
standard warehouse answer, and wrong here. It conflates two different events: a
place whose *attributes* changed (a rename) and a place that *ceased to exist*
and was replaced by others (a split). Only the first is a new version of the
same thing. Modelling a split as a version implies an identity across the change
that does not exist.

**Apportioning historical values onto current geography at ingestion.** This is
what most such platforms do, and it is the reason their district-level history
cannot be reconciled with anyone else's. The estimate becomes indistinguishable
from the source figure three tables downstream. Rejected on the same grounds as
`status = 'projection'`: the platform's value is that a reader can tell what
kind of number they are looking at.

## Consequences

**Good.** Pre-2017 datasets have somewhere to land. A future OCHA merge is a
recorded event rather than a deleted row. Lineage is queryable in both
directions, so "what is Nawalparasi now" and "what was Nawalparasi West before"
both have answers. `place_valid_at()` lets a consumer ask for the geography of
any date.

**Costs.** `places` now contains rows most consumers do not want. Every
current-facing mart and the web layer must filter, and forgetting to is a silent
error that shows up as an extra map feature or a 404 page that should not exist.
That is mitigated by making `places()` in `web/lib/data.ts` return current
places by default — the filter is opt-out, not opt-in — and by
`assert_current_marts_exclude_historical_places`, which fails the build if a
historical place reaches `geography`, `place_boundaries`, or `protected_areas`.

**One date is not verified.** 744 local units were gazetted on 10 March 2017 and
the count later became 753. The gazette date for the additional nine, all in
Madhesh, was not established at the time of writing. All 753 therefore carry
`valid_from = 2017-03-10`, which is right for 744 of them and possibly early for
nine. It is recorded as a caveat on the seed and in `catalog/tables/places.yml`
rather than papered over. Nothing currently depends on it — the earliest
local-unit observation is the 2021 census — but it should be corrected from the
gazette rather than inferred.

**Pre-federal districts have no parent.** Before 2015, districts nested under 14
zones and 5 development regions, which this platform does not model. Their
`parent_place_id` is NULL rather than pointed at a current province, because
old Nawalparasi spanned what are now two provinces and picking one would be
false. If zones are ever added as a place type, these acquire parents then.

**Reversal cost.** Low, unusually. Nothing here changes the grain of
`observations` or the meaning of an existing column, and no current-facing table
changes shape. Dropping the historical rows and the successions table would
return the spine to its present state.

## Notes

`assert_observations_use_places_valid_at_period` is the test that gives the
model teeth. Without it, validity intervals are decoration: an observation could
attach to a place that did not exist when it was measured and nothing would
complain. With it, ingesting a 2011 census figure against a 2017 local unit
fails the build — which is the whole point of having done this before the data
arrived rather than after.

Wards remain unbuilt. When they land they inherit this model unchanged, which
matters because ward boundaries have already been revised once since 2017.
