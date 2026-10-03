---
name: datanepal-web-data
description: Use when editing web/lib/data.ts, web/lib/format.ts or web/lib/data.test.ts, adding a query or accessor the pages call, exposing a newly published table to the frontend, writing generateStaticParams or any build-time data read, debugging a wrong or missing figure on a page (a headline showing an arbitrary party, a year off by one, a count that should be 753), or changing how Parquet is read at build time. Owns the build-time data layer between publish/dist and the React tree -- datanepal-ui owns chrome, datanepal-dataviz owns charts, this owns the numbers they are handed and the shape of the accessors that produce them.
---

# DataNepal web data layer

`web/lib/data.ts` is the only thing standing between published Parquet and
every page on the site. It runs at build time only — nothing in it reaches the
browser — and it is where this project's wrong numbers have come from, because
a wrong number here renders confidently and breaks nothing.

Read the file before editing it; it is ~1,570 lines and most conventions are
already stated in its comments. This skill is the part that is easy to violate
without noticing.

## The three constraints that shape everything

**Static export.** `output: "export"`. There is no server and no runtime
fetching. Every figure on the site is resolved during `next build`, which means
anything the data layer cannot answer at build time, the site cannot show.

**Parquet, not JSON.** JSON was fine at 4,590 observations and breaks at ward
scale (6,743 wards × indicators × years). `hyparquet` is pure JavaScript so
there is no native binding to fail in CI.

**It reads `publish/dist`, not the warehouse.** `DIST = ../publish/dist`. If a
dbt change is not exported, this layer cannot see it — see
`datanepal-build-publish`. A green test here after a model change usually means
the export was skipped.

## Defaults must fail closed

The governing question when adding an accessor: *if a caller forgets this,
does it break loudly or quietly?* Quiet is unacceptable, because the failure
surfaces as a plausible page rather than an error.

`places()` is the worked example. ADR-0008 added historical places to
`places.parquet`. Forty-odd call sites would each have had to remember to
exclude them, and the one that forgot would not throw — it would render an
extra map feature, or statically generate a page for a district abolished in
2015. So `places()` returns current places and `allPlaces()` is the opt-in. The
filter is the default; the full set is the thing you ask for by name.

Apply the same shape to anything with a "usually you want the subset" quality:
make the safe reading the short name.

## Known traps in the Parquet boundary

`normaliseRow` exists because of two conversions that are wrong in opposite
ways. Do not bypass it.

- **BIGINT arrives as `BigInt`** and throws on contact with a number. Loud, and
  therefore fine — it is converted, with a guard above `MAX_SAFE_INTEGER`.
- **DATE arrives as a `Date` at UTC midnight**, which in any negative-UTC
  offset renders as the *previous day* locally. `1965-01-01` becomes
  `getFullYear() === 1964`. Every year in every series would be off by one,
  only for developers west of Greenwich, and nothing errors. Dates are
  converted to ISO strings from UTC components.

**Cache the promise, not the value.** Next renders pages concurrently; caching
the resolved value lets several callers each start their own read of the same
file.

## The scalar-headline trap

`pickAggregate` returns the least specific row — fewest dimension members,
tie-broken on key length. That works because every dimension in the platform
has an `all` member: `sex`, `age_band`, `residence_type`, `literacy_status`.

**`party` does not.** All 58 party ids are the same length, so the tie-break
falls through to source order and the Elections headline became one arbitrary
minor party's three seats, presented as the national figure. The homepage and
`/topics/elections` now override it with `partyResultsFor`; the underlying
function still has the defect.

The general lesson, which matters more than the fix: **the headline-value
pattern assumes every indicator reduces to a scalar, and some do not.**
Elections do not. Budgets by ministry, prices by commodity and schools by level
will not either. When adding an accessor that reduces a dimensioned series to
one number, decide what it should do when no genuine aggregate exists — and
prefer returning nothing over returning a row that happens to sort first.

## Things the data layer must keep straight

- **Derive, do not store, anything that can drift.** `indicatorSlug()` is
  computed from the indicator id for exactly this reason.
- **URLs are hierarchical** (`/np/bagmati/kathmandu/`) because 22 local-unit
  names are shared across districts; slugs are unique only within a parent.
  Any lookup by slug takes its parent.
- **Never mix reference periods silently.** 2021 census is
  `status = 'actual'`; 2023 UNFPA is `status = 'projection'`. Dividing 2023
  population by 2021 households gives 4.0 people per household instead of 3.75,
  and each figure is individually correct. Carry status with the figure.
- **Local units do not sum to the national total.** 239,098 people are
  `residence_type = institutional` at district level, so local units sum to
  28,925,480 against a national 29,164,578. An accessor that sums children and
  compares to the parent needs to know this.
- **Rates and shares are not additive.** A comparison view is exactly where
  someone is tempted to sum a percentage.

## Testing

`web/lib/data.test.ts` is the right home for assertions about *shape and
externally known counts*, not just internal consistency: 7 provinces, 77
districts, 753 local units, the surrogate id never equalling the P-code, and
every returned place being current.

Write the test so that a silent regression fails it. The ADR-0008 tests are a
good model: they assert both that historical places are excluded from the
default *and* that they still exist in `allPlaces()`, so the test cannot pass
by the temporal model quietly not loading at all.

A new published table is reachable from here only once it exists in
`publish/dist`, which means a catalog entry — see `datanepal-build-publish`.
