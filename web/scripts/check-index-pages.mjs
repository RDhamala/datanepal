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
 * **Their rows stay compact.** /indicators/ was 6,686px on a desktop because
 * each of 36 rows carried its definition as a paragraph -- 185px a row. It was
 * collapsed behind one <details> per topic to hide that, which bounded the
 * height and also meant the page's first impression was ten grey lids and no
 * data. The list is open again and the rows are compact instead, so the budget
 * has to be asserted on the thing that actually drives height: how much each
 * row carries. A definition paragraph creeping back in would restore the
 * original page without anything else looking wrong.
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
    // One hub link per topic section. Counting <h2> would also catch the
    // footer's, which is a different kind of heading on the same page.
    const sections = (indicators.match(/charts and rankings/g) ?? []).length;
    if (sections !== topics) {
      fail("indicators", `${sections} topic sections for ${topics} topics`);
    }

    /*
      The length budget, as a testable property.

      Rendered text per indicator row is the proxy for row height, and it is
      the quantity that went wrong: definitions averaged ~170 characters a row
      on top of ~90 for the name, unit, coverage, publisher, value and period.
      The compact row runs about 110. 150 leaves room for longer measure names
      and publishers without leaving room for a paragraph.
    */
    const rows = [...indicators.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
      .map((m) => m[1])
      .filter((html) => /href="\/indicators\/[a-z0-9-]+\//.test(html))
      .map((html) =>
        html
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      );
    const perRow = rows.length
      ? Math.round(rows.reduce((a, r) => a + r.length, 0) / rows.length)
      : 0;
    const BUDGET = 150;
    if (perRow > BUDGET) {
      fail(
        "indicators",
        `${perRow} rendered characters per indicator row (budget ${BUDGET}) -- rows have grown back`,
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
