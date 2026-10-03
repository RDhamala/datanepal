import Link from "next/link";
import type { Figure, Provenance } from "@/lib/design-reset";
import { formatNumber } from "@/lib/format";

/* Formatting, provenance and the prototype banner. Anything that decides
   layout belongs to a direction, not here. */

/* --------------------------------------------------------------- numbers */

/**
 * Format by the unit's own symbol, not by unit_kind.
 *
 * Eight units share kind "ratio" -- %, % of GDP, kg/ha, /1000 live births,
 * t CO2e. Assuming "%" rendered cereal yield as "3344.3%".
 */
export function figureText(f: Figure): string {
  const unit = f.unit;
  if (!unit) return formatNumber(f.value);
  const symbol = unit.symbol ?? "";
  const join = (n: string) =>
    !symbol ? n : /^[%/]/.test(symbol) ? `${n}${symbol}` : `${n} ${symbol}`;

  switch (unit.unit_kind) {
    case "currency":
      // Whole units: a per-capita figure to the cent implies a precision the
      // World Bank's own series does not carry.
      return `${symbol}${formatNumber(Math.round(f.value))}`;
    case "ratio":
    case "duration":
      return join(
        f.value >= 1000
          ? f.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : f.value.toFixed(1),
      );
    case "area":
      return join(formatNumber(Math.round(f.value)));
    default:
      return formatNumber(f.value);
  }
}

/** The qualifier that belongs under a figure: its period, and its status. */
export function periodText(f: Figure): string {
  return f.status ? `${f.period} ${f.status.toLowerCase()}` : f.period;
}

/**
 * 1st, 2nd, 3rd, 54th.
 *
 * Written out because `${n}th` is right for 54 and wrong for 1, 2, 3, 21 and
 * 22 -- the kind of thing that looks fine on the one place you tested and
 * reaches production on the other 76.
 */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/* ------------------------------------------------------------ provenance */

/**
 * Attribution for one figure.
 *
 * Publisher first, because attribution follows who produced the data and never
 * how we obtained it -- that distinction is a hard rule in this project and the
 * reason `acquired_from` is a separate field. The acquisition path is shown
 * only when it differs, and then as "via", which is the honest word for it.
 */
export function SourceNote({
  source,
  className = "",
}: {
  source: Provenance | null;
  className?: string;
}) {
  if (!source) return null;
  const via =
    source.acquiredIndirectly && source.acquiredFrom !== source.publisher
      ? ` via ${source.acquiredFrom}`
      : "";
  return (
    <p className={`text-ink-faint text-[11px] leading-relaxed ${className}`}>
      {source.publisher}
      {via} · {source.licence}
    </p>
  );
}

/* --------------------------------------------- escaping the site chrome */

/**
 * Hide the production header/footer so a direction can own its own chrome.
 *
 * The clean fix is two root layouts via route groups, which would mean moving
 * all 890 production routes. Not worth it for a dev-only prototype.
 * display:none also drops them from the accessibility tree; each shell ships
 * its own skip link.
 */
export function EscapeSiteChrome() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
          body > header, body > footer, body > a[href="#main"] { display: none !important; }
          #main { max-width: none !important; width: 100% !important;
                  padding: 0 !important; margin: 0 !important; }
        `,
      }}
    />
  );
}

/** The skip link each prototype shell owns, since the real one is hidden. */
export function SkipLink({ to = "#proto-main" }: { to?: string }) {
  return (
    <a
      href={to}
      className="bg-surface-raised border-line focus-visible:outline-accent sr-only rounded border px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus-visible:outline-2"
    >
      Skip to content
    </a>
  );
}

/* ----------------------------------------------------- the prototype bar */

/** Says this is a prototype, and links to the other direction. */
export function PrototypeBar({
  direction,
  other,
  otherLabel,
}: {
  direction: string;
  other: string;
  otherLabel: string;
}) {
  return (
    <div className="border-line bg-surface-sunken border-b">
      <div className="max-w-wide mx-auto flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2 text-[11px] sm:px-8">
        <span className="text-ink-faint uppercase" style={{ letterSpacing: "0.07em" }}>
          Design prototype
        </span>
        <span className="text-ink-soft">{direction}</span>
        <span className="text-ink-faint">·</span>
        <Link href="/design-reset/" className="underline underline-offset-2">
          Both directions
        </Link>
        <span className="text-ink-faint">·</span>
        <Link href={other} className="underline underline-offset-2">
          {otherLabel}
        </Link>
        <span className="text-ink-faint ml-auto hidden sm:inline">
          Real published data · not the live site
        </span>
      </div>
    </div>
  );
}

/** Shared robots directive: these must never be indexed. */
export const prototypeRobots = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: { index: false, follow: false },
} as const;

/* -------------------------------------------------------- missing states */

/** Absence must read as "not collected", not as zero or as a broken module. */
export function NotPublished({
  what,
  className = "",
}: {
  what: string;
  className?: string;
}) {
  return (
    <p
      className={`text-ink-faint max-w-prose text-[13px] leading-relaxed ${className}`}
    >
      {what} is not published at this level. That is a gap in the source data, not a gap
      in this page.
    </p>
  );
}

/**
 * The one honest sentence about what is available where.
 *
 * Used on both homepages instead of a claim that every indicator reaches every
 * level. Five of 36 do.
 */
export function coverageSentence(sub: number, total: number): string {
  return `${total} indicators published, of which ${sub} go below the national level — all from the 2021 census.`;
}
