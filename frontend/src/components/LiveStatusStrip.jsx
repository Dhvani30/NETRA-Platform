import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
import { useAutoRefresh, REFRESH_INTERVALS } from '../lib/refresh';
import { ConnectionStatus, LastUpdated, ModeBadge } from './ui/dataState';

const PRIMARY_SOURCES = ['telegram', 'youtube', 'facebook', 'instagram'];
const display = value => value ? value.replaceAll('_', ' ') : 'unknown';
const age = value => { if (!value) return 'no items'; const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); return seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`; };
function Sparkline({ points = [] }) { const max = Math.max(1, ...points.map(point => point.count || 0)); const values = points.map((point, index) => `${index * (100 / Math.max(1, points.length - 1))},${24 - ((point.count || 0) / max) * 22}`).join(' '); return <svg aria-label="Items per minute for the last hour" viewBox="0 0 100 24" className="w-20 h-5"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={values || '0,24 100,24'} /></svg>; }

export default function LiveStatusStrip({ summary, connected, streamState = 'reconnecting', realOnly, onToggle, onSources }) {
  const [health, setHealth] = useState({});
  const healthRefresh = useAutoRefresh(signal => axios.get(`${API_URL}/health/sources`, { signal }).then(result => result.data || {}), { interval: REFRESH_INTERVALS.health, key: 'source-health', onData: setHealth });
  const modes = summary?.totals_by_source_mode || {};
  const disabled = Object.entries(health).filter(([name, source]) => !PRIMARY_SOURCES.includes(name) && (source.mode === 'DISABLED' || source.reason === 'not_enabled_in_this_build'));
  return <div className="flex flex-wrap items-center gap-2 text-[11px] max-w-[900px] justify-end">
    {PRIMARY_SOURCES.map(name => { const source = health[name] || {}; const fresh = Boolean(source.live_fresh); return <button key={name} onClick={onSources} title={`${display(source.status)} · newest ${age(source.last_item_at)}`} className={`rounded border px-2 py-1 text-left ${fresh ? 'border-emerald-500/50 text-emerald-200 animate-pulse' : 'border-slate-700 text-slate-400'}`}><span className="capitalize font-semibold">{name}</span> <span className="font-mono">{source.mode || '—'}</span><br /><span>{display(source.status)} · {age(source.last_item_at)} · {source.items_last_hour ?? 0}/h</span><span className={`float-right ml-2 ${fresh ? 'text-emerald-400' : 'text-slate-600'}`}><Sparkline points={source.minute_counts} /></span></button>; })}
    <ConnectionStatus state={connected ? 'connected' : streamState === 'polling' ? 'polling' : healthRefresh.offline ? 'offline' : 'connecting'} interval={REFRESH_INTERVALS.events} lastUpdated={healthRefresh.updatedAt} />
    {Object.entries(modes).filter(([, count]) => count > 0).map(([mode, count]) => <span key={mode}><ModeBadge mode={mode} /> {count}</span>)}
    <label className="flex items-center gap-1 text-slate-200"><input type="checkbox" checked={realOnly} onChange={event => onToggle(event.target.checked)} /> Real data only</label>
    {disabled.length > 0 && <details className="text-slate-500"><summary>Not enabled in this build ({disabled.length})</summary><span>{disabled.map(([name]) => display(name)).join(', ')}</span></details>}
    <LastUpdated value={healthRefresh.updatedAt} interval={REFRESH_INTERVALS.health} />
  </div>;
}
