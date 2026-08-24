# Provenance presentation reference

The data itself always carries full provenance (see
[`datanepal-ingestion`](../../datanepal-ingestion/SKILL.md)). This file governs how
much of that surfaces on a given page type — a presentation choice, not a data gap.

## Public pages (place, topic, indicator)

One compact attribution line, in the unit's own terms:

```
2021 census · NSO
2025 · World Bank
```

Plus a short "Sources & Methodology" section (`SourceNote`) at the bottom of the
page, listing the tables/sources the page actually drew on — not the whole catalog.

Do not put publisher, licence, acquisition method, retrieval date, or caveats
inline in the middle of a place or topic page. That's a provenance audit log
wearing a public page's URL, and it competes with the data for attention on the
page whose job is to answer "what should I know about this place/topic."

## Dataset/source pages

Full chain, because this is the page whose job *is* provenance:

- publisher and acquisition source (and the distinction between them — see
  [`datanepal-source-research`](../../datanepal-source-research/SKILL.md))
- licence and reuse terms
- retrieval date and update frequency
- revision/vintage status
- caveats (verbatim from the catalog entry — don't paraphrase away a caveat's
  specificity)
- downloads
- methodology notes

## The test

If a rule you're about to add would make a place page look like a dataset page
(or vice versa), it belongs in the other page type.
