import Link from "next/link";
import {
  formatChange,
  formatCompact,
  formatNumber,
  formatWithUnit,
  type Unit,
} from "@/lib/data";

/*
  The visualization system.

  One rule governs every choice here: charts and figures for understanding,
  tables for exact lookup and verification. A chart that exists so the page has
  a chart on it is worse than the table it replaced.

  Every chart ships with an accessible table under a "View data table"
  disclosure. That is a `<details>` element, not a JavaScript toggle -- this is a
  static site, and a disclosure works with no client bundle, no hydration, and
  no failure mode when scripts are blocked.

  Colour: a single hue for magnitude (ranked bars, trend lines), because the
  colour is not carrying identity -- position and length are. Categorical hues
  are reserved for charts where a reader must tell series apart, like the
  age-sex pyramid. Using eight colours on a one-series bar chart is decoration
  pretending to be information.
*/

/* ------------------------------------------------------------ shared table */

function DataDisclosure({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group mt-4">
      <summary className="text-ink-faint hover:text-ink-soft cursor-pointer text-[12px]">
        View data table
      </summary>
      <div className="border-line mt-3 max-h-96 overflow-auto rounded-lg border">
        <table className="w-full text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-raised sticky top-0">
            <tr className="border-line border-b">
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`text-label text-ink-faint px-3 py-2 uppercase ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-line border-b last:border-0">
                {r.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 ${
                      ci === 0 ? "text-ink-soft" : "text-ink tabular text-right"
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------- trend chart */

export type SeriesPoint = { year: number; value: number; status?: string };

/**
 * A line for change over time. Answers "what changed?", which a table of sixty
 * annual rows answers only after the reader has done the work themselves.
 *
 * Deliberately unadorned: no points on every observation, no value labels, no
 * gridline on every year. The shape is the message; the table underneath
 * carries the exact numbers.
 */
export function TrendChart({
  points,
  unit,
  label,
  height = 160,
}: {
  points: SeriesPoint[];
  unit?: Unit;
  label: string;
  height?: number;
}) {
  if (points.length < 2) return null;

  const W = 720;
  const PAD = { top: 12, right: 16, bottom: 24, left: 48 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const years = points.map((p) => p.year);
  const values = points.map((p) => p.value);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // Include zero for counts and currency, where a truncated axis exaggerates
  // change. Rates that go negative keep their own range, because forcing zero
  // on an inflation series hides the thing the reader came for.
  const includeZero = unit?.unit_kind !== "ratio" && rawMin >= 0;
  const lo = includeZero ? 0 : rawMin - (rawMax - rawMin) * 0.1;
  const hi = rawMax + (rawMax - rawMin) * 0.1 || rawMax * 1.1 || 1;

  const x = (yr: number) =>
    PAD.left + ((yr - minYear) / Math.max(maxYear - minYear, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(p.year)},${y(p.value)}`)
    .join(" ");
  const last = points[points.length - 1];

  const ticks = [lo, (lo + hi) / 2, hi];
  const xTicks = [minYear, Math.round((minYear + maxYear) / 2), maxYear];
  const zeroCrossing = lo < 0 && hi > 0;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${label}, ${minYear} to ${maxYear}. Latest value ${formatWithUnit(last.value, unit)}.`}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              className="stroke-line"
              strokeWidth={1}
              opacity={0.7}
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-ink-faint tabular text-[10px]"
            >
              {formatCompact(t)}
            </text>
          </g>
        ))}

        {/* A zero line matters when the series crosses it -- deflation reads
            very differently from slowing inflation. */}
        {zeroCrossing && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-line-strong"
            strokeWidth={1}
          />
        )}

        {xTicks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={height - 6}
            textAnchor="middle"
            className="fill-ink-faint tabular text-[10px]"
          >
            {t}
          </text>
        ))}

        <path
          d={path}
          fill="none"
          className="stroke-series-1"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Only the latest point is marked. Marking all sixty is noise. */}
        <circle
          cx={x(last.year)}
          cy={y(last.value)}
          r={3.5}
          className="fill-series-1"
        />
      </svg>

      <DataDisclosure
        caption={`${label} by year`}
        columns={["Year", "Value"]}
        rows={[...points].reverse().map((p) => [p.year, formatNumber(p.value)])}
      />
    </figure>
  );
}

/* ------------------------------------------------------------ ranked bars */

/**
 * Ranked horizontal bars for comparing places.
 *
 * Replaces the six-column table that used to be the homepage's province
 * comparison. A reader asking "which province is largest?" gets it from bar
 * length in one glance; the table made them scan and compare formatted numbers.
 * The table is still here, one click away, for anyone who needs exact values.
 *
 * Horizontal, because place names are long and Nepali names are longer.
 * One hue, because length carries the magnitude and colour would add nothing.
 */
export function RankedBars({
  rows,
  unit,
  label,
  valueLabel = "Value",
  max: maxOverride,
  compact = false,
}: {
  rows: { name: string; nameNe?: string | null; href?: string; value: number }[];
  unit?: Unit;
  label: string;
  valueLabel?: string;
  max?: number;
  /** Narrow column beside a map: tighter grid, no duplicate table. */
  compact?: boolean;
}) {
  if (!rows.length) return null;
  const max = maxOverride ?? Math.max(...rows.map((r) => r.value));
  if (max <= 0) return null;

  const fmt = (v: number) =>
    unit?.unit_kind === "ratio" ? `${v.toFixed(1)}%` : formatNumber(v);

  return (
    <figure className="m-0">
      <ul className="space-y-1.5" aria-label={label}>
        {rows.map((r) => (
          <li
            key={r.name}
            className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3"
          >
            <span className="truncate text-[13px]">
              {r.href ? (
                <a href={r.href}>{r.name}</a>
              ) : (
                <span className="text-ink">{r.name}</span>
              )}
            </span>
            <span className="bg-surface-sunken relative block h-4 rounded-sm">
              <span
                className="bg-series-1 absolute inset-y-0 left-0 rounded-sm"
                style={{ width: `${Math.max((r.value / max) * 100, 0.6)}%` }}
              />
            </span>
            <span
              className={`text-ink tabular text-right text-[13px] ${
                compact ? "w-16" : "w-24"
              }`}
            >
              {fmt(r.value)}
            </span>
          </li>
        ))}
      </ul>

      {!compact && (
        <DataDisclosure
          caption={label}
          columns={["Place", "नेपाली", valueLabel]}
          rows={rows.map((r) => [r.name, r.nameNe ?? "—", fmt(r.value)])}
        />
      )}
    </figure>
  );
}

/* ------------------------------------------------------ headline statistic */

/**
 * A headline figure with its period and qualification.
 *
 * A single current value is the case where the right form is a large number,
 * not a one-bar chart. The status line is not decoration: a reader who takes a
 * projection for a census count has been misled by the page.
 */
export function Headline({
  value,
  unit,
  label,
  period,
  status,
  note,
}: {
  value: number;
  unit?: Unit;
  label: string;
  period: string;
  status?: string | null;
  note?: string;
}) {
  const rendered =
    unit?.unit_kind === "ratio"
      ? `${value.toFixed(1)}${unit.symbol ?? "%"}`
      : unit?.unit_kind === "currency"
        ? `${unit.symbol ?? ""}${value >= 1000 ? formatCompact(value) : value.toFixed(2)}`
        : formatNumber(value);

  return (
    <div>
      <div className="text-label text-ink-faint uppercase">{label}</div>
      <div className="text-ink tabular mt-1 text-[2.5rem] leading-none font-semibold tracking-tight">
        {rendered}
      </div>
      <div className="text-ink-faint mt-2 text-[12px]">
        {period}
        {status && <> · {status}</>}
        {unit && unit.unit_kind !== "ratio" && <> · {unit.name_en}</>}
      </div>
      {note && <p className="text-ink-soft mt-2 max-w-sm text-[13px]">{note}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- sparkline */

/**
 * A bare trend line, no axes, sized to sit beside a headline figure.
 *
 * Adopted from the prototype, which pairs every KPI with one. It earns its
 * place: a number alone answers "what is it", and the sparkline answers "which
 * way is it going" in the same glance without a second chart or a second click.
 * It carries no axis labels on purpose — it is shape, not measurement, and the
 * full series with values is one link away.
 */
export function Sparkline({
  points,
  height = 30,
  width = 132,
}: {
  points: { year: number; value: number }[];
  height?: number;
  width?: number;
}) {
  if (points.length < 3) return null;

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pad = 3;

  const x = (i: number) => (i / (points.length - 1)) * (width - pad * 2) + pad;
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const lastIdx = points.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="overflow-visible"
      // Decorative: the adjacent figure and change text carry the information,
      // so a screen reader gets no benefit from describing the line's shape.
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={path}
        fill="none"
        className="stroke-series-1"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.85}
      />
      <circle cx={x(lastIdx)} cy={y(values[lastIdx])} r={2} className="fill-series-1" />
    </svg>
  );
}

/* ------------------------------------------------------------- KPI metric */

/**
 * The headline metric pattern: figure, period, attribution, change, sparkline.
 *
 * Provenance is compressed to one line — "2023 projection · UNFPA" — rather
 * than a block. That is the prototype's instinct and it is right: the number
 * should dominate while the source stays immediately visible. Full methodology
 * lives in the sources section, one scroll away.
 *
 * No card. No coloured icon. Statistics separated by rules read as a table of
 * facts; the same statistics in rounded boxes read as a marketing page.
 */
export function Metric({
  label,
  value,
  unit,
  period,
  status,
  attribution,
  series,
  href,
  note,
}: {
  label: string;
  value: number;
  unit?: Unit;
  period: string;
  status?: string | null;
  attribution?: string;
  series?: { year: number; value: number }[];
  href?: string;
  note?: string;
}) {
  const rendered =
    unit?.unit_kind === "ratio"
      ? `${value.toFixed(1)}${unit.symbol ?? "%"}`
      : unit?.unit_kind === "currency"
        ? `${unit.symbol ?? ""}${value >= 1000 ? formatCompact(value) : value.toFixed(0)}`
        : formatCompact(value);

  // Year-on-year, not first-to-last. A 24-year change on a volatile rate is
  // arithmetic, not information: inflation in 2001 and 2025 happen to be nearly
  // equal, which rendered as "-0.0 pp since 2001" and told the reader nothing.
  // The comparison a reader wants from a headline figure is against the period
  // before it.
  const change =
    series && series.length >= 2
      ? formatChange(
          series[series.length - 2].value,
          series[series.length - 1].value,
          unit,
        )
      : null;
  const priorYear = series?.[series.length - 2]?.year;

  const heading = <span className="text-label text-ink-faint uppercase">{label}</span>;

  return (
    <div className="flex flex-col gap-3">
      <div>
        {href ? (
          <Link href={href} className="no-underline hover:underline">
            {heading}
          </Link>
        ) : (
          heading
        )}
        <div className="text-ink tabular mt-1.5 text-[2rem] leading-none font-semibold tracking-[-0.03em]">
          {rendered}
        </div>
        <div className="text-ink-faint mt-2 text-[12px]">
          {period}
          {status && <> {status}</>}
          {attribution && <> · {attribution}</>}
        </div>
        {note && <div className="text-ink-faint mt-0.5 text-[12px]">{note}</div>}
      </div>

      {series && series.length > 2 && (
        <div className="flex items-end justify-between gap-3">
          <Sparkline points={series} />
          {change && change.direction !== "flat" && (
            <span className="text-ink-soft tabular shrink-0 text-[12px]">
              <span aria-hidden>{change.direction === "up" ? "↑" : "↓"}</span>{" "}
              {change.text.replace(/^[+-]/, "")}
              <span className="text-ink-faint"> from {priorYear}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
