# After the component system

The same pages and viewports as `../current/`, captured once `/design-lab`
existed and Dhading had been refactored onto it. Captured 3 October 2026
against the **production build** (`npm run build && npx serve out`), not the
dev server, per `datanepal-visual-review`.

Paired with `../current/` these are the evidence for what changed. Only
Dhading and the laboratory were touched: every other page is unchanged by
design, and the baseline still describes them.

| File | What it shows |
|---|---|
| `design-lab-desktop-01-metrics.png` | HeadlineMetric: lead, grouped, missing, long value |
| `design-lab-desktop-02-benchmark.png` | Benchmark and the one-observation degradation |
| `design-lab-desktop-05-geo.png` | Administrative and choropleth modes side by side |
| `design-lab-mobile.png` | The laboratory at 390px |
| `dhading-desktop-overview.png` | Identity, locator sentence, P-code chip, metric strip |
| `dhading-desktop-demographics.png` | Population and Education, with the benchmark |
| `dhading-desktop-age-sex.png` | Pyramid, labelled 2023 projection against a 2021 headline |
| `dhading-desktop-local-map.png` | Map and ranking as linked views |
| `dhading-desktop-wide.png` | 1920px — container caps at 1344, gutters balanced |
| `dhading-tablet.png` | 834px |
| `dhading-mobile.png` | 390px, top |
| `dhading-mobile-age-sex.png` | Chart-heavy at 390px |
| `dhading-mobile-local-map.png` | Map-heavy at 390px, "Dhunibenshi" legible |
| `indicator-elections-desktop.png` | A distribution-only indicator: labelled leading member, ranked members |
| `bagmati-desktop-overview.png` | Province identity, metric strip, age-sex nested under Population |
| `bagmati-desktop-education.png` | Bagmati vs Nepal benchmark |
| `bagmati-desktop-districts.png` | District map and linked ranking; all 13 labels legible |
| `bagmati-tablet.png` · `bagmati-mobile.png` · `bagmati-mobile-districts.png` | 834px and 390px |
| `nilkhantha-desktop-overview.png` | Local-government identity and metrics |
| `nilkhantha-desktop-education.png` | Four-level benchmark: local · district · province · Nepal |
| `nilkhantha-tablet.png` · `nilkhantha-mobile.png` | 834px and 390px |
| `kathmandu-desktop.png` | Densest district; age-sex nested, out of the jump nav |
| `sudur-paschim-desktop.png` | Longest Nepali name in the country |
| `manang-desktop-local-map.png` | Fewest local governments (4); quantile legend adapts |
| `sarlahi-mobile-local-map.png` | Most local governments (20), at 390px — all labelled |
| `lg-kathmandu-metropolitan-desktop.png` | A metropolitan city named after its own district |
| `lg-longest-nepali-desktop.png` | बाह्रगाउँ मुक्तिक्षेत्र गाउँपालिका — longest Nepali name |
| `lg-longest-english-mobile.png` | Diktel Rupakot Majhuwagadhi at 390px — 27 characters, two lines |
| `nepal-desktop-overview.png` | Nepal's own page: identity, metrics, ten topic sections |
| `nepal-desktop-elections.png` | Elections as a distribution, and the province map with its ranking |
| `nepal-tablet.png` · `nepal-mobile-age-sex.png` | 834px and 390px |
| `compare-desktop-default.png` | /compare as it opens: Nepal and Kathmandu, containment named |
| `compare-desktop-four-districts.png` | Four districts under four different provinces |
| `compare-desktop-five.png` | The five-place maximum, input disabled with a reason |
| `compare-tablet.png` · `compare-mobile.png` · `compare-mobile-table.png` | 834px and 390px |

**What to look for against `../current/`.** The fact strip's figures went from
22px — the same size as the section headings above them — to the `stat` role.
The population total no longer appears twice within 300px. The local-government
section was a map alone in a 760px frame with a 13-row list of names and
values below it; it is now a map and a ranking reading the same data, with the
list reduced to the type grouping only, which is the one thing neither of the
other two says. Map labels carry a halo, so a name that overhangs its polygon
survives. Every disclosure says the same kind of thing in the same place.

**Measured, not eyeballed.** No horizontal overflow at 390, 834, 1440 or 1920
on any of the three pages. Type at 1440: h1 52 · stat 30 · heading 22 ·
body 15. At 834: 45 · 27 · 18. At 390: 36 · 24 · 17. Dhading 4,970 → 4,858.

**Sixth stage.** `/compare`, the audit's §8 and the one route on the redesign
proposal's list that adds a capability rather than removing duplication.

Every place page could already compare its own children, which is the
comparison the data made easy rather than the one a reader arrives with: Humla
against Kathmandu is two districts in different provinces. `compareFor` has
always taken an arbitrary list of places; nothing ever passed it one.

Worth opening with four districts selected. The containment note is the part
that took the most care — comparing a district with its own province is a fair
question and a trap, because the larger figure already includes the smaller.

**Fifth stage.** Nepal's own page, at `/np/`. It had never existed: every
level below the country had a profile and the country did not, because the
homepage looks like it fills that role and does not. It is the only page with
all 36 indicators, so it carries ten topic sections where every other place
carries two, and the only page with no benchmark — Nepal has no ancestor, and
comparing a national figure with itself would be a fabrication.

Elections is the section worth opening. All three of its indicators are
dimensioned by party with no total, so a profile built from scalars drops the
topic entirely — on the one page in the country where the election happened.
It renders the ranked parties instead, saying plainly that they are components
rather than a total.

**Fourth stage.** All 753 local-government pages. `check-place-pages.mjs`
now covers 837 pages in under a second and the vitest counterpart walks every
benchmark in the country. The three screenshots at the foot of the table are
the identity cases: a place named after its district, the longest Devanagari
name, and the longest Latin one on a phone.

Kathmandu Metropolitan City is the one worth opening. Its benchmark used to
read "Kathmandu 90.5%" above "Kathmandu 89.2%" with nothing to say which was
the page you were on — 18 local governments share a name with an ancestor, and
three of those collide with their province rather than their district.

**Third stage.** All 7 provinces and 77 districts now use the system. Rather
than open 84 pages, `web/scripts/check-place-pages.mjs` asserts the
invariants the proof pages established against the built HTML of every one of
them, and runs as `postbuild` so a regression fails the build. The four
screenshots at the bottom of the table are the extremes it cannot judge:
density, name length, and the sparsest and busiest local maps.

**Second stage.** `bagmati-*` and `nilkhantha-*` are the province and
local-government proof pages. Their "before" is
`../current/province-desktop.png` and `../current/nilkhantha-desktop-overview.png`
— the latter captured by checking the page file back out at `acee412`, because
no baseline had ever been taken at that level.

The district map labels are the change most worth looking at twice. Six of
Bagmati's thirteen districts — Kathmandu, Lalitpur, Bhaktapur, Kavrepalanchok,
Makwanpur and Chitawan — rendered as white text with a white halo and were
invisible, on every province page and the national map. One ink plus a halo
fixed all of them.
