import Link from "next/link";
import {
  geographyScale,
  nationalSnapshot,
  nationalTrends,
  provinceOverview,
  recentUpdates,
  topicCards,
} from "@/lib/editorial";
import { Figure, ROLE, Section, StatRow } from "@/components/editorial/system";
import { GeoExplorer } from "@/components/editorial/GeoExplorer";
import {
  coverageSentence,
  figureText,
  SourceNote,
} from "@/components/editorial/format";
import { TrendChart } from "@/components/charts";
import { Search } from "@/components/Search";

/*
  Homepage.

  Five sections in an order that argues something: here is the country now,
  here is how it divides, here is every domain we hold, here is what has moved,
  here is how to take the data away. The previous homepage was nine sections of
  equal weight with no order, so a reader could not tell when they had finished.

  The geography section is a linked map and ranking -- pointing at either
  highlights both -- which is the one interaction a static publication layout
  cannot offer and the one a reader looking for their own place actually needs.

  Serif is for the title, the section headings and figures that stand alone.
  Everything dense or columnar is sans with `.tabular`. See
  components/editorial/system.tsx for why that rule is the way round it is.
*/

export default async function Home() {
  const [snapshot, trends, topics, scale, updates, provinceView] = await Promise.all([
    nationalSnapshot(),
    nationalTrends(),
    topicCards(),
    geographyScale(),
    recentUpdates(3),
    provinceOverview({ maxWidth: 840, maxHeight: 520 }),
  ]);

  const shownTrends = [
    "gdp_per_capita_usd",
    "life_expectancy_at_birth",
    "internet_users_pct",
  ]
    .map((id) => trends.find((t) => t.indicatorId === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="pb-9">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-14">
          <div>
            <h1
              className="text-ink text-[clamp(2.5rem,1.9rem+2.8vw,3.75rem)] leading-[0.95] font-semibold tracking-[-0.04em]"
              style={ROLE.display}
            >
              Nepal, in data.
            </h1>
            {/*
              The Nepali is a second line of the title, not a grey subtitle.
              On a bilingual national platform, setting one language as chrome
              for the other is a statement, and not the one we want to make.
            */}
            <p
              className="text-brand ne mt-2 text-[clamp(1.375rem,1.05rem+1.3vw,1.875rem)] leading-tight font-medium"
              lang="ne"
              style={{ fontFamily: "var(--font-devanagari)" }}
            >
              नेपाल, तथ्याङ्कमा
            </p>
            <p className="text-ink-soft mt-4 max-w-[52ch] text-[15px] leading-relaxed">
              Open, documented public data for Nepal, with selected indicators available
              down to province, district, and local-government level.
            </p>
            <div className="mt-6 max-w-[32rem]">
              <Search
                size="large"
                placeholder="Search places, indicators, datasets…"
                examples={["Dhading", "literacy", "inflation", "Bagmati"]}
              />
            </div>
          </div>

          {/*
            Geographic scale as the frame the data sits in, not as four more
            statistics. An indicator count is a fact about this platform, not
            about Nepal, and putting it beside inflation invites reading it as
            one -- so it goes below, quietly.
          */}
          <aside className="lg:pt-3">
            <p
              className="text-ink-faint text-[11px] uppercase"
              style={{ letterSpacing: "0.07em" }}
            >
              The country, administratively
            </p>
            <dl className="divide-line border-line mt-2 divide-y border-t">
              {[
                [scale.provinces, "Provinces"],
                [scale.districts, "Districts"],
                [scale.localGovernments, "Local governments"],
              ].map(([n, label]) => (
                <div key={String(label)} className="flex items-baseline gap-4 py-2">
                  <dt
                    className="text-ink tabular w-14 text-[20px] leading-none font-semibold"
                    style={ROLE.leadFigure}
                  >
                    {n as number}
                  </dt>
                  <dd className="text-ink-soft text-[13px]">
                    <Link href="/places/">{label as string}</Link>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-ink-faint mt-3 max-w-[34ch] text-[11px] leading-relaxed">
              {coverageSentence(scale.subNationalIndicators, scale.indicators)}{" "}
              <Link href="/indicators/">What is published, and how deep</Link>
            </p>
          </aside>
        </div>
      </section>

      {/* -------------------------------------------- 01 national snapshot */}
      <Section
        contained={false}
        n={1}
        title="Nepal today"
        intro="Current national figures, each with its publisher and reference period."
        action={{ href: "/indicators/", label: "All indicators" }}
      >
        <StatRow figures={snapshot} />
      </Section>

      {/* ------------------------------------------------- 02 explore Nepal */}
      <Section
        contained={false}
        n={2}
        title="Explore Nepal"
        titleNe="नेपाल अन्वेषण"
        action={{ href: "/places/", label: "Browse all places" }}
      >
        {provinceView.map && (
          <GeoExplorer
            features={provinceView.map.features}
            metrics={provinceView.map.metrics}
            rows={provinceView.rows.map((r) => ({
              placeId: r.placeId,
              name: r.name,
              nameNe: r.nameNe,
              href: `/np/${r.slug}/`,
            }))}
            width={provinceView.map.width}
            height={provinceView.map.height}
            title="Nepal by province"
            definition="Point at a province on the map or in the ranking to highlight it in both. Each links to its own profile; switch the measure above."
            source={
              <SourceNote
                source={
                  snapshot.find((f) => f.indicatorId === "population")?.source ?? null
                }
              />
            }
          />
        )}
      </Section>

      {/* ------------------------------------------------------ 03 domains */}
      <Section
        contained={false}
        n={3}
        title={`${topics.length} domains`}
        intro="Every topic here holds published indicators. Tourism and Geography hold none yet, so they are not listed."
        action={{ href: "/indicators/", label: "Indicator index" }}
      >
        <ul className="divide-line border-line grid divide-y border-t sm:grid-cols-2 sm:gap-x-10">
          {topics.map((t) => (
            <li key={t.id} className="flex items-baseline justify-between gap-4 py-3">
              <span className="min-w-0">
                <Link
                  href={`/topics/${t.slug}/`}
                  className="text-ink text-[14px] font-medium no-underline hover:underline"
                >
                  {t.name}
                </Link>
                {t.nameNe && (
                  <span className="text-ink-faint ne ml-2 text-[11px]" lang="ne">
                    {t.nameNe}
                  </span>
                )}
                {t.description && (
                  <span className="text-ink-faint mt-0.5 block max-w-[38ch] text-[11.5px] leading-snug">
                    {t.description}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                {t.headline ? (
                  <>
                    <span className="text-ink tabular text-[14px] font-semibold">
                      {figureText(t.headline)}
                    </span>
                    <span className="text-ink-faint ml-1.5 text-[11px]">
                      {t.headline.period}
                    </span>
                  </>
                ) : (
                  /* Elections is dimensioned by party and has no national
                     total: the sum of seats is the size of the house, not a
                     fact about the country. */
                  <span className="text-ink-faint text-[11px]">
                    {t.indicatorCount} indicators
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------- 04 trends */}
      <Section
        contained={false}
        n={4}
        title="What has changed"
        intro="Income per head has roughly tripled since 2000."
        action={{ href: "/indicators/", label: "Every published series" }}
      >
        <div className="grid gap-8 md:grid-cols-3">
          {shownTrends.map((f) => (
            <Figure
              key={f.indicatorId}
              title={f.label}
              subtitle={`${f.points[0]?.year}–${f.points.at(-1)?.year} · now ${figureText(f)}`}
              source={<SourceNote source={f.source} />}
            >
              <TrendChart
                points={f.points.map((p) => ({
                  year: p.year,
                  value: p.value,
                  status: "actual",
                }))}
                unit={f.unit}
                label={f.label}
                height={130}
              />
            </Figure>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------- 05 updates + access */}
      <Section contained={false} n={5} title="Recent changes, and taking the data">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-12">
          {/*
            Sentences, not a warehouse table. Cadence, licence and revision
            counts belong on the dataset pages, which is where this links.
          */}
          <ul className="divide-line border-line divide-y border-t text-[13px]">
            {updates.map((u) => (
              <li
                key={u.title}
                className="flex flex-wrap items-baseline gap-x-3 py-2.5"
              >
                <span className="text-ink">{u.title}</span>
                <span className="text-ink-faint text-[11px]">{u.publisher}</span>
                <span className="text-ink-faint tabular ml-auto text-[11px]">
                  {u.when}
                </span>
              </li>
            ))}
            <li className="py-2.5">
              <Link href="/datasets/" className="text-[12px]">
                All {scale.datasets} datasets and their revision history →
              </Link>
            </li>
          </ul>

          <aside>
            <p
              className="text-ink-faint text-[11px] uppercase"
              style={{ letterSpacing: "0.07em" }}
            >
              Data access
            </p>
            <ul className="mt-2 space-y-1.5 text-[13px]">
              <li>
                <Link href="/datasets/">Browse and download datasets</Link>
              </li>
              <li>
                <Link href="/compare/">Compare any two to five places</Link>
              </li>
              <li>
                <Link href="/about/">Methodology and source policy</Link>
              </li>
            </ul>
            {/* No API link: there is no API. */}
            <p className="text-ink-faint mt-3 text-[11px] leading-relaxed">
              Parquet and CSV, with licence and retrieval date attached.
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
