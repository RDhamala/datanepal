import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

/*
  `output: export` has no server to generate a route handler on request, and
  Next treats robots.txt and sitemap.xml as handlers rather than as pages. This
  says what is already true -- both are derived entirely from committed data at
  build time -- and without it the build fails rather than falling back.
*/
export const dynamic = "force-static";

/*
  There was no robots.txt, which means every crawler has been requesting one
  and getting the 404 page.

  Everything here is open data under stated licences and the whole point is for
  it to be found and reused, so nothing is disallowed. The file earns its place
  by naming the sitemap: that is how a crawler finds the 838 place pages
  without walking four levels of hierarchy to reach each one.

  This project asks the same courtesy of the publishers it reads -- CLAUDE.md
  makes checking robots.txt a hard constraint, and voterlist.election.gov.np is
  Disallow: / for everyone, which is why no connector touches it. Publishing a
  clear one of our own is the other half of that.
*/
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
