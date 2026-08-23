# web

Static frontend. Next.js with `output: "export"` — every page is generated at
build time from the published datasets in `../publish/dist/`. There is no
server, no runtime data fetching, and nothing to operate.

## Build

```bash
# from the repo root, first produce the data
python -m publish.export

cd web
npm install
npm run build      # copies publish/dist -> public/data, then builds to out/
```

`out/` is a plain directory of HTML — deployable to any static host.

## Pages

| Route | Count |
|---|---|
| `/` | 1 |
| `/np/[province]/` | 7 |
| `/np/[province]/[district]/` | 77 |

URLs are hierarchical because that is required for correctness, not style: 22
local-unit names are shared across districts, and slugs are unique only within
a parent.

## Data access

`lib/data.ts` reads the published JSON with plain `fs` at build time. Nothing
there reaches the browser. Parquet remains the canonical download format;
JSON is read here because pulling in a Parquet reader to parse a 1 MB file
during a build would be cost without benefit.

## Charts

The age-sex pyramid is hand-written SVG rather than a charting library — it is
one bespoke form, and shipping a chart runtime to draw 34 rectangles is not a
worthwhile trade on a static site.

Series colours are categorical slots 1 and 2, validated in both light and dark
modes (light CVD ΔE 24.7 / normal 33.6; dark 26.8 / 31.8; contrast ≥ 3:1 in
both). A legend is always present and each side is direct-labelled, so identity
is never carried by colour alone. Dark mode is a selected set of steps for the
dark surface, not an inversion.
