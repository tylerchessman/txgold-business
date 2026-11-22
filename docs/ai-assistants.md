# Build with an AI assistant

TxGold publishes [Agent Skills](https://agentskills.io): instructions that teach an AI coding
assistant how to write correct code against this API. With them installed, you can ask
Claude Code, GitHub Copilot or Claude for "a pump controller that holds 100 TxGold and charges what
was pumped". The assistant then signs requests properly, uses the right fields and statuses, retries
safely, and waits for the customer's approval.

This page gets you from nothing to a working Sandbox integration written by your assistant.

## The skills

| Skill | The assistant uses it for |
|---|---|
| `txgold-business-api` | Clients and key files, request signing, Sandbox and Production, errors, retries, accounts and rates. The others build on it |
| `txgold-payments` | Payments, refunds, payment requests, open requests with a link or QR code, checkout |
| `txgold-holds` | Holds: approve first, then charge what was used. Pay at the pump, rentals, deposits |

You don't pick a skill. The assistant loads the right one when your request mentions TxGold, a
payment, a refund, a hold or a checkout.

## 1. Get a Sandbox key

Do [steps 1 and 2 of the Quickstart](/quickstart#_1-get-a-sandbox-business): a Sandbox business,
then an integration and a key. Save the key file somewhere outside your source tree, for example
`~/keys/txgold-sandbox-mystore.key.json`, and note your account id.

::: warning Keep the key file out of the conversation
The key file holds a private key. Give your assistant its **path**, never its contents: don't
paste it into a prompt, and don't ask the assistant to open it. The skills tell the assistant to
load the key from a path or an environment variable at run time, such as `TXGOLD_KEY_FILE`.
:::

## 2. Install the skills

::: code-group

```bash [Claude Code]
claude plugin marketplace add tylerchessman/txgold-business
claude plugin install txgold-business@txgold
```

```bash [GitHub Copilot]
# In your repository: Copilot's agent mode, CLI and cloud agent read .github/skills/
git clone --depth 1 https://github.com/tylerchessman/txgold-business /tmp/txgold-business
mkdir -p .github/skills && cp -r /tmp/txgold-business/skills/txgold-* .github/skills/
```

```text [Claude (claude.ai, desktop)]
1. Download the three folders under skills/ from github.com/tylerchessman/txgold-business.
2. Zip each folder, with its SKILL.md at the top of the zip.
3. Upload each zip under Settings → Capabilities → Skills.
   Always include txgold-business-api: the other two build on it.
```

:::

In Claude Code you can also run `/plugin marketplace add tylerchessman/txgold-business`, then
`/plugin install txgold-business@txgold`, inside a session. To keep the skills to one project, copy
the three `skills/txgold-*` folders into that project's `.claude/skills/` instead.

**Another assistant?** One that reads Agent Skills (`SKILL.md` files) can use the folders as they
are. For one that doesn't, add the relevant `SKILL.md` files to its rules or context.

## 3. Ask for your first integration

Start a new session in your project and tell the assistant your language, your account id and
where the key is:

> Write a Node.js script that checks the balance of my TxGold Sandbox account 1000002 and sends
> 1.00 to my demo customer 1000004. My key file's path is in the TXGOLD_KEY_FILE environment
> variable; don't open it.

You should get a script that:

- installs and uses the SDK (`@txgold/business`) rather than raw HTTP;
- reads the key from `TXGOLD_KEY_FILE`;
- sends the amount as the string `"1.00"`, never a floating-point number;
- catches `TxGoldApiError` and branches on its `code`.

Run it. The payment shows in the Sandbox at once.

## 4. Build something real

The same pattern works for whole features. Some requests to try:

> Add "Pay with TxGold" to the checkout of my Flask app: the customer types their TxGold handle,
> approves on their phone, and the order is marked paid. Sandbox for now.

> Write a C# service for a fuel pump: hold 100 TxGold from the customer, wait for their
> approval, then charge what was pumped and release the rest.

> Show a fresh QR code on our till for each sale, and cancel it if nobody pays within 90 seconds.

> Refund half of payment 9120 with the memo "Damaged item".

In the Sandbox nobody holds a phone. The skills know that a demo customer can pay a request
(`sandbox.payRequest`) or approve a hold (`sandbox.approveHold`), so the assistant can test the
whole flow end to end. Ask it to: "and test it against the Sandbox with my demo customer".

## 5. Check what it wrote

The skills make good code likely, not certain. Before anything handles real money, check:

| Check | Why |
|---|---|
| The key comes from a path, an environment variable or a secrets manager | A key in source code or a browser is a key anyone can use |
| Amounts are strings or decimals, with two places | Floats round: `0.1 + 0.2` isn't `0.3` |
| A retry of a payment reuses its timestamp | The timestamp is the [idempotency](/guides/idempotency) key. Reusing it means a retry can't pay twice |
| Waiting for a customer stops at `approveBy` | Holds and requests that nobody answers [expire](/guides/holds#wait-for-the-customer). Don't poll forever |
| Holds are charged once, and only when `held` | A second capture is refused (`hold_not_held`) |
| Errors are matched on `code`, not on the message | [Codes](/errors/) never change; titles and details may |

Then run it in the Sandbox, and switch to a Production key only when it works there. The
environment comes from the key file, so the code itself doesn't change.

## Keeping them current

The skills describe the API. The source of truth is this site and the
[OpenAPI document](https://api-sandbox.txgold.money/openapi/v1.json). If they ever disagree, the
API is right; please [open an issue](https://github.com/tylerchessman/txgold-business/issues).

To pick up new versions: in Claude Code, `claude plugin marketplace update txgold`. For copied
folders, copy them again. The [changelog](/changelog) announces new skills.
