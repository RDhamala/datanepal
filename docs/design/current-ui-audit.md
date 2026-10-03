# Current UI audit

Audited 3 October 2026 against branch `desktop-type-scale` at `d069834`,
data build 24 August 2026, using the baselines in `references/current/` plus
the source and the published Parquet. Every figure below was measured or
computed, not estimated; the commands are in §11.

All ten findings are resolved. §6 and §9 carry corrections, because measuring
them in the browser showed the original diagnosis was wrong in both cases, and
§7 and §10 were re-verified against the built output rather than assumed.

These are **system-level defects** — defaults, contracts and missing
abstractions. Each one would reappear in the next feature if only its current
symptom were patched. Ordered by consequence, not by page.

---

## 1. A wrong national figure is on `/indicators/` right now

**Evidence.** For `hor_fptp_seats_won` at Nepal there are 7 published rows,
all dimensioned by party, none carrying an `all` member.
`pickAggregate` (`lib/format.ts:245`) sorts by count of specific dimension
members, then by `dimension_key` string length. Every party key is 16 or 17
characters, so the tie-break is effectively source order. It returns
**3 seats (Shram Sanskriti Party)**. The answer is **125 (Rastriya Swatantra
Party)**.

`app/page.tsx:186` and `app/topics/[topic]/page.tsx:182` were fixed in
`d069834` by calling `partyResultsFor`. `app/indicators/page.tsx:133` still
calls `nationalHeadline`, so the index is wrong while the two pages beside it
are right.

**Why it is system-level.** The defect is not elections. It is that the
headline slot's contract assumes every indicator reduces to one number, and
the four dimensions that satisfy it (`sex`, `age_band`, `residence_type`,
`literacy_status` — all carry `all`) made the assumption invisible. `party`
has 58 members and no aggregate. Budgets by ministry, prices by commodity and
schools by level will all arrive the same way, and each will be patched at one
more call site.

**Fix the contract.** `pickAggregate` returns `undefined` when no genuine
aggregate exists, rather than the row that happens to sort first. The headline
slot then renders a distribution, a "largest of N" phrasing, or nothing — and
a missing headline becomes a visible gap instead of a confident error. This is
worth doing before any redesign; it is a correctness bug wearing a design
problem's clothes.

**Touches.** `lib/format.ts`, `lib/data.ts` (`nationalHeadline`),
`app/indicators/page.tsx`.

## 2. Every chart ships its own data table, with no page-level budget

**Evidence.** A table affordance is implemented independently in ten
components: `charts.tsx`, `MetricMap.tsx`, `Choropleth.tsx`, `ReferenceMap.tsx`,
`AgePyramid.tsx`, `viz/Figure.tsx`, `viz/Benchmark.tsx`, `viz/ComparePanel.tsx`,
`viz/MetricStrip.tsx`, plus `ui.tsx`. `app/indicators/[indicator]/page.tsx`
carries three more directly.

**Why it is system-level.** Each component is individually correct — a chart
should have a text alternative. Nothing owns the question *how many times is
this reader about to see the same 77 rows*, so on an indicator page the same
district series is rendered as a choropleth, that map's table, a ranked list,
a "highest and lowest" table, and a "view all 77" table. The accessibility
affordance got copied into every renderer, and the page acquired no shape.

**Fix the contract.** The table affordance belongs to the page, not the chart:
one disclosure per page holding the page's data, with charts declaring their
series into it. A component should be able to ask "has this series already
been tabled here?" and render nothing if so.

**Touches.** The ten components above, and the indicator/place page templates.

## 3. Coverage is invisible, so absence reads as non-existence

**Evidence.** Computed from `publish/dist`: of **36 indicators, 5 have any
sub-national data** and **31 are national-only**. The five are the 2021 census
series. Nothing in the interface states an indicator's lowest available level.

**Why it is system-level.** Place pages correctly omit sections with no data,
which makes the omission silent: a reader on Karnali's page who follows Health
finds a page with no Karnali in it and concludes the data does not exist, when
in fact it exists nationally and the interface has no way to say so. Every new
national-only source makes this worse, and 31 of 36 is not an edge case.

**Resolved.** Lowest-available-level is a first-class attribute, derived in
`lib/coverage.ts` rather than declared: `National` / `To province` /
`To district` / `To local government`, plus whether a time series exists. It
is rendered on every indicator row and is **filterable** on `/indicators/`, so
"does this exist for my district" is now one control rather than 36 clicks.
Place pages state coverage once beside their sources rather than omitting a
topic silently.

`/indicators/` also had its own second implementation of this — a private
`DEPTH` ladder with its own vocabulary ("To local unit" against the shared
"To local government") — which is now deleted. Two derivations of the same
fact drift, and this one was about to become a filter rather than a caption.

**Touches.** `lib/data.ts` (derive the level), `app/indicators/page.tsx`,
place-page section rendering.

## 4. `/topics/` and `/indicators/` answered the same question — resolved

**Evidence.** Both listed the same ten topics with the same indicators under
each and the same headline national value. `/indicators/` added the unit, the
definition and the geographic depth; `/topics/` added an observation count.
They held two of six nav slots between them.

**Why it was system-level.** A routing decision, not a page defect: while both
existed, every new topic feature had to be built or duplicated twice, and
neither page could develop a distinct job.

**Resolved.** Topic is a filter on `/indicators/`, in the URL so a filtered
view can be linked to. `/topics/` redirects there — a 301 in
`public/_redirects` for production, and a canonical tag plus meta refresh on
the page itself for anywhere that file is not honoured. Individual topic pages
are untouched: `/topics/health/` is a hub with charts and a ranking that a
list cannot carry, every place page links to one, and they are good landing
pages. It was the *index* that was the duplicate.

The nav is five items. Only three things linked to the old index — the nav,
the homepage's "Browse topics", and the 404 page — against eight linking to
individual topic pages, which is the ratio that decided which one absorbed
the other.

## 5. Index routes had no length budget — resolved

**Evidence.** Measured document heights at 1440 × 1000: `/indicators/`
**6,686 px**, `/datasets/` 4,381, `/places/` 2,929. At 390 × 844:
`/indicators/` **10,685 px**. A reader on a phone could not see which ten
domains exist without scrolling past all 36 indicators.

**Why it was system-level.** No pagination, filtering or virtualisation
contract for a list route, so page length was a function of how much had been
ingested. Data México's 47,444 px state profile is the same trajectory several
years on.

**Resolved.** Each topic on `/indicators/` is a disclosure, so the page's
height is **O(topics) rather than O(indicators)** and ingestion stops
lengthening it. 10,685 px → **2,256 px** on a phone, 6,686 → **1,597** on a
desktop. The closed row carries what a reader needs in order to choose — the
count, how deep the topic reaches, how many of its measures have a time
series — which is an overview the long version never offered. Any active
filter opens every matching topic.

`details`/`summary` rather than a JavaScript toggle, so every row stays in the
HTML for a crawler and for a reader with scripts off. `scripts/check-index-pages.mjs`
asserts that property and the budget together — the stated total must equal the
number of indicator links in the rendered markup, and **no indicator row may
sit outside a disclosure** — and runs as `postbuild`. Verified it fails for
the right reason by unwrapping one topic in the built output: two failures,
naming the two rows that escaped.

`/places/` and `/datasets/` were left alone. Their lengths are fine and their
growth vector does not exist yet: when wards land, `/places/` becomes a 6,743
row list and will need the same treatment. The check is written so that it
will say so.

**A regression found while doing this, and fixed.** The topic filter added in
§4 put `useSearchParams` inside a `Suspense` boundary, which in a static
export writes the *fallback* to the HTML file. For one commit `/indicators/`
shipped with every indicator in the RSC payload and none in the document — an
Indicators page with no indicators for crawlers and for anyone with JavaScript
off. Typecheck, lint, 119 tests, the place-page checker and a browser all
passed it, because every one of them either runs JavaScript or does not look
at that route. The component reads `window.location` after mount instead, and
the new check is the thing that would have caught it.

## 6. Number sizes had no rule, and the audit's first reading of this was wrong

**Correction, 3 October 2026.** This finding originally read "`--text-stat`
(32px) against `--text-title` (30px) — a ratio of 1.07×, so the headline figure
ties with the page title". That is wrong. `--text-title` is not the page title:
its only consumer is the Devanagari pairing under an h1. The page title is
`--text-display`, measured at 52px on the Dhading page against a largest
figure of 34px. The hierarchy was never inverted, and the fix implied by the
original wording — shrink the stat — would have made the page worse. Measured
in the browser rather than read off the token names.

**What was actually wrong.** Three ad-hoc number sizes with no rule between
them: `FactStrip` hardcoded `text-[1.35rem]`/`sm:text-[1.4rem]` (22px at wide
viewports), `Tile` used `--text-stat` (32px), and `TopicSummary` used an
inline `text-[2.1rem]` (34px). 22px is exactly where `--text-heading` tops
out, so a district's population rendered at the same size as the words
"Population & Demographics" above it and the strip read as a row of
subheadings.

**Fixed.** Explicit roles in `app/globals.css` — display, stat-lead, stat,
title, heading, body, label — with the rule stated where they are defined: *a
figure outranks the heading above it, and nothing outranks the page title.*
`--text-display` also became fluid (36px → 52px), because 52px fixed is
assertive on a 390px phone.

## 7. Comparative context existed at one of four place levels — resolved

**Evidence.** `benchmarksFor` was imported by
`app/np/[province]/[district]/page.tsx` only. Province, local-government and
national pages rendered no comparison.

**Re-verified 3 October 2026**, from the built HTML rather than from the code,
because "it is wired up" and "it renders" are different claims:

| Level | Lineage shown | Verdict line |
|---|---|---|
| Country | *none* | — |
| Province | Nepal | above the national figure · 1 of 7 by this measure |
| District | Bagmati, Nepal | below the national figure · 54 of 77 |
| Local government | Dhading, Bagmati, Nepal | below the national figure · 147 of 276 |

The lineage deepens by one row per level and the rank is against same-type
peers. **The country's absence is correct, not an omission**: `benchmarksFor`
walks the parent chain, Nepal has none, and comparing a national figure with
itself would be a fabrication. So this is three of four by design rather than
four of four, and `scripts/check-place-pages.mjs` asserts it both ways — every
other place page must carry a benchmark, and `/np/` must not.

A defect found while doing this: 18 local governments share a name with an
ancestor, so Kathmandu Metropolitan City listed "Kathmandu 90.5%" above
"Kathmandu 89.2%". Colliding ancestors are now qualified with their type.

## 8. Places can be compared only within one parent

**Evidence.** No `/compare/` route exists (`ls app/`). `comparisonFor` in
`lib/data.ts:338` is reachable only as "compare the children of this one
parent" — rendered as "Compare the districts of Bagmati" and "Compare the
local governments of Dhading".

**Why it is system-level.** The constraint is in the call signature, not the
data. Comparing Humla with Kathmandu, or two local units in different
districts, is the question a journalist or ward officer actually brings, and
the platform cannot express it. It is also the natural home for the
non-additive discipline — a comparison view is exactly where someone sums a
rate.

**Fix.** Lift the single-parent constraint and give it a route: 2–5 places at
any level, every measure published for all of them, national figure as a
reference row.

**Touches.** `lib/data.ts` (`comparisonFor`), new `app/compare/`.

## 9. Map labels vanished where they overhang — not clipping

**Correction, 3 October 2026.** This finding originally read "'Dhunibenshi' is
cut by the right edge of the SVG frame" and sent the fix toward
`layoutLabels`' bounds check. Measured: the label's bounding box right edge is
448.9 in a 478-unit viewBox, fully inside the frame, and inside its parent.
The frame check was correct the whole time.

**What was actually wrong.** Two things, both real.

The label inked white because its polygon is the darkest class of the ramp,
and it is longer than that polygon, so its tail landed on the white page and
disappeared. It read as a clipped label. `MetricMap` also had its own label
renderer, separate from `MapLabels`, so the two maps on the site drew names by
different code — which is why the first fix landed in the wrong file.

Separately, `MapLabels` positioned every `tspan` at the shape's centroid
rather than at the position the layout engine chose, so the horizontal half of
every offset placement was silently discarded at render time.

**Fixed.** One ink for every label with a halo in the page colour painted
under the glyphs (`paint-order: stroke fill`), which is legible on every class
of the ramp and on the page between them — the only rule that holds for a
label that may be in either place. `tspan` now uses the chosen position.

**Still open.** Two label renderers remain. `MetricMap` should use
`MapLabels`; this change applied the same fix to both rather than merging
them, which is a refactor the proof page did not need.

## 10. Provenance was present everywhere and weighted nowhere — resolved

**Evidence.** On the Bagmati page the population row read `6,116,866 Persons`
with `6,487,756 · 2023 projection` beneath it, in grey microcopy at the same
size as every other caption. Both figures individually correct; the
reference-period difference carried entirely by small grey text.

**Resolved.** Reference period has a visual role of its own. Every figure on a
place page carries a `PeriodChip` bound to it, and a later projection is a
labelled secondary line at body size with its own chip — Bagmati now reads
**6,116,866 · 2021**, then *Later projection* **6,487,756 · 2023 projection**,
deliberately at a smaller weight, because two figures at one weight invite a
reader to divide them. A section mixing reference periods says so once, in
words, through `periodNote`.

**A regression found while verifying this.** Retiring the registry renderer
dropped `laterEstimate` from province, district and national pages entirely:
for three commits those pages showed the census count and silently omitted the
projection the platform also publishes. Not wrong, but less than the data
holds, and exactly the figure this finding was written about. Restored as a
first-class slot on `HeadlineMetric` rather than as prose.

**Two duplicate implementations retired.** `SourceDetail` and `CoverageBadge`
were written for the design laboratory and shipped nowhere. `/datasets/`
already rendered a fuller provenance chain than `SourceDetail` did — source
tier, acquisition method, commercial-reuse statement — so adopting the
laboratory's version would have been a downgrade dressed as consolidation.
The real block moved into `viz/SourceLine` instead and both now use it.
`CoverageBadge` was deleted outright: `/indicators/` ships coverage as plain
text in the row meta plus a filter, and a second implementation of coverage
display is the same hazard as a second map-label renderer was. The laboratory
demonstrates what ships, which is the only way a laboratory is worth having.

## Not findings

Claims in `docs/redesign-proposal.md` (1 September 2026) that this audit
checked and found **no longer true**. The proposal is stale on these points
and should not be actioned from.

- **"Not yet covered" sections.** Gone. The only surviving occurrence of the
  phrase is a code comment in `app/np/[province]/page.tsx:44`.
- **The Elections card has no headline.** Fixed in `d069834`; the homepage card
  and `/topics/elections` both use `partyResultsFor`. The *indicators index*
  was not fixed — that is finding §1, and it is narrower than the proposal
  described.
- **Section headings sit at body weight.** Fixed in `ed18d1e`;
  `--text-heading` is now fluid 17 → 22px.

## 11. How these were verified

```bash
# §1, §3, §10 — computed from the published Parquet
cd web && node --input-type=module -e "<hyparquet read of
  observations/indicators/places/dimension_members>"
#   36 indicators, 5 sub-national, 31 national-only
#   party: 58 members, no 'all', key lengths 16/17
#   pickAggregate order -> party_2501 = 3; max -> party_2528 = 125

# §2, §4, §7, §8 — source
grep -rn "View data table|DataTable|<table" --include="*.tsx" app components
grep -rn "benchmarksFor" --include="*.tsx" app
ls app/                      # no compare/

# §5 — measured in the browser at each viewport
document.documentElement.scrollHeight

# §6 — app/globals.css lines 99-117
# §9 — references/current/dhading-{desktop,mobile}-local-map.png
```
