"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts";

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
  /** First and last year with a national value. Null for a snapshot. */
  span: { from: number; to: number } | null;
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

/*
  How deep the catalogue goes, drawn rather than asserted.

  "Five of 36 measures go below the national level" was a sentence in a
  paragraph, and it is the single fact a reader arrives with: can I get this
  for my district? A bar per depth answers it before any reading, and it
  responds to the filters, so narrowing to one topic shows that topic's shape.
*/
const DEPTHS = [
  { level: "local", label: "To local government" },
  { level: "district", label: "To district" },
  { level: "province", label: "To province" },
  { level: "national", label: "National only" },
] as const;

function CoverageStrip({ rows }: { rows: IndicatorRow[] }) {
  const counts = DEPTHS.map((d) => ({
    ...d,
    n: rows.filter((r) => r.coverageLevel === d.level).length,
  })).filter((d) => d.n > 0);
  if (!rows.length) return null;
  const max = Math.max(...counts.map((c) => c.n));

  return (
    <figure className="m-0 mb-11 max-w-lg">
      <figcaption className="text-label text-ink-faint mb-3 uppercase">
        How deep the data goes
      </figcaption>
      <ul className="space-y-1.5">
        {counts.map((c) => (
          <li
            key={c.level}
            className="grid grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)_2rem] items-center gap-3"
          >
            <span className="text-ink-soft truncate text-[12px]">{c.label}</span>
            <span
              className="bg-surface-sunken block h-2.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <span
                className="bg-series-1 block h-full rounded-full"
                style={{ width: `${(c.n / max) * 100}%` }}
              />
            </span>
            <span className="text-ink tabular text-right text-[12px]">{c.n}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/*
  A measure's period, as a position on the catalogue's own timeline.

  A bar from 1960 to 2025 and a bar from 2021 to 2021 are different kinds of
  thing, and the list used to say so only in small grey type at the end of a
  row. Drawn against one shared domain, a census snapshot is a tick and a World
  Bank series is a rule across the whole width -- the comparison the reader
  wants is "how much history is there", and it is answered by shape.
*/
function SpanBar({
  span,
  period,
  from,
  to,
}: {
  span: { from: number; to: number } | null;
  period: string | null;
  from: number;
  to: number;
}) {
  const domain = to - from || 1;
  const at = (y: number) => ((y - from) / domain) * 100;
  const snapshotYear = span ? null : Number(period);
  const hasTick = snapshotYear !== null && Number.isFinite(snapshotYear);

  return (
    <div className="w-full">
      <div className="bg-surface-sunken relative h-1 rounded-full" aria-hidden="true">
        {span ? (
          <span
            className="bg-series-1 absolute inset-y-0 rounded-full"
            style={{
              left: `${at(span.from)}%`,
              width: `${Math.max(at(span.to) - at(span.from), 1.5)}%`,
            }}
          />
        ) : hasTick ? (
          <span
            className="bg-series-2 absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${at(snapshotYear)}%` }}
          />
        ) : null}
      </div>
      <p className="text-ink-faint tabular mt-1.5 text-[10.5px]">
        {span ? `${span.from}–${span.to}` : hasTick ? "one period" : "—"}
      </p>
    </div>
  );
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

  /*
    One shared year domain for every span bar, taken from the whole catalogue
    rather than from what is on screen. If it moved with the filter, the same
    measure would draw a different length depending on what else was listed,
    and the comparison the bars exist to support would be a lie.
  */
  const domain = useMemo(() => {
    const years = rows.flatMap((r) =>
      r.span ? [r.span.from, r.span.to] : r.value ? [Number(r.value.period)] : [],
    );
    const ok = years.filter((y) => Number.isFinite(y));
    return ok.length
      ? { from: Math.min(...ok), to: Math.max(...ok) }
      : { from: 0, to: 1 };
  }, [rows]);

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

      {/* ------------------------------------------------------ coverage */}
      <CoverageStrip rows={shown} />

      {/* ---------------------------------------------------------- list */}
      {grouped.length === 0 && (
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          Nothing is published at that combination. Of {rows.length} indicators, only
          five go below the national level — all from the 2021 census.
        </p>
      )}

      {/*
        An open list, with topic as a heading rather than a lid.

        This was a run of `<details>`, collapsed by default, which made the
        page O(topics) tall instead of O(indicators). That was the right
        instinct about length and the wrong trade: the page's first impression
        was ten grey rows and no data, and the one chart it had was behind a
        click. A catalogue that shows nothing until you open it is a table of
        contents, not an index.

        Length is solved where it was actually coming from. Each row carried
        its definition as a paragraph -- 185px a row, 6,686px of page -- and
        the definition is on the indicator's own page, one click away, next to
        the chart that gives it context. Without it the unfiltered list
        measures 4,848px with all 36 rows, 36 span bars and 28 sparklines
        showing, against 6,686px that showed none of them.

        The topic dropdown above still narrows to one domain, which is what
        the lids were really being used for.
      */}
      {grouped.map(({ topic: t, rows: list, deepestLabel, series }) => (
        <section
          key={t.id}
          /*
            Sized to the row, not to the viewport. With the name column as a
            bare `1fr` it took 600px at 1440 and opened a 560px gap between a
            measure's name and its value -- the same stretch that left the
            About page's sidebar floating away from its prose.
          */
          className="border-line max-w-[61rem] border-t pt-6 pb-2 first:border-t-0"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h2 className="text-heading text-ink font-semibold">
              {t.name}
              {t.nameNe && (
                <span className="text-ink-faint ne ml-2 font-normal" lang="ne">
                  {t.nameNe}
                </span>
              )}
            </h2>
            <p className="text-ink-faint text-[12px]">
              {list.length} indicator{list.length === 1 ? "" : "s"} · {deepestLabel}
              {series > 0 && ` · ${series} with a time series`}
              {" · "}
              <Link href={`/topics/${t.slug}/`}>charts and rankings →</Link>
            </p>
          </div>

          <ul className="divide-line mb-6 divide-y">
            {list.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 py-3.5 sm:grid-cols-[minmax(0,1fr)_9rem_13rem_8.25rem]"
              >
                <div className="min-w-0">
                  <Link
                    href={`/indicators/${r.slug}/`}
                    className="text-[14px] font-medium"
                  >
                    {r.name}
                  </Link>
                  {r.nameNe && (
                    <span className="text-ink-faint ne ml-2 text-[12px]" lang="ne">
                      {r.nameNe}
                    </span>
                  )}
                  <p className="text-ink-faint mt-0.5 text-[11px]">
                    {[r.unitName, r.coverageLabel, r.publisher]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="text-right sm:text-left">
                  {r.value ? (
                    <>
                      <div className="text-ink tabular text-[15px] font-medium">
                        {r.value.text}
                      </div>
                      {/* A distribution has no national total. Name the member
                          the figure belongs to, so the column cannot be read
                          as one of national totals. */}
                      {r.leading && (
                        <div className="text-ink-faint mt-0.5 text-[10.5px]">
                          largest of {r.leading.memberCount}: {r.leading.memberName}
                        </div>
                      )}
                      {/* The period and its status travel with the figure.
                          A projection shown as a bare number is the one
                          mistake this platform cannot make. */}
                      <div className="text-ink-faint tabular mt-0.5 text-[10.5px]">
                        {r.value.period}
                        {r.value.status && ` ${r.value.status}`}
                      </div>
                    </>
                  ) : (
                    <span className="text-ink-faint text-[13px]">—</span>
                  )}
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <SpanBar
                    span={r.span}
                    period={r.value?.period ?? null}
                    from={domain.from}
                    to={domain.to}
                  />
                </div>

                <div className="hidden sm:block">
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
