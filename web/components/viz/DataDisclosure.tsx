import { TYPE } from "@/lib/viz";
import { scriptAttrs } from "@/lib/lang";

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
export type GridColumn = {
  label: string;
  /** Right-aligned and tabular. True for every column but the first. */
  numeric?: boolean;
};

export function DataGrid({
  caption,
  columns,
  rows,
}: {
  /** Screen-reader caption. The visible label lives on the disclosure. */
  caption: string;
  /**
   * A bare string is the common case: the first column names the row, the rest
   * hold numbers. Spell a column out when that is wrong -- a place's type and
   * a party's Nepali name are words, and right-aligning them as if they were
   * quantities is both ugly and a lie about what they are.
   */
  columns: (string | GridColumn)[];
  rows: (string | number)[][];
}) {
  const cols: GridColumn[] = columns.map((c, i) =>
    typeof c === "string" ? { label: c, numeric: i > 0 } : { numeric: i > 0, ...c },
  );

  return (
    <table className="w-full" style={{ fontSize: TYPE.body }}>
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-surface-raised sticky top-0">
        <tr className="border-line border-b">
          {cols.map((c) => (
            <th
              key={c.label}
              scope="col"
              {...scriptAttrs(
                c.label,
                `text-label text-ink-faint px-3 py-2 font-semibold uppercase ${
                  c.numeric ? "text-right" : "text-left"
                }`,
              )}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="border-line border-b last:border-0">
            {r.map((cell, ci) => {
              const c = cols[ci] ?? { label: "", numeric: true };
              /* A dash, never a zero: they teach opposite lessons. */
              const text =
                cell === "" || cell === null || cell === undefined ? "—" : cell;
              const className = `px-3 py-1.5 ${
                ci === 0
                  ? "text-ink-soft"
                  : c.numeric
                    ? "text-ink tabular text-right"
                    : "text-ink-soft"
              }`;
              /*
                The first column is the row's name, so it is a row header. A
                reader on a screen reader otherwise gets a stream of numbers
                with nothing attached to them -- the table is read column by
                column and the name never comes back.
              */
              return ci === 0 ? (
                <th
                  key={ci}
                  scope="row"
                  {...scriptAttrs(text, `${className} text-left font-normal`)}
                >
                  {text}
                </th>
              ) : (
                <td key={ci} {...scriptAttrs(text, className)}>
                  {text}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
