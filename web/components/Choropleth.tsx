import Link from "next/link";
import { formatCompact, formatNumber, type Unit } from "@/lib/data";
import { parseGeometry, projector, toPath } from "@/lib/geo";
import { labelBox, layoutLabels } from "@/lib/maplabels";
import { MapLabels, labelCaption } from "@/components/MapLabels";

/*
  Geographic exploration.

  Answers the one question ranked bars answer badly: "where does this differ?"
  A reader scanning 77 district bars cannot see that the Terai is dense and the
  mountains are not. A map shows it instantly.

  Built as inline SVG, projected at build time. No MapLibre, no tiles, no client
  JavaScript, no API key. For a static site rendering fixed administrative
  boundaries this is strictly better than a map library: it is a few kilobytes
  of markup, every shape is a real link that works without script, and it is
  keyboard navigable and crawlable for free. A tile-based map would buy
  panning and zooming that nobody needs to compare seven provinces.

  Projection is Web Mercator, scaled to fit. Nepal spans about 9 degrees of
  longitude and 5 of latitude, so the distortion across the frame is small, but
  using Mercator rather than plate carrée keeps the country's shape right —
  Nepal is wide and thin, and an unprojected render squashes it noticeably.

  Colour is a sequential ramp: one hue, light to dark, because the encoding is
  magnitude. Assigning each province its own hue would spend the identity
  channel re-encoding what the ramp already says, and would imply the provinces
  are categories rather than quantities.
*/

type Feature = {
  placeId: string;
  name: string;
  nameNe?: string | null;
  slug: string;
  href: string;
  /** GeoJSON MultiPolygon as a string, lon/lat. */
  geometryGeoJson: string;
  value: number | null;
};

const RAMP = [
  "var(--color-seq-1)",
  "var(--color-seq-2)",
  "var(--color-seq-3)",
  "var(--color-seq-4)",
  "var(--color-seq-5)",
];

/** One value formatter for labels and legend, so they cannot disagree. */
function fmt(v: number, unit?: Unit): string {
  return unit?.unit_kind === "ratio" ? `${v.toFixed(1)}%` : formatCompact(v);
}

export function Choropleth({
  features,
  unit,
  label,
  period,
  valueLabel = "Value",
  height = 420,
  showLabels = true,
  scale = "equal",
  outlines = [],
}: {
  features: Feature[];
  unit?: Unit;
  label: string;
  period?: number;
  valueLabel?: string;
  height?: number;
  showLabels?: boolean;
  /**
   * Heavier boundaries drawn over the shapes -- provinces over districts.
   *
   * Fill can only carry one variable, so grouping is carried by line weight
   * instead. That is what lets one map answer both "how large" and "whose
   * province is this", and it is why /places needs one district map rather than
   * a shaded one and a grouped one side by side, naming all 77 districts twice.
   */
  outlines?: { placeId: string; geometryGeoJson: string }[];
  /**
   * How values are assigned to colour classes.
   *
   * `equal` splits the range into five equal intervals. Honest and easy to read,
   * and correct when values are spread across the range.
   *
   * `quantile` splits so each class holds roughly the same number of areas. Use
   * it for skewed distributions. Nepal's district populations are the textbook
   * case: Kathmandu at 2.19M against a median near 250k pushed about seventy of
   * the seventy-seven districts into the palest equal-interval class, so the map
   * was very nearly one flat colour and told the reader nothing. The cost is
   * that classes are unevenly spaced, which is why the legend labels the actual
   * break values and says so in words rather than implying a smooth ramp.
   */
  scale?: "equal" | "quantile";
}) {
  const parsed = features
    .map((f) => ({ ...f, polygons: parseGeometry(f.geometryGeoJson) }))
    .filter((f) => f.polygons.length > 0);

  if (!parsed.length) return null;

  const groupOutlines = outlines
    .map((o) => ({ ...o, polygons: parseGeometry(o.geometryGeoJson) }))
    .filter((o) => o.polygons.length > 0);

  // Bounded on both axes so a user unit stays close to a rendered pixel; the
  // in-shape labels use a fixed font size and depend on that.
  const {
    width,
    height: frameHeight,
    project,
  } = projector(
    [...parsed.map((f) => f.polygons), ...groupOutlines.map((o) => o.polygons)],
    { maxWidth: 1000, maxHeight: height },
  );

  const values = parsed
    .map((f) => f.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const lo = values.length ? Math.min(...values) : 0;
  const hi = values.length ? Math.max(...values) : 1;

  /*
    Class breaks: the four interior boundaries between the five colours.

    Held explicitly rather than computed inside `bin` so the legend can label
    the real boundaries. A legend that renders a smooth ramp over unevenly
    spaced classes is a lie about the data, and it is the usual reason a
    quantile choropleth misleads.
  */
  const sortedValues = [...values].sort((a, b) => a - b);
  const breaks: number[] =
    scale === "quantile" && sortedValues.length >= 5
      ? [1, 2, 3, 4].map((k) => sortedValues[Math.floor((k / 5) * sortedValues.length)])
      : [1, 2, 3, 4].map((k) => lo + ((hi - lo) * k) / 5);

  const bin = (v: number | null): number => {
    if (v === null || hi === lo) return 2;
    let i = 0;
    while (i < breaks.length && v >= breaks[i]) i++;
    return i;
  };

  const sorted = [...parsed].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  /*
    One label engine for every map on the site.

    This component used to carry its own: a single `showLabels` boolean that
    dropped every label at once. Drilling into a province with more than eight
    districts therefore produced a district map with no district names on it,
    while the reference map on the next page over labelled all 77 with leader
    lines. Same country, same session, two behaviours.
  */
  const boxes = new Map(
    parsed.map((f) => [f.placeId, labelBox(f.polygons, project)] as const),
  );
  const layout = layoutLabels(parsed, {
    name: (f) => f.name,
    box: (f) => boxes.get(f.placeId)!,
    width,
    height: frameHeight,
    inShape: showLabels,
  });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${frameHeight}`}
        /*
          Natural size, capped at the container -- not `w-full`.

          `w-full` stretches the SVG to the container regardless of its viewBox,
          which magnifies by whatever ratio happens to fall out of the shape's
          aspect. Nepal is wide, so it magnified about 1.4x and a 9-unit label
          read at 11px. Dhanusa is tall and narrow, so its viewBox came out
          277 units wide, stretched 4.6x to fill 1280px, and the same label read
          at 42px. Sizing to the viewBox keeps one user unit at one pixel, so a
          font size means the same thing on every map.
        */
        style={{ width: `${width}px`, maxWidth: "100%", height: "auto" }}
        role="img"
        aria-label={`Map of Nepal showing ${label}${period ? `, ${period}` : ""}. ${
          sorted.length
        } areas. Highest ${sorted[0]?.name} at ${formatNumber(sorted[0]?.value ?? 0)}; lowest ${
          sorted[sorted.length - 1]?.name
        } at ${formatNumber(sorted[sorted.length - 1]?.value ?? 0)}. Values follow in a table.`}
      >
        <g>
          {parsed.map((f) => (
            <Link key={f.placeId} href={f.href}>
              {/* title gives a native tooltip with no JavaScript. Single string
                child, deliberately: two adjacent text children make React emit
                comment separators that the SVG parser drops, which hydrates as
                a mismatch. */}
              <title>
                {f.value !== null ? `${f.name} — ${formatNumber(f.value)}` : f.name}
              </title>
              <path
                d={toPath(f.polygons, project)}
                className="geo-shape"
                fill={RAMP[bin(f.value)]}
              />
            </Link>
          ))}

          {/* Grouping, drawn over the fill. Fill can only carry one variable,
              so the heavier provincial border carries the grouping while the
              ramp carries magnitude -- which is what lets one district map do
              the job two used to. Not interactive: the shapes beneath are the
              links, and an overlay would swallow their clicks. */}
          {groupOutlines.map((o) => (
            <path
              key={o.placeId}
              d={toPath(o.polygons, project)}
              className="geo-province-outline"
            />
          ))}
        </g>

        <MapLabels
          layout={layout}
          // Dark fills need light ink. The bin decides, not the label.
          ink={(f) => (bin(f.value) >= 3 ? "var(--color-surface)" : "var(--color-ink)")}
        />
      </svg>

      {/*
        Legend: five discrete swatches with every class boundary labelled.

        Labelling the boundaries rather than just the range ends is what makes a
        quantile scale readable — the classes are unevenly spaced, and a reader
        needs the actual numbers to know whether the step from pale to mid means
        50,000 people or 500,000.
      */}
      {values.length > 0 && (
        <figcaption className="mt-4">
          <div className="max-w-md">
            <div className="flex h-2.5 gap-px overflow-hidden rounded-sm">
              {RAMP.map((c) => (
                <span key={c} className="flex-1" style={{ background: c }} />
              ))}
            </div>
            <div className="text-ink-faint tabular mt-1.5 flex justify-between text-[11px]">
              {[lo, ...breaks, hi].map((v, i) => (
                <span key={i}>{fmt(v, unit)}</span>
              ))}
            </div>
          </div>
          <p className="text-ink-faint mt-2 max-w-prose text-[11px] leading-relaxed">
            {valueLabel}
            {period ? `, ${period}` : ""}
            {scale === "quantile" &&
              ` · five classes, each holding about ${Math.round(
                values.length / 5,
              )} of ${values.length} areas`}
            {showLabels && ` · ${labelCaption(layout, parsed.length)}`}
          </p>
        </figcaption>
      )}

      <details className="mt-4">
        <summary className="text-ink-faint hover:text-ink-soft cursor-pointer text-[12px]">
          View data table
        </summary>
        <div className="border-line mt-3 max-h-96 overflow-auto rounded-md border">
          <table className="w-full text-[13px]">
            <caption className="sr-only">{label}</caption>
            <thead className="bg-surface-raised sticky top-0">
              <tr className="border-line border-b">
                <th
                  scope="col"
                  className="text-label text-ink-faint px-3 py-2 text-left uppercase"
                >
                  Area
                </th>
                <th
                  scope="col"
                  className="text-label text-ink-faint px-3 py-2 text-right uppercase"
                >
                  {valueLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => (
                <tr key={f.placeId} className="border-line border-b last:border-0">
                  <td className="px-3 py-1.5">
                    <Link href={f.href}>{f.name}</Link>
                    {f.nameNe && (
                      <span className="text-ink-faint ne"> · {f.nameNe}</span>
                    )}
                  </td>
                  <td className="text-ink tabular px-3 py-1.5 text-right">
                    {f.value === null ? "—" : formatNumber(f.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
