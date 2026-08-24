# Chart decision quick-reference

Use this when the grammar table in `SKILL.md` doesn't obviously resolve your case.
Still start from the question, not the data shape.

| Situation | Use | Not |
|---|---|---|
| Two meaningful points in time (e.g. 2011 vs 2021 census) | Slope chart or paired bars | A line chart with two points and empty space between — implies a trend where there's only two facts. |
| A rate that can't be summed across places (literacy rate, density) | `Benchmark` / `ComparePanel`, never totalled | Adding a "Nepal total" row by summing the column. |
| A count that *can* be summed (population, households) | `Benchmark`'s share framing (this place is X% of parent), ranked bars, or `ComparePanel` | A benchmark bar chart of raw counts across very different population sizes — three bars of wildly different magnitude tell a reader nothing. |
| Composition that must sum to 100% (literacy status, budget category) | `Composition` (100% stacked bar) | A pie chart, or a stacked bar that silently doesn't sum to the whole because a category was dropped. |
| Where one place sits in a distribution of many peers | `Distribution` (dot plot, median marked) | A histogram — binning hides which bar contains the subject place, and the reader's first question is usually "where is *my* place," not "what's the general shape." |
| A relationship between two measures across places | Scatterplot (not yet built as a shared component — if you need one, add it to `lib/viz.ts`'s grammar table, don't freehand it) | Forcing a two-variable relationship into a table or a dual-axis line chart. |
| Exact lookup, verification, or download | `FigureTable` / `DataTable` | Trying to make a chart serve as the only source of an exact number — every figure needs its table regardless. |
| A single number with no useful comparison yet | `MetricStrip` cell alone, honestly labelled with period/source | Inventing a fake benchmark or trend to fill visual space. |

If a genuinely new pattern is needed (the table above and the grammar table both
miss it), that's a signal to extend `lib/viz.ts` and `docs/visualization.md`
together — not to build a one-off chart with its own colours and type scale.
