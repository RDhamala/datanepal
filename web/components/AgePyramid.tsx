import { formatCompact, formatNumber } from "@/lib/data";

/**
 * Age-sex pyramid: paired horizontal bars, female left, male right.
 *
 * Two distinct series, so the colour job is categorical -- slots 1 and 2 of the
 * validated palette. Validated in both modes (light CVD ΔE 24.7 / normal 33.6;
 * dark 26.8 / 31.8; contrast ≥ 3:1 each). A legend is always present *and* each
 * side is direct-labelled in its column header, so identity never rests on
 * colour alone.
 *
 * Plain SVG rather than a charting library: one bespoke form, and shipping a
 * chart runtime to draw 34 rectangles is not a trade worth making on a static
 * site.
 *
 * One shared x-scale across both sides. That is the entire point of a pyramid --
 * a bar's length must be comparable left to right. Two scales would make every
 * population look balanced.
 */

type Band = { band: string; female: number; male: number };

const ROW_H = 20;
const GAP = 2; // surface gap between adjacent fills
const BAR_H = ROW_H - GAP;
const GUTTER = 52; // centre column for age labels
const WIDTH = 760;
const AXIS_H = 24;

export function AgePyramid({ bands, period }: { bands: Band[]; period: number }) {
  if (!bands.length) return null;

  // Oldest at the top: the convention, and it reads as an age axis.
  const rows = [...bands].reverse();
  const max = Math.max(...rows.flatMap((b) => [b.female, b.male]));
  if (max <= 0) return null;

  const plotH = rows.length * ROW_H;
  const height = plotH + AXIS_H;
  const half = (WIDTH - GUTTER) / 2;
  const scale = (v: number) => (v / max) * (half - 10);

  const step = niceStep(max);
  const ticks: number[] = [];
  for (let t = step; t <= max * 0.98; t += step) ticks.push(t);

  const total = rows.reduce((s, b) => s + b.female + b.male, 0);

  return (
    <figure className="m-0">
      <div className="text-ink-soft mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-series-1 size-2.5 rounded-[2px]" />
          Female
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="bg-series-2 size-2.5 rounded-[2px]" />
          Male
        </span>
        <span className="text-ink-faint">{period} · hover a band for exact counts</span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Population by five-year age band and sex, ${period}. Female on the left, male on the right. Total ${formatNumber(total)}.`}
      >
        {ticks.map((t) => (
          <g key={t} className="text-line">
            <line
              x1={half - scale(t)}
              x2={half - scale(t)}
              y1={0}
              y2={plotH}
              stroke="currentColor"
              strokeWidth={1}
            />
            <line
              x1={half + GUTTER + scale(t)}
              x2={half + GUTTER + scale(t)}
              y1={0}
              y2={plotH}
              stroke="currentColor"
              strokeWidth={1}
            />
          </g>
        ))}

        {ticks.map((t) => (
          <g key={`l${t}`} className="fill-ink-faint text-[10px]">
            <text x={half - scale(t)} y={plotH + 15} textAnchor="middle">
              {formatCompact(t)}
            </text>
            <text x={half + GUTTER + scale(t)} y={plotH + 15} textAnchor="middle">
              {formatCompact(t)}
            </text>
          </g>
        ))}

        {rows.map((b, i) => {
          const y = i * ROW_H;
          const fw = scale(b.female);
          const mw = scale(b.male);
          return (
            <g key={b.band} className="group">
              {/* Full-row hit target: easier than aiming at a 18px bar. */}
              <rect x={0} y={y} width={WIDTH} height={ROW_H} fill="transparent" />
              <rect
                x={0}
                y={y}
                width={WIDTH}
                height={BAR_H}
                className="fill-transparent group-hover:fill-current"
                style={{ color: "var(--color-surface-sunken)" }}
              />

              <rect
                x={half - fw}
                y={y}
                width={fw}
                height={BAR_H}
                rx={3}
                className="fill-series-1 transition-opacity group-hover:opacity-80"
              />
              <text
                x={half - fw - 6}
                y={y + BAR_H - 5}
                textAnchor="end"
                className="fill-ink-soft tabular text-[10px] opacity-0 group-hover:opacity-100"
              >
                {formatNumber(b.female)}
              </text>

              <text
                x={half + GUTTER / 2}
                y={y + BAR_H - 5}
                textAnchor="middle"
                className="fill-ink-faint tabular text-[10px]"
              >
                {b.band}
              </text>

              <rect
                x={half + GUTTER}
                y={y}
                width={mw}
                height={BAR_H}
                rx={3}
                className="fill-series-2 transition-opacity group-hover:opacity-80"
              />
              <text
                x={half + GUTTER + mw + 6}
                y={y + BAR_H - 5}
                textAnchor="start"
                className="fill-ink-soft tabular text-[10px] opacity-0 group-hover:opacity-100"
              >
                {formatNumber(b.male)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Table view: identity and values available without colour or hover,
          which is also the accessible fallback. */}
      <details className="mt-4">
        <summary className="text-ink-faint hover:text-ink-soft cursor-pointer text-[12px]">
          Show as table
        </summary>
        <div className="border-line mt-3 overflow-x-auto rounded-lg border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-line bg-surface-raised border-b">
                <th className="text-label text-ink-faint px-4 py-2 text-left uppercase">
                  Age
                </th>
                <th className="text-label text-ink-faint px-4 py-2 text-right uppercase">
                  Female
                </th>
                <th className="text-label text-ink-faint px-4 py-2 text-right uppercase">
                  Male
                </th>
                <th className="text-label text-ink-faint px-4 py-2 text-right uppercase">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.band} className="border-line border-b last:border-0">
                  <td className="text-ink-soft px-4 py-1.5">{b.band}</td>
                  <td className="text-ink-soft tabular px-4 py-1.5 text-right">
                    {formatNumber(b.female)}
                  </td>
                  <td className="text-ink-soft tabular px-4 py-1.5 text-right">
                    {formatNumber(b.male)}
                  </td>
                  <td className="text-ink tabular px-4 py-1.5 text-right font-medium">
                    {formatNumber(b.female + b.male)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** 1/2/5 x 10^n step, giving three to five gridlines. */
function niceStep(max: number): number {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  return (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
}
