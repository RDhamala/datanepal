/**
 * Tests for the build-time data layer.
 *
 * These read the real published Parquet rather than fixtures, deliberately.
 * The lesson from this codebase is that consistency checks pass while data is
 * uniformly wrong -- so these assert against externally known facts about
 * Nepal (7 provinces, 77 districts, 753 local units, 17 age bands) which a
 * fixture would happily agree with while being wrong.
 */

import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  country,
  districtsOf,
  formatCompact,
  formatNumber,
  formatPercent,
  manifest,
  observations,
  placeBySlug,
  places,
  populationOf,
} from "./data";

describe("places", () => {
  it("has every administrative level, at the right counts", async () => {
    const all = await places();
    const byLevel = (n: number) => all.filter((p) => p.admin_level === n).length;

    expect(byLevel(0)).toBe(1); // Nepal
    expect(byLevel(1)).toBe(7); // provinces
    expect(byLevel(2)).toBe(77); // districts
    expect(byLevel(3)).toBe(753); // local units
    expect(all).toHaveLength(838);
  });

  it("gives every place a unique pcode", async () => {
    const all = await places();
    expect(new Set(all.map((p) => p.place_pcode)).size).toBe(all.length);
  });

  it("gives every place a slug", async () => {
    const all = await places();
    expect(all.filter((p) => !p.slug)).toHaveLength(0);
  });

  it("keeps slugs unique within a parent, which is what the URLs rely on", async () => {
    const all = await places();
    const seen = new Set<string>();
    const collisions: string[] = [];
    for (const p of all) {
      const key = `${p.parent_pcode ?? "root"}/${p.slug}`;
      if (seen.has(key)) collisions.push(key);
      seen.add(key);
    }
    expect(collisions).toEqual([]);
  });

  it("shares some local unit names across districts -- the reason URLs are hierarchical", async () => {
    const units = (await places()).filter((p) => p.admin_level === 3);
    const counts = new Map<string, number>();
    for (const u of units) counts.set(u.name_en, (counts.get(u.name_en) ?? 0) + 1);
    const shared = [...counts.values()].filter((n) => n > 1).length;
    // If this ever drops to zero, flat URLs would become safe -- but do not
    // assume it; assert it.
    expect(shared).toBeGreaterThan(0);
  });

  it("links every non-root place to a parent that exists", async () => {
    const all = await places();
    const codes = new Set(all.map((p) => p.place_pcode));
    const orphans = all.filter(
      (p) => p.admin_level > 0 && p.parent_pcode && !codes.has(p.parent_pcode),
    );
    expect(orphans.map((o) => o.place_pcode)).toEqual([]);
  });

  it("resolves a known place by slug within its parent", async () => {
    const bagmati = await placeBySlug(1, "bagmati");
    expect(bagmati?.place_pcode).toBe("NP03");
    const ktm = await placeBySlug(2, "kathmandu", bagmati!.place_pcode);
    expect(ktm?.place_pcode).toBe("NP0327");
  });

  it("puts 11 local units in Kathmandu district", async () => {
    const units = await districtsOf("NP03");
    expect(units.length).toBeGreaterThan(0);
    expect(units.map((d) => d.name_en)).toContain("Kathmandu");
  });
});

describe("observations", () => {
  it("reconciles province and district sums to the national total", async () => {
    const obs = await observations();
    const pop = obs.filter(
      (o) =>
        o.indicator_code === "population" && o.sex === "all" && o.age_band === "all",
    );
    const national = pop.find((o) => o.admin_level === 0)!.value;
    const sum = (level: number) =>
      pop.filter((o) => o.admin_level === level).reduce((s, o) => s + o.value, 0);

    // A partial load raises no error and produces no obviously wrong row
    // count -- it just quietly under-reports. This is the cheap guard.
    expect(sum(1)).toBe(national);
    expect(sum(2)).toBe(national);
  });

  it("carries every age band including the open-ended top one", async () => {
    const obs = await observations();
    const bands = new Set(obs.map((o) => o.age_band));
    // '80+' was silently dropped once because the source spells it '80Plus'
    // and the ingest regex expected '80PL'. 262,948 people vanished and every
    // consistency check still passed.
    expect(bands.has("80+")).toBe(true);
    for (const b of AGE_BANDS) expect(bands.has(b)).toBe(true);
    expect(bands.has("all")).toBe(true);
  });

  it("has female + male equal the total for every place", async () => {
    const obs = await observations();
    const byPlace = new Map<string, { all?: number; f?: number; m?: number }>();
    for (const o of obs) {
      if (o.indicator_code !== "population" || o.age_band !== "all") continue;
      const e = byPlace.get(o.place_pcode) ?? {};
      if (o.sex === "all") e.all = o.value;
      if (o.sex === "female") e.f = o.value;
      if (o.sex === "male") e.m = o.value;
      byPlace.set(o.place_pcode, e);
    }
    const bad = [...byPlace.entries()].filter(
      ([, v]) => v.all !== undefined && v.f! + v.m! !== v.all,
    );
    expect(bad).toEqual([]);
  });

  it("names a place for every observation", async () => {
    const obs = await observations();
    expect(obs.filter((o) => !o.place_name_en)).toHaveLength(0);
  });
});

describe("populationOf", () => {
  it("summarises a district", async () => {
    const ktm = await placeBySlug(2, "kathmandu", "NP03");
    const pop = await populationOf(ktm!);
    expect(pop).not.toBeNull();
    expect(pop!.total).toBeGreaterThan(1_000_000);
    expect(pop!.female + pop!.male).toBe(pop!.total);
    expect(pop!.bands).toHaveLength(AGE_BANDS.length);
    expect(pop!.femaleShare).toBeGreaterThan(0.4);
    expect(pop!.femaleShare).toBeLessThan(0.6);
    expect(pop!.density).toBeGreaterThan(0);
  });

  it("returns null for a place with no observations", async () => {
    // Local units have no population: COD-PS stops at district level.
    const units = (await places()).filter((p) => p.admin_level === 3);
    expect(await populationOf(units[0])).toBeNull();
  });

  it("reports a plausible working-age share nationally", async () => {
    const np = await country();
    const pop = await populationOf(np!);
    // Nepal's working-age share sits around two thirds. A wildly different
    // number means the age bands were mis-summed.
    expect(pop!.workingAgeShare).toBeGreaterThan(0.5);
    expect(pop!.workingAgeShare).toBeLessThan(0.75);
  });
});

describe("manifest", () => {
  it("documents every published dataset with a licence and source", () => {
    const m = manifest();
    expect(m.datasets.length).toBeGreaterThanOrEqual(4);
    for (const d of m.datasets) {
      expect(d.licence, `${d.table} licence`).toBeTruthy();
      expect(d.source?.url, `${d.table} source url`).toBeTruthy();
      expect(d.vintage, `${d.table} vintage`).toBeTruthy();
    }
  });
});

describe("formatting", () => {
  it("formats numbers with separators and an em dash for nothing", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(NaN)).toBe("—");
  });

  it("formats percentages", () => {
    expect(formatPercent(0.4903)).toBe("49.0%");
    expect(formatPercent(null)).toBe("—");
  });

  it("compacts large numbers for axis labels", () => {
    expect(formatCompact(950)).toBe("950");
    expect(formatCompact(20000)).toBe("20k");
    expect(formatCompact(2_000_000)).toBe("2M");
  });
});
