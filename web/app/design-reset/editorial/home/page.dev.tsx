import type { Metadata } from "next";
import Link from "next/link";
import {
  geographyScale,
  nationalSnapshot,
  nationalTrends,
  provinceOverview,
  recentUpdates,
  topicCards,
} from "@/lib/editorial";
import {
  Chapter,
  EditorialFigure,
  EditorialShell,
  LeadStat,
  SERIF,
  StatRow,
} from "@/components/design-reset/editorial";
import {
  coverageSentence,
  figureText,
  periodText,
  PrototypeBar,
  prototypeRobots,
  SourceNote,
} from "@/components/design-reset/shared";
import { MetricMap } from "@/components/MetricMap";
import { RankedBars, TrendChart } from "@/components/charts";
import { Search } from "@/components/Search";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Direction A — Editorial · Homepage",
  robots: prototypeRobots,
};

/*
  Direction A, homepage.

  Five chapters, in an order that argues something: here is the country now,
  here is how it divides, here is what has moved, here is every domain we hold,
  here is how to take the data away. The production homepage has nine sections
  of equal weight and no order, so a reader cannot tell when they have finished.

  Every figure is real. See lib/design-reset.ts for why there is no fallback
  when an indicator has no aggregate, and why Elections shows no headline.
*/
export default async function EditorialHome() {
  const [snapshot, trends, topics, scale, updates, provinceView] = await Promise.all([
    nationalSnapshot(),
    nationalTrends(),
    topicCards(),
    geographyScale(),
    recentUpdates(4),
    provinceOverview({ maxWidth: 420, maxHeight: 340 }),
  ]);

  const population = snapshot.find((f) => f.indicatorId === "population");
  const gdp = trends.find((f) => f.indicatorId === "gdp_per_capita_usd");
  const life = trends.find((f) => f.indicatorId === "life_expectancy_at_birth");
  const internet = trends.find((f) => f.indicatorId === "internet_users_pct");

  return (
    <EditorialShell>
      <PrototypeBar
        direction="A — Editorial Statistical Publication"
        other="/design-reset/atlas/home/"
        otherLabel="See Direction B"
      />

      {/* ----------------------------------------------------------- hero */}
      <section className="max-w-page mx-auto px-5 pt-14 pb-16 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
          <div>
            <h1
              className="text-ink text-[clamp(2.75rem,2rem+3.4vw,4.5rem)] leading-[0.95] font-semibold tracking-[-0.04em]"
              style={{ fontFamily: SERIF }}
            >
              Nepal, in data.
            </h1>
            {/*
              The Nepali is the same size and weight as a second line of the
              title, not a grey subtitle underneath it. On a bilingual national
              platform, rendering one language as chrome for the other is a
              statement, and it is not the one we want to make.
            */}
            <p
              className="text-brand ne mt-3 text-[clamp(1.5rem,1.1rem+1.6vw,2.25rem)] leading-tight font-medium"
              lang="ne"
              style={{ fontFamily: "var(--font-devanagari)" }}
            >
              नेपाल, तथ्याङ्कमा
            </p>
            <p className="text-ink-soft mt-6 max-w-[48ch] text-[16px] leading-relaxed">
              Open, documented public data for Nepal, with selected indicators available
              down to province, district, and local-government level.
            </p>

            <div className="mt-8 max-w-[34rem]">
              <Search
                size="large"
                placeholder="Search places, indicators, datasets…"
                examples={["Dhading", "literacy", "inflation", "Bagmati", "census"]}
              />
            </div>
          </div>

          {/*
            Geographic scale, as the frame the data sits in rather than as four
            more statistics. The production homepage put "36 indicators" beside
            "7 provinces", which invites reading a platform inventory as a fact
            about the country.
          */}
          <aside className="lg:pt-4">
            <p
              className="text-ink-faint text-[11px] uppercase"
              style={{ letterSpacing: "0.07em" }}
            >
              The country, administratively
            </p>
            <dl className="divide-line border-line mt-3 divide-y border-t">
              {[
                [scale.provinces, "Provinces", "/places/"],
                [scale.districts, "Districts", "/places/"],
                [scale.localGovernments, "Local governments", "/places/"],
              ].map(([n, label, href]) => (
                <div key={String(label)} className="flex items-baseline gap-4 py-3">
                  <dt
                    className="text-ink tabular w-16 text-[22px] leading-none font-semibold"
                    style={{ fontFamily: SERIF }}
                  >
                    {n as number}
                  </dt>
                  <dd className="text-ink-soft text-[14px]">
                    <Link href={href as string}>{label as string}</Link>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-ink-faint mt-4 max-w-[34ch] text-[12px] leading-relaxed">
              {coverageSentence(scale.subNationalIndicators, scale.indicators)}{" "}
              <Link href="/indicators/">What is published, and how deep</Link>
            </p>
          </aside>
        </div>
      </section>

      {/* ------------------------------------------------- 01 Nepal today */}
      <Chapter
        n={1}
        title="Nepal today"
        standfirst="Current national figures, each with its publisher and reference period."
        action={{ href: "/indicators/", label: "All indicators" }}
      >
        <StatRow figures={snapshot} />
      </Chapter>

      {/* --------------------------------------- 02 the seven provinces */}
      <Chapter
        n={2}
        title="Seven provinces"
        titleNe="सात प्रदेश"
        standfirst={
          <>
            Nepal federalised in 2015. The 2021 census is the first full enumeration of
            the structure it produced, and it put Bagmati and Madhesh within 2,266
            people of each other.
          </>
        }
        action={{ href: "/places/", label: "Browse all places" }}
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-14">
          {/*
            In this direction the map supports the ranking rather than leading
            it. A reader who wants to know which province is largest is asking a
            question a sorted list answers immediately and a choropleth answers
            slowly. Direction B inverts exactly this.
          */}
          {provinceView.map && (
            <MetricMap
              features={provinceView.map.features}
              metrics={provinceView.map.metrics}
              width={provinceView.map.width}
              height={provinceView.map.height}
              noun="provinces"
            />
          )}

          <EditorialFigure
            title="Population by province, 2021 census"
            subtitle="Resident population enumerated by the National Statistics Office. Institutional population is counted at district level, so provinces sum to the national total."
            source={<SourceNote source={population?.source ?? null} />}
            wide
          >
            <RankedBars
              label="Population by province, 2021 census"
              noun="provinces"
              valueLabel="Population"
              rows={provinceView.rows
                .filter((r) => r.value !== null)
                .map((r) => ({
                  name: r.name,
                  nameNe: r.nameNe,
                  href: `/np/${r.slug}/`,
                  value: r.value!,
                }))}
            />
          </EditorialFigure>
        </div>
      </Chapter>

      {/* ------------------------------------------- 03 long-run change */}
      <Chapter
        n={3}
        title="What has changed"
        standfirst="Income per head has roughly tripled since 2000."
        action={{ href: "/indicators/", label: "Every published series" }}
      >
        {gdp && (
          <LeadStat
            label={gdp.label}
            value={figureText(gdp)}
            period={periodText(gdp)}
            note={
              <>
                Current US dollars, not adjusted for inflation or purchasing power. The{" "}
                {gdp.points.length}-year series begins in {gdp.points[0]?.year}.
                <SourceNote source={gdp.source} className="mt-3" />
              </>
            }
          >
            <TrendChart
              points={gdp.points.map((p) => ({
                year: p.year,
                value: p.value,
                status: "actual",
              }))}
              unit={gdp.unit}
              label={`${gdp.label}, ${gdp.points[0]?.year}–${gdp.points.at(-1)?.year}`}
              height={220}
            />
          </LeadStat>
        )}

        <div className="border-line mt-14 grid gap-12 border-t pt-10 md:grid-cols-2">
          {[life, internet].filter(Boolean).map((f) => (
            <EditorialFigure
              key={f!.indicatorId}
              title={`${f!.label}, ${f!.points[0]?.year}–${f!.points.at(-1)?.year}`}
              subtitle={f!.definition ?? undefined}
              source={<SourceNote source={f!.source} />}
              wide
            >
              <TrendChart
                points={f!.points.map((p) => ({
                  year: p.year,
                  value: p.value,
                  status: "actual",
                }))}
                unit={f!.unit}
                label={f!.label}
                height={170}
              />
            </EditorialFigure>
          ))}
        </div>
      </Chapter>

      {/* ------------------------------------------------- 04 the domains */}
      <Chapter
        n={4}
        title="Ten domains"
        standfirst="Every topic here holds published indicators. Tourism and Geography hold none yet, so they are not listed."
        action={{ href: "/indicators/", label: "Indicator index" }}
      >
        <ul className="divide-line border-line divide-y border-t">
          {topics.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-1 items-baseline gap-x-8 gap-y-2 py-5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_minmax(0,11rem)]"
            >
              <div>
                <Link
                  href={`/topics/${t.slug}/`}
                  className="text-ink text-[17px] font-semibold no-underline hover:underline"
                  style={{ fontFamily: SERIF }}
                >
                  {t.name}
                </Link>
                {t.nameNe && (
                  <span className="text-ink-faint ne ml-2 text-[13px]" lang="ne">
                    {t.nameNe}
                  </span>
                )}
              </div>
              <p className="text-ink-soft max-w-[52ch] text-[13px] leading-relaxed">
                {t.description ??
                  `${t.indicatorCount} published ${t.indicatorCount === 1 ? "indicator" : "indicators"}.`}
              </p>
              <div className="sm:text-right">
                {t.headline ? (
                  <>
                    <p
                      className="text-ink tabular text-[20px] leading-none font-semibold"
                      style={{ fontFamily: SERIF }}
                    >
                      {figureText(t.headline)}
                    </p>
                    <p className="text-ink-faint mt-1 text-[11px]">
                      {t.headline.label}, {t.headline.period}
                    </p>
                  </>
                ) : (
                  /* Elections has no national total: seats by party sum to the
                     size of the house, which is not a fact about the country. */
                  <p className="text-ink-faint text-[12px]">
                    {t.indicatorCount} indicators · no single national total
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Chapter>

      {/* ---------------------------------------- 05 updates + take away */}
      <Chapter
        n={5}
        title="Recent changes, and taking the data"
        standfirst="From the committed revision history, so it cannot drift."
        action={{ href: "/datasets/", label: "All datasets" }}
      >
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <ul className="divide-line border-line divide-y border-t">
            {updates.map((u) => (
              <li key={u.title} className="flex flex-wrap items-baseline gap-x-4 py-4">
                <span className="text-ink text-[15px]">{u.title}</span>
                <span className="text-ink-faint text-[12px]">{u.publisher}</span>
                <span className="text-ink-faint tabular ml-auto text-[12px]">
                  {formatNumber(u.observations)} values · {u.when}
                </span>
              </li>
            ))}
          </ul>

          <aside>
            <p
              className="text-ink-faint text-[11px] uppercase"
              style={{ letterSpacing: "0.07em" }}
            >
              Data access
            </p>
            <p className="text-ink-soft mt-3 text-[14px] leading-relaxed">
              Every figure is downloadable, with its licence attached.
            </p>
            <ul className="mt-4 space-y-2 text-[14px]">
              <li>
                <Link href="/datasets/">Browse {scale.datasets} source datasets</Link>
              </li>
              <li>
                <Link href="/compare/">Compare any two to five places</Link>
              </li>
              <li>
                <Link href="/about/">Methodology and source policy</Link>
              </li>
            </ul>
            {/* No API link: there is no API. Advertising one that does not exist
                is the kind of claim this platform's credibility runs on. */}
          </aside>
        </div>
      </Chapter>
    </EditorialShell>
  );
}
