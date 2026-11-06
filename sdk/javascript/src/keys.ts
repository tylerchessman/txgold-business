import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';

/** A private key and the TxG-Key-Id that names it. */
export interface SigningKey {
  /** The base64 SubjectPublicKeyInfo of the public key: the TxG-Key-Id header. */
  keyId: string;
  privateKey: KeyObject;
  /** From the key file, when it says: "sandbox" or "production". */
  environment?: string;
  /** From the key file, when it says: the account the integration acts for. */
  accountId?: string;
}

/**
 * Loads a key file from the business portal (txgold-<environment>-<name>.key.json).
 *
 * The private key may be `privateKeyPkcs8` (base64 PKCS#8 DER), `privateKeyPem` (PKCS#8
 * "PRIVATE KEY" or SEC1 "EC PRIVATE KEY"), or `privateKey` (base64 SEC1 DER, older Sandbox files).
 */
export function loadKeyFile(path: string): SigningKey {
  return parseKeyFile(readFileSync(path, 'utf8'));
}

/** Parses the text of a key file. See {@link loadKeyFile}. */
export function parseKeyFile(json: string): SigningKey {
  let file: Record<string, unknown>;
  try {
    file = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error('The key file is not valid JSON.');
  }
  const text = (name: string) => (typeof file[name] === 'string' && file[name] !== '' ? (file[name] as string) : undefined);

  let privateKey: KeyObject;
  const pkcs8 = text('privateKeyPkcs8');
  const pem = text('privateKeyPem');
  const sec1 = text('privateKey');
  if (pkcs8) privateKey = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
  else if (pem) privateKey = createPrivateKey(pem);
  else if (sec1) privateKey = createPrivateKey({ key: Buffer.from(sec1, 'base64'), format: 'der', type: 'sec1' });
  else throw new Error('The key file has no private key (privateKeyPkcs8, privateKeyPem or privateKey).');

  const key = signingKey(privateKey);
  const keyId = text('keyId');
  if (keyId && keyId !== key.keyId)
    throw new Error("The key file's keyId does not match its private key.");

  const account = file['accountId'];
  return {
    ...key,
    environment: text('environment'),
    accountId: typeof account === 'string' || typeof account === 'number' ? String(account) : undefined,
  };
}

/** Wraps a P-256 private key (a KeyObject, or a PKCS#8 / SEC1 PEM string). */
export function signingKey(privateKey: KeyObject | string): SigningKey {
  const key = typeof privateKey === 'string' ? createPrivateKey(privateKey) : privateKey;
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
    throw new Error('TxGold keys are ECDSA P-256 (prime256v1).');
  const keyId = createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64');
  return { keyId, privateKey: key };
}
