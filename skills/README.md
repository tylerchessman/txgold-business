# Skills for AI coding assistants

These [Agent Skills](https://agentskills.io) teach an AI coding assistant (Claude Code, Claude,
GitHub Copilot, and other tools that read `SKILL.md` files) how to write correct code against the
TxGold Business API: how to sign requests, which fields and statuses exist, what each error means,
and the patterns that keep money safe (idempotent retries, and waiting for a customer's approval).

| Skill | Use it for |
|---|---|
| [`txgold-business-api`](txgold-business-api/SKILL.md) | Clients and key files, request signing, Sandbox vs Production, conventions, errors, retries, accounts and rates. The base for the others |
| [`txgold-payments`](txgold-payments/SKILL.md) | Sending payments, refunds, payment requests, open requests with a link or QR code |
| [`txgold-holds`](txgold-holds/SKILL.md) | Hold, then charge what was used: pay at the pump, rentals, deposits |

The assistant loads a skill when your request needs it: "add TxGold checkout to my Flask app",
"write a pump controller that holds 100 TxGold and charges what was pumped".

## Install

### Claude Code

```bash
claude plugin marketplace add tylerchessman/txgold-business
claude plugin install txgold-business@txgold
```

Or inside a session: `/plugin marketplace add tylerchessman/txgold-business`, then
`/plugin install txgold-business@txgold`. To use them in one project only, copy the four folders
into that project's `.claude/skills/`.

### GitHub Copilot

Copy the four `txgold-*` folders into your repository's `.github/skills/` (or `~/.copilot/skills/`
for all your projects). Copilot's agent mode, CLI and cloud agent pick them up from there.

```bash
git clone --depth 1 https://github.com/tylerchessman/txgold-business /tmp/txgold-business
mkdir -p .github/skills && cp -r /tmp/txgold-business/skills/txgold-* .github/skills/
```

### Claude (claude.ai and the desktop app)

Zip a skill's folder (for example `txgold-holds/`, with its `SKILL.md` at the top) and upload it
under **Settings → Capabilities → Skills**. Upload `txgold-business-api` too: the others build on it.

### Other tools

Any assistant that reads Agent Skills can use the folders as they are. For one that doesn't, add the
relevant `SKILL.md` to its context or rules file.

## What's in them

Each `SKILL.md` is short guidance plus copy-ready code in JavaScript, Python and C#.
`txgold-business-api/references/` has the full error-code table and request signing without an SDK.
The request-signing code is checked against the test vectors in [`vectors/`](../vectors).

The skills describe the API; the source of truth is the
[OpenAPI document](../openapi/v1.json) and https://docs.txgold.money. If they disagree, the API
wins: please open an issue.

Your key file never belongs in a prompt, a skill, or source control. The skills
tell the assistant to load it from a path or environment variable at run time.
