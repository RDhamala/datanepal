import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompareExplorer } from "@/components/CompareExplorer";
import { Crumbs, PageHeader } from "@/components/ui";

/*
  The comparison a reader actually arrives with.

  Every place page could already compare its own children, and that is the
  comparison the data made easy rather than the one anybody asks. Humla
  against Kathmandu is two districts in different provinces. A ward officer
  checking their municipality against the three next to it is four places
  under three parents. Neither was expressible anywhere on this site, and the
  data supported both the whole time -- compareFor has always taken an
  arbitrary list of places; nothing ever passed it one.

  The page itself is a shell. Selection and rendering are client-side because
  a static export has no server to ask which places a reader wants, and the
  selection lives in the URL so a comparison can be sent to somebody.
*/

export const metadata: Metadata = {
  title: "Compare places",
  description:
    "Put any two to five places in Nepal side by side — provinces, districts " +
    "or local governments — on every measure published for all of them.",
};

export default function ComparePage() {
  return (
    <>
      <Crumbs
        trail={[
          { href: "/", label: "Nepal" },
          { href: "/places/", label: "Places" },
          { label: "Compare" },
        ]}
      />

      <PageHeader
        eyebrow="Compare"
        title="Compare places"
        native="स्थान तुलना"
        meta={
          <>
            Two to five places, at any level and under any parent, on every measure
            published for all of them. The selection is in the address, so a comparison
            can be shared. <Link href="/places/">Browse places</Link> ·{" "}
            <Link href="/indicators/">What is published, and how deep</Link>
          </>
        }
      />

      {/*
        useSearchParams needs a Suspense boundary to prerender, and the
        fallback is what a reader sees for the instant before hydration: the
        heading above is already useful, so this stays quiet rather than
        flashing a skeleton of a table that may never be drawn.
      */}
      {/*
        A reader with scripts off never gets past this, so it says so rather
        than showing "Loading places…" forever. Comparing needs the 141 KB
        index fetched and filtered in the browser; unlike the rest of the
        site, this one route genuinely cannot be static.
      */}
      <noscript>
        <p className="text-ink-soft max-w-prose text-[14px] leading-relaxed">
          Comparing places needs JavaScript: the list of 838 places is fetched and
          filtered in your browser. Every place has its own page with the same measures
          — <Link href="/places/">browse places</Link> — and each one carries a
          benchmark against its district, province and Nepal.
        </p>
      </noscript>

      {/*
        The reserved height is what keeps this from being the only page on the
        site with a layout shift. The fallback is one line and the explorer it
        becomes is a search box, two chips and a six-column table, so the swap
        moved the footer by most of a screen -- CLS 0.115, against a 0.1 budget.

        A floor, not a fixed height: the table grows with each place added, and
        it should.
      */}
      <div className="min-h-[34rem] sm:min-h-[30rem]">
        <Suspense
          fallback={<p className="text-ink-faint text-[14px]">Loading places…</p>}
        >
          {/*
          Nepal and its largest district, so the page demonstrates itself
          rather than opening on an empty frame. Any `?p=` in the address
          replaces this.
        */}
          <CompareExplorer initial={["nepal", "bagmati/kathmandu"]} />
        </Suspense>
      </div>
    </>
  );
}
