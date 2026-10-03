import Link from "next/link";
import type { Figure as FigureData } from "@/lib/editorial";
import { figureText, periodText } from "./format";
import { Sparkline } from "@/components/charts";

/*
  The editorial visual system.

  Serif for the masthead, page titles, section headings and figures that stand
  alone; sans for everything else. Hairline rules instead of cards.
*/

export const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';

/**
 * Where the serif is allowed, and where it is not. Measured, not assumed.
 *
 * Digit metrics at 48px/600 in Chrome on macOS:
 *   serif -> Iowan Old Style: every digit 28.52px wide. Lining and tabular.
 *   sans  -> ui-sans-serif: "1" is 21.6px, "0" is 29.5px. Proportional.
 *
 * So the first instinct -- serif is the risky one in a column -- is backwards
 * here. Two rules come out of it:
 *
 * 1. Any number in a column carries `.tabular`, which equalises the sans to
 *    29.37px. The class already exists; the job is to use it in both families.
 * 2. The serif is still restricted to figures that stand alone, because the
 *    stack falls back to Georgia off macOS and Georgia does set old-style
 *    figures. One display number survives that; a ranked column would not.
 */
export const ROLE = {
  masthead: { fontFamily: SERIF },
  display: { fontFamily: SERIF },
  section: { fontFamily: SERIF },
  leadFigure: { fontFamily: SERIF },
  ui: {} as React.CSSProperties,
} as const;

/* ---------------------------------------------------------------- section */

/**
 * A numbered section. A's rhythm, tightened.
 *
 * Padding is roughly half Direction A's: the homepage there was 4,423px and
 * most of that was air between chapters rather than content.
 */
export function Section({
  n,
  title,
  titleNe,
  intro,
  action,
  children,
  id,
  /**
   * Supply the page container, or inherit one.
   *
   * The prototype shells have no inner container, so a section provides its
   * own. The production layout's <main> already applies `max-w-page` and the
   * horizontal padding, and applying them twice insets the content by 40px and
   * shrinks the measure. Off there.
   */
  contained = true,
  /**
   * `accent` puts the section on a tinted full-bleed band.
   *
   * Used sparingly -- one band per page. Five identical white sections
   * separated by hairlines have no rhythm; alternating stripes have too much.
   * One tinted band marks the section a reader is meant to *use* rather than
   * read, which here is the map.
   */
  tone = "plain",
}: {
  n?: number;
  title: string;
  titleNe?: string | null;
  intro?: React.ReactNode;
  action?: { href: string; label: string };
  children: React.ReactNode;
  id?: string;
  contained?: boolean;
  tone?: "plain" | "accent";
}) {
  const accent = tone === "accent";
  return (
    <section
      id={id}
      className={[
        accent
          ? "bg-surface-accent border-line -mx-5 border-y px-5 py-12 sm:-mx-8 sm:px-8"
          : "pt-12 pb-12",
        contained && !accent ? "max-w-page mx-auto px-5 sm:px-8" : "",
      ].join(" ")}
    >
      <div className={accent ? "max-w-page mx-auto" : ""}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
          {/*
          The number sits beside the heading, not inside it. It is decoration
          and reads as such to assistive tech; keeping it out of the <h2> also
          means the heading's text starts where a reader -- or a check on the
          rendered markup -- expects the title to start.
        */}
          <div className="flex items-baseline gap-3.5">
            {n !== undefined && (
              <span
                className="text-brand tabular text-[11px] font-semibold"
                style={{ letterSpacing: "0.1em" }}
                aria-hidden="true"
              >
                {String(n).padStart(2, "0")}
              </span>
            )}
            <h2
              className="text-ink text-[clamp(1.5rem,1.15rem+1.2vw,2rem)] leading-[1.08] font-semibold tracking-[-0.025em]"
              style={ROLE.section}
            >
              {title}
              {titleNe && (
                <span
                  className="text-ink-faint ne ml-2.5 text-[0.6em] font-normal"
                  lang="ne"
                >
                  {titleNe}
                </span>
              )}
            </h2>
          </div>
          {action && (
            <Link
              href={action.href}
              className="text-ink-soft hover:text-brand text-[13px] whitespace-nowrap no-underline transition-colors"
            >
              {action.label} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
        {intro && (
          <p className="text-ink-soft mt-2.5 max-w-[60ch] text-[14px] leading-relaxed">
            {intro}
          </p>
        )}
        <div className="mt-7">{children}</div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- statistics */

/**
 * The national snapshot: rule-separated, not carded.
 *
 * The figure is serif because it stands alone in its cell. The period, change
 * and source under it are sans — they are metadata, and they are small enough
 * that old-style figures would hurt.
 */
export function StatRow({ figures }: { figures: FigureData[] }) {
  return (
    <div
      className="bg-surface border-line divide-line grid grid-cols-1 divide-y overflow-hidden rounded-xl border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4"
      style={{ boxShadow: "var(--shadow-raise)" }}
    >
      {figures.map((f, i) => (
        <div
          key={f.indicatorId}
          className={`border-line relative px-5 py-6 ${i > 0 ? "lg:border-l" : ""} ${
            i % 2 === 1 ? "sm:border-l" : ""
          } ${i < 2 ? "sm:border-b lg:border-b-0" : ""}`}
        >
          <p
            className="text-ink-faint text-[10.5px] uppercase"
            style={{ letterSpacing: "0.08em" }}
          >
            {f.label}
          </p>
          <p
            className="text-ink mt-2.5 text-[clamp(1.75rem,1.3rem+1.6vw,2.375rem)] leading-none font-semibold tracking-[-0.035em]"
            style={ROLE.leadFigure}
          >
            {figureText(f)}
          </p>

          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-ink-faint tabular text-[11.5px]">{periodText(f)}</p>
              {f.change && (
                <p
                  className={`tabular mt-1 text-[11.5px] font-medium ${
                    f.change.delta >= 0 ? "text-rise" : "text-fall"
                  }`}
                >
                  {f.change.delta >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(f.change.delta) < 1
                    ? Math.abs(f.change.delta).toFixed(2)
                    : Math.abs(f.change.delta).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}
                  <span className="text-ink-faint font-normal">
                    {" "}
                    since {f.change.fromYear}
                  </span>
                </p>
              )}
            </div>
            {f.points.length >= 3 && (
              <div className="shrink-0 overflow-hidden opacity-80">
                <Sparkline points={f.points.slice(-40)} width={78} height={22} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One large figure with supporting content beside it.
 *
 * The number is serif; anything in the slot beside it is sans.
 */
export function LeadStat({
  label,
  value,
  period,
  note,
  children,
}: {
  label: string;
  value: string;
  period: string;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-7 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] md:gap-12">
      <div>
        <p
          className="text-ink-faint text-[11px] uppercase"
          style={{ letterSpacing: "0.07em" }}
        >
          {label}
        </p>
        <p
          className="text-ink mt-1.5 text-[clamp(2.25rem,1.7rem+2.2vw,3.25rem)] leading-[0.95] font-semibold tracking-[-0.035em]"
          style={ROLE.leadFigure}
        >
          {value}
        </p>
        <p className="text-ink-faint tabular mt-2 text-[12px]">{period}</p>
        {note && (
          <div className="text-ink-soft mt-3 max-w-[40ch] text-[13px] leading-relaxed">
            {note}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Chart anatomy: title, units, graphic, source.
 *
 * The title is *sans* here, unlike Direction A. A figure title sits a few
 * pixels from axis labels and tick numbers; setting it in serif made the two
 * typefaces collide inside one graphic.
 */
export function Figure({
  title,
  subtitle,
  source,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  source?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      <figcaption className="mb-3">
        <p className="text-ink text-[14px] leading-snug font-semibold">{title}</p>
        {subtitle && (
          <p className="text-ink-soft mt-0.5 text-[12px] leading-relaxed">{subtitle}</p>
        )}
      </figcaption>
      {children}
      {source && <div className="text-ink-faint mt-2 text-[11px]">{source}</div>}
    </figure>
  );
}

/**
 * Place against its parents, on one axis.
 *
 * Kept from Direction A: three marks on a shared scale read as a position,
 * which is the question, where three bars read as three lengths.
 */
export function BenchmarkLine({
  rows,
  unitSuffix = "%",
  caption,
}: {
  rows: { label: string; level: string; value: number; isSelf: boolean }[];
  unitSuffix?: string;
  caption?: string;
}) {
  if (!rows.length) return null;
  const values = rows.map((r) => r.value);
  const lo = Math.floor(Math.min(...values) / 5) * 5 - 5;
  const hi = Math.ceil(Math.max(...values) / 5) * 5 + 5;
  const at = (v: number) => ((v - lo) / (hi - lo)) * 100;

  /*
    Two marks close together collide.

    Nilkhantha reads 75.8% and Nepal 76.2% -- four tenths of a point apart,
    which put "75.8%" and "76.2%" on top of each other and printed the two
    place names as one word. Marks within 9% of the axis get their label
    raised a row, alternating, so a near-tie stays readable.
  */
  const placed = [...rows]
    .map((r, i) => ({ ...r, pos: at(r.value), i }))
    .sort((a, b) => a.pos - b.pos);
  const lift = new Map<number, boolean>();
  let lastPos = -Infinity;
  let raised = false;
  for (const r of placed) {
    raised = r.pos - lastPos < 9 ? !raised : false;
    lift.set(r.i, raised);
    lastPos = r.pos;
  }

  return (
    <div>
      <div className="relative h-[112px]">
        <div
          className="bg-line absolute top-11 right-0 left-0 h-px"
          aria-hidden="true"
        />
        {[lo, hi].map((v, i) => (
          <span
            key={v}
            className="text-ink-faint tabular absolute top-[76px] text-[11px]"
            style={{ left: i === 0 ? 0 : undefined, right: i === 1 ? 0 : undefined }}
            aria-hidden="true"
          >
            {v}
            {unitSuffix}
          </span>
        ))}
        {rows.map((r, i) => (
          <div
            key={r.label + r.level}
            className="absolute -translate-x-1/2"
            style={{
              left: `${Math.min(93, Math.max(7, at(r.value)))}%`,
              top: lift.get(i) ? 0 : 26,
            }}
          >
            <p
              className={`tabular text-center text-[13px] leading-none whitespace-nowrap ${
                r.isSelf ? "text-ink font-semibold" : "text-ink-soft"
              }`}
            >
              {r.value.toFixed(1)}
              {unitSuffix}
            </p>
            <p
              className={`mt-1 text-center text-[11px] whitespace-nowrap ${
                r.isSelf ? "text-ink" : "text-ink-faint"
              }`}
            >
              {r.label}
            </p>
            <div
              className={`mx-auto mt-1 ${r.isSelf ? "bg-ink w-[3px]" : "bg-ink-faint w-px"}`}
              style={{ height: lift.get(i) ? 36 : 10 }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
      <p className="sr-only">
        {rows.map((r) => `${r.label} ${r.value.toFixed(1)}${unitSuffix}`).join(", ")}.
      </p>
      {caption && <p className="text-ink-faint mt-1.5 text-[12px]">{caption}</p>}
    </div>
  );
}

/* --------------------------------------------------------- chart grammar */

/*
  Three forms, because there are three kinds of quantity on these pages.

    count            additive, starts at zero   -> bar,     series-1
    rate             bounded, not additive      -> dot,     series-2
    parts of a whole shares that sum to 100%    -> stacked, sequential ramp

  The page had one form and one colour for all three, which made a literacy
  rate look exactly like a population count and drew four census categories
  that sum to the whole population as four unrelated bars.

  The axis rule follows from the form, and is the reason this is not
  decoration: a bar encodes value as *length*, so its axis must start at zero
  or the length lies. A dot encodes value as *position*, so its axis may be
  trimmed to the data -- which is what makes a 58%-to-76% spread legible
  instead of a row of near-identical bars crowded against the right edge.
*/

export type QuantityKind = "count" | "rate";

export const kindOf = (unitKind: string | null | undefined): QuantityKind =>
  unitKind === "ratio" ? "rate" : "count";

/**
 * Parts of a whole: one bar, segments in the sequential ramp.
 *
 * The ramp rather than categorical slots because these categories are ordered
 * -- can read and write, can read only, cannot read or write -- and an ordered
 * partition drawn in unordered colours throws away the order.
 */
export function StackedBar({
  parts,
  total,
  caption,
}: {
  parts: { label: string; value: number }[];
  total: number;
  caption?: string;
}) {
  if (!parts.length || total <= 0) return null;
  const ramp = [
    "var(--color-seq-2)",
    "var(--color-seq-3)",
    "var(--color-seq-4)",
    "var(--color-seq-5)",
  ];
  return (
    <div>
      <div className="flex h-7 overflow-hidden rounded-md" aria-hidden="true">
        {parts.map((p, i) => (
          <div
            key={p.label}
            className="h-full"
            style={{
              width: `${(p.value / total) * 100}%`,
              background: ramp[i % ramp.length],
            }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {parts.map((p, i) => (
          <li key={p.label} className="flex items-center gap-1.5 text-[12px]">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: ramp[i % ramp.length] }}
              aria-hidden="true"
            />
            <span className="text-ink-soft">{p.label}</span>
            <span className="text-ink tabular font-medium">
              {((p.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
      {caption && <p className="text-ink-faint mt-2.5 text-[11px]">{caption}</p>}
    </div>
  );
}
