/**
 * The canonical origin, in one place.
 *
 * It appears in the sitemap, in robots.txt, in `metadataBase` and in the
 * OpenGraph tags. Four hard-coded copies of a hostname drift the moment one of
 * them is edited, and the failure is quiet: a sitemap on a stale origin lists
 * 890 URLs that 301 or 404, and nothing in the build notices because every
 * individual file is well-formed.
 *
 * No trailing slash: every consumer appends a path that starts with one.
 */
export const SITE_ORIGIN = "https://datanepal.org";

/** An absolute, trailing-slash URL for a site-relative path. */
export function siteUrl(path: string): string {
  if (!path.startsWith("/")) throw new Error(`site path must be absolute: ${path}`);
  // `trailingSlash: true` is what the CDN serves, so it is what we advertise.
  // A sitemap entry without the slash redirects, and a redirect in a sitemap
  // is a crawl error rather than a page.
  const withSlash = path.endsWith("/") ? path : `${path}/`;
  return `${SITE_ORIGIN}${withSlash}`;
}
