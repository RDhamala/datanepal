/**
 * Pure formatting and dimension helpers.
 *
 * Split out of lib/data.ts because that module reads Parquet from disk and is
 * therefore server-only, while the interactive map is a client component that
 * needs to format the values it switches between. Nothing here touches the
 * filesystem or the warehouse.
 */

import type { Unit } from "./types";

/* --------------------------------------------------------------- formatting */

const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf.format(Math.round(n));
}

/**
 * Convert a 0-1 share into the 0-100 value a `percent` unit expects.
 *
 * This exists because the two conventions coexist and mixing them is silent:
 * a female share of 0.495 rendered through a percent unit came out as "0.5%"
 * on a live page, next to a correctly-multiplied "67.5%". Both looked
 * plausible. Always route a share through here rather than remembering to
 * multiply.
 */
export function asPercentValue(share: number | null | undefined): number {
  if (share === null || share === undefined || Number.isNaN(share)) return 0;
  return share * 100;
}

export function formatPercent(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}

/**
 * Short form for axis labels and tiles.
 *
 * The `String(n)` fallback this replaces rendered raw floats onto chart axes --
 * an inflation tick came out as "2.7159265358979" and got clipped to garbage.
 * Axis labels need a bounded number of characters, always.
 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  /*
    Tiers run to trillions, not to millions.

    Stopping at M rendered Nepal's remittance inflow as "US$11254.5M" — a number
    a reader has to parse digit by digit to discover it means eleven billion.
    Nepal's GDP is around US$45B and its federal budget is around NPR 1.8
    trillion, so every economic magnitude past this first slice of indicators
    lands above the old ceiling. A missing tier does not error; it just prints
    something nobody can read.
  */
  if (abs >= 1e12) return `${(n / 1e12).toFixed(abs % 1e12 ? 1 : 0)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs % 1e9 ? 1 : 0)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs % 1_000_000 ? 1 : 0)}M`;
  if (abs >= 1_000)
    return `${(n / 1_000).toFixed(abs % 1_000 && abs < 10_000 ? 1 : 0)}k`;
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(abs % 1 ? 1 : 0);
  if (abs === 0) return "0";
  return n.toFixed(1);
}

/**
 * Change between the first and last point of a series, as a signed string.
 *
 * Rendered next to a headline figure because "what is it" and "which way is it
 * going" are the same question for a reader. Percentage-point change for rates,
 * percent change for levels -- conflating those is a classic statistical error.
 */
export function formatChange(
  from: number,
  to: number,
  unit?: Unit,
): { text: string; direction: "up" | "down" | "flat" } | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  const direction = to > from ? "up" : to < from ? "down" : "flat";

  if (unit?.unit_kind === "ratio") {
    // A rate moving from 5% to 7% rose by 2 percentage points, not by 40%.
    const pp = to - from;
    return { text: `${pp >= 0 ? "+" : ""}${pp.toFixed(1)} pp`, direction };
  }
  const pct = ((to - from) / Math.abs(from)) * 100;
  return {
    text: `${pct >= 0 ? "+" : ""}${pct.toFixed(pct >= 10 ? 0 : 1)}%`,
    direction,
  };
}

/** Render a value with its unit, respecting currency and percentage forms. */
export function formatWithUnit(value: number, unit: Unit | undefined): string {
  if (!unit) return formatNumber(value);
  const symbol = unit.symbol ?? "";
  // Nothing before a symbol that opens with % or /; a space before a word.
  // That gives 76.2%, 26.0% of GDP, 25.1/1000 live births and 3,344.3 kg/ha
  // from one rule.
  const join = (n: string) =>
    !symbol ? n : /^[%/]/.test(symbol) ? `${n}${symbol}` : `${n} ${symbol}`;

  switch (unit.unit_kind) {
    case "ratio":
      return join(value.toFixed(1));
    case "currency":
      return `${symbol}${value >= 1000 ? formatCompact(value) : value.toFixed(2)}`;
    /*
      Duration and area fell through to formatNumber, which drops the symbol
      entirely: life expectancy rendered as "71" on the Health topic page, the
      indicator table and every place page that quoted it, with the unit living
      only in a column header. A number whose unit is implied is a number a
      reader has to guess at.
    */
    case "duration":
      return join(value.toFixed(1));
    case "area":
      return join(formatNumber(Math.round(value)));
    default:
      return formatNumber(value);
  }
}

export function statusLabel(status: string): string | null {
  switch (status) {
    case "actual":
      return null;
    case "projection":
      return "projection";
    case "estimate":
      return "estimate";
    case "provisional":
      return "provisional";
    case "forecast":
      return "forecast";
    case "suppressed":
      return "withheld";
    case "not_collected":
      return "not collected";
    default:
      return status;
  }
}

export const AGE_BANDS = [
  "0-4",
  "5-9",
  "10-14",
  "15-19",
  "20-24",
  "25-29",
  "30-34",
  "35-39",
  "40-44",
  "45-49",
  "50-54",
  "55-59",
  "60-64",
  "65-69",
  "70-74",
  "75-79",
  "80+",
];

/** Build a canonical dimension key. Members must be sorted, as the pipeline does. */
export function dimensionKey(members: Record<string, string>): string {
  const parts = Object.entries(members).map(([d, m]) => `${d}=${m}`);
  if (!parts.length) return "none";
  return parts.sort().join("|");
}

/* ------------------------------------------------- dimension-key selection */

/*
  Choosing which observation represents an indicator, without knowing the
  dimension vocabulary.

  This matters more than it looks. The first version of these helpers matched
  dimension keys literally -- `sex=all|age_band=all` -- which worked while
  population was the only dimensioned dataset and broke silently the moment the
  census arrived keyed `residence_type=household|sex=all`. Nothing errored: every
  local government page simply showed a dash where its population should be.

  So selection is by shape rather than by name: the aggregate is the row whose
  every dimension is a total. A new dimension therefore costs nothing here,
  which is the property the canonical model is supposed to have.

  What the shape rule must NOT do is settle for the nearest thing available.
  The first version ranked rows by how few specific members they carried and
  took the first, so when an indicator had no total at all it returned the row
  that happened to sort first and presented it as the aggregate. Every
  dimension on the site carried an `all` member -- sex, age_band,
  residence_type, literacy_status -- so this went unnoticed until `party`
  arrived with 58 members, no total, and keys of uniform length: /indicators/
  published "3 seats" for an election the largest party won with 125.

  An aggregate that does not exist has to be reported as absent. Rendering
  nothing is a visible gap; rendering a component part as if it were the whole
  is a confident lie, and this platform's entire argument is that its numbers
  can be trusted.
*/

/** Members of a dimension key that are not the '=all' total. */
function specificMembers(dimensionKey: string): string[] {
  if (dimensionKey === "none") return [];
  return dimensionKey.split("|").filter((part) => !part.endsWith("=all"));
}

/** Dimensions a key declares at all, totalled or not. */
function declaredMembers(dimensionKey: string): string[] {
  return dimensionKey === "none" ? [] : dimensionKey.split("|");
}

/**
 * Count of dimension members that are not the total.
 *
 * Exported because `placeProfile` needs the same notion of specificity to pair
 * a sex split with its parent row, and two copies of this rule drifting apart
 * is precisely how the `=all` assumption survived unexamined for so long.
 */
export function specificity(dimensionKey: string): number {
  return specificMembers(dimensionKey).length;
}

/** True when every dimension this row declares is a total. */
export function isAggregate(dimensionKey: string): boolean {
  return specificMembers(dimensionKey).length === 0;
}

type Dimensioned = { dimension_key: string };

/*
  Enumerations before projections.

  A census is a count; a projection is a model. When both exist for a place --
  as they do for every province and district, NSO 2021 against UNFPA 2023 -- the
  headline should be the count, with the projection shown beside it as the later
  estimate it is. Picking purely by latest period gave districts a modelled 2023
  figure as their primary population while the actual enumeration sat unused,
  and put 2021 households next to 2023 population in the same section.

  No arbitrary staleness window. The most recent enumeration leads, the most
  recent projection is shown alongside when it is newer, and the reader has both.
*/
const STATUS_RANK: Record<string, number> = {
  actual: 0,
  provisional: 1,
  estimate: 2,
  projection: 3,
  forecast: 4,
};

const statusRank = (status: string): number => STATUS_RANK[status] ?? 5;

type Ranked = Dimensioned & { status: string; period_start: string };

const yearOf = (row: { period_start: string }): number =>
  Number(row.period_start.slice(0, 4));

/**
 * The row a headline figure should use: latest enumeration, else latest of
 * whatever there is.
 */
export function pickHeadline<T extends Ranked>(rows: T[]): T | undefined {
  const best = [...rows].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status) || yearOf(b) - yearOf(a),
  )[0];
  if (!best) return undefined;
  // Among rows of the winning status and period, take the aggregate.
  return pickAggregate(
    rows.filter((r) => r.status === best.status && yearOf(r) === yearOf(best)),
  );
}

/** The most recent modelled figure, when it postdates the enumeration. */
export function pickLaterEstimate<T extends Ranked>(
  rows: T[],
  headline: T | undefined,
): T | undefined {
  if (!headline) return undefined;
  const later = rows.filter(
    (r) =>
      statusRank(r.status) > statusRank(headline.status) &&
      yearOf(r) > yearOf(headline),
  );
  if (!later.length) return undefined;
  const newest = Math.max(...later.map(yearOf));
  return pickAggregate(later.filter((r) => yearOf(r) === newest));
}

/** `dimension` of a `dimension=member` part. */
const dimensionOf = (part: string): string => part.slice(0, part.indexOf("="));

/**
 * The row that represents the whole of what is published, or `undefined` when
 * no row does.
 *
 * Two shapes count as the whole, and the difference between them is the whole
 * of this function:
 *
 *   1. Every dimension is an explicit total -- `residence_type=all|sex=all`,
 *      or `none`. Unambiguous.
 *
 *   2. A dimension is specific but takes only one value across the rows in
 *      scope. A local government publishes its census population as
 *      `residence_type=household|sex=all` and never publishes any other
 *      residence type, because institutional population is carried at
 *      district level by design. A dimension that does not vary carries no
 *      information, so the row is still the whole of what exists.
 *
 * A dimension that *does* vary is a different matter: choosing one of its
 * members is choosing a part. Seats by party vary across 58 members, so there
 * is no whole, and `undefined` is the honest answer -- see the note above on
 * the three seats this used to report for a party that won 125.
 *
 * The residual risk is a source that publishes exactly one member of a
 * genuinely multi-member dimension, which rule 2 would accept as a total. The
 * census reconciliation tests are what hold that down: local units must sum
 * to 28,925,480 and there must be 753 of them, which no component part can
 * satisfy by accident.
 *
 * Deterministic throughout. Ties break on specificity, then on declared
 * dimensions, then on the key itself -- never on source order, which is what
 * made the old tie-break unpredictable when every key was the same length.
 */
export function pickAggregate<T extends Dimensioned>(rows: T[]): T | undefined {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    for (const part of declaredMembers(r.dimension_key)) {
      const dim = dimensionOf(part);
      const values = seen.get(dim) ?? new Set<string>();
      values.add(part.slice(dim.length + 1));
      seen.set(dim, values);
    }
  }
  const varies = (part: string): boolean =>
    (seen.get(dimensionOf(part))?.size ?? 1) > 1;

  const candidates = rows.filter((r) => !specificMembers(r.dimension_key).some(varies));
  if (!candidates.length) return undefined;

  return [...candidates].sort(
    (a, b) =>
      specificity(a.dimension_key) - specificity(b.dimension_key) ||
      declaredMembers(a.dimension_key).length -
        declaredMembers(b.dimension_key).length ||
      a.dimension_key.localeCompare(b.dimension_key),
  )[0];
}

/**
 * The row for one dimension member, aggregated over every other dimension.
 *
 * `pickMember(rows, 'sex', 'female')` finds female across all age bands and all
 * residence types, whichever of those the source happens to publish.
 */
export function pickMember<T extends Dimensioned>(
  rows: T[],
  dimension: string,
  member: string,
): T | undefined {
  const wanted = `${dimension}=${member}`;
  const matching = rows.filter((r) => r.dimension_key.split("|").includes(wanted));
  // Fewest *other* specific members: the wanted one is not a reason to rank a
  // row lower. Tie broken on the key itself rather than its length, so two
  // equally specific rows cannot swap places when the source reorders.
  return [...matching].sort(
    (a, b) =>
      specificity(a.dimension_key) - specificity(b.dimension_key) ||
      a.dimension_key.localeCompare(b.dimension_key),
  )[0];
}
