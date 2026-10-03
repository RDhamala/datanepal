import type { Metadata } from "next";
import { manifest } from "@/lib/data";
import { SourceDetail } from "@/components/viz/SourceLine";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Datasets",
  description:
    "Source datasets behind DataNepal, with publisher, acquisition path, licence and reuse terms.",
};

/* Tier and acquisition-method labels moved to viz/SourceLine with the
   provenance block they describe. */

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

              {/*
                The full provenance chain, shared with the design laboratory
                so that what is demonstrated there and what ships here cannot
                drift apart. It lived inline in this file until then.
              */}
              <SourceDetail s={s} />
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
