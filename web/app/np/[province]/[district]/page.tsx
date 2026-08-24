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
  metricMapFor,
  localUnitsOf,
  placeBySlug,
  benchmarksFor,
  compositionFor,
  placeProfile,
  spreadFor,
  populationOf,
  provinces,
  sourcesFor,
  statusLabel,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { MetricMap } from "@/components/MetricMap";
import { profileSections } from "@/components/PlaceProfile";
import { TopicSummary } from "@/components/viz/TopicSummary";
import { Composition, Distribution } from "@/components/viz/Composition";
import { Figure, FigureTable, FigureRow, FigureCell } from "@/components/viz/Figure";
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
            <>
              {t.topic.description}{" "}
              <Link href={`/topics/${t.topic.slug}/`}>
                All {t.topic.name_en} indicators →
              </Link>
            </>
          }
        >
          <TopicSummary
            topic={t}
            headlineId={TOPIC_HEADLINE[t.topic.slug] ?? t.metrics[0]?.indicatorId ?? ""}
            benchmark={benchmarks.find((b) =>
              t.metrics.some((m) => m.indicatorId === b.indicatorId),
            )}
            placeName={place.name_en}
          />

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
            An interactive map, because there is now more than one thing to see.

            Until the census there was one statistic below district level, so a
            static map shaded by the only measure available was the whole truth.
            There are five now, and a reader who can only see one has to take the
            rest on faith from a table. Shapes, projection and labels are still
            computed at build time -- none of them depend on the metric -- so the
            client work is recolouring and nothing more.
          */}
          {localMap && (
            <div className="mb-8">
              <MetricMap
                features={localMap.features}
                metrics={localMap.metrics}
                width={localMap.width}
                height={localMap.height}
                caption={`${localMap.features.length} local governments of ${place.name_en}, 2021 census.`}
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
