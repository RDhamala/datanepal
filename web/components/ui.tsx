import Link from "next/link";
import type { Dataset } from "@/lib/data";

/* -------------------------------------------------------------- breadcrumb */

export function Crumbs({ trail }: { trail: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-ink-faint mb-6 text-[13px]">
      <ol className="flex flex-wrap items-center gap-x-1.5">
        {trail.map((c, i) => (
          <li key={i} className="flex items-center gap-x-1.5">
            {i > 0 && (
              <span aria-hidden className="text-line-strong select-none">
                /
              </span>
            )}
            {c.href ? (
              <Link href={c.href} className="text-ink-soft hover:text-ink">
                {c.label}
              </Link>
            ) : (
              <span className="text-ink">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------- page header */

export function PageHeader({
  title,
  native,
  eyebrow,
  meta,
}: {
  title: string;
  native?: string | null;
  eyebrow?: string;
  meta?: React.ReactNode;
}) {
  return (
    <header className="border-line mb-10 border-b pb-8">
      {eyebrow && <p className="text-label text-ink-faint mb-3 uppercase">{eyebrow}</p>}
      <h1 className="text-display text-ink font-semibold">{title}</h1>
      {native && <p className="text-title text-ink-soft mt-2 font-normal">{native}</p>}
      {meta && <div className="text-ink-faint mt-4 text-[13px]">{meta}</div>}
    </header>
  );
}

export function Pcode({ code }: { code: string }) {
  return (
    <code className="bg-surface-sunken text-ink-soft rounded px-1.5 py-0.5 font-mono text-[11px]">
      {code}
    </code>
  );
}

/* --------------------------------------------------------------- stat tiles */

/**
 * A stat tile, not a one-bar chart. A single current value is the case where
 * the right form is a number, large, with its label and unit beside it.
 */
export function Tile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "series-1" | "series-2";
}) {
  return (
    <div className="bg-surface-raised px-4 py-4 sm:px-5">
      <div className="text-label text-ink-faint mb-2 flex items-center gap-1.5 uppercase">
        {accent && (
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-[2px] ${
              accent === "series-1" ? "bg-series-1" : "bg-series-2"
            }`}
          />
        )}
        {label}
      </div>
      <div className="text-stat tabular text-ink font-semibold">{value}</div>
      {sub && <div className="text-ink-faint mt-1 text-[12px]">{sub}</div>}
    </div>
  );
}

export function TileRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line bg-line mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-3 lg:grid-cols-6">
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- sections */

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <h2 className="text-heading text-ink font-semibold">{title}</h2>
      {note && <p className="text-ink-faint mt-1 mb-5 text-[13px]">{note}</p>}
      {!note && <div className="mb-5" />}
      {children}
    </section>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line-strong bg-surface-sunken text-ink-soft mb-10 rounded-r border-l-2 px-4 py-3 text-[13px]">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- tables */

export function DataTable({
  columns,
  children,
}: {
  columns: { label: string; numeric?: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <div className="border-line overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-line bg-surface-raised border-b">
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={`text-label text-ink-faint px-4 py-2.5 font-semibold uppercase ${
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
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-line hover:bg-surface-sunken border-b last:border-0">
      {children}
    </tr>
  );
}

export function Cell({
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
      className={`px-4 py-2.5 ${numeric ? "tabular text-right" : "text-left"} ${
        strong ? "text-ink font-medium" : "text-ink-soft"
      }`}
    >
      {children}
    </td>
  );
}

/* --------------------------------------------------------------- provenance */

/**
 * Provenance block. Present on every page that shows a figure.
 *
 * Not decorative. An aggregate with no stated source, licence, or vintage is
 * not citable, and citability is most of what separates a data platform from
 * a collection of charts.
 */
export function Sources({ datasets }: { datasets: Dataset[] }) {
  if (!datasets.length) return null;
  return (
    <Section
      title="Sources and downloads"
      note="Every figure on this page comes from one of these datasets."
    >
      <ul className="border-line divide-line divide-y rounded-lg border">
        {datasets.map((d) => (
          <li key={d.table} className="px-4 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-ink text-[14px] font-medium">{d.title}</span>
              {d.vintage && (
                <span className="text-ink-faint text-[12px]">
                  reference period {d.vintage}
                </span>
              )}
            </div>
            {d.source && (
              <p className="text-ink-soft mt-1 text-[13px]">
                {d.source.name} ·{" "}
                <a href={d.source.url} rel="noopener noreferrer" target="_blank">
                  source
                </a>
                {d.source.accessed && (
                  <span className="text-ink-faint">
                    {" "}
                    · retrieved {d.source.accessed}
                  </span>
                )}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-ink-faint font-mono text-[11px]">
                {d.licence ?? "licence unknown"}
              </span>
              <span aria-hidden className="text-line-strong">
                ·
              </span>
              <span className="text-ink-faint tabular text-[11px]">
                {d.row_count.toLocaleString()} rows
              </span>
              {d.parquet && (
                <a
                  href={`/data/${d.parquet}`}
                  download
                  className="border-line-strong text-ink-soft hover:bg-surface-sunken ml-auto rounded border px-2.5 py-1 font-mono text-[11px] no-underline"
                >
                  ↓ parquet
                </a>
              )}
              {d.json && (
                <a
                  href={`/data/${d.json}`}
                  download
                  className="border-line-strong text-ink-soft hover:bg-surface-sunken rounded border px-2.5 py-1 font-mono text-[11px] no-underline"
                >
                  ↓ json
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
