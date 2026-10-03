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

**What to look for against `../current/`.** The fact strip's figures went from
22px — the same size as the section headings above them — to the `stat` role.
The population total no longer appears twice within 300px. The local-government
section was a map alone in a 760px frame with a 13-row list of names and
values below it; it is now a map and a ranking reading the same data, with the
list reduced to the type grouping only, which is the one thing neither of the
other two says. Map labels carry a halo, so a name that overhangs its polygon
survives. Every disclosure says the same kind of thing in the same place.

**Measured, not eyeballed.** No horizontal overflow at 390, 834, 1440 or 1920.
Type at 1440: h1 52 · stat 30 · heading 22 · body 15. At 390: h1 36 · stat 24.
Page height 4,970 → 4,858 desktop.
