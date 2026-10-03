import { TYPE } from "@/lib/viz";
import { PeriodChip, SourceLine } from "./SourceLine";

/*
  One current value, said once.

  Four things on this site rendered a labelled number -- Tile, FactStrip,
  MetricStrip and a bare paragraph inside TopicSummary -- at three different
  sizes (22, 32, 34px) with three different ways of showing the period and two
  of showing status. This owns the responsibility instead.

  Two variants, because a number has two jobs here. On its own it leads a
  module and takes --text-stat-lead. In a group it is one of several facts and
  takes --text-stat, so the group reads as a row rather than as a competition.
  Neither is a rounded card: a card per statistic is the "card soup" the brand
  direction rules out, and a fact strip of six cards is six borders carrying no
  information.
*/

export type MetricStatus =
  "census" | "projection" | "estimate" | "preliminary" | "final";

/** Reader-facing word for a status. `census` and `final` need no qualifier. */
const STATUS_WORD: Record<MetricStatus, string | null> = {
  census: null,
  final: null,
  projection: "projection",
  estimate: "estimate",
  preliminary: "preliminary",
};

export type HeadlineMetricProps = {
  label: string;
  /** Pre-formatted. Formatting belongs to lib/format, not here. */
  value: string | null;
  unit?: string | null;
  period?: string | number | null;
  status?: MetricStatus | null;
  /** e.g. "+2.4% from 2024". Only where the comparison is methodologically valid. */
  change?: { text: string; direction: "up" | "down" | "flat" } | null;
  /** Publisher, for the compact provenance line. Omit inside a group. */
  source?: string | null;
  /** One short clause: "74th of 77 districts". */
  context?: string | null;
  /** Why the value is missing, when it is. */
  missingNote?: string | null;
};

export function HeadlineMetric({
  label,
  value,
  unit,
  period,
  status,
  change,
  source,
  context,
  missingNote,
  lead = false,
}: HeadlineMetricProps & { lead?: boolean }) {
  const statusWord = status ? STATUS_WORD[status] : null;

  return (
    <div>
      <div className="text-label text-ink-faint uppercase">{label}</div>

      {value === null ? (
        /*
          A missing value is a sentence, not a dash in a big font. A dash at
          --text-stat-lead reads as a number that failed to load; the reader
          needs to know whether the measure is unpublished here or unpublished
          anywhere.
        */
        <p
          className="text-ink-faint mt-1.5 max-w-prose"
          style={{ fontSize: TYPE.body }}
        >
          {missingNote ?? "Not published for this place."}
        </p>
      ) : (
        <>
          <div
            className={`${lead ? "text-stat-lead" : "text-stat"} text-ink tabular mt-1.5 font-semibold`}
          >
            {/*
              Long values wrap rather than overflow. "US$1,573" is short;
              "NPR 1,860,000,000" is not, and a district name beside it makes
              the row narrower still.
            */}
            <span className="break-words">{value}</span>
            {unit && (
              /*
                The unit is part of reading the number, not metadata about it.
                At TYPE.small beside a 36px figure it read as a typesetting
                accident; half the figure's size keeps it subordinate and still
                legible.
              */
              <span
                className="text-ink-faint ml-1.5 font-normal"
                style={{ fontSize: "0.42em" }}
              >
                {unit}
              </span>
            )}
          </div>

          {(period || change) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {period && <PeriodChip period={period} status={statusWord} />}
              {change && (
                <span
                  className={
                    change.direction === "up"
                      ? "text-rise"
                      : change.direction === "down"
                        ? "text-fall"
                        : "text-ink-faint"
                  }
                  style={{ fontSize: TYPE.small }}
                >
                  {/* Arrow plus word: direction is never colour alone. */}
                  {change.direction === "up"
                    ? "▲"
                    : change.direction === "down"
                      ? "▼"
                      : "–"}{" "}
                  {change.text}
                </span>
              )}
            </div>
          )}

          {context && (
            <p
              className="text-ink-soft mt-2 max-w-prose leading-relaxed"
              style={{ fontSize: TYPE.small }}
            >
              {context}
            </p>
          )}
        </>
      )}

      {/*
        The period is already on the chip above. Repeating it here read as
        "2021 ... 2021 · National Statistics Office" in the same 120px column,
        which is the duplication the shared component anatomy exists to stop.
        Where there is no chip -- a metric with no period -- the source line
        carries both.
      */}
      {source &&
        (period ? (
          <p className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
            {source}
          </p>
        ) : (
          <SourceLine
            className="mt-2"
            publisher={source}
            period=""
            status={statusWord}
          />
        ))}
    </div>
  );
}

/**
 * Several metrics as one row.
 *
 * Rules on a shared baseline rather than a card each. The divider appears only
 * where the row is genuinely one line; on a wrapping grid a trailing divider
 * sits beside empty space.
 */
export function HeadlineMetricGroup({
  metrics,
  columns = 4,
  topRule = true,
}: {
  metrics: HeadlineMetricProps[];
  columns?: 2 | 3 | 4 | 5;
  /**
   * Off when a page header's own bottom rule sits directly above. Two rules
   * 40px apart with nothing between them read as an empty section rather than
   * as separation -- clearest on a phone, where the strip stacks and the gap
   * is the first thing below the title.
   */
  topRule?: boolean;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-3 lg:grid-cols-5",
  }[columns];

  return (
    <div
      className={`border-line divide-line grid grid-cols-2 gap-x-6 gap-y-6 ${
        topRule ? "border-y" : "border-b"
      } py-5 ${cols} lg:gap-x-0 lg:divide-x lg:py-6`}
    >
      {metrics.map((m) => (
        <div key={m.label} className="lg:px-5 lg:first:pl-0">
          <HeadlineMetric {...m} />
        </div>
      ))}
    </div>
  );
}
