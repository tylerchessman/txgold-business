import base64
import json

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from txgold_business.keys import parse_key_file, signing_key


def pair():
    key = ec.generate_private_key(ec.SECP256R1())
    spki = key.public_key().public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
    return key, base64.b64encode(spki).decode()


def pem(key, fmt):
    return key.private_bytes(serialization.Encoding.PEM, fmt, serialization.NoEncryption()).decode()


def test_portal_key_file():
    key, key_id = pair()
    pkcs8 = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    data = {"keyId": key_id, "privateKeyPkcs8": base64.b64encode(pkcs8).decode(),
            "privateKeyPem": pem(key, serialization.PrivateFormat.PKCS8), "environment": "sandbox", "accountId": "1000002"}
    loaded = parse_key_file(json.dumps(data))
    assert (loaded.key_id, loaded.environment, loaded.account_id) == (key_id, "sandbox", "1000002")


@pytest.mark.parametrize("fmt", [serialization.PrivateFormat.PKCS8, serialization.PrivateFormat.TraditionalOpenSSL])
def test_pem_only_pkcs8_and_sec1(fmt):
    key, key_id = pair()
    assert parse_key_file(json.dumps({"keyId": key_id, "privateKeyPem": pem(key, fmt)})).key_id == key_id


def test_older_sandbox_file_sec1_der():
    key, key_id = pair()
    sec1 = key.private_bytes(serialization.Encoding.DER, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())
    assert parse_key_file(json.dumps({"keyId": key_id, "privateKey": base64.b64encode(sec1).decode()})).key_id == key_id


def test_mismatched_key_id_is_refused():
    key, _ = pair()
    _, other_id = pair()
    with pytest.raises(ValueError, match="does not match"):
        parse_key_file(json.dumps({"keyId": other_id, "privateKeyPem": pem(key, serialization.PrivateFormat.PKCS8)}))


def test_bad_files_and_curves_are_refused():
    with pytest.raises(ValueError, match="no private key"):
        parse_key_file('{"keyId": "x"}')
    with pytest.raises(ValueError, match="not valid JSON"):
        parse_key_file("not json")
    with pytest.raises(ValueError, match="P-256"):
        signing_key(ec.generate_private_key(ec.SECP384R1()))
