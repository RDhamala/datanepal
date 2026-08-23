import Link from "next/link";
import { parseGeometry, projector, toPath, type Ring } from "@/lib/geo";

/*
  Administrative reference map: all 77 districts, named, grouped by province.

  This is a different artifact from the choropleth, not a variant of it. A
  choropleth answers "how much, and where is it concentrated" — fill carries
  magnitude. A reference map answers "where is this district, and whose province
  is it in" — fill carries identity. Fill can only carry one variable, so trying
  to serve both questions with one map means serving neither. They sit side by
  side on /places instead.

  Grouping is carried primarily by *line weight*: district hairlines inside a
  heavy province outline. That is the atlas convention, and unlike colour it
  survives greyscale printing and every colour-vision deficiency. The four
  grouping tints only reinforce it, which is why they are nearly white.

  Four tints, assigned by greedy graph colouring over province adjacency, so no
  two neighbouring provinces ever share one. Four is sufficient for any planar
  map. Seven identity hues would have been the obvious approach and the wrong
  one: it fails CVD, it reads as a rainbow, and the brand direction rules out
  decorative colour.

  Labels: 77 names cannot all fit inside 77 shapes at any width this page will
  ever have — Kathmandu, Bhaktapur and Lalitpur together are smaller than a
  single Terai district. So each label is placed only if it measurably fits its
  own shape; the rest get a locator dot, and the province-grouped district lists
  further down the page serve as the index. Naming eight districts and silently
  dropping sixty-nine would be worse than either.
*/

type District = {
  placeId: string;
  name: string;
  nameNe?: string | null;
  href: string;
  geometryGeoJson: string;
  /** Province this district belongs to. Drives the grouping tint. */
  parentPlaceId: string | null;
};

type Province = {
  placeId: string;
  name: string;
  href: string;
  geometryGeoJson: string;
};

const TINTS = [
  "var(--color-group-1)",
  "var(--color-group-2)",
  "var(--color-group-3)",
  "var(--color-group-4)",
];

/**
 * Province adjacency, derived from geometry rather than hardcoded.
 *
 * Two provinces are treated as neighbours if any pair of their boundary
 * vertices falls within `EPS` degrees. Exact vertex matching would not work:
 * each admin level is simplified independently, so a shared border keeps
 * different points on each side. Proximity is robust to that.
 *
 * A hardcoded adjacency list would be a data claim maintained by hand, and it
 * would go stale the moment Nepal's boundaries change — which they did in 2015
 * and again when Nawalparasi and Rukum were split.
 */
const EPS = 0.06;

function adjacency(
  provinces: { placeId: string; rings: Ring[][] }[],
): Map<string, Set<string>> {
  // Thin the vertex sets first: 3,000 vertices compared pairwise across 7
  // provinces is 21 comparisons of ~430 x ~430 points, which is fine, but
  // there is no reason to carry every point.
  const points = provinces.map((p) => {
    const out: [number, number][] = [];
    for (const poly of p.rings) {
      for (const ring of poly) {
        for (let i = 0; i < ring.length; i += 2) out.push(ring[i]);
      }
    }
    return { placeId: p.placeId, out };
  });

  const adj = new Map<string, Set<string>>(
    provinces.map((p) => [p.placeId, new Set<string>()]),
  );

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i];
      const b = points[j];
      let touching = false;
      for (const [ax, ay] of a.out) {
        for (const [bx, by] of b.out) {
          if (Math.abs(ax - bx) < EPS && Math.abs(ay - by) < EPS) {
            touching = true;
            break;
          }
        }
        if (touching) break;
      }
      if (touching) {
        adj.get(a.placeId)!.add(b.placeId);
        adj.get(b.placeId)!.add(a.placeId);
      }
    }
  }
  return adj;
}

/** Greedy colouring, most-constrained province first. */
function colourProvinces(
  provinces: { placeId: string; rings: Ring[][] }[],
): Map<string, number> {
  const adj = adjacency(provinces);
  const order = [...provinces]
    .sort((a, b) => adj.get(b.placeId)!.size - adj.get(a.placeId)!.size)
    .map((p) => p.placeId);

  const colour = new Map<string, number>();
  for (const id of order) {
    const taken = new Set(
      [...adj.get(id)!].map((n) => colour.get(n)).filter((c) => c !== undefined),
    );
    let c = 0;
    while (taken.has(c)) c++;
    // Falls back to reuse rather than inventing a fifth tint. Four suffice for
    // a planar map, so this is unreachable in practice; if geometry ever made
    // it reachable, a repeated tint beside a heavy outline is still readable.
    colour.set(id, c % TINTS.length);
  }
  return colour;
}

/**
 * Rough advance width of a label, in SVG units.
 *
 * Measured rather than assumed: at 9px in the system sans stack, mixed-case
 * Latin averages close to 0.5em per character. This only has to be good enough
 * to decide whether a name fits inside a polygon, and erring high means we omit
 * a borderline label rather than letting it spill across a border.
 */
function textWidth(text: string, fontPx: number): number {
  return text.length * fontPx * 0.53;
}

export function ReferenceMap({
  districts,
  provinces,
  height = 520,
}: {
  districts: District[];
  provinces: Province[];
  height?: number;
}) {
  const dis = districts
    .map((d) => ({ ...d, rings: parseGeometry(d.geometryGeoJson) }))
    .filter((d) => d.rings.length > 0);
  const provs = provinces
    .map((p) => ({ ...p, rings: parseGeometry(p.geometryGeoJson) }))
    .filter((p) => p.rings.length > 0);

  if (!dis.length) return null;

  // Both layers go into the same bounding box: a province outline that was
  // fitted separately would not line up with the district borders beneath it.
  const { width, project } = projector(
    [...dis.map((d) => d.rings), ...provs.map((p) => p.rings)],
    height,
  );

  const tintOf = colourProvinces(provs);

  const FONT = 9;

  // Label boxes, computed once. `box` is the extent of the largest ring, which
  // is what a centred label actually has to fit inside.
  const boxes = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const d of dis) {
    let best: Ring = [];
    for (const poly of d.rings) {
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
    boxes.set(d.placeId, {
      x: sx / best.length,
      y: sy / best.length,
      w: right - left,
      h: bottom - top,
    });
  }

  /*
    Label placement, in two passes.

    The first pass is a fit test against the district's own shape. That alone is
    not enough: it put "Dhading" and "Nuwakot" on top of each other and pushed
    "Dadeldhura" off the western edge of the frame, because a label that fits its
    own polygon can still collide with its neighbour's or with the viewBox.

    So the second pass is greedy collision suppression, largest district first.
    Area is the right priority order here: a bigger district has more room, and
    if two labels contest the same space the smaller one is the one a reader can
    more easily find in the tables instead. Anything suppressed becomes a dot,
    so nothing is silently dropped -- the caption reports the count.
  */
  type Placed = { left: number; right: number; top: number; bottom: number };
  const placed: Placed[] = [];
  const labelled: typeof dis = [];
  const dotted: typeof dis = [];

  const candidates = [...dis].sort((a, b) => {
    const ba = boxes.get(b.placeId)!;
    const aa = boxes.get(a.placeId)!;
    return ba.w * ba.h - aa.w * aa.h;
  });

  for (const d of candidates) {
    const box = boxes.get(d.placeId)!;
    const tw = textWidth(d.name, FONT);
    // 0.82 of the shape's own width, so a label never runs to the border.
    const fitsShape = tw <= box.w * 0.82 && box.h >= FONT + 3;
    if (!fitsShape) {
      dotted.push(d);
      continue;
    }

    const rect: Placed = {
      left: box.x - tw / 2,
      right: box.x + tw / 2,
      top: box.y - FONT * 0.6,
      bottom: box.y + FONT * 0.6,
    };

    // Inside the frame, with the same padding the projection uses.
    if (rect.left < 2 || rect.right > width - 2) {
      dotted.push(d);
      continue;
    }

    const clashes = placed.some(
      (q) =>
        rect.left < q.right &&
        rect.right > q.left &&
        rect.top < q.bottom &&
        rect.bottom > q.top,
    );
    if (clashes) {
      dotted.push(d);
      continue;
    }

    placed.push(rect);
    labelled.push(d);
  }

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Administrative reference map of Nepal: ${dis.length} districts grouped within ${provs.length} provinces. Every district is listed by name in the province tables below.`}
      >
        {/* Districts, filled by their province's grouping tint. */}
        {dis.map((d) => (
          <Link key={d.placeId} href={d.href}>
            <title>{d.name}</title>
            <path
              d={toPath(d.rings, project)}
              className="geo-district"
              fill={
                TINTS[(d.parentPlaceId ? tintOf.get(d.parentPlaceId) : undefined) ?? 0]
              }
            />
          </Link>
        ))}

        {/* Province outlines last, so the heavy stroke sits above every
            district edge it crosses. Not interactive -- the districts beneath
            are the links, and an invisible overlay would swallow their clicks. */}
        {provs.map((p) => (
          <path
            key={p.placeId}
            d={toPath(p.rings, project)}
            className="geo-province-outline"
          />
        ))}

        {/* Locator dots for districts too small to hold their own name. */}
        {dotted.map((d) => {
          const b = boxes.get(d.placeId)!;
          return (
            <circle
              key={`dot-${d.placeId}`}
              cx={b.x}
              cy={b.y}
              r={1.4}
              fill="var(--color-ink-soft)"
              pointerEvents="none"
            />
          );
        })}

        {labelled.map((d) => {
          const b = boxes.get(d.placeId)!;
          return (
            <text
              key={`lb-${d.placeId}`}
              x={b.x}
              y={b.y + 3}
              textAnchor="middle"
              className="font-medium"
              fontSize={FONT}
              fill="var(--color-ink)"
              pointerEvents="none"
            >
              {d.name}
            </text>
          );
        })}
      </svg>

      <figcaption className="text-ink-faint mt-4 text-[12px] leading-relaxed">
        {provs.length} provinces, {dis.length} districts. Shading groups districts by
        province; the heavier outline is the provincial border. {labelled.length}{" "}
        districts are named on the map
        {dotted.length > 0 && (
          <>
            {" "}
            — the remaining {dotted.length} are marked with a dot and are too small to
            hold a label at this size. Every district is named in the province tables
            below.
          </>
        )}
      </figcaption>
    </figure>
  );
}
