import { useEffect, useState } from 'react';

/** "1:41", ticking each second, until `until` (ms since epoch); `done` at zero. */
export function Countdown({ until, done = 'Time is up' }: { until: number; done?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(0, Math.round((until - now) / 1000));
  if (seconds === 0) return <span>{done}</span>;
  return (
    <span className="tabular-nums">
      {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}
