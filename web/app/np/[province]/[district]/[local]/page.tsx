import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  allLocalUnitPaths,
  comparisonFor,
  formatNumber,
  formatPercent,
  compareFor,
  localUnitBySlug,
  localUnitMapFor,
  localUnitsOf,
  placeBySlug,
  placeProfile,
  populationOf,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { ReferenceMap } from "@/components/ReferenceMap";
import { PlaceProfile, profileSections } from "@/components/PlaceProfile";
import { ComparePanel } from "@/components/viz/ComparePanel";
import {
  AnchoredSection,
  Crumbs,
  FactStrip,
  PageHeader,
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
            {prov.name_en} Province · P-code{" "}
            <code className="font-mono">{place.ocha_pcode}</code>
          </>
        }
      />

      <FactStrip
        facts={[
          {
            label: "Population",
            value: ownValue ? formatNumber(ownValue.value) : "—",
            sub: ownValue ? `${districtCmp.period} census · NSO` : null,
          },
          {
            label: "Share of district",
            value: share ? formatPercent(share) : "—",
            sub: `of ${dist.name_en}`,
          },
          {
            label: `Rank among ${TYPE_PLURAL[place.place_type] ?? "local governments"}`,
            value: nationalRank ? `${nationalRank} of ${districtCmp.rows.length}` : "—",
            sub: "nationally, by population",
          },
          {
            label: "Local governments here",
            value: String(siblings.length),
            sub: `in ${dist.name_en}`,
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/*
        The generic profile. Every topic with data for this place, rendered from
        observations rather than from any knowledge of which sources exist.
      */}
      <PlaceProfile profile={profile} placeName={place.name_en} />

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

      {/* Naming what is absent rather than leaving a reader to wonder. */}
      <AnchoredSection
        id="coverage"
        title="Not yet covered"
        note="Supported by the data model, not yet ingested at this level."
      >
        <p className="text-ink-soft max-w-prose text-[13px] leading-relaxed">
          Ward-level detail, local government budgets and expenditure, school and health
          facility counts, and election results. The census publishes ward tables and
          the model already supports the grain; nothing is ingested there yet, so no
          section for it appears above.
        </p>
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
        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
