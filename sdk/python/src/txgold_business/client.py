"""The TxGold Business API client."""

from __future__ import annotations

import json
import time
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Dict, Iterator, Mapping, Optional, TypeVar, Union, cast
from urllib.parse import quote, urlencode

import httpx

from .errors import TxGoldApiError
from .keys import SigningKey, load_key_file
from .models import Account, AccountLookup, AccountTransaction, Page, Payment, PaymentRequest, Rate
from .signing import TimestampClock, canonical_string, sign_canonical

__version__ = "0.2.0"

#: The API's base URL per environment. Production is added when it opens.
BASE_URLS: Dict[str, str] = {
    "sandbox": "https://func-txgbusiness-dev-ffdea6gbbjhzczex.southcentralus-01.azurewebsites.net",
}

Amount = Union[str, Decimal]
T = TypeVar("T")
_RETRY_STATUSES = {502, 503, 504}


def _amount(value: Optional[Amount]) -> Optional[str]:
    """A decimal string with at most 2 places. Floats are refused: they can't hold 0.10 exactly."""
    if value is None:
        return None
    if isinstance(value, float):
        raise TypeError("Pass amounts as str or Decimal, not float.")
    if isinstance(value, Decimal):
        if value != value.quantize(Decimal("0.01")):
            raise ValueError(f"Amounts have at most 2 decimal places: {value}")
        return f"{value:.2f}"
    return str(value)


def _body(**fields: Any) -> Dict[str, Any]:
    return {name: value for name, value in fields.items() if value is not None}


def _segment(value: str) -> str:
    return quote(str(value), safe="")


class TxGoldClient:
    """The TxGold Business API. Every request is signed with the key it was made with.

    ``key`` is a key file path or a :class:`SigningKey`. ``environment`` defaults to the key file's,
    else "sandbox"; ``base_url`` overrides it. ``max_retries`` (default 0) retries a network error or a
    502/503/504 by resending the identical signed request (same timestamp), so a payment is never
    made twice. Use as a context manager, or call :meth:`close`.
    """

    def __init__(
        self,
        key: Union[str, Path, SigningKey],
        *,
        environment: Optional[str] = None,
        base_url: Optional[str] = None,
        max_retries: int = 0,
        timeout: float = 30.0,
        http_client: Optional[httpx.Client] = None,
    ) -> None:
        self._key = key if isinstance(key, SigningKey) else load_key_file(key)
        env = environment or self._key.environment or "sandbox"
        base = base_url or BASE_URLS.get(env)
        if not base:
            raise ValueError(f'No base URL is known for the "{env}" environment yet; pass base_url.')
        self.base_url = base.rstrip("/")
        self.key_id = self._key.key_id
        self._clock = TimestampClock()
        self._max_retries = max_retries
        self._http = http_client or httpx.Client(timeout=timeout)

        self.payments = Payments(self)
        self.payment_requests = PaymentRequests(self)
        self.accounts = Accounts(self)
        self.rates = Rates(self)
        self.sandbox = Sandbox(self)

    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "TxGoldClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def request(
        self,
        method: str,
        path: str,
        query: Optional[Mapping[str, Any]] = None,
        body: Optional[Mapping[str, Any]] = None,
        *,
        timestamp: Optional[str] = None,
    ) -> Any:
        """Sends one signed request and returns the parsed JSON. Raises :class:`TxGoldApiError`.

        ``timestamp`` signs with a given TxG-Timestamp: resending a request with the same timestamp
        (and body) is idempotent, returning the original result instead of acting twice.
        """
        query_string = urlencode([(k, str(v)) for k, v in (query or {}).items() if v is not None and v != ""])
        # The signature covers these exact bytes, and they are what is sent
        content = b"" if body is None else json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        ts = timestamp or self._clock.next()
        signature = sign_canonical(self._key.private_key, canonical_string(method, path, query_string, ts, content))
        headers = {
            "TxG-Key-Id": self._key.key_id,
            "TxG-Timestamp": ts,
            "TxG-Signature": signature,
            "Accept": "application/json",
            "User-Agent": f"txgold-business-python/{__version__}",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        url = f"{self.base_url}{path}" + (f"?{query_string}" if query_string else "")

        attempt = 0
        while True:
            try:
                response = self._http.request(method, url, headers=headers, content=content or None)
            except httpx.TransportError:
                if attempt < self._max_retries:
                    self._wait(attempt)
                    attempt += 1
                    continue
                raise
            if response.status_code in _RETRY_STATUSES and attempt < self._max_retries:
                self._wait(attempt)
                attempt += 1
                continue
            parsed = response.json() if response.content else None
            if response.is_error:
                raise TxGoldApiError(response.status_code, parsed if isinstance(parsed, dict) else {})
            return parsed

    @staticmethod
    def _wait(attempt: int) -> None:
        time.sleep(min(0.5 * 2**attempt, 8.0))

    def _page(self, method: str, path: str, query: Mapping[str, Any]) -> Page[Any]:
        result = self.request(method, path, query)
        return Page(result.get("data", []), result.get("nextCursor"))

    @staticmethod
    def paginate(list_page: Callable[[Optional[str]], Page[T]]) -> Iterator[T]:
        """Walks every page of a list call."""
        cursor: Optional[str] = None
        while True:
            page = list_page(cursor)
            yield from page.data
            cursor = page.next_cursor
            if not cursor:
                return


class Payments:
    def __init__(self, client: TxGoldClient) -> None:
        self._client = client

    def create(
        self,
        account_id: str,
        amount: Amount,
        *,
        destination_account_id: Optional[str] = None,
        payment_request_id: Optional[str] = None,
        memo: Optional[str] = None,
        memo_internal: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> Payment:
        """Sends a payment from ``account_id``: to ``destination_account_id``, or paying ``payment_request_id``."""
        body = _body(accountId=account_id, destinationAccountId=destination_account_id, amount=_amount(amount),
                     memo=memo, memoInternal=memo_internal, paymentRequestId=payment_request_id)
        return cast(Payment, self._client.request("POST", "/v1/payments", body=body, timestamp=timestamp))

    def get(self, payment_id: str, account_id: str) -> Payment:
        """One payment, seen from ``account_id`` (the payer or the payee)."""
        return cast(Payment, self._client.request("GET", f"/v1/payments/{_segment(payment_id)}", {"accountId": account_id}))

    def refund(
        self,
        payment_id: str,
        *,
        amount: Optional[Amount] = None,
        memo: Optional[str] = None,
        memo_internal: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> Payment:
        """Refunds a payment your account received; leave out ``amount`` to refund all of it."""
        body = _body(amount=_amount(amount), memo=memo, memoInternal=memo_internal)
        return cast(Payment, self._client.request("POST", f"/v1/payments/{_segment(payment_id)}/refunds", body=body, timestamp=timestamp))


class PaymentRequests:
    def __init__(self, client: TxGoldClient) -> None:
        self._client = client

    def create(
        self,
        account_id: str,
        payer_account_id: Optional[str] = None,
        amount: Optional[Amount] = None,
        *,
        payer_handle: Optional[str] = None,
        memo: Optional[str] = None,
        memo_internal: Optional[str] = None,
        tag: Optional[str] = None,
        expires_at: Optional[str] = None,
        timestamp: Optional[str] = None,
    ) -> PaymentRequest:
        """Asks for a payment to ``account_id`` (yours).

        Name the payer by ``payer_account_id`` or by ``payer_handle`` (a TxGold handle, the @ optional;
        the payer's id is then never returned), or by neither for an open request: anyone with its
        ``paymentUrl`` can pay it once. ``amount`` is required. ``tag`` is your own label, never shown
        to the payer. ``expires_at``: at most 7 days ahead for a named payer, 90 days for an open
        request (default 30).
        """
        if amount is None:
            raise TypeError("amount is required.")
        body = _body(accountId=account_id, payerAccountId=payer_account_id, payerHandle=payer_handle,
                     amount=_amount(amount), memo=memo, memoInternal=memo_internal, tag=tag, expiresAt=expires_at)
        return cast(PaymentRequest, self._client.request("POST", "/v1/payment-requests", body=body, timestamp=timestamp))

    def get(self, request_id: str) -> PaymentRequest:
        return cast(PaymentRequest, self._client.request("GET", f"/v1/payment-requests/{_segment(request_id)}"))

    def list(self, account_id: str, *, status: Optional[str] = None, limit: Optional[int] = None,
             cursor: Optional[str] = None) -> Page[PaymentRequest]:
        """A page of requests. ``status``: pending, paid, dismissed, cancelled or expired."""
        return self._client._page("GET", "/v1/payment-requests",
                                  {"accountId": account_id, "status": status, "limit": limit, "cursor": cursor})

    def list_all(self, account_id: str, *, status: Optional[str] = None, limit: Optional[int] = None) -> Iterator[PaymentRequest]:
        """Every request, across pages."""
        return TxGoldClient.paginate(lambda cursor: self.list(account_id, status=status, limit=limit, cursor=cursor))

    def cancel(self, request_id: str) -> PaymentRequest:
        return cast(PaymentRequest, self._client.request("POST", f"/v1/payment-requests/{_segment(request_id)}/cancel"))


class Accounts:
    def __init__(self, client: TxGoldClient) -> None:
        self._client = client

    def get(self, account_id: str) -> Account:
        return cast(Account, self._client.request("GET", f"/v1/accounts/{_segment(account_id)}"))

    def transactions(self, account_id: str, *, from_: Optional[str] = None, to: Optional[str] = None,
                     limit: Optional[int] = None, cursor: Optional[str] = None) -> Page[AccountTransaction]:
        """A page of transactions, newest first. ``from_`` inclusive and ``to`` exclusive: ISO 8601, or a date."""
        return self._client._page("GET", f"/v1/accounts/{_segment(account_id)}/transactions",
                                  {"from": from_, "to": to, "limit": limit, "cursor": cursor})

    def transactions_all(self, account_id: str, *, from_: Optional[str] = None, to: Optional[str] = None,
                         limit: Optional[int] = None) -> Iterator[AccountTransaction]:
        """Every transaction in the range, across pages."""
        return TxGoldClient.paginate(
            lambda cursor: self.transactions(account_id, from_=from_, to=to, limit=limit, cursor=cursor))

    def lookup(self, account_name: str) -> AccountLookup:
        """A business or charity by its handle, with or without the @."""
        return cast(AccountLookup, self._client.request("GET", "/v1/accounts/lookup", {"accountName": account_name}))


class Rates:
    def __init__(self, client: TxGoldClient) -> None:
        self._client = client

    def get(self) -> Rate:
        """The current TxGold rate."""
        return cast(Rate, self._client.request("GET", "/v1/rates"))


class Sandbox:
    """Sandbox-only helpers. They return 404 in production."""

    def __init__(self, client: TxGoldClient) -> None:
        self._client = client

    def fund(self, account_id: str, amount: Amount) -> Payment:
        """Adds test TxGold to one of your accounts, or one of its demo customers."""
        return cast(Payment, self._client.request("POST", f"/v1/sandbox/accounts/{_segment(account_id)}/fund",
                                                  body={"amount": _amount(amount)}))

    def pay_request(self, request_id: str, payer_account_id: Optional[str] = None) -> Payment:
        """Has a demo customer pay a pending request, as they would in the app.

        A request to a named payer is paid by that payer. An open request is paid by
        ``payer_account_id`` (one of your demo customers), else by your first demo customer.
        """
        body = None if payer_account_id is None else {"payerAccountId": payer_account_id}
        return cast(Payment, self._client.request("POST", f"/v1/sandbox/payment-requests/{_segment(request_id)}/pay",
                                                  body=body))
