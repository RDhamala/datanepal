import Link from "next/link";
import { formatWithUnit } from "@/lib/format";
import { TYPE } from "@/lib/viz";
import type { Unit } from "@/lib/data";

/*
  The ends of a long ranking, with the middle elided.

  Topic pages and indicator pages had each grown their own copy of this —
  identical markup, identical slice(0,5)/slice(-5), identical ⋯ row — and both
  copies had the same two accessibility defects: no caption, and the place name
  in a `<td>` so a screen reader read out a column of unattributed percentages.
  Fixing it twice is how it drifts a third time.

  Why the ends rather than all 77: the map above carries the pattern, and the
  question a list this long actually answers is "who is at the extremes". The
  full table lives in the disclosure below it.
*/

export type ExtremeRow = {
  placeId: string;
  name: string;
  href: string;
  value: number;
};

export function ExtremesTable({
  caption,
  rows,
  unit,
  ends = 5,
}: {
  /** Screen-reader caption. The visible heading sits above the table. */
  caption: string;
  /** Already sorted, highest first. */
  rows: ExtremeRow[];
  unit: Unit | undefined;
  ends?: number;
}) {
  // Nothing to elide if the whole list already fits in two ends.
  const shown: (ExtremeRow | null)[] =
    rows.length <= ends * 2
      ? rows
      : [...rows.slice(0, ends), null, ...rows.slice(-ends)];

  return (
    <table className="w-full" style={{ fontSize: TYPE.body }}>
      <caption className="sr-only">{caption}</caption>
      <tbody>
        {shown.map((r, i) =>
          r === null ? (
            <tr key="gap">
              <td colSpan={2} className="text-ink-faint py-1.5 text-center">
                ⋯
              </td>
            </tr>
          ) : (
            <tr key={r.placeId || i} className="border-line border-b">
              <th scope="row" className="py-1.5 text-left font-normal">
                <Link href={r.href}>{r.name}</Link>
              </th>
              <td className="text-ink tabular py-1.5 text-right">
                {formatWithUnit(r.value, unit)}
              </td>
            </tr>
          ),
        )}
      </tbody>
    </table>
  );
}
