import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  districtsOf,
  formatNumber,
  formatPercent,
  localUnitsOf,
  manifest,
  placeBySlug,
  places,
  populationOf,
  provinces,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import { Crumbs, Sources, Tile } from "@/components/Chrome";

type Params = { province: string; district: string };

export function generateStaticParams(): Params[] {
  // Slugs are unique within a parent, not globally -- 22 local unit names are
  // shared nationally. Generating from the parent relation rather than a flat
  // slug list is what keeps the hierarchical URLs unambiguous.
  return provinces().flatMap((p) =>
    districtsOf(p.place_pcode).map((d) => ({
      province: p.slug,
      district: d.slug,
    })),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { province, district } = await params;
  const prov = placeBySlug(1, province);
  const place = prov && placeBySlug(2, district, prov.place_pcode);
  if (!place) return {};
  const pop = populationOf(place);
  return {
    title: `${place.name_en} District`,
    description: pop
      ? `${place.name_en} District, ${prov!.name_en} Province, Nepal: population ${formatNumber(
          pop.total,
        )} (${pop.period}).`
      : `${place.name_en} District, Nepal.`,
  };
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { province, district } = await params;
  const prov = placeBySlug(1, province);
  if (!prov) notFound();
  const place = placeBySlug(2, district, prov.place_pcode);
  if (!place) notFound();

  const pop = populationOf(place);
  const units = localUnitsOf(place.place_pcode);

  // National share, for context on the headline figure.
  const nepal = places().find((p) => p.admin_level === 0)!;
  const national = populationOf(nepal);
  const share =
    pop && national && national.total > 0 ? pop.total / national.total : null;

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: `/np/${prov.slug}/`, label: prov.name_en },
          { label: place.name_en },
        ]}
      />

      <div className="page-head">
        <h1>{place.name_en} District</h1>
        {place.name_ne && <p className="native">{place.name_ne}</p>}
        <p className="meta">
          District in {prov.name_en} Province · <code>{place.place_pcode}</code> ·{" "}
          {units.length} local units
        </p>
      </div>

      {pop && (
        <div className="tiles">
          <Tile
            label="Population"
            value={formatNumber(pop.total)}
            sub={`${pop.period} projection`}
          />
          <Tile
            label="Female"
            value={formatNumber(pop.female)}
            sub={formatPercent(pop.femaleShare)}
          />
          <Tile label="Male" value={formatNumber(pop.male)} />
          <Tile label="Area" value={`${formatNumber(place.area_sqkm)} km²`} />
          {pop.density !== null && (
            <Tile
              label="Density"
              value={formatNumber(pop.density)}
              sub="people per km²"
            />
          )}
          {share !== null && (
            <Tile
              label="Share of Nepal"
              value={formatPercent(share)}
              sub="by population"
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
        <h2>Local units</h2>
        <p className="note">
          {units.length} local units in this district. Population at this level
          is not yet available — the source used here reaches district level
          only.
        </p>
        <ul className="child-list">
          {units.map((u) => (
            <li key={u.place_pcode}>
              {u.name_en}
              {u.name_ne && <> · {u.name_ne}</>}
              <br />
              <span className="type">{u.place_type.replace(/_/g, " ")}</span>
            </li>
          ))}
        </ul>
      </section>

      <Sources
        datasets={manifest().datasets.filter((d) =>
          ["observations", "places"].includes(d.table),
        )}
      />
    </>
  );
}
