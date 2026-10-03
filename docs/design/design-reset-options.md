# Design reset — directions, and the approved synthesis

Three prototypes on the same real data. A and B were the originals, built to be
chosen between. The **unified** direction is the approved outcome: Direction A's
visual and brand system with Direction B's geographic behaviour restyled into
it.

**Nothing here is implemented in production.** The routes exist only in `next
dev` and in a Cloudflare branch preview; `next.config.mjs` keeps them out of the
public build entirely, which is verified on both sides below.

| | Direction A | Direction B | **Unified (approved)** |
|---|---|---|---|
| Name | Editorial Statistical Publication | Geographic Civic Atlas | A's system, B's geography |
| Homepage | `/design-reset/editorial/home/` | `/design-reset/atlas/home/` | `/design-reset/unified/home/` |
| Dhading | `/design-reset/editorial/dhading/` | `/design-reset/atlas/dhading/` | `/design-reset/unified/dhading/` |

Index at `/design-reset/`. Screenshots in `docs/design/references/design-reset/`.

---

## Unified — the approved synthesis

Direction A is the visual and brand system. Direction B contributes behaviour
only, restyled to belong to A. One design, not two systems on different pages.

### Retained from A

Brand identity and the light shell. Bilingual masthead. Editorial serif for
masthead, page title, section headings and standalone lead figures. Numbered
section rhythm with hairline rules and no cards. Prose width. Source treatment.
The rule-separated national snapshot. The benchmark number line. The reading
order: country now → how it divides → domains → what moved → how to take it.

### Retained from B

The linked map and ranking as one control — hover *and* focus on either
highlight both. Metric switching. Every map shape a real link. The ranked list
beside the map, which is how a reader finds a specific place.

### Deliberately removed

B's dark application chrome and its sticky dark header. The rounded-card grid.
Black pill controls, replaced by underlined text tabs. B's compact KPI tiles,
replaced by A's rule-separated row. The dashboard framing generally: the
GeoExplorer is a `<figure>` with a caption and a source line, not a panel.

### Resolved by measurement, not taste

**Type roles.** Digit metrics at 48px/600: the serif resolves to Iowan Old
Style with every digit 28.52px wide — lining and tabular already. The sans
(`ui-sans-serif`) is *proportional*: "1" is 21.6px against "0" at 29.5px. So the
first instinct, that the serif is the risky one in a column, is backwards on
macOS. Two rules came out of it: every columnar number carries `.tabular`
(which equalises the sans to 29.37px), and the serif stays restricted to
figures that stand alone, because the stack falls back to Georgia off macOS and
Georgia *does* set old-style figures.

**Mobile map labels.** At 390px the Dhading map renders 350px wide from a
700px frame, putting a 14px label at 5.7px. Labels are now hidden below 640px
and the ranking moves above the map, so the names arrive in full before the
shape does. Verified: touch targets 44px on both the tabs and the ranking rows.

**Ranking bars.** The ranking started as a bare list of numbers. It now carries
a zero-based bar per row, which is Direction A's ranked-bar richness inside
Direction B's linked control — and the bar turns ink when its shape is
highlighted.

### Page length

| | A | B | Unified |
|---|---|---|---|
| Homepage, 1440px | 4,423px | 1,988px | **3,051px** |
| Dhading, 1440px | 3,923px | 2,766px | **3,371px** |

The homepage is 31% shorter than A. It sits ~50px above the 2,500–3,000 target
band, and the reason is a deliberate late change: topic descriptions were cut
and then restored, at a cost of about 156px, after the reviewer said they liked
how substantial A's domain list felt. Cutting them again returns it to 2,895px.
That is a content call, not a layout constraint.

### Against the three questions

- **Shorter than A?** Yes — 31% on the homepage, 14% on Dhading.
- **More distinctive than B?** Yes. The serif masthead, Devanagari at title
  scale and the absence of cards are all A's, and none of them survive in B.
- **Map as usable as B?** Yes, and better on mobile. Same linked behaviour and
  the same 13 real links, plus the ranking-first reflow and the hidden-label
  threshold, neither of which B has.

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

## The decision, and what is left of it

**Decided.** A as the global visual and brand system, with B's geographic
behaviour integrated and restyled to belong to it. Built and prototyped above.
A and B remain in the repository as the record of what was compared.

**Still open, and needing a human call:**

1. **Topic descriptions on the homepage.** Restored on request; they cost about
   156px and put the page ~50px over the length target. Keep or cut.
2. **The serif.** A system stack today, so it renders as Iowan Old Style on
   macOS, Palatino or Georgia elsewhere. Shipping it properly means committing a
   second font file — the same decision that was just made for the Devanagari
   face.
3. **Nepali district names.** `name_ne` is NULL for all 77. Both the unified
   Dhading page and its predecessors say so rather than transliterate. This is
   the largest content gap behind the bilingual design and sits upstream of any
   layout work.

Nothing here is in production. The next prototypes — topic, indicator,
local-government, map explorer — come before any rollout.
