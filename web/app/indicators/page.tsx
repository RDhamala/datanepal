import type { Metadata } from "next";
import Link from "next/link";
import { indicatorSlug, indicators, topics, units } from "@/lib/data";
import { Crumbs, PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = {
  title: "Indicators",
  description: "Every statistic published by DataNepal, with its unit and source.",
};

export default async function IndicatorsIndex() {
  const [inds, allTopics, us] = await Promise.all([indicators(), topics(), units()]);
  const unitOf = (id: string) => us.find((u) => u.unit_id === id);

  const byTopic = new Map<string, typeof inds>();
  for (const i of inds) {
    byTopic.set(i.topic_id, [...(byTopic.get(i.topic_id) ?? []), i]);
  }

  return (
    <>
      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Indicators" }]} />
      <PageHeader
        eyebrow="Browse"
        title="Indicators"
        native="सूचकहरू"
        meta={`${inds.length} indicators across ${byTopic.size} topics`}
      />

      {allTopics
        .filter((t) => byTopic.has(t.topic_id))
        .map((t) => (
          <Section key={t.topic_id} title={t.name_en}>
            <ul className="divide-line border-line divide-y rounded-lg border">
              {byTopic.get(t.topic_id)!.map((i) => (
                <li key={i.indicator_id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link
                      href={`/indicators/${indicatorSlug(i.indicator_id)}/`}
                      className="text-[14px] font-medium"
                    >
                      {i.name_en}
                    </Link>
                    <span className="text-ink-faint text-[12px]">
                      {unitOf(i.default_unit_id)?.name_en}
                      {!i.is_additive && " · not additive"}
                    </span>
                  </div>
                  {i.definition && (
                    <p className="text-ink-soft mt-1 max-w-2xl text-[13px]">
                      {i.definition}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ))}
    </>
  );
}
