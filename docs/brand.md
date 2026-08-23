# Brand direction

Status: **direction agreed, implementation deferred.** Recorded during the
architecture validation pass so it isn't lost. Do not act on the visual parts
until the foundation work is finished.

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

## Bilingual lockup — proposal, needs a decision

Nepali is first-class, not decorative. A small grey translation under the English
wordmark is exactly what to avoid.

Candidate Nepali renderings of the name:

| Rendering | Reading | Character |
|---|---|---|
| **तथ्याङ्क नेपाल** | *tathyāṅka Nepāl* — "Statistics Nepal" | Institutional, precise, native vocabulary. Reads like a national statistical body. |
| डेटा नेपाल | *ḍeṭā Nepāl* — transliterated "Data Nepal" | Modern, colloquial, but a loanword doing no semantic work. |
| नेपाल तथ्याङ्क | *Nepāl tathyāṅka* | Same words, government-department word order. |

**Recommendation: तथ्याङ्क नेपाल.** It uses native vocabulary, carries the
institutional register we want, and is not a transliteration of an English name.

For the lockup: set both at equal weight and equal optical size, separated by a
rule or as two balanced lines — a genuine bilingual mark, not a primary and a
subtitle. Note that `नेपाल, तथ्याङ्कमा` currently on the site is a *tagline*
("Nepal, in data"), not the brand name, and the two roles should stay distinct.

Devanagari and Latin have different x-heights and vertical metrics; equal point
size will not look equal. The lockup needs optical adjustment, which is a
reason to settle it deliberately rather than in passing.

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

## Open questions to settle before implementing

1. Nepali wordmark: confirm **तथ्याङ्क नेपाल**, or choose otherwise.
2. Typeface pairing. Devanagari support is the constraint, not the Latin choice.
   Candidates worth testing: Noto Serif / Noto Sans Devanagari for guaranteed
   coverage, or a licensed pair with a genuine Devanagari companion.
3. The signature accent. Currently a validated blue used as a categorical series
   colour. Decide whether the brand accent and the first series colour should be
   the same value — reusing a data colour as chrome makes charts read as
   branding, which is usually a mistake.
4. Map styling conventions, which will carry more identity than any other single
   element once maps exist.
