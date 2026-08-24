import type { Metadata } from "next";
import Link from "next/link";
import { manifest } from "@/lib/data";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description:
    "What DataNepal is, how it sources and documents data, and what it deliberately does not publish.",
};

export default function About() {
  const m = manifest();

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "About" }]} />
      <PageHeader eyebrow="About" title="About DataNepal" native="डेटानेपालको बारेमा" />

      {/*
        A two-column grid past tablet width, not because the prose needs more
        room -- it's still capped at max-w-prose -- but because a page this
        wide with a single centred column of text left most of a desktop
        screen empty. The sidebar carries real figures already computed for
        the closing paragraph below, promoted to where they're visible without
        scrolling, rather than decoration invented to fill the space.
      */}
      <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="max-w-prose">
          <p className="text-ink-soft mb-11 text-[15px]">
            Nepal&rsquo;s public statistics are scattered across institutions that each
            use their own geographic codes, formats and update cycles. That makes any
            question spanning two datasets harder than it should be. DataNepal conforms
            them to one geographic spine and publishes the result as open, documented,
            downloadable data.
          </p>

          <Section title="How data gets here" note={undefined}>
            <p className="text-ink-soft text-[14px]">
              Every dataset records two separate things:{" "}
              <strong className="text-ink font-medium">who produced it</strong> and{" "}
              <strong className="text-ink font-medium">
                where DataNepal obtained this copy
              </strong>
              . Those are different questions. Population figures are produced by UNFPA
              and obtained through the Humanitarian Data Exchange; crediting the
              platform rather than the producer would misattribute the work.
            </p>
            <p className="text-ink-soft mt-4 text-[14px]">
              We prefer the original authoritative publisher, then official structured
              downloads, then authoritative international mirrors, then trusted
              aggregators. Scraping and PDF extraction are last resorts, used only where
              reuse terms permit. See the{" "}
              <Link href="/datasets/">dataset catalogue</Link> for the full provenance
              of every source.
            </p>
          </Section>

          <Section title="What we do not publish">
            <p className="text-ink-soft text-[14px]">
              DataNepal publishes aggregate statistics. It does not ingest, store or
              publish personal data. Nepal&rsquo;s Privacy Act 2075 (2018) names voter
              identity card details among protected personal information, and a
              predecessor of this project served row-level voter records — including
              parents&rsquo; and spouses&rsquo; names — before that endpoint was
              removed.
            </p>
            <p className="text-ink-soft mt-4 text-[14px]">
              Publicly reachable somewhere else does not make something appropriate to
              republish here.
            </p>
          </Section>

          <Section title="Reference periods and revisions">
            <p className="text-ink-soft text-[14px]">
              A figure&rsquo;s reference period is not the date we fetched it, and a
              projection is not a census count. Both are stated wherever a number
              appears. When a publisher restates a figure, the previous value is kept
              with the date it was superseded — the full history is{" "}
              <a href="/data/observation_history.parquet" download>
                downloadable
              </a>
              .
            </p>
          </Section>

          <Section title="Reuse">
            <p className="text-ink-soft text-[14px]">
              Each dataset carries its own licence. DataNepal does not relicense
              upstream data, and attribution requirements travel with it. A published
              table&rsquo;s effective licence is computed from its sources, taking the
              most restrictive — you will find it stated alongside every download.
            </p>
          </Section>
        </div>

        <aside className="lg:border-line lg:border-l lg:pl-8">
          <p className="text-label text-ink-faint mb-3 uppercase">At a glance</p>
          <dl className="space-y-4 text-[13px]">
            <div>
              <dt className="text-ink-faint">Published tables</dt>
              <dd className="text-ink tabular mt-0.5 text-[1.25rem] font-semibold">
                {m.table_count}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Source datasets</dt>
              <dd className="text-ink tabular mt-0.5 text-[1.25rem] font-semibold">
                {m.sources.length}
              </dd>
            </div>
          </dl>
          <ul className="border-line mt-6 space-y-2 border-t pt-4 text-[13px]">
            <li>
              <Link href="/datasets/">Dataset catalogue →</Link>
            </li>
            <li>
              <a
                href="https://github.com/RDhamala/datanepal"
                rel="noopener noreferrer"
                target="_blank"
              >
                Source code (MIT-licensed) →
              </a>
            </li>
            <li>
              <a href="/data/observation_history.parquet" download>
                Revision history →
              </a>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}
