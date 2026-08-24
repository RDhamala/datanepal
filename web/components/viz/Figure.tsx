import { COLOR, TYPE } from "@/lib/viz";

/*
  The wrapper every chart and map shares.

  Before this, each visual invented its own title, its own legend markup, its own
  caption wording and its own way of offering the underlying numbers -- some had a
  `<details>` table, some had none, and the ones that had one described it
  differently. A reader learning to use one chart learned nothing transferable
  about the next.

  So the frame is fixed and the content is not: heading, optional subtitle, the
  visual, its legend, a live readout slot, the caption, then the table. Every
  visual on the site is that sequence, which is what lets a reader stop thinking
  about the furniture.

  The table is not optional and not hidden away. It is the accessible equivalent
  of the graphic, the way to get an exact value out of a chart built for glancing,
  and the thing that makes a colour-encoded map usable by someone who cannot
  distinguish the classes.
*/

export function Figure({
  title,
  subtitle,
  legend,
  readout,
  caption,
  table,
  tableLabel,
  children,
  wide = false,
}: {
  /** Omitted when the surrounding section heading already names the visual. */
  title?: string;
  subtitle?: React.ReactNode;
  legend?: React.ReactNode;
  /**
   * A fixed slot for hover and focus output.
   *
   * Fixed rather than a floating tooltip: a tooltip that follows the cursor
   * covers the shapes next to the one being read, which on a map of eleven local
   * governments is most of them. The slot also keeps its height when empty, so
   * nothing below it moves as the pointer travels.
   */
  readout?: React.ReactNode;
  caption?: React.ReactNode;
  table?: React.ReactNode;
  tableLabel?: string;
  children: React.ReactNode;
  /** Charts and maps get more width than prose; tables get all of it. */
  wide?: boolean;
}) {
  return (
    <figure className={`m-0 ${wide ? "" : "max-w-4xl"}`}>
      {title && (
        <figcaption className="mb-1">
          <span className="text-ink text-[14px] font-medium">{title}</span>
        </figcaption>
      )}
      {subtitle && (
        <p
          className="text-ink-faint mb-3 max-w-prose leading-relaxed"
          style={{ fontSize: TYPE.small }}
        >
          {subtitle}
        </p>
      )}

      {legend && <div className="mb-3">{legend}</div>}

      {children}

      {readout !== undefined && (
        <p
          aria-live="polite"
          className="text-ink-soft mt-3 min-h-[1.35rem]"
          style={{ fontSize: TYPE.body }}
        >
          {readout}
        </p>
      )}

      {caption && (
        <p
          className="text-ink-faint mt-2 max-w-prose leading-relaxed"
          style={{ fontSize: TYPE.small }}
        >
          {caption}
        </p>
      )}

      {table && (
        <details className="mt-3">
          <summary
            className="text-ink-faint hover:text-ink-soft cursor-pointer"
            style={{ fontSize: TYPE.small }}
          >
            {tableLabel ?? "View the numbers"}
          </summary>
          <div className="border-line mt-3 max-h-96 overflow-auto rounded-md border">
            {table}
          </div>
        </details>
      )}
    </figure>
  );
}

/**
 * A legend entry. Swatch plus label, at one size, everywhere.
 *
 * The swatch is a square with a hairline border rather than a bare colour chip,
 * because the palest classes of the sequential ramp are very nearly the page and
 * an unbordered swatch of one of them is invisible.
 */
export function LegendItem({
  color,
  label,
  shape = "block",
}: {
  color: string;
  label: string;
  /** A line for series, a block for fills. Matching the mark it explains. */
  shape?: "block" | "line";
}) {
  return (
    <span className="flex items-center gap-1.5">
      {shape === "block" ? (
        <span
          aria-hidden
          className="border-line-strong size-3 shrink-0 rounded-[2px] border"
          style={{ background: color }}
        />
      ) : (
        <span
          aria-hidden
          className="h-0.5 w-4 shrink-0 rounded-full"
          style={{ background: color }}
        />
      )}
      <span className="text-ink-soft" style={{ fontSize: TYPE.small }}>
        {label}
      </span>
    </span>
  );
}

export function Legend({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{children}</div>
  );
}

/**
 * A sequential ramp legend with its real class boundaries labelled.
 *
 * Labelling the breaks rather than only the range ends is what makes a quantile
 * scale honest: the classes are unevenly spaced, and a smooth bar with only two
 * numbers on it implies they are not.
 */
export function RampLegend({
  breaks,
  low,
  high,
  format,
  label,
}: {
  breaks: number[];
  low: number;
  high: number;
  format: (v: number) => string;
  label?: string;
}) {
  return (
    <div className="max-w-md">
      <div className="flex h-2.5 gap-px overflow-hidden rounded-sm">
        {COLOR.sequential.map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </div>
      <div
        className="text-ink-faint tabular mt-1.5 flex justify-between"
        style={{ fontSize: TYPE.micro }}
      >
        {[low, ...breaks, high].map((v, i) => (
          <span key={i}>{format(v)}</span>
        ))}
      </div>
      {label && (
        <p className="text-ink-faint mt-1" style={{ fontSize: TYPE.small }}>
          {label}
        </p>
      )}
    </div>
  );
}

/**
 * The standard table that sits under a visual.
 *
 * Right-aligned tabular numerals, a sticky header, hairline row rules, and one
 * header style. Alignment is not decoration here: a column of right-aligned
 * tabular figures can be scanned for magnitude, and the same column
 * left-aligned in a proportional face cannot.
 */
export function FigureTable({
  columns,
  children,
}: {
  columns: { label: string; numeric?: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <table className="w-full" style={{ fontSize: TYPE.body }}>
      <thead className="bg-surface-raised sticky top-0">
        <tr className="border-line border-b">
          {columns.map((c) => (
            <th
              key={c.label}
              scope="col"
              className={`text-label text-ink-faint px-3 py-2 font-semibold uppercase ${
                c.numeric ? "text-right" : "text-left"
              }`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function FigureRow({ children }: { children: React.ReactNode }) {
  return <tr className="border-line border-b last:border-0">{children}</tr>;
}

export function FigureCell({
  children,
  numeric,
  strong,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-3 py-1.5 ${numeric ? "tabular text-right" : "text-left"} ${
        strong ? "text-ink font-medium" : "text-ink-soft"
      }`}
    >
      {children}
    </td>
  );
}
