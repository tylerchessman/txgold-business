import { useState, type ReactNode } from 'react';
import { CheckCircle2, Coffee, Loader2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { CustomerPicker } from '@/components/CustomerPicker';
import { Phone } from '@/components/Phone';
import { PhoneRequest } from '@/components/PhoneScreens';
import { WayShell } from '@/components/WayShell';
import { businessName, useConfig } from '@/lib/useConfig';
import { useDemoRequest, useLog } from '@/lib/useDemoRequest';
import type { StepName, Way } from '@/lib/steps';

const ITEM = { name: 'Flat white, pick up in 5 minutes', price: '0.75' };

/** 5. Checkout inside your app: an open request whose paymentUrl the app opens. */
export function AppCheckout({ way }: { way: Way }) {
  const { config } = useConfig();
  const [entries, log] = useLog();
  const flow = useDemoRequest(log, {
    timeoutMs: 2 * 60_000,
    timeoutNote: 'The customer never came back: the app\'s server cancels the request, so the link stops working.',
  });
  const [customer, setCustomer] = useState(0);
  const shop = businessName(config);
  const { request } = flow;
  const status = request?.status;

  async function payWithTxGold() {
    const result = await flow.create({ method: 'in-app', amount: ITEM.price, memo: `${shop} app: ${ITEM.name}` });
    if (result.ok) log.note('The app opens the request\'s paymentUrl. On a phone with TxGold installed, that opens the TxGold app on the request.', 'info');
  }

  function restart() {
    flow.reset();
    log.clear();
  }

  let step: StepName = 'handoff.create';
  let now: ReactNode;
  if (!request) now = <>This is your own app (here, a coffee shop's). "Pay with TxGold" asks your server for an open request, just for this order.</>;
  else if (status === 'pending') {
    step = 'handoff.open';
    now = <>Your app opened the request's <code>paymentUrl</code>, and the TxGold app came up on it. Your server polls meanwhile. <strong>Approve it on the TxGold phone.</strong></>;
  } else if (status === 'paid') {
    step = 'handoff.paid';
    now = <>Paid. Back in your app, the order is confirmed: your server saw <code>status: "paid"</code>, and which account paid.</>;
  } else {
    step = 'handoff.cancel';
    now = <>Cancelled: the link no longer takes payments.</>;
  }

  // Your app, drawn as a second phone
  const yourApp = (
    <div className="mx-auto w-full max-w-[260px] rounded-[1.75rem] border-8 border-ink-soft bg-ink-soft">
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-[1.25rem] bg-surface">
        <div className="flex items-center gap-2 bg-gold/20 px-4 py-3">
          <Coffee className="h-5 w-5" />
          <span className="text-sm font-semibold">{shop}</span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          {!request ? (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Your order</p>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-sunken p-3 text-sm">
                <span>{ITEM.name}</span>
                <span className="font-semibold tabular-nums">{ITEM.price}</span>
              </div>
              <Button className="mt-auto" onClick={() => void payWithTxGold()} disabled={flow.busy} data-testid="pay-with-txgold">
                Pay with TxGold
              </Button>
            </>
          ) : status === 'pending' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-ink-soft">
              <Loader2 className="h-8 w-8 animate-spin" />
              Finish paying in TxGold, then come back here.
              <Button variant="quiet" onClick={() => void flow.cancel('The customer gives up: cancel the request')} disabled={flow.busy}>
                Cancel
              </Button>
            </div>
          ) : status === 'paid' ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" data-testid="app-order-done">
              <CheckCircle2 className="h-12 w-12 text-positive" />
              <p className="font-semibold">Order confirmed</p>
              <p className="text-sm text-ink-soft">Ready in about 5 minutes.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-sm text-ink-soft">
              Payment not completed.
              <Button variant="secondary" onClick={restart}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <WayShell
      way={way}
      now={now}
      step={step}
      entries={entries}
      onRestart={restart}
      businessTitle={`${shop} app`}
      business={yourApp}
      phone={
        <Phone who={<CustomerPicker config={config} value={customer} onChange={setCustomer} disabled={flow.busy} />}>
          <PhoneRequest
            request={request}
            from={shop}
            heading="Opened from another app"
            busy={flow.busy}
            onApprove={() => void flow.pay(customer)}
            onDecline={() => void flow.decline("Simulated: the customer backs out in TxGold. Nothing is sent from the phone; the app's server cancels the request.")}
            declined={flow.declined}
            waiting="TxGold opens here when another app hands you a payment."
          />
        </Phone>
      }
    />
  );
}
