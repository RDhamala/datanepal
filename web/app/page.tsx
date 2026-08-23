import Link from "next/link";
import {
  country,
  districtsOf,
  formatNumber,
  formatWithUnit,
  manifest,
  places,
  populationOf,
  provinces,
  seriesFor,
  sourcesFor,
  tablesFor,
} from "@/lib/data";
import { Cell, DataTable, Row, Section, Sources, Tile, TileRow } from "@/components/ui";

export default async function Home() {
  const all = await places();
  const np = await country();
  const pop = np ? await populationOf(np) : null;
  const series = np ? await seriesFor(np) : [];
  const provs = await provinces();

  const rows = await Promise.all(
    provs.map(async (p) => ({
      place: p,
      pop: await populationOf(p),
      districts: (await districtsOf(p.place_id)).length,
    })),
  );
  rows.sort((a, b) => (b.pop?.total ?? 0) - (a.pop?.total ?? 0));

  const localTypes = new Set([
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ]);
  const counts = {
    provinces: all.filter((p) => p.place_type === "province").length,
    districts: all.filter((p) => p.place_type === "district").length,
    localUnits: all.filter((p) => localTypes.has(p.place_type)).length,
  };

  const tables = tablesFor(["observations", "places", "geography"]);

  return (
    <>
      <header className="border-line mb-10 border-b pb-10">
        <h1 className="text-display text-ink max-w-2xl font-semibold">
          Nepal, in data.
        </h1>
        <p className="text-title text-ink-soft mt-2 font-normal">नेपाल, तथ्याङ्कमा</p>
        <p className="text-ink-soft mt-5 max-w-xl text-[15px]">
          Open, documented statistics for Nepal. Conformed to one geographic spine, with
          every figure traceable to its source.
        </p>
      </header>

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
          value={String(manifest().sources.length)}
          sub="sources"
        />
        <Tile label="Tables" value={String(manifest().table_count)} sub="published" />
      </TileRow>

      {series.length > 0 && (
        <Section
          title="National indicators"
          note="Annual series. Latest available year for each."
        >
          <DataTable
            columns={[
              { label: "Indicator" },
              { label: "Latest", numeric: true },
              { label: "Year", numeric: true },
              { label: "From", numeric: true },
              { label: "Points", numeric: true },
            ]}
          >
            {series.map((s) => (
              <Row key={s.indicator.indicator_id}>
                <Cell strong>{s.indicator.name_en}</Cell>
                <Cell numeric strong>
                  {s.latest ? formatWithUnit(s.latest.value, s.unit) : "—"}
                </Cell>
                <Cell numeric>{s.latest?.year ?? "—"}</Cell>
                <Cell numeric>{s.points[0]?.year ?? "—"}</Cell>
                <Cell numeric>{s.points.length}</Cell>
              </Row>
            ))}
          </DataTable>
          <p className="text-ink-faint mt-3 text-[12px]">
            Rates and per-capita figures are not additive across places. See the{" "}
            <a href="/data/indicators.parquet" download>
              indicators
            </a>{" "}
            table for each indicator&rsquo;s unit and additivity.
          </p>
        </Section>
      )}

      <Section title="Provinces" note="Ordered by population.">
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
            <Row key={place.place_id}>
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

      <Sources tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
