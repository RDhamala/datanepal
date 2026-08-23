import type { Metadata } from "next";
import { manifest } from "@/lib/data";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Datasets",
  description:
    "Source datasets behind DataNepal, with publisher, acquisition path, licence and reuse terms.",
};

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

export default function DatasetsIndex() {
  const m = manifest();

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Datasets" }]} />
      <PageHeader
        eyebrow="Provenance"
        title="Datasets"
        native="डेटासेटहरू"
        meta={`${m.sources.length} source datasets · ${m.table_count} published tables`}
      />

      <p className="text-ink-soft -mt-4 mb-10 max-w-2xl text-[15px]">
        Every dataset records both who produced the data and where DataNepal obtained
        this copy. Attribute the publisher, not the platform the copy came from.
      </p>

      <Section title="Source datasets">
        <ul className="divide-line border-line divide-y rounded-lg border">
          {m.sources.map((s) => (
            <li key={s.dataset_id} className="px-4 py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-ink text-[15px] font-medium">{s.title}</span>
                <span className="text-ink-faint font-mono text-[11px]">
                  {s.dataset_id}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-2">
                <div>
                  <dt className="text-label text-ink-faint uppercase">Published by</dt>
                  <dd className="text-ink mt-0.5">
                    {s.publisher_homepage ? (
                      <a
                        href={s.publisher_homepage}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {s.publisher}
                      </a>
                    ) : (
                      s.publisher
                    )}
                    {s.publisher_name_ne && (
                      <span className="text-ink-faint"> · {s.publisher_name_ne}</span>
                    )}
                  </dd>
                  <dd className="text-ink-faint mt-0.5 text-[12px]">
                    Tier {s.source_tier} — {TIER_LABEL[s.source_tier ?? ""] ?? ""}
                  </dd>
                </div>

                <div>
                  <dt className="text-label text-ink-faint uppercase">
                    Acquired by DataNepal
                  </dt>
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
                    {s.geographic_granularity &&
                      s.geographic_granularity !== "none" && (
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
                    Commercial use:{" "}
                    {(s.commercial_reuse ?? "unclear").replace(/_/g, " ")}
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
                    <a
                      href={s.methodology_url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Methodology
                    </a>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Published tables"
        note="What DataNepal derives from those sources. Each table's licence is computed from its inputs, taking the most restrictive."
      >
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-raised">
              <tr className="border-line border-b">
                {["Table", "Rows", "Licence", "Download"].map((h, i) => (
                  <th
                    key={h}
                    className={`text-label text-ink-faint px-4 py-2.5 uppercase ${
                      i === 1 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.tables.map((t) => (
                <tr
                  key={t.table}
                  className="border-line hover:bg-surface-sunken border-b last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-ink font-medium">{t.title}</span>
                    <span className="text-ink-faint block font-mono text-[11px]">
                      {t.table}
                    </span>
                  </td>
                  <td className="text-ink-soft tabular px-4 py-2.5 text-right">
                    {t.row_count.toLocaleString()}
                  </td>
                  <td className="text-ink-soft px-4 py-2.5 font-mono text-[11px]">
                    {t.effective_licence}
                  </td>
                  <td className="px-4 py-2.5">
                    {t.parquet && (
                      <a
                        href={`/data/${t.parquet}`}
                        download
                        className="font-mono text-[11px]"
                      >
                        parquet
                      </a>
                    )}
                    {t.json && (
                      <>
                        {" · "}
                        <a
                          href={`/data/${t.json}`}
                          download
                          className="font-mono text-[11px]"
                        >
                          json
                        </a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {m.history && (
          <p className="text-ink-faint mt-4 text-[12px]">
            Revision history: {m.history.row_count.toLocaleString()} rows —{" "}
            <a href={`/data/${m.history.parquet}`} download>
              download
            </a>
            . Every value change is retained with the date it was superseded.
          </p>
        )}
      </Section>
    </>
  );
}
