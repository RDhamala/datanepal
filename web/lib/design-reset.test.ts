import { describe, expect, it } from "vitest";
import {
  dhadingProfile,
  geographyScale,
  nationalSnapshot,
  topicCards,
} from "./design-reset";

/*
  The prototype data layer, held to the same rules as production.

  These prototypes exist to be judged on composition, so the one thing that
  must not vary is whether the numbers are real.
*/

const FRAME = { maxWidth: 400, maxHeight: 300 };

describe("design-reset data", () => {
  it("counts the geography the platform actually holds", async () => {
    const s = await geographyScale();
    expect([s.provinces, s.districts, s.localGovernments]).toEqual([7, 77, 753]);
    // Five of 36 go below the national level. The homepages say so in words.
    expect(s.subNationalIndicators).toBe(5);
  });

  it("leads with the census, not the later projection", async () => {
    const pop = (await nationalSnapshot()).find((f) => f.indicatorId === "population");
    // 29,164,578 is the 2021 enumeration. 30.9M is the 2023 UNFPA projection,
    // and a latest-first rule would have put it here.
    expect(pop?.value).toBe(29_164_578);
    expect(pop?.period).toBe("2021");
    expect(pop?.rawStatus).toBe("actual");
  });

  it("gives every snapshot figure a named publisher", async () => {
    for (const f of await nationalSnapshot()) {
      expect(f.source?.publisher, f.indicatorId).toBeTruthy();
    }
  });

  it("offers no national headline where there is no aggregate", async () => {
    const topics = await topicCards();
    // Elections is dimensioned by party: the sum of seats is the size of the
    // house, not a fact about Nepal. Printing a leading party's value here is
    // the bug /indicators/ already shipped once.
    expect(topics.find((t) => t.slug === "elections")?.headline).toBeNull();
    // Empty domains are not offered at all.
    expect(topics.map((t) => t.slug)).not.toContain("tourism");
    expect(topics.every((t) => t.indicatorCount > 0)).toBe(true);
  });

  it("describes Dhading with published values and a real rank", async () => {
    const d = await dhadingProfile(FRAME);
    expect(d).not.toBeNull();
    expect(d!.population?.total).toBe(325_710);
    expect(d!.population?.laterEstimate?.value).toBe(337_869);
    expect(d!.households?.value).toBe(83_642);
    expect(d!.localUnits).toHaveLength(13);

    // Below both parents -- the comparison the page is built around.
    const [self, province, nation] = d!.literacyBenchmarks;
    expect(self.isSelf).toBe(true);
    expect(self.value).toBeLessThan(nation.value);
    expect(nation.value).toBeLessThan(province.value);

    expect(d!.literacyRank).toMatchObject({ rank: 54, of: 77 });
  });

  it("cites only the datasets that back the page", async () => {
    const d = await dhadingProfile(FRAME);
    // Two of the platform's six, not a site-wide inventory.
    expect(d!.sources.map((s) => s.dataset_id).sort()).toEqual([
      "cod-ps-npl",
      "nso-nphc-2021",
    ]);
  });
});
