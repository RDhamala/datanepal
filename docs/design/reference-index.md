# Design reference index

What exists in `docs/design/`, what each reference is for, and what may be
taken from it. Nothing here is a decision — it is the evidence a decision will
be argued from.

| Part | Path | Role |
|---|---|---|
| Approved prototype | `references/approved/` | Visual north star. One image. |
| Current baseline | `references/current/` | What the live site looks like today. |
| External references | `references/external/` | How comparable products solve specific problems. |
| Audit | `current-ui-audit.md` | Verified defects in the current implementation. |

**Authority order.** The approved prototype outranks everything else on visual
direction. The audit outranks everything on what is broken. External
references outrank nothing — they are arguments, not instructions, and each
one below says explicitly what it is *not* to be used for. See
`references/README.md` for the prototype's own terms.

---

## 1. Approved prototype

`references/approved/datanepal-visual-prototype.png` — homepage, province page
and district page. Terms of use, what is intentional and what must not be
copied: `references/README.md`.

## 2. Current baseline

`references/current/` — 31 PNGs captured 3 October 2026 against branch
`desktop-type-scale` at `d069834`, data build 24 August 2026. 24 desktop
(1440 × 1000) and 7 mobile (390 × 844, DPR 2). Index and capture method:
`references/README.md`.

---

## 3. External references

All six were inspected live. Screenshots are third-party material retained
for internal design reference only; they are not redistributable and must not
appear on the public site.

### 3.1 Census Reporter

- **URL inspected** — `https://censusreporter.org/` and
  `https://censusreporter.org/profiles/05000US06075-san-francisco-county-ca/`
- **Captured** — `census-reporter-home.png`,
  `census-reporter-county-profile.png`
- **Design problem it owns** — *Putting a number in context at the point of
  reading.* It is the closest analogue to a DataNepal district page: one
  authoritative statistical source, one profile per place, a journalist as the
  intended reader.
- **Borrow** — Every figure is followed by its comparison in words: median age
  40.5, "a little higher than the figure in California: 38.4" and "United
  States: 39.2". That is a sentence, not a chart, and it converts a record
  into a profile. Also: the sticky left section rail, and a per-chart
  "Show data / Embed" pair that is one affordance rather than a second table.
- **Reject** — The hero is a 530px interactive basemap with a floating title
  card, which pushes the first real figure below the fold. Donuts for
  part-to-whole with three or more categories. The site also shows its age in
  type and spacing; take the information design, not the surface.
- **Should influence** — `components/viz/Benchmark.tsx` and `TopicSummary.tsx`,
  and the place-page template at all four levels (today benchmarks render on
  district pages only — see audit §7).

### 3.2 ONS Explore Local Statistics

- **URL inspected** — `https://www.ons.gov.uk/explore-local-statistics/` and
  `https://www.ons.gov.uk/explore-local-statistics/areas/E08000003-manchester`
- **Captured** — `ons-explore-local-statistics-home.png`,
  `ons-area-profile-manchester.png`
- **Design problem it owns** — *Statistical-area identity and hierarchy in an
  official register.* How to state what a place is, what it sits inside, and
  what sits inside it, without ambiguity.
- **Borrow** — The area code rendered as a chip beside the title
  (`Manchester  E08000003`) rather than as a footnote; DataNepal currently
  prints "P-code NP03" as grey body text. A one-sentence prose summary of the
  headline figures ("In 2024, Manchester had a total population of 589,670 and
  a median age of 30 years"). Child geographies tabbed *by geography type*
  (Electoral wards | Parishes | MSOAs) — directly applicable to a district's
  municipalities and rural municipalities. And the dotted-map hero, which is
  the same device the approved prototype uses, executed restrainedly.
- **Reject** — The GOV.UK visual system wholesale: the green, the heavy
  focus states, the stacked notification bands. Also the full-width basemap
  on the area page, for the same reason as Census Reporter.
- **Should influence** — The place-page header (P-code presentation and the
  one-sentence summary), Dhading's local-government listing, and the hero map
  treatment on `/`.

### 3.3 Our World in Data

- **URL inspected** — `https://ourworldindata.org/` and
  `https://ourworldindata.org/grapher/population-regions-with-projections`
- **Captured** — `owid-home.png`, `owid-grapher-nepal-population.png`
- **Design problem it owns** — *One indicator, one page, several views.* The
  canonical answer to the question the DataNepal indicator page currently
  answers by stacking every representation vertically.
- **Borrow** — The control strip: `Table | Area` as a toggle of one view
  rather than two stacked sections, a Settings affordance, a time slider, and
  `Download / Share / Enter full-screen` grouped at the chart's foot. Beneath
  every chart, an explicit `Data source:` line, a `Note:` for definitional
  caveats, and the licence — provenance as chart furniture, not a page
  section. Then "What you should know about this indicator" as prose. On the
  homepage, search is the hero and the corpus is counted directly beneath it
  (14,095 charts · 126 topic pages · 29 data explorers · 507 articles), which
  is what DataNepal's 7 / 77 / 753 / 36 strip is reaching for.
- **Reject** — Donate and Subscribe as persistent chrome; the dark navy
  masthead with a world-map texture; the editorial-outlet register generally.
  DataNepal is a reference work, not a publication with a mission statement
  above the fold.
- **Should influence** — `app/indicators/[indicator]/page.tsx` (the control
  strip and the collapse of three tables into one), `components/viz/Figure.tsx`
  (chart-foot provenance), and the homepage hero stats.

### 3.4 Eurostat — Regions and Cities

- **URL inspected** — `https://ec.europa.eu/eurostat/web/regions-and-cities`
  (overview) and `https://ec.europa.eu/eurostat/cache/RCI/` (Regions and
  Cities Illustrated, the interactive tool)
- **Captured** — `eurostat-regions-and-cities-overview.png`,
  `eurostat-rci-map-tool.png`
- **Design problem it owns** — *Comparison across a hierarchy of sub-national
  levels.* The only reference here that treats "which level am I looking at"
  as a first-class control.
- **Borrow** — The explicit geographic-level selector (NUTS 1 / 2 / 3), which
  maps onto province / district / local unit. The map and the distribution
  plot shown **side by side and linked**, so "where" and "how much" are
  answered together instead of as two stacked sections. The view switcher
  (Distribution plot | Scatter plot | Bar chart | Data table) with a single
  shared year timeline. And the distribution plot itself: each country's
  regions plotted as dots on a shared axis, which shows *within*-unit spread —
  the thing a national average hides, and the strongest argument available for
  a `/compare/` route.
- **Reject** — Essentially the entire surface: 1990s tab strips, system fonts,
  grey frames, and a legend of seven classes in a 110px box. The overview page
  is also a left rail of links to more links — the directory failure DataNepal
  already has, and must not import.
- **Should influence** — The proposed `/compare/` route, and the level control
  on the indicator page.

### 3.5 Data México

- **URL inspected** — `https://www.economia.gob.mx/datamexico/en` and
  `https://www.economia.gob.mx/datamexico/en/profile/geo/morelos-mo`
- **Captured** — `data-mexico-home.png`,
  `data-mexico-state-profile-morelos.png`,
  `data-mexico-state-profile-sections.png`
- **Design problem it owns** — *A complete, many-topic profile of one place*,
  at national-statistics scale, in a middle-income country's official
  portal — the closest institutional analogue to what DataNepal is becoming.
- **Borrow** — A **vintage chip on every KPI** (`2020`, `2024`, `2026-Q1`,
  `JAN-DEC 2024`), which makes a mixed-reference-period page legible at a
  glance; this is the single most directly applicable idea in the whole pack,
  given DataNepal publishes 2021 census beside 2023 projections. An
  `Add Comparison` control on the place itself. A generated prose summary
  ("About Morelos", "In 2020, the population in Morelos was 1,971,520
  inhabitants (48.2% men and 51.8% women). Compared to 2010, … increased by
  10.9%"). A sticky topic nav bound to the page's own sections.
- **Reject** — The photographic hero with white text over it, and the dark
  theme generally; both are brand positions DataNepal has already ruled out.
  Treemaps as a default for composition. And above all the page length: the
  Morelos profile is **47,444 px** tall. It is the end state of a profile page
  with no length budget, and it is a warning, not a model.
- **Should influence** — `components/PlaceProfile.tsx` (KPI strip with
  vintage chips), the place-page section nav, and the "how this place differs"
  module.

### 3.6 Datawrapper

- **URL inspected** — `https://www.datawrapper.de/` and
  `https://www.datawrapper.de/blog/text-in-data-visualizations`
- **Captured** — `datawrapper-home.png`,
  `datawrapper-chart-text-annotation.png`
- **Design problem it owns** — *Craft inside a single chart*, especially text:
  labels, annotation, number formatting, and how many type sizes a chart may
  use.
- **Borrow** — Label series directly instead of with a legend ("Imagine if
  every object in a museum were labeled only right next to the door"); limit
  the number of font sizes in a visualization; be conversational first and
  precise later; left-align rather than centre. Also the review device itself:
  `NOT IDEAL` / `BETTER` side by side, which is a better format for the
  project's own visualization docs than prose rules.
- **Reject** — Nothing structural, because this is a product marketing site
  rather than a data product: do not take its homepage composition, its
  pricing-page register, or its chart defaults as DataNepal's. It informs
  chart craft only.
- **Should influence** — `components/charts.tsx`, `components/MapLabels.tsx`
  (see audit §9), `docs/visualization.md`, and the `datanepal-dataviz` skill.

---

## 4. Capture conditions and access limitations

Captured 3 October 2026 via Chrome DevTools MCP at 1440 × 1000, DPR 1.

- **Data México — one profile URL is server-side broken.**
  `/en/profile/geo/jalisco` returns
  `{"error":"TypeError: Cannot read property 'path' of undefined"}` from the
  site's own renderer. Profile URLs on this site carry a state suffix; the
  working form `/en/profile/geo/morelos-mo` was used instead, and the
  reference is complete. No DataNepal-side limitation.
- **Cookie consent banners** appeared on Our World in Data, ONS, Eurostat and
  Datawrapper. Each was dismissed via its own reject control before capture,
  except ONS, which replaces the banner with a persistent "You have rejected
  all additional cookies" band — visible at the top of
  `ons-explore-local-statistics-home.png` and not removable.
- **No reference required a login, and none was blocked** by access controls,
  robots restrictions, or the corporate proxy. Every URL listed above was
  inspected directly; no entry in this index is URL-only analysis.
- Eurostat RCI is a heavy client-side application and needs several seconds
  before the map and distribution plot paint; a capture taken too early shows
  an empty frame.
