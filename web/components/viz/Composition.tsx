import { formatNumber, formatPercent } from "@/lib/format";
import { BAR, COLOR, TYPE } from "@/lib/viz";
import { LegendItem, Legend } from "./Figure";

/*
  Part to whole: a 100% stacked bar, not a pie.

  The site could say "72.4% literate" and could not say what the other 27.6% is,
  which matters because "cannot read or write" and "can read only" are different
  situations with different implications.

  A pie was the obvious alternative and is the wrong one. A pie shows one place;
  a stacked bar shows one place and then stacks in a list to show fifty, so the
  same mark answers "what is this made of" and "how does that differ across
  places". A pie also spends its area channel on quantities the eye compares
  badly, and degrades to unreadable below about 120px, which is most of a phone.

  The scale is the local total, not the national one, so a small district's
  composition is legible rather than a sliver. The absolute counts sit in the
  table beneath, because a proportion without its base cannot be re-aggregated.
*/

export type CompositionSlice = {
  id: string;
  label: string;
  value: number;
  /** Ramp position 0-4. Ordered categories get ordered colour. */
  tone: number;
};

export function Composition({
  slices,
  total,
}: {
  slices: CompositionSlice[];
  total: number;
}) {
  if (total <= 0) return null;

  /*
    Small categories are named, not merged.

    Grouping "can read only" (0.3%) and "not stated" (0.01%) into "other" would
    hide the distinction the chart exists to show. So every slice keeps its
    identity in the legend and the table; only the *bar segment* is given a
    minimum width so a 0.01% category is still visible as a sliver rather than
    rendering as nothing.
  */
  const MIN_PX = 2;
  const shown = slices.filter((s) => s.value > 0);

  return (
    <div>
      <Legend>
        {shown.map((s) => (
          <LegendItem
            key={s.id}
            color={COLOR.sequential[s.tone]}
            label={`${s.label} ${formatPercent(s.value / total)}`}
          />
        ))}
      </Legend>

      <div
        className="mt-3 flex overflow-hidden"
        style={{ height: BAR.thickness + 4, borderRadius: BAR.radius }}
        role="img"
        aria-label={shown
          .map((s) => `${s.label} ${formatPercent(s.value / total)}`)
          .join(", ")}
      >
        {shown.map((s) => (
          <span
            key={s.id}
            title={`${s.label} — ${formatNumber(s.value)} (${formatPercent(s.value / total)})`}
            style={{
              width: `${(s.value / total) * 100}%`,
              minWidth: MIN_PX,
              background: COLOR.sequential[s.tone],
            }}
          />
        ))}
      </div>

      <p className="text-ink-faint mt-2" style={{ fontSize: TYPE.small }}>
        {formatNumber(total)} people aged 5 and over. Shares of that total; counts are
        in the table.
      </p>
    </div>
  );
}

/*
  Where does this place sit among its peers?

  A dot plot over all 77 districts, which answers the question a single value
  cannot: 72.4% is meaningless until you can see that most districts sit between
  65 and 85 and this one is toward the bottom of that cluster.

  A histogram was the alternative. A dot plot wins here because the subject has
  to be findable: binning hides which bar contains *this* district, and the whole
  point is to locate one place in a distribution. At 77 points the dots also
  still separate, which they would not at 753.
*/
export function Distribution({
  values,
  subject,
  format,
  peerLabel,
  height = 46,
}: {
  values: { id: string; value: number }[];
  subject: { id: string; name: string; value: number };
  format: (v: number) => string;
  peerLabel: string;
  height?: number;
}) {
  const nums = values.map((v) => v.value).filter(Number.isFinite);
  if (nums.length < 5) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const width = 100; // percent-based, so it is fluid without measuring
  const x = (v: number) => ((v - lo) / span) * width;

  const sorted = [...nums].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* The peers, drawn faint and overlapping. Density is the message. */}
        {values.map((v) => (
          <span
            key={v.id}
            aria-hidden
            className="absolute rounded-full"
            style={{
              left: `${x(v.value)}%`,
              top: height / 2 - 3,
              width: 5,
              height: 5,
              marginLeft: -2.5,
              background: COLOR.boundary,
              opacity: 0.55,
            }}
          />
        ))}

        {/* The median, as a reference the eye can use without arithmetic. */}
        <span
          aria-hidden
          className="absolute"
          style={{
            left: `${x(median)}%`,
            top: height / 2 - 11,
            width: 1,
            height: 22,
            background: COLOR.inkFaint,
          }}
        />

        {/* The subject, which has to be findable at a glance. */}
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: `${x(subject.value)}%`,
            top: height / 2 - 5,
            width: 9,
            height: 9,
            marginLeft: -4.5,
            background: COLOR.series,
            outline: `2px solid ${COLOR.surface}`,
          }}
        />

        <span
          className="text-ink-faint tabular absolute left-0"
          style={{ top: height - 12, fontSize: TYPE.micro }}
        >
          {format(lo)}
        </span>
        <span
          className="text-ink-faint tabular absolute right-0"
          style={{ top: height - 12, fontSize: TYPE.micro }}
        >
          {format(hi)}
        </span>
      </div>

      <p className="text-ink-soft mt-1" style={{ fontSize: TYPE.small }}>
        <span className="text-ink font-medium">{subject.name}</span>{" "}
        <span className="tabular">{format(subject.value)}</span>
        <span className="text-ink-faint">
          {" "}
          · median {format(median)} across {values.length} {peerLabel}
        </span>
      </p>
    </div>
  );
}
