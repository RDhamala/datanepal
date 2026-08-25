{{ config(severity = 'error', error_if = '>0') }}

/*
  The 2026 House of Representatives has 165 directly-elected seats, fixed by
  law, independent of anything the source reports. The connector already
  checks this at ingestion; this checks it again at the warehouse layer,
  against the published marts rather than the raw feed, so a bug introduced
  anywhere between raw ingestion and the published table -- a join that drops
  a party, a dimension mismatch -- is caught here too rather than only at the
  one point closest to the source.
*/

select sum(value_numeric) as total_seats
from {{ ref('observations') }}
where indicator_id = 'hor_fptp_seats_won'
having sum(value_numeric) <> 165
