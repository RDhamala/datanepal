import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allLocalUnitPaths,
  benchmarksFor,
  comparisonFor,
  formatNumber,
  formatPercent,
  compareFor,
  indicatorSlug,
  indicators,
  localUnitBySlug,
  observations,
  places,
  localUnitMapFor,
  localUnitsOf,
  placeBySlug,
  placeProfile,
  populationOf,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { ReferenceMap } from "@/components/ReferenceMap";
import { profileSections } from "@/components/PlaceProfile";
import { TopicSummary } from "@/components/viz/TopicSummary";
import { HeadlineMetricGroup } from "@/components/viz/HeadlineMetric";
import { coverageByIndicator } from "@/lib/coverage";
import { ComparePanel } from "@/components/viz/ComparePanel";
import {
  AnchoredSection,
  Crumbs,
  PageHeader,
  Pcode,
  SectionNav,
  SourceNote,
} from "@/components/ui";

/*
  Local government page.

  753 of these, one per municipality and rural municipality, generated from the
  same code path as the province and district pages above them. That is the
  claim worth testing rather than asserting: the page reads `placeProfile`,
  which reads observations, so it has no idea which domains exist. Population
  and literacy render here today because the census publishes them at this
  level; a third domain would appear with no change to this file.

  Until now these 753 places had geometry, a name and a P-code but not a single
  statistic — they were reachable only through search, which sent readers to
  their district. They are the majority of Nepal's places and the level closest
  to where public money is actually spent.

  What this page deliberately does not do is invent hierarchy. Wards exist below
  this level and the census publishes ward tables, but nothing is ingested at
  that grain yet, so no ward section appears. A heading over an empty section
  reads as a broken page.
*/

/* Which indicator leads each topic. */
const TOPIC_HEADLINE: Record<string, string> = {
  population: "population",
  education: "literacy_rate",
};

/* Indicators the fact strip already carries. */
const STRIP_INDICATORS = new Set(["population", "households"]);

type Params = { province: string; district: string; local: string };

export async function generateStaticParams(): Promise<Params[]> {
  return allLocalUnitPaths();
}

const TYPE_LABEL: Record<string, string> = {
  metropolitan: "Metropolitan City",
  sub_metropolitan: "Sub-Metropolitan City",
  municipality: "Municipality",
  rural_municipality: "Rural Municipality",
};

// Plurals are listed rather than derived: "Municipality" pluralises to
// "Municipalities", and appending an s produced "Metropolitan Citys".
const TYPE_PLURAL: Record<string, string> = {
  metropolitan: "metropolitan cities",
  sub_metropolitan: "sub-metropolitan cities",
  municipality: "municipalities",
  rural_municipality: "rural municipalities",
};

async function resolve(params: Promise<Params>) {
  const { province, district, local } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) return null;
  const dist = await placeBySlug("district", district, prov.place_id);
  if (!dist) return null;
  const place = await localUnitBySlug(dist.place_id, local);
  if (!place) return null;
  return { prov, dist, place };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { prov, dist, place } = found;
  const label = TYPE_LABEL[place.place_type] ?? "Local government";
  const pop = await populationOf(place);
  return {
    title: `${place.name_en} ${label}`,
    description: pop
      ? `${place.name_en} ${label}, ${dist.name_en} District, ${prov.name_en} Province: population ${formatNumber(pop.total)} at the 2021 census.`
      : `${place.name_en} ${label}, ${dist.name_en} District, ${prov.name_en} Province.`,
  };
}

export default async function LocalUnitPage({ params }: { params: Promise<Params> }) {
  const found = await resolve(params);
  if (!found) notFound();
  const { prov, dist, place } = found;

  const [
    profile,
    siblings,
    districtCmp,
    localMap,
    muni,
    rural,
    subMetro,
    metro,
    compare,
  ] = await Promise.all([
    placeProfile(place),
    localUnitsOf(dist.place_id),
    // This unit's rank is against its own type: a rural municipality ranked
    // among metropolitan cities would be a meaningless comparison.
    comparisonFor("population", place.place_type),
    localUnitMapFor(dist.place_id),
    // The sibling list mixes all four types, because a district contains
    // whatever it contains. Ranking within the district is the honest
    // comparison there.
    comparisonFor("population", "municipality"),
    comparisonFor("population", "rural_municipality"),
    comparisonFor("population", "sub_metropolitan"),
    comparisonFor("population", "metropolitan"),
    localUnitsOf(dist.place_id).then((u) =>
      compareFor(u, [
        "population",
        "households",
        "literacy_rate",
        "literate_population",
        "population_5plus",
      ]),
    ),
  ]);

  const siblingPop = new Map(
    [muni, rural, subMetro, metro]
      .flatMap((c) => c.rows)
      .map((r) => [r.place.place_id, r.value] as const),
  );

  const label = TYPE_LABEL[place.place_type] ?? "Local government";

  // Rank within the district, and within its own type nationally. Both are
  // honest comparisons; a rural municipality ranked against metropolitan cities
  // would not be.
  const ownValue = districtCmp.rows.find((r) => r.place.place_id === place.place_id);
  const nationalRank = ownValue
    ? districtCmp.rows.findIndex((r) => r.place.place_id === place.place_id) + 1
    : null;

  /*
    Benchmarks against the lineage this place actually has.

    benchmarksFor walks the parent chain, so a local government gets district,
    province and Nepal where each publishes the measure -- and silently omits
    any ancestor that does not. Rates only: a local government's population
    against Nepal's is a share, not a comparison, and the fact strip already
    carries the share.
  */
  const [benchmarks, obsAll, placesAll, indsAll] = await Promise.all([
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

  const districtPop = await populationOf(dist);
  const share =
    ownValue && districtPop && districtPop.total > 0
      ? ownValue.value / districtPop.total
      : null;

  const sections = [
    ...profileSections(profile),
    { id: "context", label: "In context" },
    ...(compare ? [{ id: "compare", label: "Compare" }] : []),
    { id: "sources", label: "Sources" },
  ];

  const tables = tablesFor(["observations", "places", "place_boundaries"]);

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/places/", label: "Places" },
          { href: `/np/${prov.slug}/`, label: prov.name_en },
          { href: `/np/${prov.slug}/${dist.slug}/`, label: dist.name_en },
          { label: place.name_en },
        ]}
      />

      <PageHeader
        eyebrow={`${label} · ${dist.name_en} District`}
        title={place.name_en}
        native={place.name_ne}
        meta={
          <>
            {/*
              The full chain, in a sentence. A local government is the one
              level where a reader genuinely may not know where they are, and
              the breadcrumb alone is navigation rather than context.
            */}
            A {label.toLowerCase()} in {dist.name_en} District, {prov.name_en} Province,
            one of {siblings.length} local governments there.{" "}
            {place.ocha_pcode && <Pcode code={place.ocha_pcode} />}
          </>
        }
      />

      {/*
        Four facts, each with its reference period.

        A local government's identity facts are different from a district's:
        the share and the rank are what place it, and both are census-derived,
        so the chips say 2021 three times rather than hiding a mixed period.
        Area is not published for local units, so it is not here -- a blank
        slot would be worse than four honest ones.
      */}
      <HeadlineMetricGroup
        columns={4}
        topRule={false}
        metrics={[
          {
            label: "Population",
            value: ownValue ? formatNumber(ownValue.value) : null,
            period: districtCmp.period,
            status: "census",
            missingNote: `No census population published for ${place.name_en}.`,
          },
          {
            label: "Households",
            value: households ? formatNumber(households.value) : null,
            period: households?.period,
            status: "census",
            missingNote: "Not published for this local government.",
          },
          {
            label: `Share of ${dist.name_en}`,
            value: share ? formatPercent(share) : null,
            period: districtCmp.period,
            status: "census",
          },
          {
            // "Rank among municipalities" wraps to two lines in a 2-column
            // mobile strip and knocks its value out of line with the cell
            // beside it. The type is in the context line below instead.
            label: "Rank nationally",
            value: nationalRank
              ? `${nationalRank} of ${districtCmp.rows.length}`
              : null,
            period: districtCmp.period,
            status: "census",
            context: `By population, among Nepal's ${TYPE_PLURAL[place.place_type] ?? "local governments"}.`,
            missingNote: "Not ranked: no published population.",
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/*
        One visual summary per topic, the same as a district and a province.

        This page rendered the registry form -- every indicator as a row of
        name, definition, value, sex split and provenance. For a local
        government that is five near-identical rows and no comparison at all,
        which is the one thing a reader at this level most needs: 58,828 means
        nothing without Dhading, Bagmati and Nepal beside it.
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
        </AnchoredSection>
      ))}

      <AnchoredSection
        id="context"
        title="In context"
        note={`Where ${place.name_en} sits among the ${siblings.length} local governments of ${dist.name_en}.`}
      >
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-12">
          {localMap.units.length > 0 && (
            <ReferenceMap
              shapes={localMap.units.map((u) => ({
                placeId: u.placeId,
                name: u.name,
                nameNe: u.nameNe,
                href:
                  u.placeId === place.place_id
                    ? null
                    : `/np/${prov.slug}/${dist.slug}/${
                        siblings.find((s) => s.place_id === u.placeId)?.slug ?? ""
                      }/`,
                geometryGeoJson: u.geometryGeoJson,
                // Highlight this unit against its neighbours: the map answers
                // "where am I in this district" before anything else.
                group: u.placeId === place.place_id ? "self" : "other",
              }))}
              outlines={[]}
              groupOrder={["self", "other"]}
              legend={[
                { group: "self", label: place.name_en },
                { group: "other", label: `Other units of ${dist.name_en}` },
              ]}
              maxWidth={520}
              maxHeight={420}
              caption={`${localMap.units.length} local governments of ${dist.name_en}.`}
            />
          )}

          <div>
            <h3 className="text-label text-ink-faint mb-3 uppercase">
              By population, {districtCmp.period}
            </h3>
            <ol className="divide-line divide-y text-[13px]">
              {[...siblings]
                .sort(
                  (a, b) =>
                    (siblingPop.get(b.place_id) ?? 0) -
                    (siblingPop.get(a.place_id) ?? 0),
                )
                .map((s) => {
                  const v = siblingPop.get(s.place_id);
                  const isSelf = s.place_id === place.place_id;
                  return (
                    <li
                      key={s.place_id}
                      className={`flex items-baseline justify-between gap-4 py-1.5 ${
                        isSelf ? "bg-selected -mx-2 px-2" : ""
                      }`}
                    >
                      {isSelf ? (
                        <span className="text-ink font-medium">{s.name_en}</span>
                      ) : (
                        <Link href={`/np/${prov.slug}/${dist.slug}/${s.slug}/`}>
                          {s.name_en}
                        </Link>
                      )}
                      <span
                        className={`tabular ${isSelf ? "text-ink font-medium" : "text-ink-faint"}`}
                      >
                        {v !== undefined ? formatNumber(v) : "—"}
                      </span>
                    </li>
                  );
                })}
            </ol>
            <p className="mt-4 text-[13px]">
              <Link href={`/np/${prov.slug}/${dist.slug}/`}>
                {dist.name_en} District overview →
              </Link>
            </p>
          </div>
        </div>
      </AnchoredSection>

      {compare && (
        <AnchoredSection
          id="compare"
          title={`Compare with the rest of ${dist.name_en}`}
          note="Every published census measure, side by side. This unit is highlighted; rank by any column, or select rows to compare a few."
        >
          <ComparePanel
            places={compare.places}
            metrics={compare.metrics}
            subjectId={place.place_id}
            peerLabel="local governments"
            defaultMetricId="population"
          />
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
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
            are published for Nepal as a whole and are not broken down to local
            governments by their source, so they have no section here.{" "}
            <Link href="/indicators/">All indicators and their coverage →</Link>
          </p>
        )}

        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
