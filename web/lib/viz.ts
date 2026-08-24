/**
 * The DataNepal visualization system.
 *
 * One place where chart geometry, type sizes, stroke weights and colour roles
 * are decided, so that charts stop being designed independently. Before this
 * existed the codebase carried four different body sizes across charts, four
 * stroke weights, three separate map components with three label systems, and
 * gridlines that appeared or did not depending on which chart you were looking
 * at. Individually all defensible; together not a system.
 *
 * The rule for adding to this file: a token earns its place when two charts
 * would otherwise disagree. A token used once is a magic number with extra
 * steps.
 *
 * Companion prose, including which chart answers which question, is in
 * docs/visualization.md. That document is the part a designer reads; this is the
 * part the code reads, and they are meant to say the same thing.
 */

/* ------------------------------------------------------------- typography */

/*
  Four sizes, and only four.

  Chart text is not body text: it is read in glances, at a distance, against
  fills. So it gets its own small scale rather than borrowing the page's. The
  sizes are deliberately far apart -- 9, 11, 13, 17 -- because a scale whose
  steps are one pixel apart is a scale nobody can hold in their head, and the
  first version of this codebase had 10, 11, 12, 13, 14, 15, 17 and 18 in charts
  alone.
*/
export const TYPE = {
  /** Axis ticks, in-map labels, footnotes. The smallest legible size. */
  micro: 9,
  /** Series labels, legends, table cells, value annotations. */
  small: 11,
  /** Chart subtitles, benchmark rows, anything read as a sentence. */
  body: 13,
  /** A single headline number. */
  figure: 17,
} as const;

/** Tailwind classes for the same scale, for HTML rather than SVG. */
export const TYPE_CLASS = {
  micro: "text-[9px]",
  small: "text-[11px]",
  body: "text-[13px]",
  figure: "text-[17px]",
} as const;

/* ----------------------------------------------------------------- layout */

/*
  Chart margins.

  Asymmetric on purpose. The left gutter holds value-axis labels, the bottom
  holds category or time labels, and the top needs only enough room for the
  tallest value label not to clip. Charts that reserved equal space on all four
  sides wasted a third of their width on nothing.
*/
export const MARGIN = {
  /** A trend or scatter: axis labels on two sides. */
  plot: { top: 10, right: 8, bottom: 18, left: 34 },
  /** Ranked bars: names live outside the plot, values at the end of each bar. */
  ranked: { top: 2, right: 44, bottom: 2, left: 0 },
  /** A sparkline: no axes at all, just enough not to clip the stroke. */
  spark: { top: 3, right: 3, bottom: 3, left: 3 },
} as const;

/** Bar and row geometry, so two ranked charts are never differently dense. */
export const BAR = {
  /** Row height including its gap. Comfortable at a glance, not airy. */
  row: 22,
  rowCompact: 18,
  /** Bar thickness within that row. */
  thickness: 10,
  thicknessCompact: 8,
  /** Corner radius. 1, not 0 and not 4: enough to look drawn, not styled. */
  radius: 1,
} as const;

/* ------------------------------------------------------------------ lines */

/*
  Stroke weights, in ascending order of importance.

  This is the whole hierarchy, and it is a hierarchy rather than a set: a
  gridline must recede behind a series, a series must sit above it, a boundary
  must divide, and a group boundary must divide more strongly than a member
  boundary. Weights that do not form an order produce maps where the district
  border and the province border look the same, which is a bug that reads as a
  design choice.
*/
export const STROKE = {
  gridline: 1,
  /** A reference or benchmark line: present, subordinate to the data. */
  reference: 1,
  /** Boundary between adjacent map shapes. */
  boundary: 0.8,
  /** Boundary between groups of shapes -- provinces over districts. */
  boundaryGroup: 1.6,
  spark: 1.25,
  /** A data series. The heaviest thing on a chart, because it is the point. */
  series: 1.75,
  /** Hover and focus, which must beat every resting weight. */
  active: 2,
} as const;

/*
  Gridlines: value axis only, and few.

  A grid on both axes turns a chart into graph paper and competes with the data
  for attention. Ticks are capped at four because a reader uses gridlines to
  estimate, not to measure -- the table underneath every chart is for measuring.
*/
export const GRID = { maxTicks: 4 } as const;

/* ------------------------------------------------------------------ colour */

/*
  Colour roles, as CSS variable references.

  Every one of these is defined in app/globals.css and validated by
  scripts/check-palette.mjs, which checks categorical separation under the three
  common dichromacies and sequential ramps for lightness monotonicity. Charts
  reference roles, never hex, so dark mode and CVD validation happen in one place.

  There is deliberately no per-topic colour. Assigning Education a green and
  Economy a blue would spend the identity channel on something a heading already
  says, and would then have to invent a colour for every future topic -- which is
  how a palette becomes a rainbow.
*/
export const COLOR = {
  /** The default single series. Most charts show one thing. */
  series: "var(--color-series-1)",
  /** The second series, when a comparison genuinely needs two. */
  seriesAlt: "var(--color-series-2)",

  /** Sequential ramp, low to high. Flips anchor in dark mode by design. */
  sequential: [
    "var(--color-seq-1)",
    "var(--color-seq-2)",
    "var(--color-seq-3)",
    "var(--color-seq-4)",
    "var(--color-seq-5)",
  ],

  /*
    Diverging scale, defined and currently unused.

    It exists so that the first indicator with a meaningful midpoint -- a budget
    surplus and deficit, a change against a national average -- does not get a
    sequential ramp bent into service. Reaching for it when the data has no
    natural zero is the misuse to avoid.
  */
  diverging: [
    "var(--color-fall)",
    "var(--color-seq-2)",
    "var(--color-surface-sunken)",
    "var(--color-seq-3)",
    "var(--color-rise)",
  ],

  /** Movement. Not good and bad: more inflation is not "bad data". */
  rise: "var(--color-rise)",
  fall: "var(--color-fall)",

  /** No data. Distinct from zero, and never a pale end of the ramp. */
  missing: "var(--color-surface-sunken)",

  /** Structure. */
  gridline: "var(--color-line)",
  boundary: "var(--color-line-strong)",
  track: "var(--color-surface-sunken)",

  /** Interaction. */
  selected: "var(--color-selected)",
  ink: "var(--color-ink)",
  inkSoft: "var(--color-ink-soft)",
  inkFaint: "var(--color-ink-faint)",
  surface: "var(--color-surface)",
} as const;

/**
 * Ink for a label sitting on a sequential fill.
 *
 * The top two classes of the ramp are dark enough that black text on them fails
 * contrast, so labels there flip to the surface colour. Centralised because
 * every map and stacked bar needs the same answer and getting it wrong is
 * invisible until someone tries to read the darkest shape.
 */
export function inkOnSequential(bin: number | null): string {
  return bin !== null && bin >= 3 ? COLOR.surface : COLOR.ink;
}

/* ------------------------------------------------------------------ scales */

/**
 * Nice, rounded tick values for a value axis.
 *
 * Rounded to something a person would say out loud -- 0, 25k, 50k -- rather than
 * to the data's own extremes, which produce axes labelled 47,312 and 2,041,587.
 */
export function ticks(max: number, count = GRID.maxTicks): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ??
    magnitude * 10;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  return out;
}

/**
 * Quantile class breaks for a choropleth.
 *
 * Quantile rather than equal-interval, because Nepal's subnational
 * distributions are heavy-tailed almost everywhere: Kathmandu against 76 other
 * districts put roughly seventy of them in the palest equal-interval class and
 * erased the Terai/mountain pattern entirely. The cost is uneven class widths,
 * which is why every legend labels its actual breaks.
 */
export function quantileBreaks(values: number[], classes = 5): number[] {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length < classes) {
    const lo = sorted[0] ?? 0;
    const hi = sorted.at(-1) ?? 1;
    return Array.from(
      { length: classes - 1 },
      (_, i) => lo + ((hi - lo) * (i + 1)) / classes,
    );
  }
  return Array.from(
    { length: classes - 1 },
    (_, i) => sorted[Math.floor(((i + 1) / classes) * sorted.length)],
  );
}

/** Which class a value falls in, given breaks. Null for missing data. */
export function binFor(
  value: number | null | undefined,
  breaks: number[],
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}
