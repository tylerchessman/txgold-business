"""A tour of the TxGold Business API in the Sandbox: rates, your account, a payment, a payment
request that a demo customer pays, a refund, and your transactions.

    pip install txgold-business
    TXGOLD_KEY_FILE=txgold-sandbox-mystore.key.json TXGOLD_ACCOUNT_ID=1000002 TXGOLD_CUSTOMER_ID=1000004 python tour.py

TXGOLD_ACCOUNT_ID is your business account (the key file's accountId when it has one) and
TXGOLD_CUSTOMER_ID one of its Sandbox demo customers.
"""

import os
import sys
from decimal import Decimal

from txgold_business import TxGoldApiError, TxGoldClient


def required(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Set {name}.")
    return value


def main() -> None:
    with TxGoldClient(required("TXGOLD_KEY_FILE"), base_url=os.environ.get("TXGOLD_BASE_URL"), max_retries=2) as client:
        account_id = required("TXGOLD_ACCOUNT_ID")
        customer_id = required("TXGOLD_CUSTOMER_ID")

        rate = client.rates.get()
        print(f"1 TxGold = ${rate['usdPerTxGold']} (as of {rate['asOf']})")

        account = client.accounts.get(account_id)
        print(f"Account {account['id']} @{account['accountName']}: balance {account['balance']}")
        if account["balance"] is not None and Decimal(account["balance"]) < 5:
            client.sandbox.fund(account_id, "10.00")
            print(f"Funded with test TxGold: balance {client.accounts.get(account_id)['balance']}")

        # Send a payment. Amounts are decimal strings or Decimal, never float.
        payment = client.payments.create(account_id, "1.00", destination_account_id=customer_id, memo="SDK tour: a payment")
        print(f"Paid {payment['amount']} to {payment['destinationAccountId']}: payment {payment['id']}")

        # Ask the customer for a payment, and have the Sandbox customer pay it
        request = client.payment_requests.create(account_id, customer_id, Decimal("0.50"), memo="SDK tour: a request")
        print(f"Requested {request['amount']} from {request['payerAccountId']}: request {request['id']} is {request['status']}")
        received = client.sandbox.pay_request(request["id"])
        paid = client.payment_requests.get(request["id"])
        print(f"The customer paid it: request {paid['id']} is {paid['status']}, payment {received['id']}")

        # Refund what the customer paid
        refund = client.payments.refund(received["id"], memo="SDK tour: a refund")
        print(f"Refunded {refund['amount']}: refund {refund['id']}")

        print("Latest transactions:")
        for t in client.accounts.transactions(account_id, limit=5):
            print(f"  {t['createdAt']}  {t['direction']:<6} {t['amount']:>8}  {t['memo'] or ''}")


if __name__ == "__main__":
    try:
        main()
    except TxGoldApiError as error:
        sys.exit(f"API error {error.status} {error.code}: {error.detail or error.title} (request {error.request_id})")
