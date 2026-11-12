"""An invoice anyone can pay: create an open request, put its paymentUrl (and a QR code of it) on
the invoice or in an email, and wait for it to be paid.

    pip install -r requirements.txt
    TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 python invoice_link.py

An open request names no payer, so nobody is notified: whoever opens the link pays it, once.
The link carries the amount and memo for display only. The app shows what you stored, and the
payment must be for exactly that amount, so editing the link changes nothing. In the Sandbox,
TXGOLD_CUSTOMER_ID is the demo customer who pays it.
"""

import os
import sys
import time

import segno

from txgold_business import TxGoldApiError, TxGoldClient

QR_FILE = "invoice-qr.svg"
WAIT_SECONDS = 60  # an invoice can wait days; poll every few minutes from a job instead


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Set {name}.")
    return value


def wait_until_settled(client: TxGoldClient, request_id: str, seconds: float) -> dict:
    """Polls the request, backing off from 2 to 10 seconds, until it isn't pending or time is up."""
    deadline = time.monotonic() + seconds
    delay = 2.0
    while True:
        request = client.payment_requests.get(request_id)
        if request["status"] != "pending" or time.monotonic() >= deadline:
            return request
        time.sleep(min(delay, max(0.0, deadline - time.monotonic())))
        delay = min(delay * 1.5, 10.0)


def main() -> None:
    with TxGoldClient(required("TXGOLD_KEY_FILE"), base_url=os.environ.get("TXGOLD_BASE_URL"), max_retries=2) as client:
        account_id = required("TXGOLD_ACCOUNT_ID")

        # No payer: an open request. It expires in 30 days unless you pass expires_at (at most 90).
        request = client.payment_requests.create(
            account_id, amount="1.50",
            memo="Invoice 4411: pool cleaning, November",  # the payer sees this
            memo_internal="inv-4411",                      # only you see this
            tag="invoices")                                # your own label
        url = request["paymentUrl"]
        print(f"Invoice request {request['id']} for {request['amount']}, open: {request['isOpen']}, expires {request['expiresAt']}")
        print(f"Pay link: {url}")

        # A QR code of the link for the printed invoice. Scanning it opens the TxGold app on the request.
        segno.make(url, error="m").save(QR_FILE, scale=6, border=4)
        print(f"QR code written to {QR_FILE}")

        # --- Sandbox only: in production the customer opens the link and pays in the app. ---
        if os.environ.get("TXGOLD_SIMULATE", "1") != "0":
            client.sandbox.pay_request(request["id"], payer_account_id=required("TXGOLD_CUSTOMER_ID"))
        # --- end Sandbox only ---

        request = wait_until_settled(client, request["id"], WAIT_SECONDS)
        if request["status"] == "paid":
            # payerAccountId is now the account that paid
            print(f"Paid by account {request['payerAccountId']}: payment {request['paymentId']}")
        else:
            # Still pending: leave it open for the customer (it expires on its own), or cancel it
            # when the invoice is settled some other way: client.payment_requests.cancel(id)
            print(f"Not paid yet: the request is {request['status']}.")


if __name__ == "__main__":
    try:
        main()
    except TxGoldApiError as error:
        sys.exit(f"API error {error.status} {error.code}: {error.detail or error.title} (request {error.request_id})")
