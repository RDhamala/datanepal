import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  country,
  indicatorBySlug,
  indicatorSlug,
  indicators,
  indicatorsOfTopic,
  populationOf,
  seriesFor,
  sourcesFor,
  statusLabel,
  tablesFor,
  topics,
  units,
} from "@/lib/data";
import { Headline, RankedBars, TrendChart } from "@/components/charts";
import { Crumbs, PageHeader, Section, Sources } from "@/components/ui";

/*
  Indicator page: "what exactly is this statistic, how has it changed, where
  does it differ, and where did it come from?"

  One reusable pattern for every indicator. Hand-building these would guarantee
  drift in the parts that matter most -- the definition, the unit, the
  additivity warning, the provenance.

  Which sections appear is driven by the data, not by the indicator's identity:
  a national-only series gets no geographic comparison, and a single-period
  indicator gets no trend. Rendering an empty "how it varies" heading for
  national inflation would be worse than omitting it.
*/

type Params = { indicator: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await indicators()).map((i) => ({
    indicator: indicatorSlug(i.indicator_id),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { indicator } = await params;
  const i = await indicatorBySlug(indicator);
  if (!i) return {};
  return {
    title: i.name_en,
    description: i.definition ?? `${i.name_en} for Nepal.`,
  };
}

export default async function IndicatorPage({ params }: { params: Promise<Params> }) {
  const { indicator } = await params;
  const ind = await indicatorBySlug(indicator);
  if (!ind) notFound();

  const [us, allTopics, np] = await Promise.all([units(), topics(), country()]);
  const unit = us.find((u) => u.unit_id === ind.default_unit_id);
  const topic = allTopics.find((t) => t.topic_id === ind.topic_id);

  // A national time series, when this indicator has one.
  const nationalSeries = np ? await seriesFor(np) : [];
  const series = nationalSeries.find(
    (s) => s.indicator.indicator_id === ind.indicator_id,
  );

  // Geographic variation, when the indicator is reported subnationally.
  const provinceCmp = await comparisonFor(ind.indicator_id, "province");
  const districtCmp = await comparisonFor(ind.indicator_id, "district");

  // Population is dimensioned, so its national headline comes from the
  // population summary rather than the scalar series path.
  const pop = ind.indicator_id === "population" && np ? await populationOf(np) : null;

  const related = (await indicatorsOfTopic(ind.topic_id)).filter(
    (i) => i.indicator_id !== ind.indicator_id,
  );

  const tables = tablesFor(["observations", "indicators", "units"]);

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/indicators/", label: "Indicators" },
          ...(topic ? [{ href: `/topics/${topic.slug}/`, label: topic.name_en }] : []),
          { label: ind.name_en },
        ]}
      />

      <PageHeader eyebrow="Indicator" title={ind.name_en} native={ind.name_ne} />

      {/* Plain-language definition, before any number. */}
      {ind.definition && (
        <p className="text-ink-soft -mt-4 mb-8 max-w-2xl text-[15px]">
          {ind.definition}
        </p>
      )}

      {/* Latest value, with its period and qualification. */}
      {(series?.latest || pop) && (
        <div className="border-line mb-12 grid grid-cols-1 gap-8 rounded-lg border p-6 sm:grid-cols-3">
          <Headline
            value={pop ? pop.total : series!.latest!.value}
            unit={unit}
            label="Latest value"
            period={String(pop ? pop.period : series!.latest!.year)}
            status={statusLabel(pop ? pop.status : series!.latest!.status)}
          />
          <div>
            <div className="text-label text-ink-faint uppercase">Unit</div>
            <div className="text-ink mt-2 text-[15px]">{unit?.name_en ?? "—"}</div>
            {unit?.currency_code && (
              <div className="text-ink-faint mt-1 text-[12px]">
                {unit.currency_code}
                {unit.price_basis && ` · ${unit.price_basis.replace(/_/g, " ")} prices`}
              </div>
            )}
          </div>
          <div>
            <div className="text-label text-ink-faint uppercase">Aggregation</div>
            <div className="text-ink mt-2 text-[15px]">
              {ind.is_additive ? "Additive across places" : "Not additive"}
            </div>
            <div className="text-ink-faint mt-1 text-[12px]">
              {ind.is_additive
                ? "Values may be summed for a larger area."
                : "Summing or unweighted averaging this across places gives a wrong answer."}
            </div>
          </div>
        </div>
      )}

      {/* Change over time. */}
      {series && series.points.length > 1 && (
        <Section
          title="Change over time"
          note={`${series.points.length} annual observations, ${series.points[0].year}–${series.latest!.year}.`}
        >
          <TrendChart points={series.points} unit={series.unit} label={ind.name_en} />
        </Section>
      )}

      {/* Geographic variation, only where the indicator is reported subnationally. */}
      {provinceCmp.rows.length > 0 && (
        <Section
          title="How it varies by province"
          note={`${provinceCmp.period}. ${
            ind.is_additive
              ? "Provinces sum to the national total."
              : "This is a rate: province values do not sum to the national figure."
          }`}
        >
          <RankedBars
            label={`${ind.name_en} by province, ${provinceCmp.period}`}
            valueLabel={ind.name_en}
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

      {districtCmp.rows.length > 0 && (
        <Section
          title="Largest districts"
          note={`Top 15 of ${districtCmp.rows.length}, ${districtCmp.period}. Complete values in the download.`}
        >
          <RankedBars
            label={`${ind.name_en} by district, ${districtCmp.period}`}
            valueLabel={ind.name_en}
            unit={districtCmp.unit}
            max={districtCmp.rows[0]?.value}
            rows={districtCmp.rows.slice(0, 15).map((r) => ({
              name: r.place.name_en,
              nameNe: r.place.name_ne,
              value: r.value,
            }))}
          />
        </Section>
      )}

      {/* Honest statement when there is no subnational breakdown. */}
      {provinceCmp.rows.length === 0 && (
        <Section title="Geographic coverage">
          <p className="text-ink-soft max-w-2xl text-[14px]">
            This indicator is published for Nepal as a whole. No provincial or district
            breakdown is available from the source.
          </p>
        </Section>
      )}

      {ind.notes && (
        <Section title="Notes on interpretation">
          <p className="text-ink-soft max-w-2xl text-[14px]">{ind.notes}</p>
        </Section>
      )}

      {related.length > 0 && (
        <Section
          title="Related indicators"
          note={topic ? `In ${topic.name_en}.` : undefined}
        >
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {related.map((r) => (
              <li key={r.indicator_id} className="text-[14px]">
                <Link href={`/indicators/${indicatorSlug(r.indicator_id)}/`}>
                  {r.name_en}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Sources tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
