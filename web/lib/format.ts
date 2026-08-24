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
  switch (unit.unit_kind) {
    case "ratio":
      return `${value.toFixed(1)}${unit.symbol ?? "%"}`;
    case "currency":
      return `${unit.symbol ?? ""}${value >= 1000 ? formatCompact(value) : value.toFixed(2)}`;
    default:
      return formatNumber(value);
  }
}

/** Human label for an observation status, or null when it needs no comment. */
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

  So selection is by shape rather than by name: the aggregate is the row with
  the fewest dimension members that are not a total. A new dimension therefore
  costs nothing here, which is the property the canonical model is supposed to
  have.
*/

/** Members of a dimension key that are not the '=all' total. */
function specificMembers(dimensionKey: string): string[] {
  if (dimensionKey === "none") return [];
  return dimensionKey.split("|").filter((part) => !part.endsWith("=all"));
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

/** The least specific row: the aggregate across every dimension. */
export function pickAggregate<T extends Dimensioned>(rows: T[]): T | undefined {
  return [...rows].sort(
    (a, b) =>
      specificMembers(a.dimension_key).length -
        specificMembers(b.dimension_key).length ||
      a.dimension_key.length - b.dimension_key.length,
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
  return [...matching].sort(
    (a, b) =>
      specificMembers(a.dimension_key).length -
        specificMembers(b.dimension_key).length ||
      a.dimension_key.length - b.dimension_key.length,
  )[0];
}
