"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWithUnit } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { BAR, COLOR, TYPE } from "@/lib/viz";

/*
  Compare places on the same measures, at whatever level you have drilled to.

  The gap this fills: every place page showed its own values and, at best, a
  sibling list of one metric. There was no way to put four districts side by side
  on literacy, or to ask which of a province's local governments has the largest
  household size. The data supported all of it; the interface did not.

  Two properties make it feel like one thing rather than a widget per page:

  It is level-agnostic. The peers are whatever the page passes -- a province's
  districts, a district's local governments, the seven provinces -- so drilling
  down changes the rows and nothing else. The metric set, the layout, the
  ordering rules and the colour are identical at every level.

  Every metric is shown for every selected place, always. A comparison that
  silently omits a place because one measure is missing teaches a reader that
  absence means zero; a dash teaches them it means unpublished.

  Selection is the interaction, not a chart type. Bars stay bars.
*/

export type ComparePlace = {
  placeId: string;
  name: string;
  href: string | null;
  /** Value per indicator id. Missing keys render as a dash, never as zero. */
  values: Record<string, number>;
};

export type CompareMetric = {
  id: string;
  label: string;
  unit: Unit | undefined;
  /** Rates cannot be summed; the footer says so rather than offering a total. */
  isAdditive: boolean;
};

export function ComparePanel({
  places,
  metrics,
  subjectId,
  peerLabel,
  defaultMetricId,
}: {
  places: ComparePlace[];
  metrics: CompareMetric[];
  /** The place whose page this is, pre-selected and always shown. */
  subjectId?: string;
  peerLabel: string;
  defaultMetricId?: string;
}) {
  const [sortBy, setSortBy] = useState(defaultMetricId ?? metrics[0]?.id ?? "");
  /*
    Selection starts empty, meaning "all".

    Making a reader select before seeing anything would be a worse default than
    showing everything: the first question is what the spread looks like, and
    only then which few places to isolate.
  */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlySelected, setOnlySelected] = useState(false);

  const active = selected.size > 0;

  /*
    Selecting pins and highlights; it does not filter.

    The first version filtered on selection, which made multi-select impossible:
    ticking one row collapsed the table to that row, so the second checkbox you
    wanted was no longer on screen. Selection now moves rows to the top and marks
    them, and hiding the rest is a separate, explicit toggle that only appears
    once there is more than one thing to compare.
  */
  const shown = useMemo(() => {
    const base =
      onlySelected && active
        ? places.filter((p) => selected.has(p.placeId) || p.placeId === subjectId)
        : places;
    return [...base].sort((a, b) => {
      const aPinned = selected.has(a.placeId) || a.placeId === subjectId;
      const bPinned = selected.has(b.placeId) || b.placeId === subjectId;
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return (b.values[sortBy] ?? -Infinity) - (a.values[sortBy] ?? -Infinity);
    });
  }, [places, selected, active, onlySelected, sortBy, subjectId]);

  const sortMetric = metrics.find((m) => m.id === sortBy) ?? metrics[0];
  // One scale per metric across everything on offer, not just the selection, so
  // narrowing the selection does not silently rescale the bars underneath it.
  const maxOf = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of metrics) {
      out[m.id] = Math.max(
        ...places
          .map((p) => p.values[m.id])
          .filter((v): v is number => v !== undefined),
        0,
      );
    }
    return out;
  }, [places, metrics]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!metrics.length || !places.length) return null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2" style={{ fontSize: TYPE.body }}>
          <span className="text-ink-faint">Rank by</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border-line-strong bg-surface text-ink rounded-md border px-2 py-1"
            style={{ fontSize: TYPE.body }}
          >
            {metrics.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {selected.size > 1 && (
          <label
            className="text-ink-soft flex items-center gap-1.5"
            style={{ fontSize: TYPE.small }}
          >
            <input
              type="checkbox"
              checked={onlySelected}
              onChange={(e) => setOnlySelected(e.target.checked)}
              className="accent-brand"
            />
            Show only the {selected.size} selected
          </label>
        )}
        {active && (
          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setOnlySelected(false);
            }}
            className="text-link underline underline-offset-2"
            style={{ fontSize: TYPE.small }}
          >
            Clear selection
          </button>
        )}
        <span className="text-ink-faint" style={{ fontSize: TYPE.small }}>
          {active
            ? `${selected.size} selected, pinned to the top`
            : `${places.length} ${peerLabel} · tick rows to pin and compare`}
        </span>
      </div>

      <div className="border-line overflow-x-auto rounded-md border">
        <table
          className="w-full"
          style={{ fontSize: TYPE.body, minWidth: `${18 + metrics.length * 9}rem` }}
        >
          <caption className="sr-only">
            {peerLabel} compared on {metrics.map((m) => m.label).join(", ")}, ranked by{" "}
            {sortMetric?.label}
          </caption>
          <thead className="bg-surface-raised sticky top-0">
            <tr className="border-line border-b">
              <th
                scope="col"
                className="text-label text-ink-faint px-3 py-2 text-left uppercase"
              >
                {peerLabel}
              </th>
              {metrics.map((m) => (
                <th
                  key={m.id}
                  scope="col"
                  className="text-label text-ink-faint px-3 py-2 text-right uppercase"
                >
                  {/* The header is the sort control too: fewer places to look
                      for the same affordance. */}
                  <button
                    type="button"
                    onClick={() => setSortBy(m.id)}
                    aria-pressed={m.id === sortBy}
                    className={m.id === sortBy ? "text-ink" : "hover:text-ink-soft"}
                  >
                    {m.label}
                    {m.id === sortBy && <span aria-hidden> ↓</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const isSubject = p.placeId === subjectId;
              const isPicked = selected.has(p.placeId);
              return (
                <tr
                  key={p.placeId}
                  className={`border-line border-b last:border-0 ${
                    isSubject ? "bg-selected" : isPicked ? "bg-surface-sunken" : ""
                  }`}
                >
                  <th scope="row" className="px-3 py-1.5 text-left font-normal">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => toggle(p.placeId)}
                        aria-label={`Compare ${p.name}`}
                        className="accent-brand"
                      />
                      {p.href && !isSubject ? (
                        <Link href={p.href}>{p.name}</Link>
                      ) : (
                        <span
                          className={isSubject ? "text-ink font-medium" : "text-ink"}
                        >
                          {p.name}
                        </span>
                      )}
                    </span>
                  </th>

                  {metrics.map((m) => {
                    const v = p.values[m.id];
                    return (
                      <td key={m.id} className="px-3 py-1.5">
                        {v === undefined ? (
                          <span
                            className="text-ink-faint block text-right"
                            title="Not published for this place"
                          >
                            —
                          </span>
                        ) : (
                          <span className="flex items-center justify-end gap-2">
                            {/* A bar behind every number, on that metric's own
                                scale, so a row can be read across as well as a
                                column read down. */}
                            <span
                              aria-hidden
                              className="hidden overflow-hidden sm:block"
                              style={{
                                width: 56,
                                height: BAR.thicknessCompact - 2,
                                background: COLOR.track,
                                borderRadius: BAR.radius,
                              }}
                            >
                              <span
                                className="block h-full"
                                style={{
                                  width: `${maxOf[m.id] > 0 ? (v / maxOf[m.id]) * 100 : 0}%`,
                                  background:
                                    m.id === sortBy ? COLOR.series : COLOR.boundary,
                                }}
                              />
                            </span>
                            <span
                              className={`tabular ${isSubject ? "text-ink font-medium" : "text-ink-soft"}`}
                            >
                              {formatWithUnit(v, m.unit)}
                            </span>
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p
        className="text-ink-faint mt-2 max-w-prose leading-relaxed"
        style={{ fontSize: TYPE.small }}
      >
        Bars are scaled within each column, so columns compare places and rows compare
        measures. A dash means the figure is not published for that place, which is not
        the same as zero.
        {metrics.some((m) => !m.isAdditive) &&
          " Rates are not additive across places and are never totalled."}
      </p>
    </div>
  );
}
