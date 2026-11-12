"""The API's resources, as returned: plain dicts with these keys.

Every amount is a decimal string such as "12.50" (use ``Decimal(payment["amount"])`` for
arithmetic, never ``float``), every id is a string, and every time an ISO 8601 UTC string.
"""

from __future__ import annotations

from typing import Generic, List, Optional, TypedDict, TypeVar

T = TypeVar("T")


class Account(TypedDict):
    id: str
    accountName: Optional[str]
    displayName: Optional[str]
    type: str
    tier: Optional[int]
    active: bool
    #: None unless the key's role may see the balance (Admin, Manager, Integration).
    balance: Optional[str]


class AccountLookup(TypedDict):
    id: str
    accountName: str
    displayName: Optional[str]
    type: str


class Counterparty(TypedDict):
    accountId: str
    accountName: Optional[str]
    displayName: Optional[str]
    type: Optional[str]


class AccountTransaction(TypedDict):
    id: str
    direction: str
    amount: str
    fee: Optional[str]
    counterparty: Optional[Counterparty]
    memo: Optional[str]
    memoInternal: Optional[str]
    createdAt: str
    paymentRequestId: Optional[str]
    refundOf: Optional[str]
    refundId: Optional[str]
    balanceAfter: Optional[str]
    estimatedUsdValue: Optional[str]
    actualUsdValue: Optional[str]


class Payment(TypedDict):
    id: str
    accountId: str
    destinationAccountId: str
    direction: str
    amount: str
    fee: Optional[str]
    memo: Optional[str]
    memoInternal: Optional[str]
    createdAt: str
    paymentRequestId: Optional[str]
    refundOf: Optional[str]
    refundId: Optional[str]
    refundedAmount: Optional[str]
    balanceAfter: Optional[str]


class PaymentRequest(TypedDict):
    id: str
    status: str
    accountId: str
    #: None for an open request until it is paid (then the account that paid it), and always None
    #: when the request named its payer by handle.
    payerAccountId: Optional[str]
    #: True for an open request: no payer named, payable once by anyone with its paymentUrl.
    isOpen: bool
    amount: str
    memo: Optional[str]
    memoInternal: Optional[str]
    #: Your own label (a till, a device, a campaign), never shown to the payer.
    tag: Optional[str]
    createdAt: str
    expiresAt: str
    statusChangedAt: Optional[str]
    paymentId: Optional[str]
    #: An open request's link: opens the TxGold app on the request. Share it or draw it as a QR code.
    #: None for a request to a named payer.
    paymentUrl: Optional[str]


class Rate(TypedDict):
    usdPerTxGold: str
    usdPerTroyOunce: str
    asOf: str


class Page(Generic[T]):
    """A page of a list: ``data`` and the ``next_cursor`` to pass for the next page (None on the last)."""

    def __init__(self, data: List[T], next_cursor: Optional[str]) -> None:
        self.data = data
        self.next_cursor = next_cursor

    def __iter__(self):  # type: ignore[no-untyped-def]
        return iter(self.data)

    def __len__(self) -> int:
        return len(self.data)

    def __repr__(self) -> str:
        return f"Page({len(self.data)} items, next_cursor={self.next_cursor!r})"
