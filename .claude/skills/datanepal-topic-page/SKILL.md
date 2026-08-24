---
name: datanepal-topic-page
description: Use when creating or editing a topic hub page (Population & Demographics, Education, Economy, Government & Budgets, Elections, Health, Infrastructure, and future topics), adding a new topic's view configuration, building topic-discovery modules on the homepage or /topics directory, or changing what a topic page shows before drilling into individual indicators. Owns topic-page structure; for chart choice use datanepal-dataviz, for interface chrome use datanepal-ui.
---

# DataNepal topic pages

A topic page answers **"what should I know about this subject across Nepal?"** —
not an indicator directory with a nicer heading.

## Structure (where data supports it)

1. Plain-language topic introduction
2. Headline statistic (+ meaningful breakdown, e.g. sex split, right beside it)
3. Trend — important time series, if any exist for this topic
4. Geographic comparison — province/district/local comparison
5. Composition/breakdown — the category structure that matters most for this topic
6. Map — geographic variation of the headline or another key indicator
7. Related indicators — routes to individual indicator pages
8. Table/download fallback
9. Methodology/source, concise, linking to full detail

A missing section (no trend series exists yet) is omitted, not rendered empty —
same rule as place pages.

## Config over hardcoding

`web/app/topics/[topic]/page.tsx` is one code path for every live topic, driven
by a `TOPIC_VIEW` config keyed by topic slug:

```ts
const TOPIC_VIEW: Record<string, {
  headline: string;
  mapIndicator?: string;
  composition?: { indicator: string; dimension: string; label: string };
  pyramid?: boolean;
}> = {
  population: { headline: "population", mapIndicator: "population", pyramid: true },
  education: {
    headline: "literacy_rate",
    mapIndicator: "literacy_rate",
    composition: { indicator: "population_5plus", dimension: "literacy_status", label: "…" },
  },
};
```

**Adding a topic's view is a new entry in this config, never a new boolean flag
or a new branch in the page body.** The predecessor pattern was an `isPopulation`
flag that gated headline/map/rankings — every future topic would have needed its
own bespoke branch. If a topic needs a genuinely new *kind* of section (not
covered by `headline`/`mapIndicator`/`composition`/`pyramid`), extend the config
shape once, for every topic, rather than special-casing the page body for one
topic.

## Topic discovery (homepage, `/topics`)

Prioritize a meaningful headline value and a short description over internal
metadata. **Don't show observation counts as the primary thing a reader sees**
(`"7,533 observations"`) — that's catalog metadata, fine on a dataset page, noise
on a discovery card. Don't advertise a topic with no live data as a prominent
homepage module ("Planned coverage" sections were removed from the homepage for
this reason) — a topic either has a card because it has data, or it doesn't
appear.

## Reference

[`references/topic-template.md`](references/topic-template.md) — proof cases
(Population, Education) and what changed to generalize the page.
