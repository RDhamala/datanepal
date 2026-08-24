---
name: datanepal-source-research
description: Use when researching or evaluating a potential Nepal dataset before ingestion — finding a data source, assessing Open Data Nepal or another aggregator, deciding between a government source and an international mirror, checking licensing or reuse terms, judging dataset freshness or scraping feasibility, or recommending which source to ingest from. Produces a recommendation; does not itself ingest (see datanepal-ingestion) or validate published data (see datanepal-data-quality).
---

# DataNepal source research

Output is normally a **structured recommendation**, not the start of ingestion —
don't jump to writing a connector unless explicitly asked to.

## Source hierarchy (default preference order)

1. Original authoritative publisher
2. Official structured API or download
3. Authoritative international mirror (e.g. HDX for a Nepal government dataset)
4. Trusted Nepal aggregator
5. Official-site scraping
6. PDF extraction
7. Other secondary sources

Document and justify any exception rather than silently picking a lower tier
because it's easier.

## Publisher vs. acquisition — always distinguish both

**Who produced the data** is not **where DataNepal obtained this copy**. The
census is a real example already in the catalog:

```yaml
publisher_org_id: nso          # National Statistics Office produced it
acquired_from_org_id: nso      # in this case, also where we got it
```

but a Wikidata-sourced name or an HDX-mirrored government dataset would have
different values for each — never let an aggregator's name end up recorded as
the publisher.

## The fields DataNepal actually tracks

This isn't a suggested checklist — it's the schema
(`catalog/source.schema.json`) a real source entry must satisfy. Research should
produce enough to fill these in:

| Field | Enum / example |
|---|---|
| `source_tier` | `A` / `B` / `C` / `D` — **provenance authority of the publisher, not technical quality** |
| `acquisition_method` | `official_api`, `official_download`, `official_html`, `undocumented_endpoint`, `mirror`, `aggregator_api`, `aggregator_download`, `scrape`, `pdf_extraction`, `manual_entry` |
| `licence_id` | one of the project's known licences, or `unknown` — **never guessed** |
| `commercial_reuse` | `permitted`, `permitted_with_attribution`, `restricted`, `permission_required`, `unclear` |
| `rights_review_status` | `not_reviewed`, `reviewed_ok`, `reviewed_restricted`, `permission_obtained` |
| `geographic_granularity` | `country` … `municipality`, `ward`, `constituency`, `point` |
| `update_frequency` | `one-off`, `decennial`, `annual`, `quarterly`, `monthly`, `weekly`, `daily`, `irregular` |
| `ingestion_difficulty` | `trivial`, `easy`, `moderate`, `hard`, `very_hard` |
| `contains_personal_data` | must be assessable as `false` — see the hard constraint in `CLAUDE.md`; if a source only offers row-level personal data, the answer is "aggregate before ingest or reject," not "ingest and redact later" |

Also capture: exact acquisition URL vs. publisher URL, revision/vintage
behaviour, methodology notes, and a fallback source if the primary one is
fragile.

## Scraping

Don't scrape because it's technically possible. Prefer API → structured download
→ official HTML → PDF, in that order, and only reach past an API/download because
research actually found neither exists. Always check `robots.txt` first and
respect it — `voterlist.election.gov.np` is `Disallow: /` and is rejected on that
basis alone, independent of what data it holds. Identify the crawler honestly.

## Open Data Nepal (and aggregators generally)

Treat as discovery, mirror, cross-check, or historical recovery — not as the
publisher of record — unless research specifically establishes it should be
treated otherwise for a given dataset. Preserve the original publisher's
attribution regardless of which copy was actually fetched.

## Output shape

A recommendation, covering: candidate source(s) with the fields above filled in,
the recommended tier/acquisition path and why, licensing verdict, and — if the
answer is "don't ingest this" — the specific reason (robots disallow, personal
data with no safe aggregation, licence incompatible with the spine's CC BY-IGO /
ODbL share-alike boundary — see `datanepal-ingestion`).

Known Nepal publishers already integrated (NSO, OCHA/HDX, World Bank, Wikidata)
are precedent, not a static substitute for checking a new source on its own
terms — a publisher being known-good for one dataset doesn't make every dataset
of theirs automatically Tier A or pre-cleared on licence.
