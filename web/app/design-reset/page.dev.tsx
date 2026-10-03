import type { Metadata } from "next";
import Link from "next/link";
import { prototypeRobots } from "@/components/design-reset/shared";
import { EscapeSiteChrome, SkipLink } from "@/components/design-reset/shared";

export const metadata: Metadata = {
  title: "Design reset — two directions",
  robots: prototypeRobots,
};

const UNIFIED = {
  name: "Unified — approved synthesis",
  idea: "Direction A's visual system and brand, with Direction B's linked map/ranking restyled to belong to it.",
  home: "/design-reset/unified/home/",
  place: "/design-reset/unified/dhading/",
  look: "Light editorial shell, serif for masthead/titles/lead figures only, hairline rules, no cards. The GeoExplorer reads as a figure, not a dashboard panel.",
};

const ROUTES = [
  {
    key: "A",
    name: "Editorial Statistical Publication",
    idea: "Reading order is the structure. Numbered chapters, one point each, figures large enough to be findings.",
    home: "/design-reset/editorial/home/",
    place: "/design-reset/editorial/dhading/",
    look: "System serif display, hairline rules, no cards, wide measure.",
  },
  {
    key: "B",
    name: "Geographic Civic Atlas",
    idea: "Geography is the index. A map and its ranking are one linked control; everything sits in bounded panels.",
    home: "/design-reset/atlas/home/",
    place: "/design-reset/atlas/dhading/",
    look: "Sans only, dark chrome, panelled grid, denser and more interactive.",
  },
];

/** Trade-offs, not a recommendation. The choice is the user's. */
const COMPARISON: { axis: string; a: string; b: string }[] = [
  {
    axis: "Discovery",
    a: "Sequential. A reader is led; finding one specific place means using search.",
    b: "Spatial. Any place is two clicks from the map, but there is no argued path through it.",
  },
  {
    axis: "Readability",
    a: "Highest. One column, big type, short standfirsts.",
    b: "Denser. More per screen, more for the eye to choose between.",
  },
  {
    axis: "Geographic exploration",
    a: "Supporting. The map illustrates; the ranking answers.",
    b: "Central. Map and ranking highlight together, on hover and on focus.",
  },
  {
    axis: "Topic scalability",
    a: "Each new domain is a chapter, so the homepage grows in length.",
    b: "Each new domain is a grid cell, so the homepage grows in density.",
  },
  {
    axis: "Professional users",
    a: "Good. Chart anatomy and provenance are prominent.",
    b: "Better. Metric switching, ranks and exact-data tables are one click away.",
  },
  {
    axis: "Ordinary citizens",
    a: "Better. Nothing to operate; the page explains itself in order.",
    b: "Good, but the main surface is a control, and controls can be ignored.",
  },
  {
    axis: "Bilingual identity",
    a: "Strongest: Devanagari sits at title scale in the masthead.",
    b: "Present but smaller — the dark chrome carries identity instead.",
  },
  {
    axis: "Distinctiveness",
    a: "High. Almost no data platform looks like this.",
    b: "Moderate. Closer to Eurostat and Data México, which is also a risk of looking generic.",
  },
  {
    axis: "Implementation risk",
    a: "Lower. Mostly layout and type; reuses existing charts.",
    b: "Higher. The linked map/ranking is new client state to maintain and test.",
  },
  {
    axis: "Mobile",
    a: "Degrades naturally — chapters stack.",
    b: "Needs real work — a map plus a ranking plus a switcher in 390px.",
  },
];

export default function DesignResetIndex() {
  return (
    <div className="bg-surface min-h-screen">
      <EscapeSiteChrome />
      <SkipLink />
      <main id="proto-main" className="max-w-page mx-auto px-5 py-12 sm:px-8">
        <p
          className="text-ink-faint text-[11px] uppercase"
          style={{ letterSpacing: "0.07em" }}
        >
          Design prototypes · not the live site
        </p>
        <h1 className="text-ink mt-2 text-[clamp(2rem,1.6rem+1.8vw,2.75rem)] leading-none font-semibold tracking-[-0.035em]">
          Two directions for DataNepal
        </h1>
        <p className="text-ink-soft mt-4 max-w-[62ch] text-[16px] leading-relaxed">
          Same real data, same content requirements. A and B were the two originals; the
          unified direction is the approved synthesis. Compare them on the homepage and
          the Dhading page — not on the summary below.
        </p>

        {/* ------------------------------------------------- the synthesis */}
        <section className="border-ink mt-9 border-t-2 pt-6">
          <p className="text-ink-faint text-[11px]" style={{ letterSpacing: "0.07em" }}>
            APPROVED DIRECTION
          </p>
          <h2 className="text-ink mt-1 text-[24px] leading-tight font-semibold tracking-[-0.02em]">
            {UNIFIED.name}
          </h2>
          <p className="text-ink-soft mt-3 max-w-[70ch] text-[15px] leading-relaxed">
            {UNIFIED.idea}
          </p>
          <p className="text-ink-faint mt-2 max-w-[70ch] text-[13px] leading-relaxed">
            {UNIFIED.look}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={UNIFIED.home}
              className="border-ink bg-ink text-surface rounded-md border px-4 py-2 text-[13px] no-underline"
            >
              Unified homepage →
            </Link>
            <Link
              href={UNIFIED.place}
              className="border-ink rounded-md border px-4 py-2 text-[13px] no-underline"
            >
              Unified Dhading →
            </Link>
          </div>
        </section>

        <h2 className="text-ink mt-14 text-[19px] font-semibold tracking-[-0.015em]">
          The two originals
        </h2>

        {/* --------------------------------------------------- the two cards */}
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          {ROUTES.map((r) => (
            <section key={r.key} className="border-line rounded-lg border p-6">
              <p
                className="text-ink-faint text-[11px]"
                style={{ letterSpacing: "0.07em" }}
              >
                DIRECTION {r.key}
              </p>
              <h2 className="text-ink mt-1 text-[21px] leading-tight font-semibold tracking-[-0.02em]">
                {r.name}
              </h2>
              <p className="text-ink-soft mt-3 text-[14px] leading-relaxed">{r.idea}</p>
              <p className="text-ink-faint mt-2 text-[13px] leading-relaxed">
                {r.look}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link
                  href={r.home}
                  className="border-ink bg-ink text-surface rounded-md border px-3 py-2 text-[13px] no-underline"
                >
                  Homepage →
                </Link>
                <Link
                  href={r.place}
                  className="border-line hover:border-line-strong rounded-md border px-3 py-2 text-[13px] no-underline"
                >
                  Dhading District →
                </Link>
              </div>
            </section>
          ))}
        </div>

        {/* ------------------------------------------------------ comparison */}
        <h2 className="text-ink mt-14 text-[19px] font-semibold tracking-[-0.015em]">
          Trade-offs
        </h2>
        <table className="mt-4 w-full text-[13px]">
          <caption className="sr-only">
            Direction A compared with Direction B across ten axes
          </caption>
          <thead>
            <tr className="border-line border-b">
              <th
                scope="col"
                className="text-ink-faint w-40 py-2 pr-4 text-left font-medium"
              >
                Axis
              </th>
              <th scope="col" className="text-ink py-2 pr-4 text-left font-medium">
                A — Editorial
              </th>
              <th scope="col" className="text-ink py-2 text-left font-medium">
                B — Atlas
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {COMPARISON.map((c) => (
              <tr key={c.axis} className="align-top">
                <th scope="row" className="text-ink py-3 pr-4 text-left font-medium">
                  {c.axis}
                </th>
                <td className="text-ink-soft py-3 pr-4 leading-relaxed">{c.a}</td>
                <td className="text-ink-soft py-3 leading-relaxed">{c.b}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-line mt-12 border-t pt-6">
          <p className="text-ink-soft max-w-[62ch] text-[14px] leading-relaxed">
            No recommendation here. Both are credible and the choice is a product
            decision, not a visual preference. Full write-up:{" "}
            <code className="text-ink text-[13px]">
              docs/design/design-reset-options.md
            </code>
          </p>
          <p className="text-ink-faint mt-3 text-[13px]">
            <Link href="/">Back to the live site</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
