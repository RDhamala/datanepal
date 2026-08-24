import Link from "next/link";
import {
  comparisonFor,
  country,
  mapFor,
  formatChange,
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
  placeProfile,
  topics,
  units,
  updateLog,
} from "@/lib/data";
import { RankedBars, TrendChart } from "@/components/charts";
import { MetricStrip } from "@/components/viz/MetricStrip";
import { Choropleth } from "@/components/Choropleth";
import { Search } from "@/components/Search";
import { Section, SourceNote } from "@/components/ui";

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

  /*
    Values the strip needs, resolved once here rather than inside the markup.

    Literacy comes from placeProfile on the country rather than seriesFor,
    because seriesFor only sees undimensioned observations and literacy carries a
    sex dimension -- the same trap that made every census figure invisible when
    the selection helpers matched dimension keys literally.
  */
  const allUnits = await units();
  const personsUnit = allUnits.find((u) => u.unit_id === "persons");
  const nationalProfile = np ? await placeProfile(np) : [];
  const literacy = nationalProfile
    .flatMap((t) => t.metrics)
    .find((m) => m.indicatorId === "literacy_rate");

  const changeOf = (s: typeof inflation) =>
    s && s.points.length >= 2
      ? formatChange(
          s.points[s.points.length - 2].value,
          s.points[s.points.length - 1].value,
          s.unit,
        )
      : null;
  const inflationChange = changeOf(inflation);
  const gdpChange = changeOf(gdp);

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

      {/*
        The national snapshot, as one strip rather than four columns.

        This was four independently arranged cells -- each with its own order of
        label, value, period, source, sparkline and change -- which read as four
        widgets that happened to be adjacent. Every cell is now the same shape, so
        the eye can compare across them instead of re-learning each one.
      */}
      <section className="mb-16">
        <h2 className="text-label text-ink-faint mb-1 uppercase">Nepal today</h2>
        <MetricStrip
          metrics={[
            ...(pop
              ? [
                  {
                    label: "Population",
                    value: pop.total,
                    unit: personsUnit,
                    period: String(pop.period),
                    status: pop.status,
                    source: "NSO census",
                    href: `/indicators/${indicatorSlug("population")}/`,
                    projection: pop.laterEstimate
                      ? {
                          value: pop.laterEstimate.value,
                          period: pop.laterEstimate.period,
                        }
                      : null,
                  },
                ]
              : []),
            ...(literacy
              ? [
                  {
                    label: "Literacy rate",
                    value: literacy.value,
                    unit: literacy.unit,
                    period: String(literacy.period),
                    source: "NSO census",
                    href: `/indicators/${indicatorSlug("literacy_rate")}/`,
                    note: "population aged 5 and over",
                  },
                ]
              : []),
            ...(inflation?.latest
              ? [
                  {
                    label: "Inflation",
                    value: inflation.latest.value,
                    unit: inflation.unit,
                    period: String(inflation.latest.year),
                    source: "World Bank",
                    href: `/indicators/${indicatorSlug("cpi_inflation_annual")}/`,
                    series: inflation.points.slice(-25),
                    change: inflationChange,
                  },
                ]
              : []),
            ...(gdp?.latest
              ? [
                  {
                    label: "GDP per capita",
                    value: gdp.latest.value,
                    unit: gdp.unit,
                    period: String(gdp.latest.year),
                    source: "World Bank",
                    href: `/indicators/${indicatorSlug("gdp_per_capita_usd")}/`,
                    series: gdp.points.slice(-25),
                    change: gdpChange,
                  },
                ]
              : []),
          ]}
        />
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
                {/*
                  Indicator count, not observation count. How many things a
                  reader can look up is useful to them; how many rows are in our
                  warehouse is useful to us, and the homepage is not for us.
                */}
                <div className="text-ink-faint mt-3 text-[12px]">
                  {t.indicator_count} indicator{t.indicator_count === 1 ? "" : "s"} →
                </div>
              </li>
            );
          })}
        </ul>
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

      {/*
        Latest updates, in sentences rather than a metadata table.

        This was a five-column table of source dataset, coverage, last change,
        publisher cadence and revision count. All of it true and none of it what
        a homepage visitor wants: they want to know whether the data is current
        and roughly how often it moves. The audit trail still exists, in full, on
        the dataset catalogue -- which is where someone who wants a cadence column
        is already heading.
      */}
      <Section title="Latest updates" note={`Site data built ${updates.generated}.`}>
        <ul className="divide-line border-line max-w-3xl divide-y border-t">
          {updates.datasets.map((u) => (
            <li key={u.source.dataset_id} className="py-3">
              <p className="text-ink-soft text-[14px] leading-relaxed">
                <a href={u.source.url} rel="noopener noreferrer" target="_blank">
                  {u.source.publisher}
                </a>{" "}
                — {formatNumber(u.current)} figures covering{" "}
                {u.source.time_coverage || u.source.vintage}, last changed{" "}
                {u.lastChange}
                {u.source.update_frequency && u.source.update_frequency !== "irregular"
                  ? `, updated ${u.source.update_frequency}`
                  : ""}
                {u.revised > 0 && `, ${formatNumber(u.revised)} figures revised since`}.
              </p>
            </li>
          ))}
        </ul>
        <p className="text-ink-faint mt-4 max-w-prose text-[12px] leading-relaxed">
          {formatNumber(updates.totalCurrent)} figures published,{" "}
          {updates.totalRevised === 0
            ? "none revised since first publication"
            : `${formatNumber(updates.totalRevised)} revised`}
          . Superseded values are kept with the date they were replaced.{" "}
          <Link href="/datasets/">Full metadata and revision history →</Link>
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
