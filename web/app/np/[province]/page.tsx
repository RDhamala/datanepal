import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  districtsOf,
  formatNumber,
  formatPercent,
  placeBySlug,
  populationOf,
  provinces,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { AgePyramid } from "@/components/AgePyramid";
import {
  Callout,
  Cell,
  Crumbs,
  DataTable,
  PageHeader,
  Pcode,
  Row,
  Section,
  Sources,
  Tile,
  TileRow,
} from "@/components/ui";

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
      ? `${place.name_en} Province, Nepal: population ${formatNumber(pop.total)} (${pop.period}), ${districts.length} districts, ${formatNumber(place.area_sqkm)} km².`
      : `${place.name_en} Province, Nepal.`,
  };
}

export default async function ProvincePage({ params }: { params: Promise<Params> }) {
  const { province } = await params;
  const place = await placeBySlug("province", province);
  if (!place) notFound();

  const pop = await populationOf(place);
  const districts = await Promise.all(
    (await districtsOf(place.place_id)).map(async (d) => ({
      place: d,
      pop: await populationOf(d),
    })),
  );
  districts.sort((a, b) => (b.pop?.total ?? 0) - (a.pop?.total ?? 0));

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: place.name_en }]} />

      <PageHeader
        eyebrow="Province"
        title={`${place.name_en} Province`}
        native={place.name_ne}
        meta={
          <>
            <Pcode code={place.ocha_pcode ?? place.place_id} /> · {districts.length}{" "}
            districts
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
          {pop.workingAgeShare !== null && (
            <Tile
              label="Working age"
              value={formatPercent(pop.workingAgeShare, 0)}
              sub="aged 15–64"
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

      <Section title="Districts" note="Ordered by population.">
        <DataTable
          columns={[
            { label: "District" },
            { label: "Population", numeric: true },
            { label: "Female", numeric: true },
            { label: "Male", numeric: true },
            { label: "Area km²", numeric: true },
            { label: "Density", numeric: true },
          ]}
        >
          {districts.map(({ place: d, pop: p }) => (
            <Row key={d.place_id}>
              <Cell strong>
                <Link href={`/np/${place.slug}/${d.slug}/`}>{d.name_en}</Link>
              </Cell>
              <Cell numeric strong>
                {formatNumber(p?.total)}
              </Cell>
              <Cell numeric>{formatNumber(p?.female)}</Cell>
              <Cell numeric>{formatNumber(p?.male)}</Cell>
              <Cell numeric>{formatNumber(d.area_sqkm)}</Cell>
              <Cell numeric>{formatNumber(p?.density)}</Cell>
            </Row>
          ))}
        </DataTable>
      </Section>

      <Sources
        tables={tablesFor(["observations", "places"])}
        sources={sourcesFor(tablesFor(["observations", "places"]))}
      />
    </>
  );
}
