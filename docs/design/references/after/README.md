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
