/**
 * Label placement for every map on the site.
 *
 * Extracted so there is one answer to "how does a map label a shape" rather
 * than two. There were two: the reference map fitted labels, suppressed
 * collisions and ran leader lines to the ones that did not fit, while the
 * choropleth had a single `showLabels` boolean that dropped every label at once.
 * The visible consequence was that drilling into a province with more than eight
 * districts produced a map with no district names on it at all.
 *
 * The order of attempts matters and is deliberate:
 *
 *   1. Full name at the normal size.
 *   2. Full name a step smaller, if the shape is close.
 *   3. A safely shortened name.
 *   4. A leader line to the margin.
 *
 * Nothing is ever dropped. Step 4 exists so that "it did not fit" never means
 * "you cannot see it".
 */

import type { Project, Ring } from "@/lib/geo";

/** Where a label can go, and how much room it has. */
export type LabelBox = { x: number; y: number; w: number; h: number };

export type Placement<T> = {
  item: T;
  box: LabelBox;
  /** The text actually drawn, which may be shortened. */
  text: string;
  fontSize: number;
  /** True when the drawn text differs from the full name. */
  shortened: boolean;
};

export type Leader<T> = {
  item: T;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

export type LabelLayout<T> = {
  placed: Placement<T>[];
  leaders: Leader<T>[];
  /** Extra height the leader band needs below the map. */
  bandHeight: number;
  /** Frame width, which the band may widen beyond the map itself. */
  frameWidth: number;
  /** Horizontal offset to centre the map inside a wider frame. */
  offsetX: number;
};

/*
  Rough advance width of a label, in SVG user units.

  Maps render at one user unit to one pixel, so this only has to be good enough
  to decide whether a name fits inside a polygon. Erring high means omitting a
  borderline label rather than letting it spill across a border.
*/
export function textWidth(text: string, fontPx: number): number {
  return text.length * fontPx * 0.53;
}

/*
  Shortening a place name without inventing a different place.

  Truncation is refused, and that is the important decision here. Nepal has a
  district called Sankhuwasabha; "Sankhu…" is a different, well-known place near
  Kathmandu. "Nawalparasi" alone is ambiguous between Nawalparasi East and
  Nawalparasi West, which are separate districts. A shortened label that names
  the wrong place is worse than a leader line.

  So only two transformations are allowed, both reversible by any reader:
  abbreviating a directional qualifier, and dropping a generic administrative
  word that adds nothing on a map of administrative units.
*/
const DIRECTIONS: Record<string, string> = {
  East: "E",
  West: "W",
  North: "N",
  South: "S",
};

const GENERIC_WORDS = new Set([
  "Rural",
  "Municipality",
  "Metropolitan",
  "Sub-Metropolitan",
  "City",
  "Gaunpalika",
  "Nagarpalika",
]);

/**
 * Progressively shorter forms of a name, longest first, ending with the name
 * itself if nothing can safely be shortened.
 */
export function shortForms(name: string): string[] {
  const forms = [name];
  const words = name.split(/\s+/);

  // Drop generic administrative words: on a map of municipalities, the word
  // "Municipality" distinguishes nothing.
  const withoutGeneric = words.filter((w) => !GENERIC_WORDS.has(w));
  if (withoutGeneric.length && withoutGeneric.length < words.length) {
    forms.push(withoutGeneric.join(" "));
  }

  // Abbreviate a directional qualifier: "Nawalparasi East" -> "Nawalparasi E".
  // The base name alone is never offered, because it is ambiguous between the
  // two halves of a split district.
  const base = withoutGeneric.length ? withoutGeneric : words;
  const abbreviated = base.map((w) => DIRECTIONS[w] ?? w);
  if (abbreviated.join(" ") !== base.join(" ")) {
    forms.push(abbreviated.join(" "));
  }

  return [...new Set(forms)];
}

/** Centroid and extent of a shape's largest ring, projected. */
export function labelBox(rings: Ring[][], project: Project): LabelBox {
  let best: Ring = [];
  for (const poly of rings) {
    for (const ring of poly) if (ring.length > best.length) best = ring;
  }
  let sx = 0;
  let sy = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const [lon, lat] of best) {
    const [x, y] = project(lon, lat);
    sx += x;
    sy += y;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  return {
    x: sx / Math.max(1, best.length),
    y: sy / Math.max(1, best.length),
    w: right - left,
    h: bottom - top,
  };
}

type Rect = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Rect, b: Rect): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/**
 * Lay out labels for a set of shapes.
 *
 * Largest shape first: it has the most room, and where two labels contest the
 * same space the smaller shape is the one whose leader line is least disruptive.
 */
export function layoutLabels<T>(
  items: T[],
  opts: {
    name: (item: T) => string;
    box: (item: T) => LabelBox;
    fontSize?: number;
    /** Frame the map was projected into. */
    width: number;
    height: number;
    maxWidth: number;
    /** Set false to send every label to the margin (used for very dense maps). */
    inShape?: boolean;
  },
): LabelLayout<T> {
  const FONT = opts.fontSize ?? 10;
  const SMALL = FONT - 1.5;
  const inShape = opts.inShape ?? true;

  const placedRects: Rect[] = [];
  const placed: Placement<T>[] = [];
  const overflow: T[] = [];

  const ordered = [...items].sort((a, b) => {
    const ba = opts.box(b);
    const aa = opts.box(a);
    return ba.w * ba.h - aa.w * aa.h;
  });

  for (const item of ordered) {
    const box = opts.box(item);
    const full = opts.name(item);
    let chosen: { text: string; size: number } | null = null;

    if (inShape) {
      // Full name, then smaller, then each shorter form. The first that fits
      // its own shape, the frame, and its neighbours wins.
      const attempts: { text: string; size: number }[] = [];
      for (const size of [FONT, SMALL]) {
        for (const text of shortForms(full)) attempts.push({ text, size });
      }

      for (const attempt of attempts) {
        const tw = textWidth(attempt.text, attempt.size);
        if (tw > box.w * 0.86 || box.h < attempt.size + 2) continue;
        const rect: Rect = {
          left: box.x - tw / 2,
          right: box.x + tw / 2,
          top: box.y - attempt.size * 0.6,
          bottom: box.y + attempt.size * 0.6,
        };
        if (rect.left < 2 || rect.right > opts.width - 2) continue;
        if (placedRects.some((q) => overlaps(rect, q))) continue;
        placedRects.push(rect);
        chosen = attempt;
        break;
      }
    }

    if (chosen) {
      placed.push({
        item,
        box,
        text: chosen.text,
        fontSize: chosen.size,
        shortened: chosen.text !== full,
      });
    } else {
      overflow.push(item);
    }
  }

  /*
    The leader band.

    Sized from the widest name rather than from an assumed row count, and
    allowed to be wider than the map. A tall narrow district projects to a
    frame a few hundred units across; seven names averaging ninety units each
    will not fit inside it however many rows they get.
  */
  const LEADER_FONT = FONT - 0.5;
  const ROW_GAP = 13;
  const GAP = 8;

  const widest = overflow.length
    ? Math.max(...overflow.map((i) => textWidth(opts.name(i), LEADER_FONT))) + GAP
    : 0;

  let rows = 0;
  let bandWidth = opts.width;
  if (overflow.length) {
    for (let candidate = 1; candidate <= 4; candidate++) {
      rows = candidate;
      bandWidth = Math.max(opts.width, Math.ceil(overflow.length / candidate) * widest);
      if (bandWidth <= opts.maxWidth) break;
    }
    bandWidth = Math.min(bandWidth, opts.maxWidth);
  }

  const frameWidth = Math.max(opts.width, bandWidth);
  const offsetX = (frameWidth - opts.width) / 2;
  const bandHeight = rows ? 14 + rows * ROW_GAP : 0;

  // Sorted by x, and assigned to slots in x order, which is what keeps the
  // leader lines from crossing each other.
  const leaders: Leader<T>[] = [...overflow]
    .sort((a, b) => opts.box(a).x - opts.box(b).x)
    .map((item, i) => {
      const box = opts.box(item);
      const row = i % rows;
      const slot = Math.floor(i / rows);
      const perRow = Math.ceil(overflow.length / rows);
      const step = frameWidth / Math.max(1, perRow);
      const half = textWidth(opts.name(item), LEADER_FONT) / 2;
      return {
        item,
        from: { x: box.x + offsetX, y: box.y },
        to: {
          x: Math.min(Math.max(step * (slot + 0.5), half + 2), frameWidth - half - 2),
          y: opts.height + 11 + row * ROW_GAP,
        },
      };
    });

  return { placed, leaders, bandHeight, frameWidth, offsetX };
}
