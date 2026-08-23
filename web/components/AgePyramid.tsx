/**
 * Age-sex pyramid: paired horizontal bars, female left, male right.
 *
 * Two distinct series, so the colour job is categorical -- slots 1 and 2.
 * Validated in both modes (light CVD dE 24.7 / normal 33.6; dark 26.8 / 31.8;
 * contrast >= 3:1 in each). A legend is always present and each side is
 * additionally direct-labelled in its header, so identity is never
 * colour-alone.
 *
 * Rendered as plain SVG rather than a chart library: it is one bespoke form,
 * and shipping a charting runtime to render 34 rectangles is not a trade worth
 * making on a static site.
 *
 * Shared x-scale across both sides -- the whole point of a pyramid is that a
 * bar's length is comparable left to right. Two scales would make the sexes
 * look balanced regardless of the data.
 */

type Band = { band: string; female: number; male: number };

export function AgePyramid({
  bands,
  formatNumber,
}: {
  bands: Band[];
  formatNumber: (n: number) => string;
}) {
  if (!bands.length) return null;

  // Oldest at the top, which is the convention and reads as an age axis.
  const rows = [...bands].reverse();

  const max = Math.max(...rows.flatMap((b) => [b.female, b.male]));
  if (max <= 0) return null;

  const rowH = 18;
  const gap = 2; // 2px surface gap between adjacent fills
  const barH = rowH - gap;
  const labelW = 46; // centre gutter for the age band label
  const width = 720;
  const height = rows.length * rowH + 34;
  const half = (width - labelW) / 2;

  // Round to a nice number so gridlines land on readable values.
  const step = niceStep(max);
  const ticks: number[] = [];
  for (let t = step; t <= max; t += step) ticks.push(t);

  const scale = (v: number) => (v / max) * (half - 8);

  return (
    <>
      <div className="legend">
        <span className="key">
          <span className="swatch" style={{ background: "var(--series-female)" }} />
          Female
        </span>
        <span className="key">
          <span className="swatch" style={{ background: "var(--series-male)" }} />
          Male
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          hover a band for exact counts
        </span>
      </div>

      <svg
        className="pyramid"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Population by five-year age band and sex. Female on the left, male on the right."
      >
        {/* Gridlines, recessive, behind the marks. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              className="gridline"
              x1={half - scale(t)}
              x2={half - scale(t)}
              y1={0}
              y2={rows.length * rowH}
            />
            <line
              className="gridline"
              x1={half + labelW + scale(t)}
              x2={half + labelW + scale(t)}
              y1={0}
              y2={rows.length * rowH}
            />
            <text
              className="axis-label"
              x={half - scale(t)}
              y={rows.length * rowH + 14}
              textAnchor="middle"
            >
              {compact(t)}
            </text>
            <text
              className="axis-label"
              x={half + labelW + scale(t)}
              y={rows.length * rowH + 14}
              textAnchor="middle"
            >
              {compact(t)}
            </text>
          </g>
        ))}

        {rows.map((b, i) => {
          const y = i * rowH;
          const fw = scale(b.female);
          const mw = scale(b.male);
          return (
            <g className="row" key={b.band}>
              {/* Hit target spans the full row, so hovering is easy on thin bars. */}
              <rect className="hit" x={0} y={y} width={width} height={rowH} />

              {/* Female, extending left from the centre gutter. */}
              <rect
                className="bar"
                x={half - fw}
                y={y}
                width={fw}
                height={barH}
                rx={3}
                fill="var(--series-female)"
              />
              <text
                className="value-label"
                x={half - fw - 5}
                y={y + barH - 4}
                textAnchor="end"
              >
                {formatNumber(b.female)}
              </text>

              <text
                className="band-label"
                x={half + labelW / 2}
                y={y + barH - 4}
                textAnchor="middle"
              >
                {b.band}
              </text>

              {/* Male, extending right. */}
              <rect
                className="bar"
                x={half + labelW}
                y={y}
                width={mw}
                height={barH}
                rx={3}
                fill="var(--series-male)"
              />
              <text
                className="value-label"
                x={half + labelW + mw + 5}
                y={y + barH - 4}
                textAnchor="start"
              >
                {formatNumber(b.male)}
              </text>
            </g>
          );
        })}
      </svg>
    </>
  );
}

/** 1/2/5 x 10^n step just below a tenth of the max, so 3-5 gridlines appear. */
function niceStep(max: number): number {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const mult = norm >= 5 ? 5 : norm >= 2 ? 2 : 1;
  return mult * mag;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 && n < 10_000 ? 1 : 0)}k`;
  return String(n);
}
