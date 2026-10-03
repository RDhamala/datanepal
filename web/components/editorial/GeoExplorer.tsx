"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { Metric, MetricMapFeature } from "@/components/MetricMap";
import { MapLabelLayer } from "@/components/MapLabels";
import { formatWithUnit } from "@/lib/format";
import { binFor, quantileBreaks } from "@/lib/viz";

/*
  Direction B's behaviour in Direction A's clothes.

  Kept from B: map and ranking are one control, hover and focus both drive the
  highlight, the measure switcher, every shape a real link.

  Dropped from B: the rounded card, the dark chrome, the black pill controls.
  This reads as a figure in a publication -- hairline rules, text-style tabs,
  sans metadata -- not as a dashboard panel.
*/

const RAMP = [
  "var(--color-seq-1)",
  "var(--color-seq-2)",
  "var(--color-seq-3)",
  "var(--color-seq-4)",
  "var(--color-seq-5)",
];

export type GeoRow = {
  placeId: string;
  name: string;
  nameNe: string | null;
  href: string;
};

export function GeoExplorer({
  features,
  metrics,
  rows,
  width,
  height,
  outlinePath,
  title,
  source,
  /** Ranking before map on small screens, where tiny labels help nobody. */
  rankingFirstOnMobile = true,
}: {
  features: MetricMapFeature[];
  metrics: Metric[];
  rows: GeoRow[];
  width: number;
  height: number;
  outlinePath?: string;
  title: string;
  source?: React.ReactNode;
  rankingFirstOnMobile?: boolean;
}) {
  const [metricIndex, setMetricIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const uid = useId();
  const metric = metrics[metricIndex];

  const binOf = useMemo(() => {
    const b = quantileBreaks(
      Object.values(metric?.values ?? {}).filter(Number.isFinite),
      5,
    );
    return (v?: number) => (v === undefined ? null : binFor(v, b));
  }, [metric]);

  const ranked = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, value: metric?.values[r.placeId] }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [rows, metric],
  );

  const fmt = (v?: number) =>
    v === undefined ? "No data" : formatWithUnit(v, metric?.unit);
  const active = activeId
    ? {
        name: rows.find((r) => r.placeId === activeId)?.name ?? "",
        value: metric?.values[activeId],
      }
    : null;
  const all = Object.values(metric?.values ?? {});
  // Bars behind the ranking, so the list reads as a chart rather than a table.
  // Zero-based, like every other bar on the site.
  const barMax = all.length ? Math.max(...all) : 0;

  return (
    <figure className="m-0">
      {/* Measure tabs and the live readout share a line: the readout replaces
          the paragraph that used to explain what hovering does. */}
      {/* ------------------------------------------- measure switch (tabs) */}
      <div className="border-line mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b">
        {metrics.length > 1 ? (
          <div
            role="group"
            aria-label="Shade the map by"
            className="flex flex-wrap gap-x-5"
          >
            {metrics.map((m, i) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetricIndex(i)}
                aria-pressed={i === metricIndex}
                className={`focus-visible:outline-accent -mb-px flex min-h-11 items-end border-b-2 px-0.5 pb-2.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-h-0 ${
                  i === metricIndex
                    ? "border-brand text-ink font-medium"
                    : "text-ink-faint hover:text-ink-soft border-transparent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}

        {/* Live readout. Replaces "point at a province to highlight it". */}
        <p className="text-ink-soft pb-2.5 text-[12.5px]" aria-live="polite">
          {active ? (
            <>
              <span className="text-ink font-medium">{active.name}</span>
              <span className="text-ink-faint"> · </span>
              <span className="tabular">{fmt(active.value)}</span>
            </>
          ) : (
            <span className="text-ink-faint">{features.length} areas · select one</span>
          )}
        </p>
      </div>

      <div
        className={`grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)] lg:gap-10 ${
          rankingFirstOnMobile ? "" : ""
        }`}
      >
        {/* ----------------------------------------------------------- map */}
        <div className={rankingFirstOnMobile ? "order-2 lg:order-1" : "order-1"}>
          {/* Centred, not stretched. A tall district fills its column's height
              long before its width, so forcing the width would only scale the
              labels. The map and its legend share one measure and sit as a
              plate on the page. */}
          <div className="mx-auto" style={{ maxWidth: width }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              // Never wider than the frame its labels were laid out for.
              style={{ maxWidth: width }}
              className="h-auto w-full"
              role="group"
              aria-label={`${title}. ${metric?.label}. ${features.length} areas, each a link. The same values are ranked beside the map.`}
            >
              {features.map((f) => {
                const v = metric?.values[f.placeId];
                const bin = binOf(v);
                const on = activeId === f.placeId;
                const shape = (
                  <path
                    d={f.path}
                    fill={bin === null ? "var(--color-surface-inset)" : RAMP[bin]}
                    stroke={on ? "var(--color-ink)" : "var(--color-surface)"}
                    strokeWidth={on ? 1.6 : 0.5}
                  />
                );
                return f.href ? (
                  <Link
                    key={f.placeId}
                    href={f.href}
                    aria-label={`${f.name}, ${fmt(v)}`}
                    onMouseEnter={() => setActiveId(f.placeId)}
                    onMouseLeave={() => setActiveId(null)}
                    onFocus={() => setActiveId(f.placeId)}
                    onBlur={() => setActiveId(null)}
                  >
                    {shape}
                  </Link>
                ) : (
                  <g key={f.placeId}>{shape}</g>
                );
              })}

              {outlinePath && (
                <path
                  d={outlinePath}
                  fill="none"
                  stroke="var(--color-ink-faint)"
                  strokeWidth={0.9}
                />
              )}

              {/*
              Labels off below 640px. At 390px the map renders 350px wide from
              an 840px frame, so a 14px label lands at 5.7px -- noise, not a
              name. The ranking sits directly above on mobile and carries every
              name in full, so nothing is lost.
            */}
              <g className="hidden sm:block">
                <MapLabelLayer
                  labels={features
                    .filter((f) => f.label)
                    .map((f) => ({
                      at: { x: f.label!.x, y: f.label!.y },
                      lines: f.label!.lines,
                      fontSize: f.label!.fontSize,
                    }))}
                  dots={features
                    .filter((f) => f.dot)
                    .map((f) => ({ x: f.dot!.x, y: f.dot!.y }))}
                />
              </g>
            </svg>

            {/* Continuous ramp with its ends labelled. The class-break list it
              replaces was five numbers nobody reads. */}
            <div className="mt-4">
              <div
                className="h-1.5 rounded-full"
                aria-hidden="true"
                style={{
                  background:
                    "linear-gradient(to right, var(--color-seq-1), var(--color-seq-2), var(--color-seq-3), var(--color-seq-4), var(--color-seq-5))",
                }}
              />
              <div className="text-ink-faint tabular mt-1.5 flex justify-between text-[11px]">
                <span>{fmt(Math.min(...all))}</span>
                <span>{fmt(Math.max(...all))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- ranking */}
        <div className={rankingFirstOnMobile ? "order-1 lg:order-2" : "order-2"}>
          <p
            id={`${uid}-rank`}
            className="text-ink-faint mb-1.5 text-[11px] uppercase"
            style={{ letterSpacing: "0.07em" }}
          >
            {metric?.label}, ranked
          </p>
          <ol
            aria-labelledby={`${uid}-rank`}
            className="divide-line divide-y text-[13px]"
          >
            {ranked.map((r, i) => (
              <li key={r.placeId}>
                <Link
                  href={r.href}
                  onMouseEnter={() => setActiveId(r.placeId)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(r.placeId)}
                  onBlur={() => setActiveId(null)}
                  className={`focus-visible:outline-accent -mx-3 flex min-h-11 items-center gap-3 rounded-md px-3 py-[7px] no-underline transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 sm:min-h-0 ${
                    activeId === r.placeId
                      ? "bg-surface-accent"
                      : "hover:bg-surface-raised"
                  }`}
                >
                  <span className="text-ink-faint tabular w-4 shrink-0 text-[11px]">
                    {i + 1}
                  </span>
                  <span className="text-ink w-[6.5rem] shrink-0 truncate">
                    {r.name}
                  </span>
                  <span
                    className="bg-surface-sunken relative hidden h-2.5 flex-1 sm:block"
                    aria-hidden="true"
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width,background] duration-200"
                      style={{
                        width: `${barMax > 0 && r.value !== undefined ? (r.value / barMax) * 100 : 0}%`,
                        background:
                          activeId === r.placeId
                            ? "var(--color-ink)"
                            : "var(--color-series-1)",
                      }}
                    />
                  </span>
                  <span className="text-ink tabular ml-auto shrink-0 sm:ml-0">
                    {fmt(r.value)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {source && <div className="text-ink-faint mt-4 text-[11px]">{source}</div>}
    </figure>
  );
}
