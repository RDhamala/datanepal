import Link from "next/link";
import {
  formatNumber,
  manifest,
  places,
  populationOf,
  provinces,
} from "@/lib/data";
import { Sources, Tile } from "@/components/Chrome";

export default function Home() {
  const all = places();
  const provs = provinces();
  const nepal = all.find((p) => p.admin_level === 0)!;
  const pop = populationOf(nepal);

  const counts = {
    provinces: all.filter((p) => p.admin_level === 1).length,
    districts: all.filter((p) => p.admin_level === 2).length,
    localUnits: all.filter((p) => p.admin_level === 3).length,
  };

  const rows = provs
    .map((p) => ({ place: p, pop: populationOf(p) }))
    .sort((a, b) => (b.pop?.total ?? 0) - (a.pop?.total ?? 0));

  return (
    <>
      <div className="page-head">
        <h1>Nepal, in data.</h1>
        <p className="native">नेपाल, तथ्याङ्कमा</p>
        <p className="meta">
          Open, documented statistics for every province and district in Nepal.
          Every figure links to its source.
        </p>
      </div>

      {/* Real counts only. Placeholder figures on a data platform are
          self-discrediting, so nothing here is shown without data behind it. */}
      <div className="tiles">
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
      </div>

      {pop && (
        <div className="caveat">
          Population figures are {pop.period} projections, not census counts.
          Nepal&rsquo;s most recent census was 2021, which counted 29,164,578
          people.
        </div>
      )}

      <section>
        <h2>Provinces</h2>
        <p className="note">
          Ordered by population. Follow a province to its districts.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Province</th>
                <th>Nepali</th>
                <th className="num">Population</th>
                <th className="num">Districts</th>
                <th className="num">Area (km²)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ place, pop: p }) => (
                <tr key={place.place_pcode}>
                  <td>
                    <Link href={`/np/${place.slug}/`}>{place.name_en}</Link>
                  </td>
                  <td>{place.name_ne ?? "—"}</td>
                  <td className="num">{formatNumber(p?.total)}</td>
                  <td className="num">
                    {
                      all.filter(
                        (d) =>
                          d.admin_level === 2 &&
                          d.parent_pcode === place.place_pcode,
                      ).length
                    }
                  </td>
                  <td className="num">{formatNumber(place.area_sqkm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Sources datasets={manifest().datasets} />
    </>
  );
}
