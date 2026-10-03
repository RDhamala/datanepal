{{ config(severity = 'error', error_if = '>0') }}

/*
  An observation must attach to a place that existed when it was measured.

  This is the test that makes ADR-0008 load-bearing rather than decorative.
  Without it, validity intervals are columns nobody reads: a 2011 census figure
  could be keyed to a local unit created in 2017 and nothing would object. The
  number would be published, correctly labelled as 2011, against geography that
  did not exist -- which is precisely the error the whole temporal model was
  built to prevent, arriving through the door it left open.

  The predicate is overlap, not containment, and deliberately so. A Nepali
  fiscal year runs mid-July to mid-July, so a series straddling 10 March 2017
  genuinely covers both the old geography and the new. Requiring the period to
  sit wholly inside the interval would fail those rows for being honest about
  their own dates. Overlap catches the real error -- no relationship at all
  between the measurement and the place -- without punishing the boundary case.

  Country-level observations always pass: the country has an open start, which
  is why it has one.
*/

select
    o.observation_id,
    o.dataset_id,
    o.indicator_id,
    p.name_en          as place_name,
    p.place_type,
    o.period_start,
    o.period_end,
    p.valid_from,
    p.valid_to,
    'observation period does not overlap the place''s validity' as problem

from {{ ref('int_observations') }} o
join {{ ref('int_places') }} p on p.place_id = o.place_id
where o.place_id is not null
  and not ({{ place_overlaps_period('p', 'o.period_start', 'o.period_end') }})
