// Copies the OpenAPI document and the signing vectors from the repository root into public/, so the
// site serves them at /openapi/v1.json (for the API reference) and /vectors/v1-request-signing.json.
import { cpSync, mkdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const pub = new URL('../public/', import.meta.url);
for (const [from, to] of [['openapi/v1.json', 'openapi/v1.json'], ['vectors/v1-request-signing.json', 'vectors/v1-request-signing.json']]) {
  mkdirSync(new URL(to.replace(/[^/]+$/, ''), pub), { recursive: true });
  cpSync(new URL(from, root), new URL(to, pub));
}
