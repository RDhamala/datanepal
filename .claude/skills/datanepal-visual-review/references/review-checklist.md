# Visual review checklist

Work through each section that applies to the page you changed. Not every
section applies to every change — a chart-colour tweak doesn't need a full
mobile pass, but a new page template needs all of them.

## Layout

- [ ] No excessive dead whitespace or lopsided grid balance
- [ ] No prose paragraph wider than `max-w-prose` (65ch)
- [ ] Nothing clipped at the container edge
- [ ] Sticky header doesn't overlap content on scroll or on anchor-jump
- [ ] Section spacing matches the rest of the page (same `Section`/`AnchoredSection` rhythm)

## Typography

- [ ] Clear hierarchy: headline number reads as the headline, metadata reads as
      metadata (no `TYPE.small` value trying to double as a headline)
- [ ] Nepali text renders correctly and isn't crushed into a size meant for a
      short English label
- [ ] Numbers in tables/figures use tabular numerals and consistent decimal
      precision within one column

## Visualization

- [ ] Every chart is large enough that its own labels are legible at the
      breakpoint being tested
- [ ] Map labels aren't overlapping or spilling outside the frame
- [ ] Colours match `lib/viz.ts` roles — no ad hoc hex, no colour that isn't one
      of `series`/`seriesAlt`/`sequential`/`rise`/`fall`/`missing`
- [ ] Hover/focus gives visible feedback and writes to the fixed readout, not a
      floating tooltip
- [ ] Missing data renders as the missing-data treatment, not blank space or a
      pale ramp colour that looks like a low value

## UX

- [ ] Every clickable map shape and card has a visible affordance (not just a
      cursor change)
- [ ] Search behaves as expected and is keyboard-operable
- [ ] No dead links or controls that do nothing

## Text density

- [ ] No run of 3+ consecutive heading→text→value modules without a chart, map,
      or table breaking it up

## Responsive

- [ ] No horizontal overflow at 320–390px
- [ ] Long Nepali or English place names don't break a card/row layout
- [ ] Desktop and mobile use genuinely different layouts where the content calls
      for it (e.g. map+list side-by-side on desktop, map-first-then-list on
      mobile) — not one grid scaled down
- [ ] Tables scroll horizontally rather than compressing into multi-line cells
