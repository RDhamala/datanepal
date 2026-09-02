import type { LabelLayout } from "@/lib/maplabels";

/*
  Drawing the labels a layout decided on.

  Shared by the choropleth and the reference map so the two look the same. They
  did not before: one drew names inside shapes and gave up when they collided,
  the other drew names, dots and leader lines out to a margin band.

  Everything is inside the map now. A label that did not fit gets a locator dot
  and is named in the data table under every map, which keeps the reader's eye
  on the country instead of on a list beneath it.

  Labels on dark fills flip to the surface colour, which is why the caller passes
  a per-shape ink decision rather than this component guessing.
*/

export function MapLabels<T>({
  layout,
  ink,
}: {
  layout: LabelLayout<T>;
  /** Ink for a label sitting on a given shape. */
  ink?: (item: T) => string;
}) {
  return (
    /*
      Hidden from assistive tech on purpose. These are *layout* strings, not
      names: long ones are abbreviated from the reviewed SHORT_NAMES table, so a
      screen reader would read "BKT" and "Nawal W" over the real names already
      carried by each shape's link and by the table beneath the map. They were
      invisible to AT while the map was role="img"; the group role exposes them.
    */
    <g aria-hidden="true">
      {/* Anchor dots for labels that spill over a neighbour, so which shape a
          name belongs to is never in doubt. */}
      {layout.placed
        .filter((p) => p.anchored)
        .map((p, i) => (
          <circle
            key={`anchor-${i}`}
            cx={p.box.x}
            cy={p.box.y}
            r={1.1}
            fill="var(--color-ink-soft)"
            pointerEvents="none"
          />
        ))}

      {/* Dots for shapes with no label at all. */}
      {layout.dotted.map(({ box }, i) => (
        <circle
          key={`dot-${i}`}
          cx={box.x}
          cy={box.y}
          r={1.3}
          fill="var(--color-ink-soft)"
          pointerEvents="none"
        />
      ))}

      {layout.placed.map((p, i) => {
        // Vertically centre the block, then step down a line at a time.
        const top = p.at.y - ((p.lines.length - 1) * p.fontSize * 1.15) / 2;
        return (
          <text
            key={`label-${i}`}
            x={p.at.x}
            y={top + p.fontSize * 0.35}
            textAnchor="middle"
            className="font-medium"
            fontSize={p.fontSize}
            fill={ink ? ink(p.item) : "var(--color-ink)"}
            pointerEvents="none"
          >
            {p.lines.map((line, j) => (
              <tspan key={j} x={p.box.x} dy={j === 0 ? 0 : p.fontSize * 1.15}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
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
