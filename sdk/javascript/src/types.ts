/**
 * The API's resources. Every amount is a decimal string such as "12.50" (never a float), every id
 * is a string, and every time is an ISO 8601 UTC string.
 */

export type AccountType = string;
export type Direction = 'debit' | 'credit';
export type PaymentRequestStatus = 'pending' | 'paid' | 'dismissed' | 'cancelled' | 'expired';

export interface Page<T> {
  data: T[];
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
}

export interface Account {
  id: string;
  accountName: string | null;
  displayName: string | null;
  type: AccountType;
  tier: number | null;
  active: boolean;
  /** Null unless the key's role may see the balance (Admin, Manager, Integration). */
  balance: string | null;
}

export interface AccountLookup {
  id: string;
  accountName: string;
  displayName: string | null;
  type: AccountType;
}

export interface Counterparty {
  accountId: string;
  accountName: string | null;
  displayName: string | null;
  type: AccountType | null;
}

export interface AccountTransaction {
  id: string;
  direction: Direction;
  amount: string;
  fee: string | null;
  counterparty: Counterparty | null;
  memo: string | null;
  memoInternal: string | null;
  createdAt: string;
  paymentRequestId: string | null;
  refundOf: string | null;
  refundId: string | null;
  balanceAfter: string | null;
  estimatedUsdValue: string | null;
  actualUsdValue: string | null;
}

export interface Payment {
  id: string;
  accountId: string;
  destinationAccountId: string;
  direction: Direction;
  amount: string;
  fee: string | null;
  memo: string | null;
  memoInternal: string | null;
  createdAt: string;
  paymentRequestId: string | null;
  refundOf: string | null;
  refundId: string | null;
  refundedAmount: string | null;
  balanceAfter: string | null;
}

export interface PaymentCreate {
  /** The account paying: one your key acts for. */
  accountId: string;
  /** Required unless paymentRequestId is given. */
  destinationAccountId?: string;
  amount: string;
  memo?: string;
  memoInternal?: string;
  /** Pays this payment request; the amount must match it. */
  paymentRequestId?: string;
}

export interface RefundCreate {
  /** At most what was paid; leave out to refund the whole payment. */
  amount?: string;
  memo?: string;
  memoInternal?: string;
}

export interface PaymentRequest {
  id: string;
  status: PaymentRequestStatus;
  accountId: string;
  payerAccountId: string;
  amount: string;
  memo: string | null;
  memoInternal: string | null;
  createdAt: string;
  expiresAt: string;
  statusChangedAt: string | null;
  paymentId: string | null;
}

export interface PaymentRequestCreate {
  /** Your account, which will be paid. */
  accountId: string;
  /** The account asked to pay. */
  payerAccountId: string;
  amount: string;
  memo?: string;
  memoInternal?: string;
  /** At most 7 days ahead. */
  expiresAt?: string;
}

export interface Rate {
  usdPerTxGold: string;
  usdPerTroyOunce: string;
  asOf: string;
}

/** Per-call options. */
export interface RequestOptions {
  /**
   * The TxG-Timestamp to sign with. Resending a request with the same timestamp (and body) is
   * idempotent: you get the original result instead of a second payment. Leave out for a new one.
   */
  timestamp?: string;
  signal?: AbortSignal;
}
