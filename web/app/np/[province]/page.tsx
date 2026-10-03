import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  benchmarksFor,
  comparisonFor,
  country,
  districtsOf,
  formatNumber,
  formatPercent,
  indicatorSlug,
  indicators,
  localUnitsOf,
  mapFor,
  observations,
  placeBySlug,
  places,
  compareFor,
  placeProfile,
  populationOf,
  provinces,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import Link from "next/link";
import { Choropleth } from "@/components/Choropleth";
import { AgePyramid } from "@/components/AgePyramid";
import { profileSections } from "@/components/PlaceProfile";
import { ComparePanel } from "@/components/viz/ComparePanel";
import { TopicSummary } from "@/components/viz/TopicSummary";
import { HeadlineMetricGroup } from "@/components/viz/HeadlineMetric";
import { RankedBars } from "@/components/charts";
import { coverageByIndicator } from "@/lib/coverage";
import {
  AnchoredSection,
  Crumbs,
  PageHeader,
  Pcode,
  SectionNav,
  SourceNote,
} from "@/components/ui";

/*
  Province page: a concise cross-topic overview, not a population report.

  Sections are driven by what data exists. Economy, government, elections,
  education and health are all architecturally ready and none has provincial
  data yet, so none of their headings appear. An empty section reads as a broken
  page; a missing section reads as scope.

  Coverage is stated once beside the sources rather than as a section of its
  own: a headline list of absences on every province page is a worse answer
  than omitting the sections, and the place-page rule says so.

  Age and sex sits inside Population & Demographics, not beside it. It is
  sub-structure of a topic, not a peer of Education, and letting a chart type
  become a top-level domain is how a topic list stops meaning anything.
*/

/* Which indicator leads each topic. Inferring it from row order would mean a
   page's emphasis changed whenever ingestion order did. */
const TOPIC_HEADLINE: Record<string, string> = {
  population: "population",
  education: "literacy_rate",
};

/* Indicators the fact strip already shows. A topic summary leading with one of
   these would print the same number twice on one screen. */
const STRIP_INDICATORS = new Set(["population", "households"]);

type Params = { province: string };

export async function generateStaticParams(): Promise<Params[]> {
  return (await provinces()).map((p) => ({ province: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) return {};
  const pop = await populationOf(place);
  const districts = await districtsOf(place.place_id);
  return {
    title: `${place.name_en} Province`,
    description: pop
      ? `${place.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}${pop.status === "actual" ? " census" : " projection"}), ${districts.length} districts, ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} Province, Nepal.`,
  };
}

export default async function ProvincePage({ params }: { params: Promise<Params> }) {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) notFound();

  const [pop, districtList, np, profile, compare] = await Promise.all([
    populationOf(place),
    districtsOf(place.place_id),
    country(),
    placeProfile(place),
    // Peers change with the level: a province compares its districts, a
    // district its local governments. Same component, same metrics, same rules.
    districtsOf(place.place_id).then((ds) =>
      compareFor(ds, [
        "population",
        "households",
        "literacy_rate",
        "literate_population",
        "population_5plus",
      ]),
    ),
  ]);
  const [benchmarks, obsAll, placesAll, indsAll] = await Promise.all([
    // Rates and ratios only: a province's population against Nepal's is a
    // share, not a comparison.
    benchmarksFor(place, ["literacy_rate", "population_density"]),
    observations(),
    places(),
    indicators(),
  ]);
  const coverage = coverageByIndicator(obsAll, placesAll);
  const nationalOnly = indsAll.filter(
    (i) => coverage.get(i.indicator_id)?.level === "national",
  );
  const households = profile
    .flatMap((t) => t.metrics)
    .find((m) => m.indicatorId === "households");

  const national = np ? await populationOf(np) : null;
  const share =
    pop && national && national.total > 0 ? pop.total / national.total : null;

  // District comparison and geometry, both narrowed to this province.
  const [allDistricts, districtMap] = await Promise.all([
    comparisonFor("population", "district"),
    mapFor("population", "district"),
  ]);
  const own = new Set(districtList.map((d) => d.place_id));
  const districtRows = allDistricts.rows.filter((r) => own.has(r.place.place_id));
  const ownFeatures = districtMap.features.filter((f) => own.has(f.placeId));

  const localUnits = (
    await Promise.all(districtList.map((d) => localUnitsOf(d.place_id)))
  ).flat();

  /*
    Sections come from the data, not from a list maintained here. The profile
    contributes one per topic the province has, so the census adding education
    put an Education section on all 7 provinces, 77 districts and 753 local
    governments at once, and nothing in this file changed.
  */
  const sections = [
    ...profileSections(profile),
    ...(districtRows.length ? [{ id: "districts", label: "Districts" }] : []),
    ...(compare ? [{ id: "compare", label: "Compare" }] : []),
    { id: "sources", label: "Sources" },
  ];

  const tables = tablesFor(["observations", "places"]);

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/places/", label: "Places" },
          { label: place.name_en },
        ]}
      />

      <PageHeader
        eyebrow="Province"
        title={`${place.name_en} Province`}
        native={place.name_ne}
        meta={
          <>
            {/* What this place is and where it sits, before any figure. */}
            One of Nepal&rsquo;s seven provinces, made up of {districtList.length}{" "}
            districts and {localUnits.length} local governments.{" "}
            {place.ocha_pcode && <Pcode code={place.ocha_pcode} />}
          </>
        }
      />

      {/*
        Headline facts, each carrying its own reference period.

        The same strip as a district page, one level up. The chips matter more
        here than almost anywhere: a province shows a 2021 census count beside
        a working-age share derived from the 2023 projection, and those are
        two different kinds of number.
      */}
      <HeadlineMetricGroup
        columns={5}
        topRule={false}
        metrics={[
          {
            label: "Population",
            value: pop ? formatNumber(pop.total) : null,
            period: pop?.period,
            status: pop?.status === "actual" ? "census" : "projection",
            missingNote: "No census population published for this province.",
          },
          {
            label: "Households",
            value: households ? formatNumber(households.value) : null,
            period: households?.period,
            status: "census",
            missingNote: "Not published for this province.",
          },
          {
            label: "Area",
            value: formatNumber(place.area_sqkm),
            unit: "km²",
          },
          {
            label: "Density",
            value: pop?.density ? formatNumber(pop.density) : null,
            unit: "per km²",
            period: pop?.period,
            status: pop?.status === "actual" ? "census" : "projection",
          },
          {
            label: "Share of Nepal",
            value: share ? formatPercent(share) : null,
            period: pop?.period,
            status: "census",
            /*
              No working-age share here.

              It is derived from the 2023 projection, and putting it under a
              2021 chip is precisely the mixed-period confusion the chips
              exist to prevent -- a caveat in the caption does not undo a
              contradiction in the label. The age pyramid below carries it
              with its own period stated.
            */
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/*
        One visual summary per topic, with age and sex nested inside the
        population topic rather than standing beside it.

        This page used to render every indicator as a row of name, definition,
        value, sex split and provenance -- the registry form. A province with
        five census measures produced five near-identical rows and an age
        pyramid in a section of its own, which made "Age & sex" look like a
        peer of Education in the jump nav. It is sub-structure of Population.
      */}
      {profile.map((t) => (
        <AnchoredSection
          key={t.topic.topic_id}
          id={t.topic.slug}
          title={t.topic.name_en}
          note={
            <Link href={`/topics/${t.topic.slug}/`}>
              All {t.topic.name_en} indicators for Nepal →
            </Link>
          }
        >
          <TopicSummary
            topic={t}
            headlineId={TOPIC_HEADLINE[t.topic.slug] ?? t.metrics[0]?.indicatorId ?? ""}
            benchmark={benchmarks.find((b) =>
              t.metrics.some((m) => m.indicatorId === b.indicatorId),
            )}
            placeName={place.name_en}
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
                Five-year bands from the UNFPA {pop.bandPeriod ?? pop.period}{" "}
                projection, the only source publishing age detail at this level — a
                different reference period from the census count above. Both sides share
                one scale.
              </p>
              <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
            </div>
          )}
        </AnchoredSection>
      ))}

      {districtRows.length > 0 && (
        <AnchoredSection
          id="districts"
          title="Districts by population"
          note={`${districtRows.length} districts, ${allDistricts.period}. The map answers where; the ranking answers how much.`}
        >
          {/* Map beside the ranking, same as the national view. The Choropleth
              derives its own bounding box, so passing only this province's
              districts frames the province rather than the country. */}
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-12">
            {ownFeatures.length > 0 && (
              <Choropleth
                features={ownFeatures}
                unit={districtMap.unit}
                label={`Population by district, ${place.name_en}`}
                period={districtMap.period}
                valueLabel="Population"
                height={420}
                // Labels always on. This used to be `ownFeatures.length <= 8`,
                // which meant drilling into Bagmati or Koshi produced a district
                // map with no district names at all. The label engine now
                // decides per label -- fit, shrink, shorten, or leader line --
                // so a dense province gets names rather than none.
                // Same skew as the national map: one metropolitan district
                // against a dozen rural ones flattens an equal-interval ramp.
                scale="quantile"
              />
            )}
            <RankedBars
              label={`Districts of ${place.name_en} by population, ${allDistricts.period}`}
              valueLabel="Population"
              unit={allDistricts.unit}
              compact
              rows={districtRows.map((r) => ({
                name: r.place.name_en,
                nameNe: r.place.name_ne,
                href: `/np/${place.slug}/${r.place.slug}/`,
                value: r.value,
              }))}
            />
          </div>
        </AnchoredSection>
      )}

      {compare && (
        <AnchoredSection
          id="compare"
          title={`Compare the districts of ${place.name_en}`}
          note="Every published census measure, side by side. Rank by any column, or select rows to compare a few."
        >
          <ComparePanel
            places={compare.places}
            metrics={compare.metrics}
            peerLabel="districts"
            defaultMetricId="population"
          />
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
        {/*
          Coverage, stated once and quietly. Omitting a topic with no data is
          right; letting a reader conclude the data does not exist is not.
        */}
        {nationalOnly.length > 0 && (
          <p className="text-ink-faint mt-16 max-w-prose text-[13px] leading-relaxed">
            Measures such as{" "}
            {nationalOnly.slice(0, 3).map((i, n) => (
              <span key={i.indicator_id}>
                {n > 0 && ", "}
                <Link href={`/indicators/${indicatorSlug(i.indicator_id)}/`}>
                  {i.name_en.toLowerCase()}
                </Link>
              </span>
            ))}{" "}
            are published for Nepal as a whole and are not broken down to provinces by
            their source, so they have no section here.{" "}
            <Link href="/indicators/">All indicators and their coverage →</Link>
          </p>
        )}

        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
