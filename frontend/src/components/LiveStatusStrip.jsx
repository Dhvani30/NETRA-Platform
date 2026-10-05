import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useAutoRefresh, REFRESH_INTERVALS } from '../lib/refresh';
import { MODE_LEGEND } from '../lib/sourceModes';
import { LastUpdated } from './ui/dataState';

const PRIMARY_SOURCES = ['telegram', 'youtube', 'facebook', 'instagram'];
const display = value => value ? String(value).replaceAll('_', ' ') : 'unknown';
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

export default function LiveStatusStrip({ summary, streamState = 'reconnecting', connected = false, realOnly, onToggle, onSources }) {
  const [health, setHealth] = useState({});
  const healthRefresh = useAutoRefresh(signal => axios.get(`${API_URL}/health/sources`, { signal }).then(result => result.data || {}), { interval: REFRESH_INTERVALS.health, key: 'source-health', onData: setHealth });
  const modes = summary?.totals_by_source_mode || {};
  const enabled = Object.entries(health).filter(([, source]) => source.mode !== 'DISABLED' && source.reason !== 'not_enabled_in_this_build');
  const anyFresh = enabled.some(([, source]) => source.live_fresh);
  const newestAge = summary?.newest_item_age_seconds;
  const hiddenSynthetic = realOnly ? (modes.SYNTH || 0) : 0;
  const transport = streamLabel(streamState, connected);

  return <div className="netra-topbar__sources flex flex-wrap items-center gap-2 text-sm justify-end">
    <span className={`pill ${anyFresh ? 'pill--live animate-pulse' : 'pill--idle'}`} title={anyFresh ? 'At least one enabled source is live and fresh' : 'No enabled source is live-fresh'}>
      {anyFresh ? 'LIVE' : 'idle'}
      {!anyFresh && <span className="font-mono"> · {ageFromSeconds(newestAge)}</span>}
    </span>
    <span className="text-slate-200" title="SSE transport">Stream: {transport}</span>
    {PRIMARY_SOURCES.map(name => {
      const source = health[name] || {};
      const fresh = Boolean(source.live_fresh);
      return <button key={name} onClick={onSources} title={`${display(source.status)} · newest ${age(source.last_item_at)}`} className={`rounded border px-2 py-1 text-left text-sm ${fresh ? 'border-emerald-500/50 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>
        <span className="capitalize font-semibold">{name}</span> <span className="font-mono">{source.mode || '—'}</span><br />
        <span>{display(source.status)} · {age(source.last_item_at)} · {source.items_last_hour ?? 0}/h</span>
        <span className={`float-right ml-2 ${fresh ? 'text-emerald-400' : 'text-slate-600'}`}><Sparkline points={source.minute_counts} /></span>
      </button>;
    })}
    <div className="flex flex-wrap gap-1" aria-label="Counts by source mode">
      {Object.entries(modes).map(([mode, count]) => (
        <span key={mode} className="pill" title={MODE_LEGEND[mode] || mode}>{mode}: {count}</span>
      ))}
    </div>
    <details className="text-sm text-slate-300">
      <summary>Mode legend</summary>
      <div className="text-left max-w-md">
        {Object.entries(MODE_LEGEND).map(([mode, text]) => <p key={mode}><strong>{mode}</strong> {text}</p>)}
      </div>
    </details>
    {hiddenSynthetic > 0 && <span className="text-sm text-slate-300">Hiding {hiddenSynthetic} synthetic records</span>}
    <label className="flex items-center gap-1 text-slate-200"><input type="checkbox" checked={realOnly} onChange={event => onToggle(event.target.checked)} /> Real data only</label>
    <LastUpdated value={healthRefresh.updatedAt} interval={REFRESH_INTERVALS.health} />
  </div>;
}
