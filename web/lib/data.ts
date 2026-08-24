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
import {
  AGE_BANDS,
  dimensionKey,
  pickHeadline,
  pickLaterEstimate,
  pickMember,
} from "./format";

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

// Defined in lib/types.ts so a client component can import the shape without
// importing this module, which reads Parquet from disk.
import type { Unit } from "./types";
export type { Unit };

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
    /** Parent place. The reference map groups districts by province with it. */
    parentPlaceId: string | null;
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
        parentPlaceId: place?.parent_place_id ?? null,
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
      byId.get(o.place_id)?.place_type === placeType,
  );
  if (!relevant.length) {
    return { period: 0, unit: undefined, rows: [] };
  }

  /*
    One aggregate row per place, choosing the enumeration over the projection.

    Two earlier versions of this were wrong in different ways. Filtering on a
    literal dimension key made every census figure invisible, because local
    governments publish population as `residence_type=household|sex=all` and no
    hardcoded key matched. Then taking the latest period ranked districts on
    modelled 2023 figures while the 2021 count sat unused, so a map and the
    profile beside it disagreed.
  */
  const perPlace = new Map<string, typeof relevant>();
  for (const o of relevant) {
    perPlace.set(o.place_id!, [...(perPlace.get(o.place_id!) ?? []), o]);
  }
  const picked = [...perPlace.entries()].map(([placeId, rowsForPlace]) => ({
    place: byId.get(placeId)!,
    row: pickHeadline(rowsForPlace),
  }));
  // The period is whatever the places agree on; comparing a 2021 count with a
  // 2023 projection across places would be worse than either.
  const period = picked.length
    ? Math.max(
        ...picked
          .map((p) => (p.row ? Number(p.row.period_start.slice(0, 4)) : 0))
          .filter((y) => y > 0),
      )
    : 0;
  const rows = picked
    .filter((p) => p.row && Number(p.row.period_start.slice(0, 4)) === period)
    .map((p) => ({
      place: p.place,
      value: p.row!.value_numeric ?? null,
    }))
    .filter(
      (r): r is { place: Place; value: number } => Boolean(r.place) && r.value !== null,
    )
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
  /** Reference period of the age bands, which may differ from the headline. */
  bandPeriod: number | null;
  /** A later modelled figure, where the publisher offers one. */
  laterEstimate: { value: number; period: number; status: string } | null;
};

export async function populationOf(place: Place): Promise<PopulationSummary | null> {
  const rows = (await observations()).filter(
    (o) =>
      o.place_id === place.place_id &&
      o.indicator_id === "population" &&
      o.value_numeric !== null,
  );
  if (!rows.length) return null;

  // The enumeration leads. For provinces and districts that is the 2021 census
  // rather than the 2023 projection, which is what a reader means by "the
  // population of Kathmandu".
  const headline = pickHeadline(rows);
  if (!headline) return null;
  const period = Number(headline.period_start.slice(0, 4));
  const sameRun = rows.filter(
    (r) =>
      r.status === headline.status && r.period_start.slice(0, 4) === String(period),
  );

  const total = headline.value_numeric ?? 0;
  const female = pickMember(sameRun, "sex", "female")?.value_numeric ?? 0;
  const male = pickMember(sameRun, "sex", "male")?.value_numeric ?? 0;

  /*
    Age bands come from whichever source publishes them, independently of the
    headline. The census tables ingested here carry sex but not age, so the age
    pyramid stays on the UNFPA projection -- which is a legitimate use of a
    projection and is labelled with its own period, rather than being quietly
    mixed into the census figures above it.
  */
  const banded = rows.filter((r) => {
    const band = r.dimension_key
      .split("|")
      .find((part) => part.startsWith("age_band="));
    return band !== undefined && band !== "age_band=all";
  });
  const bandPeriod = banded.length
    ? Math.max(...banded.map((r) => Number(r.period_start.slice(0, 4))))
    : null;
  const bandRows = banded.filter(
    (r) => r.period_start.slice(0, 4) === String(bandPeriod),
  );
  const at = (sex: string, band: string) =>
    bandRows.find((r) => r.dimension_key === dimensionKey({ sex, age_band: band }))
      ?.value_numeric ?? 0;
  const bands = AGE_BANDS.map((band) => ({
    band,
    female: at("female", band),
    male: at("male", band),
  })).filter((b) => b.female > 0 || b.male > 0);

  const WORKING = new Set(AGE_BANDS.slice(3, 13)); // 15-19 .. 60-64
  const bandTotal = bands.reduce((sum, b) => sum + b.female + b.male, 0);
  const workingAge = bands
    .filter((b) => WORKING.has(b.band))
    .reduce((sum, b) => sum + b.female + b.male, 0);

  // The later modelled figure, where one exists. Shown as context, never as the
  // headline, and never mixed with the census in a derived ratio.
  const later = pickLaterEstimate(rows, headline);

  return {
    period,
    // Surfacing this is not cosmetic: presenting a projection as a census count
    // is the error that destroys trust in a statistics site.
    status: headline.status,
    total,
    female,
    male,
    femaleShare: total > 0 ? female / total : null,
    density: place.area_sqkm ? total / place.area_sqkm : null,
    // Computed against the band total, not the headline total: the two come
    // from different periods, and dividing across them would be exactly the
    // error this split exists to prevent.
    workingAgeShare: bandTotal > 0 ? workingAge / bandTotal : null,
    bands,
    bandPeriod,
    laterEstimate:
      later && later.value_numeric !== null
        ? {
            value: later.value_numeric,
            period: Number(later.period_start.slice(0, 4)),
            status: later.status,
          }
        : null,
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

/*
  Formatting lives in lib/format.ts, not here.

  This module imports node:fs and hyparquet at the top level, so anything that
  imports it is server-only. The formatters are pure and the interactive map is a
  client component, so they had to move somewhere a browser bundle can reach.
  Re-exported here so existing server-side callers are unaffected.
*/
export {
  AGE_BANDS,
  asPercentValue,
  dimensionKey,
  formatChange,
  formatCompact,
  formatNumber,
  formatPercent,
  formatWithUnit,
  pickAggregate,
  pickHeadline,
  pickLaterEstimate,
  pickMember,
  statusLabel,
} from "./format";

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

/* --------------------------------------------------- local-unit geometry */

export type LocalUnitShape = {
  placeId: string;
  name: string;
  nameNe: string | null;
  placeType: string;
  geometryGeoJson: string;
};

/**
 * Boundary geometry for the local units of one district, plus the district's
 * own outline.
 *
 * Local units are the finest geography DataNepal holds and the level almost
 * nobody publishes statistics for -- the population source stops at district.
 * So this exists to answer "what is in this district and where", not "how much",
 * which is why the district page draws it as a reference map rather than a
 * choropleth. Shading a map by data we do not have would be worse than not
 * drawing it.
 *
 * The join is on place_id, which works because COD admin level 3 carries
 * `adm3_pcode` and the spine keys on P-codes. No crosswalk, no name matching.
 */
export async function localUnitMapFor(districtPlaceId: string): Promise<{
  units: LocalUnitShape[];
  outline: string | null;
}> {
  const geo = await boundaries();
  const byId = new Map(geo.map((g) => [g.place_id, g]));

  const units = geo
    .filter((g) => g.parent_place_id === districtPlaceId && g.admin_level === 3)
    .filter((g) => g.place_type !== "protected_area")
    .map((g) => ({
      placeId: g.place_id,
      name: g.name_en,
      nameNe: g.name_ne,
      placeType: g.place_type,
      geometryGeoJson: g.geometry_geojson,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    units,
    outline: byId.get(districtPlaceId)?.geometry_geojson ?? null,
  };
}

/** Display order and labels for local-unit types, coarsest first. */
export const LOCAL_UNIT_TYPES = [
  { type: "metropolitan", label: "Metropolitan city" },
  { type: "sub_metropolitan", label: "Sub-metropolitan city" },
  { type: "municipality", label: "Municipality" },
  { type: "rural_municipality", label: "Rural municipality" },
] as const;

/* ------------------------------------------------------- place profiles */

export type ProfileMetric = {
  indicatorId: string;
  name: string;
  nameNe: string | null;
  definition: string | null;
  value: number;
  unit: Unit | undefined;
  period: number;
  periodType: string;
  status: string;
  datasetId: string;
  isAdditive: boolean;
  /** The same measure split by sex, where the source publishes it. */
  bySex: { sex: string; value: number }[];
  /**
   * A later modelled figure for the same measure, where one exists.
   *
   * Shown as context beside the enumeration, never in its place. A district has
   * both a 2021 census count and a 2023 UNFPA projection; a reader deserves the
   * count as the answer and the projection as the update.
   */
  laterEstimate: { value: number; period: number; status: string } | null;
};

export type ProfileTopic = {
  topic: Topic;
  metrics: ProfileMetric[];
};

/**
 * Count of dimension members that are not the total.
 *
 * Used to choose which row represents an indicator on a profile. Preferring the
 * fewest non-total members finds the aggregate without hardcoding a dimension
 * vocabulary — which matters because local units publish population as
 * `residence_type=household|sex=all` while districts publish
 * `residence_type=all|sex=all`, and a profile should show whichever the source
 * actually has rather than know the difference.
 */
function specificity(dimensionKey: string): number {
  if (dimensionKey === "none") return 0;
  return dimensionKey.split("|").filter((part) => !part.endsWith("=all")).length;
}

function memberOf(dimensionKey: string, dimension: string): string | null {
  if (dimensionKey === "none") return null;
  const hit = dimensionKey.split("|").find((p) => p.startsWith(`${dimension}=`));
  return hit ? hit.slice(dimension.length + 1) : null;
}

/**
 * Every published measure for one place, grouped by topic.
 *
 * This is the whole point of the canonical observation model, and the reason a
 * place page needs no per-dataset code. It reads observations, not sources: add
 * a domain to the warehouse and it appears here, on every place that has it, in
 * its own topic section. Nothing below knows that population comes from a census
 * Excel file and literacy from a different sheet of the same workbook.
 *
 * For each indicator it takes the latest period, then the least specific
 * dimension combination available — the aggregate — and carries the sex split
 * alongside where the source publishes one.
 */
export async function placeProfile(place: Place): Promise<ProfileTopic[]> {
  const [obs, inds, us, ts] = await Promise.all([
    observations(),
    indicators(),
    units(),
    topics(),
  ]);

  const mine = obs.filter(
    (o) => o.place_id === place.place_id && o.value_numeric !== null,
  );
  if (!mine.length) return [];

  const indicatorById = new Map(inds.map((i) => [i.indicator_id, i]));
  const unitById = new Map(us.map((u) => [u.unit_id, u]));
  const topicById = new Map(ts.map((t) => [t.topic_id, t]));

  const byIndicator = new Map<string, Observation[]>();
  for (const o of mine) {
    byIndicator.set(o.indicator_id, [...(byIndicator.get(o.indicator_id) ?? []), o]);
  }

  const metrics: (ProfileMetric & { topicId: string; sortOrder: number })[] = [];

  for (const [indicatorId, rows] of byIndicator) {
    const indicator = indicatorById.get(indicatorId);
    if (!indicator) continue;
    const topic = topicById.get(indicator.topic_id);
    if (!topic) continue;

    // Enumeration before projection, then latest. The census is the answer;
    // a projection for a later date is context.
    const headline = pickHeadline(rows);
    if (!headline || headline.value_numeric === null) continue;
    const latest = Number(headline.period_start.slice(0, 4));
    const current = rows.filter(
      (r) => r.status === headline.status && r.period_start.startsWith(String(latest)),
    );
    const later = pickLaterEstimate(rows, headline);

    // The same measure by sex, at the headline's other dimensions.
    const bySex = current
      .map((r) => ({ sex: memberOf(r.dimension_key, "sex"), row: r }))
      .filter(
        (x) =>
          x.sex !== null &&
          x.sex !== "all" &&
          specificity(x.row.dimension_key) === specificity(headline.dimension_key) + 1,
      )
      .map((x) => ({ sex: x.sex!, value: x.row.value_numeric! }))
      .sort((a, b) => a.sex.localeCompare(b.sex));

    metrics.push({
      indicatorId,
      name: indicator.name_en,
      nameNe: indicator.name_ne,
      definition: indicator.definition,
      value: headline.value_numeric,
      unit: unitById.get(indicator.default_unit_id),
      period: latest,
      periodType: headline.period_type,
      status: headline.status,
      datasetId: headline.dataset_id,
      isAdditive: indicator.is_additive,
      bySex,
      laterEstimate:
        later && later.value_numeric !== null
          ? {
              value: later.value_numeric,
              period: Number(later.period_start.slice(0, 4)),
              status: later.status,
            }
          : null,
      topicId: topic.topic_id,
      sortOrder: topic.sort_order,
    });
  }

  const grouped = new Map<string, ProfileMetric[]>();
  for (const m of metrics) {
    grouped.set(m.topicId, [...(grouped.get(m.topicId) ?? []), m]);
  }

  return [...grouped.entries()]
    .map(([topicId, ms]) => ({
      topic: topicById.get(topicId)!,
      metrics: ms.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((g) => g.topic)
    .sort((a, b) => a.topic.sort_order - b.topic.sort_order);
}

/** Local units of a district, for routing and listing. */
export async function localUnitBySlug(
  districtPlaceId: string,
  slug: string,
): Promise<Place | undefined> {
  return (await localUnitsOf(districtPlaceId)).find((p) => p.slug === slug);
}

/** Every (province, district, local) slug triple, for static generation. */
export async function allLocalUnitPaths(): Promise<
  { province: string; district: string; local: string }[]
> {
  const all = await places();
  const byId = new Map(all.map((p) => [p.place_id, p]));
  const LOCAL = new Set([
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ]);
  const out: { province: string; district: string; local: string }[] = [];
  for (const p of all) {
    if (!LOCAL.has(p.place_type) || !p.parent_place_id) continue;
    const district = byId.get(p.parent_place_id);
    const province = district?.parent_place_id
      ? byId.get(district.parent_place_id)
      : undefined;
    if (!district || !province) continue;
    out.push({ province: province.slug, district: district.slug, local: p.slug });
  }
  return out;
}

/* ------------------------------------------------- interactive metric maps */

import { labelBox, layoutLabels } from "./maplabels";
import { parseGeometry, projector, toPath } from "./geo";
import type { Metric, MetricMapFeature } from "@/components/MetricMap";

/**
 * Everything an interactive map needs, computed at build time.
 *
 * Geometry, projection and label placement are all metric-independent, so they
 * happen here and ship as strings. The browser only recolours. That is what
 * keeps an interactive map from meaning "send the geometry to the client and
 * hope".
 */
export async function metricMapFor(
  places: Place[],
  indicatorIds: string[],
  frame: { maxWidth: number; maxHeight: number },
): Promise<{
  features: MetricMapFeature[];
  metrics: Metric[];
  width: number;
  height: number;
} | null> {
  const [geo, obs, inds, us] = await Promise.all([
    boundaries(),
    observations(),
    indicators(),
    units(),
  ]);

  const wanted = new Map(places.map((p) => [p.place_id, p]));
  const shapes = geo
    .filter((g) => wanted.has(g.place_id))
    .map((g) => ({
      place: wanted.get(g.place_id)!,
      rings: parseGeometry(g.geometry_geojson),
    }))
    .filter((s) => s.rings.length > 0);

  if (!shapes.length) return null;

  const { width, height, project } = projector(
    shapes.map((s) => s.rings),
    frame,
  );

  const boxes = new Map(
    shapes.map((s) => [s.place.place_id, labelBox(s.rings, project)] as const),
  );
  const layout = layoutLabels(shapes, {
    name: (s) => s.place.name_en,
    box: (s) => boxes.get(s.place.place_id)!,
    width,
    height,
  });

  const placedBy = new Map(
    layout.placed.map((p) => [p.item.place.place_id, p] as const),
  );
  const dottedIds = new Set(layout.dotted.map((d) => d.item.place.place_id));

  const features: MetricMapFeature[] = shapes.map((s) => {
    const placed = placedBy.get(s.place.place_id);
    const box = boxes.get(s.place.place_id)!;
    return {
      placeId: s.place.place_id,
      name: s.place.name_en,
      href: hrefFor(s.place, wanted),
      path: toPath(s.rings, project),
      label: placed
        ? {
            lines: placed.lines,
            x: placed.at.x,
            y: placed.at.y,
            fontSize: placed.fontSize,
          }
        : null,
      dot: dottedIds.has(s.place.place_id) ? { x: box.x, y: box.y } : null,
    };
  });

  // One metric per requested indicator, keeping only those with real coverage.
  const metrics: Metric[] = indicatorIds
    .map((indicatorId): Metric | null => {
      const indicator = inds.find((i) => i.indicator_id === indicatorId);
      if (!indicator) return null;
      const values: Record<string, number> = {};
      for (const place of places) {
        const rows = obs.filter(
          (o) =>
            o.place_id === place.place_id &&
            o.indicator_id === indicatorId &&
            o.value_numeric !== null,
        );
        const row = pickHeadline(rows);
        if (row?.value_numeric != null) values[place.place_id] = row.value_numeric;
      }
      if (Object.keys(values).length === 0) return null;
      return {
        id: indicatorId,
        label: indicator.name_en,
        unit: us.find((u) => u.unit_id === indicator.default_unit_id),
        values,
        note: indicator.is_additive ? undefined : "not additive across places",
      };
    })
    .filter((m): m is Metric => m !== null);

  if (!metrics.length) return null;
  return { features, metrics, width, height };
}

/** Page for a place, given the set of places on this map. */
function hrefFor(place: Place, all: Map<string, Place>): string | null {
  if (place.place_type === "province") return `/np/${place.slug}/`;
  if (place.place_type === "district") {
    const prov = place.parent_place_id ? all.get(place.parent_place_id) : undefined;
    return prov ? `/np/${prov.slug}/${place.slug}/` : null;
  }
  return null;
}

/* ------------------------------------------------------- benchmark context */

export type BenchmarkRow = {
  placeId: string;
  name: string;
  href: string | null;
  value: number;
  /** True for the place the page is about. */
  isSubject: boolean;
  /** Rank among peers of the same type, where that is meaningful. */
  rank?: { position: number; of: number };
};

export type Benchmark = {
  indicatorId: string;
  label: string;
  unit: Unit | undefined;
  period: number;
  isAdditive: boolean;
  rows: BenchmarkRow[];
};

/**
 * A place's value beside its parents' and the nation's.
 *
 * This answers the question place pages were not answering. A district page said
 * "literacy 72.4%" and left the reader with no way to know whether that is good.
 * Putting the province and Nepal next to it costs three rows and turns a number
 * into a judgement.
 *
 * Only real values. If an ancestor has no published figure for an indicator its
 * row is absent rather than interpolated -- a benchmark against a number we
 * invented would be worse than no benchmark, because it would look like context.
 *
 * Additive indicators are excluded from the ancestor comparison on purpose:
 * Dhading's population against Nepal's is not a benchmark, it is a share, and
 * showing it as a bar chart of three wildly different magnitudes tells a reader
 * nothing they did not already know. Rates and ratios are what benchmark
 * usefully.
 */
export async function benchmarksFor(
  place: Place,
  indicatorIds: string[],
): Promise<Benchmark[]> {
  const [all, obs, inds, us] = await Promise.all([
    places(),
    observations(),
    indicators(),
    units(),
  ]);
  const byId = new Map(all.map((p) => [p.place_id, p]));

  // The place, then each ancestor up to the country.
  const lineage: Place[] = [place];
  let cursor: Place | undefined = place;
  while (cursor?.parent_place_id) {
    cursor = byId.get(cursor.parent_place_id);
    if (cursor) lineage.push(cursor);
  }

  const hrefFor = (p: Place): string | null => {
    if (p.place_type === "country") return "/";
    if (p.place_type === "province") return `/np/${p.slug}/`;
    const parent = p.parent_place_id ? byId.get(p.parent_place_id) : undefined;
    if (p.place_type === "district" && parent) return `/np/${parent.slug}/${p.slug}/`;
    const gp = parent?.parent_place_id ? byId.get(parent.parent_place_id) : undefined;
    if (parent && gp) return `/np/${gp.slug}/${parent.slug}/${p.slug}/`;
    return null;
  };

  const valueFor = (placeId: string, indicatorId: string) => {
    const rows = obs.filter(
      (o) =>
        o.place_id === placeId &&
        o.indicator_id === indicatorId &&
        o.value_numeric !== null,
    );
    return pickHeadline(rows);
  };

  const out: Benchmark[] = [];
  for (const indicatorId of indicatorIds) {
    const indicator = inds.find((i) => i.indicator_id === indicatorId);
    if (!indicator || indicator.is_additive) continue;

    const own = valueFor(place.place_id, indicatorId);
    if (!own?.value_numeric) continue;

    const rows: BenchmarkRow[] = [];
    for (const ancestor of lineage) {
      const row = valueFor(ancestor.place_id, indicatorId);
      if (row?.value_numeric == null) continue;
      rows.push({
        placeId: ancestor.place_id,
        name: ancestor.place_type === "country" ? "Nepal" : ancestor.name_en,
        href: ancestor.place_id === place.place_id ? null : hrefFor(ancestor),
        value: row.value_numeric,
        isSubject: ancestor.place_id === place.place_id,
      });
    }
    if (rows.length < 2) continue; // A benchmark of one is not a benchmark.

    // Rank among peers of the same type, which is the other half of "is this
    // high or low" -- 72.4% means more once you know it is 61st of 77.
    const peers = obs
      .filter(
        (o) =>
          o.indicator_id === indicatorId &&
          o.value_numeric !== null &&
          o.place_id !== null &&
          byId.get(o.place_id)?.place_type === place.place_type,
      )
      .reduce((acc, o) => {
        const existing = acc.get(o.place_id!);
        if (!existing) acc.set(o.place_id!, [o]);
        else existing.push(o);
        return acc;
      }, new Map<string, Observation[]>());

    const ranked = [...peers.entries()]
      .map(([id, rows_]) => ({ id, value: pickHeadline(rows_)?.value_numeric ?? null }))
      .filter((r): r is { id: string; value: number } => r.value !== null)
      .sort((a, b) => b.value - a.value);
    const position = ranked.findIndex((r) => r.id === place.place_id);
    const subject = rows.find((r) => r.isSubject);
    if (subject && position >= 0 && ranked.length > 2) {
      subject.rank = { position: position + 1, of: ranked.length };
    }

    out.push({
      indicatorId,
      label: indicator.name_en,
      unit: us.find((u) => u.unit_id === indicator.default_unit_id),
      period: Number(own.period_start.slice(0, 4)),
      isAdditive: indicator.is_additive,
      rows,
    });
  }
  return out;
}

/* -------------------------------------------------- composition & spread */

export type CompositionData = {
  total: number;
  slices: { id: string; label: string; value: number; tone: number }[];
};

/**
 * A dimension's members for one place, as parts of a whole.
 *
 * Reads the member vocabulary and its declared sort order from the warehouse
 * rather than hardcoding it, so a source that adds a category shows up here
 * instead of being silently dropped -- which for a 100% bar would renormalise
 * every proportion in it without any visible sign.
 */
export async function compositionFor(
  place: Place,
  indicatorId: string,
  dimensionId: string,
): Promise<CompositionData | null> {
  const [obs, dims, members] = await Promise.all([
    observations(),
    table<{ observation_id: string; dimension_id: string; member_id: string }>(
      "observation_dimensions.parquet",
    ),
    table<{
      dimension_id: string;
      member_id: string;
      name_en: string;
      sort_order: number;
    }>("dimension_members.parquet"),
  ]);

  const byObs = new Map<string, Map<string, string>>();
  for (const d of dims) {
    let m = byObs.get(d.observation_id);
    if (!m) byObs.set(d.observation_id, (m = new Map()));
    m.set(d.dimension_id, d.member_id);
  }

  const rows = obs.filter((o) => {
    if (o.place_id !== place.place_id || o.indicator_id !== indicatorId) return false;
    if (o.value_numeric === null) return false;
    const d = byObs.get(o.observation_id);
    const member = d?.get(dimensionId);
    // Total members are the whole, not a part.
    return member !== undefined && member !== "all" && d?.get("sex") === "all";
  });
  if (!rows.length) return null;

  const vocab = members
    .filter((m) => m.dimension_id === dimensionId && m.member_id !== "all")
    .sort((a, b) => a.sort_order - b.sort_order);

  const slices = vocab
    .map((m, i) => {
      const row = rows.find(
        (o) => byObs.get(o.observation_id)?.get(dimensionId) === m.member_id,
      );
      return row?.value_numeric != null
        ? {
            id: m.member_id,
            label: m.name_en,
            value: row.value_numeric,
            /*
              Ordered categories get ordered colour, starting at tone 1 rather
              than 0. Tone 0 is very nearly the page, so putting the largest
              category there made a bar that is 72% one thing look empty. The
              ramp still runs monotonically -- darker means less literate -- it
              just starts somewhere visible.
            */
            tone: 1 + Math.min(3, Math.round((i / Math.max(1, vocab.length - 1)) * 3)),
          }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  if (!slices.length) return null;
  return { total: slices.reduce((sum, s) => sum + s.value, 0), slices };
}

/** Every peer value for an indicator, for locating one place in a distribution. */
export async function spreadFor(
  placeType: string,
  indicatorId: string,
): Promise<{ id: string; value: number }[]> {
  const [obs, all] = await Promise.all([observations(), places()]);
  const typeOf = new Map(all.map((p) => [p.place_id, p.place_type]));
  const perPlace = new Map<string, Observation[]>();
  for (const o of obs) {
    if (
      o.indicator_id !== indicatorId ||
      o.value_numeric === null ||
      !o.place_id ||
      typeOf.get(o.place_id) !== placeType
    ) {
      continue;
    }
    perPlace.set(o.place_id, [...(perPlace.get(o.place_id) ?? []), o]);
  }
  return [...perPlace.entries()]
    .map(([id, rows]) => ({ id, value: pickHeadline(rows)?.value_numeric ?? null }))
    .filter((r): r is { id: string; value: number } => r.value !== null);
}
