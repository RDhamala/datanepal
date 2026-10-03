/**
 * Build the comparison index from published data.
 *
 * Runs before `next build`, reading the same Parquet the pages read and
 * writing public/compare-index.json.
 *
 * Why a separate asset rather than props on the page: /compare has no server
 * to ask, so the places a reader might pick have to be on the client already.
 * Embedding 838 places in the page's HTML would make one route carry the
 * weight of a comparison nobody has asked for yet; a file fetched on first
 * interaction costs nothing until it is used, which is the same bargain the
 * search index already strikes.
 *
 * Only measures published below the national level are included. The other 31
 * indicators are national series, and a comparison of two districts on a
 * figure that exists for neither is not a comparison -- it is four dashes.
 *
 * Rows are arrays rather than objects. Named keys on 838 records cost more in
 * repeated key text than the file does in values.
 */

import fs from "node:fs";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const DIST = path.join(process.cwd(), "..", "publish", "dist");
const OUT = path.join(process.cwd(), "public", "compare-index.json");

/** Place types a reader can compare. Protected areas are not local units. */
const COMPARABLE = new Set([
  "country",
  "province",
  "district",
  "municipality",
  "rural_municipality",
  "metropolitan",
  "sub_metropolitan",
]);

async function read(file) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing ${file}. Run \`python -m publish.export\` first.`);
  }
  const rows = await parquetReadObjects({ file: await asyncBufferFromFile(full) });
  // BIGINT arrives as a JS BigInt and throws on contact with a number; DATE
  // arrives as a Date at UTC midnight. Same normalisation as lib/data.ts.
  return rows.map((r) => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "bigint") r[k] = Number(v);
      else if (v instanceof Date) r[k] = v.toISOString().slice(0, 10);
    }
    return r;
  });
}

const [places, observations, indicators, units] = await Promise.all([
  read("places.parquet"),
  read("observations.parquet"),
  read("indicators.parquet"),
  read("units.parquet"),
]);

const byId = new Map(places.map((p) => [p.place_id, p]));

/* ------------------------------------------------------------ geography */

/**
 * The hierarchical path a place is addressed by, which is also its URL.
 *
 * Used as the identifier in `?p=` because it is readable, stable, and unique
 * where a name is not: 22 local-government names are shared across districts,
 * and four places are called Madi.
 */
function pathOf(place) {
  if (place.place_type === "country") return "nepal";
  const parts = [place.slug];
  let cursor = place;
  while (cursor.parent_place_id) {
    cursor = byId.get(cursor.parent_place_id);
    if (!cursor || cursor.place_type === "country") break;
    parts.unshift(cursor.slug);
  }
  return parts.join("/");
}

/** Ancestors, nearest first. A reader comparing a place with its own parent
 *  is double-counting, and the page says so rather than refusing. */
function ancestorPaths(place) {
  const out = [];
  let cursor = place;
  while (cursor.parent_place_id) {
    cursor = byId.get(cursor.parent_place_id);
    if (!cursor) break;
    out.push(pathOf(cursor));
  }
  return out;
}

/* ------------------------------------------------------------- measures */

// Deepest level each indicator reaches. Anything that stops at the country is
// not comparable between places.
const typeOf = new Map(places.map((p) => [p.place_id, p.place_type]));
const subNational = new Set();
for (const o of observations) {
  if (o.value_numeric === null || !o.place_id) continue;
  if ((typeOf.get(o.place_id) ?? "country") !== "country") {
    subNational.add(o.indicator_id);
  }
}

const unitById = new Map(units.map((u) => [u.unit_id, u]));
const measures = indicators
  .filter((i) => subNational.has(i.indicator_id))
  .map((i) => {
    const unit = unitById.get(i.default_unit_id);
    return {
      id: i.indicator_id,
      label: i.short_name_en || i.name_en,
      name: i.name_en,
      unitId: i.default_unit_id,
      unitName: unit?.name_en ?? null,
      unitKind: unit?.unit_kind ?? null,
      unitSymbol: unit?.symbol ?? null,
      // A rate cannot be summed across places. The panel states this rather
      // than offering a total a reader would otherwise compute themselves.
      additive: Boolean(i.is_additive),
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const measureIndex = new Map(measures.map((m, i) => [m.id, i]));

/* --------------------------------------------------------------- values */

/**
 * One value per place per measure: the aggregate, at the latest period.
 *
 * Mirrors pickAggregate's rule rather than re-deriving it loosely: a row is
 * the whole when every dimension it declares is a total, or when a specific
 * member's dimension takes only one value across the rows in scope -- which is
 * how a local government publishes census population as
 * `residence_type=household`. A dimension that varies cannot be collapsed by
 * picking one of its members.
 */
function aggregateOf(rows) {
  const seen = new Map();
  for (const r of rows) {
    if (r.dimension_key === "none") continue;
    for (const part of r.dimension_key.split("|")) {
      const dim = part.slice(0, part.indexOf("="));
      const set = seen.get(dim) ?? new Set();
      set.add(part.slice(dim.length + 1));
      seen.set(dim, set);
    }
  }
  const specific = (key) =>
    key === "none" ? [] : key.split("|").filter((p) => !p.endsWith("=all"));
  const varies = (part) => (seen.get(part.slice(0, part.indexOf("=")))?.size ?? 1) > 1;

  const candidates = rows.filter((r) => !specific(r.dimension_key).some(varies));
  if (!candidates.length) return null;

  /*
    Enumerations before projections, and only then the latest.

    Taking the latest period first is the obvious ordering and it is wrong
    here. Nepal is the only place with a 2023 UNFPA projection alongside the
    2021 census, so a latest-first rule gave the country 30.9M while all 837
    places below it carried the 2021 count -- a comparison silently spanning
    two reference periods, which is the single hazard this platform is most
    exposed to. Same rule as pickHeadline in lib/format.ts: the census is the
    answer, a projection for a later date is context.
  */
  const rank = { actual: 0, provisional: 1, estimate: 2, projection: 3, forecast: 4 };
  const year = (r) => Number(r.period_start.slice(0, 4));
  const best = [...candidates].sort(
    (a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || year(b) - year(a),
  )[0];

  const current = candidates.filter(
    (r) => r.status === best.status && year(r) === year(best),
  );
  return [...current].sort(
    (a, b) =>
      specific(a.dimension_key).length - specific(b.dimension_key).length ||
      a.dimension_key.localeCompare(b.dimension_key),
  )[0];
}

const rowsFor = new Map();
for (const o of observations) {
  if (!o.place_id || o.value_numeric === null) continue;
  if (!measureIndex.has(o.indicator_id)) continue;
  // A pipe, not a control character: place ids are `pl_<hex>` and indicator
  // ids are snake_case, so neither can contain one. An earlier version used a
  // literal NUL, which works in JS and makes git treat the file as binary.
  const key = `${o.place_id}|${o.indicator_id}`;
  const list = rowsFor.get(key);
  if (list) list.push(o);
  else rowsFor.set(key, [o]);
}

const out = [];
let periodMin = Infinity;
let periodMax = -Infinity;

for (const place of places) {
  if (!COMPARABLE.has(place.place_type)) continue;

  const values = new Array(measures.length).fill(null);
  let any = false;
  for (const m of measures) {
    const rows = rowsFor.get(`${place.place_id}|${m.id}`);
    if (!rows) continue;
    const pick = aggregateOf(rows);
    if (!pick) continue;
    values[measureIndex.get(m.id)] = pick.value_numeric;
    any = true;
    const year = Number(pick.period_start.slice(0, 4));
    if (year < periodMin) periodMin = year;
    if (year > periodMax) periodMax = year;
  }
  if (!any) continue;

  out.push([
    pathOf(place),
    place.name_en,
    place.name_ne ?? null,
    place.place_type,
    ancestorPaths(place),
    values,
  ]);
}

out.sort((a, b) => a[1].localeCompare(b[1]));

const payload = {
  generated_at: new Date().toISOString(),
  period: periodMin === periodMax ? String(periodMin) : `${periodMin}–${periodMax}`,
  // [path, name, nameNe, type, ancestorPaths, values]
  columns: ["path", "name", "name_ne", "type", "ancestors", "values"],
  measures,
  places: out,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));

const bytes = fs.statSync(OUT).size;
console.log(
  `[compare-index] ${out.length} places × ${measures.length} measures ` +
    `(${(bytes / 1024).toFixed(0)} KB)`,
);

// The count this platform is most exposed to getting quietly wrong. A compare
// index that silently lost the local governments would still look fine.
const localTypes = new Set([
  "municipality",
  "rural_municipality",
  "metropolitan",
  "sub_metropolitan",
]);
const locals = out.filter((r) => localTypes.has(r[3])).length;
if (locals !== 753) {
  throw new Error(`[compare-index] ${locals} local governments, expected 753`);
}
if (out.filter((r) => r[3] === "district").length !== 77) {
  throw new Error("[compare-index] expected 77 districts");
}
if (out.filter((r) => r[3] === "province").length !== 7) {
  throw new Error("[compare-index] expected 7 provinces");
}
