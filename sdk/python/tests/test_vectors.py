"""The shared signing vectors (vectors/v1-request-signing.json at the repo root). Every TxGold SDK
must pass these: build each canonical string exactly, and verify the reference signatures."""

import base64
import json
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from txgold_business.signing import canonical_string, sha256_hex, sign_canonical, ticks_now, verify_canonical

VECTORS = json.loads((Path(__file__).parents[3] / "vectors" / "v1-request-signing.json").read_text(encoding="utf-8"))
PUBLIC_KEY = serialization.load_der_public_key(base64.b64decode(VECTORS["publicKeySpkiBase64"]))
CASES = VECTORS["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_body_hash_and_canonical_string(case):
    body = base64.b64decode(case["bodyBase64"])
    assert sha256_hex(body) == case["bodySha256Hex"]
    assert canonical_string(case["method"], case["path"], case["query"], case["timestamp"], body) == case["canonical"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_reference_signatures_verify(case):
    assert verify_canonical(PUBLIC_KEY, case["canonical"], case["signatureP1363Base64"], "p1363")
    assert verify_canonical(PUBLIC_KEY, case["canonical"], case["signatureDerBase64"], "der")
    assert not verify_canonical(PUBLIC_KEY, case["canonical"] + "x", case["signatureP1363Base64"], "p1363")


def test_own_signatures_are_64_byte_p1363():
    key = ec.generate_private_key(ec.SECP256R1())
    signature = sign_canonical(key, CASES[0]["canonical"])
    assert len(base64.b64decode(signature)) == 64
    assert verify_canonical(key.public_key(), CASES[0]["canonical"], signature)


def test_ticks_match_dotnet():
    # 2026-11-05T00:00:00Z is 639283104000000000 ticks (the vectors' timestamp)
    assert ticks_now(1_792_713_600 * 10**9) == 639283104000000000
