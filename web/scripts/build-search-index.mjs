/**
 * Build the search index from published data.
 *
 * Runs before `next build`, reading the same Parquet the pages read and writing
 * public/search-index.json.
 *
 * Why a hand-rolled index rather than Pagefind: Pagefind indexes rendered HTML,
 * which for this site means indexing 100 pages of chrome and prose to find
 * entities we already have as structured records. A direct index of places,
 * topics, indicators and datasets is smaller, ranks better (a place is a place,
 * not a bag of words), and needs no extra build tooling. It also covers the 753
 * local units, which have no pages of their own and so would be invisible to an
 * HTML crawler.
 *
 * The index is fetched lazily on first interaction with the search box, so it
 * costs nothing on initial page load.
 */

import fs from "node:fs";
import path from "node:path";
import { asyncBufferFromFile, parquetReadObjects } from "hyparquet";

const DIST = path.join(process.cwd(), "..", "publish", "dist");
const OUT = path.join(process.cwd(), "public", "search-index.json");

async function read(file) {
  const full = path.join(DIST, file);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing ${file}. Run \`python -m publish.export\` first.`);
  }
  const rows = await parquetReadObjects({ file: await asyncBufferFromFile(full) });
  return rows.map((r) => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "bigint") r[k] = Number(v);
      else if (v instanceof Date) r[k] = v.toISOString().slice(0, 10);
    }
    return r;
  });
}

const LOCAL_TYPES = new Set([
  "metropolitan",
  "sub_metropolitan",
  "municipality",
  "rural_municipality",
]);

const TYPE_LABEL = {
  country: "Country",
  province: "Province",
  district: "District",
  metropolitan: "Metropolitan city",
  sub_metropolitan: "Sub-metropolitan city",
  municipality: "Municipality",
  rural_municipality: "Rural municipality",
  protected_area: "Protected area",
};

const [places, topics, indicators, manifest] = await Promise.all([
  read("places.parquet"),
  read("topics.parquet"),
  read("indicators.parquet"),
  Promise.resolve(
    JSON.parse(fs.readFileSync(path.join(DIST, "manifest.json"), "utf8")),
  ),
]);

const byId = new Map(places.map((p) => [p.place_id, p]));
const entries = [];

// --- places -------------------------------------------------------------
for (const p of places) {
  let href = null;
  let context = TYPE_LABEL[p.place_type] ?? p.place_type;

  if (p.place_type === "country") {
    href = "/";
  } else if (p.place_type === "province") {
    href = `/np/${p.slug}/`;
  } else if (p.place_type === "district") {
    const prov = p.parent_place_id ? byId.get(p.parent_place_id) : null;
    if (prov) {
      href = `/np/${prov.slug}/${p.slug}/`;
      context = `District · ${prov.name_en}`;
    }
  } else if (LOCAL_TYPES.has(p.place_type)) {
    // Local units have no page of their own yet; point at their district so the
    // result is still useful rather than absent.
    const district = p.parent_place_id ? byId.get(p.parent_place_id) : null;
    const prov = district?.parent_place_id ? byId.get(district.parent_place_id) : null;
    if (district && prov) {
      href = `/np/${prov.slug}/${district.slug}/#local-governments`;
      context = `${TYPE_LABEL[p.place_type]} · ${district.name_en}`;
    }
  }

  if (!href) continue;
  entries.push({
    k: "place",
    t: p.name_en,
    n: p.name_ne || null,
    c: context,
    h: href,
  });
}

// --- topics -------------------------------------------------------------
for (const t of topics) {
  if (t.status !== "live" || t.observation_count === 0) continue;
  entries.push({
    k: "topic",
    t: t.name_en,
    n: t.name_ne || null,
    c: `Topic · ${t.indicator_count} indicator${t.indicator_count === 1 ? "" : "s"}`,
    h: `/topics/${t.slug}/`,
  });
}

// --- indicators ---------------------------------------------------------
const topicName = new Map(topics.map((t) => [t.topic_id, t.name_en]));
for (const i of indicators) {
  entries.push({
    k: "indicator",
    t: i.name_en,
    n: i.name_ne || null,
    c: `Indicator · ${topicName.get(i.topic_id) ?? ""}`.trim(),
    h: `/indicators/${i.indicator_id.replace(/_/g, "-")}/`,
  });
}

// --- datasets -----------------------------------------------------------
for (const s of manifest.sources) {
  entries.push({
    k: "dataset",
    t: s.title,
    n: null,
    c: `Dataset · ${s.publisher}`,
    h: "/datasets/",
  });
}

// Deduplicate on (kind, title, href): two districts can share a name, but the
// same entity should not appear twice.
const seen = new Set();
const deduped = entries.filter((e) => {
  const key = `${e.k}|${e.t}|${e.h}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(deduped));

const bytes = fs.statSync(OUT).size;
const counts = deduped.reduce((acc, e) => ({ ...acc, [e.k]: (acc[e.k] ?? 0) + 1 }), {});
console.log(
  `[search-index] ${deduped.length} entries (${(bytes / 1024).toFixed(0)} KB) —`,
  Object.entries(counts)
    .map(([k, n]) => `${n} ${k}`)
    .join(", "),
);
