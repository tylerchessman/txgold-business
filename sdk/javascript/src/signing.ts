import { createHash, sign, verify, type KeyObject } from 'node:crypto';

/** The first line of every canonical string: the scheme and version. */
export const SCHEME = 'TXG1-ECDSA-P256-SHA256';

/** Milliseconds from 0001-01-01 (the .NET epoch) to 1970-01-01. */
const DOTNET_EPOCH_OFFSET_MS = 62_135_596_800_000n;

/** Lower-case hex SHA-256 of the exact body bytes (an empty body is the hash of nothing). */
export function sha256Hex(body: Uint8Array): string {
  return createHash('sha256').update(body).digest('hex');
}

/**
 * The string a request's signature covers:
 *
 *   TXG1-ECDSA-P256-SHA256\nMETHOD\nPATH\nQUERY\nTIMESTAMP\nhex(sha256(body))
 *
 * PATH and QUERY exactly as sent (QUERY without the "?", empty when there is none).
 */
export function canonicalString(method: string, path: string, query: string, timestamp: string, body: Uint8Array): string {
  return [SCHEME, method.toUpperCase(), path, query, timestamp, sha256Hex(body)].join('\n');
}

/** Signs a canonical string: ECDSA P-256 with SHA-256, IEEE P1363 (r||s), base64. */
export function signCanonical(privateKey: KeyObject, canonical: string): string {
  return sign('sha256', Buffer.from(canonical, 'utf8'), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64');
}

/** Checks a base64 signature (P1363 or DER) over a canonical string. Used by the tests. */
export function verifyCanonical(publicKey: KeyObject, canonical: string, signatureBase64: string, encoding: 'ieee-p1363' | 'der'): boolean {
  return verify('sha256', Buffer.from(canonical, 'utf8'), { key: publicKey, dsaEncoding: encoding }, Buffer.from(signatureBase64, 'base64'));
}

/** UTC now as .NET ticks (100 ns since 0001-01-01), the TxG-Timestamp format. */
export function ticksNow(nowMs: number = Date.now()): bigint {
  return (BigInt(nowMs) + DOTNET_EPOCH_OFFSET_MS) * 10_000n;
}

/**
 * Hands out TxG-Timestamp values that never repeat within one client. The timestamp is also the
 * request's idempotency key, so two different payments signed in the same millisecond must not
 * share one.
 */
export class TimestampClock {
  private last = 0n;

  constructor(private readonly now: () => number = Date.now) {}

  next(): string {
    let ticks = ticksNow(this.now());
    if (ticks <= this.last) ticks = this.last + 1n;
    this.last = ticks;
    return ticks.toString();
  }
}
