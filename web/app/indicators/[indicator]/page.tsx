import type { Metadata } from "next";
import { pluralLower } from "@/lib/words";
import { ExtremesTable } from "@/components/viz/ExtremesTable";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  country,
  formatWithUnit,
  indicatorBySlug,
  indicatorSlug,
  indicators,
  indicatorsOfTopic,
  metricMapFor,
  distributionsFor,
  nationalHeadline,
  places,
  placeProfile,
  populationOf,
  seriesFor,
  sourcesFor,
  tablesFor,
  topics,
  units,
} from "@/lib/data";
import { Headline, RankedBars, TrendChart } from "@/components/charts";
import { MetricMap } from "@/components/MetricMap";
import { DataDisclosure } from "@/components/viz/DataDisclosure";
import { Crumbs, PageHeader, Section, SourceNote } from "@/components/ui";
import { TYPE } from "@/lib/viz";

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

  const [us, allTopics, np, allPlaces] = await Promise.all([
    units(),
    topics(),
    country(),
    places(),
  ]);
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

  // Map, ranking and full table share one district-level breakdown -- the same
  // pattern proven on topic pages, so a reader who has learned one learns
  // nothing new about the furniture of the other.
  const districts = allPlaces.filter((p) => p.place_type === "district");
  const map =
    districtCmp.rows.length > 0
      ? await metricMapFor(districts, [ind.indicator_id], {
          maxWidth: 1000,
          maxHeight: 480,
        })
      : null;

  // Population is dimensioned, so its national headline comes from the
  // population summary rather than the scalar series path -- it also carries
  // the census-vs-projection status logic that a generic profile lookup
  // shouldn't have to re-derive.
  const pop = ind.indicator_id === "population" && np ? await populationOf(np) : null;

  /*
    Every other dimensioned indicator (a rate or count with a sex split, e.g.
    literacy_rate, literate_population) has no scalar national series either,
    which used to mean no headline at all -- the page went straight from the
    definition to "how it varies by province" with no answer to "what is it
    now". `nationalHeadline` is the one function the homepage, topics index,
    and indicators index also call for exactly this, so a fifth surface can't
    quietly reintroduce the gap.
  */
  const profile = !pop && !series?.latest && np ? await placeProfile(np) : [];
  /*
    The fifth surface, and the one that was still silent.

    An indicator with no aggregate -- seats by party -- is skipped by
    placeProfile, correctly, because it has no scalar. Without distributions
    here that meant this page rendered no "Latest value" block at all: not a
    wrong number, but a page that answers "what is this indicator" and then
    declines to say anything about it. The leading member, labelled as one, is
    the honest answer.
  */
  const distributions = np ? await distributionsFor(np.place_id) : [];
  const headline = nationalHeadline(ind.indicator_id, {
    pop,
    series: nationalSeries,
    profile,
    units: us,
    distributions,
  });
  const distribution = distributions.find((d) => d.indicatorId === ind.indicator_id);

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
      {headline && (
        <div className="border-line mb-12 grid grid-cols-1 gap-8 rounded-lg border p-6 sm:grid-cols-3">
          <Headline
            value={headline.value}
            unit={unit}
            label={
              headline.leading
                ? `Largest ${headline.leading.dimensionName.toLowerCase()}`
                : "Latest value"
            }
            period={headline.period}
            status={headline.status}
            note={
              headline.leading
                ? `${headline.leading.memberName} — largest of ${headline.leading.memberCount}. This indicator has no national total.`
                : undefined
            }
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
            noun="provinces"
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

      {map && districtCmp.rows.length > 0 && (
        <Section
          title="How it varies by district"
          note={`Every district, ${districtCmp.period}. Select a district to open it.`}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
            <MetricMap
              features={map.features}
              metrics={map.metrics}
              width={map.width}
              height={map.height}
              noun="districts"
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
                  reader actually asks of a list this long. The full table
                  below is the exact-lookup fallback. */}
              <ExtremesTable
                caption={`${ind.name_en}: the five highest and five lowest districts`}
                rows={districtCmp.rows.map((r) => ({
                  placeId: r.place.place_id,
                  name: r.place.name_en,
                  href: `/np/${
                    allPlaces.find((p) => p.place_id === r.place.parent_place_id)
                      ?.slug ?? ""
                  }/${r.place.slug}/`,
                  value: r.value,
                }))}
                unit={districtCmp.unit}
              />
              <p className="text-ink-faint mt-3" style={{ fontSize: TYPE.small }}>
                {districtCmp.rows.length} districts, from{" "}
                {formatWithUnit(
                  districtCmp.rows[districtCmp.rows.length - 1].value,
                  districtCmp.unit,
                )}{" "}
                to {formatWithUnit(districtCmp.rows[0].value, districtCmp.unit)}.
              </p>
            </div>
          </div>

          {/* The exact-lookup fallback the map and the extremes list can't
              give: every district, not just the ends. */}
          <DataDisclosure count={districtCmp.rows.length} noun="districts">
            <table className="w-full" style={{ fontSize: TYPE.body }}>
              <caption className="sr-only">
                {ind.name_en} for all {districtCmp.rows.length} districts,{" "}
                {districtCmp.period}
              </caption>
              <thead className="bg-surface-raised sticky top-0">
                <tr className="border-line border-b">
                  <th
                    scope="col"
                    className="text-label text-ink-faint px-3 py-2 text-left uppercase"
                  >
                    District
                  </th>
                  <th
                    scope="col"
                    className="text-label text-ink-faint px-3 py-2 text-right uppercase"
                  >
                    {ind.name_en}
                  </th>
                </tr>
              </thead>
              <tbody>
                {districtCmp.rows.map((r) => (
                  <tr
                    key={r.place.place_id}
                    className="border-line border-b last:border-0"
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/np/${
                          allPlaces.find((p) => p.place_id === r.place.parent_place_id)
                            ?.slug ?? ""
                        }/${r.place.slug}/`}
                      >
                        {r.place.name_en}
                      </Link>
                    </td>
                    <td className="text-ink-soft tabular px-3 py-1.5 text-right">
                      {formatWithUnit(r.value, districtCmp.unit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataDisclosure>
        </Section>
      )}

      {/* Honest statement when there is no subnational breakdown. */}
      {/*
        A distribution instead of a map.

        An indicator with no aggregate has no national figure to shade a map
        with, and until now this page offered nothing in its place. The ranked
        members are what the indicator actually is -- and the exact-value
        fallback comes free, because RankedBars composes the shared
        disclosure.
      */}
      {distribution && (
        <Section
          title={`By ${distribution.dimensionName.toLowerCase()}`}
          note={`Every ${distribution.dimensionName.toLowerCase()} with a published value, ${distribution.period}. These are components, not a total: summing them gives the size of the whole contest, which is not a fact about any one of them.`}
        >
          <RankedBars
            label={`${ind.name_en} by ${distribution.dimensionName.toLowerCase()}, ${distribution.period}`}
            rows={distribution.members.map((m) => ({
              name: m.name,
              nameNe: m.nameNe,
              value: m.value,
            }))}
            unit={unit}
            valueLabel={unit?.name_en ?? "Value"}
            // The dimension names its own rows: "Party", not "Name". The table
            // header is read only by someone who cannot see the chart, and the
            // disclosure noun is derived from it so the two cannot disagree.
            noun={pluralLower(distribution.dimensionName)}
            rowLabel={distribution.dimensionName}
          />
        </Section>
      )}

      {provinceCmp.rows.length === 0 && !distribution && (
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

      <SourceNote tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
