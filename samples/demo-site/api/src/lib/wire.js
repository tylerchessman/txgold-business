// Records each call the SDK makes to the Business API, so the page can show "what just happened":
// the request line, headers (signature shortened), body, status and response. The SDK takes a
// fetch option; this wraps the real fetch and writes into the log of the demo call in progress
// (AsyncLocalStorage), so one shared client serves every visitor.
import { AsyncLocalStorage } from 'node:async_hooks';

const current = new AsyncLocalStorage();

/** Runs `fn` with a fresh exchange log, and returns [result or error, log]. */
export async function recording(fn) {
  const log = [];
  try {
    return { result: await current.run(log, fn), exchanges: log };
  } catch (error) {
    return { error, exchanges: log };
  }
}

export function recordingFetch(inner = globalThis.fetch) {
  return async (url, init = {}) => {
    const log = current.getStore();
    const started = Date.now();
    const response = await inner(url, init);
    if (log) {
      const text = await response.clone().text();
      const target = new URL(url);
      log.push({
        method: init.method ?? 'GET',
        path: target.pathname + target.search,
        origin: target.origin,
        requestHeaders: redactHeaders(init.headers ?? {}),
        requestBody: decodeBody(init.body),
        status: response.status,
        responseBody: parseJson(text),
        ms: Date.now() - started,
      });
    }
    return response;
  };
}

function redactHeaders(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (name === 'TxG-Key-Id') out[name] = shorten(value, 16); // the public key: not secret, just long
    else if (name === 'TxG-Signature') out[name] = shorten(value, 12);
    else out[name] = value;
  }
  return out;
}

const shorten = (value, keep) => (value.length > keep + 4 ? `${value.slice(0, keep)}…` : value);

function decodeBody(body) {
  if (body === undefined || body === null) return null;
  const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
  return text === '' ? null : parseJson(text);
}

function parseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
