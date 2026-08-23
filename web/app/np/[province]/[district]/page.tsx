import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
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
import {
  AnchoredSection,
  Crumbs,
  FactStrip,
  PageHeader,
  SectionNav,
  Sources,
} from "@/components/ui";

/*
  District page: same pattern as a province, one level down.

  Local units are listed but carry no statistics of their own — COD-PS stops at
  district level. That absence is stated plainly rather than papered over with a
  chart of nothing, and the local-unit list is grouped by type because 18 rural
  municipalities and 1 sub-metropolitan city are not the same kind of thing.
*/

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
      ? `${place.name_en} District, ${prov.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period} projection), ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} District, ${prov.name_en} Province, Nepal.`,
  };
}

export default async function DistrictPage({ params }: { params: Promise<Params> }) {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) notFound();
  const place = await placeBySlug("district", district, prov.place_id);
  if (!place) notFound();

  const [pop, units, np] = await Promise.all([
    populationOf(place),
    localUnitsOf(place.place_id),
    country(),
  ]);
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

  const sections = [
    ...(pop ? [{ id: "population", label: "Population" }] : []),
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
            sub: pop ? `${pop.period} ${statusLabel(pop.status) ?? ""} · UNFPA` : null,
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
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
            <Link href={`/indicators/${indicatorSlug("population")}/`}>
              Population indicator →
            </Link>
            <Link href={`/np/${prov.slug}/`}>Compare within {prov.name_en} →</Link>
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

      {units.length > 0 && (
        <AnchoredSection
          id="local-governments"
          title="Local governments"
          note={`${units.length} in this district. Population at this level is not published by the source used here, which stops at district.`}
        >
          <div className="space-y-6">
            {typeOrder.map((type) => (
              <div key={type}>
                <h3 className="text-label text-ink-faint mb-2 uppercase">
                  {TYPE_LABELS[type] ?? type} · {byType.get(type)!.length}
                </h3>
                <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                  {byType.get(type)!.map((u) => (
                    <li key={u.place_id}>
                      <span className="text-ink">{u.name_en}</span>
                      {u.name_ne && (
                        <span className="text-ink-faint"> · {u.name_ne}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </AnchoredSection>
      )}

      <div id="sources" className="scroll-mt-20">
        <Sources tables={tables} sources={sourcesFor(tables)} />
      </div>
    </>
  );
}
