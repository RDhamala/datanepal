import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  country,
  districtsOf,
  formatNumber,
  formatPercent,
  localUnitsOf,
  placeBySlug,
  populationOf,
  provinces,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import {
  Callout,
  Crumbs,
  PageHeader,
  Pcode,
  Section,
  Sources,
  Tile,
  TileRow,
} from "@/components/ui";

type Params = { province: string; district: string };

export async function generateStaticParams(): Promise<Params[]> {
  // Generated from the parent relation, not a flat slug list: 22 local-unit
  // names are shared nationally, so slugs are unique only within a parent.
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
      ? `${place.name_en} District, ${prov.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}), ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} District, ${prov.name_en} Province, Nepal.`,
  };
}

const TYPE_LABELS: Record<string, string> = {
  metropolitan: "Metropolitan city",
  sub_metropolitan: "Sub-metropolitan city",
  municipality: "Municipality",
  rural_municipality: "Rural municipality",
};

export default async function DistrictPage({ params }: { params: Promise<Params> }) {
  const { province, district } = await params;
  const prov = await placeBySlug("province", province);
  if (!prov) notFound();
  const place = await placeBySlug("district", district, prov.place_id);
  if (!place) notFound();

  const pop = await populationOf(place);
  const units = await localUnitsOf(place.place_id);

  const np = await country();
  const national = np ? await populationOf(np) : null;
  const share =
    pop && national && national.total > 0 ? pop.total / national.total : null;

  // Group local units by type: 460 rural municipalities read very differently
  // from 6 metropolitan cities, and an undifferentiated list hides that.
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

  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
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
            <Pcode code={place.ocha_pcode ?? place.place_id} /> · {units.length} local
            units
          </>
        }
      />

      {pop && (
        <TileRow>
          <Tile
            label="Population"
            value={formatNumber(pop.total)}
            sub={`${pop.period} projection`}
          />
          <Tile
            label="Female"
            value={formatNumber(pop.female)}
            sub={formatPercent(pop.femaleShare)}
            accent="series-1"
          />
          <Tile
            label="Male"
            value={formatNumber(pop.male)}
            sub={formatPercent(1 - (pop.femaleShare ?? 0))}
            accent="series-2"
          />
          <Tile label="Area" value={formatNumber(place.area_sqkm)} sub="km²" />
          {pop.density !== null && (
            <Tile label="Density" value={formatNumber(pop.density)} sub="per km²" />
          )}
          {share !== null && (
            <Tile
              label="Share of Nepal"
              value={formatPercent(share, 2)}
              sub="by population"
            />
          )}
        </TileRow>
      )}

      {pop && (
        <Callout>
          Population is a {pop.period}{" "}
          {pop.status === "projection" ? "projection" : pop.status}, not a census count.
          Nepal&rsquo;s most recent census was 2021.
        </Callout>
      )}

      {pop && pop.bands.length > 0 && (
        <Section
          title="Population by age and sex"
          note="Five-year age bands. Both sides share one scale, so bar lengths are directly comparable."
        >
          <AgePyramid bands={pop.bands} period={pop.period} />
        </Section>
      )}

      <Section
        title="Local units"
        note={`${units.length} local units. Population at this level is not yet published — the source used here reaches district level only.`}
      >
        <div className="space-y-6">
          {typeOrder.map((type) => (
            <div key={type}>
              <h3 className="text-label text-ink-faint mb-2 uppercase">
                {TYPE_LABELS[type] ?? type} · {byType.get(type)!.length}
              </h3>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {byType.get(type)!.map((u) => (
                  <li key={u.place_id} className="text-[13px]">
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
      </Section>

      <Sources
        tables={tablesFor(["observations", "places", "geography"])}
        sources={sourcesFor(tablesFor(["observations", "places", "geography"]))}
      />
    </>
  );
}
