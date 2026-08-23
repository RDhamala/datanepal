import type { Metadata } from "next";
import Link from "next/link";
import {
  country,
  formatNumber,
  formatWithUnit,
  indicatorSlug,
  indicatorsOfTopic,
  populationOf,
  seriesFor,
  statusLabel,
  topics,
  type Topic,
} from "@/lib/data";
import { Sparkline } from "@/components/charts";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Topics",
  description: "Subject areas covered by DataNepal, and those planned.",
};

/*
  Topics index: a discovery surface, not a table of contents.

  The old version listed topic names with observation counts. A reader browsing
  topics wants to know what is *in* one before opening it, so each live topic now
  leads with a real headline figure from its own data, its indicator list, and a
  trend where a long series exists. "4 indicators · 191 observations" describes
  our warehouse; "Inflation 2.7%, 2025" describes Nepal.

  Planned topics stay listed and stay clearly planned. Naming the roadmap is
  more useful than hiding it, and far better than a page of empty topic cards.
*/

/** The figure that best represents a topic at a glance. */
const HEADLINE: Record<string, string> = {
  population: "population",
  economy: "cpi_inflation_annual",
};

/**
 * A headline figure for a topic card.
 *
 * `seriesFor` only returns undimensioned observations, so population — which is
 * stored as an age × sex cube — is invisible to it. Reading the population total
 * from `populationOf` is not a special case bolted on; it is the difference
 * between a cube and a scalar series, and the demographics topic is exactly the
 * one whose headline needs the cube.
 */
type Headline = {
  name: string;
  value: string;
  period: string;
  note: string;
  points: { year: number; value: number }[];
};

export default async function TopicsIndex() {
  const [all, np] = await Promise.all([topics(), country()]);
  const live = all.filter((t) => t.status === "live" && t.observation_count > 0);
  const planned = all.filter((t) => !(t.status === "live" && t.observation_count > 0));
  const series = np ? await seriesFor(np) : [];
  const pop = np ? await populationOf(np) : null;

  const detail = await Promise.all(
    live.map(async (t: Topic) => {
      const inds = await indicatorsOfTopic(t.topic_id);
      const headlineId = HEADLINE[t.slug] ?? inds[0]?.indicator_id;

      let headline: Headline | null = null;
      if (headlineId === "population" && pop) {
        const unit = inds.find((i) => i.indicator_id === "population");
        headline = {
          name: unit?.name_en ?? "Population",
          value: formatNumber(pop.total),
          period: String(pop.period),
          note: statusLabel(pop.status) ?? "",
          points: [],
        };
      } else {
        const s = series.find((x) => x.indicator.indicator_id === headlineId);
        if (s?.latest) {
          headline = {
            name: s.indicator.name_en,
            value: formatWithUnit(s.latest.value, s.unit),
            period: String(s.latest.year),
            note: `${s.points.length} years of data`,
            points: s.points,
          };
        }
      }

      return { topic: t, indicators: inds, headline };
    }),
  );

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Topics" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Topics"
        native="विषयहरू"
        meta={`${live.length} topics with published data · ${planned.length} planned`}
      />

      <div className="mb-16 grid gap-x-12 gap-y-12 lg:grid-cols-2">
        {detail.map(({ topic, indicators, headline }) => (
          <section key={topic.topic_id} className="border-line border-t pt-6">
            <h2 className="text-[1.25rem] leading-tight font-semibold tracking-[-0.02em]">
              <Link href={`/topics/${topic.slug}/`}>{topic.name_en}</Link>
            </h2>
            {topic.name_ne && (
              <p className="text-ink-soft ne mt-0.5 text-[15px]">{topic.name_ne}</p>
            )}
            {topic.description && (
              <p className="text-ink-soft mt-3 max-w-prose text-[13px] leading-relaxed">
                {topic.description}
              </p>
            )}

            {/* A figure from the topic's own data, so the card says something
                about Nepal rather than about our row counts. */}
            {headline && (
              <div className="border-line mt-5 flex items-end justify-between gap-6 border-t pt-4">
                <div>
                  <div className="text-label text-ink-faint uppercase">
                    {headline.name}
                  </div>
                  <div className="text-ink tabular mt-1.5 text-[1.75rem] leading-none font-semibold tracking-[-0.03em]">
                    {headline.value}
                  </div>
                  <div className="text-ink-faint mt-1.5 text-[12px]">
                    {headline.period}
                    {headline.note && ` · ${headline.note}`}
                  </div>
                </div>
                {headline.points.length >= 3 && (
                  <Sparkline points={headline.points.slice(-30)} />
                )}
              </div>
            )}

            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
              {indicators.map((i) => (
                <li key={i.indicator_id}>
                  <Link href={`/indicators/${indicatorSlug(i.indicator_id)}/`}>
                    {i.name_en}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-ink-faint tabular mt-4 text-[12px]">
              {indicators.length} indicator{indicators.length === 1 ? "" : "s"} ·{" "}
              {formatNumber(topic.observation_count)} observations ·{" "}
              <Link href={`/topics/${topic.slug}/`}>Open topic →</Link>
            </p>
          </section>
        ))}
      </div>

      <Section
        title="Planned coverage"
        note="Subject areas we intend to cover. No data published yet, so these have no pages."
      >
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((t) => (
            <li key={t.topic_id} className="text-[14px]">
              <span className="text-ink-soft">{t.name_en}</span>
              {t.name_ne && (
                <span className="text-ink-faint ne text-[13px]"> · {t.name_ne}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
