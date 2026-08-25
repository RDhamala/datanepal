"""Nepal House of Representatives election results, 2082 BS (2026) -- Election
Commission Nepal.

Source: https://result.election.gov.np/
Licence: gov-open (see catalog/sources/ecn-hor-2026.yml)

There is no documented public API. The results site is a legacy ASP.NET
application that loads its own data client-side from a JSON handler,
discovered by inspecting the page's own network requests rather than from any
published interface:

    GET /Handlers/SecureJson.ashx?file=JSONFiles/Election2082/Common/<name>.txt

The handler is gated by a same-origin CSRF check (an `x-csrf-token` header
that must echo a `CsrfToken` cookie set on first load), not real
authentication -- fetching the homepage once to receive that cookie, then
replaying it, is enough. This is `acquisition_method: undocumented_endpoint`
in the catalog for exactly that reason: found, not documented.

Nepal's House of Representatives is a mixed system: 165 directly-elected
(first-past-the-post) seats plus 110 proportional-representation seats, 275
total. The two files below expose two different, not-directly-comparable
facts:

  HoRPartyTop5.txt    seats WON per party in FPTP constituencies (complete:
                      every party's TotLead is 0, and the seats sum to 165)
  PRHoRPartyTop5.txt  votes RECEIVED per party in the PR ballot -- not seats

The actual PR seat allocation is not published through this endpoint, and
this connector does not compute one: Nepal's PR formula applies a 3% national
threshold and a remainder-based allocation, and reimplementing an electoral
law to derive a number is exactly the kind of confidently-wrong-if-wrong
figure this project avoids publishing (see CLAUDE.md's testing philosophy).
What ships here is only what the source states outright -- FPTP seats, and PR
vote counts / vote share -- not a total-seats number nobody actually
published.

Independents have no party list and so no PR entry; they are still real FPTP
winners, carried under a fixed `independent` party id rather than dropped.
"""

from __future__ import annotations

import logging
import os
from collections.abc import Iterator
from typing import Any

import dlt
import httpx

logger = logging.getLogger(__name__)

BASE = "https://result.election.gov.np"
HANDLER = f"{BASE}/Handlers/SecureJson.ashx"
FPTP_FILE = "JSONFiles/Election2082/Common/HoRPartyTop5.txt"
PR_FILE = "JSONFiles/Election2082/Common/PRHoRPartyTop5.txt"

# Every FPTP seat is expected to have a symbol id except the independent
# residual category, which the source itself marks with SymbolID 0.
INDEPENDENT_PARTY_ID = "independent"


def _verify() -> str | bool:
    for var in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = os.getenv(var)
        if path and os.path.exists(path):
            return path
    return True


def _party_id(symbol_id: int) -> str:
    if symbol_id == 0:
        return INDEPENDENT_PARTY_ID
    return f"party_{symbol_id}"


_UA = "datanepal-bot/0.1 (+https://github.com/RDhamala/datanepal)"


def _session(client: httpx.Client) -> str:
    """Load the results homepage once to receive the CSRF cookie the JSON
    handler checks against. Not authentication -- a same-origin check the
    client-side JS satisfies by reading its own cookie back."""
    response = client.get(BASE + "/", headers={"User-Agent": _UA})
    response.raise_for_status()
    token = client.cookies.get("CsrfToken")
    if not token:
        raise ValueError("No CsrfToken cookie set by the results homepage; page may have changed.")
    return token


def _fetch_json(client: httpx.Client, token: str, file: str) -> list[dict[str, Any]]:
    response = client.get(
        HANDLER,
        params={"file": file},
        headers={
            "User-Agent": _UA,
            "x-csrf-token": token,
            "x-requested-with": "XMLHttpRequest",
            "referer": BASE + "/",
        },
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, list):
        raise ValueError(f"Unexpected response shape for {file}: {payload!r}")
    return payload


@dlt.resource(name="hor_2026", write_disposition="replace")
def hor_2026() -> Iterator[dict[str, Any]]:
    """Yield one row per (party, result_type)."""
    with httpx.Client(timeout=30, follow_redirects=True, verify=_verify()) as client:
        token = _session(client)
        fptp = _fetch_json(client, token, FPTP_FILE)
        pr = _fetch_json(client, token, PR_FILE)

    if not fptp or not pr:
        raise ValueError(f"Empty response: {len(fptp)} FPTP rows, {len(pr)} PR rows.")

    fptp_seats = sum(row["TotWin"] for row in fptp)
    if fptp_seats != 165:
        # The one externally known fact this connector can check itself
        # against: Nepal's constitution fixes FPTP seats at 165. A different
        # total means either an uncalled seat (TotLead > 0 somewhere) or a
        # changed response shape, not a result to publish quietly.
        undeclared = sum(row["TotLead"] for row in fptp)
        raise ValueError(
            f"FPTP seats sum to {fptp_seats}, not 165 ({undeclared} still shown as leading). "
            "Results may be incomplete; not publishing a partial count."
        )

    emitted = 0
    for row in fptp:
        party_id = _party_id(row["SymbolID"])
        emitted += 1
        yield {
            "result_type": "fptp_seats",
            "party_id": party_id,
            "party_name_ne": row["PoliticalPartyName"],
            "value": float(row["TotWin"]),
        }

    total_pr_votes = sum(row["TotalVoteReceived"] for row in pr)
    for row in pr:
        party_id = _party_id(row["SymbolID"])
        emitted += 1
        yield {
            "result_type": "pr_votes",
            "party_id": party_id,
            "party_name_ne": row["PoliticalPartyName"],
            "value": float(row["TotalVoteReceived"]),
        }
        emitted += 1
        yield {
            "result_type": "pr_vote_share_pct",
            "party_id": party_id,
            "party_name_ne": row["PoliticalPartyName"],
            "value": row["TotalVoteReceived"] / total_pr_votes * 100 if total_pr_votes else None,
        }

    logger.info(
        "ECN HoR 2026: %d FPTP parties (165 seats), %d PR parties (%d votes), %d rows",
        len(fptp),
        len(pr),
        total_pr_votes,
        emitted,
    )


@dlt.source(name="ecn_hor")
def ecn_hor_source():
    return [hor_2026()]
