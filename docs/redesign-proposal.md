# Frontend redesign — proposal

Status: **proposal, not agreed.** Written 1 September 2026 against the live site
(data build 2026-08-24) and the code in `web/`.

**What I could not check.** The Chrome extension was not connected, so I have not
looked at a rendered page. Every visual judgement below is inferred from
`app/globals.css`, the component source, and the server-rendered HTML of eight
pages. Anything about *composition* — how much air a section actually has, where
the eye lands — needs `datanepal-visual-review` before it is acted on. The
structural findings do not depend on that.

---

## Diagnosis

**The site is a set of directories, and almost never an answer.**

Every page hands you a list of the things one level down. `/topics/` lists
indicators. `/indicators/` lists the same indicators, grouped the same way.
`/places/` lists districts. A place page lists its children. The pattern is
consistent, competent, and it means a reader who arrives with a question leaves
with a navigation tree.

The bloat and the weak discovery you named are the same problem seen from two
sides. Because no page commits to answering something, no page can leave
anything out — so each one renders every available representation of its data,
and none of them acquires a shape you could recognise or navigate by.

Three findings, in the order they matter.

### 1. The same data is rendered up to five times on one page

`/indicators/population/` presents Nepal's 77 districts as:

1. a choropleth
2. that map's "View data table" — 77 rows
3. a ranked bar list
4. "Highest and lowest" — a 10-row table
5. "View all 77 districts" — a second 77-row table

Four of these are the same numbers in the same order. The map and the ranked
list answer genuinely different questions — *where* and *how much* — and your
own place-page skill says so. The three tables do not; they are one accessibility
affordance that got copied into every component that renders a series.

The homepage does the same thing with time: 61 rows of inflation and 66 rows of
GDP are in the HTML of the front page.

This is not a styling problem. It is a component-level default — every chart
ships its own table — applied without a page-level view of how many times a
reader is about to see the same list.

### 2. `/topics/` and `/indicators/` are the same page

Both list 10 topics. Both show, under each topic, its indicators with a headline
national value. `/indicators/` adds the unit, the definition and the geographic
level; `/topics/` adds an observation count and a Nepali topic name. There is no
question one answers that the other does not.

They occupy two of the five top-level nav slots.

### 3. Coverage asymmetry is invisible until you hit an empty page

**Five of 36 indicators have data below the national level** — population,
households, literacy rate, literate population, population aged 5+ — and all
five come from a single source, the 2021 census. The other 31 are World Bank
national series.

Nothing in the interface says this. `/topics/health/` advertises "4 indicators"
with the same visual weight as Population's two. A reader on Karnali's page who
follows "Health" reaches a page with no Karnali in it. The place pages handle
this correctly by omitting empty sections, which means the absence is silent
rather than explained — the reader concludes the data does not exist, when in
fact it exists nationally and the site simply cannot say so.

### Also, and separately: a wrong number is on the site right now

`/indicators/` shows **"House of Representatives seats won, first-past-the-post
— 3"** as the national latest value. It shows PR votes as "385,902" and PR vote
share as "3.6%".

These are one arbitrary party's figures presented as the indicator's headline.
The mechanism is `pickAggregate` in `lib/format.ts`, which selects the least
specific row — the one with the fewest dimension members, tie-broken on
`dimension_key` string length. Every other dimension in the platform has an
`all` member (`sex`, `age_band`, `residence_type`, `literacy_status`).
**`party` does not**, and all 58 party ids are the same length, so the tie-break
falls through to source order.

This is the "confidently wrong number" failure mode `CLAUDE.md` is organised
around, and it is a design failure as much as a code one: the headline-value
pattern assumes every indicator reduces to a scalar. Elections do not. Neither
will most of what you ingest next — budgets by ministry, prices by commodity,
schools by level.

**Fix regardless of whether this proposal is accepted.** `pickAggregate` should
return `undefined` when no genuine aggregate exists, and the headline slot
should render a distribution or a "by party" affordance instead of a number.

---

## Proposed information architecture

The unit of the site becomes a **question**, and there are four:

| Question | Route | Status |
|---|---|---|
| What should I know about this place? | `/np/…` | exists, needs re-composition |
| What is this measure, and where does it vary? | `/indicators/…` | exists, needs re-composition |
| How do these places compare? | `/compare/` | **missing** |
| Where does this data come from? | `/datasets/` | exists, good as is |

**Navigation becomes:** Places · Indicators · Compare · Data · About

`/topics/` loses its nav slot and becomes a grouping *within* `/indicators/` — a
filter, not a destination. Topic URLs stay (place pages link to them, and they
are good landing pages for search), but they stop competing with Indicators for
the same reader. This removes an entire duplicate page and frees the slot for
Compare.

**Coverage becomes a first-class attribute in the interface.** Every indicator,
everywhere it is listed, carries its lowest available level as a visible
property — `National` / `To district` / `To local unit` — and `/indicators/`
gets a filter on it. The data already knows this. Today it is a small grey
string on one page; it should be the thing a reader can sort and filter by,
because "does this exist for my district" is the most common question the site
currently refuses to answer.

### `/compare/` — the missing verb

Pick 2–5 places at any level, see them side by side across every measure
published for all of them, with the national figure as a reference row.

This is the thing a journalist, a ward officer, or a researcher actually wants,
it is buildable from data you already publish, and `compareFor()` in
`lib/data.ts` is most of the logic — it is currently reachable only as
"compare the children of this one parent". Lifting that constraint is the
single highest-value addition on this list. It is also the natural home for the
non-additive discipline: a comparison view is exactly where someone is tempted
to sum a rate.

---

## Page-by-page

### Homepage — nine sections to four

Today: hero · 4 KPIs · map · topic grid · two long-run charts (with 127 rows of
inline tables) · latest updates · data access · sources. 567 lines.

Proposed:

1. **Search, meant seriously.** Not a decorated input above the fold — the
   primary entry. "Kathmandu", "literacy", "Dhanusa" should all resolve.
2. **Nepal today** — the four KPIs. Keep; they work.
3. **One map that is the navigation.** Province choropleth, click through. Drop
   the parallel ranked list on the homepage — the map plus its table is enough
   at seven items, and the ranking earns its place on indicator pages where
   there are 77.
4. **What changed** — the updates section, rewritten to say what *changed*
   rather than which sources exist. `observation_history` already holds this.

Topic grid moves to `/indicators/`. Data access moves to the footer and
`/datasets/`. Long-run charts move to their indicator pages, where a reader
looking for inflation will actually be.

### Indicator page — one view, with controls

Today: hero value · province ranking · district choropleth · three tables ·
interpretation · related · sources.

Proposed: a single **primary view** with an explicit control strip.

```
Literacy rate  साक्षरता दर                          76.2%  2021 census · NSO
─────────────────────────────────────────────────────────────────────────
[ Map | Ranking | Trend ]     Level: [ Province | District | Local unit ]
─────────────────────────────────────────────────────────────────────────
                        ( the view )
─────────────────────────────────────────────────────────────────────────
▸ Data table (77 rows)      ▸ How to interpret      ▸ Sources
```

Map and Ranking become toggles of one view rather than two stacked sections,
because they are the same data and the reader wants one at a time. One data
table, in a disclosure, at the bottom. `Trend` is disabled where there is one
period, which is itself informative.

This also gives the 31 national-only indicators a page that makes sense: Level
offers only National, Trend is the default view, and the map never renders — as
against today, where they get a hero number and very little else.

### Place page — say what is distinctive

Today the structure is right and your place-page skill is good. Two changes.

**Add a "How Humla differs" module**, directly under the fact strip: the two or
three measures where this place sits furthest from the national median, stated
in words. Humla's literacy is 63.8% against a 76.9% median — 74th of 77. That
is the story of the page, and today it is a caption under a bar chart.

This is computable from published data, it is the same component at every level,
and it is the single change that most converts a place page from a record into a
profile.

**Fix the known violation.** `[province]/page.tsx` and
`[province]/[district]/[local]/page.tsx` still render an explicit "Not yet
covered" section, which your own skill prohibits. It is also the wrong answer to
finding 3 — the honest version is a coverage note that distinguishes "no data
anywhere" from "national only".

### Topic page — a hub, or nothing

If `/topics/` loses its nav slot, individual topic pages need a reason to exist
beyond listing indicators. The reason is editorial: a topic page should open with
what the data *says* about that subject in Nepal — two or three sentences and one
chart — before the index of indicators. If that is not worth writing, the topic
page should redirect to `/indicators/?topic=health` and the route should go.

I would rather you decided this than have me assume it.

---

## Visual language

The colour system should not change. Role-based tokens, one accent held apart
from the series colours, a CVD-validated categorical pair, a monotonic
sequential ramp, and `check-palette.mjs` wired into `npm run check` — this is
better than most design systems ever get, and none of the problems above are
colour problems.

Three changes, in order of effect.

**1. Introduce a serif, for display and editorial only.**

This is the largest available move toward "distinctive" that does not violate
the no-decoration rule, and `brand.md` already names typography as where
identity comes from. A reference work reads as a reference work largely because
of its display face.

- Serif: page titles, section headings, editorial prose.
- Sans: every number, label, axis, table cell, chart annotation, all UI chrome.

The split is meaningful rather than aesthetic — it marks the boundary between
what DataNepal wrote and what the data says. Devanagari pairs as Noto Serif
Devanagari for the serif role, keeping Noto Sans Devanagari for data. The 1.06em
optical bump in `globals.css` was tuned for the sans pair and will need
re-deriving for the serif pair; it is not transferable.

**2. Widen the type hierarchy.**

Body is 15px. `--text-heading` clamps 17px → 22px. At the small end that is a
1.13× ratio between a section heading and body text — the CSS comment already
records that this made the page "read as one undifferentiated column", and the
clamp was the patch. The ratio is still thin at mobile widths, which is where
most Nepali readers will be. A statistical publication wants roughly 1.4× at the
floor, and the serif will carry part of that on its own.

**3. Let the numbers get bigger.**

`--text-stat` is 2rem — about 1.07× the title size. If data is the hero, the
headline figure on an indicator page should dominate its own heading, not tie
with it.

Explicitly **not** proposed: new spacing scale, rounder cards, shadows, icon set,
illustration. None of them address the diagnosis and all of them push toward the
SaaS register `brand.md` rules out.

---

## Sequence

Ordered by value per unit of risk, not by page.

**First — correctness, independent of the redesign**
Fix `pickAggregate` and the elections headline. A wrong number on a platform
whose entire argument is trustworthiness outranks everything else here.

**Then — the structural wins**
Kill the duplicate `/topics/` index and restructure nav · one data table per
page instead of five · surface coverage level as a filterable property.

These three remove more than they add, need no new components, and by themselves
address most of "undifferentiated and bloated".

**Then — the new capability**
`/compare/`. New route, mostly existing logic, highest reader value.

**Then — page re-composition**
Indicator page controls · homepage reduction · "How this place differs".

**Last — the visual language**
Serif pairing, type scale, stat size. Deliberately last: it is the most visible
change and the least load-bearing, and doing it before the structure settles
means doing it twice. It also needs a visual review pass I could not run.

---

## What I need from you

1. **Topic pages** — editorial hubs, or fold them into `/indicators/` and drop
   the route? This determines whether the nav change is a deletion or a
   redirect.
2. **Serif** — agreed in principle? It is the one proposal here that is a matter
   of taste rather than diagnosis, and it is reversible but not cheaply.
3. **`/compare/`** — is this the right missing verb, or is the gap something
   else you hear from readers that I cannot see from the outside?
4. **Nepali UI.** This proposal does not address it, and it is the largest gap on
   the site: the chrome is entirely English, there is no `/ne` locale, and 77
   districts still have no Nepali name. It is a bigger project than a redesign
   and it should not be smuggled into one — but it will interact with every
   layout decision here, so it is worth saying now whether it lands before or
   after.
