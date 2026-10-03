"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  /*
    The filter state is read from the address on mount, not through
    useSearchParams.

    useSearchParams opts a component out of prerendering, and in a static
    export that means the Suspense fallback is what gets written to the HTML
    file. This list shipped empty for one commit: every indicator was in the
    RSC payload and none was in the document, so a crawler and a reader with
    JavaScript off both saw an Indicators page with no indicators. It passed
    typecheck, lint, 119 tests and the page checker, because all of them
    either run JavaScript or do not look.

    Reading window.location after mount costs one render and keeps the
    unfiltered list -- which is exactly what a crawler should see -- in the
    static HTML.
  */
  const [topic, setTopic] = useState("all");
  const [coverage, setCoverage] = useState("all");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setTopic(p.get("topic") ?? "all");
    setCoverage(p.get("coverage") ?? "all");
  }, []);

  const setParam = (key: string, value: string) => {
    if (key === "topic") setTopic(value);
    else setCoverage(value);
    const next = new URLSearchParams(window.location.search);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    // replaceState, not push: filtering is adjusting one destination, and a
    // back button full of filter states makes leaving the page take six
    // presses. No router call, so the page does not re-render from the top.
    window.history.replaceState(
      null,
      "",
      query ? `${window.location.pathname}?${query}` : window.location.pathname,
    );
  };

  const clear = () => {
    setTopic("all");
    setCoverage("all");
    window.history.replaceState(null, "", window.location.pathname);
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
    const rank: Record<string, number> = {
      national: 0,
      province: 1,
      district: 2,
      local: 3,
    };
    return topics
      .filter((t) => byTopic.has(t.id))
      .map((t) => {
        const list = byTopic.get(t.id)!;
        // The deepest level anything in this topic reaches, so the closed row
        // answers "is there anything here for my district" without opening.
        const deepest = list.reduce(
          (best, r) =>
            (rank[r.coverageLevel] ?? 0) > (rank[best] ?? 0) ? r.coverageLevel : best,
          "national",
        );
        return {
          topic: t,
          rows: list,
          deepestLabel:
            list.find((r) => r.coverageLevel === deepest)?.coverageLabel ?? "National",
          series: list.filter((r) => r.hasTimeSeries).length,
        };
      });
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
                  onClick={clear}
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

      {/*
        A topic is a disclosure, not a run of rows.

        The page was 6,686px on a desktop and 10,685px on a phone, and a reader
        could not see which ten domains exist without scrolling past all of
        them. Worse, its height was a function of how much had been ingested:
        36 indicators today, and the platform intends to hold many times that.

        Collapsing by topic makes the length O(topics) rather than
        O(indicators), so ingestion stops lengthening the page. The closed row
        still carries what a reader needs to choose -- the count, how deep the
        topic goes, how many of its measures have a time series -- and the
        rows stay in the HTML, so a crawler and a reader with no JavaScript
        both get the whole index. details/summary needs no script at all.

        Any active filter opens every matching topic: a reader who has just
        narrowed to five indicators should see five indicators, not five
        closed boxes. The key remounts the element when that changes, so
        manual toggles survive until the filters move.
      */}
      {grouped.map(({ topic: t, rows: list, deepestLabel, series }) => (
        <details
          key={`${t.id}-${filtered}`}
          open={filtered}
          className="border-line group border-b"
        >
          <summary className="focus-visible:outline-accent cursor-pointer list-none py-5 focus-visible:outline-2 focus-visible:outline-offset-2">
            <span className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <span className="text-heading text-ink font-semibold">
                <span className="text-ink-faint mr-2 inline-block transition-transform group-open:rotate-90">
                  ›
                </span>
                {t.name}
                {t.nameNe && (
                  <span className="text-ink-faint ne ml-2 font-normal">{t.nameNe}</span>
                )}
              </span>
              <span className="text-ink-faint text-[12px]">
                {list.length} indicator{list.length === 1 ? "" : "s"} · {deepestLabel}
                {series > 0 && ` · ${series} with a time series`}
              </span>
            </span>
          </summary>

          {/*
            The hub keeps its link, below the summary rather than inside it:
            a link inside a summary is a control that does two things
            depending on where you click it.
          */}
          <p className="text-ink-faint mb-3 text-[12px]">
            <Link href={`/topics/${t.slug}/`}>Charts and rankings for {t.name} →</Link>
          </p>

          <ul className="divide-line border-line mb-6 divide-y border-t">
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
        </details>
      ))}
    </>
  );
}
