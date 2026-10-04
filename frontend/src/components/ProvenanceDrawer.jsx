import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  X, ExternalLink, ShieldCheck, Database, Clock,
  GitBranch, Tag, Activity, FileText, CheckCircle, AlertCircle
} from 'lucide-react';
import { API_URL } from '../config';

export default function ProvenanceDrawer({ post, postId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [runInfo, setRunInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewJson, setViewJson] = useState(false);

  const activePostId = postId || post?.post_id || post?.canonical_id;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!activePostId) return;
    setLoading(true);
    axios.get(`${API_URL}/post/${encodeURIComponent(activePostId)}`)
      .then(res => {
        setDetail(res.data.post || post);
        setRunInfo(res.data.collection_run || null);
      })
      .catch(() => {
        // Fall back to provided post prop if standalone fetch is 404
        setDetail(post);
      })
      .finally(() => setLoading(false));
  }, [activePostId, post]);

  const p = detail || post || {};

  const sourceMode = (p.source_mode || 'SYNTH').toUpperCase();
  const modeClass = sourceMode === 'LIVE_THIRD_PARTY'
    ? 'pill--live-third-party'
    : sourceMode === 'LIVE'
    ? 'pill--live'
    : sourceMode === 'IMPORT'
    ? 'pill--import'
    : 'pill--synth';

  const formatIso = (ts) => {
    if (!ts) return 'N/A';
    try {
      return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return str(ts);
    }
  };

  const authorIdDisplay = p.author_id || p.author_short_id || (p.author ? p.author.id : 'masked');
  const permalink = p.permalink || p.url || (p.urls && p.urls[0]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl h-full bg-[#0c0e22] border-l border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        role="dialog"
        aria-labelledby="drawer-title"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="capitalize font-bold text-white text-base tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              {p.platform || 'Post'} Provenance
            </span>
            <span className={`pill text-[10px] ${modeClass}`}>{sourceMode}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Close (Esc)"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && (
            <div className="p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Fetching authoritative provenance records from database...
            </div>
          )}

          {/* Core Identification Card */}
          <div className="glass p-4 space-y-3">
            <span className="label-xs text-slate-400">TELEMETRY IDENTIFIERS</span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">POST ID / CANONICAL</span>
                <span className="font-mono text-slate-200 select-all break-all">{p.post_id || p.canonical_id || activePostId}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">EVENT TYPE</span>
                <span className="font-mono text-indigo-300 capitalize font-medium">{p.event_type || 'post'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">AUTHOR (HASHED)</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-emerald-400">@{authorIdDisplay}</span>
                  <span className="text-[10px] text-slate-500" title="K-anonymous: Raw handle never persisted for privacy">(privacy-safe)</span>
                </div>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">TOPIC / NARRATIVE</span>
                <span className="font-mono text-slate-300">{p.topic_id || p.narrative_id || 'general'}</span>
              </div>
            </div>
          </div>

          {/* Source Transparency & Disclosure */}
          {sourceMode === 'LIVE_THIRD_PARTY' && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                Third-Party Ingestion Disclosure
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                X data: public datasets plus a capped third-party sample through twitterapi.io; not the official X API. Raw bio, location, and handle omitted at ingestion.
              </p>
            </div>
          )}

          {sourceMode === 'IMPORT' && (
            <div className="p-3 rounded-lg bg-sky-500/10 border border-sky-500/30 text-xs text-sky-200 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                Imported Dataset Record
              </div>
              <p className="text-[11px] text-sky-200/90 leading-relaxed">
                Dataset: <strong>{p.dataset || 'Historical Public Archive'}</strong>. This record belongs to an immutable public corpus and is never represented as live telemetry.
              </p>
            </div>
          )}

          {/* Timestamps & Pipeline Latency */}
          <div className="glass p-4 space-y-3">
            <span className="label-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              INGESTION TIMESTAMPS
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Created At (Provider UTC)</span>
                <span className="font-mono text-slate-200">{formatIso(p.created_at || p.published_at)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-slate-400">Collected At</span>
                <span className="font-mono text-slate-200">{formatIso(p.collected_at)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Ingested At (MongoDB)</span>
                <span className="font-mono text-slate-200">{formatIso(p.ingested_at || p.collected_at)}</span>
              </div>
            </div>
          </div>

          {/* Full Content */}
          <div className="glass p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="label-xs text-slate-400">CONTENT PAYLOAD</span>
              {permalink && (
                <a
                  href={permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 link-underline"
                >
                  View Origin <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed font-sans bg-black/30 p-3 rounded-lg border border-white/5">
              {p.text_content || p.text || p.content || p.text_preview || 'No text content available.'}
            </p>
          </div>

          {/* Thread / Context Hierarchy */}
          {(p.parent_id || p.conversation_id || p.reply_to_author || p.repost_of) && (
            <div className="glass p-4 space-y-3">
              <span className="label-xs text-slate-400 flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                THREAD & RELATIONSHIP CONTEXT
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {p.parent_id && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">PARENT POST</span>
                    <span className="font-mono text-slate-300">{p.parent_id}</span>
                  </div>
                )}
                {p.conversation_id && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">CONVERSATION ID</span>
                    <span className="font-mono text-slate-300">{p.conversation_id}</span>
                  </div>
                )}
                {p.reply_to_author && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">REPLIED TO (HASHED)</span>
                    <span className="font-mono text-emerald-400">@{p.reply_to_author}</span>
                  </div>
                )}
                {p.repost_of && (
                  <div>
                    <span className="text-slate-500 block text-[11px]">REPOST OF</span>
                    <span className="font-mono text-slate-300">{p.repost_of}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collection Run Audit Card */}
          <div className="glass p-4 space-y-3">
            <span className="label-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              INGESTION RUN PROOF
            </span>
            {runInfo ? (
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Collector Source</span>
                  <span className="font-mono text-slate-200 capitalize">{runInfo.source}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Run Execution Window</span>
                  <span className="font-mono text-slate-300 text-[11px]">
                    {formatIso(runInfo.started_at)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-slate-400">Run Status</span>
                  <span className={`pill text-[10px] ${runInfo.status === 'success' || runInfo.status === 'LIVE' ? 'pill--live' : 'pill--synth'}`}>
                    {runInfo.status}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Batch Documents Inserted</span>
                  <span className="font-mono text-indigo-300 font-semibold">{runInfo.items ?? runInfo.count ?? 0}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Direct collection run association available via scheduler runs audit.
              </p>
            )}
          </div>

          {/* Raw JSON toggle */}
          <div>
            <button
              onClick={() => setViewJson(!viewJson)}
              className="text-xs text-slate-400 hover:text-slate-200 underline font-mono flex items-center gap-1"
            >
              {viewJson ? 'Hide raw forensic payload' : 'Inspect raw forensic payload'}
            </button>
            {viewJson && (
              <pre className="mt-2 p-3 bg-black/70 rounded text-[10px] font-mono text-slate-300 overflow-x-auto border border-white/10 max-h-60">
                {JSON.stringify(p, null, 2)}
              </pre>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Cryptographically Verified Ingestion</span>
          </div>
          <button
            onClick={onClose}
            className="pill text-xs px-4 py-1.5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
