/**
 * Verify the sitemap is total, in both directions.
 *
 * A sitemap is the one artefact on this site whose errors are invisible from
 * the site. Drop the 753 local governments and it is still valid XML, still
 * passes a spot-check, still looks right in a browser -- and the long tail
 * this platform exists to publish quietly stops being indexed. Nothing else in
 * the build would notice, because every other check reads the pages.
 *
 * So the assertion is not "the sitemap contains some URLs". It is that the set
 * of URLs in the sitemap and the set of pages the build actually emitted are
 * the same set, with an explicit, named exception list. A check that compared
 * the sitemap against the function that generated it would agree with itself;
 * this compares it against the HTML on disk.
 *
 * Runs as postbuild, so a regression fails the build rather than reaching the
 * CDN.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");
const ORIGIN = "https://datanepal.org";

/**
 * Pages that exist in the output and must not be advertised.
 *
 * /topics/ is a 301 to /indicators/ and listing a redirect in a sitemap is
 * listing a crawl error. /404/ is the error page, which is not a destination.
 * Both are named here rather than pattern-matched so that a third one cannot
 * appear without someone deciding it should.
 */
const EXPECTED_ABSENT = new Set(["/topics/", "/404/"]);

/**
 * Route prefixes that are prototypes, not pages.
 *
 * /design-lab and /design-reset only exist in dev and in a Cloudflare branch
 * preview, where this checker still runs. They are deliberately not in the
 * sitemap -- advertising a prototype is worse than not shipping one -- so the
 * totality check has to know they are allowed to be absent. They cannot appear
 * in a production build at all; next.config.mjs is what guarantees that, and
 * the assertion further down is what proves it.
 */
const PROTOTYPE_PREFIXES = ["/design-lab/", "/design-reset/"];
const isPrototype = (p) => PROTOTYPE_PREFIXES.some((x) => p.startsWith(x));

const failures = [];
const fail = (msg) => failures.push(msg);

/* ------------------------------------------------------------ the sitemap */

const sitemapPath = path.join(OUT, "sitemap.xml");
if (!fs.existsSync(sitemapPath)) {
  console.error("\ncheck-sitemap: out/sitemap.xml was not generated\n");
  process.exit(1);
}
const xml = fs.readFileSync(sitemapPath, "utf8");
const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);

if (!locs.length) fail("sitemap lists no URLs");

// Protocol limits. Wards would take this from 890 to ~7,600, still inside
// them -- this is the line that will say so when it stops being true and the
// sitemap has to be split with generateSitemaps.
if (locs.length > 50_000) fail(`${locs.length} URLs exceeds the 50,000 limit`);
const bytes = fs.statSync(sitemapPath).size;
if (bytes > 50 * 1024 * 1024) fail(`sitemap is ${bytes} bytes, over the 50 MB limit`);

const paths = [];
for (const loc of locs) {
  if (!loc.startsWith(`${ORIGIN}/`)) {
    fail(`not on the canonical origin: ${loc}`);
    continue;
  }
  // trailingSlash: true, so anything else 301s and is a crawl error.
  if (!loc.endsWith("/")) fail(`no trailing slash, so it redirects: ${loc}`);
  paths.push(loc.slice(ORIGIN.length));
}

const duplicates = paths.filter((p, i) => paths.indexOf(p) !== i);
if (duplicates.length) fail(`${duplicates.length} duplicated URLs (${duplicates[0]})`);

/* -------------------------------------------------------------- lastmod */

const today = new Date().toISOString().slice(0, 10);
for (const entry of entries) {
  const mod = entry.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
  if (!mod) continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mod)) {
    fail(`lastmod is not a W3C date: ${mod}`);
  } else if (mod > today) {
    // A future date means the build clock leaked in instead of the data's own
    // revision history, which is the whole thing lastmod here is avoiding.
    fail(`lastmod is in the future: ${mod}`);
  }
}

/* --------------------------------------- the sitemap against the output */

/** Every route the build actually wrote, as a trailing-slash path. */
function emittedPages(dir = OUT, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "_next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) emittedPages(full, found);
    else if (entry.name === "index.html") {
      const rel = path.relative(OUT, path.dirname(full)).split(path.sep).join("/");
      found.push(rel ? `/${rel}/` : "/");
    }
  }
  return found;
}

const emitted = new Set(emittedPages());
const listed = new Set(paths);

const missing = [...emitted].filter(
  (p) => !listed.has(p) && !EXPECTED_ABSENT.has(p) && !isPrototype(p),
);
if (missing.length) {
  fail(
    `${missing.length} pages exist but are not in the sitemap (${missing.sort().slice(0, 5).join(", ")})`,
  );
}

const phantom = [...listed].filter((p) => !emitted.has(p));
if (phantom.length) {
  fail(
    `${phantom.length} sitemap URLs have no page (${phantom.sort().slice(0, 5).join(", ")})`,
  );
}

for (const excluded of EXPECTED_ABSENT) {
  if (listed.has(excluded)) fail(`${excluded} must not be advertised`);
}
// A prototype must never be advertised, in any build.
for (const p of paths) {
  if (isPrototype(p)) fail(`prototype route in the sitemap: ${p}`);
}

/* ------------------------------------------------------- the known counts */

const depth = (n) =>
  paths.filter((p) => p.startsWith("/np/") && p.split("/").filter(Boolean).length === n)
    .length;

for (const [label, actual, expected] of [
  ["provinces", depth(2), 7],
  ["districts", depth(3), 77],
  ["local governments", depth(4), 753],
]) {
  if (actual !== expected)
    fail(`${actual} ${label} in the sitemap, expected ${expected}`);
}
if (!listed.has("/np/")) fail("Nepal's own page is not in the sitemap");

/* ------------------------------------------------------------- robots.txt */

const robotsPath = path.join(OUT, "robots.txt");
if (!fs.existsSync(robotsPath)) {
  fail("robots.txt was not generated, so crawlers get the 404 page for it");
} else {
  const robots = fs.readFileSync(robotsPath, "utf8");
  // The sitemap's only discovery route for a crawler that was not submitted it.
  if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`)) {
    fail("robots.txt does not point at the sitemap");
  }
  if (/^Disallow: \/\s*$/m.test(robots)) fail("robots.txt disallows the whole site");
}

/* ------------------------------------------------------------------ report */

if (failures.length) {
  console.error(`\ncheck-sitemap: ${failures.length} failures\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}

const prototypes = [...emitted].filter(isPrototype).length;
console.log(
  `check-sitemap ok — ${locs.length} URLs, ${(bytes / 1024).toFixed(0)} KB, ` +
    `matching the ${emitted.size - EXPECTED_ABSENT.size - prototypes} public pages built` +
    (prototypes ? ` (+${prototypes} prototype routes, deliberately unlisted)` : ""),
);
