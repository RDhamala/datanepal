import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  comparisonFor,
  country,
  districtsOf,
  formatCompact,
  formatNumber,
  formatPercent,
  localUnitMapFor,
  localUnitsOf,
  LOCAL_UNIT_TYPES,
  placeBySlug,
  placeProfile,
  populationOf,
  provinces,
  sourcesFor,
  statusLabel,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { ReferenceMap } from "@/components/ReferenceMap";
import { PlaceProfile, profileSections } from "@/components/PlaceProfile";
import {
  AnchoredSection,
  Crumbs,
  FactStrip,
  PageHeader,
  SectionNav,
  SourceNote,
} from "@/components/ui";

/*
  District page: same pattern as a province, one level down.

  Local units are listed but carry no statistics of their own — COD-PS stops at
  district level. That absence is stated plainly rather than papered over with a
  chart of nothing, and the local-unit list is grouped by type because 18 rural
  municipalities and 1 sub-metropolitan city are not the same kind of thing.
*/

/**
 * Who published the headline population figure, and how it was arrived at.
 *
 * Derived rather than hardcoded: these pages said "UNFPA" unconditionally,
 * which was right while the projection was the only figure and became wrong the
 * moment the census supplied the count.
 */
function populationProvenance(pop: { period: number; status: string }): string {
  return pop.status === "actual"
    ? `${pop.period} census · NSO`
    : `${pop.period} ${statusLabel(pop.status) ?? "estimate"} · UNFPA`;
}

type Params = { province: string; district: string };

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

  const [pop, units, np, localMap, muni, rural, subMetro, metro, profile] =
    await Promise.all([
      populationOf(place),
      localUnitsOf(place.place_id),
      country(),
      localUnitMapFor(place.place_id),
      comparisonFor("population", "municipality"),
      comparisonFor("population", "rural_municipality"),
      comparisonFor("population", "sub_metropolitan"),
      comparisonFor("population", "metropolitan"),
      placeProfile(place),
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
    ...(pop && pop.bands.length ? [{ id: "age-sex", label: "Age & sex" }] : []),
    ...(units.length ? [{ id: "local-governments", label: "Local governments" }] : []),
    { id: "sources", label: "Sources" },
  ];

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
            {units.length} local governments · P-code{" "}
            <code className="font-mono">{place.ocha_pcode}</code>
          </>
        }
      />

      <FactStrip
        facts={[
          {
            label: "Population",
            value: pop ? formatCompact(pop.total) : "—",
            sub: pop ? populationProvenance(pop) : null,
          },
          { label: "Area", value: formatNumber(place.area_sqkm), sub: "km²" },
          {
            label: "Density",
            value: pop?.density ? formatNumber(pop.density) : "—",
            sub: "people per km²",
          },
          {
            label: `Share of ${prov.name_en}`,
            value: shareProvince ? formatPercent(shareProvince) : "—",
            sub: "by population",
          },
          {
            label: "Share of Nepal",
            value: shareNepal ? formatPercent(shareNepal, 2) : "—",
            sub: "by population",
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/* Every topic this district has data for, rendered generically. */}
      <PlaceProfile profile={profile} placeName={place.name_en} />

      {pop && pop.bands.length > 0 && (
        <AnchoredSection
          id="age-sex"
          title="Age and sex structure"
          note={`Five-year age bands from the UNFPA ${pop.bandPeriod ?? pop.period} projection, the only source that publishes age detail at this level. Both sides share one scale, so bar lengths are directly comparable.`}
        >
          <AgePyramid bands={pop.bands} period={pop.bandPeriod ?? pop.period} />
        </AnchoredSection>
      )}

      {units.length > 0 && (
        <AnchoredSection
          id="local-governments"
          title="Local governments"
          note={`${units.length} in this district, with 2021 census population. Each has its own page.`}
        >
          {/*
            A reference map rather than a choropleth, even though population is
            now published at this level. Fill carries unit type, because on a
            district page the question this map answers is "what is in here and
            what kind of thing is it" -- the ranked list beside it answers "how
            large". The population choropleth for these units belongs on a
            comparison surface, not here.
          */}
          {localMap.units.length > 0 && (
            <div className="mb-8">
              <ReferenceMap
                shapes={localMap.units.map((u) => ({
                  placeId: u.placeId,
                  name: u.name,
                  nameNe: u.nameNe,
                  // These have their own pages now, so the shapes are links.
                  href: `/np/${prov.slug}/${place.slug}/${
                    units.find((x) => x.place_id === u.placeId)?.slug ?? ""
                  }/`,
                  geometryGeoJson: u.geometryGeoJson,
                  group: u.placeType,
                }))}
                /*
                  No district outline, deliberately.

                  The local units tile the district exactly, so their outer edge
                  *is* the district border and an outline adds nothing. Drawing
                  the admin-2 boundary over them looked wrong for a real reason:
                  each admin level is simplified independently, admin 2 at
                  tolerance 0.006 and admin 3 at 0.0015, so the same border
                  carries different vertices at each level and the heavier
                  stroke visibly missed the fill beneath it.
                */
                outlines={[]}
                groupOrder={LOCAL_UNIT_TYPES.map((t) => t.type)}
                legend={LOCAL_UNIT_TYPES.filter((t) =>
                  localMap.units.some((u) => u.placeType === t.type),
                ).map((t) => ({ group: t.type, label: t.label }))}
                maxWidth={760}
                maxHeight={520}
                caption={`${localMap.units.length} local governments of ${place.name_en}, shaded by type.`}
              />
            </div>
          )}

          <div className="space-y-6">
            {typeOrder.map((type) => (
              <div key={type}>
                <h3 className="text-label text-ink-faint mb-2 uppercase">
                  {TYPE_LABELS[type] ?? type} · {byType.get(type)!.length}
                </h3>
                <ul className="divide-line grid grid-cols-1 gap-x-10 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                  {byType.get(type)!.map((u) => (
                    <li
                      key={u.place_id}
                      className="border-line flex items-baseline justify-between gap-3 border-b py-1.5"
                    >
                      <Link href={`/np/${prov.slug}/${place.slug}/${u.slug}/`}>
                        {u.name_en}
                      </Link>
                      <span className="text-ink-faint tabular shrink-0">
                        {localPop.has(u.place_id)
                          ? formatNumber(localPop.get(u.place_id))
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
