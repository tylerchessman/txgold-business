import { useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { CheckCircle2, ScanLine, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { CustomerPicker } from '@/components/CustomerPicker';
import { Phone, PhoneIdle } from '@/components/Phone';
import { PhoneRequest } from '@/components/PhoneScreens';
import { QrCode } from '@/components/QrCode';
import { WayShell } from '@/components/WayShell';
import { phoneLink } from '@/lib/api';
import { businessName, useConfig, useDemoMode } from '@/lib/useConfig';
import { useDemoRequest, useLog } from '@/lib/useDemoRequest';
import type { StepName, Way } from '@/lib/steps';

type Mode = 'till' | 'invoice';
const TILL_WAIT_MS = 90_000;
const INVOICE_WAIT_MS = 10 * 60_000;
const PRESETS = ['1.80', '2.95', '4.50'];

/** 6. An open request: a fresh QR per sale on a till, or a link on an invoice. */
export function OpenRequest({ way }: { way: Way }) {
  const { config } = useConfig();
  const recorded = useDemoMode() === 'recorded';
  const [entries, log] = useLog();
  const [mode, setMode] = useState<Mode>('till');
  const till = useDemoRequest(log, {
    timeoutMs: TILL_WAIT_MS,
    timeoutNote: 'Nobody paid within 90 seconds: the till treats the sale as abandoned and cancels the request, so the QR (perhaps photographed) stops working.',
  });
  const invoice = useDemoRequest(log, { timeoutMs: INVOICE_WAIT_MS, timeoutNote: 'The demo stops waiting for this invoice and cancels it.' });
  const flow = mode === 'till' ? till : invoice;
  const [amount, setAmount] = useState('2.95');
  const [scanned, setScanned] = useState(false);
  const [customer, setCustomer] = useState(0);
  const [invoiceNumber] = useState(() => `INV-${String(Date.now() % 100_000).padStart(5, '0')}`);
  const shop = businessName(config);
  const { request } = flow;
  const status = request?.status;

  async function charge() {
    setScanned(false);
    await till.create({ method: 'till', amount, memo: `${shop}, counter` });
  }

  async function sendInvoice() {
    setScanned(false);
    await invoice.create({ method: 'invoice', amount: '4.20', memo: `${shop}: invoice ${invoiceNumber}` });
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setScanned(false);
  }

  function restart() {
    till.reset();
    invoice.reset();
    log.clear();
    setScanned(false);
  }

  const prefix = mode === 'till' ? 'till' : 'invoice';
  let step: StepName = `${prefix}.create`;
  let now: ReactNode;
  if (!request)
    now = mode === 'till'
      ? <>Ring up a sale. The till asks your server for an <strong>open request</strong>: no payer named, payable once by whoever scans it, and short-lived.</>
      : <>Send an invoice with a payment link. It's an open request too, but it can wait days: up to 90.</>;
  else if (status === 'pending' && !scanned) {
    step = `${prefix}.qr`;
    now = <>The request's link is drawn as a QR code. <strong>Scan it</strong> with the demo phone, or with your own phone's camera: it opens the demo's TxGold app.</>;
  } else if (status === 'pending') {
    step = mode === 'till' ? 'till.wait' : 'invoice.wait';
    now = <>The customer sees the business, the amount and the memo. Nobody can change them. Meanwhile the {mode} polls the request. <strong>Approve it.</strong></>;
  } else if (status === 'paid') {
    step = mode === 'till' ? 'till.paid' : 'invoice.wait';
    now = <>Paid. The poll saw <code>status: "paid"</code>, with the payer's account and the payment id. {mode === 'till' ? 'Print the receipt.' : 'Mark the invoice paid.'}</>;
  } else {
    step = mode === 'till' ? 'till.cancel' : 'invoice.wait';
    now = <>Cancelled: the link no longer takes payments.</>;
  }

  const qr = request && status === 'pending' && (
    <div className="flex flex-col items-center gap-2">
      <QrCode value={phoneLink(request.id)} size={180} label="QR code that opens this payment request" />
      <p className="max-w-[16rem] text-center text-xs text-ink-soft">
        {recorded ? (
          <>In a recorded run, pay with the phone here: a real phone needs the live Sandbox.</>
        ) : (
          <>Scan with your own phone's camera to pay on it.</>
        )}{' '}
        In production this QR holds the request's <code>paymentUrl</code>, which
        opens the real TxGold app.
      </p>
    </div>
  );

  return (
    <WayShell
      way={way}
      now={now}
      step={step}
      entries={entries}
      onRestart={restart}
      businessTitle={mode === 'till' ? `${shop} till` : `${shop} invoice`}
      business={
        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-sunken p-1 text-sm">
            {(['till', 'invoice'] as const).map((m) => (
              <button
                key={m}
                className={clsx('flex-1 rounded-md py-1', mode === m ? 'bg-surface font-medium shadow-sm' : 'text-ink-soft')}
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
              >
                {m === 'till' ? 'A till' : 'An invoice'}
              </button>
            ))}
          </div>

          {mode === 'till' ? (
            !request || status !== 'pending' ? (
              <div className="space-y-3">
                <Outcome status={status} paidText="Paid. Receipt printed." />
                <p className="text-sm font-medium">New sale</p>
                <div className="flex gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      className={clsx('flex-1 rounded-md border py-2 text-sm tabular-nums', amount === p ? 'border-ink bg-sunken font-semibold' : 'border-line')}
                      onClick={() => setAmount(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Button className="w-full" onClick={() => void charge()} disabled={till.busy} data-testid="charge">
                  Charge {amount} TxGold
                </Button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <p className="text-2xl font-semibold tabular-nums">{request.amount} TxGold</p>
                {qr}
                {till.deadline && (
                  <p className="text-sm text-ink-soft">
                    Sale abandoned in <Countdown until={till.deadline} />
                  </p>
                )}
                <Button variant="secondary" onClick={() => void till.cancel('Abandon the sale: cancel the request')} disabled={till.busy}>
                  Abandon sale
                </Button>
              </div>
            )
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-line p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">{shop}</span>
                  <span className="text-ink-soft">{invoiceNumber}</span>
                </div>
                <div className="mt-3 space-y-1">
                  <Row label="Office coffee, November" value="3.60" />
                  <Row label="Filter papers" value="0.60" />
                  <Row label="Total" value="4.20" strong />
                </div>
                {request && status === 'pending' && <div className="mt-4 border-t border-line pt-4">{qr}</div>}
                {request && status !== 'pending' && (
                  <div className="mt-4 border-t border-line pt-3">
                    <Outcome status={status} paidText="Invoice paid." />
                  </div>
                )}
              </div>
              {!request && (
                <Button className="w-full" onClick={() => void sendInvoice()} disabled={invoice.busy} data-testid="send-invoice">
                  Add a TxGold payment link
                </Button>
              )}
              {request && status === 'pending' && (
                <Button variant="secondary" className="w-full" onClick={() => void invoice.cancel('Void the invoice: cancel the request')} disabled={invoice.busy}>
                  Void the invoice
                </Button>
              )}
            </div>
          )}
        </div>
      }
      phone={
        <Phone who={<CustomerPicker config={config} value={customer} onChange={setCustomer} disabled={flow.busy} />}>
          {request && status === 'pending' && !scanned ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <ScanLine className="h-16 w-16 text-ink-soft" />
              <p className="text-sm text-ink-soft">{mode === 'till' ? 'Point the camera at the till.' : 'Open the link on the invoice.'}</p>
              <Button onClick={() => setScanned(true)} data-testid="phone-scan">
                {mode === 'till' ? 'Scan the QR code' : 'Open the link'}
              </Button>
            </div>
          ) : request && (scanned || status !== 'pending') ? (
            <PhoneRequest
              request={request}
              from={shop}
              heading={mode === 'till' ? 'Pay at the counter' : 'Pay an invoice'}
              busy={flow.busy}
              onApprove={() => void flow.pay(customer)}
              onDecline={() => {
                log.note('Simulated: the customer walks away. Nothing is sent; the open request stays payable until the business cancels it.', 'simulated');
                setScanned(false);
              }}
            />
          ) : (
            <PhoneIdle text="Scan a TxGold QR code or open a payment link to pay." />
          )}
        </Phone>
      }
    />
  );
}

function Outcome({ status, paidText }: { status: string | undefined; paidText: string }) {
  if (status === 'paid')
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-positive" data-testid="sale-paid">
        <CheckCircle2 className="h-5 w-5" /> {paidText}
      </p>
    );
  if (status === 'cancelled' || status === 'expired')
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <XCircle className="h-5 w-5" /> The request was {status}.
      </p>
    );
  return null;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={clsx('flex justify-between', strong && 'border-t border-line pt-1 font-semibold')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
