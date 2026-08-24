# Topic page — proof cases

## Population & Demographics

The original, and the one every prior version of this page was hardcoded for.
Headline: total population. Map: population choropleth. Pyramid: yes (only topic
with age-band data at the time this was written).

## Education

The second proof case, chosen specifically because it has real data for every
place (not a partial rollout) and exercises a different config shape than
Population: a headline rate (`literacy_rate`) rather than a headline count, plus
a `composition` breakdown (literacy status: can read & write / can read only /
cannot read & write / not stated, as a share of population aged 5+).

Deriving the national-level figures this page needed (national literacy rate,
national literacy composition) required new dbt models — see
`transform/models/intermediate/int_observations.sql`
(`census_literacy_national`, `census_literacy_composition_national`) — because
NSO's published tables start at province level with no country row. Both were
built by summing the additive components (population, literate population) at
national level and recomputing the rate, never by averaging the published
province rates, and were reconciled against NSO's own published ~76.2% national
figure before being trusted. This is the pattern to repeat for any future
national aggregate a topic page needs but the source doesn't publish directly —
see `datanepal-data-quality` for the reconciliation discipline.

## What to check before calling a third topic "done"

- Does `TOPIC_VIEW` need a new key, or does an existing shape (`headline`,
  `mapIndicator`, `composition`, `pyramid`) already cover it?
- Does the topic have a real national-level figure for anything it wants to lead
  with, or does one need deriving (and reconciling) first?
- Does the topic's most natural breakdown actually sum to a meaningful whole
  (a prerequisite for `Composition`), or would a stacked bar misrepresent it?
