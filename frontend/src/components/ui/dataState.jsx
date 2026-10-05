import { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { canonicalSourceMode, MODE_LEGEND } from '../../lib/sourceModes';
import { sourceArrivalReason } from '../../lib/emptyReason.js';
import { API_UNREACHABLE, API_URL } from '../../config';
import { pingBackend } from '../../lib/apiHealth';

export { pingBackend };

// The layout owns backend availability. Local views still retry in the
// background, but do not repeat the same unavailable-backend banner.
const BackendOfflineContext = createContext(false);
export function BackendConnectivityProvider({ offline = false, children }) {
  return <BackendOfflineContext.Provider value={offline}>{children}</BackendOfflineContext.Provider>;
}

function bannerMessage(error) {
  const message = error?.message || '';
  if (!message || message.startsWith("Can't reach the NETRA API")) return API_UNREACHABLE;
  return message;
}

export function WhyNothingArriving({ sources: provided }) {
  const [sources, setSources] = useState(provided || null);
  useEffect(() => {
    if (provided) { setSources(provided); return undefined; }
    let cancelled = false;
    axios.get(`${API_URL}/health/sources`).then(result => { if (!cancelled) setSources(result.data || {}); }).catch(() => { if (!cancelled) setSources({}); });
    return () => { cancelled = true; };
  }, [provided]);
  const active = Object.entries(sources || {}).filter(([, source]) => source.mode !== 'DISABLED' && source.reason !== 'not_enabled_in_this_build');
  return <section className="glass p-4 text-sm text-slate-200">
    <h3 className="text-white font-medium mb-2">Why is nothing arriving?</h3>
    {!sources && <p>Loading source status.</p>}
    {sources && active.length === 0 && <p>No enabled source status has been reported.</p>}
    {active.length > 0 && <ul className="space-y-1">{active.map(([name, source]) => <li key={name}>{sourceArrivalReason(name, source)}</li>)}</ul>}
  </section>;
}
export function EmptyState({ children = 'The API returned no rows for this view.' }) {
  return <div className="space-y-3"><p className="text-sm text-slate-400">{children}</p><WhyNothingArriving /></div>;
}
export function ErrorState({ error, onRetry, autoRetryMs = 10000, global = false }) {
  const backendOffline = useContext(BackendOfflineContext);
  const retryRef = useRef(onRetry);
  const busy = useRef(false);
  const attemptRef = useRef(async () => {});
  const [checking, setChecking] = useState(false);
  retryRef.current = onRetry;
  attemptRef.current = async () => {
    if (busy.current || document.hidden) return;
    busy.current = true;
    setChecking(true);
    try {
      const online = await pingBackend();
      if (online) await retryRef.current?.();
    } finally {
      busy.current = false;
      setChecking(false);
    }
  };
  useEffect(() => {
    if (!autoRetryMs) return undefined;
    const timer = setInterval(() => { attemptRef.current(); }, autoRetryMs);
    return () => clearInterval(timer);
  }, [autoRetryMs]);
  // Keep this component mounted while hidden: its retry loop clears local view
  // state as soon as the global backend check succeeds.
  if (backendOffline && !global) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
      <span>{bannerMessage(error)}</span>
      {onRetry && <button type="button" className="pill" onClick={() => attemptRef.current()} disabled={checking}>Retry</button>}
      {onRetry && autoRetryMs > 0 && <span className="text-xs text-amber-200/80">{checking ? 'Checking port 8000…' : `Retrying every ${Math.round(autoRetryMs / 1000)}s`}</span>}
    </div>
  );
}
export function Skeleton({ className = '' }) { return <div className={`animate-pulse rounded bg-white/10 ${className}`} />; }
export function ScreenSkeleton({ cards = 3 }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} className="glass space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
export function InlineSpinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-slate-500 border-t-slate-200" role="status" aria-label="Loading" />;
}
export function ModeBadge({ mode }) { const value = canonicalSourceMode(mode); return <span className={`pill text-[10px] pill--${value.toLowerCase().replaceAll('_', '-')}`} title={MODE_LEGEND[value]}>{value}</span>; }
export function LastUpdated({ value, interval = 0, imported = false }) { return <span className="text-[10px] text-slate-500">{imported ? 'Static dataset — no auto-refresh' : value ? `Last updated ${new Date(value).toLocaleTimeString()}${interval ? ` (auto every ${Math.round(interval / 1000)}s)` : ''}` : 'No data yet'}</span>; }
export function ConnectionStatus({ state = 'Connecting', interval, lastUpdated }) { const label = state === 'connected' ? 'Connected (Push SSE)' : state === 'polling' ? `Polling ${Math.round((interval || 0) / 1000)}s` : state === 'offline' ? `Offline (showing data from ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'})` : 'Connecting'; return <span className="text-[11px] text-slate-300" title="Connection transport, separate from data freshness">{label}</span>; }
