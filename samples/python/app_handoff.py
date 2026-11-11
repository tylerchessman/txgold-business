"""Hand off to the TxGold app: your own app (or mobile web page) creates an open request on your
server and opens its paymentUrl on the customer's phone. The TxGold app opens on the request, the
customer pays, and your server sees it paid.

    pip install -r requirements.txt
    TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 python app_handoff.py

Keep the key on your server: the phone only ever gets the paymentUrl. Opening the link is all the
hand-off there is; with the TxGold app installed it opens the app on the request:

    Web page:      window.location.href = paymentUrl          (or <a href="...">Pay with TxGold</a>)
    iOS (Swift):   UIApplication.shared.open(URL(string: paymentUrl)!)
    Android:       startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(paymentUrl)))
    React Native:  Linking.openURL(paymentUrl)

When the customer comes back to your app, ask your server for the request's status (polled
here). In the Sandbox, TXGOLD_CUSTOMER_ID is the demo customer who pays.
"""

import os
import sys
import time

from txgold_business import TxGoldApiError, TxGoldClient

WAIT_SECONDS = 60


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

        # Your server, when the customer taps "Pay with TxGold": an open request. Pass expires_at for
        # a shorter life than the default 30 days, and cancel it if the customer abandons the order.
        request = client.payment_requests.create(account_id, amount="0.75", memo="Large latte, order 77",
                                                 memo_internal="app-order-77", tag="mobile-app")
        # Return this to the app, which opens it (see above)
        print(f"Request {request['id']}: open this on the customer's phone:")
        print(request["paymentUrl"])

        # --- Sandbox only: in production the customer pays in the TxGold app. ---
        if os.environ.get("TXGOLD_SIMULATE", "1") != "0":
            client.sandbox.pay_request(request["id"], payer_account_id=required("TXGOLD_CUSTOMER_ID"))
        # --- end Sandbox only ---

        request = wait_until_settled(client, request["id"], WAIT_SECONDS)
        if request["status"] == "pending":
            # The customer never came back: cancel, unless it was paid in the meantime
            try:
                request = client.payment_requests.cancel(request["id"])
            except TxGoldApiError as error:
                if error.code != "request_not_pending":
                    raise
                request = client.payment_requests.get(request["id"])
        if request["status"] == "paid":
            print(f"Paid: payment {request['paymentId']}. Tell the app the order is confirmed.")
        else:
            print(f"Not paid: the request is {request['status']}.")


if __name__ == "__main__":
    try:
        main()
    except TxGoldApiError as error:
        sys.exit(f"API error {error.status} {error.code}: {error.detail or error.title} (request {error.request_id})")
