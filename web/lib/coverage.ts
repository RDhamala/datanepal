/**
 * How far down the geography an indicator actually reaches.
 *
 * Of 36 published indicators, 5 carry any sub-national observation and 31 are
 * national only -- all 5 from the 2021 census, all 31 from the World Bank.
 * Nothing in the interface said so. Place pages omit a section with no data,
 * which is right, but it makes the absence silent: a reader on Karnali's page
 * following "Health" reached a page with no Karnali in it and concluded the
 * data does not exist, when it exists nationally and the site simply had no
 * way to say which.
 *
 * So coverage becomes a value the interface can render, derived from the
 * observations rather than declared by hand -- a hand-maintained list would be
 * wrong the first time a source deepened and nobody remembered.
 *
 * The vocabulary is the reader's, not the schema's: "To district", not
 * `admin_level <= 2`.
 */

import type { Observation, Place } from "./data";

export type CoverageLevel = "none" | "national" | "province" | "district" | "local";

export type Coverage = {
  level: CoverageLevel;
  /** Shown as a short badge: "National", "To district". */
  label: string;
  /** One sentence a reader can act on. */
  note: string;
  /** True when more than one period exists, so a trend can be drawn. */
  hasTimeSeries: boolean;
};

const DEPTH: Record<string, CoverageLevel> = {
  country: "national",
  province: "province",
  district: "district",
  municipality: "local",
  rural_municipality: "local",
  metropolitan: "local",
  sub_metropolitan: "local",
};

const RANK: Record<CoverageLevel, number> = {
  none: 0,
  national: 1,
  province: 2,
  district: 3,
  local: 4,
};

const LABEL: Record<CoverageLevel, string> = {
  none: "No data",
  national: "National",
  province: "To province",
  district: "To district",
  local: "To local government",
};

const NOTE: Record<CoverageLevel, string> = {
  none: "No observation is published for this measure.",
  national: "Published for Nepal as a whole. No sub-national breakdown exists yet.",
  province: "Published for Nepal and its 7 provinces.",
  district: "Published for Nepal, its provinces and all 77 districts.",
  local: "Published for every level, down to all 753 local governments.",
};

/**
 * Coverage for every indicator, in one pass.
 *
 * Takes the already-loaded observations and places rather than reading them
 * again: the indicators index, an indicator page and a place page all want
 * this and all three already hold both tables.
 */
export function coverageByIndicator(
  obs: Observation[],
  allPlaces: Place[],
): Map<string, Coverage> {
  const typeOf = new Map(allPlaces.map((p) => [p.place_id, p.place_type]));
  const deepest = new Map<string, CoverageLevel>();
  const periods = new Map<string, Set<string>>();

  for (const o of obs) {
    if (o.value_numeric === null && o.value_text === null) continue;
    const type = o.place_id ? typeOf.get(o.place_id) : undefined;
    const level = type ? (DEPTH[type] ?? "national") : "national";
    const current = deepest.get(o.indicator_id) ?? "none";
    if (RANK[level] > RANK[current]) deepest.set(o.indicator_id, level);

    const seen = periods.get(o.indicator_id) ?? new Set<string>();
    seen.add(o.period_start.slice(0, 4));
    periods.set(o.indicator_id, seen);
  }

  const out = new Map<string, Coverage>();
  for (const [indicatorId, level] of deepest) {
    out.set(indicatorId, {
      level,
      label: LABEL[level],
      note: NOTE[level],
      hasTimeSeries: (periods.get(indicatorId)?.size ?? 0) > 1,
    });
  }
  return out;
}

/**
 * Coverage of one indicator as seen from one place.
 *
 * Different question from the above, and the one a place page needs: an
 * indicator may be published to district level and still have nothing for
 * *this* district. Saying "national only" there would be wrong, and saying
 * nothing at all is what made the gap invisible.
 */
export function coverageAtPlace(
  coverage: Coverage | undefined,
  place: Place,
  hasValueHere: boolean,
): { available: boolean; note: string } {
  if (!coverage || coverage.level === "none") {
    return { available: false, note: "Not published." };
  }
  if (hasValueHere) return { available: true, note: coverage.note };

  const placeLevel = DEPTH[place.place_type] ?? "national";
  if (RANK[coverage.level] < RANK[placeLevel]) {
    return {
      available: false,
      note: `Published for Nepal only — not broken down to ${place.place_type === "district" ? "districts" : "this level"} by the source.`,
    };
  }
  return {
    available: false,
    note: `Published at this level, but no value for ${place.name_en}.`,
  };
}

export const coverageLabel = (level: CoverageLevel): string => LABEL[level];
