import Link from "next/link";
import {
  comparisonFor,
  country,
  formatNumber,
  indicatorSlug,
  manifest,
  places,
  populationOf,
  seriesFor,
  sourcesFor,
  statusLabel,
  tablesFor,
  topics,
} from "@/lib/data";
import { Metric, RankedBars, TrendChart } from "@/components/charts";
import { Section, Sources } from "@/components/ui";

/*
  Homepage: national overview + discovery.

  Structure follows the prototype's instincts while rejecting its decoration.
  Adopted: a real hero that says what this is, headline KPIs with sparklines and
  change, trends, geographic discovery, topic discovery, a data-access route.
  Rejected: the mountain/temple artwork (tourism imagery on a statistics site),
  per-KPI coloured icons in rounded cards (decoration wearing the clothes of
  information), a search box that does not search, and an API link for an API
  that does not exist.

  Counts of tables and datasets are not national KPIs — they describe DataNepal,
  not Nepal — so they sit in the data-access section.
*/

const ATTRIBUTION: Record<string, string> = {
  population: "UNFPA",
  cpi_inflation_annual: "World Bank",
  gdp_per_capita_usd: "World Bank",
  remittances_percent_gdp: "World Bank",
};

export default async function Home() {
  const [all, np, allTopics] = await Promise.all([places(), country(), topics()]);
  const pop = np ? await populationOf(np) : null;
  const series = np ? await seriesFor(np) : [];
  const provinceCmp = await comparisonFor("population", "province");

  const find = (id: string) => series.find((s) => s.indicator.indicator_id === id);
  const inflation = find("cpi_inflation_annual");
  const gdp = find("gdp_per_capita_usd");
  const remit = find("remittances_percent_gdp");

  const localTypes = [
    "metropolitan",
    "sub_metropolitan",
    "municipality",
    "rural_municipality",
  ];
  const counts = {
    provinces: all.filter((p) => p.place_type === "province").length,
    districts: all.filter((p) => p.place_type === "district").length,
    localUnits: all.filter((p) => localTypes.includes(p.place_type)).length,
  };

  const liveTopicList = allTopics.filter(
    (t) => t.status === "live" && t.observation_count > 0,
  );
  const plannedTopics = allTopics.filter(
    (t) => !(t.status === "live" && t.observation_count > 0),
  );

  const tables = tablesFor(["observations", "places", "geography"]);

  return (
    <>
      {/* Hero. Says what this is, in both languages, without artwork. */}
      <header className="mb-14 grid gap-10 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h1 className="text-ink max-w-3xl text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
            Nepal, in data.
          </h1>
          <p className="text-ink-soft mt-3 text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight">
            नेपाल, तथ्याङ्कमा
          </p>
          <p className="text-ink-soft mt-6 max-w-xl text-[15px] leading-relaxed">
            Open, documented public data for Nepal — population, economy and geography
            for every province and district. Every figure names its publisher, its
            reference period, and when we retrieved it.
          </p>
          <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
            <Link href="/places/">Explore places</Link>
            <Link href="/topics/">Browse topics</Link>
            <Link href="/datasets/">Dataset catalogue</Link>
          </p>
        </div>

        {/* Structural facts, not decoration. This is the space the prototype
            filled with mountain artwork; a statistics site should fill it with
            statistics. */}
        <dl className="border-line divide-line divide-y self-start border-t lg:border-t-0 lg:border-l lg:pl-8">
          <div className="flex items-baseline justify-between gap-4 py-2.5 lg:pt-0">
            <dt className="text-ink-soft text-[13px]">Provinces</dt>
            <dd className="text-ink tabular text-[15px] font-medium">
              {counts.provinces}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-ink-soft text-[13px]">Districts</dt>
            <dd className="text-ink tabular text-[15px] font-medium">
              {counts.districts}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-ink-soft text-[13px]">Local governments</dt>
            <dd className="text-ink tabular text-[15px] font-medium">
              {counts.localUnits}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-ink-soft text-[13px]">Indicators</dt>
            <dd className="text-ink tabular text-[15px] font-medium">
              {liveTopicList.reduce((n, t) => n + t.indicator_count, 0)}
            </dd>
          </div>
        </dl>
      </header>

      {/* National snapshot: facts about Nepal, each routing to its indicator. */}
      <section className="border-line mb-16 border-y py-10">
        <h2 className="text-label text-ink-faint mb-8 uppercase">Nepal today</h2>
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {pop && (
            <Metric
              label="Population"
              value={pop.total}
              period={String(pop.period)}
              status={statusLabel(pop.status)}
              attribution={ATTRIBUTION.population}
              href={`/indicators/${indicatorSlug("population")}/`}
            />
          )}
          {inflation?.latest && (
            <Metric
              label="Inflation"
              value={inflation.latest.value}
              unit={inflation.unit}
              period={String(inflation.latest.year)}
              attribution={ATTRIBUTION.cpi_inflation_annual}
              series={inflation.points.slice(-25)}
              href={`/indicators/${indicatorSlug("cpi_inflation_annual")}/`}
            />
          )}
          {gdp?.latest && (
            <Metric
              label="GDP per capita"
              value={gdp.latest.value}
              unit={gdp.unit}
              period={String(gdp.latest.year)}
              attribution={ATTRIBUTION.gdp_per_capita_usd}
              series={gdp.points.slice(-25)}
              href={`/indicators/${indicatorSlug("gdp_per_capita_usd")}/`}
              note="Current US dollars"
            />
          )}
          {remit?.latest && (
            <Metric
              label="Remittances"
              value={remit.latest.value}
              unit={remit.unit}
              period={String(remit.latest.year)}
              attribution={ATTRIBUTION.remittances_percent_gdp}
              series={remit.points}
              href={`/indicators/${indicatorSlug("remittances_percent_gdp")}/`}
              note="Share of GDP"
            />
          )}
        </div>
      </section>

      {/* Trends. Only where a real long series exists. */}
      {(inflation || gdp) && (
        <Section
          title="Long-run trends"
          note="Compiled by the World Bank from Nepali official statistics."
        >
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            {[inflation, gdp].filter(Boolean).map((s) => (
              <div key={s!.indicator.indicator_id}>
                <h3 className="text-[14px] font-medium">
                  <Link
                    href={`/indicators/${indicatorSlug(s!.indicator.indicator_id)}/`}
                  >
                    {s!.indicator.name_en}
                  </Link>
                </h3>
                <p className="text-ink-faint mt-0.5 mb-4 text-[12px]">
                  {s!.unit?.name_en} · {s!.points[0].year}–{s!.latest!.year}
                </p>
                <TrendChart
                  points={s!.points}
                  unit={s!.unit}
                  label={s!.indicator.name_en}
                />
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Geographic discovery. Ranked bars, not a table. No map: we have no
          boundary geometry yet, and inventing one would be worse than omitting it. */}
      {provinceCmp.rows.length > 0 && (
        <Section
          title="Explore Nepal"
          note={`${counts.provinces} provinces · ${counts.districts} districts · ${counts.localUnits} local units. Provinces by population, ${provinceCmp.period}.`}
        >
          <RankedBars
            label={`Provinces by population, ${provinceCmp.period}`}
            valueLabel="Population"
            unit={provinceCmp.unit}
            rows={provinceCmp.rows.map((r) => ({
              name: r.place.name_en,
              nameNe: r.place.name_ne,
              href: `/np/${r.place.slug}/`,
              value: r.value,
            }))}
          />
          <p className="mt-5 text-[13px]">
            <Link href="/places/">All places →</Link>
          </p>
        </Section>
      )}

      {/* Topic discovery. Live topics link; planned ones are named as planned
          rather than rendered as empty pages. */}
      <Section title="Explore by topic">
        <ul className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {liveTopicList.map((t) => (
            <li key={t.topic_id}>
              <Link href={`/topics/${t.slug}/`} className="text-[15px] font-medium">
                {t.name_en}
              </Link>
              {t.name_ne && (
                <div className="text-ink-soft text-[13px]">{t.name_ne}</div>
              )}
              <div className="text-ink-faint tabular mt-0.5 text-[12px]">
                {t.indicator_count} indicator{t.indicator_count === 1 ? "" : "s"} ·{" "}
                {formatNumber(t.observation_count)} observations
              </div>
            </li>
          ))}
        </ul>

        <div className="border-line mt-8 border-t pt-6">
          <h3 className="text-label text-ink-faint mb-3 uppercase">Planned coverage</h3>
          <p className="text-ink-soft text-[13px]">
            {plannedTopics.map((t) => t.name_en).join(" · ")}
          </p>
          <p className="text-ink-faint mt-2 text-[12px]">
            No data published yet, so these have no pages.
          </p>
        </div>
      </Section>

      <Section
        title="Data access"
        note="Everything here is downloadable, documented, and traceable to its publisher."
      >
        <p className="text-ink-soft max-w-2xl text-[14px]">
          {manifest().table_count} tables from {manifest().sources.length} source
          datasets, in Parquet and JSON, with a full revision history. Browse the{" "}
          <Link href="/datasets/">dataset catalogue</Link> or take{" "}
          <a href="/data/manifest.json" download>
            manifest.json
          </a>{" "}
          for a machine-readable index.
        </p>
      </Section>

      <Sources tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
