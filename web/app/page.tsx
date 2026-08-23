import Link from "next/link";
import {
  country,
  datasetsFor,
  districtsOf,
  formatNumber,
  manifest,
  places,
  populationOf,
  provinces,
} from "@/lib/data";
import { Cell, DataTable, Row, Section, Sources, Tile, TileRow } from "@/components/ui";

export default async function Home() {
  const all = await places();
  const np = await country();
  const pop = np ? await populationOf(np) : null;
  const provs = await provinces();

  const rows = await Promise.all(
    provs.map(async (p) => ({
      place: p,
      pop: await populationOf(p),
      districts: (await districtsOf(p.place_pcode)).length,
    })),
  );
  rows.sort((a, b) => (b.pop?.total ?? 0) - (a.pop?.total ?? 0));

  const counts = {
    provinces: all.filter((p) => p.admin_level === 1).length,
    districts: all.filter((p) => p.admin_level === 2).length,
    localUnits: all.filter((p) => p.admin_level === 3).length,
  };

  return (
    <>
      <header className="border-line mb-10 border-b pb-10">
        <h1 className="text-display text-ink max-w-2xl font-semibold">
          Nepal, in data.
        </h1>
        <p className="text-title text-ink-soft mt-2 font-normal">नेपाल, तथ्याङ्कमा</p>
        <p className="text-ink-soft mt-5 max-w-xl text-[15px]">
          Open, documented statistics for every province and district in Nepal.
          Conformed to one geographic spine, and every figure traceable to its source.
        </p>
      </header>

      {/* Real counts only. Placeholder figures on a data platform are
          self-discrediting, so nothing appears here without data behind it. */}
      <TileRow>
        {pop && (
          <Tile
            label="Population"
            value={formatNumber(pop.total)}
            sub={`${pop.period} projection`}
          />
        )}
        <Tile label="Provinces" value={String(counts.provinces)} />
        <Tile label="Districts" value={String(counts.districts)} />
        <Tile label="Local units" value={String(counts.localUnits)} />
        <Tile
          label="Datasets"
          value={String(manifest().dataset_count)}
          sub="published"
        />
        {pop?.workingAgeShare != null && (
          <Tile
            label="Working age"
            value={`${(pop.workingAgeShare * 100).toFixed(0)}%`}
            sub="aged 15–64"
          />
        )}
      </TileRow>

      <Section
        title="Provinces"
        note="Ordered by population. Follow a province to its districts."
      >
        <DataTable
          columns={[
            { label: "Province" },
            { label: "नेपाली" },
            { label: "Population", numeric: true },
            { label: "Districts", numeric: true },
            { label: "Area km²", numeric: true },
            { label: "Density", numeric: true },
          ]}
        >
          {rows.map(({ place, pop: p, districts }) => (
            <Row key={place.place_pcode}>
              <Cell strong>
                <Link href={`/np/${place.slug}/`}>{place.name_en}</Link>
              </Cell>
              <Cell>{place.name_ne ?? "—"}</Cell>
              <Cell numeric strong>
                {formatNumber(p?.total)}
              </Cell>
              <Cell numeric>{districts}</Cell>
              <Cell numeric>{formatNumber(place.area_sqkm)}</Cell>
              <Cell numeric>{formatNumber(p?.density)}</Cell>
            </Row>
          ))}
        </DataTable>
      </Section>

      <Sources datasets={datasetsFor(["observations", "places", "geography"])} />
    </>
  );
}
