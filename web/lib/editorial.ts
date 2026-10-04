import {
  type Distribution,
  type Place,
  type PopulationSummary,
  type SourceDataset,
  type Unit,
  benchmarksFor,
  country,
  districtsOf,
  distributionsFor,
  indicators,
  liveTopics,
  localUnitMapFor,
  localUnitsOf,
  manifest,
  metricMapFor,
  observations,
  placeBySlug,
  places,
  placeProfile,
  populationOf,
  provinces,
  seriesFor,
  topics,
  units,
  updateLog,
} from "./data";
import { pickAggregate, pickMember, statusLabel } from "./format";

/*
  One real-data layer for both design directions.

  Written once on purpose. The whole value of comparing two directions is that
  they carry the *same* content, so any difference a reader sees is composition
  and not a different selection of facts. If each direction assembled its own
  data they would diverge within an hour, and the comparison would stop meaning
  anything.

  Everything here is published DataNepal data. Nothing is invented, rounded
  into a nicer number, or carried forward from the approved prototype's mock
  values -- that prototype shows GDP per capita at US$1,573 and the real 2025
  figure is US$1,535.88, which is exactly the kind of difference that makes a
  mock-derived prototype a lie.
*/

/* ------------------------------------------------------------- primitives */

export type Provenance = {
  publisher: string;
  publisherNe: string | null;
  acquiredFrom: string;
  acquiredIndirectly: boolean;
  licence: string;
  url: string;
  retrieved: string;
};

export type Figure = {
  indicatorId: string;
  label: string;
  labelNe: string | null;
  definition: string | null;
  value: number;
  unit: Unit | undefined;
  period: string;
  /** Reader-facing status word, null when the figure is a plain enumeration. */
  status: string | null;
  /** Raw status, kept so a caller can style census and projection differently. */
  rawStatus: string;
  source: Provenance | null;
  /** Year/value pairs for a sparkline or trend, oldest first. Possibly empty. */
  points: { year: number; value: number }[];
  /** Change against the previous published period, when there is one. */
  change: { from: number; delta: number; fromYear: number } | null;
};

function provenanceOf(datasetId: string, sources: SourceDataset[]): Provenance | null {
  const s = sources.find((x) => x.dataset_id === datasetId);
  if (!s) return null;
  return {
    publisher: s.publisher,
    publisherNe: s.publisher_name_ne,
    acquiredFrom: s.acquired_from,
    acquiredIndirectly: s.acquired_indirectly,
    licence: s.licence,
    url: s.url,
    retrieved: s.retrieved,
  };
}

/* ------------------------------------------------------- national snapshot */

/**
 * The four national figures the homepage leads with.
 *
 * Chosen to be real, current, and about the country rather than about the
 * platform: a count of how many indicators we hold is not a fact about Nepal
 * and does not belong beside inflation. Each has a long enough series to carry
 * an honest sparkline, except population, which is a census enumeration and
 * gets no trend line because two census points is not a trend.
 */
const SNAPSHOT_IDS = [
  "population",
  "gdp_per_capita_usd",
  "cpi_inflation_annual",
  "remittances_percent_gdp",
] as const;

/** Long national series worth showing as actual charts rather than sparklines. */
const TREND_IDS = [
  "gdp_per_capita_usd",
  "life_expectancy_at_birth",
  "internet_users_pct",
  "cpi_inflation_annual",
] as const;

async function nationalFigures(ids: readonly string[]): Promise<Figure[]> {
  const nepal = await country();
  if (!nepal) return [];
  const [obs, inds, us, m] = await Promise.all([
    observations(),
    indicators(),
    units(),
    Promise.resolve(manifest()),
  ]);
  const unitById = new Map(us.map((u) => [u.unit_id, u]));
  const indById = new Map(inds.map((i) => [i.indicator_id, i]));

  const out: Figure[] = [];
  for (const id of ids) {
    const ind = indById.get(id);
    if (!ind) continue;
    const rows = obs.filter(
      (o) =>
        o.place_id === nepal.place_id &&
        o.indicator_id === id &&
        o.value_numeric !== null,
    );
    if (!rows.length) continue;

    /*
      Enumeration before projection, then the latest year -- the same rule
      pickHeadline uses. Latest-first is the obvious ordering and it is wrong
      here: Nepal has a 2023 UNFPA projection beside the 2021 census, so a
      latest-first homepage would lead with 30.9M while every place page below
      it said 29.2M.
    */
    const rank: Record<string, number> = {
      actual: 0,
      provisional: 1,
      estimate: 2,
      projection: 3,
      forecast: 4,
    };
    const yearOf = (r: (typeof rows)[number]) => Number(r.period_start.slice(0, 4));
    const best = [...rows].sort(
      (a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || yearOf(b) - yearOf(a),
    )[0];

    /*
      Within the chosen status and year, the row that is the whole -- and
      nothing if there isn't one.

      No `?? samePeriod[0]` fallback. An indicator dimensioned by party has no
      total worth printing, and falling back to the first row is precisely the
      bug this platform already shipped once: /indicators/ showed 3 seats for a
      party that won 3, instead of 125 for the party that won 125. A topic with
      no national aggregate gets no headline here, which is the honest answer.
    */
    const samePeriod = rows.filter(
      (r) => r.status === best.status && yearOf(r) === yearOf(best),
    );
    const whole = pickAggregate(samePeriod);
    if (!whole || whole.value_numeric === null) continue;

    // The series, restricted to aggregate rows of the same status so a
    // sparkline cannot mix a census point into a modelled line.
    const series = rows
      .filter((r) => r.status === best.status)
      .filter((r) => {
        const agg = pickAggregate(
          rows.filter((x) => x.status === best.status && yearOf(x) === yearOf(r)),
        );
        return agg ? r.dimension_key === agg.dimension_key : false;
      })
      .map((r) => ({ year: yearOf(r), value: r.value_numeric! }))
      .sort((a, b) => a.year - b.year);

    const prior = series.filter((p) => p.year < yearOf(whole)).at(-1) ?? null;

    out.push({
      indicatorId: id,
      label: ind.name_en,
      labelNe: ind.name_ne,
      definition: ind.definition,
      value: whole.value_numeric,
      unit: unitById.get(ind.default_unit_id),
      period: String(yearOf(whole)),
      status: statusLabel(whole.status),
      rawStatus: whole.status,
      source: provenanceOf(whole.dataset_id, m.sources),
      points: series.length >= 3 ? series : [],
      change: prior
        ? {
            from: prior.value,
            delta: whole.value_numeric - prior.value,
            fromYear: prior.year,
          }
        : null,
    });
  }
  return out;
}

export const nationalSnapshot = () => nationalFigures(SNAPSHOT_IDS);
export const nationalTrends = () => nationalFigures(TREND_IDS);

/* --------------------------------------------------------- geography scale */

export type GeographyScale = {
  provinces: number;
  districts: number;
  localGovernments: number;
  /** Platform coverage, deliberately separated from the geography above. */
  indicators: number;
  datasets: number;
  subNationalIndicators: number;
};

export async function geographyScale(): Promise<GeographyScale> {
  const [all, inds, m] = await Promise.all([
    places(),
    indicators(),
    Promise.resolve(manifest()),
  ]);
  const LOCAL = new Set([
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ]);
  const obs = await observations();
  const typeOf = new Map(all.map((p) => [p.place_id, p.place_type]));
  const sub = new Set<string>();
  for (const o of obs) {
    if (o.value_numeric === null || !o.place_id) continue;
    if ((typeOf.get(o.place_id) ?? "country") !== "country") sub.add(o.indicator_id);
  }
  return {
    provinces: all.filter((p) => p.place_type === "province").length,
    districts: all.filter((p) => p.place_type === "district").length,
    localGovernments: all.filter((p) => LOCAL.has(p.place_type)).length,
    indicators: inds.length,
    datasets: m.sources.length,
    subNationalIndicators: sub.size,
  };
}

/* -------------------------------------------------------------- topic hubs */

export type TopicCard = {
  id: string;
  slug: string;
  name: string;
  nameNe: string | null;
  description: string | null;
  indicatorCount: number;
  /** A real headline from inside the topic, so the card says something. */
  headline: Figure | null;
};

/**
 * Topics that currently have something in them.
 *
 * `liveTopics` returns twelve, two of which hold no indicators at all --
 * Tourism is `planned` and Geography is live with nothing under it. Featuring
 * an empty domain prominently is the "Coming soon" pattern the approved
 * prototype is full of and the brief explicitly rejects, so they are filtered
 * here rather than rendered grey.
 */
/*
  Which indicator speaks for each topic. Stated, not inferred.

  The same convention the production topic pages already follow, and for the
  same reason: inferring it from series length or ingestion order means a new
  dataset can silently change what a topic leads with. Picking by longest
  series gave Education "Population aged 5 and over, 26,725,295" -- true,
  published, and not what anybody wants to know about education.

  Elections is deliberately absent. Its indicators are dimensioned by party and
  have no national total; the sum of seats by party is the size of the house,
  not a fact about the country. Its card shows its indicator count and no
  figure.
*/
const TOPIC_HEADLINE: Record<string, string> = {
  population: "population",
  economy: "gdp_per_capita_usd",
  government: "government_revenue_pct_gdp",
  education: "literacy_rate",
  health: "life_expectancy_at_birth",
  agriculture: "cereal_yield_kg_per_ha",
  infrastructure: "electricity_access_pct",
  environment: "forest_area_pct",
  labour: "unemployment_rate",
};

export async function topicCards(): Promise<TopicCard[]> {
  const ts = await liveTopics();
  const withContent = ts.filter((t) => t.indicator_count > 0);

  const figures = await nationalFigures(Object.values(TOPIC_HEADLINE));
  const byId = new Map(figures.map((f) => [f.indicatorId, f]));

  return withContent.map((t) => {
    const chosen = TOPIC_HEADLINE[t.slug];
    const headline = chosen ? (byId.get(chosen) ?? null) : null;
    return {
      id: t.topic_id,
      slug: t.slug,
      name: t.name_en,
      nameNe: t.name_ne,
      description: t.description,
      indicatorCount: t.indicator_count,
      headline,
    };
  });
}

/* ------------------------------------------------------------ province map */

export type ProvinceRow = {
  placeId: string;
  name: string;
  nameNe: string | null;
  slug: string;
  value: number | null;
};

export async function provinceOverview(frame: { maxWidth: number; maxHeight: number }) {
  const ps = await provinces();
  const map = await metricMapFor(
    ps,
    ["population", "households", "literacy_rate"],
    frame,
  );
  const [obs] = await Promise.all([observations()]);

  const rows: ProvinceRow[] = ps
    .map((p) => {
      const mine = obs.filter(
        (o) =>
          o.place_id === p.place_id &&
          o.indicator_id === "population" &&
          o.value_numeric !== null,
      );
      const agg = pickAggregate(mine.filter((o) => o.status === "actual"));
      return {
        placeId: p.place_id,
        name: p.name_en,
        nameNe: p.name_ne,
        slug: p.slug,
        value: agg?.value_numeric ?? null,
      };
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return { map, rows };
}

/* ---------------------------------------------------------------- updates */

export type UpdateRow = {
  title: string;
  publisher: string;
  when: string;
  observations: number;
};

/**
 * Recent changes, as sentences rather than as a warehouse table.
 *
 * `updateLog` returns revision counts per dataset, which is the right data and
 * the wrong presentation for a homepage -- the production page renders it as a
 * metadata grid. Cadence, licence and file counts belong on the dataset page.
 */
export async function recentUpdates(limit = 4): Promise<UpdateRow[]> {
  const log = await updateLog();
  return log.datasets.slice(0, limit).map((d) => ({
    title: d.source.title,
    publisher: d.source.publisher,
    when: d.lastChange,
    observations: d.current,
  }));
}

/* ------------------------------------------------------- the Dhading page */

export type Benchmark = {
  label: string;
  level: string;
  value: number;
  isSelf: boolean;
};

export type LocalUnitRow = {
  placeId: string;
  name: string;
  nameNe: string | null;
  placeType: string;
  slug: string;
  href: string;
  population: number | null;
  households: number | null;
  literacy: number | null;
};

export type DhadingProfile = {
  place: Place;
  parent: Place | undefined;
  grandparent: Place | undefined;
  population: PopulationSummary | null;
  households: Figure | null;
  literacy: Figure | null;
  literacyBySex: { sex: string; value: number }[];
  /** Dhading against Bagmati and Nepal on literacy, all real. */
  literacyBenchmarks: Benchmark[];
  /** Where Dhading sits among all 77 districts on literacy. */
  literacyRank: { rank: number; of: number; top: string; bottom: string } | null;
  /** The census literacy-status partition, which is a real four-way breakdown. */
  literacyBreakdown: { label: string; all: number; female: number; male: number }[];
  areaSqKm: number | null;
  density: number | null;
  shareOfParent: number | null;
  /** Where this district sits inside its own province, counted not asserted. */
  provinceContext: { districts: number; rankByPopulation: number } | null;
  localUnits: LocalUnitRow[];
  localMap: Awaited<ReturnType<typeof metricMapFor>>;
  localOutline: string | null;
  distributions: Distribution[];
  /** Only the datasets that actually back something rendered on the page. */
  sources: SourceDataset[];
};

const LITERACY_STATUS_LABEL: Record<string, string> = {
  can_read_and_write: "Can read and write",
  can_read_only: "Can read only",
  cannot_read_or_write: "Cannot read or write",
  not_stated: "Not stated",
};

export async function dhadingProfile(frame: {
  maxWidth: number;
  maxHeight: number;
}): Promise<DhadingProfile | null> {
  const place = await placeBySlug("district", "dhading");
  if (!place) return null;

  const all = await places();
  const byId = new Map(all.map((p) => [p.place_id, p]));
  const parent = place.parent_place_id ? byId.get(place.parent_place_id) : undefined;
  const grandparent = parent?.parent_place_id
    ? byId.get(parent.parent_place_id)
    : undefined;

  const [pop, profile, obs, m, lus, geo, dists] = await Promise.all([
    populationOf(place),
    placeProfile(place),
    observations(),
    Promise.resolve(manifest()),
    localUnitsOf(place.place_id),
    localUnitMapFor(place.place_id),
    distributionsFor(place.place_id),
  ]);

  const metrics = profile.flatMap((t) => t.metrics);
  const asFigure = (indicatorId: string): Figure | null => {
    const mt = metrics.find((x) => x.indicatorId === indicatorId);
    if (!mt) return null;
    return {
      indicatorId,
      label: mt.name,
      labelNe: mt.nameNe,
      definition: mt.definition,
      value: mt.value,
      unit: mt.unit,
      period: String(mt.period),
      status: statusLabel(mt.status),
      rawStatus: mt.status,
      source: provenanceOf(mt.datasetId, m.sources),
      points: [],
      change: null,
    };
  };

  const literacy = asFigure("literacy_rate");
  const literacyMetric = metrics.find((x) => x.indicatorId === "literacy_rate");

  /* ---- benchmarks: Dhading vs its province vs the country, all measured ---- */
  const literacyAt = (placeId: string): number | null => {
    const rows = obs.filter(
      (o) =>
        o.place_id === placeId &&
        o.indicator_id === "literacy_rate" &&
        o.value_numeric !== null,
    );
    const agg = pickAggregate(rows);
    return agg?.value_numeric ?? null;
  };
  const nepal = all.find((p) => p.place_type === "country");
  const literacyBenchmarks: Benchmark[] = [];
  for (const [p, level] of [
    [place, "District"],
    [parent, "Province"],
    [nepal, "Nepal"],
  ] as const) {
    if (!p) continue;
    const v = literacyAt(p.place_id);
    if (v === null) continue;
    literacyBenchmarks.push({
      label: p.name_en,
      level,
      value: v,
      isSelf: p.place_id === place.place_id,
    });
  }

  /* ---- rank among districts, computed not asserted ---- */
  const districtLiteracy = all
    .filter((p) => p.place_type === "district")
    .map((p) => ({ name: p.name_en, value: literacyAt(p.place_id) }))
    .filter((x): x is { name: string; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value);
  const idx = districtLiteracy.findIndex((x) => x.name === place.name_en);
  const literacyRank =
    idx >= 0
      ? {
          rank: idx + 1,
          of: districtLiteracy.length,
          top: districtLiteracy[0].name,
          bottom: districtLiteracy[districtLiteracy.length - 1].name,
        }
      : null;

  /* ---- the census literacy-status partition ---- */
  const p5 = obs.filter(
    (o) =>
      o.place_id === place.place_id &&
      o.indicator_id === "population_5plus" &&
      o.value_numeric !== null &&
      o.dimension_key.includes("literacy_status="),
  );
  const statuses = [...new Set(p5.map((o) => o.dimension_key.split("|")[0]))];
  const literacyBreakdown = statuses
    .map((key) => {
      const status = key.slice("literacy_status=".length);
      const forStatus = p5.filter((o) => o.dimension_key.startsWith(key));
      const pick = (sex: string) =>
        pickMember(forStatus, "sex", sex)?.value_numeric ?? 0;
      return {
        label: LITERACY_STATUS_LABEL[status] ?? status,
        all: pick("all"),
        female: pick("female"),
        male: pick("male"),
      };
    })
    .filter((r) => r.all > 0)
    .sort((a, b) => b.all - a.all);

  /* ---- local governments, with real values and real hrefs ---- */
  const valueAt = (placeId: string, indicatorId: string): number | null => {
    const rows = obs.filter(
      (o) =>
        o.place_id === placeId &&
        o.indicator_id === indicatorId &&
        o.value_numeric !== null,
    );
    const agg = pickAggregate(rows);
    return agg?.value_numeric ?? null;
  };
  const localUnits: LocalUnitRow[] = lus
    .map((u) => ({
      placeId: u.place_id,
      name: u.name_en,
      nameNe: u.name_ne,
      placeType: u.place_type,
      slug: u.slug,
      href:
        grandparent && parent
          ? `/np/${parent.slug}/${place.slug}/${u.slug}/`
          : `/np/${place.slug}/${u.slug}/`,
      population: valueAt(u.place_id, "population"),
      households: valueAt(u.place_id, "households"),
      literacy: valueAt(u.place_id, "literacy_rate"),
    }))
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const localMap = await metricMapFor(
    lus,
    ["population", "households", "literacy_rate"],
    frame,
  );

  /* ---- density and share, derived and labelled as derived ---- */
  const areaSqKm = place.area_sqkm ?? null;
  const density = pop && areaSqKm && areaSqKm > 0 ? pop.total / areaSqKm : null;
  const parentPop = parent ? valueAt(parent.place_id, "population") : null;
  const shareOfParent =
    pop && parentPop && parentPop > 0 ? (pop.total / parentPop) * 100 : null;

  /* ---- sources: only what backs something on this page ---- */
  const usedDatasets = new Set<string>();
  for (const o of obs) {
    if (o.value_numeric === null) continue;
    const onPage =
      o.place_id === place.place_id ||
      lus.some((u) => u.place_id === o.place_id) ||
      o.place_id === parent?.place_id ||
      o.place_id === nepal?.place_id;
    if (!onPage) continue;
    if (
      [
        "population",
        "households",
        "literacy_rate",
        "literate_population",
        "population_5plus",
      ].includes(o.indicator_id)
    ) {
      usedDatasets.add(o.dataset_id);
    }
  }
  const sources = m.sources.filter((s) => usedDatasets.has(s.dataset_id));

  /* ---- position inside the province, counted rather than asserted ---- */
  const siblings = all
    .filter((p) => p.parent_place_id === parent?.place_id)
    .map((p) => ({ name: p.name_en, pop: valueAt(p.place_id, "population") }))
    .filter((x): x is { name: string; pop: number } => x.pop !== null)
    .sort((a, b) => b.pop - a.pop);
  const myIndex = siblings.findIndex((x) => x.name === place.name_en);
  const provinceContext =
    parent && myIndex >= 0
      ? { districts: siblings.length, rankByPopulation: myIndex + 1 }
      : null;

  return {
    place,
    parent,
    grandparent,
    population: pop,
    households: asFigure("households"),
    literacy,
    literacyBySex: literacyMetric?.bySex ?? [],
    literacyBenchmarks,
    literacyRank,
    literacyBreakdown,
    areaSqKm,
    density,
    shareOfParent,
    provinceContext,
    localUnits,
    localMap,
    localOutline: geo.outline,
    distributions: dists,
    sources,
  };
}

/* ------------------------------------------------------------ search feed */

export type SearchSeed = {
  places: number;
  topics: number;
  indicators: number;
  datasets: number;
};

/** What the real search index actually covers, for honest helper text. */
export async function searchScope(): Promise<SearchSeed> {
  const [all, ts, inds, m] = await Promise.all([
    places(),
    topics(),
    indicators(),
    Promise.resolve(manifest()),
  ]);
  return {
    places: all.length,
    topics: ts.filter((t) => t.indicator_count > 0).length,
    indicators: inds.length,
    datasets: m.sources.length,
  };
}

/** Districts of a province, used for the atlas drill-down. */
export const districtsOfProvince = districtsOf;
/** Re-exported so prototype pages do not import two modules for one page. */
export { benchmarksFor, seriesFor };

/* ======================================================================
   Any place, at any level
   ====================================================================== */

export type ChildGroup = {
  /** "provinces", "districts", "local governments". */
  noun: string;
  rows: LocalUnitRow[];
  map: Awaited<ReturnType<typeof metricMapFor>>;
};

export type EditorialPlace = {
  place: Place;
  parent: Place | undefined;
  /** Nearest first, country last. Empty for Nepal. */
  ancestors: Place[];
  population: PopulationSummary | null;
  households: Figure | null;
  literacy: Figure | null;
  literacyBySex: { sex: string; value: number }[];
  /** Self, then each ancestor up to Nepal. One row when there is no ancestor. */
  literacyBenchmarks: Benchmark[];
  /** Position among places of the same type, nationally. */
  literacyRank: { rank: number; of: number; top: string; bottom: string } | null;
  literacyBreakdown: { label: string; all: number; female: number; male: number }[];
  areaSqKm: number | null;
  density: number | null;
  shareOfParent: number | null;
  /** Rank by population among places sharing this parent. */
  parentContext: { siblings: number; rankByPopulation: number } | null;
  /** The level below, where there is one. Null for a local government. */
  children: ChildGroup | null;
  /** For a leaf place: the places it sits among, with it marked. */
  siblings: ChildGroup | null;
  /** Indicators published only nationally, for the coverage sentence. */
  nationalOnly: { id: string; name: string }[];
  /**
   * Every topic with a figure, for Nepal only.
   *
   * Nepal is the one place that has all ten domains -- below it only the five
   * census measures exist -- so it is the one page that shows them. Loaded
   * only there; 837 other pages do not pay for it.
   */
  nationalTopics: {
    name: string;
    slug: string;
    figures: { label: string; value: string; period: string }[];
  }[];
  /** Indicators with no total, for Nepal's Elections section. */
  distributions: Distribution[];
  sources: SourceDataset[];
};

const CHILD_NOUN: Record<string, string> = {
  country: "provinces",
  province: "districts",
  district: "local governments",
};

/** Plural for the type of a place, used when ranking it among its peers. */
const PEER_NOUN: Record<string, string> = {
  province: "provinces",
  district: "districts",
  metropolitan: "local governments",
  sub_metropolitan: "local governments",
  municipality: "local governments",
  rural_municipality: "local governments",
};

/**
 * Everything a place page needs, for a place at any level.
 *
 * The Dhading-only version of this was the thing standing between the
 * prototype and 838 pages. Levels differ in three ways and no more: Nepal has
 * no ancestor to benchmark against, a local government has no children to
 * explore, and the noun for the level below changes.
 */
export async function editorialPlace(
  place: Place,
  frame: { maxWidth: number; maxHeight: number },
): Promise<EditorialPlace> {
  const all = await places();
  const byId = new Map(all.map((p) => [p.place_id, p]));

  const ancestors: Place[] = [];
  let cursor = place;
  while (cursor.parent_place_id) {
    const next = byId.get(cursor.parent_place_id);
    if (!next) break;
    ancestors.push(next);
    cursor = next;
  }
  const parent = ancestors[0];
  const nepal = all.find((p) => p.place_type === "country");

  const [pop, profile, obs, m] = await Promise.all([
    populationOf(place),
    placeProfile(place),
    observations(),
    Promise.resolve(manifest()),
  ]);

  const metrics = profile.flatMap((t) => t.metrics);
  const asFigure = (indicatorId: string): Figure | null => {
    const mt = metrics.find((x) => x.indicatorId === indicatorId);
    if (!mt) return null;
    return {
      indicatorId,
      label: mt.name,
      labelNe: mt.nameNe,
      definition: mt.definition,
      value: mt.value,
      unit: mt.unit,
      period: String(mt.period),
      status: statusLabel(mt.status),
      rawStatus: mt.status,
      source: provenanceOf(mt.datasetId, m.sources),
      points: [],
      change: null,
    };
  };

  /**
   * One value per place and indicator, enumeration before projection.
   *
   * Status first, then latest year -- the same rule as pickHeadline, and not
   * optional. A plain latest-first version of this divided Nilkhantha's 2021
   * census population by Dhading's 2023 *projection* and reported its share of
   * the district as 17.4% instead of 18.1%. Every figure was individually
   * correct; the ratio was not. The same trap sits under the sibling rankings,
   * where one place having a projection and another not would silently sort
   * them against different reference periods.
   */
  const valueAt = (placeId: string, indicatorId: string): number | null => {
    const rows = obs.filter(
      (o) =>
        o.place_id === placeId &&
        o.indicator_id === indicatorId &&
        o.value_numeric !== null,
    );
    if (!rows.length) return null;
    const rank: Record<string, number> = {
      actual: 0,
      provisional: 1,
      estimate: 2,
      projection: 3,
      forecast: 4,
    };
    const yearOf = (r: (typeof rows)[number]) => Number(r.period_start.slice(0, 4));
    const best = [...rows].sort(
      (a, b) => (rank[a.status] ?? 5) - (rank[b.status] ?? 5) || yearOf(b) - yearOf(a),
    )[0];
    const samePeriod = rows.filter(
      (r) => r.status === best.status && yearOf(r) === yearOf(best),
    );
    return pickAggregate(samePeriod)?.value_numeric ?? null;
  };

  const literacy = asFigure("literacy_rate");
  const literacyMetric = metrics.find((x) => x.indicatorId === "literacy_rate");

  /* ---- benchmarks: self, then every ancestor up to Nepal ---- */
  const literacyBenchmarks: Benchmark[] = [];
  for (const [p, level] of [
    [place, TYPE_LABEL[place.place_type] ?? "This place"],
    ...ancestors.map((a) => [a, TYPE_LABEL[a.place_type] ?? a.name_en] as const),
  ] as const) {
    if (!p) continue;
    const v = valueAt(p.place_id, "literacy_rate");
    if (v === null) continue;
    literacyBenchmarks.push({
      label: p.name_en,
      level,
      value: v,
      isSelf: p.place_id === place.place_id,
    });
  }

  /* ---- rank among peers of the same type, nationally ---- */
  const peers = all
    .filter((p) => p.place_type === place.place_type)
    .map((p) => ({ name: p.name_en, value: valueAt(p.place_id, "literacy_rate") }))
    .filter((x): x is { name: string; value: number } => x.value !== null)
    .sort((a, b) => b.value - a.value);
  const idx = peers.findIndex((x) => x.name === place.name_en);
  const literacyRank =
    idx >= 0 && peers.length > 2
      ? {
          rank: idx + 1,
          of: peers.length,
          top: peers[0].name,
          bottom: peers[peers.length - 1].name,
        }
      : null;

  /* ---- the census literacy-status partition ---- */
  const p5 = obs.filter(
    (o) =>
      o.place_id === place.place_id &&
      o.indicator_id === "population_5plus" &&
      o.value_numeric !== null &&
      o.dimension_key.includes("literacy_status="),
  );
  const literacyBreakdown = [...new Set(p5.map((o) => o.dimension_key.split("|")[0]))]
    .map((key) => {
      const status = key.slice("literacy_status=".length);
      const forStatus = p5.filter((o) => o.dimension_key.startsWith(key));
      const pick = (sex: string) =>
        pickMember(forStatus, "sex", sex)?.value_numeric ?? 0;
      return {
        label: LITERACY_STATUS_LABEL[status] ?? status,
        all: pick("all"),
        female: pick("female"),
        male: pick("male"),
      };
    })
    .filter((r) => r.all > 0)
    .sort((a, b) => b.all - a.all);

  /* ---- the level below, or the peers it sits among ---- */
  const kids = all.filter((p) => p.parent_place_id === place.place_id);
  const toRows = (list: Place[]): LocalUnitRow[] =>
    list
      .map((u) => ({
        placeId: u.place_id,
        name: u.name_en,
        nameNe: u.name_ne,
        placeType: u.place_type,
        slug: u.slug,
        href: hrefOf(u, byId),
        population: valueAt(u.place_id, "population"),
        households: valueAt(u.place_id, "households"),
        literacy: valueAt(u.place_id, "literacy_rate"),
      }))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  let children: ChildGroup | null = null;
  if (kids.length) {
    children = {
      noun: CHILD_NOUN[place.place_type] ?? "places",
      rows: toRows(kids),
      map: await metricMapFor(
        kids,
        ["population", "households", "literacy_rate"],
        frame,
      ),
    };
  }

  let siblings: ChildGroup | null = null;
  if (!kids.length && parent) {
    const peerPlaces = all.filter((p) => p.parent_place_id === parent.place_id);
    siblings = {
      noun: PEER_NOUN[place.place_type] ?? "places",
      rows: toRows(peerPlaces),
      map: await metricMapFor(
        peerPlaces,
        ["population", "households", "literacy_rate"],
        frame,
      ),
    };
  }

  /* ---- derived figures ---- */
  const areaSqKm = place.area_sqkm ?? null;
  const density = pop && areaSqKm && areaSqKm > 0 ? pop.total / areaSqKm : null;
  const parentPop = parent ? valueAt(parent.place_id, "population") : null;
  const shareOfParent =
    pop && parentPop && parentPop > 0 ? (pop.total / parentPop) * 100 : null;

  const siblingPlaces = parent
    ? all
        .filter((p) => p.parent_place_id === parent.place_id)
        .map((p) => ({ name: p.name_en, v: valueAt(p.place_id, "population") }))
        .filter((x): x is { name: string; v: number } => x.v !== null)
        .sort((a, b) => b.v - a.v)
    : [];
  const myIndex = siblingPlaces.findIndex((x) => x.name === place.name_en);
  const parentContext =
    parent && myIndex >= 0
      ? { siblings: siblingPlaces.length, rankByPopulation: myIndex + 1 }
      : null;

  /* ---- indicators that stop at the nation, for the coverage sentence ---- */
  const [inds] = await Promise.all([indicators()]);
  const typeOf = new Map(all.map((p) => [p.place_id, p.place_type]));
  const subNational = new Set<string>();
  for (const o of obs) {
    if (o.value_numeric === null || !o.place_id) continue;
    if ((typeOf.get(o.place_id) ?? "country") !== "country") {
      subNational.add(o.indicator_id);
    }
  }
  const nationalOnly = inds
    .filter((i) => !subNational.has(i.indicator_id))
    .map((i) => ({ id: i.indicator_id, name: i.name_en }));

  /* ---- sources: only what backs this page ---- */
  const onPageIds = new Set<string>([
    place.place_id,
    ...kids.map((k) => k.place_id),
    ...(siblings?.rows.map((r) => r.placeId) ?? []),
    ...ancestors.map((a) => a.place_id),
    ...(nepal ? [nepal.place_id] : []),
  ]);
  const used = new Set<string>();
  for (const o of obs) {
    if (o.value_numeric === null || !onPageIds.has(o.place_id ?? "")) continue;
    if (
      [
        "population",
        "households",
        "literacy_rate",
        "literate_population",
        "population_5plus",
      ].includes(o.indicator_id)
    ) {
      used.add(o.dataset_id);
    }
  }

  /* ---- Nepal only: the other eight domains ---- */
  const isCountry = place.place_type === "country";
  const ts = isCountry ? await topics() : [];
  const us = isCountry ? await units() : [];
  const unitById = new Map(us.map((u) => [u.unit_id, u]));
  const nationalTopics = isCountry
    ? ts
        .filter((t) => t.indicator_count > 0)
        .map((t) => ({
          name: t.name_en,
          slug: t.slug,
          figures: profile
            .filter((g) => g.topic.topic_id === t.topic_id)
            .flatMap((g) => g.metrics)
            .slice(0, 3)
            .map((mt) => ({
              label: mt.name,
              value: formatFigureValue(mt.value, unitById.get(mt.unit?.unit_id ?? "")),
              period: String(mt.period),
            })),
        }))
        .filter((t) => t.figures.length > 0)
    : [];
  const dists = isCountry ? await distributionsFor(place.place_id) : [];

  return {
    place,
    parent,
    ancestors,
    population: pop,
    households: asFigure("households"),
    literacy,
    literacyBySex: literacyMetric?.bySex ?? [],
    literacyBenchmarks,
    literacyRank,
    literacyBreakdown,
    areaSqKm,
    density,
    shareOfParent,
    parentContext,
    children,
    siblings,
    nationalOnly,
    nationalTopics,
    distributions: dists,
    sources: m.sources.filter((s) => used.has(s.dataset_id)),
  };
}

/** Reader-facing label for a place type. */
export const TYPE_LABEL: Record<string, string> = {
  country: "Nepal",
  province: "Province",
  district: "District",
  metropolitan: "Metropolitan city",
  sub_metropolitan: "Sub-metropolitan city",
  municipality: "Municipality",
  rural_municipality: "Rural municipality",
};

/** Hierarchical URL for a place, from the parent chain. */
function hrefOf(p: Place, byId: Map<string, Place>): string {
  if (p.place_type === "country") return "/np/";
  const parts = [p.slug];
  let cur = p;
  while (cur.parent_place_id) {
    const next = byId.get(cur.parent_place_id);
    if (!next || next.place_type === "country") break;
    parts.unshift(next.slug);
    cur = next;
  }
  return `/np/${parts.join("/")}/`;
}

/** Format a metric value by its unit's own symbol. */
function formatFigureValue(v: number, unit: Unit | undefined): string {
  if (!unit) return formatNumberPlain(v);
  const sym = unit.symbol ?? "";
  const join = (n: string) =>
    !sym ? n : /^[%/]/.test(sym) ? `${n}${sym}` : `${n} ${sym}`;
  switch (unit.unit_kind) {
    case "currency":
      return `${sym}${formatNumberPlain(Math.round(v))}`;
    case "ratio":
    case "duration":
      return join(
        v >= 1000
          ? v.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : v.toFixed(1),
      );
    default:
      return formatNumberPlain(v);
  }
}

const formatNumberPlain = (n: number) => n.toLocaleString("en-US");
