import type { Metadata } from "next";
import Link from "next/link";
import { Crumbs, PageHeader } from "@/components/ui";

/*
  /topics/ is now /indicators/.

  The two indexes listed the same ten topics, the same indicators under each,
  and the same headline national value, and held two of six nav slots between
  them. /indicators/ added the unit, the definition and the geographic depth;
  /topics/ added an observation count. There was no question one answered that
  the other did not, and a reader who found both had to work out which was
  canonical.

  Topic is a filter on /indicators/ now, so the grouping survives and the
  duplicate destination does not. Individual topic pages are untouched --
  /topics/health/ is a hub with charts and a ranking, and every place page
  links to one.

  public/_redirects makes this a 301 in production. This page is what serves
  anywhere that file is not honoured -- a local `npx serve out`, a preview on
  a different host -- so the route never dead-ends. The canonical tag points
  at the destination either way.
*/

export const metadata: Metadata = {
  title: "Topics",
  description: "Browse DataNepal indicators by topic.",
  alternates: { canonical: "/indicators/" },
  robots: { index: false, follow: true },
};

export default function TopicsIndexMoved() {
  return (
    <>
      {/* A meta refresh rather than a script: this has to work with no
          JavaScript, and a crawler that ignores it still finds the canonical
          tag and the link below. */}
      <meta httpEquiv="refresh" content="0; url=/indicators/" />

      <Crumbs trail={[{ href: "/", label: "Nepal" }, { label: "Topics" }]} />

      <PageHeader
        eyebrow="Moved"
        title="Topics are part of Indicators"
        meta="Browsing by topic is a filter on the indicators index rather than a page of its own."
      />

      <p className="text-ink-soft max-w-prose text-[15px] leading-relaxed">
        <Link href="/indicators/">Go to Indicators</Link>, where every published measure
        is listed and can be filtered by topic and by how far down the geography it
        reaches.
      </p>
    </>
  );
}
