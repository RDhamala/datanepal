# Noto Sans Devanagari, self-hosted

Three WOFF2 subsets of the Noto Sans Devanagari **variable** font. One file
covers the whole 100–900 weight axis, which is why all three declared weights
in `app/globals.css` point at the same file per subset.

| File | Subset | Bytes | Unicode ranges |
|---|---|---|---|
| `noto-sans-devanagari-devanagari.woff2` | devanagari | 121,188 | U+0900–097F, U+1CD0–1CF9, U+200C–200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830–A839, U+A8E0–A8FF, U+11B00–11B09 |
| `noto-sans-devanagari-latin.woff2` | latin | 25,316 | U+0000–00FF, U+0131, U+0152–0153, … |
| `noto-sans-devanagari-latin-ext.woff2` | latin-ext | 13,816 | U+0100–02BA, U+02BD–02C5, … |

## Provenance

- **Source:** Google Fonts, retrieved by `next/font/google` during a production
  build on 2026-10-03 and lifted verbatim out of `.next`/`out`. These are the
  bytes Google serves for this family, not a re-subset of our own.
- **Upstream project:** https://github.com/notofonts/devanagari
- **Licence:** SIL Open Font License 1.1 — `OFL.txt` in this directory.
  Copyright 2022 The Noto Project Authors. OFL permits redistribution and
  embedding; it requires the licence to travel with the files, which is what
  `OFL.txt` is for. It is **not** copyleft over the site that uses the font, so
  it does not interact with the CC BY-IGO / CC0 licensing of the published data.

## Why the Latin subsets are here

They look droppable and are not. 539 published Nepali strings contain
parentheses, full stops, hyphens, a comma and two Latin capitals. Dropping the
Latin faces would render those characters from the fallback stack in the middle
of a Devanagari string — a visible mismatch inside a single place name.
`latin-ext` matches nothing in the current data, and is kept because the data
grows and 13 KB is not worth a future bug.

## Updating

Fonts have no refresh cadence and this one should not be touched casually. To
take a newer release, temporarily restore `next/font/google` in
`app/layout.tsx`, run a production build, and copy the WOFF2 files back out of
`out/_next/static/media/`, matching each to its subset by the `unicode-range` in
the generated CSS. Then update the byte counts above.
