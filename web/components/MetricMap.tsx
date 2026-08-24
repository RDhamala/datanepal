"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatWithUnit } from "@/lib/format";
import type { Unit } from "@/lib/types";

/*
  A map you can ask more than one question of.

  Every map on the site until now shaded by exactly one thing, chosen at build
  time. That was fine when population was the only statistic below district
  level. The census brought households, literacy, literate population and the
  5-plus base, and a static map means a reader can see one of them and has to
  take the rest on faith from a table.

  So: the shapes, the projection and the label placement are all still computed
  at build time -- none of that depends on which metric is showing -- and the
  only thing the browser does is recolour and rewrite the legend. That keeps the
  interaction cheap and keeps the geometry out of the client bundle.

  It degrades honestly. This is a client component, so Next renders the first
  metric into the HTML: with no JavaScript a reader gets a complete, labelled,
  correctly shaded map of the default metric plus the full data table, and loses
  only the ability to switch. Every shape stays a real link either way.
*/

export type MetricMapFeature = {
  placeId: string;
  name: string;
  href: string | null;
  /** Pre-projected SVG path, built at build time. */
  path: string;
  /** Label lines and position, already laid out. */
  label: { lines: string[]; x: number; y: number; fontSize: number } | null;
  /** Dot for a shape whose name did not fit. */
  dot: { x: number; y: number } | null;
};

export type Metric = {
  id: string;
  label: string;
  unit: Unit | undefined;
  /** Value per placeId. A place may be missing from a metric. */
  values: Record<string, number>;
  /** Higher is not always better; this only affects the wording, not the ramp. */
  note?: string;
};

const RAMP = [
  "var(--color-seq-1)",
  "var(--color-seq-2)",
  "var(--color-seq-3)",
  "var(--color-seq-4)",
  "var(--color-seq-5)",
];

/**
 * Quantile class breaks.
 *
 * Recomputed per metric, because the right classing depends on the
 * distribution: population across Nepal's districts is dominated by Kathmandu,
 * while literacy is tightly clustered in the seventies and eighties. One set of
 * breaks reused across both would flatten whichever it was not chosen for.
 */
function quantileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length < 5) {
    const lo = sorted[0] ?? 0;
    const hi = sorted.at(-1) ?? 1;
    return [1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 5);
  }
  return [1, 2, 3, 4].map((k) => sorted[Math.floor((k / 5) * sorted.length)]);
}

export function MetricMap({
  features,
  metrics,
  width,
  height,
  caption,
  outlinePath,
}: {
  features: MetricMapFeature[];
  metrics: Metric[];
  width: number;
  height: number;
  caption: React.ReactNode;
  /** Heavier grouping boundary, drawn over the fills. */
  outlinePath?: string;
}) {
  const [metricId, setMetricId] = useState(metrics[0]?.id ?? "");
  const [hovered, setHovered] = useState<string | null>(null);

  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0];

  const { breaks, binOf } = useMemo(() => {
    const values = features
      .map((f) => metric?.values[f.placeId])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const b = quantileBreaks(values);
    return {
      breaks: b,
      binOf: (v: number | undefined) => {
        if (typeof v !== "number" || !Number.isFinite(v)) return null;
        let i = 0;
        while (i < b.length && v >= b[i]) i++;
        return i;
      },
    };
  }, [features, metric]);

  if (!metric) return null;

  const lo = Math.min(...Object.values(metric.values));
  const hi = Math.max(...Object.values(metric.values));
  const fmt = (v: number) => formatWithUnit(v, metric.unit);
  const hoveredFeature = features.find((f) => f.placeId === hovered);

  return (
    <figure className="m-0">
      {/* Metric selector. Real buttons, so it is keyboard reachable and each
          option announces its pressed state. */}
      {metrics.length > 1 && (
        <div
          role="group"
          aria-label="Shade the map by"
          className="mb-4 flex flex-wrap gap-1.5"
        >
          {metrics.map((m) => {
            const active = m.id === metric.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMetricId(m.id)}
                className={`rounded-md border px-2.5 py-1 text-[12px] ${
                  active
                    ? "border-line-strong bg-selected text-ink font-medium"
                    : "border-line text-ink-soft hover:bg-surface-sunken"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: `${width}px`, maxWidth: "100%", height: "auto" }}
        role="img"
        aria-label={`Map shaded by ${metric.label}. ${features.length} areas. Values are in the table below.`}
      >
        {features.map((f) => {
          const value = metric.values[f.placeId];
          const bin = binOf(value);
          const shape = (
            <>
              <title>{`${f.name}${value !== undefined ? ` — ${fmt(value)}` : " — no data"}`}</title>
              <path
                d={f.path}
                className="geo-district"
                fill={bin === null ? "var(--color-surface-sunken)" : RAMP[bin]}
              />
            </>
          );
          return (
            <g
              key={f.placeId}
              onMouseEnter={() => setHovered(f.placeId)}
              onMouseLeave={() => setHovered((h) => (h === f.placeId ? null : h))}
            >
              {f.href ? <Link href={f.href}>{shape}</Link> : shape}
            </g>
          );
        })}

        {outlinePath && <path d={outlinePath} className="geo-province-outline" />}

        {features.map((f) =>
          f.dot ? (
            <circle
              key={`dot-${f.placeId}`}
              cx={f.dot.x}
              cy={f.dot.y}
              r={1.3}
              fill="var(--color-ink-soft)"
              pointerEvents="none"
            />
          ) : null,
        )}

        {features.map((f) => {
          if (!f.label) return null;
          const bin = binOf(metric.values[f.placeId]);
          // Dark fills need light ink, and which fills are dark changes with the
          // metric -- so the label colour has to be decided here rather than at
          // build time with the rest of the layout.
          const ink =
            bin !== null && bin >= 3 ? "var(--color-surface)" : "var(--color-ink)";
          const top =
            f.label.y - ((f.label.lines.length - 1) * f.label.fontSize * 1.15) / 2;
          return (
            <text
              key={`label-${f.placeId}`}
              x={f.label.x}
              y={top + f.label.fontSize * 0.35}
              textAnchor="middle"
              className="font-medium"
              fontSize={f.label.fontSize}
              fill={ink}
              pointerEvents="none"
            >
              {f.label.lines.map((line, j) => (
                <tspan
                  key={j}
                  x={f.label!.x}
                  dy={j === 0 ? 0 : f.label!.fontSize * 1.15}
                >
                  {line}
                </tspan>
              ))}
            </text>
          );
        })}
      </svg>

      <figcaption className="mt-4">
        {/* Legend, with the real class boundaries. A quantile scale has uneven
            classes and a smooth ramp would lie about that. */}
        <div className="max-w-md">
          <div className="flex h-2.5 gap-px overflow-hidden rounded-sm">
            {RAMP.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <div className="text-ink-faint tabular mt-1.5 flex justify-between text-[11px]">
            {[lo, ...breaks, hi].map((v, i) => (
              <span key={i}>{fmt(v)}</span>
            ))}
          </div>
        </div>

        {/*
          Hover readout in a fixed slot, not a floating tooltip. A tooltip that
          follows the cursor covers the shapes next to the one being read, which
          on a map of eleven local governments is most of them. The slot keeps
          its height whether or not anything is hovered, so nothing below it
          moves as the pointer travels.
        */}
        <p aria-live="polite" className="text-ink-soft mt-3 min-h-[1.4rem] text-[13px]">
          {hoveredFeature ? (
            <>
              <span className="text-ink font-medium">{hoveredFeature.name}</span>{" "}
              <span className="tabular">
                {metric.values[hoveredFeature.placeId] !== undefined
                  ? fmt(metric.values[hoveredFeature.placeId])
                  : "no data"}
              </span>
              <span className="text-ink-faint"> · {metric.label}</span>
            </>
          ) : (
            <span className="text-ink-faint">
              {metrics.length > 1
                ? "Choose a measure above; hover or focus an area for its value."
                : "Hover or focus an area for its value."}
            </span>
          )}
        </p>

        <p className="text-ink-faint mt-2 max-w-prose text-[11px] leading-relaxed">
          {metric.label}
          {metric.note && ` · ${metric.note}`} · five classes, each holding about{" "}
          {Math.round(features.length / 5)} of {features.length} areas. {caption}
        </p>
      </figcaption>

      <details className="mt-4">
        <summary className="text-ink-faint hover:text-ink-soft cursor-pointer text-[12px]">
          View all {features.length} values
        </summary>
        <div className="border-line mt-3 max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-[13px]">
            <thead className="bg-surface-raised sticky top-0">
              <tr className="border-line border-b">
                <th
                  scope="col"
                  className="text-label text-ink-faint px-3 py-2 text-left uppercase"
                >
                  Area
                </th>
                {/* Every metric, not just the selected one: the table is where a
                    reader compares across measures, which no single shading can
                    do. */}
                {metrics.map((m) => (
                  <th
                    key={m.id}
                    scope="col"
                    className="text-label text-ink-faint px-3 py-2 text-right uppercase"
                  >
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...features]
                .sort(
                  (a, b) =>
                    (metric.values[b.placeId] ?? -Infinity) -
                    (metric.values[a.placeId] ?? -Infinity),
                )
                .map((f) => (
                  <tr key={f.placeId} className="border-line border-b last:border-0">
                    <td className="px-3 py-1.5">
                      {f.href ? <Link href={f.href}>{f.name}</Link> : f.name}
                    </td>
                    {metrics.map((m) => (
                      <td
                        key={m.id}
                        className="text-ink-soft tabular px-3 py-1.5 text-right"
                      >
                        {m.values[f.placeId] !== undefined
                          ? formatWithUnit(m.values[f.placeId], m.unit)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
