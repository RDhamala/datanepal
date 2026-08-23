/**
 * Build-time data access.
 *
 * Reads the published Parquet from publish/dist/. Runs only during
 * `next build` -- nothing here reaches the browser.
 *
 * Parquet rather than JSON: JSON was fine at 4,590 observations and breaks at
 * ward scale, where a million-plus rows becomes hundreds of megabytes to parse.
 * hyparquet is pure JavaScript, so there is no native binding to fail in CI.
 */

import fs from "node:fs";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const DIST = path.join(process.cwd(), "..", "publish", "dist");

/* ------------------------------------------------------------------- types */

export type Place = {
  place_id: string;
  place_type: string;
  admin_level: number | null;
  name_en: string;
  name_ne: string | null;
  slug: string;
  parent_place_id: string | null;
  parent_name_en: string | null;
  parent_slug: string | null;
  ocha_pcode: string | null;
  area_sqkm: number | null;
  center_lat: number | null;
  center_lon: number | null;
};

export type Observation = {
  observation_id: string;
  dataset_id: string;
  indicator_id: string;
  place_id: string | null;
  period_start: string;
  period_end: string;
  period_type: string;
  value_numeric: number | null;
  value_text: string | null;
  unit_id: string;
  status: string;
  /**
   * Canonical fingerprint of the dimension set, e.g. `age_band=all|sex=female`,
   * or `none`. Members are sorted, so the key is stable and can be matched
   * directly -- which is why a page never has to join observation_dimensions.
   */
  dimension_key: string;
};

export type Indicator = {
  indicator_id: string;
  dataset_id: string;
  topic_id: string;
  name_en: string;
  name_ne: string | null;
  short_name_en: string | null;
  definition: string | null;
  default_unit_id: string;
  value_type: string;
  is_additive: boolean;
  notes: string | null;
};

export type PlaceBoundary = {
  place_id: string;
  admin_level: number;
  place_type: string;
  name_en: string;
  name_ne: string | null;
  slug: string;
  parent_place_id: string | null;
  ocha_pcode: string;
  /** GeoJSON MultiPolygon as a string, lon/lat. */
  geometry_geojson: string;
};

export type Topic = {
  topic_id: string;
  name_en: string;
  name_ne: string | null;
  slug: string;
  description: string | null;
  sort_order: number;
  status: "live" | "planned";
  indicator_count: number;
  observation_count: number;
};

export type Unit = {
  unit_id: string;
  unit_kind: string;
  symbol: string | null;
  name_en: string;
  currency_code: string | null;
  price_basis: string | null;
};

export type PublishedTable = {
  table: string;
  title: string;
  title_ne: string | null;
  description: string | null;
  grain: string | null;
  sources: string[];
  effective_licence: string;
  share_alike: boolean;
  contributing_licences: string[];
  attribution: string[];
  caveats: string[];
  row_count: number;
  parquet: string | null;
  json: string | null;
  bytes: number;
};

export type SourceDataset = {
  dataset_id: string;
  title: string;

  // Who produced the data. Attribution follows this, never the acquisition path.
  publisher: string;
  publisher_org_id: string;
  publisher_name_ne: string | null;
  publisher_homepage: string | null;
  source_tier: "A" | "B" | "C" | "D" | null;

  // Where DataNepal obtained this copy. Drives freshness and fragility, not
  // attribution.
  acquired_from: string;
  acquired_from_org_id: string;
  acquisition_method: string | null;
  acquisition_url: string | null;
  acquired_indirectly: boolean;

  url: string;
  licence: string;
  licence_statement_url: string | null;
  commercial_reuse: string | null;
  rights_review_status: string | null;
  retrieved: string;
  vintage: string;
  time_coverage: string | null;
  geographic_granularity: string | null;
  methodology_url: string | null;
  update_frequency: string | null;
  revises_published_values: boolean;
  caveats: string[];
};

export type Manifest = {
  generated_at: string;
  table_count: number;
  tables: PublishedTable[];
  history: { table: string; row_count: number; parquet: string } | null;
  sources: SourceDataset[];
};

/* -------------------------------------------------------------- parquet io */

/**
 * Normalise values coming out of Parquet.
 *
 * Two traps, both silent:
 *
 * BIGINT arrives as JavaScript BigInt, which throws on contact with a plain
 * number ("Cannot mix BigInt and other types"). At least that one is loud.
 *
 * DATE arrives as a JavaScript Date at UTC midnight, which in any negative-UTC
 * offset renders as the *previous day* in local time. `1965-01-01` becomes
 * `Thu Dec 31 1964 18:00:00 GMT-0600`, so `.getFullYear()` returns 1964. Every
 * year in every time series would be off by one, only for developers west of
 * Greenwich, and nothing would error. Convert to an ISO date string using UTC
 * components so the value means what the warehouse said it meant.
 */
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "bigint") {
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`${key} exceeds Number.MAX_SAFE_INTEGER (${value})`);
      }
      row[key] = Number(value);
    } else if (value instanceof Date) {
      row[key] = value.toISOString().slice(0, 10);
    }
  }
  return row;
}

async function readParquet<T>(file: string): Promise<T[]> {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing ${file} in publish/dist. Run \`python -m publish.export\` first.`,
    );
  }
  const rows = await parquetReadObjects({ file: await asyncBufferFromFile(full) });
  return rows.map((r) => normaliseRow(r as Record<string, unknown>)) as T[];
}

// Cache the promise, not the value: Next renders pages concurrently, so caching
// the value lets several callers each start their own read.
const cache = new Map<string, Promise<unknown[]>>();

function table<T>(file: string): Promise<T[]> {
  if (!cache.has(file)) cache.set(file, readParquet<T>(file));
  return cache.get(file) as Promise<T[]>;
}

export const places = () => table<Place>("places.parquet");
export const observations = () => table<Observation>("observations.parquet");
export const indicators = () => table<Indicator>("indicators.parquet");
export const units = () => table<Unit>("units.parquet");
export const topics = () => table<Topic>("topics.parquet");
export const boundaries = () => table<PlaceBoundary>("place_boundaries.parquet");

/** Boundary geometry for one admin level, joined to values for an indicator. */
export async function mapFor(
  indicatorId: string,
  placeType: string,
): Promise<{
  period: number;
  unit: Unit | undefined;
  features: {
    placeId: string;
    name: string;
    nameNe: string | null;
    slug: string;
    href: string;
    geometryGeoJson: string;
    value: number | null;
  }[];
}> {
  const [geo, cmp, all] = await Promise.all([
    boundaries(),
    comparisonFor(indicatorId, placeType),
    places(),
  ]);
  const byId = new Map(all.map((p) => [p.place_id, p]));
  const valueOf = new Map(cmp.rows.map((r) => [r.place.place_id, r.value]));

  const features = geo
    .filter((g) => g.place_type === placeType)
    .map((g) => {
      const place = byId.get(g.place_id);
      const parent = place?.parent_place_id
        ? byId.get(place.parent_place_id)
        : undefined;
      // Province pages live at /np/<slug>/, districts at /np/<province>/<slug>/.
      const href =
        placeType === "province"
          ? `/np/${g.slug}/`
          : parent
            ? `/np/${parent.slug}/${g.slug}/`
            : `/np/${g.slug}/`;
      return {
        placeId: g.place_id,
        name: g.name_en,
        nameNe: g.name_ne,
        slug: g.slug,
        href,
        geometryGeoJson: g.geometry_geojson,
        value: valueOf.get(g.place_id) ?? null,
      };
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return { period: cmp.period, unit: cmp.unit, features };
}

/** Topics that actually hold data. A planned topic must not render as populated. */
export async function liveTopics(): Promise<Topic[]> {
  return (await topics()).filter((t) => t.status === "live" && t.observation_count > 0);
}

export async function topicBySlug(slug: string): Promise<Topic | undefined> {
  return (await topics()).find((t) => t.slug === slug);
}

export async function indicatorsOfTopic(topicId: string): Promise<Indicator[]> {
  return (await indicators())
    .filter((i) => i.topic_id === topicId)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

/** Slug for an indicator page. Derived, not stored, so it cannot drift. */
export function indicatorSlug(indicatorId: string): string {
  return indicatorId.replace(/_/g, "-");
}

export async function indicatorBySlug(slug: string): Promise<Indicator | undefined> {
  return (await indicators()).find((i) => indicatorSlug(i.indicator_id) === slug);
}

/**
 * One indicator across every place that reports it, for the latest period.
 *
 * This is the shape a geographic comparison needs: ranked values with names
 * attached. Returns the period so the caller can label it rather than guess.
 */
export async function comparisonFor(
  indicatorId: string,
  placeType: string,
): Promise<{
  period: number;
  unit: Unit | undefined;
  rows: { place: Place; value: number }[];
}> {
  const [obs, all, us, inds] = await Promise.all([
    observations(),
    places(),
    units(),
    indicators(),
  ]);
  const byId = new Map(all.map((p) => [p.place_id, p]));
  const indicator = inds.find((i) => i.indicator_id === indicatorId);

  const relevant = obs.filter(
    (o) =>
      o.indicator_id === indicatorId &&
      o.value_numeric !== null &&
      o.place_id !== null &&
      byId.get(o.place_id)?.place_type === placeType &&
      // Totals only. Summing across dimension members would double count.
      (o.dimension_key === "none" ||
        o.dimension_key === dimensionKey({ sex: "all", age_band: "all" })),
  );
  if (!relevant.length) {
    return { period: 0, unit: undefined, rows: [] };
  }

  const period = Math.max(...relevant.map((o) => Number(o.period_start.slice(0, 4))));
  const rows = relevant
    .filter((o) => o.period_start.startsWith(String(period)))
    .map((o) => ({ place: byId.get(o.place_id!)!, value: o.value_numeric! }))
    .filter((r) => r.place)
    .sort((a, b) => b.value - a.value);

  return {
    period,
    unit: us.find((u) => u.unit_id === indicator?.default_unit_id),
    rows,
  };
}

let _manifest: Manifest | null = null;
export function manifest(): Manifest {
  if (_manifest) return _manifest;
  const full = path.join(DIST, "manifest.json");
  if (!fs.existsSync(full)) throw new Error("Missing manifest.json in publish/dist.");
  return (_manifest = JSON.parse(fs.readFileSync(full, "utf8")) as Manifest);
}

/* ------------------------------------------------------------------ places */

export async function country(): Promise<Place | undefined> {
  return (await places()).find((p) => p.place_type === "country");
}

export async function provinces(): Promise<Place[]> {
  return (await places())
    .filter((p) => p.place_type === "province")
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function childrenOf(placeId: string, type?: string): Promise<Place[]> {
  return (await places())
    .filter((p) => p.parent_place_id === placeId && (!type || p.place_type === type))
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function districtsOf(provinceId: string): Promise<Place[]> {
  return childrenOf(provinceId, "district");
}

/** Local units under a district: the four municipality types, not protected areas. */
export async function localUnitsOf(districtId: string): Promise<Place[]> {
  const LOCAL = new Set([
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ]);
  return (await places())
    .filter((p) => p.parent_place_id === districtId && LOCAL.has(p.place_type))
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function placeBySlug(
  type: string | string[],
  slug: string,
  parentPlaceId?: string,
): Promise<Place | undefined> {
  const types = new Set(Array.isArray(type) ? type : [type]);
  return (await places()).find(
    (p) =>
      types.has(p.place_type) &&
      p.slug === slug &&
      (parentPlaceId === undefined || p.parent_place_id === parentPlaceId),
  );
}

/* ------------------------------------------------------------ observations */

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

export type PopulationSummary = {
  period: number;
  status: string;
  total: number;
  female: number;
  male: number;
  femaleShare: number | null;
  density: number | null;
  workingAgeShare: number | null;
  bands: { band: string; female: number; male: number }[];
};

export async function populationOf(place: Place): Promise<PopulationSummary | null> {
  const rows = (await observations()).filter(
    (o) => o.place_id === place.place_id && o.indicator_id === "population",
  );
  if (!rows.length) return null;

  const period = Math.max(...rows.map((r) => Number(r.period_start.slice(0, 4))));
  const current = rows.filter((r) => r.period_start.startsWith(String(period)));

  const at = (sex: string, band: string) =>
    current.find((r) => r.dimension_key === dimensionKey({ sex, age_band: band }))
      ?.value_numeric ?? 0;

  const total = at("all", "all");
  const female = at("female", "all");
  const male = at("male", "all");

  const bands = AGE_BANDS.map((band) => ({
    band,
    female: at("female", band),
    male: at("male", band),
  })).filter((b) => b.female > 0 || b.male > 0);

  const WORKING = new Set(AGE_BANDS.slice(3, 13)); // 15-19 .. 60-64
  const workingAge = bands
    .filter((b) => WORKING.has(b.band))
    .reduce((sum, b) => sum + b.female + b.male, 0);

  return {
    period,
    // Surfacing this is not cosmetic: presenting a projection as a census count
    // is the error that destroys trust in a statistics site.
    status: current[0]?.status ?? "actual",
    total,
    female,
    male,
    femaleShare: total > 0 ? female / total : null,
    density: place.area_sqkm ? total / place.area_sqkm : null,
    workingAgeShare: total > 0 ? workingAge / total : null,
    bands,
  };
}

export type SeriesPoint = { year: number; value: number; status: string };

export type IndicatorSeries = {
  indicator: Indicator;
  unit: Unit | undefined;
  points: SeriesPoint[];
  latest: SeriesPoint | undefined;
};

/**
 * Annual time series for a place, for indicators with no dimensional breakdown.
 *
 * This path exists because of the World Bank data: a national series with no
 * geography below country, no dimensions, and units that include currency. The
 * previous schema could not express it, and the fact that it needs no special
 * handling here is the point of the redesign.
 */
export async function seriesFor(place: Place): Promise<IndicatorSeries[]> {
  const [obs, inds, us] = await Promise.all([observations(), indicators(), units()]);
  const byId = new Map(inds.map((i) => [i.indicator_id, i]));
  const unitById = new Map(us.map((u) => [u.unit_id, u]));

  const scalar = obs.filter(
    (o) =>
      o.place_id === place.place_id &&
      o.dimension_key === "none" &&
      o.value_numeric !== null,
  );

  const grouped = new Map<string, SeriesPoint[]>();
  for (const o of scalar) {
    const year = Number(o.period_start.slice(0, 4));
    const list = grouped.get(o.indicator_id) ?? [];
    list.push({ year, value: o.value_numeric!, status: o.status });
    grouped.set(o.indicator_id, list);
  }

  return [...grouped.entries()]
    .map(([indicatorId, points]) => {
      points.sort((a, b) => a.year - b.year);
      const indicator = byId.get(indicatorId)!;
      return {
        indicator,
        unit: unitById.get(indicator?.default_unit_id),
        points,
        latest: points[points.length - 1],
      };
    })
    .filter((s) => s.indicator)
    .sort((a, b) => a.indicator.name_en.localeCompare(b.indicator.name_en));
}

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

export function tablesFor(names: string[]): PublishedTable[] {
  const wanted = new Set(names);
  return manifest().tables.filter((t) => wanted.has(t.table));
}

export function sourcesFor(tables: PublishedTable[]): SourceDataset[] {
  const ids = new Set(tables.flatMap((t) => t.sources));
  return manifest().sources.filter((s) => ids.has(s.dataset_id));
}

/* ------------------------------------------------------------ update log */

export type HistoryRow = {
  observation_id: string;
  revision: number;
  dataset_id: string;
  indicator_id: string;
  period_start: string;
  first_seen_at: string;
  superseded_at: string | null;
  is_current: boolean;
};

export type DatasetUpdate = {
  source: SourceDataset;
  /** Observations currently published from this dataset. */
  current: number;
  /** Values this dataset has revised since first publication. */
  revised: number;
  /** When DataNepal last saw a new or changed value from it. */
  lastChange: string;
};

/**
 * What changed, when, per source dataset.
 *
 * Derived from the committed revision history rather than from a hand-kept
 * changelog, so it cannot drift from the data. On a first publication run every
 * dataset reports zero revisions — that is the true answer, and it becomes a
 * real change log on the second run with no redesign needed.
 *
 * `lastChange` is the most recent date on which a value from this dataset was
 * first seen or superseded. That is a stronger freshness signal than the
 * retrieval date: re-fetching an unchanged file does not make the data newer.
 */
export async function updateLog(): Promise<{
  generated: string;
  datasets: DatasetUpdate[];
  totalCurrent: number;
  totalRevised: number;
}> {
  const m = manifest();
  // Filename comes from the manifest so it cannot drift from the export.
  const rows = m.history
    ? await table<HistoryRow>(m.history.parquet)
    : ([] as HistoryRow[]);

  const datasets = m.sources
    .map((source) => {
      const mine = rows.filter((r) => r.dataset_id === source.dataset_id);
      if (!mine.length) return null;
      const dates = [
        ...mine.map((r) => r.first_seen_at),
        ...mine.map((r) => r.superseded_at).filter((d): d is string => !!d),
      ].sort();
      return {
        source,
        current: mine.filter((r) => r.is_current).length,
        revised: mine.filter((r) => r.superseded_at !== null).length,
        lastChange: dates.at(-1)!,
      };
    })
    .filter((d): d is DatasetUpdate => d !== null)
    .sort((a, b) => b.lastChange.localeCompare(a.lastChange) || b.current - a.current);

  return {
    generated: m.generated_at.slice(0, 10),
    datasets,
    totalCurrent: rows.filter((r) => r.is_current).length,
    totalRevised: rows.filter((r) => r.superseded_at !== null).length,
  };
}
