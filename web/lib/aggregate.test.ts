/**
 * Tests for aggregate selection.
 *
 * Split out from data.test.ts because this is the one piece of the data layer
 * that can be wrong while every other test passes: it chooses which row *is*
 * the number, and a wrong choice still renders a plausible figure with a real
 * source and a real period attached to it.
 *
 * That happened. /indicators/ published "3 seats" as Nepal's national
 * first-past-the-post result for an election whose largest party won 125,
 * because every dimension on the site until then carried an `all` member and
 * nothing checked whether the chosen row was actually a total.
 *
 * The unit cases below use synthetic keys on purpose -- they describe the
 * shapes the rule must handle, including ones the warehouse does not hold yet.
 * The integration cases at the bottom read the real published Parquet.
 */

import { describe, expect, it } from "vitest";
import {
  country,
  distributionsFor,
  indicators,
  nationalHeadline,
  observations,
  localUnitBySlug,
  placeBySlug,
  placeProfile,
  populationOf,
  seriesFor,
  units,
} from "./data";
import { isAggregate, pickAggregate, pickMember, specificity } from "./format";

const row = (dimension_key: string, value = 0) => ({ dimension_key, value });

describe("pickAggregate — the row that is the whole", () => {
  it("takes the explicit total when every dimension is '=all'", () => {
    const rows = [
      row("residence_type=all|sex=all", 100),
      row("residence_type=all|sex=male", 49),
      row("residence_type=all|sex=female", 51),
    ];
    expect(pickAggregate(rows)?.value).toBe(100);
  });

  it("takes the undimensioned row", () => {
    expect(pickAggregate([row("none", 7)])?.value).toBe(7);
  });

  it("accepts a specific member when its dimension never varies", () => {
    // How every local government publishes census population: institutional
    // residents are carried at district level, so `household` is the only
    // residence type that exists here and the row is the whole of it.
    const rows = [
      row("residence_type=household|sex=all", 58828),
      row("residence_type=household|sex=male", 27000),
      row("residence_type=household|sex=female", 31828),
    ];
    expect(pickAggregate(rows)?.value).toBe(58828);
  });

  it("returns nothing when the only dimension varies — no total exists", () => {
    // Seats by party. There is no "all parties" row and the sum of seats is
    // the size of the house, not a fact about any party.
    const rows = [
      row("party=party_2501", 3),
      row("party=party_2528", 125),
      row("party=party_2510", 42),
    ];
    expect(pickAggregate(rows)).toBeUndefined();
  });

  it("never returns the largest member as if it were the total", () => {
    const rows = [row("party=a", 3), row("party=b", 125)];
    const picked = pickAggregate(rows);
    expect(picked).toBeUndefined();
    expect(picked?.value).not.toBe(125);
  });

  it("is not fooled by members whose keys are all the same length", () => {
    // The old tie-break sorted on key length, so uniform-length keys fell
    // through to source order and the answer depended on the Parquet's row
    // order. Reversing the input must not change the verdict.
    const rows = [row("party=party_2501", 3), row("party=party_2528", 125)];
    expect(pickAggregate(rows)).toBeUndefined();
    expect(pickAggregate([...rows].reverse())).toBeUndefined();
  });

  it("is deterministic when several totals coexist", () => {
    // A data defect, but it must not render differently between builds.
    const rows = [row("sex=all", 10), row("none", 10), row("age_band=all", 10)];
    const forward = pickAggregate(rows)?.dimension_key;
    const backward = pickAggregate([...rows].reverse())?.dimension_key;
    expect(forward).toBe(backward);
    expect(forward).toBe("none");
  });

  it("prefers the explicit total over a non-varying specific member", () => {
    const rows = [
      row("residence_type=all|sex=all", 100),
      row("residence_type=all|sex=male", 49),
    ];
    expect(pickAggregate(rows)?.dimension_key).toBe("residence_type=all|sex=all");
  });

  it("returns nothing for an empty set rather than throwing", () => {
    expect(pickAggregate([])).toBeUndefined();
  });
});

describe("specificity and isAggregate", () => {
  it("counts only members that are not a total", () => {
    expect(specificity("none")).toBe(0);
    expect(specificity("sex=all|age_band=all")).toBe(0);
    expect(specificity("sex=female|age_band=all")).toBe(1);
    expect(specificity("sex=female|age_band=0-4")).toBe(2);
  });

  it("agrees with specificity about what a total is", () => {
    expect(isAggregate("none")).toBe(true);
    expect(isAggregate("sex=all")).toBe(true);
    expect(isAggregate("party=party_2528")).toBe(false);
  });
});

describe("pickMember — one member, aggregated over the rest", () => {
  it("prefers the row that is specific in no other dimension", () => {
    const rows = [
      row("age_band=0-4|sex=female", 1),
      row("age_band=all|sex=female", 99),
      row("age_band=5-9|sex=female", 2),
    ];
    expect(pickMember(rows, "sex", "female")?.value).toBe(99);
  });

  it("does not depend on source order", () => {
    const rows = [
      row("age_band=0-4|sex=female", 1),
      row("age_band=all|sex=female", 99),
    ];
    expect(pickMember(rows, "sex", "female")?.value).toBe(
      pickMember([...rows].reverse(), "sex", "female")?.value,
    );
  });
});

/* ------------------------------------------------ against the real warehouse */

describe("distributions — indicators with no national total", () => {
  it("finds the election indicators, and only genuine distributions", async () => {
    const np = await country();
    const ds = await distributionsFor(np!.place_id);
    const ids = ds.map((d) => d.indicatorId).sort();

    // Every election indicator is dimensioned by party with no total.
    expect(ids).toContain("hor_fptp_seats_won");
    // Nothing with an ordinary aggregate may be classed as a distribution --
    // that would hide a real national figure behind a "largest of N".
    expect(ids).not.toContain("population");
    expect(ids).not.toContain("literacy_rate");
    for (const d of ds) expect(d.dimensionId).toBe("party");
  });

  it("ranks members descending, so the leader is first", async () => {
    const np = await country();
    const seats = (await distributionsFor(np!.place_id)).find(
      (d) => d.indicatorId === "hor_fptp_seats_won",
    );
    expect(seats).toBeDefined();
    const values = seats!.members.map((m) => m.value);
    expect([...values].sort((a, b) => b - a)).toEqual(values);
    expect(seats!.members.length).toBeGreaterThan(1);
  });

  it("names the leading party from the data, not from a constant", async () => {
    const np = await country();
    const obs = await observations();
    const seats = (await distributionsFor(np!.place_id)).find(
      (d) => d.indicatorId === "hor_fptp_seats_won",
    )!;

    // Independently recompute the maximum from the observations themselves.
    const maxFromSource = Math.max(
      ...obs
        .filter(
          (o) =>
            o.indicator_id === "hor_fptp_seats_won" &&
            o.place_id === np!.place_id &&
            o.value_numeric !== null,
        )
        .map((o) => o.value_numeric!),
    );
    expect(seats.members[0].value).toBe(maxFromSource);
  });
});

describe("national headline — a part is never reported as the whole", () => {
  const ctx = async () => {
    const np = await country();
    const [pop, series, profile, us, distributions] = await Promise.all([
      populationOf(np!),
      seriesFor(np!),
      placeProfile(np!),
      units(),
      distributionsFor(np!.place_id),
    ]);
    return { pop, series, profile, units: us, distributions };
  };

  it("flags the elections headline as a leading member, with its dimension", async () => {
    // This is the indicators-page path, and the homepage topic-card path: both
    // call nationalHeadline with the same context.
    const h = nationalHeadline("hor_fptp_seats_won", await ctx());
    expect(h).not.toBeNull();
    expect(h!.leading).toBeDefined();
    expect(h!.leading!.dimensionId).toBe("party");
    expect(h!.leading!.memberCount).toBeGreaterThan(1);
    // The figure shown is the leader's, not an arbitrary member's.
    const d = (await ctx()).distributions.find(
      (x) => x.indicatorId === "hor_fptp_seats_won",
    )!;
    expect(h!.value).toBe(d.members[0].value);
    expect(h!.leading!.memberName).toBe(d.members[0].name);
  });

  it("is not the smallest party, which is what the old tie-break returned", async () => {
    const c = await ctx();
    const h = nationalHeadline("hor_fptp_seats_won", c)!;
    const d = c.distributions.find((x) => x.indicatorId === "hor_fptp_seats_won")!;
    const smallest = Math.min(...d.members.map((m) => m.value));
    expect(h.value).not.toBe(smallest);
    expect(h.value).toBe(Math.max(...d.members.map((m) => m.value)));
  });

  it("leaves ordinary indicators unflagged and unchanged", async () => {
    const c = await ctx();
    for (const id of ["population", "literacy_rate"]) {
      const h = nationalHeadline(id, c);
      expect(h, id).not.toBeNull();
      expect(h!.leading, id).toBeUndefined();
    }
  });

  it("gives every indicator either a true total or a labelled leader", async () => {
    // The whole indicators index in one assertion: no row may carry a figure
    // that is a component part without saying so.
    const c = await ctx();
    const inds = await indicators();
    const unexplained: string[] = [];
    for (const i of inds) {
      const h = nationalHeadline(i.indicator_id, c);
      if (!h) continue;
      const isDistribution = c.distributions.some(
        (d) => d.indicatorId === i.indicator_id,
      );
      if (isDistribution && !h.leading) unexplained.push(i.indicator_id);
      if (!isDistribution && h.leading) unexplained.push(i.indicator_id);
    }
    expect(unexplained).toEqual([]);
  });
});

describe("every headline surface, audited", () => {
  /*
    The five surfaces that render "what is this indicator now":
    the homepage topic cards, the topics index, the indicators index, the
    indicator detail page, and a place profile. Four of them call
    nationalHeadline and the fifth reads placeProfile. Each was patched
    separately at some point in this project's history, which is exactly why
    the contract is asserted here once rather than trusted five times.
  */
  const ctx = async () => {
    const np = await country();
    const [pop, series, profile, us, distributions] = await Promise.all([
      populationOf(np!),
      seriesFor(np!),
      placeProfile(np!),
      units(),
      distributionsFor(np!.place_id),
    ]);
    return { pop, series, profile, units: us, distributions };
  };

  it("never returns a figure a caller could mistake for a total", async () => {
    const c = await ctx();
    const inds = await indicators();
    for (const i of inds) {
      const h = nationalHeadline(i.indicator_id, c);
      if (!h) continue;
      const noAggregate = c.distributions.some((d) => d.indicatorId === i.indicator_id);
      // The whole contract in one line: a figure without a total must say so.
      expect(noAggregate ? Boolean(h.leading) : !h.leading, i.indicator_id).toBe(true);
    }
  });

  it("is deterministic — two identical calls agree", async () => {
    const [a, b] = await Promise.all([ctx(), ctx()]);
    const inds = await indicators();
    for (const i of inds) {
      const x = nationalHeadline(i.indicator_id, a);
      const y = nationalHeadline(i.indicator_id, b);
      expect(x?.value, i.indicator_id).toBe(y?.value);
      expect(x?.leading?.memberName, i.indicator_id).toBe(y?.leading?.memberName);
    }
  });

  it("gives a distribution-only indicator a leading member on every surface", async () => {
    // Without distributions in the context -- how the indicator detail page
    // called it until this audit -- the surface renders nothing at all. Not a
    // wrong number, but a page that declines to answer its own question.
    const c = await ctx();
    const withOut = { ...c, distributions: [] };
    expect(nationalHeadline("hor_fptp_seats_won", withOut)).toBeNull();
    const withIt = nationalHeadline("hor_fptp_seats_won", c);
    expect(withIt?.leading?.memberCount).toBeGreaterThan(1);
  });

  it("does not let a place page present a category member as a total", async () => {
    // Province, district and local-government pages all build from
    // placeProfile. An indicator with no aggregate must be absent from every
    // one of them, at every level.
    const np = await country();
    const bagmati = await placeBySlug("province", "bagmati");
    const dhading = await placeBySlug("district", "dhading", bagmati!.place_id);
    // localUnitBySlug, not placeBySlug with a guessed type: Nilkhantha is a
    // municipality, and naming the wrong type here would silently return
    // undefined and quietly drop the local level out of this assertion.
    const nilkhantha = await localUnitBySlug(dhading!.place_id, "nilkhantha");
    expect(nilkhantha, "nilkhantha must resolve").toBeDefined();
    const distributionIds = new Set(
      (await distributionsFor(np!.place_id)).map((d) => d.indicatorId),
    );
    expect(distributionIds.size).toBeGreaterThan(0);

    for (const place of [np, bagmati, dhading, nilkhantha].filter(Boolean)) {
      const ids = (await placeProfile(place!))
        .flatMap((t) => t.metrics)
        .map((m) => m.indicatorId);
      for (const id of ids) {
        expect(distributionIds.has(id), `${place!.name_en}/${id}`).toBe(false);
      }
    }
  });
});

describe("place profiles skip indicators that have no total", () => {
  it("does not give Nepal a scalar metric for seats by party", async () => {
    const np = await country();
    const profile = await placeProfile(np!);
    const ids = profile.flatMap((t) => t.metrics).map((m) => m.indicatorId);
    expect(ids).not.toContain("hor_fptp_seats_won");
  });

  it("still gives Nepal its census metrics", async () => {
    const np = await country();
    const profile = await placeProfile(np!);
    const ids = profile.flatMap((t) => t.metrics).map((m) => m.indicatorId);
    expect(ids).toContain("literacy_rate");
  });
});
