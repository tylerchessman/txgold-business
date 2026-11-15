import type { ReactNode } from 'react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { PaymentRequest } from '@/lib/api';
import { Button } from './Button';
import { PhoneIdle } from './Phone';

/**
 * What the customer sees for a payment request: the business, the amount, the memo, and Approve /
 * Decline. Then the outcome. Approve is the one simulated step: it calls Sandbox pay.
 */
export function PhoneRequest({
  request,
  from,
  heading = 'Payment request',
  busy,
  onApprove,
  onDecline,
  waiting = 'Nothing to pay yet.',
  declined = false,
}: {
  request: PaymentRequest | null;
  from: string;
  heading?: string;
  busy: boolean;
  onApprove: () => void;
  onDecline: () => void;
  waiting?: string;
  /** The customer declined (the demo cancelled it for them). */
  declined?: boolean;
}) {
  if (!request) return <PhoneIdle text={waiting} />;

  if (request.status === 'paid')
    return (
      <Outcome icon={<CheckCircle2 className="h-12 w-12 text-positive" />} title="Paid">
        You paid {from} <strong>{request.amount} TxGold</strong>.
      </Outcome>
    );
  if (request.status === 'cancelled' || request.status === 'dismissed')
    return (
      <Outcome icon={<XCircle className="h-12 w-12 text-ink-faint" />} title={declined || request.status === 'dismissed' ? 'Declined' : 'Cancelled'}>
        {declined || request.status === 'dismissed' ? 'You declined this request.' : `${from} cancelled this request.`}
      </Outcome>
    );
  if (request.status === 'expired')
    return (
      <Outcome icon={<Clock className="h-12 w-12 text-ink-faint" />} title="Expired">
        This request can no longer be paid.
      </Outcome>
    );

  return (
    <div className="flex flex-1 flex-col">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{heading}</p>
      <div className="mt-2 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-ink-soft">{from} asks you to pay</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">
          {request.amount} <span className="text-base font-medium text-ink-soft">TxGold</span>
        </p>
        {request.memo && <p className="mt-2 text-sm">{request.memo}</p>}
      </div>
      <div className="mt-auto grid gap-2 pt-4">
        <Button onClick={onApprove} disabled={busy} data-testid="phone-approve">
          Approve
        </Button>
        <Button variant="secondary" onClick={onDecline} disabled={busy} data-testid="phone-decline">
          Decline
        </Button>
        <p className="text-center text-[11px] text-ink-faint">Approve is simulated: the Sandbox pays for the demo customer.</p>
      </div>
    </div>
  );
}

function Outcome({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" data-testid="phone-outcome">
      {icon}
      <p className="text-lg font-semibold">{title}</p>
      <p className="text-sm text-ink-soft">{children}</p>
    </div>
  );
}
