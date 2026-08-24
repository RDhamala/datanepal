import Link from "next/link";
import { formatWithUnit, type Benchmark as BenchmarkData } from "@/lib/data";
import { BAR, COLOR, STROKE, TYPE } from "@/lib/viz";

/*
  Is this high or low?

  Place pages answered "what is the value" and stopped. A district reading
  "literacy 72.4%" gave a reader no way to judge it, and judging it is the whole
  reason they opened the page. Three bars -- the place, its province, Nepal --
  cost almost nothing and turn a number into a finding.

  Bars share one scale anchored at zero, because the comparison is the point and
  a broken axis would exaggerate small gaps into large ones. The subject place is
  the only one in the series colour; its ancestors are drawn in the boundary grey
  so the eye lands on the subject first and reads the others as context.

  Only real published values appear. An ancestor with no figure for this
  indicator is simply absent, because an interpolated benchmark would look
  exactly like a measured one.
*/

export function Benchmark({ data }: { data: BenchmarkData }) {
  const max = Math.max(...data.rows.map((r) => r.value));
  const subject = data.rows.find((r) => r.isSubject);
  const national = data.rows.find((r) => r.name === "Nepal");

  // The sentence a reader would otherwise have to compute. Only stated when
  // there is a national figure to compute it against.
  const gap =
    subject && national && national.value !== 0 ? subject.value - national.value : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h4 className="text-ink text-[13px] font-medium">{data.label}</h4>
        <span className="text-ink-faint" style={{ fontSize: TYPE.small }}>
          {data.period}
        </span>
      </div>

      <table className="mt-2.5 w-full">
        <caption className="sr-only">
          {data.label} for {subject?.name}, compared with its province and Nepal
        </caption>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.placeId}>
              <th
                scope="row"
                className={`w-[38%] py-1 pr-3 text-left font-normal ${
                  row.isSubject ? "text-ink font-medium" : "text-ink-soft"
                }`}
                style={{ fontSize: TYPE.body }}
              >
                {row.href ? <Link href={row.href}>{row.name}</Link> : row.name}
              </th>
              <td className="py-1">
                {/* The bar is presentation; the number beside it is the data.
                    aria-hidden so a screen reader hears the value once. */}
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
                      width: `${max > 0 ? (row.value / max) * 100 : 0}%`,
                      background: row.isSubject ? COLOR.series : COLOR.boundary,
                      borderRadius: BAR.radius,
                    }}
                  />
                </span>
              </td>
              <td
                className={`tabular w-[22%] py-1 pl-3 text-right ${
                  row.isSubject ? "text-ink font-medium" : "text-ink-soft"
                }`}
                style={{ fontSize: TYPE.body }}
              >
                {formatWithUnit(row.value, data.unit)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(gap !== null || subject?.rank) && (
        <p className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
          {gap !== null && (
            <>
              {/* Stated in the unit's own terms: percentage points for a rate,
                  because "8% higher" and "8 points higher" are different claims
                  and conflating them is a classic statistical error. */}
              <span style={{ color: gap >= 0 ? COLOR.rise : COLOR.fall }}>
                {gap >= 0 ? "▲" : "▼"} {Math.abs(gap).toFixed(1)}
                {data.unit?.unit_kind === "ratio" ? " pp" : ""}
              </span>{" "}
              {gap >= 0 ? "above" : "below"} the national figure
            </>
          )}
          {gap !== null && subject?.rank && " · "}
          {subject?.rank && (
            <>
              {subject.rank.position} of {subject.rank.of} by this measure
            </>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * A group of benchmarks, laid out so two sit side by side on a wide screen.
 *
 * Two per row rather than three: a benchmark is read left to right along its
 * bars, and three columns squeeze the bars until the comparison they exist to
 * make stops being visible.
 */
export function BenchmarkGroup({
  benchmarks,
  note,
}: {
  benchmarks: BenchmarkData[];
  note?: string;
}) {
  if (!benchmarks.length) return null;
  return (
    <div>
      <div className="grid gap-x-12 gap-y-7 lg:grid-cols-2">
        {benchmarks.map((b) => (
          <Benchmark key={b.indicatorId} data={b} />
        ))}
      </div>
      {note && (
        <p
          className="text-ink-faint mt-4 max-w-prose leading-relaxed"
          style={{ fontSize: TYPE.small }}
        >
          {note}
        </p>
      )}
      <p
        className="text-ink-faint mt-2 max-w-prose leading-relaxed"
        style={{ fontSize: TYPE.small, borderLeftWidth: STROKE.reference }}
      >
        Only measures that compare meaningfully appear here. Counts like population are
        omitted: a district against the nation is a share, not a benchmark.
      </p>
    </div>
  );
}
