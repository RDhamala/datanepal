import { TYPE } from "@/lib/viz";

/*
  One owner for "show me the numbers".

  Nine components had grown their own `<details>` around a table, with five
  different labels between them -- "View data table", "View the numbers",
  "View all 13 values", "View all 77 districts", "View all 11 names" -- and
  three different border, padding and max-height treatments. A reader who
  learned the control on a chart learned nothing about the one under the map
  directly beneath it, which is exactly the kind of incoherence the Figure
  wrapper exists to prevent everywhere else.

  Worse, the duplication was invisible per component. Each one was individually
  reasonable; only the page showed the problem, and only when you counted. So
  the affordance belongs to one component, and the label is composed from what
  the caller knows rather than written out again.

  This is deliberately *not* a table. It is the disclosure around one, so that
  FigureTable and the page-level DataTable can both sit inside it without
  either of them owning the control.
*/

export function DataDisclosure({
  /** Overrides the composed label entirely. Rare; prefer count + noun. */
  label,
  /** How many rows the reader is about to see. Stated, so it is not a surprise. */
  count,
  /** Plural noun for those rows: "districts", "values", "years". */
  noun = "values",
  /** Caps the scroll area. Off for short tables that read better in full. */
  scroll = true,
  open = false,
  children,
}: {
  label?: string;
  count?: number;
  noun?: string;
  scroll?: boolean;
  open?: boolean;
  children: React.ReactNode;
}) {
  const text =
    label ?? (count === undefined ? "View the numbers" : `View all ${count} ${noun}`);

  return (
    <details className="group mt-3" open={open}>
      <summary
        className="text-ink-faint hover:text-ink-soft marker:text-ink-faint focus-visible:outline-accent cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ fontSize: TYPE.small }}
      >
        {text}
      </summary>
      <div
        className={`border-line mt-3 rounded-lg border ${scroll ? "max-h-96 overflow-auto" : ""}`}
      >
        {children}
      </div>
    </details>
  );
}

/**
 * The exact-value table itself: first column labels, the rest numeric.
 *
 * Lifted out of charts.tsx, where it was private, because three other
 * components had each written the same thead/tbody by hand with slightly
 * different padding. A caller that needs richer cells composes `FigureTable`
 * inside `DataDisclosure` instead; this is the common case.
 */
export function DataGrid({
  caption,
  columns,
  rows,
}: {
  /** Screen-reader caption. The visible label lives on the disclosure. */
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full" style={{ fontSize: TYPE.body }}>
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-surface-raised sticky top-0">
        <tr className="border-line border-b">
          {columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={`text-label text-ink-faint px-3 py-2 font-semibold uppercase ${
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
                {/* A dash, never a zero: they teach opposite lessons. */}
                {cell === "" || cell === null || cell === undefined ? "—" : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
