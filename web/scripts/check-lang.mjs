/*
  Devanagari must be marked up as Devanagari.

  `.ne` is the font class. `lang="ne"` is what makes a screen reader switch
  voices; without it, Devanagari is read with an English voice and comes out as
  noise. The two started life together and drifted apart across a dozen call
  sites, because nothing failed when only one of them was written.

  This checks the emitted HTML rather than the source, so it catches a bare
  Devanagari string wherever it came from -- including data, where the script
  is a property of the value and no component can know it in advance.

  `lang` inherits, so the check has to inherit too: a Devanagari span inside a
  `lang="ne"` wrapper is correct, and flagging it would train people to add
  redundant attributes until the real failures are lost in the noise.
*/
import { readFileSync, globSync } from "node:fs";

const DEVANAGARI = /[ऀ-ॿ]/;
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/** Devanagari text nodes missing `lang="ne"` or the `.ne` font class. */
function unmarked(html) {
  const token =
    /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^>])*?)(\/?)>|([^<]+)/g;
  const langs = [];
  const fonts = [];
  let noLang = 0;
  let noFont = 0;
  let total = 0;
  let inSkipped = 0;

  for (const m of html.matchAll(token)) {
    const [raw, name, attrs = "", selfClose, text] = m;

    if (text !== undefined) {
      if (inSkipped || !DEVANAGARI.test(text)) continue;
      total++;
      if (langs[langs.length - 1] !== "ne") noLang++;
      if (!fonts[fonts.length - 1]) noFont++;
      continue;
    }

    const tag = name.toLowerCase();
    if (raw.startsWith("</")) {
      if (tag === "script" || tag === "style") inSkipped--;
      langs.pop();
      fonts.pop();
      continue;
    }
    if (tag === "script" || tag === "style") inSkipped++;
    if (VOID.has(tag) || selfClose) continue;
    const lang = /\blang="([^"]*)"/.exec(attrs);
    langs.push(lang ? lang[1] : langs[langs.length - 1]);
    const cls = /\bclass="([^"]*)"/.exec(attrs);
    fonts.push(
      (cls && /(^|\s)ne(\s|$)/.test(cls[1])) || fonts[fonts.length - 1] || false,
    );
  }
  return { noLang, noFont, total };
}

let checked = 0;
const offenders = new Map();

for (const file of globSync("out/**/*.html")) {
  const { noLang, noFont, total } = unmarked(readFileSync(file, "utf8"));
  checked += total;
  if (noLang || noFont) offenders.set(file, { noLang, noFont });
}

if (offenders.size) {
  const lang = [...offenders.values()].reduce((a, o) => a + o.noLang, 0);
  const font = [...offenders.values()].reduce((a, o) => a + o.noFont, 0);
  console.error(
    `check-lang FAILED — across ${offenders.size} pages: ${lang} Devanagari text nodes with no lang="ne", ${font} with no .ne font class:`,
  );
  for (const [file, o] of [...offenders].slice(0, 10)) {
    console.error(`  ${file}: lang ${o.noLang}, font ${o.noFont}`);
  }
  console.error(
    "\nUse scriptAttrs() from lib/lang for data, or write both by hand for chrome.",
  );
  process.exit(1);
}

console.log(
  `check-lang ok — ${checked} Devanagari text nodes, every one under lang="ne" and the .ne font`,
);
