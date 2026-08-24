import type { Metadata } from "next";
import Link from "next/link";
import {
  country,
  formatWithUnit,
  indicatorSlug,
  indicators,
  nationalHeadline,
  observations,
  placeProfile,
  places,
  populationOf,
  seriesFor,
  topics,
  units,
} from "@/lib/data";
import { Sparkline } from "@/components/charts";
import { Crumbs, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Indicators",
  description:
    "Every statistic published by DataNepal, with its latest value and source.",
};

/*
  Indicators index: what each statistic currently says, not what it is defined as.

  The old version was a definition list — name, unit, definition text. That is
  reference documentation, and it made the page useless for the actual question
  a visitor arrives with: what is the number, for when, and where is it from.

  So each row now carries the latest national value, its reference period, a
  trend where a series exists, the geographic depth available, and the publisher.
  The definition stays, below, because it still matters — it just is not the
  headline.
*/

/** Attribution per indicator. Publisher, never the acquisition path. */
const PUBLISHER: Record<string, string> = {
  population: "UNFPA",
  cpi_inflation_annual: "World Bank",
  gdp_per_capita_usd: "World Bank",
  remittances_percent_gdp: "World Bank",
  remittances_received_usd: "World Bank",
  population_density: "UNFPA / OCHA",
};

const LOCAL_TYPES = new Set([
  "metropolitan",
  "sub_metropolitan",
  "municipality",
  "rural_municipality",
]);

const GRAIN_LABEL: Record<string, string> = {
  country: "National",
  province: "To province",
  district: "To district",
  metropolitan: "To local unit",
  sub_metropolitan: "To local unit",
  municipality: "To local unit",
  rural_municipality: "To local unit",
};

export default async function IndicatorsIndex() {
  const [inds, allTopics, us, np, obs, all] = await Promise.all([
    indicators(),
    topics(),
    units(),
    country(),
    observations(),
    places(),
  ]);
  const unitOf = (id: string) => us.find((u) => u.unit_id === id);
  const series = np ? await seriesFor(np) : [];
  const pop = np ? await populationOf(np) : null;
  const profile = np ? await placeProfile(np) : [];

  // Deepest place type each indicator reaches. A reader comparing districts
  // needs to know which indicators actually go that far before clicking.
  // Observations carry only place_id, so this joins through places.
  const DEPTH = ["country", "province", "district", "local"];
  const typeOf = new Map(all.map((p) => [p.place_id, p.place_type]));
  const rank = (t: string) => {
    const i = DEPTH.indexOf(LOCAL_TYPES.has(t) ? "local" : t);
    return i === -1 ? 0 : i;
  };
  const depthOf = new Map<string, string>();
  for (const o of obs) {
    if (!o.place_id) continue;
    const t = typeOf.get(o.place_id);
    if (!t) continue;
    const current = depthOf.get(o.indicator_id);
    if (!current || rank(t) > rank(current)) depthOf.set(o.indicator_id, t);
  }

  const byTopic = new Map<string, typeof inds>();
  for (const i of inds) {
    byTopic.set(i.topic_id, [...(byTopic.get(i.topic_id) ?? []), i]);
  }

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Indicators" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Indicators"
        native="सूचकहरू"
        meta={`${inds.length} indicators across ${byTopic.size} topics. Values shown are national, latest available period.`}
      />

      {allTopics
        .filter((t) => byTopic.has(t.topic_id))
        .map((t) => (
          <section key={t.topic_id} className="mb-14">
            <h2 className="text-heading text-ink font-semibold">
              <Link href={`/topics/${t.slug}/`}>{t.name_en}</Link>
              {t.name_ne && (
                <span className="text-ink-faint ne ml-2 font-normal">{t.name_ne}</span>
              )}
            </h2>

            <ul className="divide-line border-line mt-4 divide-y border-t">
              {byTopic.get(t.topic_id)!.map((i) => {
                const unit = unitOf(i.default_unit_id);
                // One shared lookup for "what is this indicator's current
                // national figure" -- whether it lives in a plain series, the
                // population cube, or a dimensioned placeProfile metric. Before
                // this, only the population and plain-series cases were
                // handled here, so literacy rate, literate population,
                // population aged 5+ and households all rendered a bare dash.
                const h = nationalHeadline(i.indicator_id, { pop, series, profile, units: us });
                const value = h ? { text: formatWithUnit(h.value, h.unit), period: h.period } : null;
                const status = h?.status ?? null;

                return (
                  <li
                    key={i.indicator_id}
                    className="grid grid-cols-1 items-baseline gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
                  >
                    <div>
                      <Link
                        href={`/indicators/${indicatorSlug(i.indicator_id)}/`}
                        className="text-[15px] font-medium"
                      >
                        {i.name_en}
                      </Link>
                      {i.name_ne && (
                        <span className="text-ink-faint ne ml-2 text-[13px]">
                          {i.name_ne}
                        </span>
                      )}
                      {i.definition && (
                        <p className="text-ink-faint mt-1 max-w-prose text-[12px] leading-relaxed">
                          {i.definition}
                        </p>
                      )}
                      <p className="text-ink-faint mt-1.5 text-[11px]">
                        {unit?.name_en}
                        {" · "}
                        {GRAIN_LABEL[depthOf.get(i.indicator_id) ?? "country"] ??
                          "National"}
                        {!i.is_additive && " · not additive"}
                        {PUBLISHER[i.indicator_id] && ` · ${PUBLISHER[i.indicator_id]}`}
                      </p>
                    </div>

                    {/* Latest value, right-aligned so the column scans as a
                        column of numbers rather than as prose. */}
                    <div className="sm:text-right">
                      {value ? (
                        <>
                          <div className="text-ink tabular text-[1.25rem] leading-none font-semibold tracking-[-0.025em]">
                            {value.text}
                          </div>
                          <div className="text-ink-faint tabular mt-1 text-[11px]">
                            {value.period}
                            {status && ` ${status}`}
                          </div>
                        </>
                      ) : (
                        <span className="text-ink-faint text-[13px]">—</span>
                      )}
                    </div>

                    <div className="sm:w-33">
                      {h && h.points.length >= 3 && (
                        <Sparkline points={h.points.slice(-30)} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </>
  );
}
