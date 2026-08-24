import Link from "next/link";
import {
  formatNumber,
  formatWithUnit,
  indicatorSlug,
  statusLabel,
  type ProfileTopic,
} from "@/lib/data";
import { AnchoredSection } from "@/components/ui";

/*
  The cross-topic place profile.

  One component renders every topic a place has data for, driven entirely by
  what is in the observation table. It knows nothing about censuses, literacy or
  population — it reads indicators, units, dimensions and topics. Adding a
  domain to the warehouse makes a new section appear here on every place that
  has it, with no change to this file. That is the property the canonical model
  was designed to buy, and this is where it gets spent.

  Two presentational decisions worth stating:

  The sex split is shown inline under the headline rather than as its own chart,
  because on a profile the question is "how large is the gap" and two numbers
  answer it faster than a chart does. Where the gap matters it is stated in
  words — Nepal's literacy gender gap is around eight points nationally and it
  should not take arithmetic to see.

  A rate is never shown without its base. `literacy_rate` sits beside
  `population_5plus` and `literate_population` precisely so a reader can check
  it and an aggregator can recompute it. Publishing 90.5% alone would be
  publishing a claim rather than data.
*/

/*
  Warn when one section mixes reference periods.

  This is not pedantry. A district shows households from the 2021 census beside
  population from the 2023 projection, both correctly labelled, and a reader who
  divides one by the other gets 4.0 people per household instead of 3.75. Each
  figure is right; the ratio is not. Labelling each row was not enough, because
  the invitation to divide comes from them sitting next to each other.

  So the section says so once, in words, rather than relying on a reader
  noticing two small grey dates.
*/
function periodNote(
  metrics: { period: number; status: string; periodType: string }[],
): string | null {
  const periods = [...new Set(metrics.map((m) => m.period))].sort();
  if (periods.length < 2) return null;
  const described = periods
    .map((year) => {
      const sample = metrics.find((m) => m.period === year)!;
      const kind =
        sample.periodType === "instant"
          ? "census"
          : (statusLabel(sample.status) ?? "estimate");
      return `${year} ${kind}`;
    })
    .join(" and ");
  return `Figures in this section come from different reference periods — ${described}. Each is correct for its own date; ratios taken across them are not.`;
}

/** Percentage-point gap between two sexes, where both are present. */
function sexGap(bySex: { sex: string; value: number }[]): string | null {
  const male = bySex.find((s) => s.sex === "male")?.value;
  const female = bySex.find((s) => s.sex === "female")?.value;
  if (male === undefined || female === undefined) return null;
  const gap = Math.abs(male - female);
  if (gap < 0.05) return null;
  const higher = male > female ? "men" : "women";
  return `${gap.toFixed(1)} points higher for ${higher}`;
}

export function PlaceProfile({
  profile,
  placeName,
}: {
  profile: ProfileTopic[];
  placeName: string;
}) {
  if (!profile.length) return null;

  return (
    <>
      {profile.map(({ topic, metrics }) => (
        <AnchoredSection
          key={topic.topic_id}
          id={topic.slug}
          title={topic.name_en}
          note={
            <>
              {topic.description}{" "}
              <Link href={`/topics/${topic.slug}/`}>
                All {topic.name_en} indicators →
              </Link>
            </>
          }
        >
          <dl className="divide-line border-line divide-y border-t">
            {metrics.map((m) => {
              const isRate = m.unit?.unit_kind === "ratio";
              const gap = isRate ? sexGap(m.bySex) : null;
              return (
                <div
                  key={m.indicatorId}
                  className="grid grid-cols-1 gap-x-8 gap-y-2 py-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]"
                >
                  <div>
                    <dt className="text-ink text-[14px] font-medium">
                      <Link href={`/indicators/${indicatorSlug(m.indicatorId)}/`}>
                        {m.name}
                      </Link>
                      {m.nameNe && (
                        <span className="text-ink-faint ne ml-2 text-[13px] font-normal">
                          {m.nameNe}
                        </span>
                      )}
                    </dt>
                    {m.definition && (
                      <p className="text-ink-faint mt-1 max-w-prose text-[12px] leading-relaxed">
                        {m.definition}
                      </p>
                    )}
                    {/* Provenance, level 1: period, qualification, publisher. */}
                    <p className="text-ink-faint mt-1.5 text-[11px]">
                      {m.period}
                      {statusLabel(m.status) && ` ${statusLabel(m.status)}`}
                      {m.periodType === "instant" && " census"}
                      {!m.isAdditive && " · not additive across places"}
                    </p>
                  </div>

                  <dd className="sm:text-right">
                    <div className="text-ink tabular text-[1.5rem] leading-none font-semibold tracking-[-0.025em]">
                      {formatWithUnit(m.value, m.unit)}
                    </div>
                    {m.unit && m.unit.unit_kind !== "ratio" && (
                      <div className="text-ink-faint mt-1 text-[11px]">
                        {m.unit.name_en}
                      </div>
                    )}
                  </dd>

                  <dd className="sm:text-right">
                    {m.bySex.length > 0 ? (
                      <>
                        <div className="text-ink-soft tabular flex gap-4 text-[13px] sm:justify-end">
                          {m.bySex.map((s) => (
                            <span key={s.sex}>
                              <span className="text-ink-faint text-[11px] capitalize">
                                {s.sex}{" "}
                              </span>
                              {formatWithUnit(s.value, m.unit)}
                            </span>
                          ))}
                        </div>
                        {gap && (
                          <div className="text-ink-faint mt-1 text-[11px]">{gap}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-faint text-[12px]">—</span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>

          {/*
            Named absence. A topic that exists but holds one indicator for this
            place should say so, rather than letting a reader assume that is all
            there is to know about it.
          */}
          {periodNote(metrics) && (
            <p className="border-line-strong text-ink-soft mt-5 max-w-prose border-l-2 pl-3 text-[12px] leading-relaxed">
              {periodNote(metrics)}
            </p>
          )}

          <p className="text-ink-faint mt-4 text-[12px]">
            {metrics.length} indicator{metrics.length === 1 ? "" : "s"} published for{" "}
            {placeName} under {topic.name_en.toLowerCase()}.
          </p>
        </AnchoredSection>
      ))}
    </>
  );
}

/** Section links for the topics a place actually has. */
export function profileSections(
  profile: ProfileTopic[],
): { id: string; label: string }[] {
  return profile.map((p) => ({ id: p.topic.slug, label: p.topic.name_en }));
}

/** A compact strip of the most important facts, for the top of a place page. */
export function profileHeadlines(
  profile: ProfileTopic[],
  wanted: string[],
): { label: string; value: string; sub: string | null }[] {
  const all = profile.flatMap((p) => p.metrics);
  return wanted
    .map((id) => all.find((m) => m.indicatorId === id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
    .map((m) => ({
      label: m.name,
      value:
        m.unit?.unit_kind === "ratio"
          ? formatWithUnit(m.value, m.unit)
          : formatNumber(m.value),
      sub: `${m.period}${statusLabel(m.status) ? ` ${statusLabel(m.status)}` : ""}`,
    }));
}
