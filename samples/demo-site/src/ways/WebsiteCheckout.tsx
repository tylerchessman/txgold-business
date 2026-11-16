import { useState, type ReactNode } from 'react';
import { CheckCircle2, ShoppingBag, XCircle } from 'lucide-react';
import { Button } from '@/components/Button';
import { Countdown } from '@/components/Countdown';
import { Phone } from '@/components/Phone';
import { PhoneRequest } from '@/components/PhoneScreens';
import { WayShell } from '@/components/WayShell';
import { businessName, useConfig } from '@/lib/useConfig';
import { useDemoRequest, useLog } from '@/lib/useDemoRequest';
import type { StepName, Way } from '@/lib/steps';

const PRODUCTS = [
  { name: 'House blend, 250 g', price: '2.40' },
  { name: 'Ceramic mug', price: '1.25' },
  { name: 'Cold brew, 6 pack', price: '3.10' },
];

const WAIT_MS = 2 * 60_000;

/** 4. Checkout on your website: a request to the handle the customer types, polled until paid. */
export function WebsiteCheckout({ way }: { way: Way }) {
  const { config } = useConfig();
  const [entries, log] = useLog();
  const flow = useDemoRequest(log, {
    timeoutMs: WAIT_MS,
    timeoutNote: 'Two minutes and no answer: the shop gives up on the order and cancels the request, so it can no longer be paid.',
  });
  const [product, setProduct] = useState<(typeof PRODUCTS)[number] | null>(null);
  const [handle, setHandle] = useState('');
  const [handleError, setHandleError] = useState<string | null>(null);
  const shop = businessName(config);
  const { request } = flow;

  async function placeOrder() {
    if (!product) return;
    setHandleError(null);
    const result = await flow.create({ method: 'web-checkout', handle, amount: product.price, memo: `${shop} web shop: ${product.name}` });
    if (!result.ok && (result.error.code === 'not_a_demo_customer' || result.error.code === 'invalid_request'))
      setHandleError(result.error.detail ?? result.error.title);
  }

  function restart() {
    flow.reset();
    log.clear();
    setProduct(null);
    setHandle('');
    setHandleError(null);
  }

  const status = request?.status;
  let step: StepName = 'checkout.create';
  let now: ReactNode;
  if (!product) now = <>Pick something to buy. The shop is a web page; behind it is your server, holding your TxGold key.</>;
  else if (!request && handleError) {
    step = 'checkout.unknown';
    now = <>That handle isn't one of the demo's customers. In your shop, an unknown handle comes back from the API as <code>422 payer_account_invalid</code>: ask the customer to check it.</>;
  } else if (!request) now = <>The customer types their TxGold handle. Your server then asks that account to pay: <code>POST /v1/payment-requests</code> with <code>payerHandle</code>.</>;
  else if (status === 'pending') {
    step = 'checkout.wait';
    now = <>The request is on the customer's phone. Your checkout polls it until it's paid, and cancels it if the customer doesn't answer in time. <strong>Approve it on the phone.</strong></>;
  } else if (status === 'paid') {
    step = 'checkout.paid';
    now = <>Paid. The poll saw <code>status: "paid"</code> and the payment's id: fulfil the order. The TxGold landed in the shop's account.</>;
  } else {
    step = 'checkout.cancel';
    now = <>The request was cancelled, so it can't be paid later for an order the shop has dropped.</>;
  }

  return (
    <WayShell
      way={way}
      now={now}
      step={step}
      entries={entries}
      onRestart={restart}
      businessTitle={`${shop} web shop`}
      business={
        !product ? (
          <div className="grid gap-3">
            {PRODUCTS.map((p) => (
              <button
                key={p.name}
                className="flex items-center gap-3 rounded-lg border border-line p-3 text-left hover:border-ink-soft"
                onClick={() => setProduct(p)}
              >
                <ShoppingBag className="h-8 w-8 rounded-md bg-sunken p-1.5 text-ink-soft" />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-sm tabular-nums">{p.price} TxGold</span>
              </button>
            ))}
          </div>
        ) : !request ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void placeOrder();
            }}
          >
            <div className="flex items-center justify-between rounded-lg bg-sunken px-3 py-2 text-sm">
              <span>{product.name}</span>
              <span className="font-semibold tabular-nums">{product.price} TxGold</span>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Your TxGold handle</span>
              <input
                className="field mt-1"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@your-handle"
                autoComplete="off"
                data-testid="handle"
              />
            </label>
            {handleError && <p className="text-sm text-negative">{handleError}</p>}
            {config && (
              <p className="text-xs text-ink-soft">
                Try one of the demo's customers:{' '}
                {config.customers.map((c, i) => (
                  <span key={c.index}>
                    {i > 0 && ', '}
                    <button type="button" className="font-medium text-ink underline" onClick={() => setHandle(`@${c.handle}`)}>
                      @{c.handle}
                    </button>
                  </span>
                ))}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={!handle.trim() || flow.busy} data-testid="place-order">
                Pay with TxGold
              </Button>
              <Button variant="quiet" onClick={() => setProduct(null)}>
                Back
              </Button>
            </div>
          </form>
        ) : status === 'pending' ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-ink-soft">Order for {product.name}</p>
            <p className="text-lg font-semibold">Approve the payment in your TxGold app</p>
            <p className="text-sm">
              We sent a request for <strong>{request.amount} TxGold</strong> to {handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`}.
            </p>
            {flow.deadline && (
              <p className="text-sm text-ink-soft">
                Waiting <Countdown until={flow.deadline} />
              </p>
            )}
            <Button variant="secondary" onClick={() => void flow.cancel('The shopper cancels the order')} disabled={flow.busy}>
              Cancel order
            </Button>
          </div>
        ) : status === 'paid' ? (
          <div className="space-y-2 text-center" data-testid="order-done">
            <CheckCircle2 className="mx-auto h-12 w-12 text-positive" />
            <p className="text-lg font-semibold">Thank you, your order is confirmed</p>
            <p className="text-sm text-ink-soft">
              {product.name}, {request.amount} TxGold. Payment <span className="font-mono">{request.paymentId}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <XCircle className="mx-auto h-12 w-12 text-ink-faint" />
            <p className="text-lg font-semibold">Order not paid</p>
            <p className="text-sm text-ink-soft">The payment request is {status}.</p>
          </div>
        )
      }
      phone={
        <Phone who={request ? handle.trim().replace(/^@?/, '@') : undefined}>
          <PhoneRequest
            request={request}
            from={shop}
            busy={flow.busy}
            onApprove={() => void flow.pay()}
            onDecline={() => void flow.decline()}
              declined={flow.declined}
            waiting="Requests from shops you buy from appear here."
          />
        </Phone>
      }
    />
  );
}
