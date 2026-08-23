# ADR-0002: Canonical place identity is a DataNepal surrogate

**Status:** Accepted · 2026-08-23 · Supersedes the initial P-code-as-key design

## Context

Geography is the join key for the whole platform. Nepal has no universal
local-unit identifier: the Election Commission, the National Statistics Office,
OCHA, and Wikidata all use incompatible schemes.

OCHA P-codes are the best available: maintained, hierarchical (a child's code is
prefixed by its parent's), and the seventh digit encodes local-unit type
authoritatively. The first implementation used them directly as the primary key
and derived parent relationships by substring.

Two problems. P-codes are OCHA's namespace — if they renumber a unit, every
downstream reference breaks, including any public API contract. And substring
nesting cannot express an electoral constituency (which does not nest under a
single local unit), a protected area (which spans districts), or a unit merged in
a boundary revision.

## Decision

`place_id` is a DataNepal surrogate: `'pl_' || substr(md5(place_type || '|' ||
authoritative_id), 1, 12)`. Derived by hash rather than a sequence because the
warehouse is rebuilt from scratch and a sequence would assign different ids each
build.

Source identifiers move to `place_identifiers`, unique per `(id_system,
id_value)`. `seeds/place_id_overrides.csv` pins an existing `place_id` when a
source renumbers — that file is what makes this a real surrogate rather than a
P-code in disguise.

Parent relationships are explicit foreign keys. `valid_from`, `valid_to`, and
`superseded_by_place_id` exist and are unpopulated.

## Consequences

**Good.** A place survives a source renumbering its codes. Non-administrative
place types are representable. Crosswalks become a published product rather than
internal plumbing. A future public API can offer identifiers we control.

**Costs.** Indirection: a query starting from a P-code joins through
`place_identifiers`. `place_id` is opaque, so debugging reads less naturally than
`NP0327` did. An explicit hierarchy can contain a cycle where a substring cannot,
so a test asserts acyclicity.

**Reversal cost.** High. Every observation references `place_id`. Deciding this
after loading several datasets would mean rewriting the fact table.

## Notes

Protected areas need their own URL namespace: four of them share both a name and
a parent district with a local unit. `place_successions` for merges and splits is
the intended extension, deliberately unbuilt.
