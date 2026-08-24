# Bilingual UI reference

Full open questions (wordmark, typeface pairing): [`docs/brand.md`](../../../../docs/brand.md).

## Data model already supports this

`places`, `indicators`, `dimensions`, and `topics` all carry `name_ne` next to
`name_en`. Nepali is a property of the data, not a UI translation layer — so a
component should read `name_ne` from the record it's already rendering, never
maintain a parallel lookup table.

## Rules

- **Don't default Nepali to small grey metadata.** `PageHeader`'s `native` prop
  renders the Nepali name at a size and weight that reads as a peer to the
  English title, not a footnote. Follow that pattern for any new component that
  shows both names.
- **Coverage is uneven — render conditionally, not as an empty string.** District
  Nepali names are currently absent, local units ~66% covered. A component should
  omit the Nepali line when `name_ne` is null, not print a blank space or a
  placeholder dash.
- **Long strings**: Nepali compound place/indicator names can run longer than
  their English equivalent. Don't assume the two names take equal width when
  laying out a row or label — test with an actual long `name_ne`, not a short one.
- **Devanagari sizing is not "same font-size as the Latin next to it."** Devanagari
  and Latin have different x-heights and vertical rhythm; a shared `font-size`
  will look mismatched in weight even when the numbers are equal. Where a bilingual
  pair sits in one line (a heading, a lockup), expect to tune size/line-height per
  script rather than inheriting one value.
- **When duplication helps vs. adds noise**: identity (place names, topic names,
  indicator titles) — always show both where available, since a Nepali reader and
  an English reader are both a primary audience. Chart axis ticks, table column
  headers, and micro-labels — English only unless a specific page's audience
  argument says otherwise; duplicating every tick and legend entry produces noise
  without adding information a tooltip/readout doesn't already carry.
