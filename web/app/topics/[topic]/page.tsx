import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  asPercentValue,
  comparisonFor,
  country,
  indicatorSlug,
  indicatorsOfTopic,
  liveTopics,
  populationOf,
  seriesFor,
  sourcesFor,
  statusLabel,
  tablesFor,
  topicBySlug,
  units,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { Headline, RankedBars, TrendChart } from "@/components/charts";
import { Crumbs, PageHeader, Section, Sources } from "@/components/ui";

/*
  Topic page: "what should I know about this subject across Nepal?"

  Distinct from an indicator page, which goes deep on one statistic, and from a
  place page, which goes wide across topics for one location. A topic page is
  wide across a subject, national in scope, with routes down to both.

  Built as one reusable pattern rather than a bespoke page per topic. Sections
  render only when the underlying data exists -- a topic showing an empty
  "geographic comparison" heading reads as broken, not as forthcoming.
*/

type Params = { topic: string };

export async function generateStaticParams(): Promise<Params[]> {
  // Only live topics get pages. A planned topic with no data would render an
  // empty shell that looks like a bug.
  return (await liveTopics()).map((t) => ({ topic: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = await topicBySlug(topic);
  if (!t) return {};
  return { title: t.name_en, description: t.description ?? undefined };
}

export default async function TopicPage({ params }: { params: Promise<Params> }) {
  const { topic } = await params;
  const t = await topicBySlug(topic);
  if (!t || t.status !== "live") notFound();

  const [inds, np, us] = await Promise.all([
    indicatorsOfTopic(t.topic_id),
    country(),
    units(),
  ]);
  const unitOf = (id: string) => us.find((u) => u.unit_id === id);

  const pop = np ? await populationOf(np) : null;
  const series = np ? await seriesFor(np) : [];
  const topicSeries = series.filter((s) => s.indicator.topic_id === t.topic_id);

  const isPopulation = t.topic_id === "population";
  const provinceCmp = isPopulation
    ? await comparisonFor("population", "province")
    : null;
  const districtCmp = isPopulation
    ? await comparisonFor("population", "district")
    : null;

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
        <p className="text-ink-soft -mt-4 mb-10 max-w-2xl text-[15px]">
          {t.description}
        </p>
      )}

      {/* Headline: the one figure a reader wants first. */}
      {isPopulation && pop && (
        <Section title="Nepal's population">
          <div className="border-line grid grid-cols-1 gap-8 rounded-lg border p-6 sm:grid-cols-3">
            <Headline
              value={pop.total}
              label="Total population"
              period={String(pop.period)}
              status={statusLabel(pop.status)}
              unit={unitOf("persons")}
            />
            <Headline
              value={asPercentValue(pop.femaleShare)}
              unit={unitOf("percent")}
              label="Female share"
              period={String(pop.period)}
              note="Of total population"
            />
            <Headline
              value={asPercentValue(pop.workingAgeShare)}
              unit={unitOf("percent")}
              label="Working age"
              period={String(pop.period)}
              note="Aged 15–64"
            />
          </div>
        </Section>
      )}

      {/* National trends for this topic's indicators. */}
      {topicSeries.length > 0 && (
        <Section
          title="National trends"
          note="Annual series. Follow an indicator for its full history and methodology."
        >
          <div className="grid gap-10 lg:grid-cols-2">
            {topicSeries.map((s) => (
              <div key={s.indicator.indicator_id}>
                <h3 className="text-ink mb-1 text-[14px] font-medium">
                  <Link
                    href={`/indicators/${indicatorSlug(s.indicator.indicator_id)}/`}
                  >
                    {s.indicator.name_en}
                  </Link>
                </h3>
                <p className="text-ink-faint mb-3 text-[12px]">
                  {s.unit?.name_en}, {s.points[0].year}–{s.latest!.year}
                </p>
                <TrendChart
                  points={s.points}
                  unit={s.unit}
                  label={s.indicator.name_en}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Age structure: a pyramid is the right form and a table is not. */}
      {isPopulation && pop && pop.bands.length > 0 && (
        <Section
          title="Age and sex structure"
          note={`Five-year age bands, ${pop.period}. Both sides share one scale, so bar lengths are directly comparable.`}
        >
          <AgePyramid bands={pop.bands} period={pop.period} />
        </Section>
      )}

      {/* Geographic comparison: where does this differ? */}
      {provinceCmp && provinceCmp.rows.length > 0 && (
        <Section
          title="By province"
          note={`Population by province, ${provinceCmp.period}.`}
        >
          <RankedBars
            label={`Population by province, ${provinceCmp.period}`}
            valueLabel="Population"
            unit={provinceCmp.unit}
            rows={provinceCmp.rows.map((r) => ({
              name: r.place.name_en,
              nameNe: r.place.name_ne,
              href: `/np/${r.place.slug}/`,
              value: r.value,
            }))}
          />
        </Section>
      )}

      {districtCmp && districtCmp.rows.length > 0 && (
        <Section
          title="Largest districts"
          note={`The ten most populous of ${districtCmp.rows.length} districts, ${districtCmp.period}. Full values in the table.`}
        >
          <RankedBars
            label={`Districts by population, ${districtCmp.period}`}
            valueLabel="Population"
            unit={districtCmp.unit}
            max={districtCmp.rows[0]?.value}
            rows={districtCmp.rows.slice(0, 10).map((r) => ({
              name: r.place.name_en,
              nameNe: r.place.name_ne,
              value: r.value,
            }))}
          />
          <p className="text-ink-faint mt-3 text-[12px]">
            Showing 10 of {districtCmp.rows.length}.{" "}
            <a href="/data/observations.parquet" download>
              Download all values
            </a>
            .
          </p>
        </Section>
      )}

      {/* Indicators in this topic: the route to statistical depth. */}
      <Section title="Indicators" note={`${inds.length} in this topic.`}>
        <ul className="divide-line border-line divide-y rounded-lg border">
          {inds.map((i) => (
            <li key={i.indicator_id} className="px-4 py-3">
              <Link
                href={`/indicators/${indicatorSlug(i.indicator_id)}/`}
                className="text-[14px] font-medium"
              >
                {i.name_en}
              </Link>
              {i.name_ne && (
                <span className="text-ink-faint text-[13px]"> · {i.name_ne}</span>
              )}
              {i.definition && (
                <p className="text-ink-soft mt-1 max-w-2xl text-[13px]">
                  {i.definition}
                </p>
              )}
              <p className="text-ink-faint mt-1 text-[12px]">
                {unitOf(i.default_unit_id)?.name_en}
                {!i.is_additive && " · not additive across places"}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Sources tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
