# Design system reference

Canonical implementation: `web/app/globals.css` (tokens), `web/components/ui.tsx`
(layout primitives), `web/lib/viz.ts` (chart-specific tokens — owned by
`datanepal-dataviz`, not this file). If this document and the code disagree, the
code is right and this document is stale — fix the doc, don't trust it blindly.

## Widths

| Thing | Constraint | Why |
|---|---|---|
| Page container | `84rem` / 1344px | One number for the whole site; not per-page. |
| Editorial prose (`<p>` body text, notes, captions, readouts) | `max-w-prose` (65ch) | A measure past ~75 characters is hard to track line to line. Every `Section`/`AnchoredSection` `note`, every `Figure` `subtitle`/`readout`/`caption`, must carry this. |
| Chart / map (`Figure wide`) | up to page width | Visuals benefit from more width than text; don't cap them at prose width. |
| Table | full width, horizontal scroll below a per-column minimum | Compressing a table's columns produces broken multi-line cells before it produces a smaller table. |

## Section rhythm

`Section` and `AnchoredSection` (`web/components/ui.tsx`) are the only place page
vertical rhythm is defined: heading spacing, note spacing, block margins. A new
page composes sections from these rather than hand-rolling spacing. If a page
needs a rhythm these don't support, extend the shared component — don't add a
one-off `mb-*` next to it.

## Header hierarchy

`PageHeader` (eyebrow → title → native name → meta line) is the identity block for
every place, topic, and indicator page. `Crumbs` sits above it. `SectionNav`
follows the fact strip and lists only sections the page actually renders — a
`SectionNav` entry pointing at a section that doesn't exist for this place is a
sign the page is building sections unconditionally instead of from data.

## Cards — concretely

Good: `MetricStrip` cell (one KPI + period + source + sparkline), a topic-summary
block, a "latest update" list entry.

Bad: a card per indicator row inside a topic summary, a card wrapping a single
number with no surrounding context, a grid of identically-styled cards where nothing
distinguishes a KPI from a link from a definition.

## Responsive

Desktop and mobile get **different layouts**, not the same layout scaled down.
The established pattern (province/district pages): map and ranked list sit
side-by-side above a breakpoint, map-first-then-list below it. Apply the same
logic anywhere a chart/map pairs with a list or table — don't let a two-column
grid collapse to a column order that buries the map under a wall of text.
