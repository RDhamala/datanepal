import Link from "next/link";
import type { PublishedTable, SourceDataset } from "@/lib/data";

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
    <section className="mb-11">
      <h2 className="text-heading text-ink font-semibold">{title}</h2>
      {/*
        max-w-prose on the note, because it was missing and the consequence was
        measurable: six notes on a district page ran past 1200px, one of them 176
        characters on a single line. A section heading can span the page; a
        sentence cannot.
      */}
      {note && (
        <p className="text-ink-faint mt-1 mb-4 max-w-prose text-[13px] leading-relaxed">
          {note}
        </p>
      )}
      {!note && <div className="mb-4" />}
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
  /*
    A minimum width so the table scrolls instead of compressing.

    `overflow-x-auto` alone does nothing when the table is `w-full`: it shrinks
    to fit and every cell wraps to a column of single words. A five-column table
    at 390px became six lines of broken text per row. Scaling the floor with the
    column count means a two-column table still fits a phone without a
    pointless scrollbar, while a wide one stays legible and scrolls.
  */
  const minWidth = `${Math.max(0, columns.length - 2) * 8.5 + 17}rem`;
  return (
    <div className="border-line overflow-x-auto rounded-lg border">
      <table className="w-full text-[13px]" style={{ minWidth }}>
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

/*
  Provenance comes in two levels, deliberately.

  Level 1 (`SourceNote`) goes on every public page: who published this, for what
  period, under what terms, and where the full record lives. It is a short
  paragraph, because a reader checking whether a number is trustworthy needs an
  answer in one glance, not an audit trail.

  Level 2 is the audit trail — retrieval dates, acquisition path, source tier,
  methodology links, revision policy, commercial-reuse status, per-source
  caveats — and lives on /datasets, where someone has come specifically to
  interrogate the data. It is rendered there directly rather than by a shared
  component, because that page needs every field and no other page does.

  The old design put Level 2 on every page. That is not more honest; it is the
  same information presented so heavily that readers stop reading it, which is
  how provenance theatre replaces provenance. Nothing is removed here — it moved
  to where it gets read.
*/

/** Human licence names. The identifiers are exact; these are for prose. */
const LICENCE_LABEL: Record<string, string> = {
  "cc-by-4.0": "CC BY 4.0",
  "cc-by-sa-4.0": "CC BY-SA 4.0",
  "cc-by-igo-3.0": "CC BY-IGO 3.0",
  "cc0-1.0": "CC0 1.0",
  unknown: "no stated licence",
};

function licenceLabel(id: string): string {
  return LICENCE_LABEL[id] ?? id;
}

/**
 * Level 1 provenance: a compact "Sources & methodology" summary.
 *
 * Names every publisher with its reference period, states the reuse terms that
 * actually apply, and routes to the full record. Download links stay here —
 * getting the data is a promise of the platform, not an advanced feature.
 */
export function SourceNote({
  tables,
  sources,
}: {
  tables: PublishedTable[];
  sources: SourceDataset[];
}) {
  if (!sources.length) return null;

  // Distinct licences across the sources on this page, most-restrictive-first
  // ordering is handled upstream; here we just need the set.
  const licences = [...new Set(sources.map((s) => s.licence))];
  const shareAlike = tables.some((t) => t.share_alike);
  const retrieved = sources
    .map((s) => s.retrieved)
    .sort()
    .at(-1);

  return (
    <section aria-labelledby="sources-note" className="border-line mt-16 border-t pt-8">
      <h2 id="sources-note" className="text-label text-ink-faint mb-3 uppercase">
        Sources &amp; methodology
      </h2>

      <p className="text-ink-soft max-w-prose text-[13px] leading-relaxed">
        {sources.map((s, i) => (
          <span key={s.dataset_id}>
            {i > 0 && " · "}
            <a href={s.url} rel="noopener noreferrer" target="_blank">
              {s.publisher}
            </a>
            <span className="text-ink-faint"> ({s.vintage})</span>
          </span>
        ))}
      </p>

      <p className="text-ink-faint mt-2 max-w-prose text-[13px] leading-relaxed">
        Reusable under {licences.map(licenceLabel).join(" and ")} with attribution
        {shareAlike && ", and share-alike terms apply"}.
        {retrieved && ` Retrieved ${retrieved}.`}{" "}
        <Link href="/datasets/">Full metadata, caveats and revision history →</Link>
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-label text-ink-faint mr-1 uppercase">Download</span>
        {tables.map((t) => (
          <a
            key={t.table}
            href={`/data/${t.parquet}`}
            download
            className="border-line-strong text-ink-soft hover:bg-surface-sunken rounded border px-2.5 py-1 font-mono text-[11px] no-underline"
          >
            ↓ {t.table}.parquet
          </a>
        ))}
        <a
          href="/data/manifest.json"
          download
          className="border-line-strong text-ink-soft hover:bg-surface-sunken rounded border px-2.5 py-1 font-mono text-[11px] no-underline"
        >
          ↓ manifest.json
        </a>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- section jump nav */

/**
 * In-page navigation for a place's sections.
 *
 * Anchors, not tabs. Tabs would need client JavaScript, hide content from
 * search engines, and break deep linking — and on a static site with SEO as the
 * primary discovery path, all three matter. Anchors give a keyboard-navigable
 * jump list, work with no script, and let a reader link to a specific section.
 *
 * Only sections that actually have data are listed. A place page offering an
 * "Economy" jump link that lands on nothing is worse than not offering it.
 */
export function SectionNav({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  if (sections.length < 2) return null;
  return (
    <nav aria-label="On this page" className="border-line mb-10 border-y py-2.5">
      <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px]">
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              className="text-ink-soft hover:text-ink no-underline hover:underline"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------------- KPI strip */

/**
 * A row of place facts, separated by rules rather than boxed into cards.
 *
 * "Not every statistic needs a rounded card." Rules and alignment read as a
 * table of facts, which is what this is; the same numbers in cards read as a
 * dashboard.
 */
export function FactStrip({
  facts,
}: {
  facts: { label: string; value: string; sub?: string | null }[];
}) {
  // Two columns on mobile, five on desktop. Vertical rules appear only at `lg`
  // where the row is genuinely one line -- on a wrapping grid an odd number of
  // facts leaves the last item with a divider beside empty space. Below `lg`
  // separation comes from row rules and the grid gap, which also keeps every
  // label on a consistent left edge.
  return (
    <dl className="border-line divide-line mb-10 grid grid-cols-2 gap-x-6 gap-y-5 border-y py-5 lg:grid-cols-5 lg:gap-x-0 lg:gap-y-0 lg:divide-x lg:py-6">
      {facts.map((f) => (
        <div key={f.label} className="lg:px-5 lg:first:pl-0">
          <dt className="text-label text-ink-faint uppercase">{f.label}</dt>
          <dd className="text-ink tabular mt-1.5 text-[1.35rem] leading-none font-semibold tracking-[-0.02em] sm:text-[1.4rem]">
            {f.value}
          </dd>
          {f.sub && <dd className="text-ink-faint mt-1.5 text-[12px]">{f.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** A section that can be linked to from SectionNav. */
export function AnchoredSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-11 scroll-mt-20">
      <h2 className="text-heading text-ink font-semibold">{title}</h2>
      {note && (
        <p className="text-ink-faint mt-1 mb-4 max-w-prose text-[13px] leading-relaxed">
          {note}
        </p>
      )}
      {!note && <div className="mb-4" />}
      {children}
    </section>
  );
}
