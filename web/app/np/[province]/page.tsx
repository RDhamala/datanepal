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
  localUnitsOf,
  mapFor,
  placeBySlug,
  placeProfile,
  populationOf,
  provinces,
  sourcesFor,
  statusLabel,
  tablesFor,
} from "@/lib/data";
import { Choropleth } from "@/components/Choropleth";
import { AgePyramid } from "@/components/AgePyramid";
import { PlaceProfile, profileSections } from "@/components/PlaceProfile";
import { RankedBars } from "@/components/charts";
import {
  AnchoredSection,
  Crumbs,
  FactStrip,
  PageHeader,
  SectionNav,
  SourceNote,
} from "@/components/ui";

/*
  Province page: a concise cross-topic overview, not a population report.

  Sections are driven by what data exists. Economy, government, elections,
  education and health are all architecturally ready and none has provincial
  data yet, so none of their headings appear. An empty section reads as a broken
  page; a missing section reads as scope.

  The one honest statement we do make about absence is at the bottom, where we
  name what is not yet covered rather than leaving a reader guessing.
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

  const [pop, districtList, np, profile] = await Promise.all([
    populationOf(place),
    districtsOf(place.place_id),
    country(),
    placeProfile(place),
  ]);
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
    ...(pop && pop.bands.length ? [{ id: "age-sex", label: "Age & sex" }] : []),
    ...(districtRows.length ? [{ id: "districts", label: "Districts" }] : []),
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
            {districtList.length} districts · {localUnits.length} local governments ·
            P-code <code className="font-mono">{place.ocha_pcode}</code>
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
          {
            label: "Area",
            value: `${formatNumber(place.area_sqkm)}`,
            sub: "km²",
          },
          {
            label: "Density",
            value: pop?.density ? formatNumber(pop.density) : "—",
            sub: "people per km²",
          },
          {
            label: "Share of Nepal",
            value: share ? formatPercent(share) : "—",
            sub: "by population",
          },
          {
            label: "Working age",
            value: pop?.workingAgeShare ? formatPercent(pop.workingAgeShare, 0) : "—",
            sub: "aged 15–64",
          },
        ]}
      />

      <SectionNav sections={sections} />

      {/* Every topic this province has data for, rendered generically. */}
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
                height={340}
                // Labels only where they fit inside the shapes; a province of
                // thirteen districts at this size is a thicket of overlapping
                // text. The ranking beside it carries the names either way.
                showLabels={ownFeatures.length <= 8}
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

      {/* Naming what is absent, rather than leaving a reader to wonder. */}
      <AnchoredSection
        id="coverage"
        title="Not yet covered"
        note="Architecturally supported, no provincial data published yet."
      >
        <p className="text-ink-soft max-w-2xl text-[13px]">
          Economy · Government &amp; budgets · Elections · Education · Health ·
          Agriculture · Infrastructure. See <Link href="/topics/">topics</Link> for what
          is available now.
        </p>
      </AnchoredSection>

      <div id="sources" className="scroll-mt-20">
        <SourceNote tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
