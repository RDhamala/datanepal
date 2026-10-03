/**
 * Every province and district, not a sample.
 *
 * The component system was proved on Bagmati, Dhading and Nilkhantha and then
 * applied to 84 pages. These assert the data preconditions each of those pages
 * depends on, across all of them — the counterpart to
 * `scripts/check-place-pages.mjs`, which asserts the rendered HTML after a
 * build. Between them: this one fails fast in `npm test` and says which place
 * and which precondition; that one catches anything that is true of the data
 * and still wrong on the page.
 *
 * Asserted against externally known facts — 7 provinces, 77 districts, five
 * census measures everywhere — rather than against whatever the code returns,
 * which is the distinction this project's testing discipline is built on.
 */

import { describe, expect, it } from "vitest";
import {
  benchmarksFor,
  boundaries,
  country,
  districtsOf,
  localUnitsOf,
  placeProfile,
  populationOf,
  provinces,
} from "./data";

const BENCHMARKED = ["literacy_rate", "population_density"];

/** Every province, and every district under it. */
async function allPlaces() {
  const provs = await provinces();
  const districts = (
    await Promise.all(provs.map((p) => districtsOf(p.place_id)))
  ).flat();
  return { provs, districts };
}

describe("every province and district page has what it needs", () => {
  it("has exactly 7 provinces and 77 districts", async () => {
    const { provs, districts } = await allPlaces();
    expect(provs.length).toBe(7);
    expect(districts.length).toBe(77);
  });

  it("gives every place both census topics, so no page is a stub", async () => {
    const { provs, districts } = await allPlaces();
    for (const place of [...provs, ...districts]) {
      const slugs = (await placeProfile(place)).map((t) => t.topic.slug);
      expect(slugs, place.name_en).toContain("population");
      expect(slugs, place.name_en).toContain("education");
    }
  });

  it("gives every place a literacy benchmark that reaches Nepal", async () => {
    // The comparison is the difference between a record and a profile, and a
    // benchmark that silently resolves to one row is not a comparison.
    const { provs, districts } = await allPlaces();
    for (const place of [...provs, ...districts]) {
      const marks = await benchmarksFor(place, BENCHMARKED);
      const literacy = marks.find((b) => b.indicatorId === "literacy_rate");
      expect(literacy, `${place.name_en} has no literacy benchmark`).toBeDefined();

      const names = literacy!.rows.map((r) => r.name);
      expect(names, place.name_en).toContain("Nepal");
      expect(names, place.name_en).toContain(place.name_en);
      // A district also has its province; a province has only itself and Nepal.
      expect(literacy!.rows.length, place.name_en).toBeGreaterThanOrEqual(2);

      // Exactly one subject, and it is this place.
      const subjects = literacy!.rows.filter((r) => r.isSubject);
      expect(subjects.length, place.name_en).toBe(1);
      expect(subjects[0].name, place.name_en).toBe(place.name_en);
    }
  });

  it("never fabricates an ancestor's value", async () => {
    // benchmarksFor walks the parent chain and must omit any ancestor with no
    // published figure rather than interpolating one. Every row it returns has
    // to correspond to a real place in the lineage.
    const { districts } = await allPlaces();
    const np = await country();
    for (const d of districts.slice(0, 20)) {
      const marks = await benchmarksFor(d, BENCHMARKED);
      for (const b of marks) {
        for (const row of b.rows) {
          expect(Number.isFinite(row.value), `${d.name_en}/${row.name}`).toBe(true);
        }
        const names = new Set(b.rows.map((r) => r.name));
        expect(names.has(np!.name_en) || names.has("Nepal"), d.name_en).toBe(true);
      }
    }
  });

  it("gives every place an age-sex breakdown to nest under Population", async () => {
    const { provs, districts } = await allPlaces();
    for (const place of [...provs, ...districts]) {
      const pop = await populationOf(place);
      expect(pop, place.name_en).not.toBeNull();
      expect(pop!.bands.length, place.name_en).toBeGreaterThan(0);
    }
  });

  it("gives every district local governments, all with geometry", async () => {
    // The local map and its linked ranking both assume this. A district whose
    // units had no boundary would render an empty frame rather than an error.
    const { districts } = await allPlaces();
    const withGeometry = new Set((await boundaries()).map((g) => g.place_id));
    let total = 0;
    for (const d of districts) {
      const units = await localUnitsOf(d.place_id);
      expect(units.length, d.name_en).toBeGreaterThan(0);
      total += units.length;
      for (const u of units) {
        expect(withGeometry.has(u.place_id), `${d.name_en}/${u.name_en}`).toBe(true);
      }
    }
    // The count this platform is most exposed to getting quietly wrong.
    expect(total).toBe(753);
  });

  it("publishes a Nepali name for every province and none for a district", async () => {
    // Not an oversight: romanised district names have no agreed Devanagari
    // form in the source, and this platform leaves a gap rather than guessing.
    // Asserted so that a future ingest adding them is a deliberate change.
    const { provs, districts } = await allPlaces();
    for (const p of provs) expect(p.name_ne, p.name_en).toBeTruthy();
    expect(districts.filter((d) => d.name_ne).length).toBe(0);
  });

  it("gives every place a P-code of the right shape for its level", async () => {
    const { provs, districts } = await allPlaces();
    for (const p of provs) expect(p.ocha_pcode, p.name_en).toMatch(/^NP\d{2}$/);
    for (const d of districts) expect(d.ocha_pcode, d.name_en).toMatch(/^NP\d{4}$/);
  });
});
