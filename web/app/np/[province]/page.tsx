import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  districtsOf,
  formatNumber,
  formatPercent,
  manifest,
  placeBySlug,
  populationOf,
  provinces,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { Crumbs, Sources, Tile } from "@/components/Chrome";

type Params = { province: string };

export function generateStaticParams(): Params[] {
  return provinces().map((p) => ({ province: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province } = await params;
  const place = placeBySlug(1, province);
  if (!place) return {};
  const pop = populationOf(place);
  return {
    title: `${place.name_en} Province`,
    description: pop
      ? `${place.name_en} Province, Nepal: population ${formatNumber(
          pop.total,
        )} (${pop.period}), ${districtsOf(place.place_pcode).length} districts.`
      : `${place.name_en} Province, Nepal.`,
  };
}

export default async function ProvincePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { province } = await params;
  const place = placeBySlug(1, province);
  if (!place) notFound();

  const pop = populationOf(place);
  const districts = districtsOf(place.place_pcode)
    .map((d) => ({ place: d, pop: populationOf(d) }))
    .sort((a, b) => (b.pop?.total ?? 0) - (a.pop?.total ?? 0));

  return (
    <>
      <Crumbs
        trail={[{ href: "/", label: "Nepal" }, { label: place.name_en }]}
      />

      <div className="page-head">
        <h1>{place.name_en} Province</h1>
        {place.name_ne && <p className="native">{place.name_ne}</p>}
        <p className="meta">
          Province · <code>{place.place_pcode}</code> ·{" "}
          {districts.length} districts
        </p>
      </div>

      {pop && (
        <div className="tiles">
          <Tile
            label="Population"
            value={formatNumber(pop.total)}
            sub={`${pop.period} projection`}
          />
          <Tile label="Female" value={formatNumber(pop.female)} sub={formatPercent(pop.femaleShare)} />
          <Tile label="Male" value={formatNumber(pop.male)} />
          <Tile label="Area" value={`${formatNumber(place.area_sqkm)} km²`} />
          {pop.density !== null && (
            <Tile
              label="Density"
              value={formatNumber(pop.density)}
              sub="people per km²"
            />
          )}
        </div>
      )}

      {pop && pop.bands.length > 0 && (
        <section>
          <h2>Population by age and sex</h2>
          <p className="note">
            Five-year age bands, {pop.period}. Both sides share one scale, so bar
            lengths are directly comparable.
          </p>
          <AgePyramid bands={pop.bands} formatNumber={formatNumber} />
        </section>
      )}

      <section>
        <h2>Districts</h2>
        <p className="note">Ordered by population.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>District</th>
                <th className="num">Population</th>
                <th className="num">Female</th>
                <th className="num">Male</th>
                <th className="num">Area (km²)</th>
                <th className="num">Density</th>
              </tr>
            </thead>
            <tbody>
              {districts.map(({ place: d, pop: p }) => (
                <tr key={d.place_pcode}>
                  <td>
                    <Link href={`/np/${place.slug}/${d.slug}/`}>{d.name_en}</Link>
                  </td>
                  <td className="num">{formatNumber(p?.total)}</td>
                  <td className="num">{formatNumber(p?.female)}</td>
                  <td className="num">{formatNumber(p?.male)}</td>
                  <td className="num">{formatNumber(d.area_sqkm)}</td>
                  <td className="num">{formatNumber(p?.density)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Sources datasets={manifest().datasets.filter((d) =>
        ["observations", "places"].includes(d.table),
      )} />
    </>
  );
}
