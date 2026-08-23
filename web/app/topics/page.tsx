import type { Metadata } from "next";
import Link from "next/link";
import { topics } from "@/lib/data";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Topics",
  description: "Subject areas covered by DataNepal, and those planned.",
};

export default async function TopicsIndex() {
  const all = await topics();
  const live = all.filter((t) => t.status === "live" && t.observation_count > 0);
  const planned = all.filter((t) => !(t.status === "live" && t.observation_count > 0));

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Topics" }]} />
      <PageHeader eyebrow="Browse" title="Topics" native="विषयहरू" />

      <Section
        title="Available now"
        note={`${live.length} topics with published data.`}
      >
        <ul className="divide-line border-line divide-y rounded-lg border">
          {live.map((t) => (
            <li key={t.topic_id} className="px-4 py-4">
              <Link href={`/topics/${t.slug}/`} className="text-[15px] font-medium">
                {t.name_en}
              </Link>
              {t.name_ne && (
                <span className="text-ink-faint text-[14px]"> · {t.name_ne}</span>
              )}
              {t.description && (
                <p className="text-ink-soft mt-1 max-w-2xl text-[13px]">
                  {t.description}
                </p>
              )}
              <p className="text-ink-faint tabular mt-2 text-[12px]">
                {t.indicator_count} indicator{t.indicator_count === 1 ? "" : "s"} ·{" "}
                {t.observation_count.toLocaleString()} observations
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* Planned topics are listed as planned. Naming the roadmap honestly is
          more useful than hiding it, and far better than an empty page. */}
      <Section
        title="Planned"
        note="Intended coverage. No data published yet, so these have no pages."
      >
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {planned.map((t) => (
            <li key={t.topic_id} className="text-[14px]">
              <span className="text-ink-soft">{t.name_en}</span>
              {t.name_ne && (
                <span className="text-ink-faint text-[13px]"> · {t.name_ne}</span>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
