import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, demoMode, onDemoModeChange, type DemoConfig } from './api';

/** The demo's business and customers, from /api/config (or the recorded run). Null while loading. */
export function useConfig() {
  const [config, setConfig] = useState<DemoConfig | null>(null);
  useEffect(() => {
    let live = true;
    void api.config().then((c) => {
      if (live) setConfig(c);
    });
    return () => {
      live = false;
    };
  }, []);
  return { config };
}

/** "live", or "recorded" once the Sandbox has failed to answer. */
export function useDemoMode() {
  return useSyncExternalStore(onDemoModeChange, demoMode);
}

export const businessName = (config: DemoConfig | null) =>
  config?.business.displayName ?? config?.business.accountName ?? 'Demo Coffee Co';
