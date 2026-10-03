import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  country,
  districtsOf,
  formatNumber,
  formatPercent,
  metricMapFor,
  localUnitsOf,
  placeBySlug,
  benchmarksFor,
  compareFor,
  compositionFor,
  indicatorSlug,
  placeProfile,
  spreadFor,
  populationOf,
  indicators,
  observations,
  places,
  units as allUnitsFn,
  provinces,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { MetricMap } from "@/components/MetricMap";
import { profileSections } from "@/components/PlaceProfile";
import { TopicSummary } from "@/components/viz/TopicSummary";
import { ComparePanel } from "@/components/viz/ComparePanel";
import { Composition, Distribution } from "@/components/viz/Composition";
import { Figure, FigureTable, FigureRow, FigureCell } from "@/components/viz/Figure";
import {
  AnchoredSection,
  Crumbs,
  PageHeader,
  Pcode,
  SectionNav,
  SourceNote,
} from "@/components/ui";
import { RankedBars } from "@/components/charts";
import { HeadlineMetricGroup } from "@/components/viz/HeadlineMetric";
import { coverageByIndicator } from "@/lib/coverage";

/*
  District page: same pattern as a province, one level down.

  Local units are listed but carry no statistics of their own — COD-PS stops at
  district level. That absence is stated plainly rather than papered over with a
  chart of nothing, and the local-unit list is grouped by type because 18 rural
  municipalities and 1 sub-metropolitan city are not the same kind of thing.
*/

type Params = { province: string; district: string };

/*
  Which indicator leads each topic.

  Literacy rate leads Education; population leads Demographics. Inferring this
  from row order would mean a page's emphasis changed whenever ingestion order
  did, which is not a thing that should be able to happen by accident.
*/
const TOPIC_HEADLINE: Record<string, string> = {
  population: "population",
  education: "literacy_rate",
};

/*
  Indicators the fact strip already shows.

  A topic summary whose headline is one of these prints the same number a few
  hundred pixels below the strip, at a different size -- which reads as two
  figures a reader has to reconcile rather than as one fact stated once. The
  section keeps everything the strip cannot carry: the sex split, the
  benchmark, the definitions.
*/
const STRIP_INDICATORS = new Set(["population", "households"]);

/* Measures worth benchmarking against province and nation. Rates and ratios
   only: a district's population against Nepal's is a share, not a comparison. */
const BENCHMARKED = ["literacy_rate", "population_density"];

const TYPE_LABELS: Record<string, string> = {
  metropolitan: "Metropolitan city",
  sub_metropolitan: "Sub-metropolitan city",
  municipality: "Municipality",
  rural_municipality: "Rural municipality",
};

export async function generateStaticParams(): Promise<Params[]> {
  // From the parent relation, not a flat slug list: 22 local-unit names are
  // shared nationally, so slugs are unique only within a parent.
  const out: Params[] = [];
  for (const p of await provinces()) {
    for (const d of await districtsOf(p.place_id)) {
      out.push({ province: p.slug, district: d.slug });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  const place = prov && (await placeBySlug("district", district, prov.place_id));
  if (!place || !prov) return {};
  const pop = await populationOf(place);
  return {
    title: `${place.name_en} District`,
    description: pop
      ? `${place.name_en} District, ${prov.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}${pop.status === "actual" ? " census" : " projection"}), ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} District, ${prov.name_en} Province, Nepal.`,
  };
}

export default async function DistrictPage({ params }: { params: Promise<Params> }) {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) notFound();
  const place = await placeBySlug("district", district, prov.place_id);
  if (!place) notFound();

  const [
    pop,
    units,
    np,
    localMap,
    muni,
    rural,
    subMetro,
    metro,
    profile,
    benchmarks,
    literacyMix,
    literacySpread,
    compare,
  ] = await Promise.all([
    populationOf(place),
    localUnitsOf(place.place_id),
    country(),
    // Local governments, with every census measure published for them. The
    // geometry and labels are laid out here; the browser only recolours.
    localUnitsOf(place.place_id).then((units) =>
      metricMapFor(
        units,
        [
          "population",
          "households",
          "literacy_rate",
          "literate_population",
          "population_5plus",
        ],
        { maxWidth: 760, maxHeight: 560 },
      ),
    ),
    comparisonFor("population", "municipality"),
    comparisonFor("population", "rural_municipality"),
    comparisonFor("population", "sub_metropolitan"),
    comparisonFor("population", "metropolitan"),
    placeProfile(place),
    benchmarksFor(place, BENCHMARKED),
    // What the non-literate share actually consists of, and where this
    // district sits among all 77 -- the two questions a single rate cannot
    // answer.
    compositionFor(place, "population_5plus", "literacy_status"),
    spreadFor("district", "literacy_rate"),
    // Peers change with the level: a district compares its local governments,
    // a province its districts. Same component, same metrics, same rules.
    localUnitsOf(place.place_id).then((u) =>
      compareFor(u, [
        "population",
        "households",
        "literacy_rate",
        "literate_population",
        "population_5plus",
      ]),
    ),
  ]);

  // One lookup across all four local-unit types: the census publishes them as
  // separate place types, but a district list wants them together.
  const localPop = new Map(
    [muni, rural, subMetro, metro]
      .flatMap((c) => c.rows)
      .map((r) => [r.place.place_id, r.value] as const),
  );
  const national = np ? await populationOf(np) : null;
  const provincePop = await populationOf(prov);

  const shareNepal =
    pop && national && national.total > 0 ? pop.total / national.total : null;
  const shareProvince =
    pop && provincePop && provincePop.total > 0 ? pop.total / provincePop.total : null;

  const byType = new Map<string, typeof units>();
  for (const u of units) {
    byType.set(u.place_type, [...(byType.get(u.place_type) ?? []), u]);
  }
  const typeOrder = [
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ].filter((t) => byType.has(t));

  /*
    Sections come from the data. The profile contributes one per topic this
    district has, which is why adding the census put an Education section on
    every province, district and local government at once with no change here.
  */
  const sections = [
    ...profileSections(profile),
    ...(units.length ? [{ id: "local-governments", label: "Local governments" }] : []),
    ...(compare ? [{ id: "compare", label: "Compare" }] : []),
    { id: "sources", label: "Sources" },
  ];

  const personsUnit = (await allUnitsFn()).find((u) => u.unit_id === "persons");

  const households = profile
    .flatMap((t) => t.metrics)
    .find((m) => m.indicatorId === "households");

  /*
    Coverage, so an absent topic can explain itself.

    Place pages correctly omit a section with no data for this place, which
    makes the omission silent: a reader who follows "Health" from here lands
    on a page with no Dhading in it and concludes the data does not exist. It
    exists nationally. Saying which is the whole of the fix.
  */
  const [obsAll, placesAll, indsAll] = await Promise.all([
    observations(),
    places(),
    indicators(),
  ]);
  const coverage = coverageByIndicator(obsAll, placesAll);
  const nationalOnly = indsAll
    .filter((i) => coverage.get(i.indicator_id)?.level === "national")
    .slice(0, 6);

  const ownLiteracy = profile
    .flatMap((t) => t.metrics)
    .find((m) => m.indicatorId === "literacy_rate")?.value;

  const tables = tablesFor(["observations", "places", "geography"]);

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/places/", label: "Places" },
          { href: `/np/${prov.slug}/`, label: prov.name_en },
          { label: place.name_en },
        ]}
      />

      <PageHeader
        eyebrow={`District · ${prov.name_en} Province`}
        title={`${place.name_en} District`}
        native={place.name_ne}
        meta={
          <>
            {/*
              One sentence that says what this place is and where it sits,
              before any figure. ONS puts the same thing under its area titles,
              and it is the difference between a page that opens with a record
              and one that opens with an answer. The P-code is a chip rather
              than inline code: it is an identifier a reader may need, not a
              fact about Dhading.
            */}
            A district of {prov.name_en} Province, made up of {units.length} local
            governments. {place.ocha_pcode && <Pcode code={place.ocha_pcode} />}
          </>
        }
      />

      {/*
        Headline facts, each carrying its own reference period.

        The strip used to print five numbers with their provenance as grey
        microcopy of the same size as everything else, which on this page means
        a 2021 census count sitting beside a density derived from it and a
        share of a province measured in the same year -- fine here, and exactly
        the arrangement that goes wrong the moment a projection joins them. A
        chip bound to each figure is what Data México does and is the cheapest
        defence against a reader combining two periods by eye.

        Five facts, not every field the record holds.
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
            missingNote: "No census population published for this district.",
          },
          {
            label: "Households",
            value: households ? formatNumber(households.value) : null,
            period: households?.period,
            status: "census",
            missingNote: "Not published for this district.",
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
            label: `Share of ${prov.name_en}`,
            value: shareProvince ? formatPercent(shareProvince) : null,
            period: pop?.period,
            status: "census",
            context: shareNepal ? `${formatPercent(shareNepal, 2)} of Nepal.` : null,
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/*
        One visual summary per topic, rather than a stack of indicator rows.

        Education was three vertical rows of name, definition, value, sex split
        and provenance -- fifteen lines of text for a topic whose finding is a
        single rate and whether it beats the province. The summary leads with the
        rate, puts the comparison beside it, and keeps the definitions behind a
        disclosure.
      */}
      {profile.map((t) => (
        <AnchoredSection
          key={t.topic.topic_id}
          id={t.topic.slug}
          title={t.topic.name_en}
          note={
            /*
              The topic description is written for the national topic page --
              "How many people live in Nepal, where, and how the population is
              structured by age and sex" -- and reads as an error under a
              district heading. The link is what a reader needs here; the
              definition belongs to the topic page it points at.
            */
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

          {/*
            Age and sex, inside Population rather than beside it.

            It was a peer AnchoredSection with its own jump-nav entry, which
            put a chart type at the same level as Education in the topic list.
            It is sub-structure of a topic. The province page was corrected
            first; this is the same change, and the build-time page check is
            what caught that 77 district pages still had the old shape.
          */}
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

          {/*
            Two additions that a rate alone cannot make: what the rest of the
            population consists of, and where this district falls among its
            peers. "Cannot read or write" and "can read only" are materially
            different situations, and 72.4% means something different depending
            on whether the other 76 districts cluster above or below it.
          */}
          {t.topic.slug === "education" && (literacyMix || literacySpread.length) && (
            <div className="border-line mt-9 grid gap-x-12 gap-y-8 border-t pt-7 lg:grid-cols-2">
              {literacyMix && (
                <Figure
                  title="Literacy status of the population aged 5 and over"
                  subtitle="The four categories the census reports, which together account for everyone counted."
                  table={
                    <FigureTable
                      columns={[
                        { label: "Status" },
                        { label: "People", numeric: true },
                      ]}
                    >
                      {literacyMix.slices.map((sl) => (
                        <FigureRow key={sl.id}>
                          <FigureCell strong>{sl.label}</FigureCell>
                          <FigureCell numeric>{formatNumber(sl.value)}</FigureCell>
                        </FigureRow>
                      ))}
                    </FigureTable>
                  }
                >
                  <Composition slices={literacyMix.slices} total={literacyMix.total} />
                </Figure>
              )}

              {literacySpread.length > 4 && ownLiteracy && (
                <Figure
                  title="Where this district sits"
                  subtitle="Every district's literacy rate, with the median marked."
                >
                  <Distribution
                    values={literacySpread}
                    subject={{
                      id: place.place_id,
                      name: place.name_en,
                      value: ownLiteracy,
                    }}
                    format={(v) => `${v.toFixed(1)}%`}
                    peerLabel="districts"
                  />
                </Figure>
              )}
            </div>
          )}
        </AnchoredSection>
      ))}

      {units.length > 0 && (
        <AnchoredSection
          id="local-governments"
          title="Local governments"
          note={`${units.length} in this district, with 2021 census population. Each has its own page.`}
        >
          {/*
            An interactive map, because there is now more than one thing to see.

            Until the census there was one statistic below district level, so a
            static map shaded by the only measure available was the whole truth.
            There are five now, and a reader who can only see one has to take the
            rest on faith from a table. Shapes, projection and labels are still
            computed at build time -- none of them depend on the metric -- so the
            client work is recolouring and nothing more.
          */}
          {/*
            Map and ranking side by side, reading the same data.

            The map alone sat in a 760px frame inside a 1344px container with
            nothing beside it, and answered only "where". Eurostat's regional
            tool puts the distribution next to the map for exactly this reason:
            "where" and "how much" are different questions and a reader usually
            has both. The ranking is compact -- it carries no second table,
            because the map already owns the exact-value disclosure.
          */}
          {localMap && (
            <div className="mb-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-12">
              <MetricMap
                features={localMap.features}
                metrics={localMap.metrics}
                width={localMap.width}
                height={localMap.height}
                caption={`${localMap.features.length} local governments of ${place.name_en}, 2021 census.`}
              />
              <div className="lg:pt-1">
                <p className="text-label text-ink-faint mb-3 uppercase">
                  By population, 2021 census
                </p>
                <RankedBars
                  compact
                  label={`Local governments by population`}
                  rows={units
                    .map((u) => ({
                      name: u.name_en,
                      nameNe: u.name_ne,
                      href: `/np/${prov.slug}/${place.slug}/${u.slug}/`,
                      value: localPop.get(u.place_id) ?? 0,
                    }))
                    .filter((r) => r.value > 0)
                    .sort((a, b) => b.value - a.value)}
                  unit={personsUnit}
                  valueLabel="People"
                />
              </div>
            </div>
          )}

          {/*
            The same 13 places, grouped by what they legally are.

            This list used to carry each unit's population too, which the map
            and the ranking above now both show -- thirteen numbers printed
            three times on one screen. What only this list says is the type
            distinction: a municipality and a rural municipality are different
            kinds of local government, and that is not visible in a ranking.
            So it keeps the grouping and drops the values.
          */}
          <div className="space-y-6">
            {typeOrder.map((type) => (
              <div key={type}>
                <h3 className="text-label text-ink-faint mb-2 uppercase">
                  {TYPE_LABELS[type] ?? type} · {byType.get(type)!.length}
                </h3>
                <ul className="grid grid-cols-2 gap-x-10 gap-y-1 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
                  {byType.get(type)!.map((u) => (
                    <li key={u.place_id} className="border-line border-b py-1.5">
                      <Link href={`/np/${prov.slug}/${place.slug}/${u.slug}/`}>
                        {u.name_en}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AnchoredSection>
      )}

      {compare && (
        <AnchoredSection
          id="compare"
          title={`Compare the local governments of ${place.name_en}`}
          note="Every published census measure, side by side. Rank by any column, or select rows to compare a few."
        >
          <ComparePanel
            places={compare.places}
            metrics={compare.metrics}
            peerLabel="local governments"
            defaultMetricId="population"
          />
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
        {/*
          Coverage, stated once and quietly.

          The place-page rule forbids a prominent "not yet covered" section,
          and it is right: a headline list of absences on all 753 pages is a
          worse answer than omitting the sections, which is what this page
          does. But omission alone leaves a reader to conclude the data does
          not exist, when for most of these it exists nationally. One line
          beside the sources closes that gap without making absence the
          subject.
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
            are published for Nepal as a whole and are not broken down to districts by
            their source, so they have no section here.{" "}
            <Link href="/indicators/">All indicators and their coverage →</Link>
          </p>
        )}

        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
