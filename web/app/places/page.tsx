import type { Metadata } from "next";
import Link from "next/link";
import {
  comparisonFor,
  districtsOf,
  formatNumber,
  places,
  provinces,
} from "@/lib/data";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Places",
  description:
    "Every province, district and local unit in Nepal, with population where published.",
};

/*
  Places index: geographic discovery.

  Provinces lead, each with its districts listed beneath. Local units are
  counted but not listed — 753 links on one page is a directory, not
  discovery, and they have no statistics of their own yet.
*/

export default async function PlacesIndex() {
  const [all, provs, cmp] = await Promise.all([
    places(),
    provinces(),
    comparisonFor("population", "province"),
  ]);
  const popOf = new Map(cmp.rows.map((r) => [r.place.place_id, r.value]));

  const grouped = await Promise.all(
    provs.map(async (p) => ({
      province: p,
      districts: await districtsOf(p.place_id),
      population: popOf.get(p.place_id),
    })),
  );
  grouped.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  const localCount = all.filter((p) =>
    ["metropolitan", "sub_metropolitan", "municipality", "rural_municipality"].includes(
      p.place_type,
    ),
  ).length;

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Places" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Places"
        native="स्थानहरू"
        meta={`7 provinces · 77 districts · ${localCount} local units`}
      />

      {grouped.map(({ province, districts, population }) => (
        <Section
          key={province.place_id}
          title={province.name_en}
          note={
            population
              ? `${formatNumber(population)} people · ${districts.length} districts${
                  province.name_ne ? ` · ${province.name_ne}` : ""
                }`
              : `${districts.length} districts`
          }
        >
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3 lg:grid-cols-4">
            {districts.map((d) => (
              <li key={d.place_id}>
                <Link href={`/np/${province.slug}/${d.slug}/`}>{d.name_en}</Link>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px]">
            <Link href={`/np/${province.slug}/`}>
              {province.name_en} Province overview →
            </Link>
          </p>
        </Section>
      ))}
    </>
  );
}
