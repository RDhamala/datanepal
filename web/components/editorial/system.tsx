import Link from "next/link";
import type { Figure as FigureData } from "@/lib/editorial";
import { figureText, periodText, SourceNote } from "./format";
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
}: {
  n?: number;
  title: string;
  titleNe?: string | null;
  intro?: React.ReactNode;
  action?: { href: string; label: string };
  children: React.ReactNode;
  id?: string;
  contained?: boolean;
}) {
  return (
    <section
      id={id}
      className={`border-line border-t pt-7 pb-10 ${
        contained ? "max-w-page mx-auto px-5 sm:px-8" : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        <h2 className="flex items-baseline gap-3">
          {n !== undefined && (
            <span className="text-ink-faint tabular text-[12px]" aria-hidden="true">
              {String(n).padStart(2, "0")}
            </span>
          )}
          <span
            className="text-ink text-[clamp(1.375rem,1.1rem+1vw,1.75rem)] leading-[1.1] font-semibold tracking-[-0.02em]"
            style={ROLE.section}
          >
            {title}
            {titleNe && (
              <span
                className="text-ink-faint ne ml-2.5 text-[0.62em] font-normal"
                lang="ne"
              >
                {titleNe}
              </span>
            )}
          </span>
        </h2>
        {action && (
          <Link href={action.href} className="text-[13px] whitespace-nowrap">
            {action.label} →
          </Link>
        )}
      </div>
      {intro && (
        <p className="text-ink-soft mt-2 max-w-[62ch] text-[14px] leading-relaxed">
          {intro}
        </p>
      )}
      <div className="mt-6">{children}</div>
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
    <div className="divide-line border-line grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
      {figures.map((f, i) => (
        <div
          key={f.indicatorId}
          className={`border-line py-5 sm:px-6 ${i > 0 ? "lg:border-l" : ""} ${i === 1 || i === 3 ? "sm:border-l" : ""} ${i < 2 ? "sm:border-b lg:border-b-0" : ""} ${i === 0 ? "sm:pl-0" : ""}`}
        >
          <p
            className="text-ink-faint text-[11px] uppercase"
            style={{ letterSpacing: "0.07em" }}
          >
            {f.label}
          </p>
          <p
            className="text-ink mt-1.5 text-[clamp(1.625rem,1.2rem+1.5vw,2.25rem)] leading-none font-semibold tracking-[-0.03em]"
            style={ROLE.leadFigure}
          >
            {figureText(f)}
          </p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-ink-faint tabular text-[12px]">{periodText(f)}</p>
              {f.change && (
                <p className="text-ink-soft tabular mt-0.5 text-[11px]">
                  {f.change.delta >= 0 ? "▲" : "▼"}{" "}
                  {Math.abs(f.change.delta) < 1
                    ? Math.abs(f.change.delta).toFixed(2)
                    : Math.abs(f.change.delta).toLocaleString(undefined, {
                        maximumFractionDigits: 1,
                      })}{" "}
                  from {f.change.fromYear}
                </p>
              )}
            </div>
            {f.points.length >= 3 && (
              <div className="overflow-hidden">
                <Sparkline points={f.points.slice(-40)} width={92} height={24} />
              </div>
            )}
          </div>
          <SourceNote source={f.source} className="mt-2" />
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

  return (
    <div>
      <div className="relative h-[86px]">
        <div
          className="bg-line absolute top-11 right-0 left-0 h-px"
          aria-hidden="true"
        />
        {[lo, hi].map((v, i) => (
          <span
            key={v}
            className="text-ink-faint tabular absolute top-[52px] text-[11px]"
            style={{ left: i === 0 ? 0 : undefined, right: i === 1 ? 0 : undefined }}
            aria-hidden="true"
          >
            {v}
            {unitSuffix}
          </span>
        ))}
        {rows.map((r) => (
          <div
            key={r.label + r.level}
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${Math.min(93, Math.max(7, at(r.value)))}%` }}
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
              className={`mx-auto mt-1 ${r.isSelf ? "bg-ink h-5 w-[3px]" : "bg-ink-faint h-4 w-px"}`}
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
