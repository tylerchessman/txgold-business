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
  /**
   * The account asked to pay. Null for an open request until it is paid (then the account that
   * paid it), and always null when the request named its payer by payerHandle.
   */
  payerAccountId: string | null;
  /** True for an open request: no payer named, payable once by anyone with its paymentUrl. */
  isOpen: boolean;
  amount: string;
  memo: string | null;
  memoInternal: string | null;
  createdAt: string;
  expiresAt: string;
  statusChangedAt: string | null;
  paymentId: string | null;
  /** Your own label for the request; never shown to the payer. */
  tag: string | null;
  /**
   * An open request's link: opens the TxGold app on this request. Share it, or draw it as a QR
   * code. Null for a request to a named payer.
   */
  paymentUrl: string | null;
}

export interface PaymentRequestCreate {
  /** Your account, which will be paid. */
  accountId: string;
  /**
   * The account asked to pay: its owner gets a push notification. Give this, or payerHandle, or
   * neither for an open request that anyone with its paymentUrl can pay once.
   */
  payerAccountId?: string;
  /**
   * The payer by TxGold handle (a leading @ is ignored), instead of payerAccountId: what a
   * customer types at your checkout. The payer's account id is then never returned.
   */
  payerHandle?: string;
  amount: string;
  /** Shown to the payer. At most 150 characters. */
  memo?: string;
  /** Never shown to the payer. At most 150 characters. */
  memoInternal?: string;
  /**
   * When the request stops being payable. A request to a payer: default and maximum 7 days ahead.
   * An open request: default 30 days, maximum 90.
   */
  expiresAt?: string;
  /** Your own label (a till, a device, a campaign), never shown to the payer. At most 50 characters. */
  tag?: string;
}

export interface SandboxPayRequest {
  /**
   * For an open request: which of your demo customers pays it. Default: your first demo customer.
   * Ignored for a request to a named payer.
   */
  payerAccountId?: string;
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
