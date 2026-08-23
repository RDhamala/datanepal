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
  indicatorSlug,
  localUnitsOf,
  placeBySlug,
  populationOf,
  provinces,
  sourcesFor,
  statusLabel,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { RankedBars } from "@/components/charts";
import {
  AnchoredSection,
  Crumbs,
  FactStrip,
  PageHeader,
  SectionNav,
  Sources,
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
      ? `${place.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period} projection), ${districts.length} districts, ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} Province, Nepal.`,
  };
}

export default async function ProvincePage({ params }: { params: Promise<Params> }) {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) notFound();

  const [pop, districtList, np] = await Promise.all([
    populationOf(place),
    districtsOf(place.place_id),
    country(),
  ]);
  const national = np ? await populationOf(np) : null;
  const share =
    pop && national && national.total > 0 ? pop.total / national.total : null;

  // District comparison within this province only.
  const allDistricts = await comparisonFor("population", "district");
  const own = new Set(districtList.map((d) => d.place_id));
  const districtRows = allDistricts.rows.filter((r) => own.has(r.place.place_id));

  const localUnits = (
    await Promise.all(districtList.map((d) => localUnitsOf(d.place_id)))
  ).flat();

  const sections = [
    { id: "population", label: "Population" },
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
            sub: pop ? `${pop.period} ${statusLabel(pop.status) ?? ""} · UNFPA` : null,
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

      {pop && (
        <AnchoredSection
          id="population"
          title="Population"
          note={`${pop.period} projection from UNFPA. Nepal's most recent census was 2021.`}
        >
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <div className="text-label text-ink-faint uppercase">Total</div>
              <div className="text-ink tabular mt-1 text-[1.75rem] leading-none font-semibold">
                {formatNumber(pop.total)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-faint flex items-center gap-1.5 uppercase">
                <span aria-hidden className="bg-series-1 size-2 rounded-[2px]" />
                Female
              </div>
              <div className="text-ink tabular mt-1 text-[1.75rem] leading-none font-semibold">
                {formatNumber(pop.female)}
              </div>
              <div className="text-ink-faint mt-1 text-[12px]">
                {formatPercent(pop.femaleShare)}
              </div>
            </div>
            <div>
              <div className="text-label text-ink-faint flex items-center gap-1.5 uppercase">
                <span aria-hidden className="bg-series-2 size-2 rounded-[2px]" />
                Male
              </div>
              <div className="text-ink tabular mt-1 text-[1.75rem] leading-none font-semibold">
                {formatNumber(pop.male)}
              </div>
              <div className="text-ink-faint mt-1 text-[12px]">
                {formatPercent(1 - (pop.femaleShare ?? 0))}
              </div>
            </div>
          </div>
          <p className="mt-6 text-[13px]">
            <Link href={`/indicators/${indicatorSlug("population")}/`}>
              Population indicator, all places →
            </Link>
          </p>
        </AnchoredSection>
      )}

      {pop && pop.bands.length > 0 && (
        <AnchoredSection
          id="age-sex"
          title="Age and sex structure"
          note="Five-year age bands. Both sides share one scale, so bar lengths are directly comparable."
        >
          <AgePyramid bands={pop.bands} period={pop.period} />
        </AnchoredSection>
      )}

      {districtRows.length > 0 && (
        <AnchoredSection
          id="districts"
          title="Districts by population"
          note={`${districtRows.length} districts, ${allDistricts.period}.`}
        >
          <RankedBars
            label={`Districts of ${place.name_en} by population, ${allDistricts.period}`}
            valueLabel="Population"
            unit={allDistricts.unit}
            rows={districtRows.map((r) => ({
              name: r.place.name_en,
              nameNe: r.place.name_ne,
              href: `/np/${place.slug}/${r.place.slug}/`,
              value: r.value,
            }))}
          />
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
        <Sources tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
