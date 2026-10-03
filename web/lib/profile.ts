/**
 * Pure derivations over a place profile.
 *
 * What is left of components/PlaceProfile.tsx, which rendered every indicator
 * as a row of name, definition, value, sex split and provenance. That was the
 * registry form the component system replaced: Nepal, 7 provinces, 77
 * districts and 753 local governments now compose TopicSummary instead, and
 * the renderer had no callers left. Two helpers did, so they live here rather
 * than inside a component file containing no component.
 */

import { statusLabel, type ProfileTopic } from "./data";

/*
  Warn when one section mixes reference periods.

  This is not pedantry. A district shows households from the 2021 census beside
  population from the 2023 projection, both correctly labelled, and a reader who
  divides one by the other gets 4.0 people per household instead of 3.75. Each
  figure is right; the ratio is not. Labelling each row was not enough, because
  the invitation to divide comes from them sitting next to each other.

  So the section says so once, in words, rather than relying on a reader
  noticing two small grey dates.
*/
export function periodNote(
  metrics: { period: number; status: string; periodType: string }[],
): string | null {
  const periods = [...new Set(metrics.map((m) => m.period))].sort();
  if (periods.length < 2) return null;
  const described = periods
    .map((year) => {
      const sample = metrics.find((m) => m.period === year)!;
      const kind =
        sample.periodType === "instant"
          ? "census"
          : (statusLabel(sample.status) ?? "estimate");
      return `${year} ${kind}`;
    })
    .join(" and ");
  return `Figures in this section come from different reference periods — ${described}. Each is correct for its own date; ratios taken across them are not.`;
}

/** Section links for the topics a place actually has. */
export function profileSections(
  profile: ProfileTopic[],
): { id: string; label: string }[] {
  return profile.map((p) => ({ id: p.topic.slug, label: p.topic.name_en }));
}
