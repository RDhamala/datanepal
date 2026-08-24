import Link from "next/link";
import { formatWithUnit, statusLabel } from "@/lib/format";
import type { Benchmark as BenchmarkData, ProfileTopic } from "@/lib/data";
import { COLOR, TYPE } from "@/lib/viz";
import { Benchmark } from "./Benchmark";
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
}: {
  topic: ProfileTopic;
  /** Indicator to lead with. The rest become supporting values. */
  headlineId: string;
  /** Comparison against province and Nepal, where the data supports one. */
  benchmark?: BenchmarkData;
  placeName: string;
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
        <p className="text-ink tabular mt-1.5 text-[2.1rem] leading-none font-semibold tracking-[-0.035em]">
          {formatWithUnit(headline.value, headline.unit)}
        </p>
        <p className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
          {headline.period}
          {headline.periodType === "instant" ? " census" : ""}
          {statusLabel(headline.status) ? ` ${statusLabel(headline.status)}` : ""}
          {!headline.isAdditive && " · not additive across places"}
        </p>

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
                {Math.abs(male! - female!).toFixed(isRate ? 1 : 0)}
                {isRate ? " points" : ""} higher for {male! > female! ? "men" : "women"}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="space-y-7">
        {benchmark && <Benchmark data={benchmark} />}

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
            <details className="mt-3">
              <summary
                className="text-ink-faint hover:text-ink-soft cursor-pointer"
                style={{ fontSize: TYPE.small }}
              >
                What these measure
              </summary>
              <dl className="mt-2 space-y-2">
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
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
