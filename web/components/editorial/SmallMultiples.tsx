"use client";

import Link from "next/link";
import type { Metric } from "@/components/MetricMap";
import { formatWithUnit } from "@/lib/format";

/*
  Small multiples: one compact chart per measure, all visible at once.

  This replaces a tab strip. Tabs hide every measure but one and make the
  reader hold the others in memory to compare them -- three clicks to answer
  "is the biggest place also the most literate". Side by side, that question is
  answered by looking.

  **One shared order, set by the first measure.** That is the whole point: when
  every chart lists places in the same order, a bar that breaks the staircase
  is visible immediately. Sorting each chart independently would turn three
  comparable shapes into three unrelated rankings.
*/

export type MultipleRow = {
  placeId: string;
  name: string;
  href: string;
};

export function SmallMultiples({
  metrics,
  rows,
  activeId,
  onActivate,
  limit = 8,
}: {
  metrics: Metric[];
  rows: MultipleRow[];
  activeId?: string | null;
  onActivate?: (id: string | null) => void;
  /** Rows shown per chart. The rest are in the page's exact-data table. */
  limit?: number;
}) {
  if (!metrics.length || !rows.length) return null;

  const lead = metrics[0];
  const order = [...rows].sort(
    (a, b) =>
      (lead.values[b.placeId] ?? -Infinity) - (lead.values[a.placeId] ?? -Infinity),
  );
  const shown = order.slice(0, limit);
  const hidden = order.length - shown.length;

  return (
    <div>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => {
          const values = Object.values(m.values).filter(Number.isFinite);
          const max = values.length ? Math.max(...values) : 0;
          return (
            <div key={m.id}>
              <p className="text-ink mb-3 text-[13px] font-semibold">{m.label}</p>
              <ul className="space-y-[3px]">
                {shown.map((r) => {
                  const v = m.values[r.placeId];
                  const on = activeId === r.placeId;
                  return (
                    <li key={r.placeId}>
                      <Link
                        href={r.href}
                        onMouseEnter={() => onActivate?.(r.placeId)}
                        onMouseLeave={() => onActivate?.(null)}
                        onFocus={() => onActivate?.(r.placeId)}
                        onBlur={() => onActivate?.(null)}
                        className={`focus-visible:outline-accent -mx-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded px-2 py-[3px] no-underline transition-colors focus-visible:outline-2 ${
                          on ? "bg-surface-accent" : "hover:bg-surface-raised"
                        }`}
                      >
                        <span className="text-ink-soft truncate text-[12px]">
                          {r.name}
                        </span>
                        <span className="text-ink tabular text-[12px] whitespace-nowrap">
                          {v === undefined ? "—" : formatWithUnit(v, m.unit)}
                        </span>
                        <span
                          className="bg-surface-inset col-span-2 h-[5px] overflow-hidden rounded-full"
                          aria-hidden="true"
                        >
                          <span
                            className="block h-full rounded-full transition-[width,background] duration-200"
                            style={{
                              width: `${max > 0 && v !== undefined ? (v / max) * 100 : 0}%`,
                              background: on
                                ? "var(--color-ink)"
                                : "var(--color-series-1)",
                            }}
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-ink-faint mt-5 text-[11px] leading-relaxed">
        Every chart lists places in the same order, set by {lead.label.toLowerCase()},
        so a bar out of step is a place that ranks differently on that measure.
        {hidden > 0 && ` ${hidden} more in the table below.`}
      </p>
    </div>
  );
}
