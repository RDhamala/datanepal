import Link from "next/link";
import {
  comparisonFor,
  country,
  mapFor,
  formatCompact,
  formatNumber,
  formatWithUnit,
  indicatorSlug,
  manifest,
  places,
  populationOf,
  seriesFor,
  sourcesFor,
  statusLabel,
  tablesFor,
  topics,
  updateLog,
} from "@/lib/data";
import { Metric, RankedBars, TrendChart } from "@/components/charts";
import { Choropleth } from "@/components/Choropleth";
import { Search } from "@/components/Search";
import { Cell, DataTable, Row, Section, SourceNote } from "@/components/ui";

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
  // The census supplies the national count; UNFPA supplies the later
  // projection, which the Metric shows as context rather than as the figure.
  population: "NSO",
  cpi_inflation_annual: "World Bank",
  gdp_per_capita_usd: "World Bank",
  remittances_percent_gdp: "World Bank",
};

export default async function Home() {
  const [all, np, allTopics] = await Promise.all([places(), country(), topics()]);
  const pop = np ? await populationOf(np) : null;
  const series = np ? await seriesFor(np) : [];
  const provinceCmp = await comparisonFor("population", "province");
  const provinceMap = await mapFor("population", "province");
  const updates = await updateLog();

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

  /*
    One headline figure per topic for the previews below. Population comes from
    `populationOf` rather than `seriesFor`, because it is stored as an age x sex
    cube and undimensioned series queries cannot see it.
  */
  const topicHeadline: Record<
    string,
    { label: string; value: string; period: string } | undefined
  > = {
    population: pop
      ? {
          label: "Population",
          value: formatCompact(pop.total),
          period: `${pop.period} ${statusLabel(pop.status) ?? ""}`.trim(),
        }
      : undefined,
    economy: inflation?.latest
      ? {
          label: inflation.indicator.name_en,
          value: formatWithUnit(inflation.latest.value, inflation.unit),
          period: String(inflation.latest.year),
        }
      : undefined,
  };

  const tables = tablesFor(["observations", "places", "geography"]);

  return (
    <>
      {/* Hero. Says what this is, in both languages, without artwork. */}
      {/*
        Hero grid: fluid text column, bounded stats column.

        The earlier 1.6fr / 1fr split let the stats column grow with the
        viewport, so at 1920 it sat far right with a few hundred pixels of
        nothing between it and the prose -- the desktop-width problem the brief
        called out, reproduced inside the fix for it. A fixed-range right column
        keeps the pair together at every width.
      */}
      <header className="mb-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,19rem)] lg:gap-14">
        <div>
          <h1 className="text-ink max-w-3xl text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
            Nepal, in data.
          </h1>
          <p className="text-ink-soft mt-3 text-[clamp(1.25rem,2.5vw,1.75rem)] leading-tight">
            नेपाल, तथ्याङ्कमा
          </p>
          <p className="text-ink-soft mt-6 max-w-2xl text-[15px] leading-relaxed">
            Open, documented public data for Nepal — population, economy and geography
            for every province and district. Every figure names its publisher, its
            reference period, and when we retrieved it.
          </p>
          <div className="mt-8 max-w-2xl">
            <Search
              size="large"
              placeholder="Search places, indicators, datasets…"
              examples={["Kathmandu", "inflation", "Dhanusa", "population"]}
            />
          </div>

          <p className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
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
              /*
                A national headline is one of the few places a projection
                genuinely earns its space: the census count is the authoritative
                figure, and a reader also wants to know roughly how many people
                live in Nepal now. Both, labelled, in that order.
              */
              note={
                pop.laterEstimate
                  ? `${formatCompact(pop.laterEstimate.value)} projected for ${pop.laterEstimate.period}`
                  : undefined
              }
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

      {/* Geographic discovery. The map is the primary surface -- it answers
          "where does this differ", which ranked bars answer poorly -- with the
          ranking beside it for exact order. */}
      {provinceMap.features.length > 0 && (
        <Section
          title="Explore Nepal"
          note={`${counts.provinces} provinces · ${counts.districts} districts · ${counts.localUnits} local units. Shaded by population, ${provinceMap.period}. Select a province to open it.`}
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-12">
            <Choropleth
              features={provinceMap.features}
              unit={provinceMap.unit}
              label="Population by province"
              period={provinceMap.period}
              valueLabel="Population"
              height={460}
            />
            <div>
              <h3 className="text-label text-ink-faint mb-3 uppercase">
                By population
              </h3>
              <RankedBars
                label={`Provinces by population, ${provinceCmp.period}`}
                valueLabel="Population"
                unit={provinceCmp.unit}
                compact
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
            </div>
          </div>
        </Section>
      )}

      {/* Topic discovery. Live topics link; planned ones are named as planned
          rather than rendered as empty pages. */}
      <Section title="Explore by topic">
        {/* Each topic leads with a figure from its own data. A preview that
            reads "1 indicator · 4,590 observations" describes our warehouse;
            "Population 30.9M" describes Nepal, which is what a reader is
            deciding whether to click into. */}
        <ul className="grid grid-cols-1 gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {liveTopicList.map((t) => {
            const h = topicHeadline[t.topic_id];
            return (
              <li key={t.topic_id} className="border-line border-t pt-4">
                <Link href={`/topics/${t.slug}/`} className="text-[15px] font-medium">
                  {t.name_en}
                </Link>
                {t.name_ne && (
                  <div className="text-ink-soft ne text-[13px]">{t.name_ne}</div>
                )}
                {h && (
                  <div className="mt-3">
                    <div className="text-label text-ink-faint uppercase">{h.label}</div>
                    <div className="text-ink tabular mt-1 text-[1.5rem] leading-none font-semibold tracking-[-0.025em]">
                      {h.value}
                    </div>
                    <div className="text-ink-faint mt-1 text-[12px]">{h.period}</div>
                  </div>
                )}
                <div className="text-ink-faint tabular mt-3 text-[12px]">
                  {t.indicator_count} indicator{t.indicator_count === 1 ? "" : "s"} ·{" "}
                  {formatNumber(t.observation_count)} observations
                </div>
              </li>
            );
          })}
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

      {/* Latest data updates. Derived from the committed revision history, not
          a hand-kept changelog, so it cannot claim a refresh that did not
          happen. "Last change" is when a value was first seen or superseded —
          re-fetching an unchanged file does not make data newer, and saying it
          does is the most common way a data platform quietly misleads. */}
      <Section
        title="Latest data updates"
        note={`How current each source is, and how often its publisher revises past figures. Site data built ${updates.generated}.`}
      >
        <DataTable
          columns={[
            { label: "Source dataset" },
            { label: "Covers" },
            { label: "Last change", numeric: true },
            { label: "Publisher cadence" },
            { label: "Revised", numeric: true },
          ]}
        >
          {updates.datasets.map((u) => (
            <Row key={u.source.dataset_id}>
              <Cell strong>
                <a href={u.source.url} rel="noopener noreferrer" target="_blank">
                  {u.source.title}
                </a>
                <span className="text-ink-faint block text-[12px]">
                  {u.source.publisher} · {formatNumber(u.current)} observations
                </span>
              </Cell>
              <Cell>{u.source.time_coverage || u.source.vintage}</Cell>
              <Cell numeric>{u.lastChange}</Cell>
              <Cell>
                {u.source.update_frequency ?? "unknown"}
                {u.source.revises_published_values && (
                  <span className="text-ink-faint block text-[12px]">
                    restates past values
                  </span>
                )}
              </Cell>
              <Cell numeric>{u.revised === 0 ? "—" : formatNumber(u.revised)}</Cell>
            </Row>
          ))}
        </DataTable>
        <p className="text-ink-faint mt-4 max-w-prose text-[12px] leading-relaxed">
          {formatNumber(updates.totalCurrent)} observations currently published;{" "}
          {updates.totalRevised === 0
            ? "none revised since first publication"
            : `${formatNumber(updates.totalRevised)} revised since first publication`}
          . Superseded values are kept with the date they were replaced, so a figure
          cited from this site can always be reconstructed. Reference datasets —
          administrative boundaries and place names — hold no observations and so do not
          appear above; they are listed in full in the{" "}
          <Link href="/datasets/">dataset catalogue</Link>.
        </p>
      </Section>

      <Section
        title="Data access"
        note="Everything here is downloadable, documented, and traceable to its publisher."
      >
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          {manifest().table_count} tables from {manifest().sources.length} source
          datasets, in Parquet and JSON, with a full revision history. Browse the{" "}
          <Link href="/datasets/">dataset catalogue</Link> or take{" "}
          <a href="/data/manifest.json" download>
            manifest.json
          </a>{" "}
          for a machine-readable index.
        </p>
      </Section>

      <SourceNote tables={tables} sources={sourcesFor(tables)} />
    </>
  );
}
