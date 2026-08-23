/**
 * Copy published datasets into public/data so pages can link to downloads.
 *
 * Runs before dev and build. The files are generated artefacts and are
 * gitignored on both sides -- publish/dist is the source of truth, and
 * public/data is a build-time copy, never edited by hand.
 */
import fs from "node:fs";
import path from "node:path";

const from = path.join(process.cwd(), "..", "publish", "dist");
const to = path.join(process.cwd(), "public", "data");

if (!fs.existsSync(from)) {
  console.error(
    `[copy-data] Missing ${from}\n` +
      "Run `python -m publish.export` in the repo root first.",
  );
  process.exit(1);
}

fs.rmSync(to, { recursive: true, force: true });
fs.mkdirSync(to, { recursive: true });

let n = 0;
let bytes = 0;
for (const file of fs.readdirSync(from)) {
  const src = path.join(from, file);
  if (!fs.statSync(src).isFile()) continue;
  fs.copyFileSync(src, path.join(to, file));
  bytes += fs.statSync(src).size;
  n++;
}
console.log(`[copy-data] copied ${n} files (${(bytes / 1024).toFixed(0)} KB)`);
