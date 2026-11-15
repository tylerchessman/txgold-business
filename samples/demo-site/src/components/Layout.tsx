import { Link, Outlet } from 'react-router-dom';
import logo from '@/assets/brand/txgold-logo.png';
import { GUIDE_URL } from '@/lib/steps';

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg font-semibold">
              TxGold <span className="font-normal text-ink-soft">Demo</span>
            </span>
          </Link>
          <span className="rounded-full bg-warning-ground px-2.5 py-0.5 text-xs font-medium text-warning" title="Every payment here uses test TxGold in the Sandbox">
            Sandbox: test TxGold only
          </span>
          <nav className="ml-auto flex gap-4 text-sm text-ink-soft">
            <a className="hover:text-ink" href={GUIDE_URL}>Guide</a>
            <a className="hover:text-ink" href="https://docs.txgold.money">API docs</a>
            <a className="hover:text-ink" href="https://business.txgold.money">Business portal</a>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line py-4 text-center text-xs text-ink-faint">
        The payments on this site are real API calls to the TxGold Sandbox, with test TxGold. Only
        the customer's tap in the TxGold app is simulated.
      </footer>
    </div>
  );
}
