import { DataDisclosure } from "./DataDisclosure";
import Link from "next/link";
import { formatNumber, formatWithUnit } from "@/lib/format";
import type { Benchmark as BenchmarkData, ProfileTopic } from "@/lib/data";
import { COLOR, TYPE } from "@/lib/viz";
import { Benchmark } from "./Benchmark";
import { HeadlineMetric } from "./HeadlineMetric";
import { periodNote } from "../PlaceProfile";
import { PairedBars } from "./MetricStrip";

/*
  A topic on a place page, as a visual summary rather than a stack of rows.

  What this replaces: Education on a district page was three vertical rows, each
  with a name, a definition, a value, a sex split and a provenance line. Five
  lines of text per indicator, fifteen for the topic, and a reader had to
  assemble the finding themselves -- the headline rate was the same size as the
  denominator, and nothing said whether 72% was good.

  The shape now is: one headline, the comparison that makes it mean something,
  the sex gap where the source publishes one, and the remaining indicators
  demoted to a compact row. Definitions are kept, because they matter, but behind
  a disclosure rather than competing with the numbers.

  Which indicator is the headline is not guessed. It is passed in, because only
  the caller knows that literacy rate leads Education while population leads
  Demographics -- and a component that inferred it from row order would silently
  change what a page emphasises whenever ingestion order changed.
*/

export function TopicSummary({
  topic,
  headlineId,
  benchmark,
  placeName,
  valueShownAbove = false,
}: {
  topic: ProfileTopic;
  /** Indicator to lead with. The rest become supporting values. */
  headlineId: string;
  /** Comparison against province and Nepal, where the data supports one. */
  benchmark?: BenchmarkData;
  placeName: string;
  /**
   * Suppress the headline figure, keeping its breakdown.
   *
   * For the case where the page's fact strip already carries this exact
   * number a few hundred pixels above -- a district's population appears in
   * both, and printing it twice at two sizes reads as an inconsistency a
   * reader has to check rather than as emphasis. Defaults off, so no existing
   * page changes.
   */
  valueShownAbove?: boolean;
}) {
  const headline =
    topic.metrics.find((m) => m.indicatorId === headlineId) ?? topic.metrics[0];
  if (!headline) return null;
  const supporting = topic.metrics.filter(
    (m) => m.indicatorId !== headline.indicatorId,
  );

  const female = headline.bySex.find((s) => s.sex === "female")?.value;
  const male = headline.bySex.find((s) => s.sex === "male")?.value;
  const hasGap = female !== undefined && male !== undefined;
  const isRate = headline.unit?.unit_kind === "ratio";

  return (
    <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Headline, then the sex split immediately under it: the two things a
          reader wants from a rate, in the order they want them. */}
      <div>
        <p
          className="text-label text-ink-faint uppercase"
          style={{ fontSize: TYPE.micro }}
        >
          <Link
            href={`/indicators/${headline.indicatorId.replace(/_/g, "-")}/`}
            className="text-ink-faint hover:text-ink"
          >
            {headline.name}
          </Link>
        </p>
        {/*
          The same metric component the fact strip uses, rather than a fourth
          number style. The label is rendered above as a link to the
          indicator, so this one is suppressed to avoid printing it twice.
        */}
        {!valueShownAbove && (
          <HeadlineMetric
            lead
            label=""
            value={formatWithUnit(headline.value, headline.unit)}
            period={headline.period}
            status={
              headline.status === "actual"
                ? headline.periodType === "instant"
                  ? "census"
                  : "final"
                : headline.status === "projection"
                  ? "projection"
                  : "estimate"
            }
            context={headline.isAdditive ? null : "Not additive across places."}
          />
        )}

        {hasGap && (
          <div className="mt-5">
            <p className="text-ink-soft mb-2" style={{ fontSize: TYPE.body }}>
              By sex
            </p>
            <PairedBars
              pairs={[
                { label: "Female", value: female! },
                { label: "Male", value: male!, accent: true },
              ]}
              unit={headline.unit}
            />
            <p className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
              {/* Percentage points for a rate, percent for a count. Saying "8%
                  higher" of a rate that differs by 8 points is a different and
                  wrong claim. */}
              <span style={{ color: male! > female! ? COLOR.inkSoft : COLOR.inkSoft }}>
                {isRate
                  ? `${Math.abs(male! - female!).toFixed(1)} points`
                  : formatNumber(Math.abs(male! - female!))}{" "}
                higher for {male! > female! ? "men" : "women"}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-7">
        {benchmark && <Benchmark data={benchmark} />}

        {/*
          Mixed reference periods, said once and in words.

          A section showing 2021 households beside a 2023 population is two
          correct figures whose ratio is not: 4.0 people per household instead
          of 3.75. The per-figure chips make each date visible; this makes the
          invitation to divide them explicit, which the chips alone cannot.
        */}
        {periodNote(topic.metrics) && (
          <p className="border-line-strong text-ink-soft max-w-prose border-l-2 pl-3 text-[12px] leading-relaxed">
            {periodNote(topic.metrics)}
          </p>
        )}

        {supporting.length > 0 && (
          <div>
            <p
              className="text-label text-ink-faint mb-2 uppercase"
              style={{ fontSize: TYPE.micro }}
            >
              Also published for {placeName}
            </p>
            {/* Compact: name and value on one line each. These are context for
                the headline, not competitors to it. */}
            <dl className="divide-line border-line divide-y border-t">
              {supporting.map((m) => (
                <div
                  key={m.indicatorId}
                  className="flex items-baseline justify-between gap-4 py-1.5"
                >
                  <dt className="text-ink-soft" style={{ fontSize: TYPE.body }}>
                    <Link href={`/indicators/${m.indicatorId.replace(/_/g, "-")}/`}>
                      {m.name}
                    </Link>
                  </dt>
                  <dd
                    className="text-ink tabular shrink-0"
                    style={{ fontSize: TYPE.body }}
                  >
                    {formatWithUnit(m.value, m.unit)}
                  </dd>
                </div>
              ))}
            </dl>

            {/* Definitions kept, not deleted. They belong to whoever wants them
                rather than to everyone who glances at the page. */}
            <DataDisclosure label="What these measure" scroll={false}>
              <dl className="space-y-2 p-4">
                {[headline, ...supporting].map((m) => (
                  <div key={m.indicatorId}>
                    <dt className="text-ink-soft" style={{ fontSize: TYPE.small }}>
                      {m.name}
                    </dt>
                    {m.definition && (
                      <dd
                        className="text-ink-faint max-w-prose leading-relaxed"
                        style={{ fontSize: TYPE.small }}
                      >
                        {m.definition}
                      </dd>
                    )}
                  </div>
                ))}
              </dl>
            </DataDisclosure>
          </div>
        )}
      </div>
    </div>
  );
}
