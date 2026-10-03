# Design reset — two directions

Two high-fidelity prototypes, same real data, same content requirements,
different compositions. Built to be chosen between, not merged.

**Nothing here is implemented in production.** The routes exist only in `next
dev` and in a Cloudflare branch preview; `next.config.mjs` keeps them out of the
public build entirely, which is verified on both sides below.

| | Direction A | Direction B |
|---|---|---|
| Name | Editorial Statistical Publication | Geographic Civic Atlas |
| Homepage | `/design-reset/editorial/home/` | `/design-reset/atlas/home/` |
| Dhading | `/design-reset/editorial/dhading/` | `/design-reset/atlas/dhading/` |
| Index | `/design-reset/` | — |

Screenshots: `docs/design/references/design-reset/`.

---

## Direction A — Editorial Statistical Publication

**Core idea.** Reading order *is* the structure. The page is a numbered
sequence of chapters, each making one point and handing off. Data graphics are
illustrations in an argument, not tiles in a grid.

**Intended experience.** A reader scrolls top to bottom and has been told
something: here is the country now, here is how it divides, here is what has
moved, here is every domain, here is how to take the data away. A reader who
stops after chapter one has still learned the main thing.

**Strengths**

- Figures get room to be large. Dhading's population renders at ~64px against
  15px body text, so it reads as a finding rather than a field value. On the
  production district page every figure is the same size, so nothing is the
  answer.
- Highest readability of the two: one column, short standfirsts, generous
  leading.
- Strongest bilingual identity. नेपाल, तथ्याङ्कमा sits at title scale in brand
  blue directly under the English, not as a grey subtitle.
- Most distinctive. A system serif at display sizes does not look like any
  other open-data platform, and it costs no font download.
- Lowest implementation risk: layout and type, reusing existing chart
  components. No new client state.

**Weaknesses**

- Weakest at "find *my* place". There is no spatial entry point; a reader
  looking for one of 753 local governments must use search.
- The sequence is authored. Somebody has to decide chapter order and write the
  standfirsts, and that work recurs every time a domain lands.
- Long. 4,423px at 1440px and 7,406px at 390px — more than twice Direction B
  on the same content. That is the price of large type and one column.
- The serif is a system stack, so it renders differently on Windows, macOS and
  Android. Shipping it properly means committing another font file.

**Scalability.** Each new domain is a chapter, so the homepage grows in
*length*. Ten domains is comfortable; twenty-five would need the chapter list to
become a contents page.

**Mobile.** Degrades naturally — chapters stack, the two-column `LeadStat`
becomes one column. Nothing needs redesigning, only shortening.

**Accessibility.** Simplest of the two. No new interactive surface, so nothing
new to make keyboard-operable. The benchmark number line is visual-only by
nature and carries an `sr-only` sentence with the same three values, because a
mark positioned on an axis has no reading order.

**References used.** Our World in Data for chart anatomy (title → subtitle →
graphic → source, in that order). Census Reporter for the place-versus-parent
framing. Datawrapper for restraint in colour.

**Deliberately avoided.** News-article styling (no bylines, no drop caps, no
justified text). Cards. Any decorative imagery.

---

## Direction B — Geographic Civic Atlas

**Core idea.** Geography is the index. A map and its ranking are one control:
hovering or focusing either highlights both. Everything else sits in bounded
panels with a label, a control and a graphic.

**Intended experience.** A reader arrives knowing a place, finds it spatially or
in the ranked list, and drills down. The measure switcher means one surface
answers three questions.

**Strengths**

- Best at "find my place and compare it". The linked map/ranking removes the
  double scan the production place page forces — thirteen small map labels, then
  thirteen table rows, for one question.
- Highest information density. Measured at 1440px wide, the atlas homepage
  fits the map, four KPIs, ten domains, two trends, updates and data access in
  **1,988px** of scroll; the editorial homepage takes **4,423px** for the same
  content. Dhading: 2,766px against 3,923px.
- Better for professional users: metric switching, ranks and exact-data tables
  are all one interaction away.
- Dark chrome gives a strong, consistent identity without relying on type.

**Weaknesses**

- The main surface is a control, and controls can be ignored. A reader who does
  not realise the map is clickable gets less from the page than Direction A
  gives passively.
- No argued path. The page presents; it does not explain.
- Denser, so more for the eye to choose between — the failure mode is the
  "assembled portal" feel this reset exists to escape.
- Closer to Eurostat and Data México, so the risk of looking generic is real.
- Highest implementation risk. `AtlasMap` is new client state — selection,
  metric index, hover/focus sync — that has to be maintained and tested.

**Scalability.** Each new domain is a grid cell, so the homepage grows in
*density* rather than length. That scales further than A before it breaks, but
it breaks worse: at some point the grid becomes a wall.

**Mobile.** Needs real work, and the prototype shows why. At 390px the map
renders at ~350px wide with thirteen labels laid out for 980px, so the in-shape
names are too small to read and the ranked list below is doing all the work.
That is survivable — the list is complete and every row is a link — but a
production version needs either a mobile-specific label pass or a map that
hides labels under a threshold and relies on tap-to-identify.

**Accessibility.** More to get right, and it is got right here: the map is
`role="group"` with thirteen real links, the label layer is `aria-hidden`
(the strings are abbreviated layout text), highlighting responds to `focus` as
well as `hover` so a keyboard walk down the ranking lights up the map, and no
`<path>` carries a stray `tabindex`. Hover is enhancement only — with no
JavaScript the page is a map of links plus a ranked list of links.

**References used.** Eurostat Regions and Cities for linked map/ranking and
legend treatment. Data México for panel composition and place profiles. ONS for
the place-first journey and progressive disclosure.

**Deliberately avoided.** GIS chrome — no zoom, pan, layer tree or basemap. No
dashboard affordances: no gauges, no traffic lights, no KPI deltas coloured
green and red.

---

## Comparison

| Axis | A — Editorial | B — Atlas |
|---|---|---|
| **Discovery** | Sequential. A reader is led. Finding one specific place means search. | Spatial. Any place is two clicks from the map, but there is no path through it. |
| **Readability** | Highest. One column, large type, short standfirsts. | Denser. More per screen, more to choose between. |
| **Geographic exploration** | Supporting. The map illustrates; the ranking answers. | Central. Map and ranking highlight together, on hover and on focus. |
| **Topic scalability** | Grows in length — one chapter per domain. | Grows in density — one grid cell per domain. |
| **Professional users** | Good. Chart anatomy and provenance prominent. | Better. Metric switching, ranks, exact data one click away. |
| **Ordinary citizens** | Better. Nothing to operate. | Good, but the main surface is a control. |
| **Bilingual identity** | Strongest. Devanagari at title scale. | Present but smaller; dark chrome carries identity instead. |
| **Distinctiveness** | High. Few data platforms look like this. | Moderate. Nearer to existing statistical atlases. |
| **Implementation risk** | Lower. Layout and type; reuses existing charts. | Higher. New client state to maintain and test. |
| **Mobile** | Stacks naturally. | Map labels need a dedicated pass below ~500px. |

---

## What both directions do the same

These are content decisions, not visual ones, and they are settled either way.

- **Census and projection never mix.** Dhading shows 325,710 (2021 census) as
  the figure and 337,869 (2023 projection) as a separate, labelled facet.
- **No fabricated data.** Every number is published DataNepal data. The approved
  prototype's mock values were not copied — it shows GDP per capita at US$1,573;
  the real 2025 figure is US$1,535.88.
- **No national total where there isn't one.** Elections is dimensioned by party
  and has no aggregate, so its topic card shows an indicator count and no
  figure. Printing the leading party's seats as a national figure is the bug
  this platform already shipped once.
- **Empty domains are not advertised.** Tourism and Geography hold no indicators
  and are omitted rather than rendered as "Coming soon".
- **Sources are page-specific.** The Dhading pages list the two datasets that
  back something rendered, not the platform's six.
- **One primary visual, one exact-data fallback** for the thirteen local
  governments — not a map *and* a table *and* a second ranking *and* name lists.
- **Honest coverage language**: "36 indicators published, of which 5 go below
  the national level — all from the 2021 census."

## What neither direction could do

**Dhading has no Nepali name, and neither does any other district.** `name_ne`
is NULL for all 77 in the published spine. The brief asked for the verified
Nepali name; it does not exist, and this project's rule is that a guessed
transliteration in a reference dataset is worse than a visible gap. Both pages
say so instead of inventing one. Provinces and most local governments do have
Nepali names and both directions use them.

This is the single largest content gap behind the bilingual design question, and
it is upstream of any layout decision.

## Defect found while building this

`AgePyramid` hand-rolls its data table instead of using `DataGrid`, so it ships
with **no `<caption>` and no `scope` on any header**. On the live Dhading page
only 2 of 7 tables carry a caption. A screen reader reading that age-band table
gets a stream of unattributed numbers — the exact failure
`datanepal-accessibility` warns about. Not fixed here, because this task is
forbidden from touching production components. It is worth its own change.

---

## The decision

Both are credible. The choice is not which looks better — it is which job the
homepage has:

- If DataNepal's homepage should **explain the country**, choose A.
- If it should **be a way into the country**, choose B.

A third option exists and is not prototyped: A's homepage with B's place pages.
The editorial sequence is strongest where there is an argument to make (the
nation), and the linked map is strongest where there is a set to explore (a
district's local governments). That hybrid carries B's implementation risk only
on the pages that need it.

Once a direction is chosen, the next prototypes are topic, indicator,
local-government and the map explorer — before any production rollout.
