# ADR-0007: Licence computed per table; share-alike is a tested boundary

**Status:** Accepted · 2026-08-23

## Context

DataNepal combines sources with different reuse terms. Treating all published
data as sharing one licence would be wrong in both directions: it would
understate obligations inherited from restrictive sources and overstate
restrictions on permissive ones.

The concrete case: OpenStreetMap carries Nepali names for ~55% of local units —
better coverage than any alternative found. But OSM is ODbL, whose share-alike
terms propagate to any derived database. Merging it into the geography spine
would have pushed the entire published dataset toward ODbL, constraining every
downstream reuser. Wikidata (CC0) was chosen instead despite comparable
coverage, purely on licensing grounds.

That decision was made in a conversation. Conversations are forgotten.

## Decision

Licence lives on the source dataset. A published table's **effective licence is
computed** from the sources it draws on, taking the most restrictive:

```
cc0-1.0 < cc-by-4.0 < cc-by-igo-3.0 < gov-open < cc-by-sa-4.0 < odbl-1.0 < unknown
```

`licences` records `share_alike`, `attribution_required`, `commercial_ok`, and
`redistribution_ok` as **booleans**, so compatibility is a join rather than a
judgement.

`assert_no_licence_contamination` fails the build if a share-alike source feeds a
table not itself marked share-alike, or if any source forbids redistribution.

The manifest publishes, per table: `effective_licence`, `share_alike`,
`contributing_licences`, and `attribution` — the publishers a reuser must credit.

DataNepal does not relicense upstream data. Attribution obligations travel with
it whether or not we mention them, so we mention them.

## Consequences

**Good.** The OSM decision is now enforced rather than remembered — reintroducing
a share-alike source fails the build with an explanation. A reuser can see
exactly what terms apply to the file they downloaded and why. Adding a
differently-licensed or private dataset later slots in without contaminating the
public layer, which matters for the Enterprise direction in `docs/product.md`.

**Costs.** A genuinely useful source may be rejected on licensing grounds, as OSM
was, at a real cost in coverage. The precedence order is a judgement encoded as
data and could be wrong at the margins — `gov-open` ranked between CC BY-IGO and
CC BY-SA is a defensible guess, not a legal finding.

**Reversal cost.** Moderate. The mechanism is cheap to change. Undoing a
contamination that has already been published is not: once data is distributed
under stated terms, reusers have relied on them.

## Notes

This is not legal advice and the flags are not a substitute for review before
commercial use. What the mechanism guarantees is that a licensing decision, once
made, is applied consistently on every build instead of depending on whoever
adds the next source remembering the conversation.
