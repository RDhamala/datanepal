/**
 * Build-time data access.
 *
 * Reads the published **Parquet** from publish/dist/. This runs only during
 * `next build` -- nothing here reaches the browser.
 *
 * Parquet rather than JSON on purpose. JSON was fine at 4,590 observations and
 * breaks at ward scale: 6,743 wards x indicators x years is comfortably over a
 * million rows, where observations.json becomes hundreds of megabytes and the
 * build dies parsing it. Parquet is columnar and roughly 40x smaller here.
 *
 * hyparquet is pure JavaScript, so there is no native binding to fail in CI.
 * If query pushdown ever matters -- filtering a large table without reading it
 * all -- swap to DuckDB; the interface below would not change.
 */

import fs from "node:fs";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const DIST = path.join(process.cwd(), "..", "publish", "dist");

export type Place = {
  place_pcode: string;
  admin_level: number;
  place_type: string;
  name_en: string;
  name_ne: string | null;
  parent_pcode: string | null;
  area_sqkm: number | null;
  center_lat: number | null;
  center_lon: number | null;
  slug: string;
  parent_name_en: string | null;
  parent_slug: string | null;
};

export type Observation = {
  place_pcode: string;
  place_name_en: string;
  place_name_ne: string | null;
  place_type: string;
  admin_level: number;
  indicator_code: string;
  period: number;
  sex: "all" | "female" | "male";
  age_band: string;
  value: number;
  unit: string;
  source_id: string;
};

export type Dataset = {
  table: string;
  title: string;
  description: string | null;
  source: { name: string; url: string; accessed?: string } | null;
  licence: string | null;
  vintage: string | null;
  row_count: number;
  parquet: string | null;
  json: string | null;
  bytes: number;
};

export type Manifest = {
  generated_at: string;
  dataset_count: number;
  datasets: Dataset[];
};

/**
 * Parquet BIGINT columns arrive as JavaScript BigInt, which throws the moment
 * it meets a plain number ("Cannot mix BigInt and other types"). Coerce once
 * here rather than at every arithmetic site downstream.
 *
 * Safe for this data: the largest value is Nepal's population, ~31 million,
 * five orders of magnitude below Number.MAX_SAFE_INTEGER. Guard anyway, so a
 * future counter in the quadrillions fails loudly instead of silently losing
 * precision.
 */
function coerceBigInts(row: Record<string, unknown>): Record<string, unknown> {
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "bigint") {
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(
          `${key} exceeds Number.MAX_SAFE_INTEGER (${value}); handle it as BigInt`,
        );
      }
      row[key] = Number(value);
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
  return rows.map((r) => coerceBigInts(r as Record<string, unknown>)) as T[];
}

// Read once per build. 838 places x 84 pages is a lot of redundant parsing
// otherwise, and Next renders pages concurrently -- so cache the promise, not
// the value, or concurrent callers each start their own read.
let _places: Promise<Place[]> | null = null;
let _observations: Promise<Observation[]> | null = null;
let _manifest: Manifest | null = null;

export function places(): Promise<Place[]> {
  return (_places ??= readParquet<Place>("places.parquet"));
}

export function observations(): Promise<Observation[]> {
  return (_observations ??= readParquet<Observation>("observations.parquet"));
}

export function manifest(): Manifest {
  if (_manifest) return _manifest;
  const full = path.join(DIST, "manifest.json");
  if (!fs.existsSync(full)) {
    throw new Error("Missing manifest.json in publish/dist.");
  }
  return (_manifest = JSON.parse(fs.readFileSync(full, "utf8")) as Manifest);
}

/* ------------------------------------------------------------------ places */

export async function provinces(): Promise<Place[]> {
  return (await places())
    .filter((p) => p.admin_level === 1)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function districtsOf(provincePcode: string): Promise<Place[]> {
  return (await places())
    .filter((p) => p.admin_level === 2 && p.parent_pcode === provincePcode)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function localUnitsOf(districtPcode: string): Promise<Place[]> {
  return (await places())
    .filter((p) => p.admin_level === 3 && p.parent_pcode === districtPcode)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export async function placeBySlug(
  level: number,
  slug: string,
  parentPcode?: string,
): Promise<Place | undefined> {
  return (await places()).find(
    (p) =>
      p.admin_level === level &&
      p.slug === slug &&
      (parentPcode === undefined || p.parent_pcode === parentPcode),
  );
}

export async function country(): Promise<Place | undefined> {
  return (await places()).find((p) => p.admin_level === 0);
}

/* ------------------------------------------------------------ observations */

// Explicit order: '80+' sorts before '5-9' lexically, and a pyramid with its
// bands out of sequence is not merely ugly, it is wrong.
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

export type PopulationSummary = {
  period: number;
  total: number;
  female: number;
  male: number;
  /** Female share of the total, 0-1. Null when the total is zero. */
  femaleShare: number | null;
  /** Persons per square kilometre. Null when area is unknown. */
  density: number | null;
  /** Share of the working-age population, 15-64. Null when the total is zero. */
  workingAgeShare: number | null;
  bands: { band: string; female: number; male: number }[];
};

export async function populationOf(place: Place): Promise<PopulationSummary | null> {
  const rows = (await observations()).filter(
    (o) => o.place_pcode === place.place_pcode && o.indicator_code === "population",
  );
  if (!rows.length) return null;

  const period = Math.max(...rows.map((r) => r.period));
  const current = rows.filter((r) => r.period === period);
  const pick = (sex: Observation["sex"], band: string) =>
    current.find((r) => r.sex === sex && r.age_band === band)?.value ?? 0;

  const total = pick("all", "all");
  const female = pick("female", "all");
  const male = pick("male", "all");

  const bands = AGE_BANDS.map((band) => ({
    band,
    female: pick("female", band),
    male: pick("male", band),
  })).filter((b) => b.female > 0 || b.male > 0);

  // 15-64 is the conventional working-age definition. Summed from the bands
  // rather than taken from a total, because no such total is published.
  const WORKING = AGE_BANDS.slice(3, 13); // 15-19 .. 60-64
  const workingAge = bands
    .filter((b) => WORKING.includes(b.band))
    .reduce((sum, b) => sum + b.female + b.male, 0);

  return {
    period,
    total,
    female,
    male,
    femaleShare: total > 0 ? female / total : null,
    density: place.area_sqkm ? total / place.area_sqkm : null,
    workingAgeShare: total > 0 ? workingAge / total : null,
    bands,
  };
}

/* --------------------------------------------------------------- formatting */

const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf.format(Math.round(n));
}

export function formatPercent(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 && n < 10_000 ? 1 : 0)}k`;
  return String(n);
}

/** Datasets backing a page, for the provenance block. */
export function datasetsFor(tables: string[]): Dataset[] {
  const wanted = new Set(tables);
  return manifest().datasets.filter((d) => wanted.has(d.table));
}
