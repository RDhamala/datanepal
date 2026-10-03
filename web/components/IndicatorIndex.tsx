"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sparkline } from "@/components/charts";
import { TYPE } from "@/lib/viz";

/*
  One index, with topic as a filter rather than a destination.

  /topics/ and /indicators/ listed the same ten topics with the same
  indicators and the same headline values, and held two of six nav slots
  between them. There was no question one answered that the other did not:
  /indicators/ added the unit, the definition and the geographic depth,
  /topics/ added an observation count. A reader who found one had no reason to
  look for the other, and a reader who found both had to work out which was
  canonical.

  So topic becomes a grouping inside this page. The topic *pages* stay --
  /topics/health/ is a hub with charts and a ranking, every place page links
  to one, and they are good landing pages for search. It is the topic *index*
  that was the duplicate, and it now redirects here.

  Coverage is the second filter and the one readers actually arrive with.
  Five of 36 measures go below the national level; the other 31 stop at Nepal.
  "Does this exist for my district" was answerable only by clicking through,
  which is the question this page most owed an answer to.
*/

export type IndicatorRow = {
  id: string;
  slug: string;
  name: string;
  nameNe: string | null;
  definition: string | null;
  unitName: string | null;
  additive: boolean;
  publisher: string | null;
  topicId: string;
  /** Reader-facing depth: "National", "To district", "To local government". */
  coverageLabel: string;
  /** Machine value for filtering: national | province | district | local. */
  coverageLevel: string;
  hasTimeSeries: boolean;
  value: { text: string; period: string; status: string | null } | null;
  /** Set when the figure is a leading member rather than a total. */
  leading: { memberName: string; memberCount: number } | null;
  points: { year: number; value: number }[];
};

export type TopicOption = {
  id: string;
  slug: string;
  name: string;
  nameNe: string | null;
};

const COVERAGE_FILTERS = [
  { value: "all", label: "Any level" },
  { value: "sub", label: "Below national" },
  { value: "district", label: "To district or deeper" },
  { value: "local", label: "To local government" },
];

/** Does this indicator satisfy the chosen coverage filter? */
function matchesCoverage(level: string, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "sub") return level !== "national";
  if (filter === "district") return level === "district" || level === "local";
  if (filter === "local") return level === "local";
  return true;
}

export function IndicatorIndex({
  rows,
  topics,
}: {
  rows: IndicatorRow[];
  topics: TopicOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const topic = params.get("topic") ?? "all";
  const coverage = params.get("coverage") ?? "all";

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    // replace, not push: filtering is adjusting one destination, and a back
    // button full of filter states makes leaving the page take six presses.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          (topic === "all" || r.topicId === topic) &&
          matchesCoverage(r.coverageLevel, coverage),
      ),
    [rows, topic, coverage],
  );

  // Topics that still have something in them after filtering. A heading over
  // an empty list is the "Coming soon" pattern in another costume.
  const grouped = useMemo(() => {
    const byTopic = new Map<string, IndicatorRow[]>();
    for (const r of shown) {
      byTopic.set(r.topicId, [...(byTopic.get(r.topicId) ?? []), r]);
    }
    return topics
      .filter((t) => byTopic.has(t.id))
      .map((t) => ({ topic: t, rows: byTopic.get(t.id)! }));
  }, [shown, topics]);

  const filtered = topic !== "all" || coverage !== "all";

  return (
    <>
      {/* ------------------------------------------------------- controls */}
      {/*
        A bottom rule only. PageHeader already closes with one, and two rules
        a few pixels apart with nothing between them read as an empty section
        rather than as separation -- the same thing that went wrong under the
        place-page metric strip.
      */}
      <div className="border-line -mt-4 mb-10 border-b pb-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-2">
            <label
              htmlFor="topic-filter"
              className="text-label text-ink-faint uppercase"
            >
              Topic
            </label>
            <select
              id="topic-filter"
              value={topic}
              onChange={(e) => setParam("topic", e.target.value)}
              className="border-line text-ink focus-visible:outline-accent rounded-md border px-2 py-1 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              <option value="all">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="coverage-filter"
              className="text-label text-ink-faint uppercase"
            >
              Published
            </label>
            <select
              id="coverage-filter"
              value={coverage}
              onChange={(e) => setParam("coverage", e.target.value)}
              className="border-line text-ink focus-visible:outline-accent rounded-md border px-2 py-1 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-1"
            >
              {COVERAGE_FILTERS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <p className="text-ink-faint text-[12px]" aria-live="polite">
            {shown.length} of {rows.length} indicators
            {filtered && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={() => router.replace(pathname, { scroll: false })}
                  className="underline underline-offset-2"
                >
                  clear filters
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------- list */}
      {grouped.length === 0 && (
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          Nothing is published at that combination. Of {rows.length} indicators, only
          five go below the national level — all from the 2021 census.
        </p>
      )}

      {grouped.map(({ topic: t, rows: list }) => (
        <section key={t.id} className="mb-14">
          <h2 className="text-heading text-ink font-semibold">
            {/*
              The heading still links to the topic hub. The hub is not the
              duplicate -- it carries charts and a ranking this list cannot --
              so it keeps its URL and gains a way in from here.
            */}
            <Link href={`/topics/${t.slug}/`}>{t.name}</Link>
            {t.nameNe && (
              <span className="text-ink-faint ne ml-2 font-normal">{t.nameNe}</span>
            )}
          </h2>

          <ul className="divide-line border-line mt-4 divide-y border-t">
            {list.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-1 items-baseline gap-x-8 gap-y-3 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
              >
                <div>
                  <Link
                    href={`/indicators/${r.slug}/`}
                    className="text-[15px] font-medium"
                  >
                    {r.name}
                  </Link>
                  {r.nameNe && (
                    <span className="text-ink-faint ne ml-2 text-[13px]">
                      {r.nameNe}
                    </span>
                  )}
                  {r.definition && (
                    <p className="text-ink-faint mt-1 max-w-prose text-[12px] leading-relaxed">
                      {r.definition}
                    </p>
                  )}
                  <p className="text-ink-faint mt-1.5 text-[11px]">
                    {r.unitName}
                    {" · "}
                    {r.coverageLabel}
                    {r.hasTimeSeries && " · time series"}
                    {!r.additive && " · not additive"}
                    {r.publisher && ` · ${r.publisher}`}
                  </p>
                </div>

                {/* Latest value, right-aligned so the column scans as a column
                    of numbers rather than as prose. */}
                <div className="sm:text-right">
                  {r.value ? (
                    <>
                      <div className="text-ink tabular text-[1.25rem] leading-none font-semibold tracking-[-0.025em]">
                        {r.value.text}
                      </div>
                      {/* A distribution has no national total. Name the member
                          the figure belongs to, in the same breath as the
                          figure, so the column cannot be read as one of
                          national totals. */}
                      {r.leading && (
                        <div
                          className="text-ink-muted mt-1"
                          style={{ fontSize: TYPE.small }}
                        >
                          largest of {r.leading.memberCount}: {r.leading.memberName}
                        </div>
                      )}
                      <div className="text-ink-faint tabular mt-1 text-[11px]">
                        {r.value.period}
                        {r.value.status && ` ${r.value.status}`}
                      </div>
                    </>
                  ) : (
                    <span className="text-ink-faint text-[13px]">—</span>
                  )}
                </div>

                <div className="sm:w-33">
                  {r.points.length >= 3 && <Sparkline points={r.points.slice(-30)} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
