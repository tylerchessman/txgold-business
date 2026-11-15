// What each /api route does, free of the Functions runtime so the tests can call it directly.
// Each handler takes { session, ip, params, body } and returns { status, body }.
//
// The browser never picks an account, a path or a payer the key can reach: it picks one of a fixed
// set of request shapes (METHODS), an amount up to the cap, a memo, and one of the demo customers.
import { randomInt } from 'node:crypto';
import { TxGoldApiError, ticksNow } from '@txgold/business';
import { newSession, verifySession, tagFor } from './session.js';
import { recording } from './wire.js';

/** The request shapes, one per way to get paid that makes a payment request. */
export const METHODS = {
  'app-request': { payer: 'customer', minutes: 15 }, // 3: a request to a named customer
  'web-checkout': { payer: 'handle', minutes: 15 }, // 4: by the handle typed at checkout
  'in-app': { payer: null, minutes: 10 }, // 5: an open request handed to the TxGold app
  till: { payer: null, minutes: 15 }, // 6: an open request per sale
  invoice: { payer: null, minutes: 15 }, // 6: an open request on an invoice
};

const AMOUNT = /^\d{1,2}(\.\d{1,2})?$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{1,40}$/;

export function createHandlers({ client, config, limiter, now = () => Date.now() }) {
  const clock = timestampClock(now);
  const stamp = () => ({ timestamp: clock() });
  let business;

  /** Runs API calls, recording them; maps failures to a response. */
  async function call(fn) {
    const { result, error, exchanges } = await recording(fn);
    if (!error) return { ...result, exchanges };
    if (error instanceof TxGoldApiError && error.status < 500) {
      return {
        status: error.status,
        body: { error: { code: error.code, title: error.title, detail: error.detail ?? null }, exchanges },
      };
    }
    // 5xx, a timeout, no network: the page falls back to a recorded run
    return { status: 503, body: { error: { code: 'sandbox_unavailable', title: 'The Sandbox did not answer.' }, exchanges } };
  }

  function requireSession(session) {
    return verifySession(config.sessionSecret, session);
  }

  /** The request, if it exists and belongs to this session; otherwise null (and no exchange shown). */
  async function ownRequest(sessionId, id) {
    const { result } = await recording(() => client.paymentRequests.get(id, stamp()));
    return result && result.tag === tagFor(sessionId) ? result : null;
  }

  return {
    async config() {
      business ??= client.accounts
        .get(config.accountId, stamp())
        .then((a) => ({ accountId: a.id, accountName: a.accountName, displayName: a.displayName }))
        .catch(() => {
          business = undefined; // try again next time
          return { accountId: config.accountId, accountName: null, displayName: null };
        });
      return {
        status: 200,
        body: {
          business: await business,
          customers: config.customers.map(({ index, handle }) => ({ index, handle })),
          maxAmount: config.maxAmount,
          methods: Object.fromEntries(Object.entries(METHODS).map(([name, m]) => [name, { minutes: m.minutes }])),
        },
      };
    },

    async session({ ip }) {
      if (!limiter.take('session', ip)) return tooMany();
      const { token } = newSession(config.sessionSecret, now());
      return { status: 201, body: { token } };
    },

    async createRequest({ session, ip, body }) {
      const sessionId = requireSession(session);
      if (!sessionId) return noSession();
      const method = METHODS[body?.method];
      const problems = {};
      if (!method) problems.method = `One of ${Object.keys(METHODS).join(', ')}.`;
      const amount = typeof body?.amount === 'string' ? body.amount : '';
      if (!AMOUNT.test(amount) || Number(amount) <= 0.02 || Number(amount) > Number(config.maxAmount))
        problems.amount = `More than 0.02 and at most ${config.maxAmount}, as a decimal string.`;
      const memo = typeof body?.memo === 'string' ? body.memo.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
      if (memo.length > 60) problems.memo = 'At most 60 characters.';

      let payer = {};
      if (method?.payer === 'customer') {
        const customer = config.customers[body?.customer];
        if (!customer) problems.customer = 'One of the demo customers.';
        else payer = { payerAccountId: customer.accountId };
      } else if (method?.payer === 'handle') {
        const typed = typeof body?.handle === 'string' ? body.handle.trim().replace(/^@/, '') : '';
        const customer = config.customers.find((c) => c.handle.toLowerCase() === typed.toLowerCase());
        if (!customer)
          return {
            status: 422,
            body: {
              error: {
                code: 'not_a_demo_customer',
                title: 'Not one of the demo customers',
                detail: `The demo can only ask its own customers to pay: ${config.customers.map((c) => '@' + c.handle).join(', ')}. ` +
                  'In your own checkout, an unknown handle is a 422 payer_account_invalid from the API.',
              },
              exchanges: [],
            },
          };
        payer = { payerHandle: customer.handle };
      }
      if (Object.keys(problems).length) return invalid(problems);
      if (!limiter.take('create', ip, sessionId)) return tooMany();

      const outcome = await call(async () => ({
        status: 201,
        body: {
          request: await client.paymentRequests.create(
            {
              accountId: config.accountId,
              ...payer,
              amount: Number(amount).toFixed(2),
              memo: memo || undefined,
              memoInternal: `demo ${body.method}`,
              tag: tagFor(sessionId),
              expiresAt: new Date(now() + method.minutes * 60_000).toISOString(),
            },
            stamp(),
          ),
        },
      }));
      return withExchanges(outcome);
    },

    async getRequest({ session, ip, params }) {
      const sessionId = requireSession(session);
      if (!sessionId) return noSession();
      if (!REQUEST_ID.test(params.id ?? '')) return notFound();
      if (!limiter.take('read', ip)) return tooMany();
      const outcome = await call(async () => {
        const request = await client.paymentRequests.get(params.id, stamp());
        if (request.tag !== tagFor(sessionId)) return { status: 404 };
        return { status: 200, body: { request } };
      });
      if (outcome.status === 404 && !outcome.body) return notFound();
      return withExchanges(outcome);
    },

    /** The simulated customer approves: Sandbox pay, then the request as it now is. */
    async payRequest({ session, ip, params, body }) {
      const sessionId = requireSession(session);
      if (!sessionId) return noSession();
      if (!REQUEST_ID.test(params.id ?? '')) return notFound();
      if (!limiter.take('act', ip, sessionId)) return tooMany();
      const own = await ownRequest(sessionId, params.id);
      if (!own) return notFound();
      const customer = config.customers[body?.customer ?? 0];
      if (own.isOpen && !customer) return invalid({ customer: 'One of the demo customers.' });

      return withExchanges(await call(async () => {
        const payment = await client.sandbox.payRequest(
          own.id,
          own.isOpen ? { payerAccountId: customer.accountId } : {},
          stamp(),
        );
        const request = await client.paymentRequests.get(own.id, stamp());
        return { status: 200, body: { payment, request } };
      }));
    },

    /** The customer declines, the till abandons the sale, or the checkout times out. */
    async cancelRequest({ session, ip, params }) {
      const sessionId = requireSession(session);
      if (!sessionId) return noSession();
      if (!REQUEST_ID.test(params.id ?? '')) return notFound();
      if (!limiter.take('act', ip, sessionId)) return tooMany();
      const own = await ownRequest(sessionId, params.id);
      if (!own) return notFound();

      return withExchanges(await call(async () => {
        try {
          return { status: 200, body: { request: await client.paymentRequests.cancel(own.id, stamp()) } };
        } catch (error) {
          // Paid (or expired) in the meantime: that wins, so show it as it is
          if (error instanceof TxGoldApiError && error.code === 'request_not_pending')
            return { status: 200, body: { request: await client.paymentRequests.get(own.id, stamp()) } };
          throw error;
        }
      }));
    },

    /** Ways 1 and 2: how the business sees what it was paid. The demo account's latest credits. */
    async transactions({ session, ip }) {
      const sessionId = requireSession(session);
      if (!sessionId) return noSession();
      if (!limiter.take('read', ip)) return tooMany();
      return withExchanges(await call(async () => {
        const page = await client.accounts.transactions(config.accountId, { limit: 5 }, stamp());
        return { status: 200, body: { transactions: page.data } };
      }));
    },
  };
}

/** Puts the recorded exchanges into the response body. */
function withExchanges(outcome) {
  if (!outcome.exchanges) return outcome;
  const { exchanges, ...rest } = outcome;
  return { status: rest.status, body: { ...(rest.body ?? {}), exchanges } };
}

/**
 * TxG-Timestamp values that never repeat in this instance, with a random sub-millisecond part so
 * two Function instances signing in the same millisecond don't collide: the timestamp is the
 * request's idempotency key, and a collision would hand one visitor another's request.
 */
export function timestampClock(now = () => Date.now()) {
  let last = 0n;
  return () => {
    let ticks = ticksNow(now()) + BigInt(randomInt(0, 10_000));
    if (ticks <= last) ticks = last + 1n;
    last = ticks;
    return ticks.toString();
  };
}

const problem = (status, code, title, extra = {}) => ({ status, body: { error: { code, title, ...extra }, exchanges: [] } });
const noSession = () => problem(401, 'no_session', 'Start a new demo session.');
const notFound = () => problem(404, 'not_found', 'No such payment request in this demo session.');
const tooMany = () => problem(429, 'rate_limited', 'Too many demo requests. Try again in a while.');
const invalid = (errors) => problem(400, 'invalid_request', 'Some fields are not valid.', { errors });
