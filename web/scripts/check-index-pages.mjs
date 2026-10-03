/**
 * Verify the index routes keep their two promises.
 *
 * **Their content is in the HTML.** For one commit /indicators/ shipped with
 * every indicator in the RSC payload and none in the document: a client
 * component using useSearchParams inside a Suspense boundary writes the
 * fallback to the file in a static export, so a crawler and a reader with
 * JavaScript off both got an Indicators page with no indicators. Typecheck,
 * lint, 119 tests, the place-page checker and a browser all passed it, because
 * every one of them either runs JavaScript or does not look at these routes.
 * This is the check that would have caught it.
 *
 * **Their length is bounded by structure, not by ingestion.** /indicators/ was
 * 6,686px on a desktop and 10,685px on a phone because it rendered 36
 * indicator rows in a run, and the platform intends to hold many times 36.
 * Collapsing by topic makes the height O(topics); this asserts that no
 * indicator row has escaped back out of a disclosure, which is how that
 * property would quietly be lost.
 *
 * Runs as postbuild, so a regression fails the build rather than reaching the
 * CDN.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out");

/** Rendered markup only: no RSC payload, no inline scripts, no comments. */
function render(route) {
  const file = path.join(OUT, route, "index.html");
  if (!fs.existsSync(file)) return null;
  return fs
    .readFileSync(file, "utf8")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<template[\s\S]*?<\/template>/g, "")
    .replace(/<!-- -->/g, "");
}

const failures = [];
const fail = (route, msg) => failures.push(`/${route}/: ${msg}`);

/* ----------------------------------------------------------- /indicators/ */

const indicators = render("indicators");
if (!indicators) {
  fail("indicators", "no index.html");
} else {
  // Every indicator reachable without running a script. 36 today; the count
  // is read from the page's own stated total so it tracks ingestion.
  const stated = indicators.match(/(\d+) indicators across (\d+) topics/);
  if (!stated) {
    fail("indicators", "does not state its total");
  } else {
    const total = Number(stated[1]);
    const links = new Set(
      [...indicators.matchAll(/href="\/indicators\/([a-z0-9-]+)\/"/g)].map((m) => m[1]),
    );
    if (links.size !== total) {
      fail(
        "indicators",
        `states ${total} indicators but ${links.size} are in the rendered HTML`,
      );
    }

    const topics = Number(stated[2]);
    const disclosures = (indicators.match(/<details/g) ?? []).length;
    if (disclosures !== topics) {
      fail("indicators", `${disclosures} disclosures for ${topics} topics`);
    }

    /*
      No indicator row outside a disclosure.

      This is the length budget as a testable property: every row lives inside
      a collapsed topic, so the page's height is set by the number of topics
      and not by the number of indicators. A row rendered in a bare <ul>
      would restore the 10,685px page without anything else looking wrong.
    */
    const outside = indicators.replace(/<details[\s\S]*?<\/details>/g, "");
    const escaped = [...outside.matchAll(/href="\/indicators\/([a-z0-9-]+)\/"/g)].map(
      (m) => m[1],
    );
    if (escaped.length) {
      fail(
        "indicators",
        `${escaped.length} indicator rows outside a disclosure (${escaped.slice(0, 3).join(", ")})`,
      );
    }
  }
}

/* ------------------------------------------------- the other index routes */

/**
 * The rest are checked for the prerender property only.
 *
 * Their lengths are fine and their growth vectors do not exist yet: /places/
 * is 2,929px and /datasets/ holds six datasets. When wards land, /places/
 * becomes a 6,743-row list and needs what /indicators/ now has — this is the
 * check that will say so, because the stated total and the rendered count
 * will still have to agree.
 */
const ROUTES = [
  { route: "places", h1: "Places", mustContain: ["All 77 districts", "By province"] },
  {
    route: "datasets",
    h1: "Datasets",
    mustContain: ["Source datasets", "Published tables"],
  },
  {
    route: "compare",
    h1: "Compare places",
    // Not the picker: that needs the 141 KB index and therefore JavaScript,
    // so its absence from the HTML is correct rather than a regression. What
    // must be here is the explanation and an honest account for a reader who
    // will never see the tool.
    mustContain: ["Two to five places", "needs JavaScript"],
  },
  {
    route: "topics",
    h1: "Topics are part of Indicators",
    mustContain: ["/indicators/"],
  },
];

for (const { route, h1, mustContain } of ROUTES) {
  const html = render(route);
  if (!html) {
    fail(route, "no index.html");
    continue;
  }
  if (!new RegExp(`<h1[^>]*>${h1.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(html)) {
    fail(route, `h1 is not "${h1}"`);
  }
  for (const needle of mustContain) {
    if (!html.includes(needle)) fail(route, `rendered HTML is missing "${needle}"`);
  }
}

// The topics index must not have become a second indicators index again.
const topicsHtml = render("topics");
if (topicsHtml) {
  if (!/rel="canonical"[^>]*\/indicators\//.test(topicsHtml)) {
    fail("topics", "no canonical pointing at /indicators/");
  }
  const indicatorLinks = [...topicsHtml.matchAll(/href="\/indicators\/[a-z0-9-]+\/"/g)]
    .length;
  if (indicatorLinks > 0) {
    fail("topics", `lists ${indicatorLinks} indicators again instead of redirecting`);
  }
}

// The Cloudflare rule, which is what actually 301s in production.
const redirects = path.join(OUT, "_redirects");
if (!fs.existsSync(redirects)) {
  fail("topics", "_redirects is not in the build output");
} else if (
  !/^\/topics\/ \/indicators\/ 301$/m.test(fs.readFileSync(redirects, "utf8"))
) {
  fail("topics", "_redirects has no /topics/ -> /indicators/ 301");
}

/* ------------------------------------------------------------------ report */

if (failures.length) {
  console.error(`\ncheck-index-pages: ${failures.length} failures\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}

console.log("check-index-pages ok — indicators, places, datasets, compare, topics");
