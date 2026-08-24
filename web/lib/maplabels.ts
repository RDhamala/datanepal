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
 * Every label sits inside the map. There is no margin band and no leader line:
 * labels outside the frame pulled the eye away from the country and made a map
 * of 77 districts look like a map with a list stapled underneath it.
 *
 * No abbreviation is invented, and that is a researched position rather than a
 * cautious one. Nepal publishes no standard set of English short names for its
 * districts: OCHA's COD carries `adm2_name1/2/3` alternate-name fields and all
 * 77 are empty; Wikidata has zero P1813 "short name" values across all 79
 * district items; NSO's own census tables use full names throughout. What Nepal
 * does standardise is *numeric* -- three-digit district codes, postal codes,
 * ISO 3166-2 province codes -- none of which is a short name.
 *
 * So an earlier version of this file was wrong to shorten "Nawalparasi East" to
 * "Nawalparasi E" and to truncate "Rukum West" to "Ruk…". Both were inventions,
 * and the truncation was worse than that: "Nawal…" was drawn beside
 * "Nawalparasi E" and is a prefix of two different districts.
 *
 * What remains changes the *rendering* and never the name:
 *
 *   1. Full name, at each size down to a legibility floor.
 *   2. The administrative type word dropped -- "Phungling Municipality" ->
 *      "Phungling". Not an abbreviation: the spine stores name and place_type as
 *      separate fields, so this is using our own data model, and the type is
 *      already given by the legend.
 *   3. Wrapped onto two lines, which roughly halves the width needed.
 *   4. Moved to one of a few offsets around the shape's centroid, with an anchor
 *      dot so a moved label is never ambiguous.
 *
 * Anything that still cannot fit keeps a locator dot and is named in the data
 * table under every map. A dot inside the map is better than a name outside it,
 * and both are better than a name that might belong to somewhere else.
 */

import type { Project, Ring } from "@/lib/geo";

/** Where a label can go, and how much room it has. */
export type LabelBox = { x: number; y: number; w: number; h: number };

export type Placement<T> = {
  item: T;
  box: LabelBox;
  /** Where the text is drawn, which may be offset from the shape's centroid. */
  at: { x: number; y: number };
  /** The lines actually drawn. One entry, or two when wrapped. */
  lines: string[];
  fontSize: number;
  /** True when the drawn text differs from the full name. */
  shortened: boolean;
  /**
   * True when the label is wider than its own shape and spills over a
   * neighbour. Those get an anchor dot, so which shape a name belongs to stays
   * unambiguous -- which is the whole reason overflowing is allowed at all.
   */
  anchored: boolean;
};

export type LabelLayout<T> = {
  placed: Placement<T>[];
  /** Shapes too small for any label. They keep a dot and appear in the table. */
  dotted: { item: T; box: LabelBox }[];
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
  The one permitted change to a name, and it is not an abbreviation.

  The spine stores a place's name and its place_type in separate fields --
  "Phungling" and "municipality" -- and the census happens to concatenate them.
  Dropping the type word recovers the name we already hold, on a map where the
  legend states the type anyway. Nothing is shortened, guessed, or truncated.
*/
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
 * Split a name across two lines at its most balanced space.
 *
 * Worth about half the width for any multi-word name, which is the cheapest
 * thing available before truncation has to be considered.
 */
export function wrapName(name: string): string[] | null {
  const words = name.split(/\s+/);
  if (words.length < 2) return null;
  let best: string[] | null = null;
  let bestDelta = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const delta = Math.abs(a.length - b.length);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = [a, b];
    }
  }
  return best;
}

/**
 * Truncate to a visible abbreviation.
 *
 * The ellipsis is not decoration. Without it "Sankhuwa" reads as a name, and
 * "Sankhu" reads as a *different* real place near Kathmandu. With it, the label
 * says "this is cut short, check the tooltip", which is a true statement.
 */
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
    /** Set false to suppress labels entirely. */
    inShape?: boolean;
  },
): LabelLayout<T> {
  const FONT = opts.fontSize ?? 10;
  // The floor. Below about 6.5 a label stops being readable, at which point a
  // dot plus the data table is the more honest option.
  const SIZES = [FONT, FONT - 1, FONT - 2, FONT - 3].filter((s) => s >= 6.5);
  const inShape = opts.inShape ?? true;

  const placedRects: Rect[] = [];
  const placed: Placement<T>[] = [];
  const dotted: { item: T; box: LabelBox }[] = [];

  // Largest shape first: it has the most room, and where two labels contest the
  // same space the smaller shape is the one that can better spare its name.
  const ordered = [...items].sort((a, b) => {
    const ba = opts.box(b);
    const aa = opts.box(a);
    return ba.w * ba.h - aa.w * aa.h;
  });

  for (const item of ordered) {
    const box = opts.box(item);
    const full = opts.name(item);

    /*
      Candidates, cheapest concession first. Every size is tried at each level
      of concession before moving to the next, so a name is shrunk before it is
      shortened and shortened before it is cut.
    */
    const candidates: { lines: string[]; size: number }[] = [];
    for (const size of SIZES) {
      for (const form of shortForms(full)) candidates.push({ lines: [form], size });
    }
    for (const size of SIZES) {
      for (const form of shortForms(full)) {
        const wrapped = wrapName(form);
        if (wrapped) candidates.push({ lines: wrapped, size });
      }
    }

    /*
      Two passes over the same candidates.

      The first requires a label to fit inside its own polygon, which is what a
      reader expects and needs no explanation. The second allows it to spill over
      a neighbour, because Nepal's hill districts are small and surrounded by
      larger ones -- Bhojpur, Nuwakot and Terhathum all had room beside them and
      none inside them. An overflowing label gets an anchor dot so it is obvious
      which shape it names.

      Both passes still refuse to leave the frame and refuse to collide with an
      already-placed label. Those two are hard limits.
    */
    /*
      Candidate positions, not just the centroid.

      Relaxing the width alone recovered nothing, and the reason is instructive:
      the nine unlabelled districts were all in dense clusters where bigger
      neighbours had already claimed the centre. A label engine has to be able to
      move a label, not just shrink it. So each text is tried at the centroid
      first and then at modest offsets around it, which is what finally places
      Bhojpur, Nuwakot and Terhathum inside the map.

      An offset label always gets an anchor dot at the true centroid, so moving
      it never makes it ambiguous.
    */
    const offsets: { dx: number; dy: number }[] = [
      { dx: 0, dy: 0 },
      { dx: 0, dy: -box.h * 0.3 },
      { dx: 0, dy: box.h * 0.3 },
      { dx: -box.w * 0.32, dy: 0 },
      { dx: box.w * 0.32, dy: 0 },
      { dx: 0, dy: -box.h * 0.55 },
      { dx: 0, dy: box.h * 0.55 },
    ];

    let chosen: {
      lines: string[];
      size: number;
      anchored: boolean;
      at: { x: number; y: number };
    } | null = null;

    if (inShape) {
      for (const allowance of [0.92, 2.2]) {
        for (const c of candidates) {
          const w = Math.max(...c.lines.map((l) => textWidth(l, c.size)));
          const h = c.lines.length * c.size * 1.15;
          if (w > box.w * allowance) continue;
          // Height is never relaxed at the strict allowance: a label taller than
          // its shape reads as belonging to whatever sits above or below it.
          if (h > box.h * 0.95 && allowance === 0.92) continue;

          for (const off of offsets) {
            const cx = box.x + off.dx;
            const cy = box.y + off.dy;
            const rect: Rect = {
              left: cx - w / 2,
              right: cx + w / 2,
              top: cy - h / 2,
              bottom: cy + h / 2,
            };
            if (rect.left < 1 || rect.right > opts.width - 1) continue;
            if (rect.top < 1 || rect.bottom > opts.height - 1) continue;
            if (placedRects.some((q) => overlaps(rect, q))) continue;
            placedRects.push(rect);
            chosen = {
              ...c,
              anchored: allowance > 0.92 || off.dx !== 0 || off.dy !== 0,
              at: { x: cx, y: cy },
            };
            break;
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
    }

    if (chosen) {
      placed.push({
        item,
        box,
        at: chosen.at,
        lines: chosen.lines,
        fontSize: chosen.size,
        shortened: chosen.lines.join(" ") !== full,
        anchored: chosen.anchored,
      });
    } else {
      dotted.push({ item, box });
    }
  }

  return { placed, dotted };
}
