// A visitor's session: a random id, signed so the browser can't make one up. No cookie: the page
// sends it in the X-Demo-Session header, and the "pay on your phone" link carries it, so a phone
// that scans the QR code can act on the same requests as the computer that drew it.
//
// Every payment request the demo makes is tagged demo-<id>, and the API acts on a request only
// for the session whose tag it carries.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const LIFETIME_MS = 12 * 60 * 60_000;

export function newSession(secret, now = Date.now()) {
  const id = randomBytes(8).toString('hex');
  const issued = Math.floor(now / 1000).toString(36);
  const body = `${id}.${issued}`;
  return { id, token: `${body}.${sign(secret, body)}` };
}

/** The session id, or null when the token is missing, forged or expired. */
export function verifySession(secret, token, now = Date.now()) {
  if (typeof token !== 'string') return null;
  const match = /^([0-9a-f]{16})\.([0-9a-z]{1,10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return null;
  const [, id, issued, signature] = match;
  const expected = Buffer.from(sign(secret, `${id}.${issued}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const issuedMs = parseInt(issued, 36) * 1000;
  if (!(issuedMs <= now + 60_000 && now - issuedMs < LIFETIME_MS)) return null;
  return id;
}

/** The payment request tag for a session: at most 50 characters (it's 21). */
export const tagFor = (sessionId) => `demo-${sessionId}`;

function sign(secret, body) {
  return createHmac('sha256', secret).update(body).digest('base64url');
}
