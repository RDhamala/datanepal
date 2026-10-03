import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  compareFor,
  country,
  distributionsFor,
  districtsOf,
  formatNumber,
  indicatorSlug,
  indicators,
  localUnitsOf,
  mapFor,
  observations,
  placeProfile,
  places,
  populationOf,
  provinces,
  sourcesFor,
  tablesFor,
  units as allUnitsFn,
} from "@/lib/data";
import { coverageByIndicator } from "@/lib/coverage";
import { AgePyramid } from "@/components/AgePyramid";
import { Choropleth } from "@/components/Choropleth";
import { RankedBars } from "@/components/charts";
import { profileSections } from "@/lib/profile";
import { ComparePanel } from "@/components/viz/ComparePanel";
import { HeadlineMetricGroup } from "@/components/viz/HeadlineMetric";
import { TopicSummary } from "@/components/viz/TopicSummary";
import {
  AnchoredSection,
  Crumbs,
  PageHeader,
  Pcode,
  SectionNav,
  SourceNote,
} from "@/components/ui";

/*
  Nepal's own place page: the top of the hierarchy, and the last level to get
  one.

  It did not exist. Provinces, districts and all 753 local governments had
  profiles and the country they belong to did not, because the homepage looks
  like it fills that role and does not: a landing page answers "what is this
  site", a place page answers "what should I know about this place". The
  breadcrumb on every place page has pointed at "Nepal" since the beginning
  and meant the site root.

  Two things make this level different from every other, and both are
  properties of the data rather than of the design.

  It is the only place with all 36 indicators. Every other page has the five
  census measures, so ten topic sections appear here and two appear below.

  It has no benchmark, and must not pretend otherwise. benchmarksFor walks the
  parent chain and Nepal has no parent, so it returns nothing and no
  comparison is drawn -- which is correct. The comparison a national figure
  invites is against other countries, and this platform does not hold them.
*/

export const metadata: Metadata = {
  title: "Nepal",
  description:
    "Nepal in data: population, education, economy, government, health and more, " +
    "with the provinces, districts and local governments beneath.",
};

/*
  Which indicator leads each topic.

  The same map the topics index uses. Derived from row order it would change
  whenever ingestion order did, which is not a thing a page's emphasis should
  be able to do by accident.
*/
const TOPIC_HEADLINE: Record<string, string> = {
  population: "population",
  economy: "cpi_inflation_annual",
  education: "literacy_rate",
  health: "life_expectancy_at_birth",
  agriculture: "agriculture_value_added_pct_gdp",
  infrastructure: "electricity_access_pct",
  environment: "protected_areas_pct",
  labour: "unemployment_rate",
  government: "government_revenue_pct_gdp",
};

/** Indicators the fact strip already carries, so a summary should not repeat. */
const STRIP_INDICATORS = new Set(["population", "households", "literacy_rate"]);

export default async function NepalPage() {
  const np = await country();
  if (!np) notFound();

  const [
    pop,
    profile,
    provs,
    provinceMap,
    provinceCmp,
    distributions,
    obsAll,
    placesAll,
    indsAll,
    us,
  ] = await Promise.all([
    populationOf(np),
    placeProfile(np),
    provinces(),
    mapFor("population", "province"),
    comparisonFor("population", "province"),
    distributionsFor(np.place_id),
    observations(),
    places(),
    indicators(),
    allUnitsFn(),
  ]);

  const districts = (
    await Promise.all(provs.map((p) => districtsOf(p.place_id)))
  ).flat();
  const localUnits = (
    await Promise.all(districts.map((d) => localUnitsOf(d.place_id)))
  ).flat();

  const compare = await compareFor(provs, [
    "population",
    "households",
    "literacy_rate",
    "literate_population",
    "population_5plus",
  ]);

  const metricOf = (id: string) =>
    profile.flatMap((t) => t.metrics).find((m) => m.indicatorId === id);
  const households = metricOf("households");
  const literacy = metricOf("literacy_rate");

  /*
    Coverage, inverted.

    Below this level the useful statement is "these measures are national
    only". Here it is the other way round: a reader on Nepal's page wants to
    know which of the 36 go deeper, because that is what decides whether their
    district has an answer.
  */
  const coverage = coverageByIndicator(obsAll, placesAll);
  const subNational = indsAll.filter(
    (i) => (coverage.get(i.indicator_id)?.level ?? "national") !== "national",
  );

  /*
    Elections has data and no scalar.

    All three of its indicators are dimensioned by party with no total, so
    placeProfile skips them and the topic would simply not appear -- on the one
    page in the country where the election happened. That is the silent
    absence this project keeps having to fix, so the topic gets the
    distribution treatment instead: the members, ranked, with the sum stated
    for what it is.
  */
  const seats = distributions.find((d) => d.indicatorId === "hor_fptp_seats_won");
  const seatUnit = us.find((u) => u.unit_id === "count");

  const sections = [
    ...profileSections(profile),
    ...(seats ? [{ id: "elections", label: "Elections" }] : []),
    ...(provinceCmp.rows.length ? [{ id: "provinces", label: "Provinces" }] : []),
    ...(compare ? [{ id: "compare", label: "Compare" }] : []),
    { id: "sources", label: "Sources" },
  ];

  const tables = tablesFor(["observations", "places", "geography"]);

  return (
    <>
      {/*
        The first crumb is the site root and is labelled Nepal, so this page's
        own crumb repeats it. That reads oddly and the alternatives read worse:
        renaming the root crumb on one page is an inconsistency, and dropping
        the current crumb loses the only indication of where you are.
      */}
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/places/", label: "Places" },
          { label: "Nepal" },
        ]}
      />

      <PageHeader
        eyebrow="Country"
        title="Nepal"
        native={np.name_ne}
        meta={
          <>
            A federal democratic republic of {provs.length} provinces,{" "}
            {districts.length} districts and {localUnits.length} local governments.{" "}
            {np.ocha_pcode && <Pcode code={np.ocha_pcode} />}
          </>
        }
      />

      {/*
        Area and density are absent here, deliberately: the spine does not
        carry an area for the country, and summing 77 district areas would be
        a computed figure presented beside source ones. The counts in the
        sentence above are the geographic facts this page can state.
      */}
      <HeadlineMetricGroup
        columns={4}
        topRule={false}
        metrics={[
          {
            label: "Population",
            value: pop ? formatNumber(pop.total) : null,
            period: pop?.period,
            status: pop?.status === "actual" ? "census" : "projection",
            secondary: pop?.laterEstimate
              ? {
                  label: "Later projection",
                  value: formatNumber(pop.laterEstimate.value),
                  period: pop.laterEstimate.period,
                  status: "projection" as const,
                }
              : null,
            missingNote: "No census population published.",
          },
          {
            label: "Households",
            value: households ? formatNumber(households.value) : null,
            period: households?.period,
            status: "census",
          },
          {
            label: "Literacy rate",
            value: literacy ? `${literacy.value.toFixed(1)}%` : null,
            period: literacy?.period,
            status: "census",
            context: "Population aged 5 and over.",
          },
          {
            label: "Local governments",
            value: formatNumber(localUnits.length),
            context: `Across ${districts.length} districts and ${provs.length} provinces.`,
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/*
        Ten topic sections, where a province or district has two. No benchmark
        is passed and none exists: Nepal has no parent to be measured against,
        and TopicSummary renders the headline and its breakdown without one.
      */}
      {profile.map((t) => (
        <AnchoredSection
          key={t.topic.topic_id}
          id={t.topic.slug}
          title={t.topic.name_en}
          note={
            <Link href={`/topics/${t.topic.slug}/`}>
              All {t.topic.name_en} indicators →
            </Link>
          }
        >
          <TopicSummary
            topic={t}
            headlineId={TOPIC_HEADLINE[t.topic.slug] ?? t.metrics[0]?.indicatorId ?? ""}
            placeName="Nepal"
            valueShownAbove={STRIP_INDICATORS.has(
              TOPIC_HEADLINE[t.topic.slug] ?? t.metrics[0]?.indicatorId ?? "",
            )}
          />

          {t.topic.slug === "population" && pop && pop.bands.length > 0 && (
            <div className="border-line mt-9 border-t pt-7">
              <h3 className="text-ink mb-1 text-[15px] font-medium">
                Age and sex structure
              </h3>
              <p className="text-ink-faint mb-5 max-w-prose text-[13px] leading-relaxed">
                Five-year bands from the UNFPA {pop.bandPeriod ?? pop.period} projection
                — a different reference period from the census count above. Both sides
                share one scale.
              </p>
              <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
            </div>
          )}
        </AnchoredSection>
      ))}

      {seats && (
        <AnchoredSection
          id="elections"
          title="Elections"
          note={<Link href="/topics/elections/">All Elections indicators →</Link>}
        >
          <p className="text-ink-soft mb-6 max-w-prose text-[14px] leading-relaxed">
            Seats won by each party in the {seats.period} House of Representatives
            election, first-past-the-post. These are components, not a total — summing
            them gives the size of the house, which is not a fact about any party, so
            this topic has no headline figure.
          </p>
          <RankedBars
            label={`House of Representatives seats won by party, ${seats.period}`}
            rows={seats.members.map((m) => ({
              name: m.name,
              nameNe: m.nameNe,
              value: m.value,
            }))}
            unit={seatUnit}
            valueLabel="Seats"
            noun="parties"
          />
        </AnchoredSection>
      )}

      {provinceCmp.rows.length > 0 && (
        <AnchoredSection
          id="provinces"
          title="Provinces by population"
          note={`${provinceCmp.rows.length} provinces, ${provinceCmp.period}. The map answers where; the ranking answers how much.`}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-12">
            {provinceMap.features.length > 0 && (
              <Choropleth
                features={provinceMap.features}
                unit={provinceMap.unit}
                label="Population by province"
                period={provinceMap.period}
                valueLabel="Population"
                height={420}
                scale="quantile"
              />
            )}
            <div className="lg:pt-1">
              <p className="text-label text-ink-faint mb-3 uppercase">
                By population, {provinceCmp.period} census
              </p>
              <RankedBars
                compact
                label={`Provinces by population, ${provinceCmp.period}`}
                valueLabel="Population"
                unit={provinceCmp.unit}
                rows={provinceCmp.rows.map((r) => ({
                  name: r.place.name_en,
                  nameNe: r.place.name_ne,
                  href: `/np/${r.place.slug}/`,
                  value: r.value,
                }))}
              />
            </div>
          </div>
        </AnchoredSection>
      )}

      {compare && (
        <AnchoredSection
          id="compare"
          title="Compare the provinces"
          note={
            <>
              Every published census measure, side by side. Rank by any column, or
              select rows to compare a few.{" "}
              {/*
                The cross-parent comparison, from where the intent is.

                This section compares children of one parent, which is the
                comparison the data made easy rather than the one a reader
                arrives with. The link carries this place, so /compare opens
                with it already chosen.
              */}
              <Link href="/compare/?p=nepal">Compare any places, at any level →</Link>
            </>
          }
        >
          <ComparePanel
            places={compare.places}
            metrics={compare.metrics}
            peerLabel="provinces"
            defaultMetricId="population"
          />
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
        {/*
          Coverage the other way up. Below this level the useful statement is
          which measures stop at the nation; here it is which ones go deeper,
          because that is what decides whether a reader's own district has an
          answer.
        */}
        {subNational.length > 0 && (
          <p className="text-ink-faint mt-16 max-w-prose text-[13px] leading-relaxed">
            {subNational.length} of {indsAll.length} measures are published below the
            national level —{" "}
            {subNational.slice(0, 3).map((i, n) => (
              <span key={i.indicator_id}>
                {n > 0 && ", "}
                <Link href={`/indicators/${indicatorSlug(i.indicator_id)}/`}>
                  {i.name_en.toLowerCase()}
                </Link>
              </span>
            ))}{" "}
            among them, all from the {pop?.period ?? 2021} census. The rest are national
            series and have no provincial or district breakdown from their source.{" "}
            <Link href="/indicators/">All indicators and their coverage →</Link>
          </p>
        )}

        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
