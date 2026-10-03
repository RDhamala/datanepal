import type { Metadata } from "next";
import Link from "next/link";
import {
  geographyScale,
  nationalSnapshot,
  nationalTrends,
  provinceOverview,
  recentUpdates,
  topicCards,
} from "@/lib/design-reset";
import { AtlasShell, KpiTile, Panel } from "@/components/design-reset/atlas";
import { AtlasMap } from "@/components/design-reset/AtlasMap";
import {
  coverageSentence,
  figureText,
  PrototypeBar,
  prototypeRobots,
} from "@/components/design-reset/shared";
import { TrendChart } from "@/components/charts";
import { Search } from "@/components/Search";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "Direction B — Atlas · Homepage",
  robots: prototypeRobots,
};

/* Direction B, homepage. The map is the hero and the index. */
export default async function AtlasHome() {
  const [snapshot, trends, topics, scale, updates, provinceView] = await Promise.all([
    nationalSnapshot(),
    nationalTrends(),
    topicCards(),
    geographyScale(),
    recentUpdates(4),
    provinceOverview({ maxWidth: 820, maxHeight: 520 }),
  ]);

  const gdp = trends.find((f) => f.indicatorId === "gdp_per_capita_usd");
  const life = trends.find((f) => f.indicatorId === "life_expectancy_at_birth");

  return (
    <AtlasShell>
      <PrototypeBar
        direction="B — Geographic Civic Atlas"
        other="/design-reset/editorial/home/"
        otherLabel="See Direction A"
      />

      <div className="max-w-wide mx-auto space-y-6 px-5 py-6 sm:px-8">
        {/* ------------------------------------------------- hero: the map */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="flex flex-col justify-center">
            <h1 className="text-ink text-[clamp(2.25rem,1.7rem+2.2vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.035em]">
              Nepal, in data.
            </h1>
            <p
              className="text-brand ne mt-2 text-[clamp(1.25rem,1rem+1vw,1.75rem)] leading-tight font-medium"
              lang="ne"
              style={{ fontFamily: "var(--font-devanagari)" }}
            >
              नेपाल, तथ्याङ्कमा
            </p>
            <p className="text-ink-soft mt-4 max-w-[40ch] text-[15px] leading-relaxed">
              Open, documented public data for Nepal, with selected indicators down to
              province, district, and local-government level.
            </p>

            <div className="mt-5">
              <Search
                placeholder="Search places, indicators, datasets…"
                examples={["Dhading", "literacy", "Bagmati", "inflation"]}
              />
            </div>

            <dl className="border-line mt-6 grid grid-cols-3 gap-3 border-t pt-4">
              {[
                [scale.provinces, "Provinces"],
                [scale.districts, "Districts"],
                [scale.localGovernments, "Local govts"],
              ].map(([n, label]) => (
                <div key={String(label)}>
                  <dt className="text-ink tabular text-[22px] leading-none font-semibold">
                    {n as number}
                  </dt>
                  <dd className="text-ink-faint mt-1 text-[11px]">{label as string}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Panel label="Explore" title="Every province, every measure">
            {provinceView.map && (
              <AtlasMap
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
          </Panel>
        </div>

        {/* ------------------------------------------------------- KPI strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {snapshot.map((f) => (
            <KpiTile key={f.indicatorId} figure={f} />
          ))}
        </div>

        {/* -------------------------------------------- topics + trends row */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Panel
            label="Domains"
            title={`${topics.length} with published data`}
            action={{ href: "/indicators/", label: "Indicator index" }}
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/topics/${t.slug}/`}
                    className="border-line hover:border-line-strong group flex items-baseline justify-between gap-3 rounded-md border px-3 py-2.5 no-underline"
                  >
                    <span className="min-w-0">
                      <span className="text-ink block truncate text-[14px] font-medium">
                        {t.name}
                      </span>
                      {t.nameNe && (
                        <span
                          className="text-ink-faint ne block truncate text-[11px]"
                          lang="ne"
                        >
                          {t.nameNe}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      {t.headline ? (
                        <>
                          <span className="text-ink tabular block text-[15px] font-semibold">
                            {figureText(t.headline)}
                          </span>
                          <span className="text-ink-faint block text-[10px]">
                            {t.headline.period}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint text-[11px]">
                          {t.indicatorCount} indicators
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-ink-faint mt-4 text-[11px]">
              {coverageSentence(scale.subNationalIndicators, scale.indicators)}
            </p>
          </Panel>

          <div className="space-y-6">
            {[gdp, life].filter(Boolean).map((f) => (
              <Panel
                key={f!.indicatorId}
                label={`${f!.points[0]?.year}–${f!.points.at(-1)?.year}`}
                title={f!.label}
              >
                <p className="text-ink tabular mb-3 text-[28px] leading-none font-semibold tracking-[-0.03em]">
                  {figureText(f!)}
                </p>
                <TrendChart
                  points={f!.points.map((p) => ({
                    year: p.year,
                    value: p.value,
                    status: "actual",
                  }))}
                  unit={f!.unit}
                  label={f!.label}
                  height={130}
                />
              </Panel>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------ updates + access */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <Panel
            label="Changes"
            title="Recently updated"
            action={{ href: "/datasets/", label: "All datasets" }}
          >
            <ul className="divide-line divide-y text-[13px]">
              {updates.map((u) => (
                <li
                  key={u.title}
                  className="flex flex-wrap items-baseline gap-x-3 py-2.5"
                >
                  <span className="text-ink">{u.title}</span>
                  <span className="text-ink-faint text-[11px]">{u.publisher}</span>
                  <span className="text-ink-faint tabular ml-auto text-[11px]">
                    {formatNumber(u.observations)} values · {u.when}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel label="Take it away" title="Data access">
            <ul className="space-y-2 text-[14px]">
              <li>
                <Link href="/datasets/">{scale.datasets} source datasets</Link>
              </li>
              <li>
                <Link href="/compare/">Compare two to five places</Link>
              </li>
              <li>
                <Link href="/about/">Methodology and source policy</Link>
              </li>
            </ul>
            <p className="text-ink-faint mt-4 text-[11px] leading-relaxed">
              Parquet and CSV, with licence and retrieval date attached.
            </p>
          </Panel>
        </div>
      </div>
    </AtlasShell>
  );
}
