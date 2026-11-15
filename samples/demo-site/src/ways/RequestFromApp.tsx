import { useState, type ReactNode } from 'react';
import { Bell, CheckCircle2, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { Phone } from '@/components/Phone';
import { PhoneRequest } from '@/components/PhoneScreens';
import { WayShell } from '@/components/WayShell';
import { businessName, useConfig } from '@/lib/useConfig';
import { useDemoRequest, useLog } from '@/lib/useDemoRequest';
import type { StepName, Way } from '@/lib/steps';

/** 3. A request from the app: the business asks a customer it knows, by account. */
export function RequestFromApp({ way }: { way: Way }) {
  const { config, failed } = useConfig();
  const [entries, log] = useLog();
  const flow = useDemoRequest(log, {
    timeoutMs: 3 * 60_000,
    timeoutNote: 'The demo stops waiting and cancels the request. A real one lasts up to 7 days.',
  });
  const [customer, setCustomer] = useState(0);
  const [amount, setAmount] = useState('3.50');
  const [memo, setMemo] = useState('Catering, Friday meeting');
  const [opened, setOpened] = useState(false);
  const shop = businessName(config);
  const { request } = flow;
  const status = request?.status;
  const payer = config?.customers[customer];

  async function send() {
    setOpened(false);
    await flow.create({ method: 'app-request', customer, amount, memo });
  }

  function restart() {
    flow.reset();
    log.clear();
    setOpened(false);
  }

  let step: StepName = 'tour.create';
  let now: ReactNode;
  if (!request)
    now = <>Bill a customer you know. A business does this in the TxGold app with no code; with the API it is the same request, naming the payer's account (<code>payerAccountId</code>).</>;
  else if (status === 'pending' && !opened) {
    step = 'tour.create';
    now = <>The customer gets a push notification. <strong>Open it on the phone.</strong></>;
  } else if (status === 'pending') {
    step = 'tour.pay';
    now = <>The amount is fixed: the customer can only approve or decline. <strong>Approve it.</strong></>;
  } else if (status === 'paid') {
    step = 'tour.get';
    now = <>Paid. The business sees the request as paid, with the payment's id, and gets its own "payment received" notification.</>;
  } else {
    step = 'tour.create';
    now = <>The request was {status}.</>;
  }

  const valid = /^\d{1,2}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0.02 && Number(amount) <= Number(config?.maxAmount ?? 5);

  return (
    <WayShell
      way={way}
      now={now}
      step={step}
      entries={entries}
      onRestart={restart}
      unavailable={failed || flow.error?.code === 'sandbox_unavailable'}
      businessTitle={`${shop}: request a payment`}
      business={
        !request ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <label className="block text-sm">
              <span className="font-medium">Customer</span>
              <select className="field mt-1" value={customer} onChange={(e) => setCustomer(Number(e.target.value))}>
                {config?.customers.map((c) => (
                  <option key={c.index} value={c.index}>
                    @{c.handle}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Amount (TxGold)</span>
              <input className="field mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <span className="mt-1 block text-xs text-ink-soft">At most {config?.maxAmount ?? '5.00'} in the demo.</span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Memo, shown to the customer</span>
              <input className="field mt-1" maxLength={60} value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>
            <Button type="submit" disabled={!valid || !config || flow.busy} data-testid="send-request">
              <Send className="h-4 w-4" /> Send request
            </Button>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-line p-3">
              <p className="text-ink-soft">To @{payer?.handle}</p>
              <p className="text-lg font-semibold tabular-nums">{request.amount} TxGold</p>
              {request.memo && <p>{request.memo}</p>}
              <p className="mt-2 flex items-center gap-2">
                {status === 'paid' ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-positive" /> Paid: payment <span className="font-mono">{request.paymentId}</span>
                  </>
                ) : status === 'pending' ? (
                  <>
                    Waiting for the customer{flow.deadline && <> (<Countdown until={flow.deadline} />)</>}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-ink-faint" /> {status}
                  </>
                )}
              </p>
            </div>
            {status === 'pending' ? (
              <Button variant="secondary" onClick={() => void flow.cancel('The business withdraws the request')} disabled={flow.busy}>
                Withdraw request
              </Button>
            ) : (
              <Button variant="secondary" onClick={restart}>
                New request
              </Button>
            )}
          </div>
        )
      }
      phone={
        <Phone who={payer ? `@${payer.handle}` : undefined}>
          {request && status === 'pending' && !opened ? (
            <div className="flex flex-1 flex-col">
              <button
                className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-left shadow-md"
                onClick={() => setOpened(true)}
                data-testid="phone-notification"
              >
                <Bell className="mt-0.5 h-5 w-5 text-gold-deep" />
                <span className="text-sm">
                  <span className="block font-semibold">Payment request</span>
                  {shop} requests {request.amount} TxGold
                </span>
              </button>
              <p className="mt-auto text-center text-xs text-ink-faint">Tap the notification to open it.</p>
            </div>
          ) : (
            <PhoneRequest
              request={request}
              from={shop}
              busy={flow.busy}
              onApprove={() => void flow.pay()}
              onDecline={() => void flow.decline()}
              declined={flow.declined}
              waiting="Requests from businesses you deal with appear here."
            />
          )}
        </Phone>
      }
    />
  );
}
