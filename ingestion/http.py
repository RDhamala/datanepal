"""Shared HTTP for connectors: identity, TLS verification, and retry.

Every connector reached the network in the same shape -- a request, then a
parse -- and every connector was one transient fault away from failing the
build. Three of five CI runs on 2026-09-01 died in `Ingest all sources` for
reasons that had nothing to do with the code under test: the World Bank read
timed out twice mid-extraction, and Wikidata returned a body that stopped
mid-string ("Unterminated string starting at: line 23207"). Nothing was wrong;
the network was briefly the network.

That matters beyond the annoyance. A build that is red for unrelated reasons
teaches everyone to ignore red, which is exactly when a real regression walks
in. Retrying transient faults is what makes a red build mean something again.

Two rules keep this from becoming the opposite problem -- a pipeline that
papers over a source genuinely falling apart:

**Only transient faults retry.** Timeouts, connection resets, 429, and 5xx are
the network having a bad moment. A 404 or a 400 is the source telling you
something true, and this module re-raises those immediately. Shape assertions
never retry at all -- if the World Bank starts returning a different structure,
that is schema drift and it must fail loudly, per `datanepal-ingestion`.

**Every retry is logged at WARNING.** A source that needs three attempts every
run is degrading, and the point of absorbing the fault is to keep the signal,
not to hide it. Silent retries would turn a slow failure into an invisible one.

A truncated body is deliberately included as transient. `response.json()` raises
`JSONDecodeError` for it, which is a subclass of `ValueError` -- so this catches
`JSONDecodeError` specifically and never bare `ValueError`, because connectors
raise `ValueError` for their own shape checks and those must not be swallowed.
"""

from __future__ import annotations

import json
import logging
import os
import random
import time
from collections.abc import Callable
from typing import Any

import httpx

logger = logging.getLogger(__name__)

#: Identify the crawler honestly. Wikidata throttles or blocks generic agents,
#: and impersonating a browser is prohibited by this project's own rules.
USER_AGENT = "datanepal-bot/0.1 (+https://github.com/RDhamala/datanepal)"

#: The source is up but having a moment. Anything else is information.
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})

ATTEMPTS = 4
BASE_DELAY_SECONDS = 2.0
MAX_DELAY_SECONDS = 60.0


def verify() -> str | bool:
    """Honour conventional CA env vars; httpx ignores them by default.

    Kept here rather than copied into each connector, which is where it lived
    and drifted. Behind a TLS-inspecting corporate proxy the bundle is the only
    thing that makes any of this reachable at all.
    """
    for var in ("REQUESTS_CA_BUNDLE", "SSL_CERT_FILE"):
        path = os.getenv(var)
        if path and os.path.exists(path):
            return path
    return True


def _retry_after(exc: BaseException) -> float | None:
    """Honour a server's own Retry-After when it sets one."""
    response = getattr(exc, "response", None)
    if response is None:
        return None
    raw = response.headers.get("Retry-After")
    if not raw:
        return None
    try:
        # Delta-seconds form. The HTTP-date form is legal but rare here, and
        # guessing wrong is worse than falling back to our own backoff.
        return max(0.0, float(raw.strip()))
    except ValueError:
        return None


def _is_transient(exc: BaseException) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in RETRYABLE_STATUS
    if isinstance(exc, json.JSONDecodeError):
        # A body that stopped mid-structure. Malformed-but-complete JSON would
        # be a source change, but we cannot tell the two apart from here, and a
        # genuinely broken source will still fail after the last attempt.
        return True
    # TimeoutException and TransportError cover read/connect/write timeouts,
    # connection resets, and protocol errors mid-response.
    return isinstance(exc, (httpx.TimeoutException, httpx.TransportError))


def fetch[T](
    send: Callable[[], T],
    *,
    what: str,
    attempts: int = ATTEMPTS,
    base_delay: float = BASE_DELAY_SECONDS,
) -> T:
    """Run `send()`, retrying transient network faults with backoff.

    `send` is a zero-argument callable so the caller keeps full control of the
    request -- `httpx.get(...)`, `client.get(...)`, a request plus its
    `.json()`, whatever that source needs. Wrapping the parse *inside* `send`
    is what lets a truncated body be retried, which is the Wikidata failure.

    `what` names the thing being fetched and appears in the log line, because
    "attempt 2 failed" is useless when six sources are interleaved.

    Raises the last exception once attempts are exhausted -- a source that is
    really down still fails the build, just later and with an explanation.
    """
    last: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            return send()
        except Exception as exc:  # noqa: BLE001 - re-raised below if not transient
            if not _is_transient(exc):
                raise
            last = exc
            if attempt == attempts:
                break
            delay = min(base_delay * 2 ** (attempt - 1), MAX_DELAY_SECONDS)
            delay = _retry_after(exc) or delay
            # Jitter so several sources retrying at once do not synchronise
            # into a thundering herd against the same upstream.
            delay += random.uniform(0, 1)
            logger.warning(
                "%s: %s on attempt %d/%d, retrying in %.1fs",
                what,
                type(exc).__name__,
                attempt,
                attempts,
                delay,
            )
            time.sleep(delay)

    assert last is not None
    logger.error("%s: giving up after %d attempts", what, attempts)
    raise last


def get(url: str, *, what: str, **kwargs: Any) -> httpx.Response:
    """`httpx.get` with this project's identity, TLS handling, and retry."""
    headers = {"User-Agent": USER_AGENT, **(kwargs.pop("headers", None) or {})}
    kwargs.setdefault("follow_redirects", True)
    kwargs.setdefault("verify", verify())

    def send() -> httpx.Response:
        response = httpx.get(url, headers=headers, **kwargs)
        response.raise_for_status()
        return response

    return fetch(send, what=what)


def get_json(url: str, *, what: str, **kwargs: Any) -> Any:
    """As `get`, but parses JSON inside the retry so a truncated body retries."""
    headers = {"User-Agent": USER_AGENT, **(kwargs.pop("headers", None) or {})}
    kwargs.setdefault("follow_redirects", True)
    kwargs.setdefault("verify", verify())

    def send() -> Any:
        response = httpx.get(url, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

    return fetch(send, what=what)


def client_get(
    client: httpx.Client, url: str, *, what: str, **kwargs: Any
) -> httpx.Response:
    """`client.get` with retry, for sources that need a session (cookies, CSRF)."""
    headers = {"User-Agent": USER_AGENT, **(kwargs.pop("headers", None) or {})}

    def send() -> httpx.Response:
        response = client.get(url, headers=headers, **kwargs)
        response.raise_for_status()
        return response

    return fetch(send, what=what)


def client_get_json(client: httpx.Client, url: str, *, what: str, **kwargs: Any) -> Any:
    """As `client_get`, parsing JSON inside the retry."""
    headers = {"User-Agent": USER_AGENT, **(kwargs.pop("headers", None) or {})}

    def send() -> Any:
        response = client.get(url, headers=headers, **kwargs)
        response.raise_for_status()
        return response.json()

    return fetch(send, what=what)
