"""A shop counter: each sale gets a fresh open request that the customer scans and pays at the till.

    pip install -r requirements.txt
    TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 python till_qr.py 1.20

The argument is the sale's amount. The request is open (no payer), so whoever scans the QR code
pays it, once; a second scan is refused. It expires in 15 minutes, and if nobody pays while the
till waits, it is cancelled so a photo of the code can't be paid later. The tag says which till
took the sale, for your reports. In the Sandbox, TXGOLD_CUSTOMER_ID is the demo customer who pays.
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

import segno

from txgold_business import TxGoldApiError, TxGoldClient

TILL = "till-1"
QR_FILE = "till-qr.svg"
WAIT_SECONDS = 90  # how long the till waits before treating the sale as abandoned


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Set {name}.")
    return value


def wait_until_settled(client: TxGoldClient, request_id: str, seconds: float) -> dict:
    """Polls every 2 seconds (the customer is standing there) until it isn't pending or time is up."""
    deadline = time.monotonic() + seconds
    while True:
        request = client.payment_requests.get(request_id)
        if request["status"] != "pending" or time.monotonic() >= deadline:
            return request
        time.sleep(2)


def show_qr(url: str) -> None:
    qr = segno.make(url, error="m")
    qr.save(QR_FILE, scale=8, border=4)  # for a customer-facing screen
    print(f"QR code written to {QR_FILE}")
    try:
        qr.terminal(compact=True)  # or right here in the console
    except (UnicodeEncodeError, OSError):
        pass  # a console that can't draw block characters


def main() -> None:
    try:
        amount = Decimal(sys.argv[1] if len(sys.argv) > 1 else "1.20")
    except InvalidOperation:
        sys.exit("Usage: till_qr.py <amount>")
    with TxGoldClient(required("TXGOLD_KEY_FILE"), base_url=os.environ.get("TXGOLD_BASE_URL"), max_retries=2) as client:
        account_id = required("TXGOLD_ACCOUNT_ID")

        expires = (datetime.now(timezone.utc) + timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%M:%SZ")
        request = client.payment_requests.create(account_id, amount=amount, memo="Thank you for shopping with us",
                                                 tag=TILL, expires_at=expires)
        print(f"Sale: {request['amount']}, request {request['id']}, expires {request['expiresAt']}")
        show_qr(request["paymentUrl"])

        # --- Sandbox only: in production the customer scans the code and pays in the app. ---
        if os.environ.get("TXGOLD_SIMULATE", "1") != "0":
            client.sandbox.pay_request(request["id"], payer_account_id=required("TXGOLD_CUSTOMER_ID"))
        # --- end Sandbox only ---

        request = wait_until_settled(client, request["id"], WAIT_SECONDS)
        if request["status"] == "pending":
            # Abandoned: cancel it, unless it was paid in the meantime
            try:
                request = client.payment_requests.cancel(request["id"])
            except TxGoldApiError as error:
                if error.code != "request_not_pending":
                    raise
                request = client.payment_requests.get(request["id"])
        if request["status"] == "paid":
            print(f"Paid. Payment {request['paymentId']}: print the receipt.")
        else:
            print(f"No payment: the request is {request['status']}.")


if __name__ == "__main__":
    try:
        main()
    except TxGoldApiError as error:
        sys.exit(f"API error {error.status} {error.code}: {error.detail or error.title} (request {error.request_id})")
