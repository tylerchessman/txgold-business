import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { CustomerPicker } from '@/components/CustomerPicker';
import { Phone, PhoneIdle } from '@/components/Phone';
import { PhoneRequest } from '@/components/PhoneScreens';
import { adoptSession, api, type PaymentRequest } from '@/lib/api';
import { businessName, useConfig } from '@/lib/useConfig';

/**
 * What a real phone opens when it scans one of the demo's QR codes: the simulated TxGold app, on
 * the request the visitor sees on their computer (same session, from the link's `s`). In
 * production the QR holds the request's paymentUrl and opens the real TxGold app instead.
 */
export function PayPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const token = search.get('s');
  const { config } = useConfig();
  const [request, setRequest] = useState<PaymentRequest | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [customer, setCustomer] = useState(0);
  const [declined, setDeclined] = useState(false);
  const shop = businessName(config);

  useEffect(() => {
    if (!id) return;
    if (token) adoptSession(token);
    void api.getRequest(id).then((result) => {
      if (result.ok) setRequest(result.request);
      else setProblem(result.status === 404 ? 'This payment request belongs to another demo session, or has gone.' : result.error.title);
    });
  }, [id, token]);

  async function act(action: 'pay' | 'cancel') {
    if (!request) return;
    if (action === 'cancel') setDeclined(true);
    setBusy(true);
    const result = action === 'pay' ? await api.pay(request.id, customer) : await api.cancel(request.id);
    setBusy(false);
    if (result.ok) setRequest(result.request);
    else setProblem(result.error.title);
  }

  return (
    <PayFrame>
      <Phone who={request?.isOpen ? <CustomerPicker config={config} value={customer} onChange={setCustomer} disabled={busy} /> : undefined}>
        {problem ? (
          <PhoneIdle text={problem} />
        ) : !request ? (
          <PhoneIdle text="Opening the payment request…" />
        ) : (
          <PhoneRequest
            request={request}
            from={shop}
            heading="Payment request"
            busy={busy}
            onApprove={() => void act('pay')}
            onDecline={() => (request.isOpen ? setProblem('You walked away. The business can still cancel the request.') : void act('cancel'))}
            declined={declined}
          />
        )}
      </Phone>
    </PayFrame>
  );
}

/** Ways 1 and 2 scanned on a real phone: the customer types (or keeps) the amount. Nothing is sent. */
export function PayCodePage() {
  const [search] = useSearchParams();
  const { config } = useConfig();
  const [amount, setAmount] = useState(search.get('amount') ?? '');
  const [paid, setPaid] = useState(false);
  const memo = search.get('memo');
  const shop = businessName(config);
  const valid = /^\d{1,2}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;

  return (
    <PayFrame>
      <Phone>
        {paid ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <CheckCircle2 className="h-12 w-12 text-positive" />
            <p className="text-lg font-semibold">Paid</p>
            <p className="text-sm text-ink-soft">
              You paid {shop} <strong>{Number(amount).toFixed(2)} TxGold</strong>.
            </p>
            <p className="text-[11px] text-ink-faint">Shown, not made: a payment straight to an account can't be simulated in the Sandbox.</p>
          </div>
        ) : (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) setPaid(true);
            }}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Pay</p>
            <p className="mt-1 text-lg font-semibold">{shop}</p>
            <label className="mt-4 block text-sm">
              <span className="font-medium">Amount (TxGold)</span>
              <input className="field mt-1 text-lg" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            {memo && <p className="mt-2 text-sm">{memo}</p>}
            <Button type="submit" className="mt-auto" disabled={!valid}>
              Pay
            </Button>
          </form>
        )}
      </Phone>
    </PayFrame>
  );
}

function PayFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm space-y-4 py-4">
      <p className="text-center text-sm text-ink-soft">
        The TxGold demo, on your phone. In production, this code opens the real TxGold app.
      </p>
      {children}
      <p className="text-center text-xs text-ink-faint">
        <Link to="/" className="underline">
          About this demo
        </Link>
      </p>
    </div>
  );
}
