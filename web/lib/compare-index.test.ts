/**
 * Tests for the comparison index.
 *
 * /compare has no server to ask, so the places a reader can pick are a build
 * artefact. That makes the artefact a place where a quiet error can live: the
 * page would render, the bars would be the right length relative to each
 * other, and the figures would be from the wrong year or the wrong dimension
 * with nothing on screen to say so.
 *
 * Read from public/compare-index.json rather than regenerated here, so these
 * assert what actually ships.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { observations, places } from "./data";

type Row = [string, string, string | null, string, string[], (number | null)[]];
type Index = {
  period: string;
  measures: { id: string; additive: boolean }[];
  places: Row[];
};

const FILE = path.join(process.cwd(), "public", "compare-index.json");

const load = (): Index => {
  if (!fs.existsSync(FILE)) {
    throw new Error(
      "public/compare-index.json is missing. It is built by `npm run prebuild`.",
    );
  }
  return JSON.parse(fs.readFileSync(FILE, "utf8")) as Index;
};

describe("compare index", () => {
  it("covers every comparable place and no protected area", () => {
    const index = load();
    const byType = new Map<string, number>();
    for (const r of index.places) byType.set(r[3], (byType.get(r[3]) ?? 0) + 1);

    expect(byType.get("country")).toBe(1);
    expect(byType.get("province")).toBe(7);
    expect(byType.get("district")).toBe(77);
    const locals =
      (byType.get("municipality") ?? 0) +
      (byType.get("rural_municipality") ?? 0) +
      (byType.get("metropolitan") ?? 0) +
      (byType.get("sub_metropolitan") ?? 0);
    expect(locals).toBe(753);
    expect(byType.get("protected_area")).toBeUndefined();
    expect(index.places.length).toBe(838);
  });

  it("carries only measures that exist below the national level", () => {
    // Comparing two districts on a national-only series is four dashes, not a
    // comparison. 5 of 36 indicators go deeper; those 5 are the whole set.
    const index = load();
    expect(index.measures.map((m) => m.id).sort()).toEqual([
      "households",
      "literacy_rate",
      "literate_population",
      "population",
      "population_5plus",
    ]);
  });

  it("uses one reference period for every place", async () => {
    /*
      The failure this exists to catch.

      Nepal is the only place with a 2023 UNFPA projection beside the 2021
      census. A latest-period-first rule gave the country 30.9M while all 837
      places below it carried the 2021 count, so a reader comparing Nepal with
      a district was silently reading across two reference periods -- the
      single hazard this platform is most exposed to, and invisible on screen.
    */
    expect(load().period).toBe("2021");
  });

  it("matches the published census figures, not something close to them", async () => {
    // Recomputed from observations rather than trusted: the index is derived,
    // and a derivation that agrees only with itself is how the 80Plus age band
    // went missing while every internal check passed.
    const index = load();
    const mi = index.measures.findIndex((m) => m.id === "population");
    const value = (p: string) => index.places.find((r) => r[0] === p)?.[5][mi];

    expect(value("nepal")).toBe(29_164_578);

    const all = await places();
    const obs = await observations();
    const kathmandu = all.find(
      (p) => p.name_en === "Kathmandu" && p.place_type === "district",
    )!;
    const fromSource = obs.find(
      (o) =>
        o.place_id === kathmandu.place_id &&
        o.indicator_id === "population" &&
        o.status === "actual" &&
        o.dimension_key.includes("sex=all") &&
        o.value_numeric !== null,
    );
    expect(value("bagmati/kathmandu")).toBe(fromSource?.value_numeric);
  });

  it("addresses places by their hierarchical path, so shared names resolve", () => {
    // 22 local-government names are shared across districts. The path is the
    // identifier for the same reason the URLs are hierarchical.
    const index = load();
    const madis = index.places.filter((r) => r[1] === "Madi");
    expect(madis.length).toBe(4);
    expect(new Set(madis.map((r) => r[0])).size).toBe(4);
    expect(new Set(index.places.map((r) => r[0])).size).toBe(index.places.length);
  });

  it("knows which places contain which, so a reader is not left to add them", () => {
    // Comparing a district with its own province is a fair question and a
    // trap: the larger figure already includes the smaller.
    const index = load();
    const ktm = index.places.find((r) => r[0] === "bagmati/kathmandu")!;
    expect(ktm[4]).toContain("bagmati");
    expect(ktm[4]).toContain("nepal");

    const nepal = index.places.find((r) => r[0] === "nepal")!;
    expect(nepal[4]).toEqual([]);
  });

  it("marks the rate as non-additive so nothing offers to total it", () => {
    const index = load();
    const byId = new Map(index.measures.map((m) => [m.id, m.additive]));
    expect(byId.get("literacy_rate")).toBe(false);
    expect(byId.get("population")).toBe(true);
  });

  it("never stores a zero where a figure is unpublished", () => {
    // A dash and a zero teach opposite lessons. Missing is null, always.
    const index = load();
    for (const r of index.places) {
      for (const v of r[5]) {
        expect(v === null || typeof v === "number").toBe(true);
        if (typeof v === "number") expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
