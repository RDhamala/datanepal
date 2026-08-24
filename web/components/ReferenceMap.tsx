import Link from "next/link";
import { parseGeometry, projector, toPath, type Ring } from "@/lib/geo";
import { labelBox, layoutLabels } from "@/lib/maplabels";
import { MapLabels, labelCaption } from "@/components/MapLabels";

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

  /*
    One shared label engine, the same one the choropleth uses. This component
    used to own the only good implementation -- fit, shorten, suppress
    collisions, run leader lines -- while the choropleth had a boolean that
    dropped every label at once. Extracting it is what makes the maps consistent.
  */
  const boxes = new Map(
    dis.map((d) => [d.placeId, labelBox(d.rings, project)] as const),
  );
  const layout = layoutLabels(dis, {
    name: (d) => d.name,
    box: (d) => boxes.get(d.placeId)!,
    width,
    height,
  });

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${height}`}
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
        aria-label={`Administrative reference map: ${dis.length} areas in ${provs.length} groups. Every area is named, either on the map or in the leader labels below it.`}
      >
        <g>
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

        <MapLabels layout={layout} />
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

      {/*
        The table the caption promises.

        Not optional: labels now stay inside the map, so a shape too small for a
        name gets a dot, and this is where that name lives. A caption that says
        "named in the table below" has to be true.
      */}
      <details className="mt-4">
        <summary className="text-ink-faint hover:text-ink-soft cursor-pointer text-[12px]">
          View all {dis.length} names
        </summary>
        <ul className="border-line divide-line mt-3 max-h-80 divide-y overflow-auto rounded-md border text-[13px]">
          {[...dis]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((d) => (
              <li key={d.placeId} className="px-3 py-1.5">
                {d.href ? <Link href={d.href}>{d.name}</Link> : <span>{d.name}</span>}
                {d.nameNe && <span className="text-ink-faint ne"> · {d.nameNe}</span>}
              </li>
            ))}
        </ul>
      </details>

      <figcaption className="text-ink-faint mt-4 text-[12px] leading-relaxed">
        {caption} {labelCaption(layout, dis.length)}
        {dis.every((d) => d.href) && " Every area is a link."}
      </figcaption>
    </figure>
  );
}
