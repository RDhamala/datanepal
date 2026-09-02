"""What `ingestion.http.fetch` must and must not absorb.

The point of retrying is to stop unrelated network weather from failing the
build. The risk of retrying is that it also hides a source genuinely breaking,
which would be strictly worse than the flakiness it replaced. These tests pin
both halves, because only the first half is visible when CI happens to be green.

No network here by design: transient faults are rare on demand and impossible
to schedule, so every case constructs the exception it wants to test.
"""

from __future__ import annotations

import json

import httpx
import pytest

from ingestion import http


def _response(status: int) -> httpx.Response:
    return httpx.Response(status_code=status, request=httpx.Request("GET", "https://x"))


def _status_error(status: int) -> httpx.HTTPStatusError:
    response = _response(status)
    return httpx.HTTPStatusError("boom", request=response.request, response=response)


@pytest.fixture(autouse=True)
def _no_sleeping(monkeypatch: pytest.MonkeyPatch) -> None:
    """Assert on retry behaviour, not on how long backoff takes."""
    monkeypatch.setattr(http.time, "sleep", lambda _seconds: None)


# --------------------------------------------------------------- absorbed

@pytest.mark.parametrize(
    "exc",
    [
        httpx.ReadTimeout("timed out"),
        httpx.ConnectTimeout("timed out"),
        httpx.ConnectError("refused"),
        httpx.RemoteProtocolError("peer closed mid-response"),
        json.JSONDecodeError("Unterminated string", "{", 0),
        _status_error(429),
        _status_error(500),
        _status_error(503),
    ],
    ids=lambda e: (
        f"{type(e).__name__}{getattr(getattr(e, 'response', None), 'status_code', '')}"
    ),
)
def test_transient_faults_are_retried_then_succeed(exc: Exception) -> None:
    """The two real CI failures are in here: ReadTimeout and JSONDecodeError."""
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            raise exc
        return "ok"

    assert http.fetch(send, what="test") == "ok"
    assert calls["n"] == 2


def test_a_source_that_is_really_down_still_fails() -> None:
    """Retry delays the failure; it must not remove it."""
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        raise httpx.ReadTimeout("timed out")

    with pytest.raises(httpx.ReadTimeout):
        http.fetch(send, what="test", attempts=3)
    assert calls["n"] == 3


# ----------------------------------------------------------- not absorbed

@pytest.mark.parametrize("status", [400, 401, 403, 404, 410, 422])
def test_client_errors_fail_immediately(status: int) -> None:
    """A 404 is the source telling you something true. Retrying it four times
    turns one clear answer into a slow, noisy version of the same answer."""
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        raise _status_error(status)

    with pytest.raises(httpx.HTTPStatusError):
        http.fetch(send, what="test")
    assert calls["n"] == 1


def test_shape_assertions_are_never_retried() -> None:
    """The failure this project fears most is a partial load that looks fine.

    Connectors raise ValueError for their own shape checks -- the COD-PS age
    band, the Wikidata row floor, the fixed 165 FPTP seats. JSONDecodeError
    subclasses ValueError, so a careless `except ValueError` here would retry
    schema drift four times and then report a network problem.
    """
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        raise ValueError("Only 12 local units returned; expected several hundred")

    with pytest.raises(ValueError, match="Only 12 local units"):
        http.fetch(send, what="test")
    assert calls["n"] == 1


# -------------------------------------------------------------- behaviour

def test_retries_are_logged_so_a_degrading_source_stays_visible(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Absorbing a fault silently would trade a loud problem for an invisible
    one. Each attempt names the source so six interleaved loads stay legible."""
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        if calls["n"] < 3:
            raise httpx.ReadTimeout("timed out")
        return "ok"

    with caplog.at_level("WARNING"):
        assert http.fetch(send, what="World Bank NY.GDP.PCAP.CD") == "ok"

    warnings = [r for r in caplog.records if r.levelname == "WARNING"]
    assert len(warnings) == 2
    assert "World Bank NY.GDP.PCAP.CD" in warnings[0].getMessage()


def test_retry_after_header_is_honoured(monkeypatch: pytest.MonkeyPatch) -> None:
    """When a source states its own backoff, ignoring it invites a block."""
    slept: list[float] = []
    monkeypatch.setattr(http.time, "sleep", slept.append)

    response = _response(429)
    response.headers["Retry-After"] = "7"
    exc = httpx.HTTPStatusError("slow down", request=response.request, response=response)

    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            raise exc
        return "ok"

    assert http.fetch(send, what="test") == "ok"
    # 7 from the header, plus up to 1s of jitter -- not the 2s default.
    assert 7.0 <= slept[0] < 8.0


def test_success_costs_nothing() -> None:
    """The common path must not sleep or re-request."""
    calls = {"n": 0}

    def send() -> str:
        calls["n"] += 1
        return "ok"

    assert http.fetch(send, what="test") == "ok"
    assert calls["n"] == 1
