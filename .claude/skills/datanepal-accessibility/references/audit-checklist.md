# Audit checklist — auditing a page that already exists

For building new UI, the patterns in `SKILL.md` are enough. Use this when the
task is "check this page" or "review this PR" and you need coverage rather than
guidance.

Work through it in the browser with the Chrome DevTools MCP. Reading the JSX is
how you find what was *written*; only the rendered accessibility tree tells you
what a reader actually gets.

## Pass 1 — keyboard, no mouse

| Check | Failure it catches |
|---|---|
| Tab from a cold load | Skip link (`app/layout.tsx:47`) doesn't appear or doesn't land on the main landmark. |
| Tab through the whole page | Focus order diverges from visual order — usually a CSS reorder without a DOM reorder. |
| Watch the focus ring the whole way | An `outline-none` with no replacement. `Search.tsx:217` is the known one; a border-colour swap is thin. |
| Operate every control by keyboard | A `div` with `onClick` and no key handler. Grep `onClick` and confirm each is on a real `<button>`/`<a>`. |
| Open and close the search combobox | Arrow keys, Enter, Escape. `aria-activedescendant` must track the highlighted option. |
| Tab across a map | Should be **one** stop, not 753. Focusable polygons are a regression, not an improvement. |
| Open a `<details>` data table | Summary reachable and labelled; table not a focus trap. |

## Pass 2 — the accessibility tree

| Check | Failure it catches |
|---|---|
| Every chart's computed name | `"img"` or the bare title. It should carry the range and latest value — see `charts.tsx:147`. |
| Text-based charts are *not* `role="img"` | `RankedBars` is a `<ul>` of real text. Wrapping it as an image hides readable rows behind one summary — a regression that scans as a fix. |
| Table headers describe *these* rows | `RankedBars` defaults `rowLabel` to `"Place"`. A caller ranking something else must override it — that default once shipped a table of political parties headed "Place". |
| Every map's computed name | Same. `Choropleth.tsx:191` is the reference. |
| Headings, in order | Skipped levels, or a visual heading that is a styled `<div>`. |
| Landmarks | One `main`, a `nav`, a `footer`. The skip link needs a target. |
| Images that decorate | Should be `aria-hidden` — 20 sites already are. Decorative SVG announcing itself is noise. |
| `lang` on Nepali spans | Devanagari inside an `lang="en"` subtree gets an English voice. `SiteHeader.tsx:51`, `ui.tsx:49`. |
| Table headers | `scope="col"` present, caption present. |
| Live regions | Anything that updates in place without a reload has an `aria-live`. |

## Pass 3 — data integrity of the accessible path

This is the pass generic tooling will never run, and it is the one that matters
most here.

1. Compare each chart's `<details>` table against the drawn series. A table that
   has drifted from the chart is a wrong answer handed to the reader with the
   least ability to catch it.
2. Confirm the accessible name's stated value matches the latest plotted point.
   These are computed separately and can diverge when a chart's data shape
   changes.
3. Check figures that carry `status` (projection vs actual) still say so in text,
   not only via a visual treatment. Never let a projection read as a census count
   to a non-visual user — the same rule as everywhere else in this project.
4. Where a section mixes reference periods, confirm the warning is in the text
   the screen reader reaches, not only in a coloured band.

## Pass 4 — colour, delegated

Run `npm run palette`. It covers categorical separation under the three common
dichromacies, ramp lightness monotonicity, and label contrast on fills.

What it cannot check, and you must:

- Whether a legend identifies *which* series is which, in text
- Whether a status colour (good/bad, above/below) is paired with a word or shape
- Whether a focus indicator is visible against the surface it lands on

## Reporting

State what you exercised and what you found, separately. "Tabbed all controls,
read the a11y tree on three chart types, palette clean; one finding: the
district map's data table lists 76 rows against 77 drawn" is a useful report.
A list of added `aria-label`s is not — it describes edits, not verification.
