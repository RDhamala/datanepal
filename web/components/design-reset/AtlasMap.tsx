"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import type { Metric, MetricMapFeature } from "@/components/MetricMap";
import { MapLabelLayer } from "@/components/MapLabels";
import { formatNumber, formatWithUnit } from "@/lib/format";
import { quantileBreaks, binFor } from "@/lib/viz";

/*
  Map and ranking as one control: pointing at either highlights both.

  Hover is enhancement only. Every shape and row is a real anchor, and the
  highlight responds to focus too, so a keyboard walk lights up the map.
*/

const RAMP = [
  "var(--color-seq-1)",
  "var(--color-seq-2)",
  "var(--color-seq-3)",
  "var(--color-seq-4)",
  "var(--color-seq-5)",
];

export type AtlasRow = {
  placeId: string;
  name: string;
  nameNe: string | null;
  href: string;
};

export function AtlasMap({
  features,
  metrics,
  rows,
  width,
  height,
  outlinePath,
  title,
  note,
}: {
  features: MetricMapFeature[];
  metrics: Metric[];
  rows: AtlasRow[];
  width: number;
  height: number;
  outlinePath?: string;
  title: string;
  note?: string;
}) {
  const [metricIndex, setMetricIndex] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const groupId = useId();

  const metric = metrics[metricIndex];

  const { binOf, breaks } = useMemo(() => {
    const values = Object.values(metric?.values ?? {}).filter(Number.isFinite);
    const b = quantileBreaks(values, 5);
    return {
      breaks: b,
      binOf: (v: number | undefined) => (v === undefined ? null : binFor(v, b)),
    };
  }, [metric]);

  const ranked = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, value: metric?.values[r.placeId] }))
        .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity)),
    [rows, metric],
  );

  const fmt = (v: number | undefined) =>
    v === undefined ? "No data" : formatWithUnit(v, metric?.unit);

  return (
    <div>
      {/* ------------------------------------------------- measure switch */}
      {metrics.length > 1 && (
        <div
          role="group"
          aria-label="Shade the map by"
          className="mb-4 flex flex-wrap gap-1"
        >
          {metrics.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMetricIndex(i)}
              aria-pressed={i === metricIndex}
              className={`focus-visible:outline-accent rounded-full border px-3 py-1 text-[12px] focus-visible:outline-2 focus-visible:outline-offset-1 ${
                i === metricIndex
                  ? "border-ink bg-ink text-surface"
                  : "border-line text-ink-soft hover:border-line-strong"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)] lg:gap-10">
        {/* -------------------------------------------------------- map */}
        <div>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            /*
              Never wider than the frame the labels were laid out for.
              layoutLabels picks font sizes and offsets for `width`; letting the
              SVG stretch to a 1200px panel scales every label with it and the
              district names end up twice the size of the headings.
            */
            style={{ maxWidth: width }}
            className="mx-auto h-auto w-full"
            /*
              A group, not an image: the shapes inside are links. role="img"
              would make the whole subtree presentational, so a keyboard user
              would tab through areas a screen reader announces as nothing.
            */
            role="group"
            aria-label={`${title}. ${metric?.label}. ${features.length} areas, each a link. The same values are listed beside the map.`}
          >
            {features.map((f) => {
              const v = metric?.values[f.placeId];
              const bin = binOf(v);
              const isActive = activeId === f.placeId;
              const shape = (
                <path
                  d={f.path}
                  fill={bin === null ? "var(--color-surface-inset)" : RAMP[bin]}
                  stroke={isActive ? "var(--color-ink)" : "var(--color-surface)"}
                  strokeWidth={isActive ? 1.6 : 0.5}
                  style={{ transition: "stroke-width 80ms linear" }}
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

            {/* One label renderer, shared with every other map on the site.
                It hides itself from assistive tech: the strings are abbreviated
                layout text, and the real names are on the links above. */}
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
          </svg>

          {/* ------------------------------------------------- legend */}
          <div className="mt-3">
            <div
              className="flex h-2 gap-px overflow-hidden rounded-sm"
              aria-hidden="true"
            >
              {RAMP.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="text-ink-faint tabular mt-1 flex justify-between text-[11px]">
              <span>{fmt(Math.min(...Object.values(metric?.values ?? {})))}</span>
              <span>{fmt(Math.max(...Object.values(metric?.values ?? {})))}</span>
            </div>
            <p className="text-ink-faint mt-2 text-[11px] leading-relaxed">
              Five classes, each holding about {Math.round(features.length / 5)} of{" "}
              {features.length} areas. Class edges:{" "}
              {breaks.map((b) => formatNumber(Math.round(b))).join(" · ")}.
              {note ? ` ${note}` : ""}
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------- ranking */}
        <div>
          <p
            className="text-ink-faint mb-2 text-[11px] uppercase"
            style={{ letterSpacing: "0.07em" }}
            id={`${groupId}-rank`}
          >
            {metric?.label}, ranked
          </p>
          <ol
            aria-labelledby={`${groupId}-rank`}
            className="divide-line border-line divide-y border-t text-[13px]"
          >
            {ranked.map((r, i) => (
              <li key={r.placeId}>
                <Link
                  href={r.href}
                  onMouseEnter={() => setActiveId(r.placeId)}
                  onMouseLeave={() => setActiveId(null)}
                  onFocus={() => setActiveId(r.placeId)}
                  onBlur={() => setActiveId(null)}
                  className={`focus-visible:outline-accent flex items-baseline gap-3 py-2 no-underline focus-visible:outline-2 focus-visible:-outline-offset-2 ${
                    activeId === r.placeId ? "bg-surface-sunken" : ""
                  }`}
                >
                  <span className="text-ink-faint tabular w-5 text-[11px]">
                    {i + 1}
                  </span>
                  <span className="text-ink truncate">{r.name}</span>
                  <span className="text-ink tabular ml-auto">{fmt(r.value)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
