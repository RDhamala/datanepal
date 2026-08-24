# The DataNepal visualization system

Companion to `web/lib/viz.ts`. That file is what the code reads; this is what a
person reads. They are meant to say the same thing, and if they disagree the
code is right and this document is stale.

## The rule

**Every visual answers one stated question.** A chart type is chosen because of
the question, never because the page needs variety. If you cannot write the
question in a sentence, the chart should not exist.

This is also why there are no pie charts. We have genuine part-to-whole data —
literacy status partitions the population aged 5 and over — and a 100% stacked
bar beats a pie for it on every axis that matters: it compares *across* places
where a pie shows one, it stays legible below 120px where a pie does not, and it
stacks in a list. A pie of one district's literacy tells a reader less than a
stacked bar of all seventy-seven.

## Grammar

| Question | Pattern | Component |
| --- | --- | --- |
| What is it now? | KPI | `MetricStrip` |
| How has it moved? | Line | `TrendChart` |
| Which way, roughly? | Sparkline | `Sparkline` |
| Which places are highest? | Ranked horizontal bars | `RankedBars` |
| Where does it differ? | Choropleth | `MetricMap` |
| Where is this place? | Locator / administrative map | `ReferenceMap` |
| What is it made of? | 100% stacked bar | `Composition` |
| Is this high or low? | Benchmark against parents | `Benchmark` |
| Where does it sit among peers? | Dot plot with median | `Distribution` |
| How do two groups compare? | Paired bars | `PairedBars` |
| Compare several peers on several measures, at whatever level you've drilled to | Sortable table, one bar per cell | `ComparePanel` |
| Age and sex | Population pyramid | `AgePyramid` |
| Exact value | Table | `FigureTable` |

Bars are horizontal, not vertical, whenever the categories are place names.
Nepali place names are long, and vertical bars force them to rotate, which makes
a reader tilt their head to read a list.

## Every visual has the same frame

`Figure` enforces the order: heading → subtitle → legend → the visual → live
readout → caption → table. A reader who learns one chart should learn nothing
new about the furniture of the next.

The table is not a fallback bolted on for compliance. It is where exact values
live, because charts are for glancing; it is the accessible equivalent of a
colour-encoded map; and it is what makes a figure verifiable.

## Chart rules

- **Type**: four sizes only — 9 (axis ticks, map labels), 11 (series labels,
  legends, table cells), 13 (anything read as a sentence), 17+ (a headline
  number). Steps are far apart on purpose; a scale with one-pixel increments is
  one nobody can hold in their head.
- **Gridlines**: value axis only, at most four, behind the data. A grid on both
  axes is graph paper.
- **Axes**: no axis lines. Gridlines and labels are enough, and an axis rule is
  one more thing competing with the series.
- **Stroke hierarchy**, in ascending order and it must stay an order: gridline 1,
  reference 1, shape boundary 0.8, group boundary 1.6, series 1.75, hover/focus
  2. Weights that do not form an order produce maps where a district border and
  a province border look identical.
- **Bars**: 1px radius, zero-anchored always. A truncated bar axis exaggerates
  small differences, and comparison is the only reason a bar chart exists.
- **Tooltips**: none. Hover writes into a fixed readout slot instead. A tooltip
  following the cursor covers the shapes beside the one being read, which on a
  district of eleven local governments is most of them.
- **Missing data**: `--color-surface-sunken`, never a pale end of the ramp, and
  always counted in the caption. A missing value and a low value must not look
  alike.

## Colour

Roles, not decoration. All validated by `npm run palette`, which checks
categorical separation under the three common dichromacies and sequential ramps
for lightness monotonicity.

- **series** — the default single series. Most charts show one thing.
- **seriesAlt** — the second, when a comparison genuinely needs two. The
  population pyramid keeps two colours because the distinction carries
  information.
- **sequential** — magnitude on a map or an ordered category. Five classes.
  Anchor flips in dark mode, so light-to-dark always reads low-to-high against
  whichever surface is behind it.
- **diverging** — defined, deliberately unused. It exists so the first indicator
  with a real midpoint does not get a sequential ramp bent into service.
- **rise / fall** — direction of movement. Not good and bad: more inflation is
  not "bad data".
- **missing**, **track**, **gridline**, **boundary**, **selected**.

**No per-topic colour.** Giving Education a green would spend the identity
channel on something the heading already says, and would then need a new colour
for every future topic — which is how a palette becomes a rainbow.

## Maps

Two modes, one cartography. Boundaries, labels, hover, legend and colour are
identical between them; only what the fill encodes differs.

- **Administrative exploration** (`ReferenceMap`) — fill carries identity
  (province, unit type). For navigating and finding a place.
- **Data choropleth** (`MetricMap`) — fill carries magnitude, quantile-classed,
  switchable between metrics.

Quantile rather than equal-interval classing, because Nepal's subnational
distributions are heavy-tailed nearly everywhere: Kathmandu against 76 other
districts put roughly seventy of them in the palest equal-interval class and
erased the Terai/mountain pattern completely. The cost is uneven class widths,
which is why **every legend labels its actual breaks** rather than showing a
smooth ramp with two numbers on it.

**Labels stay inside the frame.** No margin band, no leader lines. A label is
tried at full size, then smaller, then with the administrative type word dropped,
then wrapped to two lines, then offset to one of a few positions around the
centroid — with an anchor dot whenever it moves. Anything that still will not fit
keeps a dot and is named in the table.

**Abbreviations come from a reviewed list, never a rule.** Nepal publishes no
standard set of English district short names: OCHA's COD leaves all 77
alternate-name fields empty, Wikidata has no `P1813` for any of the 79 district
items, and NSO's tables use full names. So `SHORT_NAMES` is a table someone
maintains (`KTM`, `BKT`, `LTP`, `Nawal E`, `Nawal W`), and the engine will not
derive a form that is not in it. A generated abbreviation once produced "Nawal…"
beside "Nawalparasi E" — a prefix of two different districts.

## Tables

Kept, and usually secondary to a chart when the question is visual.

Right-aligned tabular numerals for anything numeric, one header style, hairline
row rules, sticky header when scrollable. Alignment is not decoration: a column
of right-aligned tabular figures can be scanned for magnitude and the same column
left-aligned in a proportional face cannot.

## Comparison is a first-class pattern

A value without context is not an answer. `Benchmark` puts a place beside its
province and Nepal on one zero-anchored scale, states the gap in the unit's own
terms (percentage points for a rate, never percent), and gives the rank among
peers.

Two rules:

- **Only real published values.** An ancestor with no figure is absent, not
  interpolated. An invented benchmark looks exactly like a measured one.
- **Only measures that compare.** Counts are excluded: a district's population
  against Nepal's is a share, not a benchmark, and three bars of wildly different
  magnitude tell a reader nothing.

`Benchmark` answers "is this high or low against its own lineage." `ComparePanel`
answers the sideways question — "how do these peers compare to each other" — and
is level-agnostic: the same component compares a province's districts, a
district's local governments, or a local government's siblings, because the
peers are whatever the page passes it. Selecting a row pins and highlights it;
it never filters the rest away, since filtering on the first selection makes a
second selection impossible.

## Accessibility

- Every figure has a table.
- Every map shape is a real link, keyboard reachable.
- Colour is never the only channel: legends name their categories, the readout
  states values in words, and captions carry the counts.
- Hover output goes to an `aria-live` region.
- Focus is a 2px outline at 2px offset, above every resting stroke weight.

## Responsive

Charts adapt rather than shrink. Map above ranking on narrow screens, side by
side on wide ones. Ranked bars keep their row height and let the list grow.
Tables get a minimum width scaled to their column count so they scroll instead
of compressing — `overflow-x-auto` alone does nothing to a `w-full` table, which
once turned a five-column table at 390px into six lines of broken words per row.
