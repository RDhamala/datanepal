/**
 * Verify every built place page, not a sample of them.
 *
 * The component system was proved on three pages and then applied to 84. A
 * template that is right for Bagmati and Dhading is not thereby right for
 * Manang with four local governments, Sarlahi with twenty, or Sudur Paschim
 * with the longest Nepali name in the country -- and nobody is going to open
 * 84 pages in a browser before every release.
 *
 * So the invariants that the proof pages established are asserted against the
 * built HTML of all of them. This is deliberately a check on the *output*
 * rather than on the components: it is the only place where "did this actually
 * render" can be answered, and it runs as `postbuild` so a regression fails
 * the build rather than reaching the CDN.
 *
 * Script tags are stripped before matching. Next serialises its RSC payload
 * into the document, so a naive grep for "undefined" finds `"$undefined"`
 * fifty times on a perfectly healthy page.
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "out", "np");

const EXPECTED = { provinces: 7, districts: 77, localGovernments: 753 };

/** As rendered in the eyebrow, from TYPE_LABEL in the local-government page. */
const TYPE_LABELS = [
  "Municipality",
  "Rural Municipality",
  "Metropolitan City",
  "Sub-Metropolitan City",
];

/** Rendered markup only: no RSC payload, no inline scripts. */
function render(file) {
  return (
    fs
      .readFileSync(file, "utf8")
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<template[\s\S]*?<\/template>/g, "")
      // React separates adjacent interpolations with an empty comment, so
      // "made up of <!-- -->13<!-- --> districts" is one sentence to a reader
      // and three fragments to a regex.
      .replace(/<!-- -->/g, "")
  );
}

const failures = [];
const fail = (page, msg) => failures.push(`${page}: ${msg}`);

/**
 * Checks every place page shares.
 *
 * `requireAgeSex` is false below district level, and that is a fact about the
 * data rather than a concession: UNFPA publishes age detail to districts and
 * no further, so a local government has no pyramid to nest. Asserting it
 * anyway would have made 753 pages fail for being correct.
 */
function checkCommon(page, html, { name, requireAgeSex = true }) {
  if (!new RegExp(`<h1[^>]*>${name}`).test(html)) {
    fail(page, `h1 does not open with "${name}"`);
  }

  // The identity chip. A P-code rendered as bare text was the old treatment.
  if (!/class="[^"]*font-mono[^"]*"[^>]*>NP\d{2,}/.test(html)) {
    fail(page, "P-code chip missing");
  }

  // Headline metrics with their reference periods. A figure without a chip is
  // the mixed-period hazard this platform is most exposed to.
  const chips = html.match(/>20\d\d<\/span>/g) ?? [];
  if (chips.length < 2) fail(page, `only ${chips.length} period chips`);

  // The two census topics every place has. Rendered as sections, not rows.
  for (const topic of ["Population &amp; Demographics", "Education"]) {
    if (!html.includes(topic)) fail(page, `missing section "${topic}"`);
  }

  // Comparative context. Without it a place page is a record, not a profile.
  if (
    !/above the national figure|below the national figure|matches the national figure/.test(
      html,
    )
  ) {
    fail(page, "no benchmark against the national figure");
  }

  // Coverage, stated once. Not a "not yet covered" section -- that is the
  // thing the place-page rule forbids.
  if (!html.includes("are published for Nepal as a whole")) {
    fail(page, "coverage note missing");
  }
  if (/Not yet covered/i.test(html)) fail(page, 'renders a "Not yet covered" section');

  // Age and sex is sub-structure of Population, never a peer of Education.
  if (/<h2[^>]*>Age and sex/.test(html)) {
    fail(page, "Age and sex is an h2; it belongs inside Population as an h3");
  }
  if (requireAgeSex && !/<h3[^>]*>\s*Age and sex structure/.test(html)) {
    fail(page, "Age and sex structure missing");
  }

  // A label inked with the surface colour is invisible wherever it overhangs
  // its shape, which is most of the long ones. One ink, one halo.
  const surfaceInk = html.match(/<text[^>]*fill="var\(--color-surface\)"/g) ?? [];
  if (surfaceInk.length) {
    fail(page, `${surfaceInk.length} map labels inked with the surface colour`);
  }

  // Every map label carries a halo, or it is legible only by luck.
  const labels = html.match(/<text[^>]*class="font-medium"[^>]*>/g) ?? [];
  const haloed = labels.filter((t) => t.includes('stroke="var(--color-surface)"'));
  if (labels.length && haloed.length !== labels.length) {
    fail(
      page,
      `${labels.length - haloed.length} of ${labels.length} map labels have no halo`,
    );
  }

  // Values that leaked a formatting failure.
  for (const bad of ["undefined", "NaN", "Infinity", "[object Object]"]) {
    if (html.includes(`>${bad}<`)) fail(page, `renders "${bad}"`);
  }

  // One disclosure vocabulary. Five labels for the same control was the defect.
  const summaries = [...html.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map(
    (m) => m[1].replace(/<[^>]*>/g, "").trim(),
  );
  for (const s of summaries) {
    if (!/^(View all \d+ [a-z ]+|View the numbers|What these measure)$/.test(s)) {
      fail(page, `unrecognised disclosure label "${s}"`);
    }
  }
}

/* ------------------------------------------------------------- provinces */

const provinceDirs = fs
  .readdirSync(OUT, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

if (provinceDirs.length !== EXPECTED.provinces) {
  fail(
    "np/",
    `${provinceDirs.length} province directories, expected ${EXPECTED.provinces}`,
  );
}

let districtCount = 0;
let localCount = 0;

for (const prov of provinceDirs) {
  const page = `np/${prov}`;
  const file = path.join(OUT, prov, "index.html");
  if (!fs.existsSync(file)) {
    fail(page, "no index.html");
    continue;
  }
  const html = render(file);
  const name = (html.match(/<h1[^>]*>([^<]+)</) ?? [])[1] ?? "";

  checkCommon(page, html, { name: name.replace(/ Province$/, "") });

  if (!/<h1[^>]*>[^<]+ Province</.test(html)) fail(page, 'h1 does not end "Province"');
  if (!/One of Nepal.s seven provinces, made up of \d+ districts/.test(html)) {
    fail(page, "locator sentence missing");
  }
  // Every province publishes a Nepali name; a district publishes none, and
  // the difference is the no-transliteration rule, not an oversight.
  if (!/lang="ne"/.test(html)) fail(page, "Nepali name missing");
  if (!html.includes("Districts by population"))
    fail(page, "district map/ranking missing");

  const districts = fs
    .readdirSync(path.join(OUT, prov), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dist of districts) {
    const dPage = `np/${prov}/${dist}`;
    const dFile = path.join(OUT, prov, dist, "index.html");
    if (!fs.existsSync(dFile)) {
      fail(dPage, "no index.html");
      continue;
    }
    districtCount++;
    const dHtml = render(dFile);
    const dName = ((dHtml.match(/<h1[^>]*>([^<]+)</) ?? [])[1] ?? "").replace(
      / District$/,
      "",
    );

    checkCommon(dPage, dHtml, { name: dName });

    if (!/<h1[^>]*>[^<]+ District</.test(dHtml))
      fail(dPage, 'h1 does not end "District"');
    if (
      !/A district of [^<.]+ Province, made up of \d+ local governments/.test(dHtml)
    ) {
      fail(dPage, "locator sentence missing or malformed");
    }
    if (!dHtml.includes("Local governments"))
      fail(dPage, "local-government section missing");
    if (!dHtml.includes("By population, 2021 census")) {
      fail(dPage, "linked ranking beside the local map missing");
    }

    /* ---------------------------------------------------- local governments */

    const locals = fs
      .readdirSync(path.join(OUT, prov, dist), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const local of locals) {
      const lPage = `np/${prov}/${dist}/${local}`;
      const lFile = path.join(OUT, prov, dist, local, "index.html");
      if (!fs.existsSync(lFile)) {
        fail(lPage, "no index.html");
        continue;
      }
      localCount++;
      const lHtml = render(lFile);
      const lName = (lHtml.match(/<h1[^>]*>([^<]+)</) ?? [])[1] ?? "";

      checkCommon(lPage, lHtml, { name: lName, requireAgeSex: false });

      // The eyebrow carries the legal type. A municipality and a rural
      // municipality are different kinds of thing, and the ranking this page
      // quotes is against its own type.
      // The four legal types, exactly as the page writes them. Title case on
      // the multi-word ones is the product's choice, not an accident -- the
      // eyebrow is uppercased by CSS and the locator sentence lowercases it,
      // so this is the only place the cased form is visible to a check.
      if (!new RegExp(`(${TYPE_LABELS.join("|")}) · [^<]+ District`).test(lHtml)) {
        fail(lPage, "type/district eyebrow missing or unrecognised");
      }

      if (
        !/A (municipality|rural municipality|metropolitan city|sub-metropolitan city) in [^<.]+ District, [^<.]+ Province, one of \d+ local governments there/.test(
          lHtml,
        )
      ) {
        fail(lPage, "locator sentence missing or malformed");
      }

      // The locator map and the sibling ranking beside it. At this level the
      // comparison is the page: 58,828 means nothing without its neighbours.
      if (!/<h2[^>]*>In context/.test(lHtml)) fail(lPage, "locator section missing");
      if (!/By population, 2021/i.test(lHtml)) fail(lPage, "sibling ranking missing");

      // 22 local-government names are shared across districts, which is why
      // URLs are hierarchical. The breadcrumb has to carry both parents, or
      // the four places called Madi are indistinguishable from each other.
      if (!new RegExp(`href="/np/${prov}/"`).test(lHtml)) {
        fail(lPage, "breadcrumb missing the province link");
      }
      if (!new RegExp(`href="/np/${prov}/${dist}/"`).test(lHtml)) {
        fail(lPage, "breadcrumb missing the district link");
      }
    }
  }
}

if (localCount !== EXPECTED.localGovernments) {
  fail(
    "np/",
    `${localCount} local-government pages, expected ${EXPECTED.localGovernments}`,
  );
}

if (districtCount !== EXPECTED.districts) {
  fail("np/", `${districtCount} district pages, expected ${EXPECTED.districts}`);
}

/* ------------------------------------------------------------------ report */

const checked = provinceDirs.length + districtCount + localCount;
if (failures.length) {
  console.error(
    `\ncheck-place-pages: ${failures.length} failures across ${checked} pages\n`,
  );
  for (const f of failures.slice(0, 40)) console.error("  " + f);
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  console.error("");
  process.exit(1);
}

console.log(
  `check-place-pages ok — ${provinceDirs.length} provinces, ${districtCount} districts, ` +
    `${localCount} local governments`,
);
