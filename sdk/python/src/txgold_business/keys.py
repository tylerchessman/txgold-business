"""Key files from the business portal, and P-256 signing keys."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Union

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


@dataclass(frozen=True)
class SigningKey:
    """A private key and the TxG-Key-Id that names it."""

    #: The base64 SubjectPublicKeyInfo of the public key: the TxG-Key-Id header.
    key_id: str
    private_key: ec.EllipticCurvePrivateKey
    #: From the key file, when it says: "sandbox" or "production".
    environment: Optional[str] = None
    #: From the key file, when it says: the account the integration acts for.
    account_id: Optional[str] = None


def signing_key(private_key: Union[ec.EllipticCurvePrivateKey, str, bytes]) -> SigningKey:
    """Wraps a P-256 private key, or a PKCS#8 / SEC1 PEM."""
    if isinstance(private_key, (str, bytes)):
        pem = private_key.encode("ascii") if isinstance(private_key, str) else private_key
        private_key = serialization.load_pem_private_key(pem, password=None)  # type: ignore[assignment]
    if not isinstance(private_key, ec.EllipticCurvePrivateKey) or not isinstance(private_key.curve, ec.SECP256R1):
        raise ValueError("TxGold keys are ECDSA P-256 (secp256r1).")
    spki = private_key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return SigningKey(key_id=base64.b64encode(spki).decode("ascii"), private_key=private_key)


def load_key_file(path: Union[str, Path]) -> SigningKey:
    """Loads a key file from the business portal (txgold-<environment>-<name>.key.json).

    The private key may be ``privateKeyPkcs8`` (base64 PKCS#8 DER), ``privateKeyPem`` (PKCS#8
    "PRIVATE KEY" or SEC1 "EC PRIVATE KEY"), or ``privateKey`` (base64 SEC1 DER, older Sandbox files).
    """
    return parse_key_file(Path(path).read_text(encoding="utf-8"))


def parse_key_file(text: str) -> SigningKey:
    """Parses the text of a key file. See :func:`load_key_file`."""
    try:
        data = json.loads(text)
    except ValueError:
        raise ValueError("The key file is not valid JSON.") from None
    if not isinstance(data, dict):
        raise ValueError("The key file is not valid JSON.")

    def field(name: str) -> Optional[str]:
        value = data.get(name)
        return value if isinstance(value, str) and value else None

    pkcs8, pem, sec1 = field("privateKeyPkcs8"), field("privateKeyPem"), field("privateKey")
    if pkcs8:
        private_key = serialization.load_der_private_key(base64.b64decode(pkcs8), password=None)
    elif pem:
        private_key = serialization.load_pem_private_key(pem.encode("ascii"), password=None)
    elif sec1:
        # load_der_private_key reads SEC1 "EC PRIVATE KEY" DER as well as PKCS#8
        private_key = serialization.load_der_private_key(base64.b64decode(sec1), password=None)
    else:
        raise ValueError("The key file has no private key (privateKeyPkcs8, privateKeyPem or privateKey).")

    key = signing_key(private_key)  # type: ignore[arg-type]
    key_id = field("keyId")
    if key_id and key_id != key.key_id:
        raise ValueError("The key file's keyId does not match its private key.")

    account = data.get("accountId")
    return SigningKey(
        key_id=key.key_id,
        private_key=key.private_key,
        environment=field("environment"),
        account_id=str(account) if isinstance(account, (str, int)) and account != "" else None,
    )
