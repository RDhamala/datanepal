import Link from "next/link";
import type { LabelLayout } from "@/lib/maplabels";

/*
  Drawing the labels a layout decided on.

  Shared by the choropleth and the reference map so the two look the same. They
  did not before: one drew names inside shapes and gave up when they collided,
  the other drew names, dots and leader lines. Same country, same page, two
  visual languages.

  Labels inside dark shapes flip to the surface colour, which is why the caller
  passes a per-shape ink decision rather than this component guessing.
*/

export function MapLabels<T>({
  layout,
  href,
  name,
  ink,
  hideInShape = false,
}: {
  layout: LabelLayout<T>;
  /** Destination for a label, or null for shapes with no page. */
  href: (item: T) => string | null;
  /** Full name, used unshortened in the margin. */
  name: (item: T) => string;
  /** Ink for a label sitting on a given shape. */
  ink?: (item: T) => string;
  /** Suppress the in-shape labels, keeping only the leaders. */
  hideInShape?: boolean;
}) {
  return (
    <>
      {/* Leader lines first, so a label always sits above its own line. */}
      {layout.leaders.map(({ from, to }, i) => (
        <g key={`leader-${i}`} pointerEvents="none">
          <path
            d={`M${from.x.toFixed(1)},${from.y.toFixed(1)} L${to.x.toFixed(1)},${(to.y - 7).toFixed(1)}`}
            stroke="var(--color-line-strong)"
            strokeWidth={0.6}
            fill="none"
          />
          <circle cx={from.x} cy={from.y} r={1.4} fill="var(--color-ink-soft)" />
        </g>
      ))}

      {!hideInShape &&
        layout.placed.map((p, i) => (
          <text
            key={`label-${i}`}
            x={p.box.x + layout.offsetX}
            y={p.box.y + 3}
            textAnchor="middle"
            className="font-medium"
            fontSize={p.fontSize}
            fill={ink ? ink(p.item) : "var(--color-ink)"}
            pointerEvents="none"
          >
            {p.text}
          </text>
        ))}

      {/* Leader labels are links where the place has a page: these name the
          shapes too small to click. */}
      {layout.leaders.map(({ item, to }, i) => {
        const target = href(item);
        const label = (
          <text
            x={to.x}
            y={to.y}
            textAnchor="middle"
            fontSize={9.5}
            fill={target ? "var(--color-link)" : "var(--color-ink-soft)"}
          >
            {/* Full name in the margin, never shortened: there is room here,
                and the margin is where a reader goes to resolve a name. */}
            {name(item)}
          </text>
        );
        return target ? (
          <Link key={`leader-label-${i}`} href={target}>
            {label}
          </Link>
        ) : (
          <g key={`leader-label-${i}`}>{label}</g>
        );
      })}
    </>
  );
}

/**
 * One sentence describing what the labels did, for a figure caption.
 *
 * Stated rather than left implicit: a reader who sees 55 of 77 names should know
 * the other 22 are below the map, not missing, and that a shortened name is
 * shortened.
 */
export function labelCaption<T>(layout: LabelLayout<T>, total: number): string {
  const parts: string[] = [];
  parts.push(`${layout.placed.length} of ${total} named on the map`);
  const shortened = layout.placed.filter((p) => p.shortened).length;
  if (shortened) {
    parts.push(
      `${shortened} shortened to fit — full names are in the table and in every link`,
    );
  }
  if (layout.leaders.length) {
    parts.push(
      `${layout.leaders.length} too small for a label and named below it, joined by a leader line`,
    );
  }
  return parts.join("; ") + ".";
}
