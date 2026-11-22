/**
 * The API's resources. Every amount is a decimal string such as "12.50" (never a float), every id
 * is a string, and every time is an ISO 8601 UTC string.
 */

export type AccountType = string;
export type Direction = 'debit' | 'credit';
export type PaymentRequestStatus = 'pending' | 'paid' | 'dismissed' | 'cancelled' | 'expired';
/**
 * pending (waiting for the customer), held (approved: charge or release it), captured, released,
 * declined, expired (not approved in time, or held and never charged), cancelled (released while
 * pending). New values may be added: treat an unknown one as not held.
 */
export type HoldStatus = 'pending' | 'held' | 'captured' | 'released' | 'declined' | 'expired' | 'cancelled';

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

export interface Hold {
  id: string;
  status: HoldStatus;
  /** Your account, which charges the hold. */
  accountId: string;
  /** The customer. Null for an open hold until someone approves it. */
  payerAccountId: string | null;
  /** True for an open hold: no payer named, approvable once by anyone with its holdUrl. */
  isOpen: boolean;
  /** The most you can charge. */
  amount: string;
  memo: string | null;
  memoInternal: string | null;
  tag: string | null;
  /** How long the hold lasts once approved. */
  holdMinutes: number;
  createdAt: string;
  /** When the request stops being approvable. */
  approveBy: string;
  heldAt: string | null;
  /** Capture or release before this, or the hold expires. */
  heldUntil: string | null;
  amountCaptured: string | null;
  amountReleased: string | null;
  /** The payment a capture made. */
  paymentId: string | null;
  endedAt: string | null;
  /** An open hold's link while it is pending: share it, or draw it as a QR code. */
  holdUrl: string | null;
}

export interface HoldCreate {
  /** Your account, which will charge the hold. */
  accountId: string;
  /**
   * The customer: they get a push notification. Give this, or payerHandle, or neither for an open
   * hold that anyone with its holdUrl can approve once.
   */
  payerAccountId?: string;
  /** The customer by TxGold handle (a leading @ is ignored), instead of payerAccountId. */
  payerHandle?: string;
  /** The most you will charge. */
  amount: string;
  /** Shown to the customer, and the memo of the charge. At most 150 characters. */
  memo?: string;
  /** Never shown to the customer. At most 150 characters. */
  memoInternal?: string;
  /** When the request stops being approvable. Default 10 minutes ahead, at most 24 hours. */
  approveBy?: string;
  /** How long the hold lasts once approved: 1 to 4320 (3 days), default 60. */
  holdMinutes?: number;
  /** Your own label (a pump, a device), never shown to the customer. At most 50 characters. */
  tag?: string;
}

export interface HoldCapture {
  /** What to charge: from 0.01 up to the amount held. The rest is released. */
  amount: string;
  /** The charge's memo. Default: the hold's memo. */
  memo?: string;
}

export interface HoldCaptureResult {
  hold: Hold;
  payment: Payment;
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
