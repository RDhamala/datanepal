---
name: datanepal-place-page
description: Use when creating or editing a Nepal/province/district/local-government/ward profile page, deciding what sections a place page should contain, adding a new topic's module to an existing place page, or changing the cross-topic information architecture of `web/app/np/**`. Owns place-page structure; for chart choice within a section use datanepal-dataviz, for interface chrome use datanepal-ui.
---

# DataNepal place pages

A place page answers **"what should I know about this place?"** — a cross-topic
profile, not a dump of every observation tied to the geography.

## Levels

`Nepal → Province → District → Local government → Ward` (ward not yet ingested —
see `datanepal-ingestion`). Don't assume other geography types share this
hierarchy: electoral constituencies and protected areas are place types with
their own parent chain, not slots in the administrative ladder (owned by
`datanepal-geography`).

## Standard flow

Full detail and current implementation: [`references/place-template.md`](references/place-template.md).

1. **Identity** — `Crumbs` → `PageHeader` (name, native name, type, parent,
   P-code only if genuinely useful to a reader, not because it exists)
2. **Headline facts** — `FactStrip`, a small number of meaningful metrics, not
   every field the record has
3. **Topic summaries** — one module per topic *with actual data for this place*,
   via `PlaceProfile`/`TopicSummary`. A domain with no data for this place gets no
   section, not an empty one or a "not available" placeholder.
4. **Geography** — locator/context map, child places, ranking, comparison
   (`ReferenceMap`, `Choropleth`, `ComparePanel`)
5. **Provenance** — compact attribution + `SourceNote` (see `datanepal-ui` for the
   public-vs-dataset-page provenance split)

## Domain hierarchy — don't confuse topics with chart types

Top-level sections are **topics**: Population, Education, Economy, Government &
Budget, Elections, Health, Infrastructure. Within Population, "age & sex" and
"households" are sub-structure, not peers to Education — never let a chart-type
grouping leak into the topic list.

## Empty domains

**Do not render "Not yet covered: Economy, Elections, Health…" as a prominent
section.** Simply omit sections with no data; coverage information belongs
elsewhere (a datasets/coverage page), not as a headline absence on every place
page. Sections are driven by what `placeProfile()` returns, never by a
hardcoded list of "expected" topics.

> As of this skill's creation, `web/app/np/[province]/page.tsx` and
> `web/app/np/[province]/[district]/[local]/page.tsx` both render an explicit
> "Not yet covered" `AnchoredSection`. That predates this rule and was not
> changed as part of writing this skill (no frontend edits were made). Treat it
> as a known violation to fix the next time either page is genuinely touched,
> not as evidence the rule is optional.

## Comparison is built in, not bolted on

Every level should offer `Benchmark` (this place vs its own lineage) where the
data supports non-additive indicators, and `ComparePanel` (this place's peers,
side by side) where there's more than one peer worth comparing. Both are
level-agnostic components — a province's page compares its districts, a
district's page compares its local governments, using the exact same component
and metric set logic (`compareFor()` in `lib/data.ts`).

## Reference

[`references/place-template.md`](references/place-template.md) — the concrete
section order as implemented across Nepal/province/district/local-government
pages today, useful as a starting point when adding a level or a new
cross-cutting section.
