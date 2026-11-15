import { useEffect, useState } from 'react';
import { api, type DemoConfig } from './api';

/** The demo's business and customers, from /api/config. Null while loading or if unreachable. */
export function useConfig() {
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void api.config().then((c) => {
      if (!live) return;
      setConfig(c);
      setFailed(c === null);
    });
    return () => {
      live = false;
    };
  }, []);
  return { config, failed };
}

export const businessName = (config: DemoConfig | null) =>
  config?.business.displayName ?? config?.business.accountName ?? 'Demo Coffee Co';
