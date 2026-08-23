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

type Shape = {
  placeId: string;
  name: string;
  nameNe?: string | null;
  /**
   * Page for this area, if it has one.
   *
   * Null for local units, which have no pages yet. A shape without a
   * destination renders as a named shape rather than a link, because a link
   * that goes nowhere useful is worse than plain text -- and the caption stops
   * claiming every area is clickable.
   */
  href: string | null;
  geometryGeoJson: string;
  /**
   * What this shape belongs to. Drives the grouping tint.
   *
   * On the national map this is the province id, so districts group by province.
   * On a district page it is the local-unit type, so municipalities group by
   * kind -- the same grouping the page's own lists already use.
   */
  group: string | null;
};

/** A heavier boundary drawn over the shapes: the group's own outline. */
type Outline = {
  placeId: string;
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
  shapes,
  outlines,
  groupOrder,
  legend,
  caption,
  maxWidth = 1000,
  maxHeight = 460,
}: {
  shapes: Shape[];
  outlines: Outline[];
  /**
   * Explicit tint order for the groups.
   *
   * Supply this when the groups are a fixed vocabulary with a natural order --
   * local-unit types, say. Omit it when the groups are geographic, and tints get
   * assigned by graph colouring over adjacency instead, so no two neighbours
   * share one.
   */
  groupOrder?: string[];
  legend?: { group: string; label: string }[];
  caption: React.ReactNode;
  /** Nominal frame. One user unit stays close to one rendered pixel. */
  maxWidth?: number;
  maxHeight?: number;
}) {
  const dis = shapes
    .map((d) => ({ ...d, rings: parseGeometry(d.geometryGeoJson) }))
    .filter((d) => d.rings.length > 0);
  const provs = outlines
    .map((p) => ({ ...p, rings: parseGeometry(p.geometryGeoJson) }))
    .filter((p) => p.rings.length > 0);

  if (!dis.length) return null;

  // Both layers go into the same bounding box: an outline that was fitted
  // separately would not line up with the shape borders beneath it.
  const { width, height, project } = projector(
    [...dis.map((d) => d.rings), ...provs.map((p) => p.rings)],
    { maxWidth, maxHeight },
  );

  const tintOf = groupOrder
    ? new Map(groupOrder.map((g, i) => [g, i % TINTS.length]))
    : colourProvinces(provs);

  const FONT = 10;

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

  /*
    Leader lines for everything that did not fit.

    A dot alone told a reader "something is here, look it up elsewhere", which on
    the densest and most-searched part of the country -- the Kathmandu valley --
    is where the map should be working hardest. So the remainder get a name in a
    band below the country, joined to their district by a thin line.

    Labels are laid out in x order across two rows, which is what keeps the
    leaders from crossing: if label x order matches district x order, the lines
    fan out without intersecting. Two rows rather than one because eighteen names
    across the width of Nepal would otherwise overlap; alternating rows doubles
    the horizontal room each name gets.
  */
  /*
    Leader band layout.

    The band is allowed to be *wider* than the map. A tall narrow district like
    Dhanusa projects to a 342-unit-wide frame, and seven names averaging 90 units
    each will not fit across it however many rows they get -- laid out inside the
    map's own width they collided and the leftmost one clipped off the edge. So
    the band claims whatever width the names actually need, up to the page, and
    the map is centred within it.

    Rows are derived from the same measurement rather than fixed at two, and x is
    clamped so no label can leave the frame. Labels stay in x order, which is
    what keeps the leaders from crossing.
  */
  const ROW_GAP = 13;
  const LABEL_GAP = 8;

  /*
    Rows and band width chosen together, from the widest label.

    Deriving the width from the *total* label width and then the rows from the
    width was circular, and it under-provisioned: seven names in two rows across
    a 342-unit band gave each slot 85 units while the longest,
    "Mukhiyapatti Musaharmiya", needs 121. Nothing technically overlapped -- the
    clamp prevented that -- but adjacent names touched and read as one string.

    So: try successively more rows until every slot is at least as wide as the
    longest name, and let the band grow past the map if it needs to.
  */
  const widest = dotted.length
    ? Math.max(...dotted.map((d) => textWidth(d.name, FONT - 0.5))) + LABEL_GAP
    : 0;

  let leaderRows = 0;
  let bandWidth = width;
  if (dotted.length) {
    for (let rows = 1; rows <= 4; rows++) {
      leaderRows = rows;
      bandWidth = Math.max(width, Math.ceil(dotted.length / rows) * widest);
      if (bandWidth <= maxWidth) break;
    }
    bandWidth = Math.min(bandWidth, maxWidth);
  }

  const LEADER_BAND = leaderRows ? 14 + leaderRows * ROW_GAP : 0;

  const svgWidth = Math.max(width, bandWidth);
  const svgHeight = height + LEADER_BAND;
  // Centre the map inside a band that may be wider than it is.
  const dx = (svgWidth - width) / 2;

  const leaders = [...dotted]
    .sort((a, b) => boxes.get(a.placeId)!.x - boxes.get(b.placeId)!.x)
    .map((d, i) => {
      const b = boxes.get(d.placeId)!;
      const row = i % leaderRows;
      const slot = Math.floor(i / leaderRows);
      const perRow = Math.ceil(dotted.length / leaderRows);
      const step = svgWidth / Math.max(1, perRow);
      const half = textWidth(d.name, FONT - 0.5) / 2;
      return {
        d,
        from: { x: b.x + dx, y: b.y },
        to: {
          // Clamped so a long name cannot run off either edge.
          x: Math.min(Math.max(step * (slot + 0.5), half + 2), svgWidth - half - 2),
          y: height + 11 + row * ROW_GAP,
        },
      };
    });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
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
        style={{ width: `${svgWidth}px`, maxWidth: "100%", height: "auto" }}
        role="img"
        aria-label={`Administrative reference map: ${dis.length} areas in ${provs.length} groups. Every area is named, either on the map or in the leader labels below it.`}
      >
        <g transform={`translate(${dx},0)`}>
          {/* Shapes, filled by their group's tint. Wrapped in a link only when
            the area actually has a page. */}
          {dis.map((d) => {
            const shape = (
              <>
                <title>{d.name}</title>
                <path
                  d={toPath(d.rings, project)}
                  className="geo-district"
                  fill={TINTS[(d.group ? tintOf.get(d.group) : undefined) ?? 0]}
                />
              </>
            );
            return d.href ? (
              <Link key={d.placeId} href={d.href}>
                {shape}
              </Link>
            ) : (
              <g key={d.placeId}>{shape}</g>
            );
          })}

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
        </g>

        {/* Leaders: a dot on the district, a line out to a name below. */}
        {leaders.map(({ d, from, to }) => (
          <g key={`ld-${d.placeId}`} pointerEvents="none">
            <path
              d={`M${from.x.toFixed(1)},${from.y.toFixed(1)} L${to.x.toFixed(1)},${(to.y - 7).toFixed(1)}`}
              stroke="var(--color-line-strong)"
              strokeWidth={0.6}
              fill="none"
            />
            <circle cx={from.x} cy={from.y} r={1.4} fill="var(--color-ink-soft)" />
          </g>
        ))}

        {labelled.map((d) => {
          const b = boxes.get(d.placeId)!;
          return (
            <text
              key={`lb-${d.placeId}`}
              x={b.x + dx}
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

        {/* Leader labels are links, not decoration. The districts they name are
            a few pixels wide on the map, so this is the only practical way to
            click through to Bhaktapur or Lalitpur. */}
        {leaders.map(({ d, to }) => {
          const label = (
            <text
              x={to.x}
              y={to.y}
              textAnchor="middle"
              fontSize={FONT - 0.5}
              fill={d.href ? "var(--color-link)" : "var(--color-ink-soft)"}
            >
              {d.name}
            </text>
          );
          return d.href ? (
            <Link key={`ll-${d.placeId}`} href={d.href}>
              {label}
            </Link>
          ) : (
            <g key={`ll-${d.placeId}`}>{label}</g>
          );
        })}
      </svg>

      {legend && legend.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {legend.map((l) => (
            <li key={l.group} className="flex items-center gap-1.5 text-[12px]">
              <span
                aria-hidden
                className="border-line-strong size-3 rounded-[2px] border"
                style={{ background: TINTS[tintOf.get(l.group) ?? 0] }}
              />
              <span className="text-ink-soft">{l.label}</span>
            </li>
          ))}
        </ul>
      )}

      <figcaption className="text-ink-faint mt-4 text-[12px] leading-relaxed">
        {caption} {labelled.length} of {dis.length} are named on the map
        {dotted.length > 0 && (
          <>
            ; the remaining {dotted.length} are too small to hold a label and are named
            below it, joined by a leader line
          </>
        )}
        {dis.every((d) => d.href) ? ". Every area is a link." : "."}
      </figcaption>
    </figure>
  );
}
