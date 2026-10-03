import Link from "next/link";
import type { SourceDataset } from "@/lib/data";
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

/*
  The expanded variant: the full chain, for a dataset or source page.

  This is the implementation that was already on /datasets/, lifted here
  unchanged rather than replaced. The version that briefly lived in this file
  was written for the design laboratory and was strictly weaker -- no source
  tier, no acquisition method, no commercial-reuse statement -- so adopting it
  on /datasets/ would have been a downgrade dressed as consolidation. The
  laboratory now demonstrates the real thing, which is the only way a
  laboratory is worth having.
*/

const TIER_LABEL: Record<string, string> = {
  A: "Primary authoritative",
  B: "Authoritative international",
  C: "Trusted aggregator",
  D: "Secondary",
};

const METHOD_LABEL: Record<string, string> = {
  official_api: "Official API",
  official_download: "Official download",
  official_html: "Official web page",
  undocumented_endpoint: "Undocumented endpoint",
  mirror: "Mirror",
  aggregator_api: "Aggregator API",
  aggregator_download: "Aggregator download",
  scrape: "Scrape",
  pdf_extraction: "PDF extraction",
  manual_entry: "Manual entry",
};

export function SourceDetail({ s }: { s: SourceDataset }) {
  return (
    <>
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
        <div>
          <dt className="text-label text-ink-faint uppercase">Published by</dt>
          <dd className="text-ink mt-0.5">
            {s.publisher_homepage ? (
              <a href={s.publisher_homepage} rel="noopener noreferrer" target="_blank">
                {s.publisher}
              </a>
            ) : (
              s.publisher
            )}
            {s.publisher_name_ne && (
              <span className="text-ink-faint">
                {" · "}
                <span className="ne" lang="ne">
                  {s.publisher_name_ne}
                </span>
              </span>
            )}
          </dd>
          <dd className="text-ink-faint mt-0.5 text-[12px]">
            Tier {s.source_tier} — {TIER_LABEL[s.source_tier ?? ""] ?? ""}
          </dd>
        </div>

        <div>
          <dt className="text-label text-ink-faint uppercase">Acquired by DataNepal</dt>
          <dd className="text-ink mt-0.5">
            {METHOD_LABEL[s.acquisition_method ?? ""] ?? s.acquisition_method}
            {s.acquired_indirectly && <> via {s.acquired_from}</>}
          </dd>
          <dd className="text-ink-faint tabular mt-0.5 text-[12px]">
            Retrieved {s.retrieved}
          </dd>
        </div>

        <div>
          <dt className="text-label text-ink-faint uppercase">Coverage</dt>
          <dd className="text-ink tabular mt-0.5">
            {s.time_coverage || s.vintage}
            {s.geographic_granularity && s.geographic_granularity !== "none" && (
              <> · to {s.geographic_granularity.replace(/_/g, " ")} level</>
            )}
          </dd>
          {s.update_frequency && (
            <dd className="text-ink-faint mt-0.5 text-[12px]">
              Updated {s.update_frequency}
              {s.revises_published_values && " · publisher revises past values"}
            </dd>
          )}
        </div>

        <div>
          <dt className="text-label text-ink-faint uppercase">Reuse</dt>
          <dd className="text-ink mt-0.5">
            {s.licence_statement_url ? (
              <a
                href={s.licence_statement_url}
                rel="noopener noreferrer"
                target="_blank"
              >
                {s.licence}
              </a>
            ) : (
              s.licence
            )}
          </dd>
          <dd className="text-ink-faint mt-0.5 text-[12px]">
            Commercial use: {(s.commercial_reuse ?? "unclear").replace(/_/g, " ")}
          </dd>
        </div>
      </dl>

      {s.caveats.length > 0 && (
        <ul className="text-ink-soft mt-4 space-y-1 text-[12px]">
          {s.caveats.map((c, i) => (
            <li key={i} className="border-line-strong border-l-2 pl-3">
              {c}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[12px]">
        <a href={s.url} rel="noopener noreferrer" target="_blank">
          View at source
        </a>
        {s.methodology_url && (
          <>
            {" · "}
            <a href={s.methodology_url} rel="noopener noreferrer" target="_blank">
              Methodology
            </a>
          </>
        )}
      </p>
    </>
  );
}
