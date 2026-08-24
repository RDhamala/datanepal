---
name: datanepal-dataviz
description: Use when creating or editing any DataNepal chart, choropleth or other map-as-data-visualization, KPI/metric tile, ranking, population pyramid, comparison graphic (Benchmark, ComparePanel, PairedBars), or when choosing a chart type, or changing chart colours, axes, gridlines, legends, labels, tooltips, or annotations. This is the project's own visualization grammar and colour-role system — distinct from, and more specific than, the generic `dataviz` skill; use both, this one wins on conflict for anything DataNepal-specific.
---

# DataNepal dataviz

Canonical source, read first: [`docs/visualization.md`](../../../docs/visualization.md)
(the prose) and `web/lib/viz.ts` (the tokens the code actually reads). If they
disagree, `lib/viz.ts` is right and the doc is stale — fix the doc.

This skill exists to distill that document into rules you can apply without
re-reading it every time; for anything not covered here, go read the source.

## The one rule

**Every visual answers one stated question.** Pick the chart type from the
question, never for variety. If you can't write the question in a sentence, the
chart shouldn't exist.

## Grammar (question → pattern → component)

| Question | Pattern | Component |
|---|---|---|
| What is it now? | KPI | `MetricStrip` |
| How has it moved? | Line | `TrendChart` |
| Which way, roughly? | Sparkline | `Sparkline` |
| Which places are highest? | Ranked horizontal bars | `RankedBars` |
| Where does it differ geographically? | Choropleth | `MetricMap` |
| Where is this place? | Locator / administrative map | `ReferenceMap` |
| What is it made of? | 100% stacked bar | `Composition` |
| Is this high or low against its lineage? | Benchmark vs parent/Nepal | `Benchmark` |
| Where does it sit among peers (one measure)? | Dot plot with median | `Distribution` |
| How do peers compare (several measures, any drill level)? | Sortable comparison table with per-cell bars | `ComparePanel` |
| How do two groups compare? | Paired bars | `PairedBars` |
| Age and sex | Population pyramid | `AgePyramid` |
| Exact value | Table | `FigureTable` |

Bars are horizontal whenever categories are place names — Nepali place names are
long and vertical bars force rotated labels.

## Explicitly rejected, and why

**No pie charts**, even though the temptation ("should we use variety of chart
types?") comes up. Composition data (e.g. literacy status) uses a 100% stacked
bar instead: it compares *across* places where a pie shows one, stays legible
under 120px, and stacks in a list. Also avoid unless strongly justified: 3D
charts, gauges/speedometers, radar charts, decorative donuts, rainbow maps,
novelty diagrams, gratuitous animation, dual axes, oversized legends, and any
chart too small to read its own labels.

## Every visual shares one frame

`Figure` (`web/components/viz/Figure.tsx`) enforces: title → subtitle → legend →
visual → live readout → caption → table, always in that order. Don't build a new
chart wrapper — compose within `Figure`. The table under a chart isn't a
compliance afterthought: it's the exact-value fallback, the accessible
equivalent of a colour-encoded map, and what makes a figure verifiable.

## Chart mechanics (from `lib/viz.ts` — use the tokens, not new numbers)

- **Type**: four sizes only — `TYPE.micro` 9 (ticks, map labels), `TYPE.small` 11
  (series labels, legends, table cells), `TYPE.body` 13 (sentences), `TYPE.figure`
  17 (a headline number). Don't introduce a fifth size.
- **Gridlines**: value axis only, capped at `GRID.maxTicks` (4), behind the data.
- **Axes**: no axis lines — gridlines and labels carry it.
- **Stroke hierarchy** (`STROKE`), ascending, must stay an order: gridline/reference
  1 → boundary 0.8 → boundaryGroup 1.6 → series 1.75 → active 2.
- **Bars**: `BAR.radius` 1px corner, always zero-anchored. A truncated axis on a
  bar chart exaggerates differences, defeating the reason bars exist.
- **No tooltips.** Hover/focus writes into `Figure`'s fixed `readout` slot — a
  cursor-following tooltip covers the shapes beside the one being read.
- **Missing data**: `COLOR.missing`, never a pale ramp step, always counted in the
  caption. A missing value must not look like a low value.

## Colour — roles, not decoration

Use `COLOR` from `lib/viz.ts`. Every value is a CSS variable, validated by
`npm run palette` (`web/scripts/check-palette.mjs`) for CVD separation and ramp
monotonicity — **run it before changing any colour**, don't reason about contrast
by eye.

- `series` / `seriesAlt` — default single series / a genuine second series.
  `AgePyramid` keeps two distinct colours because the sex distinction *is* the
  information.
- `sequential` (5 steps) — magnitude on a map or ordered category. Class with
  `quantileBreaks()`, not equal intervals — Nepal's subnational distributions are
  heavy-tailed enough that equal-interval buries the pattern in one class.
- `diverging` — defined, deliberately unused until an indicator has a real
  midpoint (budget surplus/deficit). Don't bend `sequential` into a diverging role.
- `rise` / `fall` — direction only, never "good/bad" (more inflation isn't bad data).
- **No per-topic colour.** Giving Education its own hue spends the identity
  channel on something the heading already states, and doesn't scale past a
  handful of topics before it's a rainbow.

## Maps

Two modes, one cartography (boundaries, labels, hover, legend, colour identical
between them): `ReferenceMap` for administrative navigation (fill = identity),
`MetricMap` for magnitude (fill = quantile-classed value, switchable metric).
Labels stay inside the frame — no margin band, no leader lines; the sequence is
full size → smaller → drop type word → wrap → offset with anchor dot → dot only,
named in the table. Abbreviations come only from the reviewed `SHORT_NAMES`
table (`web/lib/maplabels.ts`) — never derive one on the fly; a generated
abbreviation once produced "Nawal…" for two different districts.

## Comparison is core, not optional

`Benchmark` = is this place high or low against its own lineage (place → province
→ Nepal), zero-anchored, gap stated in the unit's own terms (percentage points for
a rate, never percent), rank among same-type peers. `ComparePanel` = how do peers
compare to each other, level-agnostic, every metric shown for every place even
when a value is missing (dash, never zero — a dash and a zero teach opposite
lessons). **Never fabricate a comparison value**: an ancestor or peer with no
published figure is absent, not interpolated.

## Accessibility & responsive

Every figure has a table. Every map shape is a real, keyboard-reachable link.
Colour is never the only channel. Hover output goes to `aria-live`. Charts adapt
layout on narrow screens (map-above-list, not shrink-in-place); tables get a
minimum width scaled to column count so they scroll instead of compressing into
broken multi-line cells.

## Reference

[`references/chart-decisions.md`](references/chart-decisions.md) — quick lookup
table for "I have this kind of data, which component" when the grammar table
above doesn't resolve it (e.g. two related but non-additive rates, a
before/after with only two points).
