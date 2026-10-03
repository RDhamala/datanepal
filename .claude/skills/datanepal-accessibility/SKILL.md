---
name: datanepal-accessibility
description: Use when adding or changing any DataNepal interface a person operates or reads — a chart, map, table, form control, search box, navigation, disclosure, or focusable element — and whenever the words accessibility, a11y, WCAG, screen reader, keyboard, focus, alt text, contrast, or "can people actually use this" come up. Also use before shipping a new page type, and when reviewing UI someone else wrote. Owns whether the interface can be operated without a mouse and understood without sight or colour vision; datanepal-ui owns how it looks, datanepal-dataviz owns what the chart says, datanepal-visual-review owns whether it rendered. More specific than any generic accessibility or web-guidelines skill — use both, this one wins on conflict for anything DataNepal.
---

# DataNepal accessibility

This is a public reference for Nepal's official statistics. Someone using a
screen reader has the same claim on the census as someone using a mouse, and
they are more likely than most to be here for a specific number rather than to
browse. The bar is that they can **get the value**, not that the page merely
passes a linter.

Colour contrast is **not** this skill's job. `npm run palette`
(`web/scripts/check-palette.mjs`) already validates categorical separation under
dichromacy, ramp lightness monotonicity, and label contrast. Run it rather than
reasoning about colour — see CLAUDE.md. This skill covers everything a colour
validator cannot see.

## The pattern already in the codebase

Follow it. It is coherent and new work that diverges makes the site worse, not
different.

**First decide whether the chart is a drawing or is already text.** This choice
comes before any ARIA, and getting it backwards makes things worse.

*A drawing* — the values exist only as geometry, so a screen reader has nothing
to read: `TrendChart`, `Choropleth`, `AgePyramid`. These take `role="img"` plus
an `aria-label` that states the *finding*, and a `<details>`-wrapped data table.

```tsx
// components/charts.tsx:147 — the label carries the number, not just the title
role="img"
aria-label={`${label}, ${minYear} to ${maxYear}. Latest value ${formatWithUnit(last.value, unit)}.`}
```

A label reading "Line chart of population" is a failure dressed as a pass: it
announces that a chart exists and withholds what it shows. Say the range and the
latest value.

*Already text* — the labels and values are real DOM nodes and the bar is just a
sized `<span>`: `RankedBars` (`components/charts.tsx:236`) is a `<ul>` with an
`aria-label`, and each row's name and number are read natively. **Do not convert
these to `role="img"`.** That role tells assistive tech to ignore the subtree,
so you would be hiding perfectly readable content behind a one-line summary.
Semantic markup beats a described image whenever it is available.

`components/charts.tsx:31` (`DataDisclosure`) and `components/Choropleth.tsx:277`
are the working table examples — reuse them rather than hand-rolling a new one.

**Make the data table's headers describe the actual rows.** `RankedBars` takes a
`rowLabel` that defaults to `"Place"`, because most leaderboards here rank
places. It used to hardcode that, and when the elections page reused the
component the data table filed political parties under a column headed "Place" —
shipped and live until an audit caught it. The sighted reader never sees that
header; it is served only to the person who cannot check it against the chart.
When you reuse a ranked or tabular component for a new kind of row, pass a
matching header rather than inheriting the default.

**Every map shape is a real link, and that is deliberate.** `docs/visualization.md:164`
and `datanepal-dataviz` both state it: a shape is a navigation target, not
decoration. Do not add `tabIndex` to a `<path>` to "make it focusable" — the
shapes are already wrapped in `<Link>`, and doing so stacks a second tab stop on
top of an anchor that is already there. If a map is not reachable, the anchors
are missing or hidden; find out which before adding anything.

The first draft of this skill said the opposite — that geography is an
illustration and 753 tab stops are unusable, so the table should be the only
path. That was wrong, it contradicted the project's own stated invariant, and it
would have entrenched the bug below. A rule that sounds sensible in the abstract
is worth nothing if it disagrees with what the codebase already decided.

**Never put `role="img"` on an SVG that contains links.** It makes the whole
subtree presentational, so the anchors stay focusable but vanish from the
accessibility tree: a sighted keyboard user tabs through shapes that a screen
reader announces as nothing. `Choropleth`, `MetricMap` and `ReferenceMap` all
shipped that way. Use `role="group"` with the same summary `aria-label` — the
label still names the map, it just stops deleting the map's contents.

`role="img"` remains correct for a chart with no interactive children, which is
why `AgePyramid` and `TrendChart` keep it. The test is whether anything inside
can be focused, not whether the thing is a picture.

**When you expose a map subtree, hide the label layer.** The in-shape names are
*layout* strings abbreviated from `SHORT_NAMES` — "BKT", "Nawal W". They were
invisible while the map was `role="img"`; the moment it becomes a group they
leak as orphan text over the real names. `MapLabels` wraps itself in
`aria-hidden`, and `MetricMap` marks its own `<text>` the same way.

**Nepali text carries `lang="ne"`.** Without it a screen reader pronounces
Devanagari with an English voice and produces noise. `SiteHeader.tsx:51` and
`ui.tsx:49` do this; `app/layout.tsx:43` sets `lang="en"` as the document
default. Any bilingual string you add needs the same treatment on the Nepali
span specifically — not the whole block.

**The skip link at `app/layout.tsx:47` must keep working.** It relies on
`focus:not-sr-only` and on the main landmark keeping its id. If you restructure
a layout, tab once from a cold page load and confirm it still appears.

## What to get right in new work

**Never encode meaning in colour alone.** The palette validator confirms two
series are *distinguishable*; it cannot confirm a reader knows *which is which*.
Legends need text, map fills need a labelled scale, and a "up is good / down is
bad" colour needs a word or arrow too.

**Preserve a visible focus indicator.** `Search.tsx:217` sets `outline-none` and
replaces it with `focus:border-brand` — a border colour change is a thin
substitute for an outline, and it is the one place worth re-testing when the
palette moves. If you write `outline-none` anywhere, you owe a replacement with
comparable visibility, and you should confirm it by tabbing rather than by
reading the class list.

**Match the widget to its real semantics.** The search box is a full combobox
(`aria-expanded`, `aria-controls`, `aria-activedescendant`, `role="listbox"`,
`role="option"`). If you extend it, extend the pattern — a `div` with `onClick`
and no keyboard handler is not a control. Prefer a real `<button>` or `<a>` over
adding `role="button"` to something else.

**Tables need `scope="col"` on headers and a caption.** Existing tables do this;
a screen reader reading a wide indicator table without header association gives
back a stream of unattributed numbers.

**Announce what changes without a reload.** Static export means there is no
server round trip to hint at new content. Where results update in place, an
`aria-live` region is the only signal a non-visual user gets.

## Static export shapes what is possible

`output: "export"` — no server, no runtime fetching. Accessibility has to be in
the emitted markup, because nothing will fix it up on the client. This is
mostly a gift: the accessible name of a chart is knowable at build time from the
same data that draws it, so compute it there rather than deriving it in a
`useEffect` that a crawler or a slow client may never run.

## Verifying

Do not claim an accessibility fix from reading the diff — the same rule that
governs visual work (see `datanepal-visual-review`) applies harder here, because
the failure mode is invisible on screen by definition.

1. `npm run palette` for anything colour-touching.
2. Drive the real page with the Chrome DevTools MCP. Tab from the top and
   confirm the skip link fires, focus order follows the visual order, focus is
   always visible, and no control is reachable only by mouse.
3. Read the accessibility tree, not just the DOM. That is what tells you the
   chart's computed name is "Population, 2011 to 2021. Latest value 29.2m" and
   not "img".
4. For charts and maps specifically, check the data table exists and its numbers
   match the drawn ones. A stale table is worse than no table — it is a wrong
   answer given confidently to the reader least able to check it.

Report what you actually tested. "Tabbed the page, skip link works, chart name
reads correctly, data table matches" is worth more than "added aria-labels".

See `references/audit-checklist.md` when auditing an existing page rather than
building a new one.
