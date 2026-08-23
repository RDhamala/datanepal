# Product direction

Status: **direction agreed. Do not build the paid layers now.** This exists so
future work does not accidentally foreclose them.

## What DataNepal is meant to become

Two things at once:

- a public-interest data platform for Nepal
- potentially, professional data infrastructure for organisations that need
  reliable Nepal data

The model is **free public knowledge layer + paid professional data
infrastructure**. Basic public facts are never monetised.

## The long-term asset is not the website

The hard-to-replicate value is the data infrastructure underneath:

cleaned Nepal datasets · normalised schemas · canonical geographic identifiers ·
source crosswalks · bilingual English/Nepali names · historical versions ·
revisions · provenance · licensing metadata · reliable transformations ·
geographic relationships · reusable data models

The target is a point where an organisation can reasonably say:

> It is faster and safer to use DataNepal than to independently find, clean,
> reconcile, and maintain these Nepal datasets.

That is where commercial value emerges — and note that every item on that list
is a data-quality investment, not a feature. The commercial strategy and the
public-interest strategy point the same way, which is unusual and worth
protecting.

## Three eventual layers

**Public (free, always).** Place pages, indicators, charts, maps, basic
comparisons, dataset metadata, source provenance, basic downloads, public
search. This layer builds trust, distribution, and usefulness.

**Pro (possible future).** Larger downloads, advanced comparisons, saved queries
and places, data-change alerts, higher API quotas, historical revisions, custom
exports, advanced filtering.

**Enterprise (possible future).** High-volume API, SLAs, priority support,
custom pipelines, private dataset integration, organisation accounts, bespoke
exports, BI built on the canonical layer.

Possible customers: banks, insurers, fintechs, consultancies, media,
universities, researchers, NGOs and INGOs, development agencies, corporates,
government-adjacent institutions, and technology companies building
Nepal-focused products.

**None of this is committed. Do not build it now.**

## Hard constraints on monetisation

Trust is the competitive advantage, so it outranks revenue. Never:

- paywall basic public facts
- hide source information
- make free data deliberately inconvenient
- use intrusive advertising or dark patterns
- sell access to voter-level or any personal data
- monetise sensitive personal data

The predecessor project served row-level voter records including parents' and
spouses' names. That is the exact opposite of this product, and no commercial
argument reopens it. See CLAUDE.md.

## Architectural implications — and how the current design already fits

This direction was received mid-way through the architecture validation pass. It
largely **confirms** decisions already taken for other reasons, which is a good
signal:

| Future capability | What the current design already does |
|---|---|
| Stable canonical IDs | `place_id` is a DataNepal surrogate, not a source code; source identifiers live in `place_identifiers`. An API contract can outlive OCHA renumbering a P-code. |
| Dataset version history, revisions | Revision history is captured in an append-only committed file from the start, even though nothing surfaces it yet. "Historical revisions" as a Pro capability requires the history to exist *now*; it cannot be reconstructed later. |
| Reproducible exports | `publish/dist` is committed, so any published figure is traceable to the commit that produced it. |
| Licensing boundaries, private/public separation | Provenance and licence attach to the **source dataset**, and published tables declare which sources they draw on. A private or differently-licensed dataset slots in without contaminating the public layer. |
| Programmatic access, API versioning | The published Parquet + `manifest.json` is already a machine-readable contract — effectively v0 of the API. Versioning it is a naming decision, not a re-architecture. |
| Auditability, metering | Every observation carries `dataset_id`, `retrieved_at`, `published_at`, and `revision`. |
| Large exports | Columnar Parquet, partitionable by dataset. |

What this direction **adds** to the priority list:

1. **Crosswalks are a product, not plumbing.** `place_identifiers` is published
   as a first-class table for exactly this reason: "we reconciled Nepal's
   incompatible geographic coding systems" is among the most valuable things
   here, and it should be visible and citable.
2. **Bilingual names are commercial infrastructure**, not a nicety. The current
   66% local-unit coverage and 0% district coverage is a product gap, not just a
   display gap.
3. **Revision capture cannot be deferred.** Everything else on the Pro list can
   be built later from data we already hold. History cannot.

## What to do now

Keep the public site simple. Build excellent canonical data infrastructure.
Preserve provenance and history. Build stable identifiers. Make data
exportable. Design future APIs cleanly. **Avoid premature billing, accounts, or
metering complexity.** Prioritise usefulness and data quality over monetisation
features.
