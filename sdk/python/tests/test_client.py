import json
from decimal import Decimal
from urllib.parse import parse_qs

import httpx
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from txgold_business import TxGoldApiError, TxGoldClient, signing_key
from txgold_business.signing import canonical_string, verify_canonical

PRIVATE = ec.generate_private_key(ec.SECP256R1())
KEY = signing_key(PRIVATE)


def fake(responses):
    """A client whose HTTP transport records each request and answers from ``responses``."""
    sent = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        nxt = responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        status, body = nxt
        return httpx.Response(status, json=body) if body is not None else httpx.Response(status)

    return sent, httpx.Client(transport=httpx.MockTransport(handler))


def client(http, max_retries=0):
    return TxGoldClient(KEY, base_url="https://api.test/", http_client=http, max_retries=max_retries)


def assert_signed(request: httpx.Request):
    # The server rebuilds the canonical string from the request it receives; so does this
    query = request.url.query.decode("ascii")
    canonical = canonical_string(request.method, request.url.path, query, request.headers["TxG-Timestamp"], request.content)
    assert request.headers["TxG-Key-Id"] == KEY.key_id
    assert verify_canonical(PRIVATE.public_key(), canonical, request.headers["TxG-Signature"])


def test_post_signs_the_bytes_it_sends_non_ascii_included():
    sent, http = fake([(201, {"id": "88"})])
    payment = client(http).payments.create("1000002", "1.25", destination_account_id="1000004", memo="Café ☕")
    assert payment["id"] == "88"
    request = sent[0]
    assert str(request.url) == "https://api.test/v1/payments"
    assert request.headers["Content-Type"] == "application/json"
    assert json.loads(request.content)["memo"] == "Café ☕"
    assert "\\u" not in request.content.decode("utf-8")  # sent as UTF-8, not escaped
    assert_signed(request)


def test_get_signs_its_query_string_as_sent():
    sent, http = fake([(200, {"data": [], "nextCursor": None})])
    client(http).accounts.transactions("1000002", from_="2026-11-01T00:00:00+05:00", limit=10, cursor="a+b/c=")
    request = sent[0]
    assert request.url.path == "/v1/accounts/1000002/transactions"
    params = parse_qs(request.url.query.decode())
    assert params["from"] == ["2026-11-01T00:00:00+05:00"] and params["cursor"] == ["a+b/c="]
    assert request.content == b""
    assert_signed(request)


def test_amounts_as_decimal_or_str_never_float():
    sent, http = fake([(201, {}), (201, {})])
    c = client(http)
    c.payments.create("1", Decimal("2.5"), destination_account_id="2")
    c.payments.create("1", "2.50", destination_account_id="2")
    assert [json.loads(r.content)["amount"] for r in sent] == ["2.50", "2.50"]
    with pytest.raises(TypeError):
        c.payments.create("1", 2.5, destination_account_id="2")  # type: ignore[arg-type]
    with pytest.raises(ValueError):
        c.payments.create("1", Decimal("2.505"), destination_account_id="2")


def test_timestamps_never_repeat():
    sent, http = fake([(200, {})] * 50)
    c = client(http)
    for _ in range(50):
        c.rates.get()
    assert len({r.headers["TxG-Timestamp"] for r in sent}) == 50


def test_explicit_timestamp_for_an_idempotent_resend():
    sent, http = fake([(200, {"id": "88"})])
    client(http).payments.create("1", "1.00", destination_account_id="2", timestamp="639283104000000000")
    assert sent[0].headers["TxG-Timestamp"] == "639283104000000000"
    assert_signed(sent[0])


def test_problem_json_becomes_txgold_api_error():
    problem = {"type": "https://docs.txgold.money/errors/insufficient_balance", "title": "Insufficient balance",
               "status": 422, "code": "insufficient_balance", "detail": "The account cannot cover 5.00.", "requestId": "abc123"}
    _, http = fake([(422, problem)])
    with pytest.raises(TxGoldApiError) as error:
        client(http).payments.create("1", "5.00", destination_account_id="2")
    assert (error.value.status, error.value.code, error.value.request_id) == (422, "insufficient_balance", "abc123")


def test_retries_resend_the_identical_signed_request(monkeypatch):
    monkeypatch.setattr(TxGoldClient, "_wait", staticmethod(lambda attempt: None))
    sent, http = fake([httpx.ConnectError("refused"), (503, {}), (201, {"id": "9"})])
    assert client(http, max_retries=2).payments.create("1", "1.00", destination_account_id="2")["id"] == "9"
    assert len(sent) == 3
    assert len({(r.headers["TxG-Timestamp"], r.headers["TxG-Signature"], r.content) for r in sent}) == 1


def test_no_retries_by_default():
    sent, http = fake([(503, {"code": "rate_unavailable", "status": 503})])
    with pytest.raises(TxGoldApiError):
        client(http).rates.get()
    assert len(sent) == 1


def test_list_all_follows_next_cursor():
    sent, http = fake([(200, {"data": [{"id": "1"}, {"id": "2"}], "nextCursor": "next"}),
                       (200, {"data": [{"id": "3"}], "nextCursor": None})])
    ids = [r["id"] for r in client(http).payment_requests.list_all("1000002", status="pending")]
    assert ids == ["1", "2", "3"]
    assert parse_qs(sent[1].url.query.decode()) == {"accountId": ["1000002"], "status": ["pending"], "cursor": ["next"]}


def test_unknown_environment_needs_base_url():
    with pytest.raises(ValueError, match="pass base_url"):
        TxGoldClient(KEY, environment="staging")


@pytest.mark.parametrize("environment, url", [
    ("sandbox", "https://api-sandbox.txgold.money"),
    ("production", "https://api.txgold.money"),
])
def test_each_environment_has_its_url(environment, url):
    with TxGoldClient(KEY, environment=environment) as client:
        assert client.base_url == url


def test_payment_request_to_a_payer_by_id_positional_as_before():
    sent, http = fake([(201, {"id": "7", "isOpen": False})])
    client(http).payment_requests.create("1000002", "1000004", "0.50", memo="Order 42")
    assert json.loads(sent[0].content) == {"accountId": "1000002", "payerAccountId": "1000004", "amount": "0.50", "memo": "Order 42"}
    assert_signed(sent[0])


def test_payment_request_to_a_payer_by_handle():
    sent, http = fake([(201, {"id": "7", "payerAccountId": None, "isOpen": False})])
    client(http).payment_requests.create("1000002", amount="1.25", payer_handle="@Jason-Miles", tag="web")
    assert json.loads(sent[0].content) == {"accountId": "1000002", "payerHandle": "@Jason-Miles", "amount": "1.25", "tag": "web"}
    assert_signed(sent[0])


def test_open_payment_request_names_no_payer():
    url = "https://app.txgold.money/RequestPayment?AccountId=1000002&AccountName=acme&Amt=2.00&Request=9"
    sent, http = fake([(201, {"id": "9", "isOpen": True, "payerAccountId": None, "tag": "till-1", "paymentUrl": url})])
    request = client(http).payment_requests.create("1000002", amount=Decimal("2"), memo="Coffee", tag="till-1",
                                                   expires_at="2026-11-11T12:15:00Z")
    body = json.loads(sent[0].content)
    assert body == {"accountId": "1000002", "amount": "2.00", "memo": "Coffee", "tag": "till-1", "expiresAt": "2026-11-11T12:15:00Z"}
    assert request["isOpen"] and request["paymentUrl"] == url
    with pytest.raises(TypeError):
        client(http).payment_requests.create("1000002")


def test_sandbox_pay_request_body_only_when_a_payer_is_given():
    sent, http = fake([(201, {"id": "1"}), (201, {"id": "2"})])
    c = client(http)
    c.sandbox.pay_request("9")
    c.sandbox.pay_request("9", "1000004")
    assert sent[0].url.path == "/v1/sandbox/payment-requests/9/pay"
    assert sent[0].content == b"" and "Content-Type" not in sent[0].headers
    assert json.loads(sent[1].content) == {"payerAccountId": "1000004"}
    for request in sent:
        assert_signed(request)


@pytest.mark.parametrize("code", ["request_not_pending", "payment_request_already_paid", "some_future_code"])
def test_conflict_codes_pass_through(code):
    _, http = fake([(409, {"title": "Conflict", "status": 409, "code": code})])
    with pytest.raises(TxGoldApiError) as error:
        client(http).payments.create("1000004", "1.00", payment_request_id="9")
    assert (error.value.status, error.value.code) == (409, code)
