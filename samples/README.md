# Samples

Each sample is the same tour of the API in the Sandbox: the rate, your balance (funding it with test TxGold when low), a payment to a demo customer, a payment request that the demo customer pays, a refund, and your latest transactions.

Set three environment variables, then run the one for your language:

- `TXGOLD_KEY_FILE`: your Sandbox key file from the business portal
- `TXGOLD_ACCOUNT_ID`: your business account
- `TXGOLD_CUSTOMER_ID`: one of its Sandbox demo customers

| Language | Run |
|---|---|
| JavaScript | `cd javascript && npm install && node tour.mjs` |
| Python | `cd python && pip install -r requirements.txt && python tour.py` |
| C# | `cd csharp/Tour && dotnet run` |
