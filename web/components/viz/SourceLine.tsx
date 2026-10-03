import Link from "next/link";
import type { Coverage } from "@/lib/coverage";
import { TYPE } from "@/lib/viz";

/*
  Provenance at two levels, from one vocabulary.

  The platform refuses to publish a table without source, licence, vintage and
  caveats, and that rigour has to reach the page without turning every public
  page into an audit log. So: a compact line wherever a figure appears, and the
  full chain where a reader has asked for it.

  The compact form is deliberately one line of plain text -- "2021 census ·
  National Statistics Office" -- because it sits under hundreds of figures and
  anything heavier competes with the data it is attesting to.
*/

export type Provenance = {
  /** Who produced the data. Never the acquisition path. */
  publisher: string;
  /** Reference period as a reader would say it: "2021 census", "2025". */
  period: string;
  /** null when the figure is an enumeration and needs no qualification. */
  status?: string | null;
  /** Where the full chain lives. */
  href?: string;
};

/**
 * The public variant. One line, under a figure or a chart.
 *
 * `status` is carried here rather than beside the number because a projection
 * is a property of the observation, not of the chart, and this is the one place
 * that is guaranteed to appear with every figure on the site.
 */
export function SourceLine({
  publisher,
  period,
  status,
  href = "/datasets/",
  className = "",
}: Provenance & { className?: string }) {
  return (
    <p className={`text-ink-faint ${className}`} style={{ fontSize: TYPE.small }}>
      <span className="tabular">{period}</span>
      {status && <span> {status}</span>}
      {" · "}
      <Link href={href} className="text-ink-faint hover:text-ink-soft">
        {publisher}
      </Link>
    </p>
  );
}

/**
 * A reference period as a standalone chip, bound to the figure it qualifies.
 *
 * Data México puts one of these on every KPI, and the reason is exactly this
 * platform's hazard: a place page that shows a 2021 census count beside a 2023
 * projection renders two individually-correct numbers whose difference is
 * carried entirely by grey microcopy. Dividing one by the other gives 4.0
 * people per household instead of 3.75. A chip is harder to skip than a
 * caption.
 */
export function PeriodChip({
  period,
  status,
}: {
  period: string | number;
  status?: string | null;
}) {
  // Enumerations are unmarked; everything modelled says so. Colour is not the
  // only channel -- the word is there too.
  const modelled = Boolean(status);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 align-middle ${
        modelled
          ? "bg-surface-sunken text-ink-soft"
          : "bg-surface-raised text-ink-faint"
      }`}
      style={{ fontSize: TYPE.micro, letterSpacing: "0.02em" }}
    >
      <span className="tabular">{period}</span>
      {status && <span className="uppercase">{status}</span>}
    </span>
  );
}

/**
 * Coverage as a reader-facing property.
 *
 * Says how deep the data goes, in the reader's words rather than the schema's.
 * Not a colour-only signal: the label is the information.
 */
export function CoverageBadge({
  coverage,
  showNote = false,
}: {
  coverage: Coverage;
  showNote?: boolean;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className="border-line text-ink-soft rounded-sm border px-1.5 py-0.5"
        style={{ fontSize: TYPE.micro }}
        title={coverage.note}
      >
        {coverage.label}
      </span>
      {coverage.hasTimeSeries && (
        <span className="text-ink-faint" style={{ fontSize: TYPE.micro }}>
          time series
        </span>
      )}
      {showNote && (
        <span className="text-ink-faint" style={{ fontSize: TYPE.small }}>
          {coverage.note}
        </span>
      )}
    </span>
  );
}

/**
 * The expanded variant: the full chain, for a dataset or source page.
 *
 * Everything the compact line leaves out, which is most of it. Rendered as a
 * description list because that is what it is, and because a reader scanning
 * for the licence should not have to read the retrieval date first.
 */
export function SourceDetail({
  publisher,
  acquiredFrom,
  licence,
  retrieved,
  vintage,
  methodologyUrl,
  revises,
  caveats = [],
  downloads = [],
}: {
  publisher: string;
  acquiredFrom?: string | null;
  licence: string;
  retrieved: string;
  vintage: string;
  methodologyUrl?: string | null;
  revises?: boolean;
  caveats?: string[];
  downloads?: { label: string; href: string }[];
}) {
  const rows: [string, React.ReactNode][] = [
    ["Publisher", publisher],
    ...(acquiredFrom && acquiredFrom !== publisher
      ? ([["Acquired from", acquiredFrom]] as [string, React.ReactNode][])
      : []),
    ["Reference period", vintage],
    ["Licence", licence],
    ["Retrieved", retrieved],
    ...(revises !== undefined
      ? ([
          [
            "Revisions",
            revises
              ? "The publisher revises figures after first release."
              : "The publisher does not revise released figures.",
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(methodologyUrl
      ? ([
          [
            "Methodology",
            <a key="m" href={methodologyUrl} rel="noopener noreferrer" target="_blank">
              Publisher’s methodology →
            </a>,
          ],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <div className="max-w-prose">
      <dl className="divide-line border-line divide-y border-y">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-4 py-2">
            <dt className="text-label text-ink-faint uppercase">{k}</dt>
            <dd className="text-ink-soft" style={{ fontSize: TYPE.body }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      {caveats.length > 0 && (
        <ul
          className="text-ink-faint mt-4 list-disc space-y-1 pl-5"
          style={{ fontSize: TYPE.small }}
        >
          {caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}

      {downloads.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {downloads.map((d) => (
            <a
              key={d.href}
              href={d.href}
              download
              className="border-line-strong text-ink-soft hover:bg-surface-sunken rounded border px-2.5 py-1 font-mono text-[11px] no-underline"
            >
              ↓ {d.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
