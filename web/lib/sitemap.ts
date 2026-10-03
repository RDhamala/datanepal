import {
  country,
  districtsOf,
  freshness,
  indicatorSlug,
  indicators,
  indicatorsOfTopic,
  liveTopics,
  localUnitsOf,
  provinces,
} from "./data";
import { siteUrl } from "./site";

/*
  Every page this site has, once each.

  838 place pages exist and none of them is linked from more than a couple of
  others: a rural municipality in Humla is four clicks from the homepage and
  has no inbound links from anywhere else on the web. Discovery by crawl alone
  reaches the provinces quickly and the long tail slowly or never, which for a
  reference platform is the whole value proposition sitting unindexed.

  Two properties are worth stating because both can break silently.

  **Every URL here is a page that exists, at the address the CDN serves.**
  `trailingSlash: true` means /np/bagmati 301s to /np/bagmati/, and a sitemap
  full of redirects is a sitemap of crawl errors. siteUrl owns that.

  **Every page that exists is here.** A sitemap that quietly lost the 753 local
  governments would still be valid XML and would still look right in a
  spot-check. scripts/check-sitemap.mjs compares this list against the HTML
  files the build actually emitted, in both directions, which is the only form
  of the check that cannot be satisfied by agreeing with itself.
*/

export type SitemapEntry = { url: string; lastModified?: string };

/**
 * Routes that exist but must not be advertised.
 *
 * /topics/ is a 301 to /indicators/ -- the two indexes were duplicates and
 * folding them in is what resolved it, so listing the redirect would undo the
 * point. /design-lab/ is not compiled into a production build at all; it is
 * named here so that a future change to the pageExtensions gate cannot leak it
 * into the sitemap without this line being deleted on purpose.
 */
const EXCLUDED = new Set(["/topics/", "/design-lab/"]);

export async function siteUrls(): Promise<SitemapEntry[]> {
  const fresh = await freshness();
  const entries: SitemapEntry[] = [];
  const add = (path: string, lastModified?: string) => {
    if (EXCLUDED.has(path.endsWith("/") ? path : `${path}/`)) return;
    entries.push(
      lastModified ? { url: siteUrl(path), lastModified } : { url: siteUrl(path) },
    );
  };

  /* ------------------------------------------------------------ indexes */
  /*
    Each of these summarises the whole export, so the newest change anywhere
    is genuinely the date they last differed. /about/ is the exception: it is
    hand-written prose about the project, no published value appears on it,
    and dating it from the data would be an invented number. lastmod is
    optional per the protocol, so it is omitted rather than guessed.
  */
  for (const path of ["/", "/places/", "/indicators/", "/compare/", "/datasets/"]) {
    add(path, fresh.latest);
  }
  add("/about/");

  /* ------------------------------------------------------------- places */
  const nepal = await country();
  if (nepal) add("/np/", fresh.byPlace.get(nepal.place_id) ?? fresh.latest);

  /*
    Walked downward through the parent relation, the same way the routes
    generate themselves, rather than from a flat list of slugs. 22 local-unit
    names are shared across districts and slugs are unique only within a
    parent, so a flat list cannot address them -- which is the reason these
    URLs are hierarchical in the first place.
  */
  for (const province of await provinces()) {
    add(`/np/${province.slug}/`, fresh.byPlace.get(province.place_id));
    for (const district of await districtsOf(province.place_id)) {
      const base = `/np/${province.slug}/${district.slug}/`;
      add(base, fresh.byPlace.get(district.place_id));
      for (const local of await localUnitsOf(district.place_id)) {
        add(`${base}${local.slug}/`, fresh.byPlace.get(local.place_id));
      }
    }
  }

  /* --------------------------------------------------- indicators, topics */
  for (const indicator of await indicators()) {
    add(
      `/indicators/${indicatorSlug(indicator.indicator_id)}/`,
      fresh.byIndicator.get(indicator.indicator_id),
    );
  }

  for (const topic of await liveTopics()) {
    // A topic hub is as new as the newest indicator it shows.
    const dates = (await indicatorsOfTopic(topic.topic_id))
      .map((i) => fresh.byIndicator.get(i.indicator_id))
      .filter((d): d is string => !!d)
      .sort();
    add(`/topics/${topic.slug}/`, dates.at(-1));
  }

  return entries;
}
