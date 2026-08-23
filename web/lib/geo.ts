/**
 * Web Mercator projection to SVG coordinates, at build time.
 *
 * Shared by the choropleth and the reference map. Extracted because the two
 * maps must agree exactly: they sit on the same page showing the same country,
 * and two copies of a projection are two chances to get the axis units wrong.
 *
 * That mistake has already happened once here. `mercatorY` returns a
 * radian-scale value; leaving longitude in degrees gave Nepal an aspect ratio of
 * 91:1 instead of about 2.4:1, and the country rendered as a horizontal smear a
 * few pixels tall. Both axes are converted, in one place.
 */

/** A closed ring of [lon, lat] pairs. */
export type Ring = [number, number][];

export function mercatorX(lon: number): number {
  return (lon * Math.PI) / 180;
}

export function mercatorY(lat: number): number {
  const clamped = Math.max(-85, Math.min(85, lat));
  return Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

export type Project = (lon: number, lat: number) => [number, number];

const PAD = 6;

/**
 * Fit a set of shapes into a frame of the given height, preserving aspect ratio.
 *
 * Takes *every* shape that will be drawn so they stay in register: a district
 * layer and a province outline layer must share one bounding box or the borders
 * will not line up.
 */
export function projector(
  shapes: Ring[][][],
  height: number,
): { width: number; project: Project } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const polygons of shapes) {
    for (const poly of polygons) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          const x = mercatorX(lon);
          const y = mercatorY(lat);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const width = Math.round((height - PAD * 2) * (spanX / spanY)) + PAD * 2;
  // Pixels per Mercator unit.
  const pxPerUnit = Math.min((width - PAD * 2) / spanX, (height - PAD * 2) / spanY);
  const offsetX = PAD + (width - PAD * 2 - spanX * pxPerUnit) / 2;
  const offsetY = PAD + (height - PAD * 2 - spanY * pxPerUnit) / 2;

  const project: Project = (lon, lat) => [
    offsetX + (mercatorX(lon) - minX) * pxPerUnit,
    // SVG y grows downward; Mercator y grows north.
    offsetY + (maxY - mercatorY(lat)) * pxPerUnit,
  ];

  return { width, project };
}

/** An SVG path for a MultiPolygon's worth of rings. */
export function toPath(polygons: Ring[][], project: Project): string {
  return polygons
    .map((poly) =>
      poly
        .map(
          (ring) =>
            ring
              .map(([lon, lat], i) => {
                const [x, y] = project(lon, lat);
                return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ") + "Z",
        )
        .join(" "),
    )
    .join(" ");
}

/** Parse the GeoJSON string the warehouse stores into rings. */
export function parseGeometry(geojson: string): Ring[][] {
  try {
    const g = JSON.parse(geojson) as { type: string; coordinates: unknown };
    if (g.type === "MultiPolygon") return g.coordinates as Ring[][];
    if (g.type === "Polygon") return [g.coordinates as Ring[]];
    return [];
  } catch {
    return [];
  }
}
