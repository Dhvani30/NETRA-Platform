import { useEffect, useState } from 'react';
import axios from 'axios';
import { X, AlertCircle, Radio, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

const title = value => String(value || 'unknown').replaceAll('_', ' ');
const readable = value => title(value).replace(/\b\w/g, c => c.toUpperCase());
const waiting = source => ['READY', 'IDLE'].includes(source.status) || source.reason === 'no_content_yet';

export default function DemoChecklistDrawer({ isOpen, onClose, onNavigate }) {
  const [sources, setSources] = useState({});
  const [loading, setLoading] = useState(false);
  const loadStatus = async () => {
    setLoading(true);
    try { setSources((await axios.get(`${API_URL}/health/sources`)).data || {}); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isOpen) loadStatus().catch(() => setSources({})); }, [isOpen]);
  useEffect(() => {
    const close = event => event.key === 'Escape' && onClose();
    if (isOpen) window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const entries = Object.entries(sources).map(([id, source]) => ({ id, ...source }));
  const groups = [
    ['Live now', entries.filter(source => source.live_fresh)],
    ['Connected, waiting for content', entries.filter(source => !source.live_fresh && source.mode !== 'DISABLED' && waiting(source))],
    ['Needs attention', entries.filter(source => !source.live_fresh && source.mode !== 'DISABLED' && !waiting(source))],
    ['Not enabled in this build', entries.filter(source => source.mode === 'DISABLED' || source.reason === 'not_enabled_in_this_build')],
  ];
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" role="presentation">
    <section className="w-full max-w-xl h-full bg-[#0c0e22] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="source-drawer-title">
      <header className="p-5 border-b border-white/10 flex items-center justify-between"><div><h2 id="source-drawer-title" className="font-semibold text-white text-base">Source status</h2><p className="text-xs text-slate-400 mt-1">Live collector state from the API; no inferred datasets or demo sources.</p></div><div className="flex gap-2"><button onClick={() => loadStatus().catch(() => {})} disabled={loading} className="p-2 text-slate-300" aria-label="Refresh source status"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button><button onClick={onClose} className="p-2 text-slate-300" aria-label="Close"><X className="w-5 h-5" /></button></div></header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">{!entries.length && <p className="text-sm text-slate-400">Source status is unavailable. Check the API connection and refresh.</p>}{groups.map(([label, group]) => group.length > 0 && <section key={label} className="space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">{label} ({group.length})</h3>{group.map(source => <article key={source.id} className="p-3 rounded-lg bg-white/[.03] border border-white/10"><div className="flex items-center justify-between gap-2"><span className="text-sm text-white flex items-center gap-2">{source.live_fresh ? <Radio className="w-3.5 h-3.5 text-emerald-400" /> : <AlertCircle className="w-3.5 h-3.5 text-slate-400" />}{readable(source.id)}</span><span className="pill text-[10px]">{source.mode || 'unknown'} · {title(source.status)}</span></div><p className="text-xs text-slate-400 mt-2">{source.message || source.reason || 'No additional status detail was reported.'}</p>{source.reason && <p className="text-[10px] text-amber-200 mt-1">Reason: {title(source.reason)}</p>}</article>)}</section>)}</div>
      <footer className="p-4 border-t border-white/10"><button onClick={() => { onClose(); onNavigate?.('live_feed'); }} className="pill">Open live feed</button></footer>
    </section>
  </div>;
}
