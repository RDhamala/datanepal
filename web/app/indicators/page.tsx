import type { Metadata } from "next";
import {
  country,
  distributionsFor,
  formatWithUnit,
  indicatorSlug,
  indicators,
  nationalHeadline,
  observations,
  placeProfile,
  places,
  populationOf,
  seriesFor,
  topics,
  units,
} from "@/lib/data";
import {
  IndicatorIndex,
  type IndicatorRow,
  type TopicOption,
} from "@/components/IndicatorIndex";
import { coverageByIndicator } from "@/lib/coverage";
import { Crumbs, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Indicators",
  description:
    "Every statistic published by DataNepal, with its latest value and source.",
};

/*
  Indicators index: what each statistic currently says, not what it is defined as.

  The old version was a definition list — name, unit, definition text. That is
  reference documentation, and it made the page useless for the actual question
  a visitor arrives with: what is the number, for when, and where is it from.

  So each row now carries the latest national value, its reference period, a
  trend where a series exists, the geographic depth available, and the publisher.
  The definition stays, below, because it still matters — it just is not the
  headline.
*/

/** Attribution per indicator. Publisher, never the acquisition path. */
const PUBLISHER: Record<string, string> = {
  population: "UNFPA",
  cpi_inflation_annual: "World Bank",
  gdp_per_capita_usd: "World Bank",
  remittances_percent_gdp: "World Bank",
  remittances_received_usd: "World Bank",
  population_density: "UNFPA / OCHA",
};

export default async function IndicatorsIndex() {
  const [inds, allTopics, us, np, obs, all] = await Promise.all([
    indicators(),
    topics(),
    units(),
    country(),
    observations(),
    places(),
  ]);
  const unitOf = (id: string) => us.find((u) => u.unit_id === id);
  const series = np ? await seriesFor(np) : [];
  const pop = np ? await populationOf(np) : null;
  const profile = np ? await placeProfile(np) : [];
  // Indicators with no aggregate -- seats by party today, budget by ministry
  // later. Without this the row printed whichever component part sorted
  // first, as a national figure.
  const distributions = np ? await distributionsFor(np.place_id) : [];

  /*
    Coverage comes from lib/coverage now, not from a scan written here.

    This page had its own DEPTH ladder and its own rank() -- a second
    implementation of "how far down does this indicator go", with its own
    vocabulary ("To local unit" against the shared "To local government").
    Two derivations of the same fact drift, and this one was about to become
    a filter rather than a caption, which is a worse thing to be wrong about.
  */
  const byTopic = new Map<string, typeof inds>();
  for (const i of inds) {
    byTopic.set(i.topic_id, [...(byTopic.get(i.topic_id) ?? []), i]);
  }

  const coverage = coverageByIndicator(obs, all);

  const rows: IndicatorRow[] = inds.map((i) => {
    const h = nationalHeadline(i.indicator_id, {
      pop,
      series,
      profile,
      units: us,
      distributions,
    });
    const c = coverage.get(i.indicator_id);
    return {
      id: i.indicator_id,
      slug: indicatorSlug(i.indicator_id),
      name: i.name_en,
      nameNe: i.name_ne,
      definition: i.definition,
      unitName: unitOf(i.default_unit_id)?.name_en ?? null,
      additive: i.is_additive,
      publisher: PUBLISHER[i.indicator_id] ?? null,
      topicId: i.topic_id,
      coverageLabel: c?.label ?? "National",
      coverageLevel: c?.level ?? "national",
      hasTimeSeries: c?.hasTimeSeries ?? false,
      value: h
        ? { text: formatWithUnit(h.value, h.unit), period: h.period, status: h.status }
        : null,
      leading: h?.leading
        ? { memberName: h.leading.memberName, memberCount: h.leading.memberCount }
        : null,
      points: h ? h.points.map((pt) => ({ year: pt.year, value: pt.value })) : [],
      /*
        The years this measure actually covers, so the index can show at a
        glance which series run for decades and which are a single census.
        Null where there is one period or none -- a span of one year drawn as
        a bar reads as a short trend rather than as a snapshot.
      */
      span:
        h && h.points.length >= 2
          ? { from: h.points[0].year, to: h.points[h.points.length - 1].year }
          : null,
    };
  });

  const topicOptions: TopicOption[] = allTopics
    .filter((t) => byTopic.has(t.topic_id))
    .map((t) => ({
      id: t.topic_id,
      slug: t.slug,
      name: t.name_en,
      nameNe: t.name_ne,
    }));

  const subNational = rows.filter((r) => r.coverageLevel !== "national").length;

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Indicators" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Indicators"
        native="सूचकहरू"
        meta={`${inds.length} indicators across ${topicOptions.length} topics, ${subNational} of them published below the national level. Values shown are national, latest available period.`}
      />

      {/*
        No Suspense boundary. It was here for useSearchParams, and in a static
        export that combination writes the fallback to the HTML file rather
        than the list -- which shipped an Indicators page with no indicators
        in it for crawlers and for anyone with JavaScript off. The component
        reads the address after mount instead.
      */}
      <IndicatorIndex rows={rows} topics={topicOptions} />
    </>
  );
}
