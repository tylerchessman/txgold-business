// The /api routes (Azure Functions v4, Node). Thin: each reads the request and hands it to
// lib/handlers.js. One TxGoldClient serves every visitor; lib/wire.js records each visitor's calls.
import { app } from '@azure/functions';
import { TxGoldClient } from '@txgold/business';
import { loadConfig } from '../lib/config.js';
import { createHandlers } from '../lib/handlers.js';
import { RateLimiter, clientIp } from '../lib/limits.js';
import { recordingFetch } from '../lib/wire.js';

let handlers;
function getHandlers() {
  if (!handlers) {
    const config = loadConfig();
    const client = new TxGoldClient({
      key: config.key,
      environment: 'sandbox',
      baseUrl: config.baseUrl,
      timeoutMs: 8_000, // past this, the page falls back to the recorded run
      fetch: recordingFetch(),
    });
    handlers = createHandlers({ client, config, limiter: new RateLimiter() });
  }
  return handlers;
}

function route(name, methods, path, handlerName) {
  app.http(name, {
    methods,
    authLevel: 'anonymous',
    route: path,
    handler: async (request, context) => {
      let result;
      try {
        let body;
        if (request.method === 'POST') {
          const text = await request.text();
          if (text.length > 2_000) return json(413, { error: { code: 'too_large', title: 'Request body too large.' } });
          try {
            body = text ? JSON.parse(text) : {};
          } catch {
            return json(400, { error: { code: 'invalid_json', title: 'The body is not JSON.' } });
          }
        }
        result = await getHandlers()[handlerName]({
          session: request.headers.get('x-demo-session'),
          ip: clientIp(request.headers),
          params: request.params,
          body,
        });
      } catch (error) {
        context.error(`${name} failed`, error);
        return json(500, { error: { code: 'demo_error', title: 'The demo hit a problem on its side.' } });
      }
      return json(result.status, result.body);
    },
  });
}

function json(status, body) {
  return {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

route('Config', ['GET'], 'config', 'config');
route('Session', ['POST'], 'session', 'session');
route('CreateRequest', ['POST'], 'requests', 'createRequest');
route('GetRequest', ['GET'], 'requests/{id}', 'getRequest');
route('PayRequest', ['POST'], 'requests/{id}/pay', 'payRequest');
route('CancelRequest', ['POST'], 'requests/{id}/cancel', 'cancelRequest');
route('Transactions', ['GET'], 'transactions', 'transactions');
