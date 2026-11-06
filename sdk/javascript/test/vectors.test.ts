// The shared signing vectors (vectors/v1-request-signing.json at the repo root). Every TxGold SDK
// must pass these: build each canonical string exactly, and verify the reference signatures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPublicKey, generateKeyPairSync } from 'node:crypto';
import { canonicalString, sha256Hex, signCanonical, verifyCanonical } from '../src/signing.js';

interface Case {
  name: string; method: string; path: string; query: string; timestamp: string;
  bodyBase64: string; bodySha256Hex: string; canonical: string;
  signatureP1363Base64: string; signatureDerBase64: string;
}
const vectors = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../vectors/v1-request-signing.json', import.meta.url)), 'utf8')) as {
  publicKeySpkiBase64: string; cases: Case[];
};
const publicKey = createPublicKey({ key: Buffer.from(vectors.publicKeySpkiBase64, 'base64'), format: 'der', type: 'spki' });

for (const c of vectors.cases) {
  test(`vector ${c.name}: body hash and canonical string`, () => {
    const body = Buffer.from(c.bodyBase64, 'base64');
    assert.equal(sha256Hex(body), c.bodySha256Hex);
    assert.equal(canonicalString(c.method, c.path, c.query, c.timestamp, body), c.canonical);
  });

  test(`vector ${c.name}: reference signatures verify (P1363 and DER)`, () => {
    assert.ok(verifyCanonical(publicKey, c.canonical, c.signatureP1363Base64, 'ieee-p1363'));
    assert.ok(verifyCanonical(publicKey, c.canonical, c.signatureDerBase64, 'der'));
    assert.ok(!verifyCanonical(publicKey, c.canonical + 'x', c.signatureP1363Base64, 'ieee-p1363'));
  });
}

test('own signatures are 64-byte P1363 and verify', () => {
  const { privateKey, publicKey: own } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const canonical = vectors.cases[0].canonical;
  const signature = signCanonical(privateKey, canonical);
  assert.equal(Buffer.from(signature, 'base64').length, 64);
  assert.ok(verifyCanonical(own, canonical, signature, 'ieee-p1363'));
});
