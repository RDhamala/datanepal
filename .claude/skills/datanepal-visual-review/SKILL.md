---
name: datanepal-visual-review
description: Use after any meaningful DataNepal UI, layout, chart, or map change, before declaring a frontend task or PR finished, when asked whether a DataNepal page "looks done" or "is finished," when reviewing screenshots of the site, or when checking responsive/mobile behaviour. Enforces browser-based visual QA — this project has shipped changes that passed CI and lint but were visually broken or unreadable, twice, and this skill exists because of that.
---

# DataNepal visual review

**A green build, passing tests, and clean lint are not evidence a visual task is
finished.** Say this explicitly if you're tempted to report completion on that
basis alone — it has been wrong before on this project: a paragraph readability
regression shipped clean through every automated check, and was only caught by
opening the built page.

## Mandatory workflow

1. Build (or run) the site and serve the **production output**, not the dev
   server, for anything you're about to judge on layout/CSS. `npx serve out`
   after `npm run build` is the known-good pattern — the dev server's HMR
   stylesheet has previously appeared to be missing utility classes that were
   actually present and correctly compiled in the real build. Diagnose against
   what ships.
2. Open the changed page with the Chrome DevTools MCP.
3. Inspect at: large desktop, normal laptop, tablet (when the page has a
   noteworthy tablet breakpoint), mobile.
4. Screenshot each breakpoint you inspect.
5. If an approved prototype/screenshot exists for this page (see below), compare
   against it — same typography, chart language, colours, spacing, labels,
   legends, source treatment, interaction behaviour as the rest of the site.
6. Build a concrete visual delta list — not "looks fine," a list of what's wrong
   or what to double check.
7. Fix meaningful problems.
8. **Repeat from step 2** after fixing. Do not stop after the first pass; stop
   when remaining issues are minor, not structural.

No approved prototype currently exists in this repository. If one is added
later, its location and what it's meant to convey (and what not to copy
literally — real data, accessibility, and maintainability still constrain the
build) should be indexed from this skill.

## Checklist

Full detail: [`references/review-checklist.md`](references/review-checklist.md).

- **Layout** — unused space, grid balance, clipped content, sticky-header overlap,
  section-spacing consistency.
- **Typography** — hierarchy, line length (prose must be `max-w-prose`-capped —
  see `datanepal-ui`), Nepali rendering, tabular-numeral consistency.
- **Visualization** — chart too small/large to read, crowded map labels, colour
  inconsistency with `lib/viz.ts` roles, missing interaction cues, legend/label
  legibility — coordinate with `datanepal-dataviz` for what "correct" means here.
- **UX** — dead controls, unclear affordances, no indication a map shape is
  clickable, search and keyboard behaviour.
- **Text density** — flag a run of heading→description→value→description→value
  with no chart/map/table interruption; that's the exact pattern this project's
  visualization work was meant to eliminate.
- **Responsive** — horizontal overflow, unreadable shrunk charts, clipped maps,
  long place names breaking layout, table usability at narrow widths.

## Scope

This skill judges rendered output. It does not decide what a page's sections
should be (`datanepal-place-page` / `datanepal-topic-page`), what chart type
answers a question (`datanepal-dataviz`), or the interface language rules
themselves (`datanepal-ui`) — it checks that those decisions were actually
executed correctly in the browser.
