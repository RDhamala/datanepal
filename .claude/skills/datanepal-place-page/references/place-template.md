# Place page template — as implemented

One file per level: `web/app/np/[province]/page.tsx`,
`web/app/np/[province]/[district]/page.tsx`,
`web/app/np/[province]/[district]/[local]/page.tsx`. All three follow the same
shape; a new level (ward) should follow it too rather than inventing a new one.

## Section order

1. `Crumbs` — full trail back to Nepal
2. `PageHeader` — eyebrow (type + parent), title, native name, meta line (child
   count, P-code)
3. `FactStrip` — 4–5 headline facts: population (with correct provenance —
   census vs. projection, see `docs/architecture.md` §9), area, density, share of
   parent, one topic-specific fact where meaningful (e.g. working-age share)
4. `SectionNav` — built from `profileSections(profile)` plus whichever
   conditional sections actually have data; never a static list
5. `PlaceProfile` — one block per topic with data, via `TopicSummary` where a
   topic has a headline/breakdown structure worth the richer treatment
6. Age & sex (`AgePyramid`) — only if population bands exist for this place
7. Geography/context — map of children or siblings, ranked list, or both
   side-by-side above the tablet breakpoint (map-first below it)
8. Compare (`ComparePanel`) — peers at this level, only rendered when
   `compareFor()` returns non-null (i.e., there's more than nothing to compare)
9. Sources (`SourceNote`)

## What varies by level, and what doesn't

- **Varies**: which topics have data (districts have Education, provinces
  currently don't), what "children" means (province→districts,
  district→local-governments, local-government→siblings within its district),
  whether a rank-among-own-type section makes sense (local-government pages rank
  within their type — a rural municipality against metropolitan cities is not a
  meaningful comparison).
- **Doesn't vary**: the component set, the section order, the colour/type system,
  the comparison pattern, the provenance treatment.

## Adding a new cross-cutting section

If it applies to every level (e.g. a new "Elections" topic module once elections
data is ingested), add it to `PlaceProfile`/the shared topic-rendering path, not
to each of the three page files independently — that's what let Education appear
on all 7 provinces, 77 districts, and 753 local governments from one change
rather than three.
