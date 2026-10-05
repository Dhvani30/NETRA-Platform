import { useEffect, useState } from 'react';
import axios from 'axios';
import { canonicalSourceMode, MODE_LEGEND } from '../../lib/sourceModes';
import { sourceArrivalReason } from '../../lib/emptyReason.js';
import { API_URL } from '../../config';

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
export function EmptyState({ children = 'No data yet.' }) { return <div className="space-y-3"><div className="glass p-6 text-center text-sm text-slate-400">{children}</div><WhyNothingArriving /></div>; }
export function ErrorState({ error, onRetry }) { return <div className="glass p-4 text-sm text-amber-200">Offline — {error?.message || 'Unable to refresh.'} {onRetry && <button className="pill ml-2" onClick={onRetry}>Retry</button>}</div>; }
export function Skeleton({ className = '' }) { return <div aria-label="Loading" className={`animate-pulse rounded bg-slate-700/40 ${className}`} />; }
export function ModeBadge({ mode }) { const value = canonicalSourceMode(mode); return <span className={`pill text-[10px] pill--${value.toLowerCase().replaceAll('_', '-')}`} title={MODE_LEGEND[value]}>{value}</span>; }
export function LastUpdated({ value, interval = 0, imported = false }) { return <span className="text-[10px] text-slate-500">{imported ? 'Static dataset — no auto-refresh' : value ? `Last updated ${new Date(value).toLocaleTimeString()}${interval ? ` (auto every ${Math.round(interval / 1000)}s)` : ''}` : 'No data yet'}</span>; }
export function ConnectionStatus({ state = 'Connecting', interval, lastUpdated }) { const label = state === 'connected' ? 'Connected (Push SSE)' : state === 'polling' ? `Polling ${Math.round((interval || 0) / 1000)}s` : state === 'offline' ? `Offline (showing data from ${lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'})` : 'Connecting'; return <span className="text-[11px] text-slate-300" title="Connection transport, separate from data freshness">{label}</span>; }
