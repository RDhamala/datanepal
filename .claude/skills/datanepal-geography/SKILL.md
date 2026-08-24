---
name: datanepal-geography
description: Use when adding geography, mapping an external source's place codes or IDs onto DataNepal's canonical places, building or editing a crosswalk, resolving a geography mismatch (e.g. "these municipality IDs don't match ours"), working with the province/district/local-government/ward hierarchy, adding a new place type (electoral constituency, protected area, market point), or handling historical/renamed/merged administrative units. Owns geographic identity and correctness; datanepal-dataviz owns how a map is coloured/labelled once the geometry and joins are right.
---

# DataNepal geography

Full model: [`docs/adr/0002-canonical-geography-identity.md`](../../../docs/adr/0002-canonical-geography-identity.md)
and `docs/architecture.md` §5. The join-key rules below are also in
[`CLAUDE.md`](../../../CLAUDE.md) — this skill exists so they surface exactly
when you're about to violate one.

## Canonical principle

**`place_id` is a DataNepal surrogate, not a source code.** Never use a name, or
a P-code substring, as permanent identity for a join outside the tested
administrative hierarchy. P-codes, Wikidata QIDs, ISO codes, and any future NSO
or Election Commission code all live in `place_identifiers`
(`place_id · id_system · id_value`), unique within their own system, never
globally.

## P-codes: positional, hierarchical, and the one trap

```
NP 03 27 1 01
│  │  │  │  └─ sequence within district
│  │  │  └──── type: 1 metro · 2 sub-metro · 3 municipality
│  │  │              4 rural municipality · 5 protected area
│  │  └─────── district
│  └────────── province
└───────────── country
```

A child's code is prefixed by its parent's — hierarchy joins are substring
operations, and that's a real, exploitable property for the administrative tree.

**Always classify by the type digit, never by Nepali name suffix.** Suffixes
nest as substrings — उपमहानगरपालिका (sub-metropolitan) contains
महानगरपालिका (metropolitan) — and a suffix-based classifier misclassifies
silently, with no error to catch it.

**Type 5 is protected areas**, federally administered, not local units, excluded
from the spine. That exclusion is what makes the local-unit count 753 rather
than 775 — if a change makes that count drift, protected areas are the first
thing to check.

## Not every geography is administrative

Electoral constituencies, protected areas, historical geography, and other
statistical geographies are place *types* with their own parent chain — don't
force them into the province→district→local-government ladder just because
`places` has one `parent_place_id` column. The schema supports this already;
adding a new type doesn't require a new hierarchy concept.

## Crosswalks: the only acceptable name-matching pattern

**Default: never join on names.** A crosswalk maps `(source namespace, source
id) → place_id`, tested for uniqueness and totality against the places it
should cover.

One source is matched on names, and the reasoning is the template for any future
exception — not a precedent for casual name matching:

- The **NSO census** carries no P-codes at all; hierarchy is a row-position
  sequence column, and NSO is the only authoritative source below district
  level, so there's no P-coded alternative.
- It matches on **(district, base name, unit type)**, where the type comes from
  the name's own suffix and **must independently agree** with the spine's
  `place_type` — a mismatch is a join failure, not a warning.
- That reaches 751 of 753 automatically; the remaining two are an explicit,
  reasoned two-row seed (`transform/seeds/nso_name_fixes.csv`), each with a
  written justification — not a fuzzy-match fallback.
- `assert_nso_census_join_is_total` fails the build if any local unit fails to
  resolve, and `assert_nso_crosswalk_is_unique` catches the reverse problem (a
  1:many join hiding as 1:1 — this caught a real bug: the Wikidata name
  crosswalk produced 755 rows for 753 places because Wikidata holds several
  items for some places).

**What makes this acceptable is the total absence of cleverness** — no edit
distance, no phonetic matching, no partial-string scoring. Contrast: Open
Knowledge Nepal's boundary release was rejected specifically because it had no
P-codes *and* an independently romanised name set disagreeing with ours on 222
of 753 units — bridgeable only by a guessing matcher, which is exactly what
this project does not do.

If a new source needs name-based matching, it needs this same shape: a real
disambiguating key alongside the name (district + type, not name alone), a
totality test, a uniqueness test, and an explicit seed file for the residue —
not a similarity threshold.

## Historical geography

`valid_from`, `valid_to`, `superseded_by_place_id` exist on `places`, currently
NULL. Nepal's 2017 federal restructuring means pre-2017 data will eventually
need a crosswalk of its own (a `place_successions` table for merges/splits is
the anticipated next step). Don't build a full historical system speculatively,
but don't design a new join in a way that would block adding one later —
carrying the columns now was deliberately done to avoid a migration touching
every observation afterward.

## Reference

[`references/crosswalk-policy.md`](references/crosswalk-policy.md) — the
concrete test names and what each one guards, for writing tests on a new
crosswalk.
