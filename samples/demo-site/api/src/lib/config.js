// The demo's settings, from the Function app's environment (SWA application settings, or
// local.settings.json when running locally). See local.settings.example.json.
import { randomBytes } from 'node:crypto';
import { loadKeyFile, parseKeyFile } from '@txgold/business';

/**
 * Reads and checks the settings. Throws with a message naming the missing setting, so a
 * misconfigured deployment says what's wrong instead of failing on the first call.
 */
export function loadConfig(env = process.env) {
  // The integration key: the key file's JSON in TXGOLD_KEY (deployed), or its path (local)
  let key;
  if (env.TXGOLD_KEY) key = parseKeyFile(env.TXGOLD_KEY);
  else if (env.TXGOLD_KEY_FILE) key = loadKeyFile(env.TXGOLD_KEY_FILE);
  else throw new Error('Set TXGOLD_KEY (the key file JSON) or TXGOLD_KEY_FILE (its path).');

  if (key.environment && key.environment !== 'sandbox')
    throw new Error(`The demo runs against the Sandbox only; this key is for "${key.environment}".`);

  const accountId = env.TXGOLD_ACCOUNT_ID || key.accountId;
  if (!accountId) throw new Error('Set TXGOLD_ACCOUNT_ID: the demo business account.');

  const customers = parseCustomers(env.DEMO_CUSTOMERS ?? '');
  if (customers.length === 0)
    throw new Error('Set DEMO_CUSTOMERS: "id:handle,id:handle", the demo business\'s Sandbox demo customers.');

  let sessionSecret = env.DEMO_SESSION_SECRET ?? '';
  if (sessionSecret.length < 32) {
    if (env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production' || env.WEBSITE_SITE_NAME)
      throw new Error('Set DEMO_SESSION_SECRET: at least 32 random characters.');
    sessionSecret = randomBytes(32).toString('hex'); // local only: sessions end when the host restarts
  }

  return {
    key,
    baseUrl: env.TXGOLD_BASE_URL || undefined, // a local Business API host; default: the Sandbox
    accountId: String(accountId),
    customers,
    sessionSecret,
    maxAmount: '5.00',
  };
}

/** "1000011:TxGDemo-Customer1,1000012:TxGDemo-Customer2" -> [{ index, accountId, handle }] */
export function parseCustomers(text) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const match = /^(\d+):@?([A-Za-z0-9_-]{1,30})$/.exec(part);
      if (!match) throw new Error(`DEMO_CUSTOMERS: "${part}" is not id:handle.`);
      return { index, accountId: match[1], handle: match[2] };
    });
}
