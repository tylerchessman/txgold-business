"""A pay-me link for your account, with no API call: a link (and QR code) for a tip jar, a donation
box or a sign at the door. Anyone who opens it gets the TxGold app's send screen, addressed to you.

    pip install segno
    TXGOLD_ACCOUNT_ID=1000002 TXGOLD_ACCOUNT_NAME=AcmeSandbox python account_link.py [amount] [memo]

TXGOLD_ACCOUNT_ID is your account id and TXGOLD_ACCOUNT_NAME its handle (without the @).

- The amount and memo are only suggestions: the payer can change both before paying. For a
  fixed amount that is paid once, use an open request instead (invoice_link.py, till_qr.py).
- The app finds you by AccountId, so the link keeps working if you later rename your handle.
- Nothing is created on the server, so there is nothing to poll: watch your account's
  transactions (client.accounts.transactions) for what comes in.
"""

import os
import sys
from urllib.parse import quote, urlencode

import segno

APP_URL = "https://app.txgold.money/RequestPayment"
QR_FILE = "account-qr.svg"


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Set {name}.")
    return value


def account_link(account_id: str, account_name: str, amount: str = "", memo: str = "") -> str:
    """The link, with every value percent-encoded (a space as %20, as the app expects)."""
    params = {"AccountId": account_id, "AccountName": account_name.lstrip("@")}
    if amount:
        params["Amt"] = amount
    if memo:
        params["Memo"] = memo
    return f"{APP_URL}?{urlencode(params, quote_via=quote)}"


def main() -> None:
    amount = sys.argv[1] if len(sys.argv) > 1 else ""
    memo = sys.argv[2] if len(sys.argv) > 2 else ""
    url = account_link(required("TXGOLD_ACCOUNT_ID"), required("TXGOLD_ACCOUNT_NAME"), amount, memo)
    print(url)
    segno.make(url, error="m").save(QR_FILE, scale=8, border=4)
    print(f"QR code written to {QR_FILE}")


if __name__ == "__main__":
    main()
