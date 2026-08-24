import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  compositionFor,
  country,
  formatNumber,
  formatWithUnit,
  indicatorSlug,
  indicatorsOfTopic,
  liveTopics,
  metricMapFor,
  places,
  placeProfile,
  populationOf,
  seriesFor,
  sourcesFor,
  spreadFor,
  statusLabel,
  tablesFor,
  topicBySlug,
  units,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { TrendChart } from "@/components/charts";
import { MetricMap } from "@/components/MetricMap";
import { Composition } from "@/components/viz/Composition";
import { Figure, FigureCell, FigureRow, FigureTable } from "@/components/viz/Figure";
import { PairedBars } from "@/components/viz/MetricStrip";
import { Crumbs, PageHeader, Section, SourceNote } from "@/components/ui";
import { TYPE } from "@/lib/viz";

/*
  Topic overview, built from the visualization grammar rather than per topic.

  The old version was hardcoded for Population: an `isPopulation` flag gated the
  headline, the map and the rankings, so Education -- a live topic with data for
  all 838 places -- rendered as a list of three indicator names. Every future
  topic would have needed the same bespoke branch.

  What varies between topics is not the layout, it is which indicator leads and
  which breakdown is meaningful. So that is configuration and the rest is shared:
  headline, sex split, composition, geographic variation, trend, then the
  indicator table. A topic with no series simply has no trend section, which is
  the same rule place pages follow -- a missing section reads as scope, an empty
  one reads as breakage.
*/

type Params = { topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await liveTopics()).map((t) => ({ topic: t.slug }));
}

/**
 * Per-topic choices, and only the choices.
 *
 * `headline` is stated rather than inferred from indicator order, so ingestion
 * order cannot silently change what a page leads with. `composition` names a
 * dimension that genuinely partitions its indicator -- offering one that does not
 * would produce a 100% bar that renormalises nonsense.
 */
const TOPIC_VIEW: Record<
  string,
  {
    headline: string;
    mapIndicator?: string;
    composition?: { indicator: string; dimension: string; label: string };
    pyramid?: boolean;
  }
> = {
  population: {
    headline: "population",
    mapIndicator: "population",
    pyramid: true,
  },
  health: {
    // Stated explicitly rather than left to the alphabetical fallback --
    // "Immunization, DPT" would otherwise lead only because "I" sorts before
    // "L", not because it's the more recognised headline health statistic.
    headline: "life_expectancy_at_birth",
  },
  agriculture: {
    // The sector's weight in the economy, the same framing Economy itself
    // leads with (inflation), rather than a specific yield or land-share
    // figure that means less without the macro context first.
    headline: "agriculture_value_added_pct_gdp",
  },
  infrastructure: {
    // Electricity access is the indicator the topic's own description leads
    // with, and at 97.9% it is also the most complete-feeling entry point --
    // internet use (46%) or mobile subscriptions would read as a smaller,
    // less finished story to open on.
    headline: "electricity_access_pct",
  },
  education: {
    headline: "literacy_rate",
    mapIndicator: "literacy_rate",
    composition: {
      indicator: "population_5plus",
      dimension: "literacy_status",
      label: "Literacy status of the population aged 5 and over",
    },
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = await topicBySlug(topic);
  if (!t) return {};
  return {
    title: t.name_en,
    description: t.description ?? `${t.name_en} indicators for Nepal.`,
  };
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const { topic } = await params;
  const t = await topicBySlug(topic);
  if (!t || t.status !== "live") notFound();

  const view = TOPIC_VIEW[t.slug];
  const [inds, np, us, allPlaces] = await Promise.all([
    indicatorsOfTopic(t.topic_id),
    country(),
    units(),
    places(),
  ]);
  if (!np) notFound();
  const unitOf = (id: string) => us.find((u) => u.unit_id === id);

  const [profile, pop, series, districtCmp] = await Promise.all([
    placeProfile(np),
    populationOf(np),
    seriesFor(np),
    view?.mapIndicator
      ? comparisonFor(view.mapIndicator, "district")
      : Promise.resolve(null),
  ]);

  const metrics = profile.find((p) => p.topic.topic_id === t.topic_id)?.metrics ?? [];
  const headline =
    metrics.find((m) => m.indicatorId === view?.headline) ?? metrics[0] ?? null;
  const supporting = metrics.filter((m) => m.indicatorId !== headline?.indicatorId);

  const composition = view?.composition
    ? await compositionFor(np, view.composition.indicator, view.composition.dimension)
    : null;

  // District map for the topic's headline geography, and the spread beneath it.
  const districts = allPlaces.filter((p) => p.place_type === "district");
  const [map, spread] = await Promise.all([
    view?.mapIndicator
      ? metricMapFor(districts, [view.mapIndicator], { maxWidth: 1000, maxHeight: 480 })
      : Promise.resolve(null),
    view?.mapIndicator ? spreadFor("district", view.mapIndicator) : Promise.resolve([]),
  ]);

  const topicSeries = series.filter((s) => s.indicator.topic_id === t.topic_id);
  const female = headline?.bySex.find((s) => s.sex === "female")?.value;
  const male = headline?.bySex.find((s) => s.sex === "male")?.value;

  const tables = tablesFor(["observations", "places", "indicators"]);

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/topics/", label: "Topics" },
          { label: t.name_en },
        ]}
      />

      <PageHeader eyebrow="Topic" title={t.name_en} native={t.name_ne} />
      {t.description && (
        <p className="text-ink-soft -mt-4 mb-10 max-w-prose text-[15px] leading-relaxed">
          {t.description}
        </p>
      )}

      {/* Headline plus the sex split, which is the first question a national
          rate invites and the one the old page made a reader hunt for. */}
      {headline && (
        <Section
          title={`Nepal: ${headline.name.toLowerCase()}`}
          note={`${headline.period}${
            headline.periodType === "instant" ? " census" : ""
          }${statusLabel(headline.status) ? ` ${statusLabel(headline.status)}` : ""}.`}
        >
          <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div>
              <p className="text-ink tabular text-[2.6rem] leading-none font-semibold tracking-[-0.04em]">
                {formatWithUnit(headline.value, headline.unit)}
              </p>
              {headline.definition && (
                <p
                  className="text-ink-soft mt-3 max-w-prose leading-relaxed"
                  style={{ fontSize: TYPE.body }}
                >
                  {headline.definition}
                </p>
              )}
              {female !== undefined && male !== undefined && (
                <div className="mt-6">
                  <p className="text-ink-soft mb-2" style={{ fontSize: TYPE.body }}>
                    By sex
                  </p>
                  <PairedBars
                    pairs={[
                      { label: "Female", value: female },
                      { label: "Male", value: male, accent: true },
                    ]}
                    unit={headline.unit}
                  />
                </div>
              )}
            </div>

            {composition && view?.composition && (
              <Figure
                title={view.composition.label}
                subtitle="Categories the census reports, which together account for everyone counted."
                table={
                  <FigureTable
                    columns={[
                      { label: "Category" },
                      { label: "People", numeric: true },
                    ]}
                  >
                    {composition.slices.map((sl) => (
                      <FigureRow key={sl.id}>
                        <FigureCell strong>{sl.label}</FigureCell>
                        <FigureCell numeric>{formatNumber(sl.value)}</FigureCell>
                      </FigureRow>
                    ))}
                  </FigureTable>
                }
              >
                <Composition slices={composition.slices} total={composition.total} />
              </Figure>
            )}
          </div>
        </Section>
      )}

      {/* Geographic variation: the question a national figure hides. */}
      {map && districtCmp && districtCmp.rows.length > 0 && (
        <Section
          title="How it differs across Nepal"
          note={`Every district, ${districtCmp.period}. Select a district to open it.`}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
            <MetricMap
              features={map.features}
              metrics={map.metrics}
              width={map.width}
              height={map.height}
              caption={`${map.features.length} districts.`}
            />
            <div>
              <h3
                className="text-label text-ink-faint mb-3 uppercase"
                style={{ fontSize: TYPE.micro }}
              >
                Highest and lowest
              </h3>
              {/* Extremes rather than all 77: the map carries the pattern and
                  the ranking answers "who is at the ends", which is what a
                  reader actually asks of a list this long. */}
              <table className="w-full" style={{ fontSize: TYPE.body }}>
                <tbody>
                  {[
                    ...districtCmp.rows.slice(0, 5),
                    null,
                    ...districtCmp.rows.slice(-5),
                  ].map((r) =>
                    r === null ? (
                      <tr key="gap">
                        <td colSpan={2} className="text-ink-faint py-1.5 text-center">
                          ⋯
                        </td>
                      </tr>
                    ) : (
                      <tr key={r.place.place_id} className="border-line border-b">
                        <td className="py-1.5">
                          <Link
                            href={`/np/${
                              allPlaces.find(
                                (p) => p.place_id === r.place.parent_place_id,
                              )?.slug ?? ""
                            }/${r.place.slug}/`}
                          >
                            {r.place.name_en}
                          </Link>
                        </td>
                        <td className="text-ink tabular py-1.5 text-right">
                          {formatWithUnit(r.value, districtCmp.unit)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              {spread.length > 4 && (
                <p className="text-ink-faint mt-3" style={{ fontSize: TYPE.small }}>
                  {districtCmp.rows.length} districts, from{" "}
                  {formatWithUnit(
                    districtCmp.rows[districtCmp.rows.length - 1].value,
                    districtCmp.unit,
                  )}{" "}
                  to {formatWithUnit(districtCmp.rows[0].value, districtCmp.unit)}.
                </p>
              )}
            </div>
          </div>
        </Section>
      )}

      {view?.pyramid && pop && pop.bands.length > 0 && (
        <Section
          title="Age and sex structure"
          note={`Five-year age bands, ${pop.bandPeriod ?? pop.period}. Both sides share one scale, so bar lengths are directly comparable.`}
        >
          <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
        </Section>
      )}

      {topicSeries.length > 0 && (
        <Section
          title="Over time"
          note="National series, where the publisher provides one."
        >
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            {topicSeries.map((s) => (
              <Figure
                key={s.indicator.indicator_id}
                title={s.indicator.name_en}
                subtitle={`${s.unit?.name_en} · ${s.points[0].year}–${s.latest?.year}`}
              >
                <TrendChart
                  points={s.points}
                  unit={s.unit}
                  label={s.indicator.name_en}
                />
              </Figure>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Indicators in this topic"
        note={`${inds.length} published. Every one has its own page with a full series and geographic breakdown.`}
      >
        <FigureTable
          columns={[
            { label: "Indicator" },
            { label: "Nepal", numeric: true },
            { label: "Unit" },
          ]}
        >
          {inds.map((i) => {
            const m = metrics.find((x) => x.indicatorId === i.indicator_id);
            return (
              <FigureRow key={i.indicator_id}>
                <FigureCell strong>
                  <Link href={`/indicators/${indicatorSlug(i.indicator_id)}/`}>
                    {i.name_en}
                  </Link>
                  {i.name_ne && (
                    <span className="text-ink-faint ne ml-2">{i.name_ne}</span>
                  )}
                </FigureCell>
                <FigureCell numeric>
                  {m ? formatWithUnit(m.value, m.unit) : "—"}
                </FigureCell>
                <FigureCell>{unitOf(i.default_unit_id)?.name_en}</FigureCell>
              </FigureRow>
            );
          })}
        </FigureTable>

        {supporting.length > 0 && (
          <details className="mt-4">
            <summary
              className="text-ink-faint hover:text-ink-soft cursor-pointer"
              style={{ fontSize: TYPE.small }}
            >
              What these measure
            </summary>
            <dl className="mt-3 max-w-prose space-y-3">
              {inds
                .filter((i) => i.definition)
                .map((i) => (
                  <div key={i.indicator_id}>
                    <dt className="text-ink-soft" style={{ fontSize: TYPE.body }}>
                      {i.name_en}
                    </dt>
                    <dd
                      className="text-ink-faint leading-relaxed"
                      style={{ fontSize: TYPE.small }}
                    >
                      {i.definition}
                    </dd>
                  </div>
                ))}
            </dl>
          </details>
        )}
      </Section>

      <SourceNote tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
