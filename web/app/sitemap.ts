import type { MetadataRoute } from "next";
import { siteUrls } from "@/lib/sitemap";

/*
  `output: export` has no server to generate a route handler on request, and
  Next treats robots.txt and sitemap.xml as handlers rather than as pages. This
  says what is already true -- both are derived entirely from committed data at
  build time -- and without it the build fails rather than falling back.
*/
export const dynamic = "force-static";

/*
  Generated at build time into out/sitemap.xml, like every other page here.

  The enumeration lives in lib/ rather than in this file because that is where
  vitest looks, and a list of 890 URLs derived from four separate data calls is
  worth asserting counts against.

  changeFrequency and priority are deliberately absent. Google has said for
  years that it ignores both, and on 890 entries they are a few tens of
  kilobytes of XML stating a preference nobody reads.
*/
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return siteUrls();
}
