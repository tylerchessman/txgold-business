"""TXG1 request signing: the canonical string, ECDSA P-256 signatures and .NET-tick timestamps."""

from __future__ import annotations

import base64
import hashlib
import threading
import time
from typing import Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

#: The first line of every canonical string: the scheme and version.
SCHEME = "TXG1-ECDSA-P256-SHA256"

#: Ticks (100 ns) from 0001-01-01 (the .NET epoch) to 1970-01-01.
_DOTNET_EPOCH_OFFSET_TICKS = 621_355_968_000_000_000


def sha256_hex(body: bytes) -> str:
    """Lower-case hex SHA-256 of the exact body bytes (an empty body is the hash of nothing)."""
    return hashlib.sha256(body).hexdigest()


def canonical_string(method: str, path: str, query: str, timestamp: str, body: bytes) -> str:
    """The string a request's signature covers::

        TXG1-ECDSA-P256-SHA256\\nMETHOD\\nPATH\\nQUERY\\nTIMESTAMP\\nhex(sha256(body))

    PATH and QUERY exactly as sent (QUERY without the "?", empty when there is none).
    """
    return "\n".join([SCHEME, method.upper(), path, query, timestamp, sha256_hex(body)])


def sign_canonical(private_key: ec.EllipticCurvePrivateKey, canonical: str) -> str:
    """Signs a canonical string: ECDSA P-256 with SHA-256, IEEE P1363 (r||s), base64."""
    der = private_key.sign(canonical.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
    r, s = decode_dss_signature(der)
    return base64.b64encode(r.to_bytes(32, "big") + s.to_bytes(32, "big")).decode("ascii")


def verify_canonical(public_key: ec.EllipticCurvePublicKey, canonical: str, signature_b64: str, encoding: str = "p1363") -> bool:
    """Checks a base64 signature ("p1363" or "der") over a canonical string. Used by the tests."""
    raw = base64.b64decode(signature_b64)
    if encoding == "p1363":
        if len(raw) != 64:
            return False
        raw = encode_dss_signature(int.from_bytes(raw[:32], "big"), int.from_bytes(raw[32:], "big"))
    try:
        public_key.verify(raw, canonical.encode("utf-8"), ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


def ticks_now(now_ns: Optional[int] = None) -> int:
    """UTC now as .NET ticks (100 ns since 0001-01-01), the TxG-Timestamp format."""
    ns = time.time_ns() if now_ns is None else now_ns
    return ns // 100 + _DOTNET_EPOCH_OFFSET_TICKS


class TimestampClock:
    """Hands out TxG-Timestamp values that never repeat within one client.

    The timestamp is also the request's idempotency key, so two different payments signed at the
    same instant must not share one. Thread-safe.
    """

    def __init__(self) -> None:
        self._last = 0
        self._lock = threading.Lock()

    def next(self) -> str:
        with self._lock:
            ticks = max(ticks_now(), self._last + 1)
            self._last = ticks
            return str(ticks)
