"""Website checkout: the customer types their TxGold handle, you send them a payment request,
they approve it in the TxGold app, and you wait for it to be paid.

    pip install -r requirements.txt
    TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 \
        TXGOLD_PAYER_HANDLE=AcmeSandbox-Customer1 python checkout_handle.py

TXGOLD_ACCOUNT_ID is your business account and TXGOLD_PAYER_HANDLE the handle your customer typed
(in the Sandbox, one of your demo customers' handles). The request goes to that account: they get
a push notification and pay with a tap. A handle is never turned into an account id for you, so
the request's payerAccountId stays None. An unknown handle is a 422 payer_account_invalid: ask the
customer to check it.
"""

import os
import sys
import time

from txgold_business import TxGoldApiError, TxGoldClient

WAIT_SECONDS = 120  # how long the checkout waits for the customer before giving up


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Set {name}.")
    return value


def wait_until_settled(client: TxGoldClient, request_id: str, seconds: float) -> dict:
    """Polls the request, every 2 seconds at first and backing off to 10, until it is no longer
    pending or ``seconds`` pass. Returns the request as last seen."""
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
        handle = required("TXGOLD_PAYER_HANDLE")

        try:
            request = client.payment_requests.create(
                account_id, payer_handle=handle, amount="1.25",
                memo="Order 1042: 1 x gold-plated widget",  # the customer sees this
                memo_internal="order-1042",                 # only you see this
                tag="web-checkout")                         # your own label for reporting
        except TxGoldApiError as error:
            if error.code == "payer_account_invalid":
                sys.exit(f"No TxGold account has the handle {handle!r}. Ask the customer to check it.")
            raise
        print(f"Sent request {request['id']} for {request['amount']} to @{handle.lstrip('@')}: {request['status']}")
        print("Waiting for the customer to approve it in the TxGold app...")

        # --- Sandbox only: in production the customer approves in the app. Delete this block. ---
        # Demo customers have no phone, so the Sandbox pays the request on their behalf.
        if os.environ.get("TXGOLD_SIMULATE", "1") != "0":
            client.sandbox.pay_request(request["id"])
        # --- end Sandbox only ---

        request = wait_until_settled(client, request["id"], WAIT_SECONDS)
        if request["status"] == "pending":
            # Nobody paid in time: cancel, so it can't be paid after you've given up on the order
            try:
                request = client.payment_requests.cancel(request["id"])
            except TxGoldApiError as error:
                if error.code != "request_not_pending":
                    raise
                request = client.payment_requests.get(request["id"])  # paid at the last moment
        if request["status"] == "paid":
            print(f"Paid: payment {request['paymentId']}. Fulfil order 1042.")
        else:
            print(f"Not paid: the request is {request['status']}. Offer another way to pay.")


if __name__ == "__main__":
    try:
        main()
    except TxGoldApiError as error:
        sys.exit(f"API error {error.status} {error.code}: {error.detail or error.title} (request {error.request_id})")
