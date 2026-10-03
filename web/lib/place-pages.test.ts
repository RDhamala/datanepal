/**
 * Every place page, not a sample.
 *
 * The component system was proved on Bagmati, Dhading and Nilkhantha and then
 * applied to 837 of them. These assert the data preconditions each of those pages
 * depends on, across all of them — the counterpart to
 * `scripts/check-place-pages.mjs`, which asserts the rendered HTML after a
 * build. Between them: this one fails fast in `npm test` and says which place
 * and which precondition; that one catches anything that is true of the data
 * and still wrong on the page.
 *
 * Asserted against externally known facts — 7 provinces, 77 districts, 753
 * local governments, five census measures everywhere — rather than against
 * whatever the code returns, which is the distinction this project's testing
 * discipline is built on.
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

/** Every province, every district, and every local government. */
async function allPlaces() {
  const provs = await provinces();
  const districts = (
    await Promise.all(provs.map((p) => districtsOf(p.place_id)))
  ).flat();
  const locals = (
    await Promise.all(districts.map((d) => localUnitsOf(d.place_id)))
  ).flat();
  return { provs, districts, locals };
}

describe("every place page has what it needs", () => {
  it("has exactly 7 provinces, 77 districts and 753 local governments", async () => {
    const { provs, districts, locals } = await allPlaces();
    expect(provs.length).toBe(7);
    expect(districts.length).toBe(77);
    // 753 rather than 775: type 5 is protected areas, federally administered
    // and not local units. That exclusion is the whole of the difference.
    expect(locals.length).toBe(753);

    const byType = new Map<string, number>();
    for (const l of locals) {
      byType.set(l.place_type, (byType.get(l.place_type) ?? 0) + 1);
    }
    expect(Object.fromEntries(byType)).toEqual({
      municipality: 276,
      rural_municipality: 460,
      metropolitan: 6,
      sub_metropolitan: 11,
    });
    expect(byType.get("protected_area")).toBeUndefined();
  });

  it("gives every place both census topics, so no page is a stub", async () => {
    const { provs, districts, locals } = await allPlaces();
    for (const place of [...provs, ...districts, ...locals]) {
      const slugs = (await placeProfile(place)).map((t) => t.topic.slug);
      expect(slugs, place.name_en).toContain("population");
      expect(slugs, place.name_en).toContain("education");
    }
  });

  it("gives every place a literacy benchmark that reaches Nepal", async () => {
    // The comparison is the difference between a record and a profile, and a
    // benchmark that silently resolves to one row is not a comparison. At
    // local-government level it is the whole point of the page: 58,828 means
    // nothing without the district, the province and the country beside it.
    const { provs, districts, locals } = await allPlaces();
    for (const place of [...provs, ...districts, ...locals]) {
      const marks = await benchmarksFor(place, BENCHMARKED);
      const literacy = marks.find((b) => b.indicatorId === "literacy_rate");
      expect(literacy, `${place.name_en} has no literacy benchmark`).toBeDefined();

      const names = literacy!.rows.map((r) => r.name);
      expect(names, place.name_en).toContain("Nepal");
      expect(names, place.name_en).toContain(place.name_en);
      // Depth of the lineage: a province has itself and Nepal, a district adds
      // its province, a local government adds its district as well.
      const expected =
        place.place_type === "province" ? 2 : place.place_type === "district" ? 3 : 4;
      expect(literacy!.rows.length, place.name_en).toBe(expected);

      // Exactly one subject, and it is this place.
      const subjects = literacy!.rows.filter((r) => r.isSubject);
      expect(subjects.length, place.name_en).toBe(1);
      expect(subjects[0].name, place.name_en).toBe(place.name_en);
    }
  });

  it("never shows two benchmark rows with the same label", async () => {
    /*
      18 local governments share a name with an ancestor. Kathmandu
      Metropolitan City is in Kathmandu District, so its literacy benchmark
      listed "Kathmandu 90.5%" above "Kathmandu 89.2%" and a reader could not
      tell which row was the page they were on. Three of the eighteen collide
      with their province rather than their district -- Koshi rural
      municipality is in Koshi Province.
    */
    const { provs, districts, locals } = await allPlaces();
    const collisions = locals.filter((l) => {
      const d = districts.find((x) => x.place_id === l.parent_place_id);
      const p = provs.find((x) => x.place_id === d?.parent_place_id);
      return l.name_en === d?.name_en || l.name_en === p?.name_en;
    });
    // If this ever drops to zero the assertion below has stopped testing
    // anything, which is the way this kind of check usually dies.
    expect(collisions.length).toBe(18);

    for (const place of [...collisions, ...locals.slice(0, 60)]) {
      for (const b of await benchmarksFor(place, BENCHMARKED)) {
        const labels = b.rows.map((r) => r.name);
        expect(new Set(labels).size, `${place.name_en}: ${labels.join(" / ")}`).toBe(
          labels.length,
        );
        // The subject keeps its bare name; only ancestors are qualified.
        expect(b.rows.find((r) => r.isSubject)!.name).toBe(place.name_en);
      }
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

  it("gives every province and district an age-sex breakdown, and no local one", async () => {
    // UNFPA publishes age detail to district level and no further. A local
    // government page therefore has no pyramid to nest, and asserting one
    // would make 753 correct pages fail -- which is exactly what the first
    // version of the build-time page check did.
    const { provs, districts, locals } = await allPlaces();
    for (const place of [...provs, ...districts]) {
      const pop = await populationOf(place);
      expect(pop, place.name_en).not.toBeNull();
      expect(pop!.bands.length, place.name_en).toBeGreaterThan(0);
    }
    for (const place of locals.slice(0, 40)) {
      const pop = await populationOf(place);
      expect(pop, place.name_en).not.toBeNull();
      expect(pop!.bands.length, place.name_en).toBe(0);
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

  it("publishes a Nepali name where the source has one, and no guess where it does not", async () => {
    // Not an oversight: a romanised name with no agreed Devanagari form in the
    // source is left as a gap rather than transliterated. Every province has
    // one, no district has one, and local governments are split -- which means
    // both rendering paths are exercised across the 753 pages rather than one
    // of them being theoretical.
    const { provs, districts, locals } = await allPlaces();
    for (const p of provs) expect(p.name_ne, p.name_en).toBeTruthy();
    expect(districts.filter((d) => d.name_ne).length).toBe(0);
    expect(locals.filter((l) => l.name_ne).length).toBe(483);
    expect(locals.filter((l) => !l.name_ne).length).toBe(270);
  });

  it("keeps names unique only within a parent, which is why URLs are hierarchical", async () => {
    // 22 local-government names are shared across districts -- four places are
    // called Madi. A flat /places/madi/ route could not address them, and a
    // breadcrumb without both parents cannot tell a reader which one they are
    // looking at.
    const { locals } = await allPlaces();
    const byName = new Map<string, number>();
    for (const l of locals) byName.set(l.name_en, (byName.get(l.name_en) ?? 0) + 1);
    const shared = [...byName.entries()].filter(([, n]) => n > 1);
    expect(shared.length).toBe(22);
    expect(byName.get("Madi")).toBe(4);

    // Unique within a parent, always.
    const withinParent = new Set(locals.map((l) => `${l.parent_place_id}/${l.slug}`));
    expect(withinParent.size).toBe(locals.length);
  });

  it("gives every place a P-code of the right shape for its level", async () => {
    const { provs, districts } = await allPlaces();
    for (const p of provs) expect(p.ocha_pcode, p.name_en).toMatch(/^NP\d{2}$/);
    for (const d of districts) expect(d.ocha_pcode, d.name_en).toMatch(/^NP\d{4}$/);
    const { locals } = await allPlaces();
    for (const l of locals) {
      // NP + province + district + type digit + sequence. The type digit is
      // the authority on what a place is; the Nepali name suffix is not,
      // because the suffixes nest as substrings.
      expect(l.ocha_pcode, l.name_en).toMatch(/^NP\d{7}$/);
      const typeDigit = l.ocha_pcode!.charAt(6);
      expect(["1", "2", "3", "4"], `${l.name_en} ${l.ocha_pcode}`).toContain(typeDigit);
    }
  });
});
