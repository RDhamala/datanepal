/**
 * Tests for geographic coverage.
 *
 * Coverage is derived rather than declared, which is the point -- a
 * hand-maintained list of "which indicators go to district level" would be
 * wrong the first time a source deepened and nobody remembered. That makes
 * the derivation worth testing against the real warehouse, and against the
 * externally known shape of the data: 5 of 36 indicators reach below the
 * national level, and all 5 are census measures.
 */

import { describe, expect, it } from "vitest";
import { coverageAtPlace, coverageByIndicator } from "./coverage";
import { indicators, observations, placeBySlug, places } from "./data";

const load = async () => {
  const [obs, allPlaces, inds] = await Promise.all([
    observations(),
    places(),
    indicators(),
  ]);
  return { coverage: coverageByIndicator(obs, allPlaces), inds };
};

describe("coverageByIndicator", () => {
  it("matches the known split: 5 sub-national, 31 national-only", async () => {
    const { coverage, inds } = await load();
    const subNational = inds.filter(
      (i) => (coverage.get(i.indicator_id)?.level ?? "none") !== "national",
    );
    expect(inds.length).toBe(36);
    expect(subNational.length).toBe(5);
    expect(inds.length - subNational.length).toBe(31);
  });

  it("takes the deepest level an indicator reaches, not the first seen", async () => {
    const { coverage } = await load();
    // Population exists at every level, so a rule that stopped at the first
    // observation would report "national" and the map would contradict it.
    expect(coverage.get("population")?.level).toBe("local");
    expect(coverage.get("population")?.label).toBe("To local government");
  });

  it("reports a World Bank series as national with a time series", async () => {
    const { coverage } = await load();
    const inflation = coverage.get("cpi_inflation_annual");
    expect(inflation?.level).toBe("national");
    expect(inflation?.hasTimeSeries).toBe(true);
  });

  it("does not claim a time series for a single census observation", async () => {
    const { coverage } = await load();
    expect(coverage.get("literacy_rate")?.hasTimeSeries).toBe(false);
  });

  it("speaks the reader's vocabulary, not the schema's", async () => {
    const { coverage } = await load();
    for (const c of coverage.values()) {
      expect(c.label).not.toMatch(/admin_level|place_type|_/);
      expect(c.note.endsWith(".")).toBe(true);
    }
  });
});

describe("coverageAtPlace", () => {
  it("distinguishes 'national only' from 'no value here'", async () => {
    const { coverage } = await load();
    const bagmati = await placeBySlug("province", "bagmati");
    const dhading = await placeBySlug("district", "dhading", bagmati!.place_id);

    // Published nationally, not broken down: the reader should be told the
    // data exists rather than left to infer it does not.
    const national = coverageAtPlace(
      coverage.get("life_expectancy_at_birth"),
      dhading!,
      false,
    );
    expect(national.available).toBe(false);
    expect(national.note).toMatch(/Nepal only/);

    // Published at this level and present: no caveat needed.
    const present = coverageAtPlace(coverage.get("population"), dhading!, true);
    expect(present.available).toBe(true);
  });

  it("names the place when the level exists but the value does not", async () => {
    const { coverage } = await load();
    const bagmati = await placeBySlug("province", "bagmati");
    const dhading = await placeBySlug("district", "dhading", bagmati!.place_id);
    const gap = coverageAtPlace(coverage.get("population"), dhading!, false);
    expect(gap.available).toBe(false);
    expect(gap.note).toContain("Dhading");
  });

  it("is honest about an indicator with no observations at all", async () => {
    const bagmati = await placeBySlug("province", "bagmati");
    const dhading = await placeBySlug("district", "dhading", bagmati!.place_id);
    expect(coverageAtPlace(undefined, dhading!, false).available).toBe(false);
  });
});
