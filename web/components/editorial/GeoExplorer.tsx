"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Metric, MetricMapFeature } from "@/components/MetricMap";
import { MapLabelLayer } from "@/components/MapLabels";
import { formatWithUnit } from "@/lib/format";
import { binFor, quantileBreaks } from "@/lib/viz";
import { SmallMultiples } from "./SmallMultiples";

/*
  Map and measures, with nothing to click before you can read it.

  Two changes from the tabbed version:

  - The measures are small multiples below the map, all visible at once. Tabs
    hid every measure but one, so comparing three meant clicking three times
    and holding the first two in memory.
  - Hovering or focusing a shape puts its name and value on the map, where the
    pointer already is, instead of in a readout somewhere else.

  Hover is an enhancement. Every shape and every row is a real link, and the
  highlight responds to focus too, so a keyboard walk lights up the map.
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
}: {
  features: MetricMapFeature[];
  metrics: Metric[];
  rows: GeoRow[];
  width: number;
  height: number;
  outlinePath?: string;
  title: string;
  source?: React.ReactNode;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const metric = metrics[0];

  const binOf = useMemo(() => {
    const b = quantileBreaks(
      Object.values(metric?.values ?? {}).filter(Number.isFinite),
      5,
    );
    return (v?: number) => (v === undefined ? null : binFor(v, b));
  }, [metric]);

  const fmt = (v?: number) =>
    v === undefined ? "No data" : formatWithUnit(v, metric?.unit);
  const all = Object.values(metric?.values ?? {});

  // Where the tooltip goes: the label the layout engine already placed, or the
  // locator dot for a shape too small to carry one.
  const activeFeature = activeId
    ? features.find((f) => f.placeId === activeId)
    : undefined;
  const at = activeFeature?.label ?? activeFeature?.dot ?? null;

  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>

      {/* ----------------------------------------------------------- map */}
      <div className="relative mx-auto" style={{ maxWidth: width }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="group"
          aria-label={`${title}. ${metric?.label}. ${features.length} areas, each a link. The same values are charted below.`}
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
                strokeWidth={on ? 1.8 : 0.5}
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
            Labels off below 640px. At 390px a 14px label lands near 5px --
            noise, not a name. The charts below carry every name in full.
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

        {/*
          The value, on the map, where the pointer already is. An HTML overlay
          rather than SVG text so it stays crisp at any scale and never
          inherits the map's own label sizing.
        */}
        {activeFeature && at && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)]"
            style={{
              left: `${(at.x / width) * 100}%`,
              top: `${(at.y / height) * 100}%`,
            }}
            aria-hidden="true"
          >
            <div
              className="bg-surface border-line rounded-md border px-2.5 py-1.5 whitespace-nowrap"
              style={{ boxShadow: "var(--shadow-lift)" }}
            >
              <span className="text-ink text-[12px] font-medium">
                {activeFeature.name}
              </span>
              <span className="text-ink tabular ml-2 text-[12px]">
                {fmt(metric?.values[activeFeature.placeId])}
              </span>
            </div>
          </div>
        )}

        {/* --------------------------------------------- continuous ramp */}
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
            <span>
              {metric?.label} · {fmt(Math.max(...all))}
            </span>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------- small multiples */}
      <div className="border-line mt-9 border-t pt-7">
        <SmallMultiples
          metrics={metrics}
          rows={rows.map((r) => ({ placeId: r.placeId, name: r.name, href: r.href }))}
          activeId={activeId}
          onActivate={setActiveId}
        />
      </div>

      {source && <div className="text-ink-faint mt-5 text-[11px]">{source}</div>}
    </figure>
  );
}
