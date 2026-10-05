import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';
import {
  Activity, Play, Pause, ExternalLink, RefreshCw, Clock, Filter,
  AlertCircle, CheckCircle2, ChevronRight, BarChart3, ListFilter
} from 'lucide-react';

import { useLiveStream } from '../hooks/useLiveStream';
import {
  addEventToFeed,
  addEventsBatchToFeed,
  formatIngestedAgo,
  formatLatency,
  getSourceModeClass,
  MAX_LIVE_FEED_ITEMS
} from '../utils/liveFeedReducer';
import { API_URL } from '../config';
import { WhyNothingArriving } from './ui/dataState';
import { sourceArrivalReason } from '../lib/emptyReason.js';

const STATUS_HELP = {
  LIVE: 'Collecting continuously from authorized provider connection.',
  IMPORT: 'Serving verified historical dataset; not live telemetry.',
  READY: 'Connector configured and ready for scheduled polling.',
  CREDENTIALS_REQUIRED: 'Add required connector API token/secret to .env.',
  PERMISSION_REQUIRED: 'Grant required provider permissions.',
  RATE_LIMITED: 'Provider rate limit reached; retry scheduled.',
  NO_CREDITS: 'Provider credit allowance exhausted.',
  DEGRADED: 'Temporary network or upstream glitch; retry scheduled.',
  DISABLED: 'Collection connector explicitly disabled.',
  ERROR: 'Collector error encountered; review error message.',
  IDLE: 'Collector idle; waiting for scheduled execution cycle.',
};

const PLATFORM_THEMES = {
  telegram: { label: 'Telegram', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.25)' },
  youtube: { label: 'YouTube', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' },
  x: { label: 'X (Twitter)', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.25)' },
  reddit: { label: 'Reddit', color: '#f97316', bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.25)' },
  facebook: { label: 'Facebook', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)' },
  instagram: { label: 'Instagram', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.25)' },
  mastodon: { label: 'Mastodon', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.25)' },
  bluesky: { label: 'Bluesky', color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.25)' },
};

export default function LiveFeedView({ onSelectPost, realOnly = true, refreshKey = 0 }) {
  // Feed state
  const [feedItems, setFeedItems] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [buffer, setBuffer] = useState([]);
  const [platformFilter, setPlatformFilter] = useState('');
  const [sourceModeFilter, setSourceModeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'proof'

  // Proof panel state
  const [summaryData, setSummaryData] = useState(null);
  const [sourcesData, setSourcesData] = useState({});
  const [runsData, setRunsData] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [nowTs, setNowTs] = useState(Date.now());

  // Second ticker to update "ingested Ns ago" continuously
  useEffect(() => {
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle incoming live event
  const handleIncomingEvent = useCallback((events) => {
    const incoming = Array.isArray(events) ? events : [events];
    if (!incoming.length) return;
    if (isPaused) {
      setBuffer(prev => [...incoming, ...prev].slice(0, MAX_LIVE_FEED_ITEMS));
    } else {
      setFeedItems(prev => addEventsBatchToFeed(prev, incoming, MAX_LIVE_FEED_ITEMS));
    }
  }, [isPaused]);

  // Hook connects to SSE stream with polling fallback
  const { connected: isStreamConnected, state: streamState } = useLiveStream(handleIncomingEvent);

  // Initial load of latest 50 events from REST
  useEffect(() => {
    axios.get(`${API_URL}/events/latest?limit=50`)
      .then(res => {
        if (res.data?.events) {
          setFeedItems(prev => addEventsBatchToFeed(prev, res.data.events, MAX_LIVE_FEED_ITEMS));
        }
      })
      .catch(() => {});
  }, []);

  // Fetch summary and runs for proof panel
  const fetchProofData = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const [sumRes, srcRes, runRes] = await Promise.all([
        axios.get(`${API_URL}/live/summary`),
        axios.get(`${API_URL}/health/sources`),
        axios.get(`${API_URL}/live/runs?limit=15`)
      ]);
      setSummaryData(sumRes.data || null);
      setSourcesData(srcRes.data || {});
      setRunsData(runRes.data?.runs || []);
    } catch (err) {
      console.error('Error fetching live proof:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Initial proof snapshot. Later refresh keys update proof data without replacing the feed list.
  useEffect(() => {
    fetchProofData();
  }, [fetchProofData, refreshKey]);

  const syncFeed = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const [eventsRes, sumRes, srcRes, runRes] = await Promise.all([
        axios.get(`${API_URL}/events/latest?limit=50`),
        axios.get(`${API_URL}/live/summary`),
        axios.get(`${API_URL}/health/sources`),
        axios.get(`${API_URL}/live/runs?limit=15`)
      ]);
      if (eventsRes.data?.events) {
        setFeedItems(prev => addEventsBatchToFeed(prev, eventsRes.data.events, MAX_LIVE_FEED_ITEMS));
      }
      setSummaryData(sumRes.data || null);
      setSourcesData(srcRes.data || {});
      setRunsData(runRes.data?.runs || []);
    } catch (err) {
      console.error('Error syncing live feed:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  // Pause / Resume handler
  const togglePause = () => {
    if (isPaused) {
      // Flush buffered items
      if (buffer.length > 0) {
        setFeedItems(prev => addEventsBatchToFeed(prev, buffer, MAX_LIVE_FEED_ITEMS));
        setBuffer([]);
      }
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  // Filtered rows for the feed
  const filteredFeed = feedItems.filter(item => {
    const mode = (item.source_mode || 'SYNTH').toUpperCase();
    if (!['LIVE', 'LIVE_THIRD_PARTY'].includes(mode)) return false;
    if (platformFilter && item.platform?.toLowerCase() !== platformFilter.toLowerCase()) return false;
    if (sourceModeFilter && (item.source_mode || 'SYNTH').toUpperCase() !== sourceModeFilter.toUpperCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const text = (item.text_preview || item.text_content || item.text || '').toLowerCase();
      const author = String(item.author_short_id || item.author_id || '').toLowerCase();
      if (!text.includes(q) && !author.includes(q)) return false;
    }
    return true;
  });

  const getPlatformTheme = (p) => {
    const key = (p || '').toLowerCase();
    return PLATFORM_THEMES[key] || { label: p || 'Unknown', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.25)' };
  };

  const getNextRunDisplay = (_srcName, srcInfo) => {
    if (!srcInfo?.next_run_at) return 'Not scheduled';
    const diff = new Date(srcInfo.next_run_at).getTime() - nowTs;
    if (Number.isNaN(diff)) return 'Not scheduled';
    if (diff > 0) return `in ${Math.round(diff / 1000)}s`;
    return 'due';
  };

  // Stacked chart data formatting
  const chartData = (summaryData?.ingest_rate_per_minute || []).map(pt => {
    const d = new Date(pt.minute);
    const timeLabel = isNaN(d.getTime()) ? pt.minute : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { ...pt, displayTime: timeLabel };
  });

  const chartPlatforms = summaryData?.platforms || [];

  return (
    <div className="space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-light text-white tracking-wide">
              Live <span className="text-indigo-300 font-normal">Telemetry Stream</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className={`pill text-[11px] flex items-center gap-1.5 ${isStreamConnected ? 'pill--live' : 'pill--synth'}`}>
                <span className={`w-2 h-2 rounded-full ${isStreamConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                {isStreamConnected ? 'STREAM ACTIVE' : 'RECONNECTING'}
              </span>
              {isPaused && (
                <span className="pill text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  PAUSED ({buffer.length} queued)
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Zero simulated animation: every row represents an authoritative database insertion. Maximum 200 items in memory.
          </p>
        </div>

        {/* View Switcher & Action Buttons */}
        <div className="flex items-center gap-2">
          <div className="bg-black/40 border border-white/10 p-0.5 rounded-lg flex items-center">
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'feed' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              Live Feed ({feedItems.length})
            </button>
            <button
              onClick={() => setActiveTab('proof')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${activeTab === 'proof' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Pipeline Proof Panel
            </button>
          </div>

          <button
            onClick={togglePause}
            className={`pill text-xs flex items-center gap-1.5 px-3 py-1.5 transition-colors ${isPaused ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            title={isPaused ? "Resume live stream" : "Pause feed updates"}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={syncFeed}
            disabled={loadingSummary}
            className="pill text-xs flex items-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white"
            title="Sync feed and refresh telemetry freshness"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            Sync feed
          </button>
        </div>
      </div>

      {/* Proof Summary Cards Row (Always visible or compact) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass p-3.5">
          <span className="label-xs text-slate-400">INGESTION WINDOW (5 MIN)</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-mono font-bold text-white">
              {Object.values(summaryData?.counts?.['5m'] || {}).reduce((a, b) => a + b, 0)}
            </span>
            <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
              <Activity className="w-3 h-3" /> {summaryData?.newest_item_age_seconds != null && summaryData.newest_item_age_seconds <= 300 ? 'fresh' : 'collected'}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 font-mono">
            1h: {Object.values(summaryData?.counts?.['1h'] || {}).reduce((a, b) => a + b, 0)} · 24h: {Object.values(summaryData?.counts?.['24h'] || {}).reduce((a, b) => a + b, 0)}
          </div>
        </div>

        <div className="glass p-3.5">
          <span className="label-xs text-slate-400">TELEMETRY FRESHNESS</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-mono font-bold text-emerald-400">
              {summaryData?.newest_item_age_seconds != null ? `${summaryData.newest_item_age_seconds}s` : 'N/A'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">newest item</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Manual refresh — use Sync feed
          </div>
        </div>

        <div className="glass p-3.5">
          <span className="label-xs text-slate-400">SOURCE MODES</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Object.entries(summaryData?.totals_by_source_mode || {}).map(([mode, count]) => (
              <span key={mode} className={`pill text-[9px] px-1.5 py-0.5 ${getSourceModeClass(mode)}`}>
                {mode}: <strong className="ml-1 font-mono">{count}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="glass p-3.5">
          <span className="label-xs text-slate-400">PIPELINE AUDIT</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-mono font-bold text-indigo-300">
              {runsData.length}
            </span>
            <span className="text-[10px] font-mono text-slate-400">recent runs</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            Last run: {runsData[0]?.source || 'None'} ({runsData[0]?.status || 'idle'})
          </div>
        </div>
      </div>

      {/* TAB 1: LIVE FEED STREAM */}
      {activeTab === 'feed' && (
        <div className="space-y-4">
          {/* Feed Filter Bar */}
          <div className="glass p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              <select
                className="ds-input text-xs py-1 px-2"
                value={platformFilter}
                onChange={e => setPlatformFilter(e.target.value)}
              >
                <option value="">All Platforms</option>
                {Object.entries(sourcesData).filter(([, source]) => source.mode !== 'DISABLED' && source.reason !== 'not_enabled_in_this_build').map(([name]) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              <select
                className="ds-input text-xs py-1 px-2"
                value={sourceModeFilter}
                onChange={e => setSourceModeFilter(e.target.value)}
              >
                <option value="">All Modes</option>
                <option value="LIVE">LIVE</option>
                <option value="LIVE_THIRD_PARTY">LIVE_THIRD_PARTY</option>
                <option value="IMPORT">IMPORT</option>
                <option value="SYNTH">SYNTH</option>
              </select>

              <input
                type="text"
                placeholder="Filter by preview or author ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="ds-input text-xs py-1 px-2 w-48 md:w-64"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono">
              Showing {filteredFeed.length} of {feedItems.length} rows (newest first)
            </div>
          </div>

          {/* Scrolling Feed Table */}
          <div className="glass overflow-hidden border border-white/10 rounded-xl">
            {filteredFeed.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto" />
                <h3 className="text-sm font-medium text-slate-200">No telemetry events found</h3>
                <p className="text-sm text-slate-300 max-w-md mx-auto">
                  {platformFilter && sourcesData[platformFilter]
                    ? sourceArrivalReason(platformFilter, sourcesData[platformFilter], nowTs)
                    : 'No live rows match the current filters.'}
                </p>
                <WhyNothingArriving sources={sourcesData} />
                <div className="text-[11px] text-slate-500 font-mono">
                  State: {isStreamConnected ? 'Connected (Push SSE)' : streamState === 'polling' ? 'Polling every 10s' : 'Connecting...'}
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[640px] overflow-y-auto divide-y divide-white/5">
                {filteredFeed.map((item, index) => {
                  const pTheme = getPlatformTheme(item.platform);
                  const sMode = (item.source_mode || 'SYNTH').toUpperCase();
                  const modeClass = getSourceModeClass(sMode);
                  const previewText = item.text_preview || item.text_content || item.text || item.content || 'No text preview';
                  const shortPreview = previewText.length > 140 ? `${previewText.slice(0, 140)}…` : previewText;
                  const authorDisplay = item.author_short_id || 'masked';
                  const permalink = item.permalink || item.url || (item.urls && item.urls[0]);
                  const ingestedAgoText = formatIngestedAgo(item.collected_at || item.ingested_at, nowTs);

                  return (
                    <div
                      key={item.canonical_id || item.post_id || item.raw_post_id || index}
                      onClick={() => onSelectPost?.(item)}
                      className={`p-3.5 hover:bg-white/[0.04] cursor-pointer transition-colors flex items-start justify-between gap-4 ${item._isNew ? 'is-new-row' : ''}`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Platform & Mode Badges */}
                        <div className="flex flex-col gap-1 shrink-0 w-28">
                          <span
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-center truncate border"
                            style={{ backgroundColor: pTheme.bg, color: pTheme.color, borderColor: pTheme.border }}
                          >
                            {pTheme.label}
                          </span>
                          <span className={`pill text-[9px] text-center ${modeClass}`}>
                            {sMode}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono capitalize text-center">
                            {item.event_type || 'post'}
                          </span>
                        </div>

                        {/* Content & Metadata */}
                        <div className="min-w-0 flex-1 space-y-1">
                          <p className="text-xs text-slate-200 font-sans leading-relaxed break-words">
                            {shortPreview}
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono pt-1">
                            <span className="text-emerald-400 font-medium">
                              @{authorDisplay}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Recent'}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-indigo-300 font-semibold">
                              {ingestedAgoText}
                            </span>
                            {item.topic_id && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-400">topic: {item.topic_id}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right-hand actions & permalink */}
                      <div className="flex items-center gap-2 shrink-0 pt-1" onClick={e => e.stopPropagation()}>
                        {permalink && (
                          <a
                            href={permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded text-slate-400 hover:text-indigo-300 hover:bg-white/10 transition-colors"
                            title="Open external permalink"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => onSelectPost?.(item)}
                          className="pill text-[10px] px-2 py-1 text-slate-300 hover:text-white"
                          title="Open Provenance Drawer"
                        >
                          Provenance <ChevronRight className="w-3 h-3 inline ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PIPELINE PROOF PANEL */}
      {activeTab === 'proof' && (
        <div className="space-y-6">
          {/* Proof Section 1: Ingest Rate Chart (Last 60 Minutes Stacked by Platform) */}
          <div className="glass p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-light text-white">
                  Ingest Rate <span className="text-indigo-300 font-normal">(Posts Per Minute, Last 60 Minutes)</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Authoritative minute-by-minute rate calculated by backend from collection timestamps.
                </p>
              </div>
              <span className="pill text-[10px] pill--live">LIVE BACKEND TELEMETRY</span>
            </div>

            <div className="h-[260px] w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                  No ingest rate points recorded in the last 60 minutes.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="tgGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="ytGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="xGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a855f7" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="displayTime" stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                    <YAxis stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 10, fontFamily: 'JetBrains Mono' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#0c0e22', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    {chartPlatforms.map((name, index) => (
                      <Area key={name} type="monotone" stackId="1" dataKey={name} stroke={['#38bdf8', '#ef4444', '#a78bfa', '#34d399', '#fbbf24'][index % 5]} fillOpacity={0.2} name={name} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Proof Section 2: Pipeline Latency Card */}
          <div className="glass p-5 space-y-4">
            <div>
              <h2 className="text-sm font-light text-white">
                Ingestion Latency <span className="text-indigo-300 font-normal">(collected_at minus created_at)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                End-to-end propagation delay per platform.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(summaryData?.latency_seconds || {}).length === 0 ? (
                <div className="col-span-4 p-4 text-center text-xs text-slate-500 font-mono">
                  No latency points computed yet. Requires items with verified created_at timestamps.
                </div>
              ) : (
                Object.entries(summaryData?.latency_seconds || {}).map(([platform, lat]) => (
                  <div key={platform} className="p-3 bg-black/40 rounded-lg border border-white/5">
                    <span className="capitalize text-xs font-semibold text-white">{platform}</span>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">MEDIAN</span>
                        <span className="font-mono text-emerald-400 font-bold">{formatLatency(lat.median)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">P95</span>
                        <span className="font-mono text-sky-400 font-bold">{formatLatency(lat.p95)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Proof Section 3: Per-Source Health & Countdown Table */}
          <div className="glass p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-light text-white">
                  Connector Schedule & <span className="text-indigo-300 font-normal">Health Matrix</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Execution schedule, items ingested in the last hour, and upstream error reporting.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Last Success</th>
                    <th>Next Run</th>
                    <th>Items (1h)</th>
                    <th>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sourcesData).map(([srcName, src]) => {
                    const isNotEnabled = src.status === 'Not enabled in this build' || src.mode === 'DISABLED';
                    const statusClass = isNotEnabled
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : src.status === 'LIVE' ? 'pill--live'
                      : src.status === 'READY' ? 'text-sky-300 bg-sky-500/10 border-sky-500/20'
                      : src.status === 'CREDENTIALS_REQUIRED' ? 'pill--synth'
                      : 'text-amber-300 bg-amber-500/10 border-amber-500/20';

                    return (
                      <tr key={srcName}>
                        <td>
                          <span className="font-semibold text-white capitalize">{srcName}</span>
                        </td>
                        <td>
                          <span className={`pill text-[10px] ${statusClass}`}>
                            {src.status}
                          </span>
                        </td>
                        <td>
                          <span className={`pill text-[10px] ${isNotEnabled ? 'bg-slate-800 text-slate-400 border border-slate-700' : getSourceModeClass(src.mode)}`}>
                            {isNotEnabled ? '—' : (src.mode || 'LIVE')}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-mono text-slate-300">
                            {isNotEnabled ? '—' : (src.last_success ? new Date(src.last_success).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'None')}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs font-mono text-indigo-300 font-medium">
                            {isNotEnabled ? '—' : getNextRunDisplay(srcName, src)}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            {isNotEnabled ? '—' : (src.items_last_hour ?? 0)}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-400">
                            {isNotEnabled ? (
                              <span className="text-slate-500 text-[11px]">Not enabled in this build</span>
                            ) : src.last_error ? (
                              <span className="text-rose-400 truncate max-w-xs block" title={src.last_error}>
                                {src.last_error}
                              </span>
                            ) : (
                              <span className="text-emerald-400/80 text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Nominal
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Proof Section 4: Collection Runs Audit Log */}
          <div className="glass p-5 space-y-4">
            <div>
              <h2 className="text-sm font-light text-white">
                Collection Runs <span className="text-indigo-300 font-normal">Audit Trail (/api/v1/live/runs)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cryptographic batch verification without secret token exposure.
              </p>
            </div>

            <div className="overflow-x-auto">
              {runsData.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  No collection run records logged in database yet.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Source</th>
                      <th>Started (UTC)</th>
                      <th>Status</th>
                      <th>Items Ingested</th>
                      <th>API Calls</th>
                      <th>Notes / Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsData.map((run, i) => (
                      <tr key={i}>
                        <td className="font-medium text-white capitalize">{run.source}</td>
                        <td className="font-mono text-xs text-slate-300">
                          {run.started_at ? new Date(run.started_at).toLocaleString() : 'N/A'}
                        </td>
                        <td>
                          <span className={`pill text-[10px] ${run.status === 'success' || run.status === 'LIVE' ? 'pill--live' : 'pill--synth'}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-indigo-300 font-bold">
                          {run.items ?? run.count ?? 0}
                        </td>
                        <td className="font-mono text-xs text-slate-300">
                          {run.api_calls ?? 1}
                        </td>
                        <td className="text-xs text-slate-400 font-mono">
                          {run.error ? (
                            <span className="text-rose-400">{run.error}</span>
                          ) : run.cost_usd != null ? (
                            `$${run.cost_usd.toFixed(4)}`
                          ) : (
                            'Nominal'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
