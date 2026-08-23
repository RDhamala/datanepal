/**
 * Tests for the build-time data layer.
 *
 * These read the real published Parquet rather than fixtures, deliberately, and
 * assert against externally known facts about Nepal -- 7 provinces, 77
 * districts, 753 local units, 17 age bands. A fixture would agree with whatever
 * the code produced while being wrong, which is exactly the failure mode that
 * once let 262,948 people over 80 vanish from the dataset while every
 * consistency check passed.
 */

import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  asPercentValue,
  country,
  dimensionKey,
  formatCompact,
  formatNumber,
  formatPercent,
  formatWithUnit,
  indicators,
  localUnitsOf,
  manifest,
  observations,
  placeBySlug,
  places,
  populationOf,
  seriesFor,
  sourcesFor,
  statusLabel,
  tablesFor,
  units,
  topics,
  liveTopics,
  indicatorSlug,
  indicatorBySlug,
  comparisonFor,
} from "./data";

const LOCAL_TYPES = new Set([
  "metropolitan",
  "sub_metropolitan",
  "municipality",
  "rural_municipality",
]);

describe("places", () => {
  it("has the right count of each place type", async () => {
    const all = await places();
    const of = (t: string) => all.filter((p) => p.place_type === t).length;

    expect(of("country")).toBe(1);
    expect(of("province")).toBe(7);
    expect(of("district")).toBe(77);
    expect(all.filter((p) => LOCAL_TYPES.has(p.place_type))).toHaveLength(753);
    expect(of("protected_area")).toBe(22);
  });

  it("gives every place a unique surrogate id", async () => {
    const all = await places();
    expect(new Set(all.map((p) => p.place_id)).size).toBe(all.length);
  });

  it("uses a surrogate id, not the source P-code", async () => {
    // The distinction matters: a paid API contract must survive OCHA
    // renumbering a P-code. If place_id ever equals ocha_pcode, the surrogate
    // has collapsed back into a source identifier.
    const all = await places();
    expect(all.every((p) => p.place_id !== p.ocha_pcode)).toBe(true);
    expect(all.every((p) => p.place_id.startsWith("pl_"))).toBe(true);
  });

  it("links every place except the country to a parent that exists", async () => {
    const all = await places();
    const ids = new Set(all.map((p) => p.place_id));
    const orphans = all.filter(
      (p) =>
        p.place_type !== "country" &&
        (!p.parent_place_id || !ids.has(p.parent_place_id)),
    );
    expect(orphans.map((o) => o.name_en)).toEqual([]);
  });

  it("keeps administrative slugs unique within a parent, which the URL scheme relies on", async () => {
    // Scoped to the administrative hierarchy, because that is what the URL
    // scheme covers. Protected areas are federally administered and sit outside
    // it -- and four of them (Shivapuri, Dhorpatan, Shuklaphanta, Lumbini
    // Sanskritik) share both a name and a parent district with a local unit.
    // They therefore need their own URL namespace, not a slot in
    // /np/<province>/<district>/.
    const ADMIN = new Set(["country", "province", "district", ...LOCAL_TYPES]);
    const all = (await places()).filter((p) => ADMIN.has(p.place_type));
    const seen = new Set<string>();
    const collisions: string[] = [];
    for (const p of all) {
      const key = `${p.parent_place_id ?? "root"}/${p.slug}`;
      if (seen.has(key)) collisions.push(key);
      seen.add(key);
    }
    expect(collisions).toEqual([]);
  });

  it("has protected areas that would collide with local units if they shared a namespace", async () => {
    // Asserting the hazard rather than assuming it away: if a future URL change
    // puts protected areas under the administrative path, this documents why
    // that breaks.
    const all = await places();
    const admin = new Map(
      all
        .filter((p) => LOCAL_TYPES.has(p.place_type))
        .map((p) => [`${p.parent_place_id}/${p.slug}`, p.name_en]),
    );
    const clashing = all
      .filter(
        (p) =>
          p.place_type === "protected_area" &&
          admin.has(`${p.parent_place_id}/${p.slug}`),
      )
      .map((p) => p.name_en);
    expect(clashing.length).toBeGreaterThan(0);
  });

  it("still has local unit names shared across districts", async () => {
    // If this ever reaches zero, flat URLs would become safe. Assert it rather
    // than assume it -- and it is also why the name crosswalk requires
    // uniqueness on both sides before matching.
    const units = (await places()).filter((p) => LOCAL_TYPES.has(p.place_type));
    const counts = new Map<string, number>();
    for (const u of units) counts.set(u.name_en, (counts.get(u.name_en) ?? 0) + 1);
    expect([...counts.values()].filter((n) => n > 1).length).toBeGreaterThan(0);
  });

  it("resolves places by slug within their parent", async () => {
    const bagmati = await placeBySlug("province", "bagmati");
    expect(bagmati).toBeDefined();
    const ktm = await placeBySlug("district", "kathmandu", bagmati!.place_id);
    expect(ktm?.name_en).toBe("Kathmandu");
    expect(ktm?.ocha_pcode).toBe("NP0327");
  });

  it("puts 11 local units in Kathmandu district", async () => {
    const bagmati = await placeBySlug("province", "bagmati");
    const ktm = await placeBySlug("district", "kathmandu", bagmati!.place_id);
    expect(await localUnitsOf(ktm!.place_id)).toHaveLength(11);
  });

  it("excludes protected areas from local units", async () => {
    const all = await places();
    const protectedAreas = all.filter((p) => p.place_type === "protected_area");
    for (const pa of protectedAreas.slice(0, 5)) {
      const siblings = await localUnitsOf(pa.parent_place_id!);
      expect(siblings.map((s) => s.place_id)).not.toContain(pa.place_id);
    }
  });
});

describe("observations — architectural invariants", () => {
  it("resolves every observation to a declared indicator", async () => {
    const [obs, inds] = await Promise.all([observations(), indicators()]);
    const known = new Set(inds.map((i) => i.indicator_id));
    const unknown = [...new Set(obs.map((o) => o.indicator_id))].filter(
      (i) => !known.has(i),
    );
    expect(unknown).toEqual([]);
  });

  it("resolves every observation to a declared unit", async () => {
    const [obs, us] = await Promise.all([observations(), units()]);
    const known = new Set(us.map((u) => u.unit_id));
    const unknown = [...new Set(obs.map((o) => o.unit_id))].filter(
      (u) => !known.has(u),
    );
    expect(unknown).toEqual([]);
  });

  it("resolves every observation to a documented source dataset", async () => {
    const obs = await observations();
    const known = new Set(manifest().sources.map((s) => s.dataset_id));
    const unknown = [...new Set(obs.map((o) => o.dataset_id))].filter(
      (d) => !known.has(d),
    );
    expect(unknown).toEqual([]);
  });

  it("gives every observation a value or a status explaining its absence", async () => {
    const obs = await observations();
    const unexplained = obs.filter(
      (o) =>
        o.value_numeric === null &&
        o.value_text === null &&
        !["suppressed", "not_collected"].includes(o.status),
    );
    expect(unexplained).toHaveLength(0);
  });

  it("has no duplicate observations on the natural key", async () => {
    const obs = await observations();
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const o of obs) {
      const key = [
        o.dataset_id,
        o.indicator_id,
        o.place_id ?? "~",
        o.period_start,
        o.period_end,
        o.dimension_key,
      ].join("|");
      if (seen.has(key)) dupes.push(key);
      seen.add(key);
    }
    expect(dupes).toEqual([]);
  });

  it("marks rates and per-capita indicators non-additive", async () => {
    const inds = await indicators();
    const rates = inds.filter((i) =>
      [
        "cpi_inflation_annual",
        "gdp_per_capita_usd",
        "remittances_percent_gdp",
      ].includes(i.indicator_id),
    );
    expect(rates.length).toBeGreaterThan(0);
    for (const r of rates) {
      expect(r.is_additive, `${r.indicator_id} must not be additive`).toBe(false);
    }
    expect(inds.find((i) => i.indicator_id === "population")!.is_additive).toBe(true);
  });
});

describe("observations — population", () => {
  it("reconciles province and district sums to the national total", async () => {
    const [obs, all] = await Promise.all([observations(), places()]);
    const level = new Map(all.map((p) => [p.place_id, p.place_type]));
    const totals = obs.filter(
      (o) =>
        o.indicator_id === "population" &&
        o.dimension_key === dimensionKey({ sex: "all", age_band: "all" }),
    );
    const sumOf = (type: string) =>
      totals
        .filter((o) => level.get(o.place_id!) === type)
        .reduce((s, o) => s + (o.value_numeric ?? 0), 0);

    const national = totals.find(
      (o) => level.get(o.place_id!) === "country",
    )!.value_numeric!;
    expect(sumOf("province")).toBe(national);
    expect(sumOf("district")).toBe(national);
  });

  it("carries every age band including the open-ended top one", async () => {
    const obs = await observations();
    const bands = new Set(
      obs
        .filter((o) => o.indicator_id === "population")
        .map((o) => o.dimension_key.match(/age_band=([^|]+)/)?.[1])
        .filter(Boolean),
    );
    expect(bands.has("80+")).toBe(true);
    for (const b of AGE_BANDS) expect(bands.has(b)).toBe(true);
  });

  it("summarises a district correctly", async () => {
    const bagmati = await placeBySlug("province", "bagmati");
    const ktm = await placeBySlug("district", "kathmandu", bagmati!.place_id);
    const pop = await populationOf(ktm!);

    expect(pop).not.toBeNull();
    expect(pop!.female + pop!.male).toBe(pop!.total);
    expect(pop!.bands).toHaveLength(AGE_BANDS.length);
    expect(pop!.density).toBeGreaterThan(0);
    // 2023 figures are projections, and the page must say so.
    expect(pop!.status).toBe("projection");
  });

  it("returns null for local units, where the source has no coverage", async () => {
    const local = (await places()).find((p) => LOCAL_TYPES.has(p.place_type))!;
    expect(await populationOf(local)).toBeNull();
  });
});

describe("observations — national time series", () => {
  // This block is the architecture test: a national annual series with no
  // geography below country, no dimensions, and currency units. The previous
  // schema could not express it without meaningless nulls.
  it("exposes World Bank indicators as scalar series on the country", async () => {
    const np = await country();
    const series = await seriesFor(np!);
    const ids = series.map((s) => s.indicator.indicator_id);

    expect(ids).toContain("cpi_inflation_annual");
    expect(ids).toContain("gdp_per_capita_usd");
    expect(ids).toContain("remittances_received_usd");
  });

  it("carries a multi-decade series with no dimensions", async () => {
    const np = await country();
    const series = await seriesFor(np!);
    const cpi = series.find(
      (s) => s.indicator.indicator_id === "cpi_inflation_annual",
    )!;

    expect(cpi.points.length).toBeGreaterThan(50);
    expect(cpi.points[0].year).toBeLessThan(1980);
    // Sorted ascending, so a chart can plot it directly.
    const years = cpi.points.map((p) => p.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it("distinguishes units including currency", async () => {
    const np = await country();
    const series = await seriesFor(np!);
    const byId = new Map(series.map((s) => [s.indicator.indicator_id, s]));

    expect(byId.get("cpi_inflation_annual")!.unit!.unit_kind).toBe("ratio");
    const gdp = byId.get("gdp_per_capita_usd")!;
    expect(gdp.unit!.unit_kind).toBe("currency");
    expect(gdp.unit!.currency_code).toBe("USD");
    // Price basis is part of the unit, so current and constant prices can never
    // be silently compared.
    expect(gdp.unit!.price_basis).toBe("current");
  });

  it("gives no series for a district, which has none", async () => {
    const bagmati = await placeBySlug("province", "bagmati");
    const ktm = await placeBySlug("district", "kathmandu", bagmati!.place_id);
    expect(await seriesFor(ktm!)).toEqual([]);
  });
});

describe("manifest — provenance and licensing", () => {
  it("documents every source with publisher, licence, vintage and retrieval date", () => {
    const { sources } = manifest();
    expect(sources.length).toBeGreaterThanOrEqual(4);
    for (const s of sources) {
      expect(s.publisher, `${s.dataset_id} publisher`).toBeTruthy();
      expect(s.licence, `${s.dataset_id} licence`).toBeTruthy();
      expect(s.vintage, `${s.dataset_id} vintage`).toBeTruthy();
      expect(s.retrieved, `${s.dataset_id} retrieved`).toBeTruthy();
      expect(s.url, `${s.dataset_id} url`).toBeTruthy();
    }
  });

  it("computes each table's effective licence from its sources", () => {
    const obs = manifest().tables.find((t) => t.table === "observations")!;
    expect(obs.sources).toContain("cod-ps-npl");
    expect(obs.sources).toContain("worldbank-npl");
    // Most restrictive of CC BY 4.0 and CC BY-IGO 3.0.
    expect(obs.effective_licence).toBe("cc-by-igo-3.0");
    expect(obs.contributing_licences).toEqual(["cc-by-4.0", "cc-by-igo-3.0"]);
  });

  it("publishes nothing under a share-alike licence", () => {
    // OpenStreetMap was rejected as a name source on exactly these grounds.
    // This is the guard that keeps that decision from being quietly undone.
    const shareAlike = manifest().tables.filter((t) => t.share_alike);
    expect(shareAlike.map((t) => t.table)).toEqual([]);
  });

  it("attributes the publisher, never the acquisition platform", () => {
    const obs = manifest().tables.find((t) => t.table === "observations")!;
    // Full institutional names, resolved through the source registry, because
    // that is what a citation needs.
    expect(obs.attribution).toContain("United Nations Population Fund");
    expect(obs.attribution).toContain("World Bank");
    // HDX is where the copy came from, not who produced it. Crediting the
    // platform would misattribute the work.
    expect(obs.attribution).not.toContain("Humanitarian Data Exchange");
  });

  it("records publisher and acquisition source separately", () => {
    const cod = manifest().sources.find((s) => s.dataset_id === "cod-ps-npl")!;
    expect(cod.publisher).toBe("United Nations Population Fund");
    expect(cod.acquired_from).toBe("Humanitarian Data Exchange");
    expect(cod.acquired_indirectly).toBe(true);
    expect(cod.acquisition_method).toBe("aggregator_download");

    // Where they coincide, the flag says so rather than pretending otherwise.
    const wb = manifest().sources.find((s) => s.dataset_id === "worldbank-npl")!;
    expect(wb.acquired_indirectly).toBe(false);
    expect(wb.acquisition_method).toBe("official_api");
  });

  it("assigns every source a provenance tier", () => {
    for (const s of manifest().sources) {
      expect(["A", "B", "C", "D"], `${s.dataset_id} tier`).toContain(s.source_tier);
    }
  });

  it("has reviewed reuse rights for every published source", () => {
    // "Publicly accessible" is not "commercially reusable". An unreviewed
    // source must not reach published tables.
    for (const s of manifest().sources) {
      expect(s.rights_review_status, `${s.dataset_id}`).not.toBe("not_reviewed");
      expect(s.commercial_reuse, `${s.dataset_id}`).not.toBe("unclear");
    }
  });

  it("publishes revision history", () => {
    const history = manifest().history;
    expect(history).not.toBeNull();
    expect(history!.row_count).toBeGreaterThan(4000);
  });

  it("resolves tables and their sources together", () => {
    const tables = tablesFor(["observations", "places"]);
    expect(tables).toHaveLength(2);
    const ids = sourcesFor(tables).map((s) => s.dataset_id);
    expect(ids).toContain("cod-ab-npl");
    expect(ids).toContain("worldbank-npl");
  });
});

describe("formatting", () => {
  it("formats numbers, percentages and compact values", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(null)).toBe("—");
    expect(formatPercent(0.4903)).toBe("49.0%");
    expect(formatCompact(20000)).toBe("20k");
    expect(formatCompact(2_000_000)).toBe("2M");
  });

  /*
    Every tier, because a missing one does not throw -- it silently prints an
    unreadable number. Remittances rendered as "US$11254.5M" before the billion
    tier existed, and nothing in the build noticed.
  */
  it("scales compact values through billions and trillions", () => {
    expect(formatCompact(30_899_443)).toBe("30.9M");
    expect(formatCompact(11_254_500_000)).toBe("11.3B");
    expect(formatCompact(45_000_000_000)).toBe("45B");
    expect(formatCompact(1_800_000_000_000)).toBe("1.8T");
    expect(formatCompact(-11_254_500_000)).toBe("-11.3B");
  });

  it("keeps the largest published figure inside four significant characters", async () => {
    // Guards the ceiling rather than one hard-coded value: whatever the biggest
    // number we publish happens to be, it must still render compactly.
    const obs = await observations();
    const max = Math.max(
      ...obs.map((o) => Math.abs(o.value_numeric ?? 0)).filter(Number.isFinite),
    );
    expect(formatCompact(max).length).toBeLessThanOrEqual(6);
  });

  it("renders values with their unit", async () => {
    const us = await units();
    const percent = us.find((u) => u.unit_id === "percent")!;
    const usd = us.find((u) => u.unit_id === "usd_current")!;
    expect(formatWithUnit(7.1158, percent)).toBe("7.1%");
    expect(formatWithUnit(1447.6, usd)).toBe("US$1.4k");
  });

  it("stays quiet for actual values and speaks up otherwise", () => {
    expect(statusLabel("actual")).toBeNull();
    expect(statusLabel("projection")).toBe("projection");
    expect(statusLabel("suppressed")).toBe("withheld");
  });

  it("converts shares for percent units without ambiguity", () => {
    // A female share of 0.495 once rendered as "0.5%" on a live topic page,
    // beside a correctly-multiplied "67.5%". Both looked plausible. The percent
    // unit takes 0-100; formatPercent takes 0-1. Route shares through
    // asPercentValue rather than remembering which is which.
    expect(asPercentValue(0.495)).toBeCloseTo(49.5);
    expect(asPercentValue(null)).toBe(0);
    expect(asPercentValue(undefined)).toBe(0);
    // formatPercent keeps the 0-1 convention.
    expect(formatPercent(0.495)).toBe("49.5%");
  });

  it("renders a plausible female share for Nepal", async () => {
    const np = await country();
    const pop = await populationOf(np!);
    const shown = asPercentValue(pop!.femaleShare);
    // Any national sex ratio lands between 45 and 55 percent. A value near 0.5
    // means the conversion was skipped.
    expect(shown).toBeGreaterThan(45);
    expect(shown).toBeLessThan(55);
  });

  it("builds canonical dimension keys with members sorted", () => {
    expect(dimensionKey({ sex: "female", age_band: "0-4" })).toBe(
      "age_band=0-4|sex=female",
    );
    expect(dimensionKey({})).toBe("none");
  });
});

describe("topics — the browse dimension", () => {
  it("gives every indicator a topic", async () => {
    const [inds, ts] = await Promise.all([indicators(), topics()]);
    const known = new Set(ts.map((t) => t.topic_id));
    const orphans = inds.filter((i) => !known.has(i.topic_id));
    expect(orphans.map((i) => i.indicator_id)).toEqual([]);
  });

  it("only marks a topic live when it actually holds observations", async () => {
    const live = await liveTopics();
    expect(live.length).toBeGreaterThan(0);
    for (const t of live) {
      expect(t.observation_count, `${t.topic_id}`).toBeGreaterThan(0);
      expect(t.indicator_count, `${t.topic_id}`).toBeGreaterThan(0);
    }
  });

  it("counts planned topics without pretending they have data", async () => {
    const all = await topics();
    const planned = all.filter((t) => t.status === "planned");
    expect(planned.length).toBeGreaterThan(0);
    for (const t of planned) {
      expect(t.observation_count, `${t.topic_id}`).toBe(0);
    }
  });

  it("derives indicator slugs reversibly", async () => {
    for (const i of await indicators()) {
      const slug = indicatorSlug(i.indicator_id);
      expect(slug).not.toContain("_");
      const back = await indicatorBySlug(slug);
      expect(back?.indicator_id).toBe(i.indicator_id);
    }
  });
});

describe("geographic comparison", () => {
  it("ranks provinces by population and sums to the national total", async () => {
    const cmp = await comparisonFor("population", "province");
    expect(cmp.rows).toHaveLength(7);
    // Descending, so a ranked chart needs no further sorting.
    const values = cmp.rows.map((r) => r.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);

    const np = await country();
    const pop = await populationOf(np!);
    const summed = values.reduce((a, b) => a + b, 0);
    expect(summed).toBe(pop!.total);
  });

  it("returns nothing for an indicator with no subnational breakdown", async () => {
    // National inflation has no province values. Returning an empty result lets
    // the page omit the section rather than render an empty heading.
    const cmp = await comparisonFor("cpi_inflation_annual", "province");
    expect(cmp.rows).toEqual([]);
  });

  it("excludes dimension components so a comparison cannot double count", async () => {
    const cmp = await comparisonFor("population", "district");
    expect(cmp.rows).toHaveLength(77);
    const np = await country();
    const pop = await populationOf(np!);
    expect(cmp.rows.reduce((a, r) => a + r.value, 0)).toBe(pop!.total);
  });
});
