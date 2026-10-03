import type { LabelLayout } from "@/lib/maplabels";

/*
  Drawing the labels a layout decided on.

  Shared by the choropleth, the reference map and the metric map so all three
  look the same. They did not before: one drew names inside shapes and gave up
  when they collided, the other drew names, dots and leader lines out to a
  margin band, and MetricMap had a third copy of its own.

  That third copy is why the halo fix first landed in a file the page under
  review does not render. Two renderers meant two places to be wrong, and only
  one of them was being looked at. There is one now: `MapLabelLayer` draws, and
  everything else hands it positions.

  Everything is inside the map. A label that did not fit gets a locator dot and
  is named in the data table under every map, which keeps the reader's eye on
  the country instead of on a list beneath it.
*/

export type PlacedLabel = {
  /** Centre of the text block, after any offset the layout chose. */
  at: { x: number; y: number };
  /** Centroid of the shape, for the anchor dot. */
  anchorAt?: { x: number; y: number };
  lines: string[];
  fontSize: number;
  /** Draw an anchor dot: the label sits off its own shape. */
  anchored?: boolean;
};

/**
 * The one place a map label is drawn.
 *
 * Takes positions, not geometry: the layout engine runs at build time and both
 * callers arrive here with the same primitive. Nothing in this component knows
 * what a district is.
 */
export function MapLabelLayer({
  labels,
  dots = [],
}: {
  labels: PlacedLabel[];
  /** Shapes with no label at all. */
  dots?: { x: number; y: number }[];
}) {
  return (
    <>
      {/* Anchor dots for labels that spill over a neighbour, so which shape a
          name belongs to is never in doubt. */}
      {labels
        .filter((l) => l.anchored && l.anchorAt)
        .map((l, i) => (
          <circle
            key={`anchor-${i}`}
            cx={l.anchorAt!.x}
            cy={l.anchorAt!.y}
            r={1.1}
            fill="var(--color-ink-soft)"
            pointerEvents="none"
          />
        ))}

      {dots.map((d, i) => (
        <circle
          key={`dot-${i}`}
          cx={d.x}
          cy={d.y}
          r={1.3}
          fill="var(--color-ink-soft)"
          pointerEvents="none"
        />
      ))}

      {labels.map((l, i) => {
        // Vertically centre the block, then step down a line at a time.
        const top = l.at.y - ((l.lines.length - 1) * l.fontSize * 1.15) / 2;
        return (
          <text
            key={`label-${i}`}
            x={l.at.x}
            y={top + l.fontSize * 0.35}
            textAnchor="middle"
            className="font-medium"
            fontSize={l.fontSize}
            fill="var(--color-ink)"
            pointerEvents="none"
            /*
              A halo in the page's own surface colour, painted under the glyphs.

              Without it a label legible on its own shape disappears the moment
              it overhangs. "Dhunibenshi" sits on Dhading's darkest local unit,
              so it used to ink white; the shape is narrow and the name is long,
              so its last characters landed on the page background and were
              white on white. It read as a clipped label, and the frame check in
              layoutLabels is what everyone looked at -- the label was
              comfortably inside the viewBox the whole time. Contrast was the
              problem, not geometry.

              One ink for every label rather than flipping on dark fills: the
              flip is only correct while a label stays inside its shape, and a
              label that overhangs has to be legible in both places at once.

              paint-order matters. Without it the stroke is drawn over the fill
              and thins every glyph.
            */
            stroke="var(--color-surface)"
            strokeWidth={Math.max(2.5, l.fontSize * 0.3)}
            strokeLinejoin="round"
            style={{ paintOrder: "stroke fill" }}
          >
            {l.lines.map((line, j) => (
              /*
                l.at.x, not the shape's centroid. The layout engine tries a
                label at several offsets and only accepts one that clears the
                frame and every placed label -- then the old renderer discarded
                the horizontal half of that decision and drew the line back at
                the shape's centre, which is neither where it was measured nor
                necessarily inside the frame.
              */
              <tspan key={j} x={l.at.x} dy={j === 0 ? 0 : l.fontSize * 1.15}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </>
  );
}

/**
 * Adapter for callers holding a build-time `LabelLayout`.
 *
 * Deliberately offers no ink override. The previous signature let a caller
 * flip a label to the surface colour on a dark fill, which with a
 * surface-coloured halo renders white on white -- and that is not a mistake a
 * caller can be trusted to avoid, because it looks correct in the one case
 * the author tested. Contrast is this component's problem, not the caller's.
 */
export function MapLabels<T>({ layout }: { layout: LabelLayout<T> }) {
  return (
    <MapLabelLayer
      labels={layout.placed.map((p) => ({
        at: p.at,
        anchorAt: p.box,
        lines: p.lines,
        fontSize: p.fontSize,
        anchored: p.anchored,
      }))}
      dots={layout.dotted.map(({ box }) => ({ x: box.x, y: box.y }))}
    />
  );
}

/**
 * One sentence describing what the labels did, for a figure caption.
 *
 * Stated rather than left implicit: a reader seeing an abbreviated name should
 * know it is abbreviated, and a reader seeing a dot should know where the name
 * is.
 */
export function labelCaption<T>(layout: LabelLayout<T>, total: number): string {
  const parts = [`${layout.placed.length} of ${total} named on the map`];
  if (layout.dotted.length) {
    parts.push(
      `${layout.dotted.length} too small for a label, marked with a dot and named in the table below`,
    );
  }
  return parts.join("; ") + ".";
}
