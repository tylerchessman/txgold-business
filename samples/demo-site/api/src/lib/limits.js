// Per-visitor rate limits, in memory. Each Function instance counts on its own, which is good
// enough here: the worst a visitor can do is make Sandbox play-money requests to the demo's own
// customers, and every amount is capped.

export const LIMITS = {
  session: { max: 30, windowMs: 60 * 60_000 }, // new sessions per IP
  create: { max: 40, windowMs: 60 * 60_000 }, // payment requests made, per IP and per session
  act: { max: 80, windowMs: 60 * 60_000 }, // pay and cancel
  read: { max: 1500, windowMs: 60 * 60_000 }, // polling: a request every second or two
};

export class RateLimiter {
  constructor(limits = LIMITS, now = () => Date.now()) {
    this.limits = limits;
    this.now = now;
    this.windows = new Map();
  }

  /** Counts one use of `bucket` by each key; false (and counts nothing) when any key is over. */
  take(bucket, ...keys) {
    const { max, windowMs } = this.limits[bucket];
    const now = this.now();
    const entries = keys.filter(Boolean).map((key) => {
      const name = `${bucket}:${key}`;
      let entry = this.windows.get(name);
      if (!entry || now - entry.start >= windowMs) entry = { start: now, count: 0 };
      return [name, entry];
    });
    if (entries.some(([, entry]) => entry.count >= max)) return false;
    for (const [name, entry] of entries) {
      entry.count++;
      this.windows.set(name, entry);
    }
    if (this.windows.size > 20_000) this.prune(now);
    return true;
  }

  prune(now = this.now()) {
    for (const [name, entry] of this.windows) {
      const bucket = name.slice(0, name.indexOf(':'));
      if (now - entry.start >= this.limits[bucket].windowMs) this.windows.delete(name);
    }
  }
}

/** The visitor's IP, as Static Web Apps forwards it. */
export function clientIp(headers) {
  const forwarded = headers.get('x-azure-clientip') || headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0].trim();
  // "1.2.3.4:5678" -> "1.2.3.4"; IPv6 stays as it is
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(first) ? first.slice(0, first.lastIndexOf(':')) : first || 'unknown';
}
