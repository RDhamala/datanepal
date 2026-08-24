---
name: datanepal-ui
description: Use when creating or editing DataNepal frontend UI — page layouts, navigation, homepage sections, headers/footers, cards, grids, spacing, typography, colour usage outside a chart, responsive behaviour, bilingual English/Nepali presentation, or how source/provenance is shown on a public page. Owns the interface and visual product language, not chart-type choice (see datanepal-dataviz) or a page's information architecture (see datanepal-place-page / datanepal-topic-page).
---

# DataNepal UI

Full direction: [`docs/brand.md`](../../../docs/brand.md). This skill distills it into
rules for the moment you're editing a component or layout.

## What it should feel like

A national public-data institution built for the internet age: trustworthy, calm,
precise, civic, intelligent, distinctly Nepal-focused. **Not** a SaaS dashboard, a
government template, an NGO site, an AI-generated Tailwind page, or technical
documentation. Character sits between a statistical publication, serious
data-journalism, and a reference encyclopedia.

Nepal identity comes from typography, cartography, bilingual treatment, and a
restrained colour system — never from mountain photos, prayer flags, mandalas, or
red-because-the-flag-is-red.

## Rules learned the hard way

- **Professional ≠ austere; restrained ≠ monochrome.** Avoid card soup, not cards.
  Avoid decorative colour, not colour.
- **Data is the primary visual material.** Before adding an icon, illustration, or
  ornament, ask whether it makes data easier to understand or DataNepal easier to
  trust. If not, leave it out.
- **Public pages are not provenance audit logs.** Full source detail belongs on
  dataset/source pages, not stacked into every place or topic page (see
  [`references/provenance-presentation.md`](references/provenance-presentation.md)).
- **Don't let text directories substitute for visual discovery.** A long list of
  links where a map, ranking, or comparison would answer the same question faster
  is a defect, not a placeholder.
- **A green build is not evidence a design task is finished.** Visual work requires
  opening the page in a browser — that's [`datanepal-visual-review`](../datanepal-visual-review/SKILL.md), not this skill, but always run it after UI changes.
- **No long runs of visually identical text-heavy sections.** Interrupt with a
  metric, chart, or map at least every 2–3 modules.
- **Maps, charts, metrics, whitespace, typography and composition carry the
  design** — not chrome.

## Layout

Full detail: [`references/design-system.md`](references/design-system.md).

- Page container caps at `84rem` (1344px); prose/paragraph text caps at `65ch`
  (`max-w-prose`) regardless of how wide its container is. A `note` or caption
  paragraph with no width class is a bug — it has happened, and it produces
  176-character lines.
- Section rhythm is a fixed vertical cadence (`Section`/`AnchoredSection` in
  `web/components/ui.tsx`) — don't invent a one-off spacing scale per page.
- Charts and maps take more width than prose (`Figure`'s `wide` prop); tables take
  all of it and scroll horizontally rather than compress.

## Cards

Use a card for a genuine semantic module: a KPI summary, a topic summary, a
compact place summary, a "recent updates" entry. Don't wrap every statistic in its
own card, nest cards inside cards, or reach for heavy shadows / deep rounding —
those read as generic SaaS, which is the thing this project is explicitly not.

## Bilingual UI

Full detail: [`references/bilingual-ui.md`](references/bilingual-ui.md).

Nepali is a first-class property of the data (`name_ne` alongside `name_en` on
places, indicators, dimensions, topics), not a translation layer. Don't render it
as small grey metadata under the English name by default — that was explicitly
identified as the pattern to avoid. Devanagari and Latin have different
x-heights and vertical metrics; equal point size does not look equal, so a
lockup or heading pairing the two needs a deliberate optical adjustment, not a
shared `font-size`.

## Provenance display — two levels, always

- **Public pages** (place, topic, indicator): one compact line —
  `2021 census · NSO` or `2025 · World Bank` — plus a short "Sources &
  Methodology" section. This is what `SourceNote` renders; don't expand it inline.
- **Dataset/source pages**: full chain — publisher, acquisition method, licence,
  retrieval date, revision status, caveats, downloads. The underlying data already
  carries all of this (see [`datanepal-ingestion`](../datanepal-ingestion/SKILL.md)); this skill only governs how much of it surfaces on a given page type.

## Authority boundary

This skill owns interface chrome and visual language. It does not choose chart
types or chart colour roles (`datanepal-dataviz`), decide what sections a place or
topic page contains (`datanepal-place-page`, `datanepal-topic-page`), or sign off
that a change actually looks right in a browser (`datanepal-visual-review` — run it
after any change this skill governs).
