import type { Figure, Provenance } from "@/lib/editorial";
import { formatNumber } from "@/lib/format";

/* Formatting and provenance presentation shared across editorial surfaces. */

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
