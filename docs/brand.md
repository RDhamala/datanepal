# Brand direction

Status: **direction agreed; the visual language is now implemented.** Data-as-hero,
the colour-role system, type scale, and bilingual place names (`name_ne`
rendered alongside `name_en` throughout, not as translated metadata) are built —
see [visualization.md](visualization.md) and `web/lib/viz.ts`. Still open: the
Nepali wordmark rendering, the Devanagari typeface pairing, and whether the
signature accent reuses a data series colour (see "Open questions" below,
unchanged since this section was written).

## What DataNepal should feel like

A national public-data institution built for the internet age: trustworthy,
calm, precise, civic, intelligent, accessible, independent, distinctly
Nepal-focused, and useful to both ordinary citizens and professional
researchers.

Explicitly **not**: a startup landing page, a government bureaucracy, a
political campaign, a news site, a generic analytics dashboard, a SaaS product,
an NGO template, or an AI-generated interface.

Character sits between a high-quality statistical publication, a serious
data-journalism product, an excellent reference encyclopedia, and a modern civic
institution — without imitating any of them.

## Where identity comes from

Typography, disciplined layout, excellent data presentation, bilingual
treatment, a restrained colour system, consistency, and editorial confidence.

**Not** from Nepal clichés used as decoration: no mountains, prayer flags,
mandalas, temples, Himalaya photography, heavy flag use, or red simply because
the flag is red. Nepal identity should emerge through language, geography,
cartography, typography, naming, and carefully chosen references.

The site should be recognisable as DataNepal with the logo removed — through
type, spacing, grid, table treatment, map styling, chart conventions, bilingual
presentation, provenance patterns, and one restrained signature accent.

## Tone

Plain. It should read like a reliable reference work.

| Prefer | Not |
|---|---|
| Population of Nepal | Discover Nepal's population insights |
| Source: National Statistics Office | Powered by trusted data partners |
| Updated 23 Aug 2026 | Fresh insights updated regularly |

## Bilingual lockup — decided and implemented

Nepali is first-class, not decorative. A small grey translation under the
English wordmark is exactly what to avoid.

**Decided: तथ्याङ्क नेपाल** (*tathyāṅka Nepāl* — "Statistics Nepal"). Native
vocabulary, institutional register, not a transliteration of the English name —
chosen over the transliterated डेटा नेपाल and the reordered नेपाल तथ्याङ्क for
exactly that reason.

Implemented in `SiteHeader`/`SiteFooter` (`web/components/SiteHeader.tsx`) as a
genuine two-part lockup — "DataNepal" and "तथ्याङ्क नेपाल" on one baseline,
separated by a hairline rule, Devanagari set one step larger than the Latin
(18px vs 17px in the header) because its x-height reads smaller at equal point
size. Not a primary-and-subtitle pairing. `नेपाल, तथ्याङ्कमा` ("Nepal, in
data") remains a separate tagline, not the brand name — the two roles stay
distinct in the markup as well as in meaning.

Devanagari renders through a self-hosted **Noto Sans Devanagari** (via
`next/font/google` in `app/layout.tsx`), not a bare CSS font-family name — a
name alone only renders correctly for the fraction of visitors who happen to
have that font installed, which is nearly nobody outside Nepal on Windows or
macOS. "Kantipur" remains a fallback for the rare visitor who has it locally,
ahead of generic system fonts. This was the resolution of the typeface-pairing
question below: the free, guaranteed-coverage option, self-hosted rather than
assumed.

## Trust is part of the brand

Provenance should be elegant, not buried. A reader should easily see who
produced the data, what period it covers, when DataNepal retrieved it, whether
it is an estimate, projection, provisional or final figure, whether it has been
revised, and how to reach the source.

**This is the part with architectural consequences, and it is being built now.**
The canonical model carries `status` (actual / provisional / estimate /
projection / forecast / suppressed / not_collected), `revision`, `published_at`,
`retrieved_at`, and `is_current`; provenance resolves through
observation → dataset → publisher, URL, licence, retrieval date. The brand
requirement and the data model agree, which is a good sign for both.

Bilingual-as-first-class also has model consequences, already handled:
`indicators`, `dimensions`, `dimension_members`, and `places` all carry
`name_ne` alongside `name_en`, so Nepali is a property of the data rather than a
translation layer over the UI.

## Data is the hero

Charts, maps, tables, statistics, and geographic relationships are the visual
language. Decorative UI stays secondary. Before adding any illustration, icon,
card, effect, or ornament, ask: **does this make the data easier to understand,
or DataNepal easier to trust?** If not, leave it out.

## Longevity

Design for credibility in ten years. Avoid short-lived UI trends. It must absorb
hundreds of datasets and thousands of pages without becoming visually noisy —
which argues for a small number of rigorously reused patterns rather than
bespoke layouts per dataset.

## Resolved decisions

The four questions this section used to pose are all settled:

1. **Nepali wordmark** — तथ्याङ्क नेपाल. See "Bilingual lockup" above.
2. **Typeface pairing** — self-hosted Noto Sans Devanagari, not a licensed pair.
   See "Bilingual lockup" above.
3. **The signature accent** — kept deliberately distinct from the chart series
   colour. `--color-brand` (`web/app/globals.css`) is the one accent value;
   `--color-link` aliases to it rather than carrying its own separate blue, so
   there is genuinely one restrained accent rather than two similar ones
   competing. It drives link colour, focus rings, and other interactive chrome.
   `--color-series-1`/`--color-series-2` are reserved for chart data only —
   before this was enforced, the global focus ring and a couple of form
   controls had drifted into using the series colour as chrome, which is the
   exact mistake this question warned against; that's fixed.
4. **Map styling conventions** — settled as part of building the visualization
   system rather than as a separate brand exercise: see
   [visualization.md](visualization.md)'s "Maps" section for boundaries,
   labels, hover, legend and colour conventions, shared identically between the
   administrative-navigation and data-choropleth modes.
