import Link from "next/link";
import type { Figure } from "@/lib/editorial";
import {
  EscapeSiteChrome,
  figureText,
  periodText,
  SkipLink,
  SourceNote,
} from "./shared";
import { Sparkline } from "@/components/charts";

/*
  Direction B — Geographic Civic Atlas.

  Geography is the index. Panels, not prose: each module is a bounded surface
  with a label, a control and a graphic. Denser and more interactive than A.
*/

/* ------------------------------------------------------------------ shell */

export function AtlasShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-sunken min-h-screen">
      <EscapeSiteChrome />
      <SkipLink />
      <header className="bg-ink text-surface sticky top-0 z-40">
        <div className="max-w-wide mx-auto flex flex-wrap items-center gap-x-7 gap-y-2 px-5 py-3 sm:px-8">
          <Link
            href="/design-reset/atlas/home/"
            className="text-surface text-[17px] font-semibold tracking-[-0.02em] no-underline"
          >
            DataNepal
            <span className="ne ml-2 text-[13px] font-normal opacity-70" lang="ne">
              तथ्याङ्क नेपाल
            </span>
          </Link>
          <nav
            aria-label="Sections"
            className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]"
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
                className="text-surface/80 hover:text-surface no-underline"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="proto-main">{children}</main>
      <AtlasFooter />
    </div>
  );
}

function AtlasFooter() {
  return (
    <footer className="bg-ink text-surface/70 mt-16">
      <div className="max-w-wide mx-auto grid gap-8 px-5 py-10 text-[12px] sm:grid-cols-4 sm:px-8">
        <div className="sm:col-span-2">
          <p className="text-surface text-[15px] font-semibold">DataNepal</p>
          <p className="mt-2 max-w-sm leading-relaxed">
            Open, documented public data for Nepal. Aggregates only.
          </p>
        </div>
        <div>
          <p className="text-surface mb-2 font-medium">Explore</p>
          <ul className="space-y-1">
            <li>
              <Link href="/places/" className="text-surface/70 hover:text-surface">
                Places
              </Link>
            </li>
            <li>
              <Link href="/indicators/" className="text-surface/70 hover:text-surface">
                Indicators
              </Link>
            </li>
            <li>
              <Link href="/compare/" className="text-surface/70 hover:text-surface">
                Compare
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-surface mb-2 font-medium">Data</p>
          <ul className="space-y-1">
            <li>
              <Link href="/datasets/" className="text-surface/70 hover:text-surface">
                Datasets
              </Link>
            </li>
            <li>
              <Link href="/about/" className="text-surface/70 hover:text-surface">
                Methodology
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

/* ----------------------------------------------------------------- panels */

/** A bounded module. Label, optional action, content. */
export function Panel({
  label,
  title,
  action,
  children,
  className = "",
}: {
  label?: string;
  title?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`bg-surface border-line rounded-lg border p-5 sm:p-6 ${className}`}
    >
      {(label || title || action) && (
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <div>
            {label && (
              <p
                className="text-ink-faint text-[11px] uppercase"
                style={{ letterSpacing: "0.07em" }}
              >
                {label}
              </p>
            )}
            {title && (
              <h2 className="text-ink mt-1 text-[19px] leading-tight font-semibold tracking-[-0.015em]">
                {title}
              </h2>
            )}
          </div>
          {action && (
            <Link href={action.href} className="text-[13px] whitespace-nowrap">
              {action.label} →
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ tiles */

/** Compact KPI tile. Denser than Direction A's rule-separated row. */
export function KpiTile({ figure }: { figure: Figure }) {
  return (
    <div className="bg-surface border-line rounded-lg border p-4">
      <p className="text-ink-faint text-[11px] leading-snug">{figure.label}</p>
      <p className="text-ink tabular mt-2 text-[26px] leading-none font-semibold tracking-[-0.03em]">
        {figureText(figure)}
      </p>
      {/* Sparkline takes an explicit width: it renders at its intrinsic 132px
          and ignores a narrower wrapper, so a CSS-only box lets it bleed out. */}
      {figure.points.length >= 3 && (
        <div className="mt-2 overflow-hidden">
          <Sparkline points={figure.points.slice(-40)} width={96} height={26} />
        </div>
      )}
      <p className="text-ink-faint tabular mt-2 text-[11px]">{periodText(figure)}</p>
      <SourceNote source={figure.source} className="mt-2" />
    </div>
  );
}

/** Metric row inside a panel: label, value, bar against the row maximum. */
export function MetricRow({
  label,
  value,
  display,
  max,
  href,
  highlight = false,
}: {
  label: string;
  value: number;
  display: string;
  max: number;
  href?: string;
  highlight?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const name = href ? <Link href={href}>{label}</Link> : <span>{label}</span>;
  return (
    <div className="grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 py-1.5 text-[13px]">
      <span className="truncate">{name}</span>
      <span className="bg-surface-sunken relative block h-3 overflow-hidden rounded-sm">
        <span
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            width: `${pct}%`,
            background: highlight ? "var(--color-ink)" : "var(--color-series-1)",
          }}
        />
      </span>
      <span className="text-ink tabular w-16 text-right">{display}</span>
    </div>
  );
}

/**
 * Place against its parents, as stacked tracks.
 *
 * Direction A draws this as one axis with three marks. Here it is three
 * bars sharing a scale, which fits a panel and survives a narrow column.
 */
export function BenchmarkStack({
  rows,
  suffix = "%",
}: {
  rows: { label: string; level: string; value: number; isSelf: boolean }[];
  suffix?: string;
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label + r.level}>
          <div className="mb-1 flex items-baseline justify-between text-[12px]">
            <span className={r.isSelf ? "text-ink font-semibold" : "text-ink-soft"}>
              {r.label}
              <span className="text-ink-faint ml-1.5 text-[11px]">{r.level}</span>
            </span>
            <span
              className={`tabular ${r.isSelf ? "text-ink font-semibold" : "text-ink-soft"}`}
            >
              {r.value.toFixed(1)}
              {suffix}
            </span>
          </div>
          <div className="bg-surface-sunken h-2 overflow-hidden rounded-sm">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(r.value / max) * 100}%`,
                background: r.isSelf ? "var(--color-ink)" : "var(--color-seq-3)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
