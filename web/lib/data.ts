/**
 * Build-time data access.
 *
 * Reads the published JSON from publish/dist/ with plain fs. This runs only
 * during `next build` -- nothing here reaches the browser, so there is no
 * bundle cost and no runtime data fetching.
 *
 * Parquet is the canonical published format and what consumers should download.
 * JSON exists alongside it for tables small enough not to need DuckDB, and it
 * is what this build reads: pulling in a Parquet reader to parse a 1MB file at
 * build time would be cost without benefit.
 */

import fs from "node:fs";
import path from "node:path";

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

export type Manifest = {
  generated_at: string;
  dataset_count: number;
  datasets: {
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
  }[];
};

function read<T>(file: string): T {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing ${file} in publish/dist. Run \`python -m publish.export\` first.`,
    );
  }
  return JSON.parse(fs.readFileSync(full, "utf8")) as T;
}

// Read once per build rather than per page: 838 places x 84 pages is a lot of
// redundant parsing otherwise.
let _places: Place[] | null = null;
let _observations: Observation[] | null = null;
let _manifest: Manifest | null = null;

export function places(): Place[] {
  return (_places ??= read<Place[]>("places.json"));
}

export function observations(): Observation[] {
  return (_observations ??= read<Observation[]>("observations.json"));
}

export function manifest(): Manifest {
  return (_manifest ??= read<Manifest>("manifest.json"));
}

export function provinces(): Place[] {
  return places()
    .filter((p) => p.admin_level === 1)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export function districtsOf(provincePcode: string): Place[] {
  return places()
    .filter((p) => p.admin_level === 2 && p.parent_pcode === provincePcode)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export function localUnitsOf(districtPcode: string): Place[] {
  return places()
    .filter((p) => p.admin_level === 3 && p.parent_pcode === districtPcode)
    .sort((a, b) => a.name_en.localeCompare(b.name_en));
}

export function placeBySlug(level: number, slug: string, parentPcode?: string) {
  return places().find(
    (p) =>
      p.admin_level === level &&
      p.slug === slug &&
      (parentPcode === undefined || p.parent_pcode === parentPcode),
  );
}

/** Latest period available for a place's indicator. */
function latestPeriod(rows: Observation[]): number | null {
  return rows.length ? Math.max(...rows.map((r) => r.period)) : null;
}

export type PopulationSummary = {
  period: number;
  total: number;
  female: number;
  male: number;
  /** Female share of the total, 0-1. Null when the total is zero. */
  femaleShare: number | null;
  /** Persons per square kilometre. Null when area is unknown. */
  density: number | null;
  bands: { band: string; female: number; male: number }[];
};

// Explicit order: '80+' sorts before '5-9' lexically, and the pyramid is
// meaningless if the bands are out of sequence.
export const AGE_BANDS = [
  "0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39",
  "40-44", "45-49", "50-54", "55-59", "60-64", "65-69", "70-74", "75-79", "80+",
];

export function populationOf(place: Place): PopulationSummary | null {
  const rows = observations().filter(
    (o) => o.place_pcode === place.place_pcode && o.indicator_code === "population",
  );
  const period = latestPeriod(rows);
  if (period === null) return null;

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

  return {
    period,
    total,
    female,
    male,
    femaleShare: total > 0 ? female / total : null,
    density: place.area_sqkm ? total / place.area_sqkm : null,
    bands,
  };
}

/** Datasets that contributed to a page, for the provenance section. */
export function sourcesFor(sourceIds: string[]) {
  const wanted = new Set(sourceIds);
  return manifest().datasets.filter(
    (d) => wanted.has(d.table) || sourceIds.includes(d.table),
  );
}

export const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf.format(Math.round(n));
}

export function formatPercent(x: number | null): string {
  if (x === null) return "—";
  return `${(x * 100).toFixed(1)}%`;
}
