# Current UI audit

Audited 3 October 2026 against branch `desktop-type-scale` at `d069834`,
data build 24 August 2026, using the baselines in `references/current/` plus
the source and the published Parquet. Every figure below was measured or
computed, not estimated; the commands are in §11.

Findings §1, §2, §3, §6 and §9 were resolved on 3 October 2026; §6 and §9
carry corrections, because measuring them in the browser showed the original
diagnosis was wrong in both cases. The rest stand.

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

**Fix the contract.** Lowest-available-level becomes a first-class attribute
of an indicator — `National` / `To district` / `To local unit` — rendered
everywhere an indicator is listed and filterable on `/indicators/`. An empty
section on a place page then states what *does* exist and links to it, rather
than vanishing.

**Touches.** `lib/data.ts` (derive the level), `app/indicators/page.tsx`,
place-page section rendering.

## 4. `/topics/` and `/indicators/` answer the same question

**Evidence.** Both list the same ten topics with their indicators and a
headline national value. `/indicators/` adds unit, definition and geographic
level; `/topics/` adds an observation count and the Nepali topic name. They
hold two of five top-level nav slots.

**Why it is system-level.** It is a routing decision, not a page defect: as
long as both exist, every new topic feature must be built or duplicated twice,
and neither page can develop a distinct job. It is also what blocks the nav
slot that a comparison route needs.

**Fix the contract.** Topic becomes a grouping *within* indicators — a filter,
not a destination. Topic URLs stay (place pages link to them and they are good
landing pages), but they stop competing for the same reader.

**Touches.** `app/topics/`, `app/indicators/`, `components/SiteHeader.tsx`.

## 5. Index routes have no length budget

**Evidence.** Measured document heights at 1440 × 1000: `/indicators/`
**6,605 px**, `/datasets/` 4,381, `/places/` 2,935, `/` 4,117. At 390 × 844:
`/indicators/` **10,433 px**, `/` 7,058.

**Why it is system-level.** There is no pagination, filtering or virtualisation
contract for a list route, so page length is a function of how much data has
been ingested. Thirty-six indicators produce a 10,000-pixel mobile page today;
the platform intends to hold many times that. Data México's state profile —
**47,444 px** — is the same trajectory several years on, and is in the
reference pack as a warning.

**Fix the contract.** Index routes get an explicit budget: a default visible
set, a filter, and a stated total. "Show everything, always" stops being the
default for any route whose length grows with ingestion.

**Touches.** `app/indicators/page.tsx`, `app/datasets/page.tsx`,
`app/places/page.tsx`.

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

## 7. Comparative context exists at one of four place levels

**Evidence.** `benchmarksFor` is imported by
`app/np/[province]/[district]/page.tsx` only. The province page, the
local-government page and the national page render `PlaceProfile` /
`TopicSummary` without a benchmark.

**Why it is system-level.** The capability is built and the data supports it
at every level; what is missing is the decision that a place page *always*
situates its figures. A reader on Bagmati or on Nilkhantha gets a record;
a reader on Dhading gets a profile. Census Reporter puts the comparison
inline with every number ("a little higher than the figure in California:
38.4") and is the reference for what this should feel like.

**Fix.** Make the benchmark module part of the place-page template rather than
one page's feature, and state the comparison in words — "Dhading's literacy is
X% against a national median of Y%, Nth of 77" — directly under the fact strip.

**Touches.** `app/np/[province]/page.tsx`,
`app/np/[province]/[district]/[local]/page.tsx`, `components/PlaceProfile.tsx`.

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

## 10. Provenance is present everywhere and weighted nowhere

**Evidence.** On the Bagmati page the population row reads `6,116,866 Persons`
with `6,487,756 · 2023 projection` beneath it, in grey microcopy at the same
size as every other caption. Both figures are individually correct and
correctly labelled; the reference-period difference between them is carried
entirely by small grey text.

**Why it is system-level.** The platform's central hazard is a reader
combining a 2021 count with a 2023 projection — the household-size example in
`CLAUDE.md` turns 3.75 into 4.0. The data layer tracks `status` and
`period_type` rigorously, and the interface then renders that distinction at
the same visual weight as a unit label. Data México's vintage chip on every
KPI is the reference for the alternative.

**Fix.** Give reference period a visual role of its own — a chip bound to the
figure, not a caption under it — and make a mixed-period section say so once,
prominently, rather than relying on the reader to compare two grey strings.

**Touches.** `components/viz/MetricStrip.tsx`, `components/PlaceProfile.tsx`,
`lib/format.ts` (`statusLabel`).

---

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
