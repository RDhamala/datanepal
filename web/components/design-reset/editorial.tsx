import Link from "next/link";
import type { Figure } from "@/lib/design-reset";
import {
  EscapeSiteChrome,
  figureText,
  periodText,
  SkipLink,
  SourceNote,
} from "./shared";
import { Sparkline } from "@/components/charts";

/*
  Direction A — Editorial Statistical Publication.

  Reading order is the structure: numbered chapters, one point each, graphics
  as illustrations rather than tiles. Figures get room to be large.

  Display type is a system serif -- no font added, no build-time fetch. It
  renders slightly differently per OS; revisit before any rollout.
*/

export const SERIF =
  '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif';

/* ------------------------------------------------------------------ shell */

export function EditorialShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface min-h-screen">
      <EscapeSiteChrome />
      <SkipLink />
      <header className="border-line border-b">
        <div className="max-w-page mx-auto flex flex-wrap items-baseline gap-x-8 gap-y-2 px-5 py-5 sm:px-8">
          <Link href="/design-reset/editorial/home/" className="no-underline">
            <span
              className="text-ink text-[22px] leading-none font-semibold tracking-[-0.02em]"
              style={{ fontFamily: SERIF }}
            >
              DataNepal
            </span>
            <span className="text-ink-faint ne ml-2 text-[15px]" lang="ne">
              तथ्याङ्क नेपाल
            </span>
          </Link>
          <nav
            aria-label="Sections"
            className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]"
          >
            {[
              ["Places", "/places/"],
              ["Topics", "/indicators/"],
              ["Indicators", "/indicators/"],
              ["Compare", "/compare/"],
              ["Datasets", "/datasets/"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                className="text-ink-soft no-underline hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="proto-main">{children}</main>
      <EditorialFooter />
    </div>
  );
}

function EditorialFooter() {
  return (
    <footer className="border-line text-ink-faint mt-24 border-t">
      <div className="max-w-page mx-auto grid gap-8 px-5 py-10 text-[12px] sm:grid-cols-4 sm:px-8">
        <div className="sm:col-span-2">
          <p
            className="text-ink text-[17px] font-semibold"
            style={{ fontFamily: SERIF }}
          >
            DataNepal
          </p>
          <p className="mt-2 max-w-sm leading-relaxed">
            Open, documented public data for Nepal. Aggregates only — this platform does
            not publish personal data.
          </p>
        </div>
        <div>
          <p className="text-ink mb-2 font-medium">Explore</p>
          <ul className="space-y-1">
            <li>
              <Link href="/places/">Places</Link>
            </li>
            <li>
              <Link href="/indicators/">Indicators</Link>
            </li>
            <li>
              <Link href="/compare/">Compare</Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-ink mb-2 font-medium">Data</p>
          <ul className="space-y-1">
            <li>
              <Link href="/datasets/">Datasets and downloads</Link>
            </li>
            <li>
              <Link href="/about/">About and methodology</Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/* --------------------------------------------------------------- chapters */

/**
 * A numbered chapter.
 *
 * The number is the whole trick. It tells a reader the page is finite and
 * ordered, which is the single thing a long scroll of equal sections cannot
 * say. The heading is serif and large; the standfirst under it is the one
 * sentence that justifies the chapter existing.
 */
export function Chapter({
  n,
  title,
  titleNe,
  standfirst,
  children,
  action,
}: {
  n: number;
  title: string;
  titleNe?: string | null;
  standfirst?: React.ReactNode;
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <section className="border-line max-w-page mx-auto border-t px-5 pt-10 pb-16 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <h2 className="flex items-baseline gap-4">
          <span
            className="text-ink-faint tabular text-[13px] font-normal"
            aria-hidden="true"
          >
            {String(n).padStart(2, "0")}
          </span>
          <span
            className="text-ink text-[clamp(1.5rem,1.1rem+1.4vw,2.125rem)] leading-[1.1] font-semibold tracking-[-0.02em]"
            style={{ fontFamily: SERIF }}
          >
            {title}
            {titleNe && (
              <span
                className="text-ink-faint ne ml-3 text-[0.6em] font-normal"
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
      {standfirst && (
        <p className="text-ink-soft mt-3 max-w-[58ch] text-[15px] leading-relaxed">
          {standfirst}
        </p>
      )}
      <div className="mt-8">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------- statistics */

/**
 * The national snapshot as a rule-separated row, not four cards.
 *
 * Cards would make these look like four links. They are four facts, and the
 * thing that separates them is a hairline, which is how a statistical table
 * has always done it. The figure is serif and large because at 15px body text
 * a 30px number reads as a heading; at 44px it reads as the point.
 */
export function StatRow({ figures }: { figures: Figure[] }) {
  return (
    <div className="divide-line border-line grid grid-cols-1 divide-y border-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
      {figures.map((f, i) => (
        <div
          key={f.indicatorId}
          className={`border-line px-0 py-6 sm:px-6 ${i > 0 ? "lg:border-l" : ""} ${i === 1 || i === 3 ? "sm:border-l" : ""} ${i < 2 ? "sm:border-b lg:border-b-0" : ""} ${i === 0 ? "sm:pl-0" : ""}`}
        >
          <p
            className="text-ink-faint text-[11px] uppercase"
            style={{ letterSpacing: "0.07em" }}
          >
            {f.label}
          </p>
          <p
            className="text-ink mt-2 text-[clamp(1.75rem,1.3rem+1.6vw,2.5rem)] leading-none font-semibold tracking-[-0.03em]"
            style={{ fontFamily: SERIF }}
          >
            {figureText(f)}
          </p>
          <p className="text-ink-faint tabular mt-2 text-[12px]">{periodText(f)}</p>
          {f.points.length >= 3 && (
            <div className="mt-3 overflow-hidden">
              <Sparkline points={f.points.slice(-40)} width={120} height={28} />
            </div>
          )}
          {f.change && (
            <p className="text-ink-soft mt-2 text-[12px]">
              {f.change.delta >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(f.change.delta) < 1
                ? Math.abs(f.change.delta).toFixed(2)
                : Math.abs(f.change.delta).toLocaleString(undefined, {
                    maximumFractionDigits: 1,
                  })}{" "}
              from {f.change.fromYear}
            </p>
          )}
          <SourceNote source={f.source} className="mt-2" />
        </div>
      ))}
    </div>
  );
}

/**
 * One very large figure with its argument beside it.
 *
 * Used where a chapter has a single point. The production place pages have no
 * equivalent: every figure there is the same size as every other figure, so
 * nothing is ever the answer.
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
    <div className="grid gap-8 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] md:gap-12">
      <div>
        <p
          className="text-ink-faint text-[11px] uppercase"
          style={{ letterSpacing: "0.07em" }}
        >
          {label}
        </p>
        <p
          className="text-ink mt-2 text-[clamp(2.75rem,2rem+2.8vw,4rem)] leading-[0.95] font-semibold tracking-[-0.035em]"
          style={{ fontFamily: SERIF }}
        >
          {value}
        </p>
        <p className="text-ink-faint tabular mt-3 text-[13px]">{period}</p>
        {note && (
          <div className="text-ink-soft mt-4 max-w-[38ch] text-[14px] leading-relaxed">
            {note}
          </div>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

/**
 * Chart anatomy, stated once.
 *
 * Title, then the subtitle that says what the units are, then the graphic,
 * then the source. Our World in Data's arrangement, and the reason to copy it
 * is that it answers "what am I looking at" before the eye reaches the shape,
 * rather than after.
 */
export function EditorialFigure({
  title,
  subtitle,
  source,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  source?: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <figure className={`m-0 ${wide ? "" : "max-w-[46rem]"}`}>
      <figcaption className="mb-4">
        <p
          className="text-ink text-[17px] leading-snug font-semibold"
          style={{ fontFamily: SERIF }}
        >
          {title}
        </p>
        {subtitle && (
          <p className="text-ink-soft mt-1 text-[13px] leading-relaxed">{subtitle}</p>
        )}
      </figcaption>
      {children}
      {source && <div className="text-ink-faint mt-3 text-[11px]">{source}</div>}
    </figure>
  );
}

/**
 * A benchmark as a number line.
 *
 * Three bars of different lengths make a reader compare lengths. A single axis
 * with three marks on it makes them read a position, which is the actual
 * question -- is this place above or below the country -- and it survives being
 * 320px wide, which three labelled bars do not.
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
      <div className="relative h-24">
        {/* the axis */}
        <div
          className="bg-line absolute top-12 right-0 left-0 h-px"
          aria-hidden="true"
        />
        {[lo, hi].map((v, i) => (
          <span
            key={v}
            className="text-ink-faint tabular absolute top-14 text-[11px]"
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
            style={{ left: `${Math.min(94, Math.max(6, at(r.value)))}%` }}
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
      {/* Non-visual readers get the same comparison as a sentence, because a
          positioned mark on an axis has no reading order. */}
      <p className="sr-only">
        {rows.map((r) => `${r.label} ${r.value.toFixed(1)}${unitSuffix}`).join(", ")}.
      </p>
      {caption && <p className="text-ink-faint mt-2 text-[12px]">{caption}</p>}
    </div>
  );
}
