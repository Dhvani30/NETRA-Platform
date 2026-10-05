import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { MODE_LEGEND } from '../lib/sourceModes';
import { LastUpdated } from './ui/dataState';
import { StatusBadge } from './ui/primitives';

const display = value => value ? String(value).replaceAll('_', ' ') : 'unknown';
const isDisabled = source => source?.mode === 'DISABLED' || source?.reason === 'not_enabled_in_this_build';
const nextRun = source => {
  if (!source?.next_run_at) return null;
  const diff = new Date(source.next_run_at).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return 'next run due';
  const seconds = Math.round(diff / 1000);
  return seconds < 60 ? `next run ${seconds}s` : `next run ${Math.ceil(seconds / 60)}m`;
};
const sparklinePoints = (summary, name, source) => {
  const series = summary?.ingest_rate_per_minute;
  if (Array.isArray(series) && series.some(point => Object.prototype.hasOwnProperty.call(point, name))) {
    return series.map(point => ({ count: Number(point[name]) || 0 }));
  }
  return Array.isArray(source?.minute_counts) ? source.minute_counts : [];
};
const ageFromSeconds = seconds => {
  if (seconds == null || Number.isNaN(Number(seconds))) return 'no items';
  const value = Math.max(0, Math.floor(Number(seconds)));
  return value < 60 ? `${value}s` : value < 3600 ? `${Math.floor(value / 60)}m` : `${Math.floor(value / 3600)}h`;
};
const age = value => {
  if (!value) return 'no items';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  return ageFromSeconds(seconds);
};

function Sparkline({ points = [] }) {
  const max = Math.max(1, ...points.map(point => point.count || 0));
  const values = points.map((point, index) => `${index * (100 / Math.max(1, points.length - 1))},${24 - ((point.count || 0) / max) * 22}`).join(' ');
  return <svg aria-label="Items per minute for the last hour" viewBox="0 0 100 24" className="w-20 h-5"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={values || '0,24 100,24'} /></svg>;
}

function streamLabel(streamState, connected) {
  if (streamState === 'connected' || connected) return 'connected';
  if (streamState === 'polling') return 'polling-fallback';
  return 'reconnecting';
}

function badgeFor(source) {
  if (source?.mode === 'DISABLED') return 'DISABLED';
  if (source?.status === 'ERROR') return 'ERROR';
  if (source?.mode === 'SYNTH') return 'SYNTH';
  if (source?.live_fresh) return 'LIVE';
  return 'IDLE';
}

export default function LiveStatusStrip({ summary, streamState = 'reconnecting', connected = false, realOnly, onToggle, onSources }) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState({});
  const [healthError, setHealthError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    let cancelled = false;
    axios.get(`${API_URL}/health/sources`)
      .then(result => { if (!cancelled) { setHealth(result.data || {}); setHealthError(false); setUpdatedAt(new Date()); } })
      .catch(() => { if (!cancelled) setHealthError(true); });
    return () => { cancelled = true; };
  }, []);
  const modes = summary?.totals_by_source_mode || {};
  const entries = Object.entries(health);
  const enabled = entries.filter(([, source]) => !isDisabled(source));
  const disabled = entries.filter(([, source]) => isDisabled(source));
  const anyFresh = enabled.some(([, source]) => source.live_fresh);
  const newestAge = summary?.newest_item_age_seconds;
  const hiddenSynthetic = realOnly ? (modes.SYNTH || 0) : 0;
  const backendOffline = streamState === 'offline' || healthError;
  const transport = streamLabel(streamState, connected);
  const master = anyFresh ? `LIVE · ${transport}` : `IDLE · ${ageFromSeconds(newestAge)} · ${transport}`;

  useEffect(() => {
    if (!open) return undefined;
    const close = event => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  return <>
    {backendOffline && (
      <div role="status" className="mr-2 hidden items-center gap-2 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs text-amber-100 xl:flex">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
        <span>FastAPI offline — checking port 8000 every 10s</span>
      </div>
    )}
    <StatusBadge status={anyFresh ? 'LIVE' : 'IDLE'} fresh={anyFresh} className="netra-telemetry-pill" title={anyFresh ? 'At least one enabled source is live and fresh' : 'No enabled source is live-fresh'}>
      {master}
    </StatusBadge>
    <button type="button" className="pill" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="collector-drawer">
      Collectors
    </button>
    {open && (
      <div className="netra-collectors" role="presentation" onClick={() => setOpen(false)}>
        <section id="collector-drawer" className="netra-collectors__panel" role="dialog" aria-modal="true" aria-labelledby="collector-drawer-title" onClick={event => event.stopPropagation()}>
          <header className="flex items-center justify-between gap-3">
            <h2 id="collector-drawer-title" className="text-base text-white">Collectors</h2>
            <button type="button" className="pill" onClick={() => setOpen(false)}>Close</button>
          </header>
          <p className="text-sm text-slate-400 mt-2">Status, age, and hourly counts from the API. {hiddenSynthetic > 0 ? `Hiding ${hiddenSynthetic} synthetic records.` : ''}</p>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
            <input type="checkbox" checked={realOnly} onChange={event => onToggle(event.target.checked)} /> Real data only
          </label>
          {entries.length === 0 && <p className="text-sm text-slate-400 mt-4">Waiting for source status from the API.</p>}
          <div className="mt-4">
            {enabled.map(([name, source]) => {
              const countdown = nextRun(source);
              return <button key={name} type="button" className="netra-collectors__chip" onClick={() => { setOpen(false); onSources(); }}>
                <span>
                  <span className="capitalize font-semibold">{display(name)}</span>{' '}
                  <StatusBadge status={badgeFor(source)}>{source.mode || 'unknown'}</StatusBadge>
                  <span className="block text-sm text-slate-300 mt-1">{display(source.status)} · {age(source.last_item_at)} · {source.items_last_hour ?? 0}/h{countdown ? ` · ${countdown}` : ''}</span>
                </span>
                <Sparkline points={sparklinePoints(summary, name, source)} />
              </button>;
            })}
          </div>
          {disabled.length > 0 && <details className="mt-4 text-sm text-slate-400">
            <summary>Not enabled in this build ({disabled.length})</summary>
            <ul className="mt-2 space-y-1">
              {disabled.map(([name, source]) => <li key={name} className="capitalize">{display(name)} · {source.status || 'DISABLED'} · {display(source.reason || source.message || 'not enabled')}</li>)}
            </ul>
          </details>}
          <div className="mt-4 flex flex-wrap gap-1" aria-label="Counts by source mode">
            {Object.entries(modes).map(([mode, count]) => (
              <span key={mode} className="pill" title={MODE_LEGEND[mode] || mode}>{mode}: {count}</span>
            ))}
          </div>
          <details className="mt-3 text-sm text-slate-300">
            <summary>Mode legend</summary>
            <div className="mt-2 space-y-1">
              {Object.entries(MODE_LEGEND).map(([mode, text]) => <p key={mode}><strong>{mode}</strong> {text}</p>)}
            </div>
          </details>
          <p className="mt-4"><LastUpdated value={updatedAt} /></p>
        </section>
      </div>
    )}
  </>;
}
