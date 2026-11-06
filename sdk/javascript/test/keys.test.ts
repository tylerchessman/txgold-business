import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { parseKeyFile, signingKey } from '../src/keys.js';

function pair() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const keyId = createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
  return { privateKey, keyId };
}

test('portal key file: privateKeyPkcs8, environment and accountId', () => {
  const { privateKey, keyId } = pair();
  const file = {
    keyId,
    privateKeyPkcs8: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    environment: 'sandbox',
    accountId: '1000002',
  };
  const key = parseKeyFile(JSON.stringify(file));
  assert.equal(key.keyId, keyId);
  assert.equal(key.environment, 'sandbox');
  assert.equal(key.accountId, '1000002');
});

test('PEM only: PKCS#8 and SEC1', () => {
  const { privateKey, keyId } = pair();
  for (const type of ['pkcs8', 'sec1'] as const) {
    const pem = privateKey.export({ type, format: 'pem' }) as string;
    assert.equal(parseKeyFile(JSON.stringify({ keyId, privateKeyPem: pem })).keyId, keyId);
  }
});

test('older Sandbox file: base64 SEC1 privateKey', () => {
  const { privateKey, keyId } = pair();
  const file = { keyId, privateKey: privateKey.export({ type: 'sec1', format: 'der' }).toString('base64') };
  assert.equal(parseKeyFile(JSON.stringify(file)).keyId, keyId);
});

test('a keyId that does not match the private key is refused', () => {
  const { privateKey } = pair();
  const other = pair();
  const file = { keyId: other.keyId, privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  assert.throws(() => parseKeyFile(JSON.stringify(file)), /does not match/);
});

test('missing private key, bad JSON and non-P-256 keys are refused', () => {
  assert.throws(() => parseKeyFile('{"keyId":"x"}'), /no private key/);
  assert.throws(() => parseKeyFile('not json'), /not valid JSON/);
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  assert.throws(() => signingKey(privateKey), /P-256/);
});
