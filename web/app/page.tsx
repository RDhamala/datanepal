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
import { figureText } from "@/components/editorial/format";
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
      <section className="pt-4 pb-14">
        {/* The stats sit next to the text, not at the far edge. A 1fr first
            column pushed them to the right margin and opened a hole in the
            middle of the hero; space at the edge reads as room, space in the
            middle reads as a mistake. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,34rem)_auto] lg:justify-start lg:gap-20">
          <div>
            <h1
              className="text-ink text-[clamp(2.75rem,2rem+3.2vw,4.25rem)] leading-[0.92] font-semibold tracking-[-0.045em]"
              style={ROLE.display}
            >
              Nepal, in data.
            </h1>
            <p
              className="text-brand ne mt-2.5 text-[clamp(1.5rem,1.1rem+1.5vw,2.125rem)] leading-tight font-medium"
              lang="ne"
              style={{ fontFamily: "var(--font-devanagari)" }}
            >
              नेपाल, तथ्याङ्कमा
            </p>
            <p className="text-ink-soft mt-5 max-w-[46ch] text-[16px] leading-relaxed">
              Open, documented public data for Nepal — down to province, district and
              local government.
            </p>
            <div className="mt-7 max-w-[34rem]">
              <Search
                size="large"
                placeholder="Search places, indicators, datasets…"
                examples={["Dhading", "literacy", "inflation", "Bagmati"]}
              />
            </div>
          </div>

          {/* Scale as three figures. Number and word sit together; the old
              version pushed them to opposite ends of a rule, which read as a
              table of contents rather than as a fact. */}
          <aside className="lg:pt-6">
            <dl className="flex gap-10 lg:flex-col lg:gap-7">
              {[
                [scale.provinces, "Provinces"],
                [scale.districts, "Districts"],
                [scale.localGovernments, "Local governments"],
              ].map(([n, label]) => (
                <div key={String(label)}>
                  <dt
                    className="text-ink tabular text-[30px] leading-none font-semibold tracking-[-0.03em]"
                    style={ROLE.leadFigure}
                  >
                    {n as number}
                  </dt>
                  <dd className="text-ink-faint mt-1.5 text-[12px]">
                    <Link
                      href="/places/"
                      className="text-ink-faint hover:text-brand no-underline transition-colors"
                    >
                      {label as string}
                    </Link>
                  </dd>
                </div>
              ))}
            </dl>
            {/* Coverage, stated rather than implied: five of 36 measures go
                below the national level. */}
            <p className="border-line text-ink-faint mt-7 border-t pt-4 text-[11.5px] leading-relaxed lg:max-w-[16rem]">
              <Link
                href="/indicators/"
                className="text-ink-faint hover:text-brand no-underline transition-colors"
              >
                {scale.indicators} indicators · {scale.subNationalIndicators} go below
                the national level <span aria-hidden="true">→</span>
              </Link>
            </p>
          </aside>
        </div>
      </section>

      {/* -------------------------------------------- 01 national snapshot */}
      <Section
        contained={false}
        n={1}
        title="Nepal today"
        action={{ href: "/indicators/", label: "All indicators" }}
      >
        <StatRow figures={snapshot} />
      </Section>

      {/* ------------------------------------------------- 02 explore Nepal */}
      <Section
        contained={false}
        tone="accent"
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
          />
        )}
      </Section>

      {/* ------------------------------------------------------ 03 domains */}
      <Section
        contained={false}
        n={3}
        title={`${topics.length} domains`}
        action={{ href: "/indicators/", label: "Indicator index" }}
      >
        <ul className="grid gap-x-8 sm:grid-cols-2">
          {topics.map((t) => (
            <li key={t.id} className="border-line border-t">
              <Link
                href={`/topics/${t.slug}/`}
                className="group hover:bg-surface-raised focus-visible:outline-accent -mx-3 flex items-baseline justify-between gap-4 rounded-lg px-3 py-3.5 no-underline transition-colors focus-visible:outline-2"
              >
                <span className="min-w-0">
                  <span className="text-ink group-hover:text-brand text-[14px] font-medium transition-colors">
                    {t.name}
                  </span>
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
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      {/* ------------------------------------------------------- 04 trends */}
      <Section
        contained={false}
        n={4}
        title="What has changed"
        action={{ href: "/indicators/", label: "Every published series" }}
      >
        <div className="grid gap-8 md:grid-cols-3">
          {shownTrends.map((f) => (
            <Figure
              key={f.indicatorId}
              title={f.label}
              subtitle={`${f.points[0]?.year}–${f.points.at(-1)?.year} · now ${figureText(f)}`}
            >
              <TrendChart
                points={f.points.map((p) => ({
                  year: p.year,
                  value: p.value,
                  status: "actual",
                }))}
                unit={f.unit}
                label={f.label}
                height={150}
              />
            </Figure>
          ))}
        </div>
        <p className="text-ink-faint mt-5 text-[11px]">World Bank · CC BY 4.0</p>
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
                <Link href="/compare/">Compare places on census measures</Link>
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
