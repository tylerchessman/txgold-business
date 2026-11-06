/**
 * An error response from the API (application/problem+json). `code` is the stable, documented
 * value to branch on; see https://docs.txgold.money/errors/{code}.
 */
export class TxGoldApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly requestId: string | undefined;
  readonly type: string | undefined;
  /** Field-level problems for invalid_request: field name to messages. */
  readonly errors: Record<string, string[]> | undefined;

  constructor(status: number, problem: Record<string, unknown>) {
    const text = (name: string) => (typeof problem[name] === 'string' ? (problem[name] as string) : undefined);
    const code = text('code') ?? `http_${status}`;
    const title = text('title') ?? `HTTP ${status}`;
    const detail = text('detail');
    super(detail ? `${title} (${code}): ${detail}` : `${title} (${code})`);
    this.name = 'TxGoldApiError';
    this.status = status;
    this.code = code;
    this.title = title;
    this.detail = detail;
    this.requestId = text('requestId');
    this.type = text('type');
    this.errors = typeof problem['errors'] === 'object' && problem['errors'] !== null
      ? (problem['errors'] as Record<string, string[]>)
      : undefined;
  }
}
