import type { Metadata } from "next";
import Link from "next/link";
import {
  comparisonFor,
  districtsOf,
  formatNumber,
  mapFor,
  places,
  provinces,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { Choropleth } from "@/components/Choropleth";
import { Search } from "@/components/Search";
import { Crumbs, PageHeader, Section, SourceNote } from "@/components/ui";

export const metadata: Metadata = {
  title: "Places",
  description:
    "Every province, district and local unit in Nepal, with population where published.",
};

/*
  Places index: geographic discovery, led by geography.

  The old version was a nested directory — province headings with district links
  underneath. It was correct and unusable: to find a district you had to already
  know its province. Two fixes, both structural rather than cosmetic.

  First, the map leads. It is the surface that answers "where is this" without
  prior knowledge, and it is how anyone actually navigates a country they are
  learning about.

  Second, search covers all 753 local units — which have no pages and so cannot
  be reached by browsing at all. That is the majority of Nepal's places, and a
  directory of provinces silently pretends they are not there.

  Districts are still listed beneath each province, because a district table
  ranked by population answers comparison questions the map answers only
  approximately. Local units remain counted rather than listed: 753 links is a
  directory, not discovery, and they hold no statistics of their own yet.
*/

const LOCAL_TYPES = [
  "metropolitan",
  "sub_metropolitan",
  "municipality",
  "rural_municipality",
];

export default async function PlacesIndex() {
  const [all, provs, provinceCmp, districtCmp, provinceMap, districtMap] =
    await Promise.all([
      places(),
      provinces(),
      comparisonFor("population", "province"),
      comparisonFor("population", "district"),
      mapFor("population", "province"),
      mapFor("population", "district"),
    ]);

  const popOf = new Map([
    ...provinceCmp.rows.map((r) => [r.place.place_id, r.value] as const),
    ...districtCmp.rows.map((r) => [r.place.place_id, r.value] as const),
  ]);

  const grouped = await Promise.all(
    provs.map(async (p) => ({
      province: p,
      districts: (await districtsOf(p.place_id)).sort(
        (a, b) => (popOf.get(b.place_id) ?? 0) - (popOf.get(a.place_id) ?? 0),
      ),
      population: popOf.get(p.place_id),
    })),
  );
  grouped.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const localCount = all.filter((p) => LOCAL_TYPES.includes(p.place_type)).length;
  // observations is in the list because this page shows population figures.
  // Citing the boundary publisher but not the population publisher would be an
  // attribution gap, not a shorter citation.
  const tables = tablesFor([
    "places",
    "geography",
    "place_boundaries",
    "observations",
  ]);

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Places" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Places"
        native="स्थानहरू"
        meta={`7 provinces · 77 districts · ${localCount} local units, on the OCHA P-code spine`}
      />

      {/* Search first, because it is the only route to the 753 local units. */}
      <div className="mb-12 max-w-lg">
        <Search
          size="large"
          placeholder="Find a province, district or local unit…"
          examples={["Kathmandu", "Dhanusa", "Pokhara", "Ilam"]}
        />
      </div>

      {/* District-level map: the finest geography we hold boundaries for, and
          the one that makes Nepal's population distribution legible. */}
      {districtMap.features.length > 0 && (
        <Section
          title="All 77 districts"
          note={`Shaded by population, ${districtMap.period}. Select a district to open it.`}
        >
          <Choropleth
            features={districtMap.features}
            unit={districtMap.unit}
            label="Population by district"
            period={districtMap.period}
            valueLabel="Population"
            height={520}
            showLabels={false}
            scale="quantile"
          />
        </Section>
      )}

      {/* Provinces, ranked, each with its districts ranked beneath. */}
      <Section
        title="By province"
        note={`Districts listed by population, ${districtCmp.period}.`}
      >
        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
          {grouped.map(({ province, districts, population }) => (
            <div key={province.place_id} className="border-line border-t pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h3 className="text-[1.0625rem] font-semibold">
                  <Link href={`/np/${province.slug}/`}>{province.name_en}</Link>
                  {province.name_ne && (
                    <span className="text-ink-faint ne ml-2 text-[14px] font-normal">
                      {province.name_ne}
                    </span>
                  )}
                </h3>
                {population && (
                  <span className="text-ink tabular text-[15px] font-medium">
                    {formatNumber(population)}
                  </span>
                )}
              </div>
              <p className="text-ink-faint mt-0.5 text-[12px]">
                {districts.length} districts ·{" "}
                {
                  all.filter(
                    (p) =>
                      LOCAL_TYPES.includes(p.place_type) &&
                      districts.some((d) => d.place_id === p.parent_place_id),
                  ).length
                }{" "}
                local units
              </p>

              <ul className="divide-line mt-4 divide-y text-[13px]">
                {districts.map((d) => (
                  <li key={d.place_id} className="flex justify-between gap-4 py-1.5">
                    <Link href={`/np/${province.slug}/${d.slug}/`}>{d.name_en}</Link>
                    <span className="text-ink-faint tabular">
                      {popOf.has(d.place_id)
                        ? formatNumber(popOf.get(d.place_id))
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[13px]">
                <Link href={`/np/${province.slug}/`}>
                  {province.name_en} overview →
                </Link>
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Province-level map kept as an orientation aid: it is the level at which
          labels fit inside the shapes, so it names the seven provinces the
          district map above cannot. */}
      {provinceMap.features.length > 0 && (
        <Section
          title="Provinces"
          note={`Shaded by population, ${provinceMap.period}.`}
        >
          <div className="max-w-3xl">
            <Choropleth
              features={provinceMap.features}
              unit={provinceMap.unit}
              label="Population by province"
              period={provinceMap.period}
              valueLabel="Population"
              height={420}
            />
          </div>
        </Section>
      )}

      <Section title="How places are identified">
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          Every place carries its OCHA P-code, which is hierarchical — a
          child&rsquo;s code is prefixed by its parent&rsquo;s. Twenty-two
          local-unit names are shared
          across districts, so URLs are hierarchical too:{" "}
          <code className="bg-surface-sunken rounded px-1.5 py-0.5 font-mono text-[12px]">
            /np/bagmati/kathmandu/
          </code>
          . Local units are the 753 municipalities and rural municipalities;
          protected areas are federally administered and excluded from that count.
        </p>
      </Section>

      <SourceNote tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
