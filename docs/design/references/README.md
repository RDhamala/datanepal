# Visual reference pack

Three things live here, and they are not the same kind of artefact.

- `approved/` — the **approved visual prototype**. One image, and the current
  north star for the product's visual direction.
- `current/` — **baseline screenshots of the live implementation** (24 desktop,
  7 mobile), captured before any redesign work, so that "what changed" is
  answerable later with evidence rather than memory.
- `external/` — **focused captures of six comparable products**, each held for
  one specific problem it solves well. Read them through
  [`../reference-index.md`](../reference-index.md), which states for each what
  to borrow, what to reject, and which component it should influence; the
  images alone invite copying the surface.

Verified defects in the current implementation are in
[`../current-ui-audit.md`](../current-ui-audit.md).

---

## The approved prototype

`approved/datanepal-visual-prototype.png` (1190 × 1024) shows three surfaces:
the homepage on the left, a province page and a district page on the right.

**It is a visual north star, not a pixel-perfect specification.** Match its
intent; do not match its measurements. Where the prototype and this
repository's constraints disagree, the constraints win and the disagreement
gets written down — in a commit message, or an ADR if it is structural.

### What is intentional, and should be read as direction

- **Hierarchy.** A large display title, a single clear entry point, then
  progressively denser data below. The page states what it is before it
  states what it knows.
- **Composition.** A wide, grid-driven layout that uses its full width;
  content sits in bounded cards with visible edges rather than floating in an
  undifferentiated column.
- **Search prominence.** Search is a primary element of the hero, at
  substantial width, with example queries directly beneath it — not a decorated
  input tucked into the header.
- **Map prominence.** Geography is a first-class way in. A map appears in the
  hero, again as the main "Explore Nepal" module paired with a ranked list,
  and again on each place page. Maps are navigation here, not illustration.
- **Chart prominence.** Every data module carries a chart, and the charts are
  given real area: ranked bars, sparklines inside KPI tiles, long-run lines,
  and a population pyramid. Numbers are shown with their shape.
- **Place-profile structure.** A place page opens with breadcrumb, bilingual
  title, and a KPI strip; then a dominant chart beside a "Key facts" panel;
  then a map of the place; then its child geographies, listed and linked.
  That sequence — identity, headline, distribution, geography, children — is
  the part most worth preserving.
- **Bilingual presentation.** English and Nepali shown together in titles,
  with a visible language control.

### What must not be copied

The prototype was drawn to show composition, so it fills space with values and
affordances that do not exist. Copying any of these would put a confidently
wrong number or a dead control on the site, which is the single failure mode
this platform is organised against.

- **Fabricated or wrong figures.** The hero reads "5 Indicators available"
  (the platform publishes 36). The Madhesh panel lists "753 Wards" — 753 is
  Nepal's local-unit count nationally, not Madhesh's ward count. Treat every
  number in the image as lorem ipsum.
- **"Coming soon" as a design element.** Eight of the ten topic tiles are
  labelled "Coming soon"; in the live platform all ten carry data. An empty
  state should describe real coverage, never advertise absence as a feature.
- **Functionality that does not exist.** The API button, the email-subscribe
  form, the social-media icons, and the map zoom and home controls are drawn,
  not built. Do not ship chrome for a capability that is not there.
- **Navigation that promises coverage the data cannot meet.** The place pages
  show a tab bar — Overview / Population / Economy / Government / Education /
  Health / More — for a place that has sub-national data in two of those.
  Live place pages carry a section nav listing only the sections actually
  present, which is the honest version of the same idea. Keep the prototype's
  prominence for it; do not adopt its list.
- **Figures without their status.** The prototype prints "Population (2023)
  30.9M" as a headline. Published figures carry their status and reference
  period — 2021 census is `actual`, 2023 UNFPA is `projection` — and mixing
  them silently is prohibited (see `CLAUDE.md`).
- **Its choice of examples.** Madhesh and Dhanusa are illustrative. They are
  not a statement about which places matter.

### Decoration

The prototype uses rounded cards, soft shadows, tinted topic icons and a dark
footer. Adopt these **only where they fit the brand** in `docs/brand.md` — a
reference work, not a SaaS dashboard. The test for any decorative element is
whether it helps a reader find or trust a number. Icons that merely label a
topic, and shadows that merely separate what a border already separates, fail
that test. Density and composition are what to take from the prototype; the
ornament is the most optional part of it.

### Constraints the prototype does not override

Nothing in the image relaxes any of these:

- **Real data only.** Every figure comes from the published warehouse, with a
  named publisher, reference period and retrieval date.
- **Accessibility.** Colour choices go through `npm run palette`; charts need
  non-colour encodings and reachable text alternatives; the type scale must
  stay legible at mobile widths.
- **Provenance.** Source, licence and vintage travel with the data onto the
  page. A module with no provenance does not ship.
- **Maintainability.** 753 local-government pages are generated from one
  component. A design that requires per-place handwork is not a design this
  platform can hold.

### Authority

This file plus `approved/datanepal-visual-prototype.png` are the only approved
visual reference. **Older prototypes, mockups and screenshots are not equally
authoritative** — not `docs/redesign-proposal.md` (explicitly marked
"proposal, not agreed"), and not anything in `current/`, which records what
exists rather than what is wanted. If an earlier artefact should carry weight,
document that here, with a date and a reason.

---

## The current baseline

`current/` holds the live implementation as of the capture date below. These
are evidence, not targets: they are what a redesign is measured *against*.

### Desktop — 1440 × 1000

| File | Page / section |
|---|---|
| `home-desktop-hero.png` | Homepage: hero, search, Nepal today KPIs |
| `home-desktop-map.png` | Homepage: Explore Nepal map and province ranking |
| `home-desktop-topics.png` | Homepage: Explore by topic grid |
| `home-desktop-trends.png` | Homepage: Long-run trends |
| `home-desktop-updates-footer.png` | Homepage: Latest updates, data access, footer |
| `home-desktop-full.png` | Homepage, full page (4,117 px) |
| `topics-desktop.png` / `-full.png` | Topics index |
| `places-desktop-map.png` | Places: national map, all 77 districts |
| `places-desktop-provinces.png` | Places: by-province listings |
| `places-desktop-full.png` | Places, full page |
| `indicators-desktop.png` / `-full.png` | Indicators index (6,605 px) |
| `datasets-desktop.png` / `-full.png` | Datasets catalogue |
| `about-desktop.png` / `-full.png` | About |
| `province-desktop.png` / `-full.png` | Bagmati Province |
| `dhading-desktop-overview.png` | Dhading District: top |
| `dhading-desktop-demographics.png` | Dhading: population and education |
| `dhading-desktop-age-sex.png` | Dhading: age and sex structure |
| `dhading-desktop-local-map.png` | Dhading: local-government map |
| `dhading-desktop-full.png` | Dhading, full page (4,854 px) |

### Mobile — 390 × 844, DPR 2

| File | Page / section |
|---|---|
| `home-mobile.png` / `-full.png` | Homepage (7,058 px full) |
| `places-mobile.png` | Places |
| `indicators-mobile.png` | Indicators |
| `dhading-mobile.png` | Dhading District, top |
| `dhading-mobile-age-sex.png` | Chart-heavy: population pyramid |
| `dhading-mobile-local-map.png` | Map-heavy: local-government choropleth |

Full-page captures are provided where the page stays reviewable at full
height. Where a page runs past roughly 5,000 px — the indicators index at
6,605, the mobile homepage at 7,058 — the sectioned viewport captures are the
ones to read, and the full-page file is there for completeness.

### How these were captured, and how to reproduce them

```bash
cd web && npm run dev        # http://localhost:3000
```

Then, with Chrome DevTools MCP: desktop at `resize_page 1440 × 1000`; mobile
at `emulate viewport 390x844x2,mobile,touch` — note that `resize_page` alone
floors at roughly 500 px wide, so mobile widths need the emulation path. The
Next.js dev overlay is hidden before each shot by injecting
`nextjs-portal,[data-nextjs-toast]{display:none!important}`. Sectioned shots
scroll to a heading's offset minus ~100 px to clear the sticky header.

**Capture date:** 3 October 2026, branch `desktop-type-scale` at `d069834`.
**Data vintage:** the `publish/dist` build of 24 August 2026.

One deviation worth recording: the working tree's uncommitted ADR-0008 change
makes `places()` filter on `is_current`, a column that build predates, so the
app renders empty with it applied. Those two web files were stashed for the
capture and restored afterwards. The change is data-model only and has no
visual effect, so these screenshots are a faithful record of the committed
interface — but a re-capture after `make build && make publish` is the way to
confirm that, and is worth doing once the temporal work lands.
