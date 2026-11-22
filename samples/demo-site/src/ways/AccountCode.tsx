import { useState, type ReactNode } from 'react';
import { CheckCircle2, ScanLine } from 'lucide-react';
import { Button } from '@/components/Button';
import { CustomerPicker } from '@/components/CustomerPicker';
import { Phone } from '@/components/Phone';
import { QrCode } from '@/components/QrCode';
import { WayShell } from '@/components/WayShell';
import { api, type Transaction } from '@/lib/api';
import { businessName, useConfig, useDemoMode } from '@/lib/useConfig';
import { useLog } from '@/lib/useDemoRequest';
import type { StepName, Way } from '@/lib/steps';

/**
 * 1. Your QR code, and 2. a QR code with an amount. No API call makes the code: it's a link to the
 * business's account. The customer then pays the account directly, which the Sandbox has no way
 * to simulate (decision D40), so that payment is shown, not made. Checking what you were paid is
 * a real call.
 */
export function AccountCode({ way, withAmount }: { way: Way; withAmount: boolean }) {
  const { config } = useConfig();
  const recorded = useDemoMode() === 'recorded';
  const [entries, log] = useLog();
  const [suggested, setSuggested] = useState('2.50');
  const [memo, setMemo] = useState('Iced latte');
  const [customer, setCustomer] = useState(0);
  const [scanned, setScanned] = useState(false);
  const [typed, setTyped] = useState('');
  const [paid, setPaid] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [checking, setChecking] = useState(false);
  const shop = businessName(config);
  const handle = config?.business.accountName ?? 'your-handle';

  // What the printed code holds in production, with the account id left as a placeholder: a
  // real phone opening a Sandbox account id would reach a production account.
  const productionLink =
    `https://app.txgold.money/RequestPayment?AccountId=<your account id>&AccountName=${handle}` +
    (withAmount ? `&Amt=${encodeURIComponent(suggested)}&Memo=${encodeURIComponent(memo)}` : '');
  const demoLink =
    `${location.origin}/pay/code` + (withAmount ? `?amount=${encodeURIComponent(suggested)}&memo=${encodeURIComponent(memo)}` : '');

  function scan() {
    setScanned(true);
    setTyped(withAmount ? suggested : '');
  }

  function approve() {
    setPaid(Number(typed).toFixed(2));
    log.note(
      `Shown, not made: the customer pays ${Number(typed).toFixed(2)} TxGold straight to ${shop}'s account in the TxGold app. ` +
        'There is no request, so the Sandbox can\'t simulate this one; your business sees it in its transactions, and as a "payment received" notification.',
      'simulated',
    );
  }

  async function check() {
    setChecking(true);
    const result = await api.transactions();
    log.addExchanges("Check what you've been paid", result.exchanges);
    setChecking(false);
    if (result.ok) setTransactions(result.transactions);
  }

  function restart() {
    log.clear();
    setScanned(false);
    setPaid(null);
    setTransactions(null);
  }

  let step: StepName = withAmount ? 'link.amount' : 'link.build';
  let now: ReactNode;
  if (!scanned)
    now = withAmount
      ? <>The same QR code as way 1, with a suggested amount and memo in the link. Make one per item on a menu. No API call and no key. <strong>Scan it.</strong></>
      : <>Your QR code holds a link to your account. Print it once; no API call and no key. <strong>Scan it with the phone.</strong></>;
  else if (!paid) {
    step = 'link.qr';
    now = withAmount
      ? <>The amount is filled in, but it's only a suggestion: the customer can change it. For a fixed amount, use way 6.</>
      : <>The TxGold app opens on your account, and the customer types the amount.</>;
  } else {
    step = 'tour.transactions';
    now = <>The payment goes straight to your account. Your system finds it in your transactions: <code>GET /v1/accounts/{'{id}'}/transactions</code>. <strong>Check them.</strong></>;
  }

  const valid = /^\d{1,2}(\.\d{1,2})?$/.test(typed) && Number(typed) > 0;

  return (
    <WayShell
      way={way}
      now={now}
      step={step}
      entries={entries}
      onRestart={restart}
      businessTitle={withAmount ? `${shop} menu` : `${shop} counter`}
      business={
        <div className="space-y-4">
          {withAmount && (
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className="text-sm">
                <span className="font-medium">Memo</span>
                <input className="field mt-1" maxLength={40} value={memo} onChange={(e) => setMemo(e.target.value)} />
              </label>
              <label className="text-sm">
                <span className="font-medium">Amount</span>
                <input className="field mt-1" inputMode="decimal" value={suggested} onChange={(e) => setSuggested(e.target.value)} />
              </label>
            </div>
          )}
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line p-4">
            <p className="text-sm font-semibold">{withAmount ? `${memo}: ${suggested} TxGold` : `Pay ${shop} with TxGold`}</p>
            <QrCode value={demoLink} size={160} label={`QR code to pay ${shop}`} />
            <p className="text-xs text-ink-soft">Scan with your own phone to try it there.</p>
          </div>
          <div className="text-xs">
            <p className="font-medium text-ink-soft">In production the code holds</p>
            <p className="mt-1 break-all rounded-md bg-sunken p-2 font-mono">{productionLink}</p>
          </div>
          {paid && (
            <div className="space-y-2">
              <Button onClick={() => void check()} disabled={checking} data-testid="check-transactions">
                Check what you've been paid
              </Button>
              {transactions && (
                <ul className="divide-y divide-line rounded-lg border border-line text-sm" data-testid="transactions">
                  {transactions.length === 0 && <li className="p-2 text-ink-soft">No transactions yet.</li>}
                  {transactions.map((t) => (
                    <li key={t.id} className="flex justify-between gap-2 p-2">
                      <span className="truncate">
                        {t.direction === 'credit' ? 'From' : 'To'} {t.counterparty?.accountName ? `@${t.counterparty.accountName}` : 'an account'}
                        {t.memo && <span className="text-ink-soft"> · {t.memo}</span>}
                      </span>
                      <span className="tabular-nums">{t.direction === 'credit' ? '+' : '−'}{t.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
              {transactions && (
                <p className="text-xs text-ink-soft">
                  {recorded
                    ? "The demo account's transactions from the recorded run."
                    : "The demo account's latest real Sandbox transactions, from every visitor."}{' '}
                  The payment you just made was shown, not made, so it isn't among them.
                </p>
              )}
            </div>
          )}
        </div>
      }
      phone={
        <Phone who={<CustomerPicker config={config} value={customer} onChange={setCustomer} />}>
          {!scanned ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <ScanLine className="h-16 w-16 text-ink-soft" />
              <p className="text-sm text-ink-soft">Point the camera at the code.</p>
              <Button onClick={scan} data-testid="phone-scan">
                Scan the QR code
              </Button>
            </div>
          ) : paid ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center" data-testid="phone-outcome">
              <CheckCircle2 className="h-12 w-12 text-positive" />
              <p className="text-lg font-semibold">Paid</p>
              <p className="text-sm text-ink-soft">
                You paid {shop} <strong>{paid} TxGold</strong>.
              </p>
              <p className="text-[11px] text-ink-faint">Shown, not made: see the note on the right.</p>
            </div>
          ) : (
            <form
              className="flex flex-1 flex-col"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) approve();
              }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Pay</p>
              <p className="mt-1 text-lg font-semibold">{shop}</p>
              <p className="text-sm text-ink-soft">@{handle}</p>
              <label className="mt-4 block text-sm">
                <span className="font-medium">Amount (TxGold)</span>
                <input className="field mt-1 text-lg" inputMode="decimal" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus data-testid="phone-amount" />
              </label>
              {withAmount && <p className="mt-1 text-xs text-ink-soft">Suggested by the code. You can change it.</p>}
              {withAmount && memo && <p className="mt-2 text-sm">{memo}</p>}
              <Button type="submit" className="mt-auto" disabled={!valid} data-testid="phone-approve">
                Pay
              </Button>
            </form>
          )}
        </Phone>
      }
    />
  );
}

