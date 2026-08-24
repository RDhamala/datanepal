import Link from "next/link";
import { formatWithUnit, statusLabel } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { BAR, COLOR, TYPE } from "@/lib/viz";

/*
  A row of headline figures that reads as one snapshot.

  The homepage previously had four independent columns, each with its own
  arrangement of label, value, period, source, sparkline and change, and the
  result read as four widgets that happened to be adjacent. The fix is not more
  styling: it is making every cell the same shape, so the eye can compare across
  them without re-learning each one.

  Order within a cell is fixed and deliberate -- label, value, movement, then
  provenance -- because that is the order the questions arrive in: what is this,
  how big, which way, says who.
*/

export type StripMetric = {
  label: string;
  value: number;
  unit: Unit | undefined;
  period: string;
  status?: string | null;
  /** Publisher, always named. A figure without a source is an assertion. */
  source: string;
  href?: string;
  /** A later modelled figure, where the publisher offers one. */
  projection?: { value: number; period: number } | null;
  /** Movement against the previous period, already computed. */
  change?: { text: string; direction: "up" | "down" | "flat" } | null;
  series?: { year: number; value: number }[];
  note?: string;
};

export function MetricStrip({
  metrics,
  large = false,
}: {
  metrics: StripMetric[];
  /** For a strip that's the whole point of its section rather than a
   * supporting summary -- the homepage's, not a place page's. Bigger figures
   * only; the surrounding label/period/source stay the same size, so the
   * numbers gain presence without the cell losing its rhythm with the rest
   * of the page. */
  large?: boolean;
}) {
  return (
    <dl className="border-line divide-line grid grid-cols-1 gap-y-6 border-y py-7 sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-0 lg:gap-y-0 lg:divide-x">
      {metrics.map((m) => (
        <div key={m.label} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
          <dt
            className="text-label text-ink-faint uppercase"
            style={{ fontSize: TYPE.micro }}
          >
            {m.href ? (
              <Link href={m.href} className="text-ink-faint hover:text-ink">
                {m.label}
              </Link>
            ) : (
              m.label
            )}
          </dt>

          <dd
            className={`text-ink tabular mt-2 leading-none font-semibold tracking-[-0.03em] ${
              large ? "text-[2rem] lg:text-[2.5rem]" : "text-[1.6rem]"
            }`}
          >
            {formatWithUnit(m.value, m.unit)}
          </dd>

          {/* One fixed slot for movement, so cells stay aligned whether or not
              a series exists. An empty slot is better than a ragged row. */}
          <dd className="mt-2 flex h-4 items-center gap-2">
            {m.series && m.series.length >= 3 && <Sparkline points={m.series} />}
            {m.change && (
              <span
                className="tabular"
                style={{
                  fontSize: TYPE.small,
                  color:
                    m.change.direction === "up"
                      ? COLOR.rise
                      : m.change.direction === "down"
                        ? COLOR.fall
                        : COLOR.inkFaint,
                }}
              >
                {m.change.direction === "up"
                  ? "▲"
                  : m.change.direction === "down"
                    ? "▼"
                    : "▬"}{" "}
                {m.change.text}
              </span>
            )}
          </dd>

          <dd className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
            {m.period}
            {m.status && statusLabel(m.status)
              ? ` ${statusLabel(m.status)}`
              : ""} · {m.source}
          </dd>
          {m.projection && (
            <dd
              className="text-ink-faint tabular mt-0.5"
              style={{ fontSize: TYPE.micro }}
            >
              {formatWithUnit(m.projection.value, m.unit)} projected for{" "}
              {m.projection.period}
            </dd>
          )}
          {m.note && (
            <dd className="text-ink-faint mt-0.5" style={{ fontSize: TYPE.micro }}>
              {m.note}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/**
 * A sparkline: shape only, no axes, no labels.
 *
 * It answers "which way and how steadily", nothing more. The last point is
 * marked because "where has it got to" is the second question, and a line
 * without a terminal dot leaves the eye guessing which end is now.
 */
export function Sparkline({
  points,
  width = 60,
  height = 14,
}: {
  points: { year: number; value: number }[];
  width?: number;
  height?: number;
}) {
  if (points.length < 3) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pad = 2;
  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden
      className="shrink-0 overflow-visible"
    >
      <path
        d={path}
        fill="none"
        stroke={COLOR.series}
        strokeWidth={1.25}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle
        cx={x(points.length - 1)}
        cy={y(last.value)}
        r={1.4}
        fill={COLOR.series}
      />
    </svg>
  );
}

/**
 * Two values compared side by side, sharing one zero-anchored scale.
 *
 * For the case a place page needs constantly and had no pattern for: female
 * against male, this year against last. A pair of numbers with no visual makes
 * the reader do the subtraction; a pair of bars does not.
 */
export function PairedBars({
  pairs,
  unit,
  labelWidth = "34%",
}: {
  pairs: { label: string; value: number; accent?: boolean }[];
  unit: Unit | undefined;
  labelWidth?: string;
}) {
  const max = Math.max(...pairs.map((p) => p.value));
  return (
    <table className="w-full">
      <tbody>
        {pairs.map((p) => (
          <tr key={p.label}>
            <th
              scope="row"
              className="text-ink-soft py-0.5 pr-3 text-left font-normal"
              style={{ fontSize: TYPE.body, width: labelWidth }}
            >
              {p.label}
            </th>
            <td className="py-0.5">
              <span
                aria-hidden
                className="block overflow-hidden"
                style={{
                  background: COLOR.track,
                  height: BAR.thicknessCompact,
                  borderRadius: BAR.radius,
                }}
              >
                <span
                  className="block h-full"
                  style={{
                    width: `${max > 0 ? (p.value / max) * 100 : 0}%`,
                    background: p.accent ? COLOR.seriesAlt : COLOR.series,
                    borderRadius: BAR.radius,
                  }}
                />
              </span>
            </td>
            <td
              className="text-ink tabular py-0.5 pl-3 text-right"
              style={{ fontSize: TYPE.body, width: "24%" }}
            >
              {formatWithUnit(p.value, unit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
