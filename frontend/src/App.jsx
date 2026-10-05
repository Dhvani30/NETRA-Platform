import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid
} from 'recharts';
import {
  Search, ChevronDown, ChevronRight, ArrowLeft, ArrowRight,
  TrendingUp, HelpCircle, RefreshCw, Sparkles
} from 'lucide-react';

import LandingPage from './components/LandingPage';
import LiveFeedView from './components/LiveFeedView';
import ProvenanceDrawer from './components/ProvenanceDrawer';
import DemoChecklistDrawer from './components/DemoChecklistDrawer';
import InvestigationView from './components/InvestigationView';
import NetworkGraph from './components/NetworkGraph';
import NarrativeTracker from './components/NarrativeTracker';
import CrossPlatformView from './components/CrossPlatformView';
import AlertsView from './components/AlertsView';
import DemographicsView from './components/DemographicsView';
import NetworkIntelligenceView from './components/NetworkIntelligenceView';
import YouTubeFeedView from './components/YouTubeFeedView';
import SourcesTimelineView from './components/SourcesTimelineView';
import SentimentTimelineView from './components/SentimentTimelineView';
import TrendsView from './components/TrendsView';
import MetaFeedView from './components/MetaFeedView';
import LiveStatusStrip from './components/LiveStatusStrip';
import { useLiveStream } from './hooks/useLiveStream';
import WatchlistView from './components/WatchlistView';
import CoverageView from './components/CoverageView';

import { Button, ChartCard, DataTable, Input, StatusBadge } from './components/ui/primitives';
import { ErrorState } from './components/ui/dataState';
import { API_URL } from './config';

const API_UNREACHABLE = "Can't reach the NETRA API (http://127.0.0.1:8000). Start the backend and retry.";

const SCREEN_PATHS = {
  live_feed: '/dashboard/live',
  analytics: '/dashboard/analytics',
  alerts: '/dashboard/alerts',
  youtube: '/dashboard/youtube',
  meta: '/dashboard/meta',
  sources: '/dashboard/sources',
  watchlist: '/dashboard/watchlist',
  coverage: '/dashboard/coverage',
  demographics: '/dashboard/demographics',
  trends: '/dashboard/trends',
  sentiment_timeline: '/dashboard/sentiment',
  investigate: '/dashboard/investigate',
  mutation: '/dashboard/mutation',
  correlation: '/dashboard/correlation',
  graph: '/dashboard/graph',
  network_intel: '/dashboard/network',
};

function isDashboardPath(pathname) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

function screenFromPath(pathname) {
  if (!isDashboardPath(pathname) || pathname === '/dashboard' || pathname === '/dashboard/') return 'live_feed';
  const match = Object.entries(SCREEN_PATHS).find(([, path]) => path === pathname);
  return match ? match[0] : 'live_feed';
}

const NAV_GROUPS = [
  {
    id: 'MONITOR',
    label: 'MONITOR',
    defaultOpen: true,
    items: [
      { id: 'live_feed', label: 'Live Telemetry Feed' },
      { id: 'analytics', label: 'Analytics' },
      { id: 'alerts', label: 'Alerts' },
      { id: 'youtube', label: 'YouTube Feed' },
      { id: 'meta', label: 'Meta Feed' },
      { id: 'sources', label: 'Sources & Timeline' },
      { id: 'watchlist', label: 'Topic Watchlist' },
      { id: 'coverage', label: 'Coverage Map' },
      { id: 'demographics', label: 'Demographics' }
      ,{ id: 'trends', label: 'Rising Topics' }
      ,{ id: 'sentiment_timeline', label: 'Sentiment Timeline' }
    ]
  },
  {
    id: 'INVESTIGATE',
    label: 'INVESTIGATE',
    defaultOpen: false,
    items: [
      { id: 'investigate', label: 'Deep Search' },
      { id: 'mutation', label: 'Narrative Tracker' },
      { id: 'correlation', label: 'Cross-Platform' }
    ]
  },
  {
    id: 'NETWORK',
    label: 'NETWORK',
    defaultOpen: false,
    items: [
      { id: 'graph', label: 'Network Graph' },
      { id: 'network_intel', label: 'Network Intel' }
    ]
  }
];

function App() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== 'undefined' && isDashboardPath(window.location.pathname)
      ? '/dashboard'
      : '/'
  );

  const [activeScreen, setActiveScreen] = useState(() => (
    typeof window === 'undefined' ? 'live_feed' : screenFromPath(window.location.pathname)
  ));
  const [selectedProvenancePost, setSelectedProvenancePost] = useState(null);
  const [showDemoDrawer, setShowDemoDrawer] = useState(false);
  const [openGroups, setOpenGroups] = useState({
    MONITOR: true,
    INVESTIGATE: false,
    NETWORK: false
  });

  const [summaryData, setSummaryData] = useState(null);
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [dataOrigin, setDataOrigin] = useState(null);
  const [sentimentData, setSentimentData] = useState([]);
  const [narrativeData, setNarrativeData] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);
  const [sourcesStatus, setSourcesStatus] = useState({});
  const [liveSummary, setLiveSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [realOnly, setRealOnly] = useState(() => new URLSearchParams(window.location.search).get('real_only') !== '0');
  const onLiveEvent = useCallback(() => { setRefreshKey(key => key + 1); }, []);
  const { connected: backendConnected, state: streamState } = useLiveStream(onLiveEvent);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('real_only', realOnly ? '1' : '0');
    window.history.replaceState({}, '', url);
  }, [realOnly]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (!isDashboardPath(path)) {
        setCurrentPath('/');
        return;
      }
      setCurrentPath('/dashboard');
      setActiveScreen(screenFromPath(path));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openScreen = (id) => {
    setActiveScreen(id);
    if (id !== 'investigate') setInvestigationData(null);
    const path = SCREEN_PATHS[id] || SCREEN_PATHS.live_feed;
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path + window.location.search);
    }
    setCurrentPath('/dashboard');
  };

  const navigateToDashboard = () => {
    openScreen('live_feed');
  };

  const navigateToLanding = () => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
    }
    setCurrentPath('/');
  };

  const fetchData = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    try {
      const sourceFilter = realOnly ? { real_only: 1 } : {};
      const [summaryRes, timeseriesRes, originRes, sentimentRes, narrativeRes, graphRes, messagesRes, sourcesRes, liveSumRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/summary`, { params: sourceFilter }),
        axios.get(`${API_URL}/analytics/timeseries`, { params: sourceFilter }),
        axios.get(`${API_URL}/analytics/data-origin`, { params: sourceFilter }),
        axios.get(`${API_URL}/analytics/sentiment`, { params: sourceFilter }),
        axios.get(`${API_URL}/analytics/narratives`, { params: sourceFilter }),
        axios.get(`${API_URL}/graph/data`, { params: sourceFilter }).catch(() => ({ data: { nodes: [], links: [] } })),
        axios.get(`${API_URL}/messages?limit=20`, { params: sourceFilter }),
        axios.get(`${API_URL}/health/sources`).catch(() => ({ data: {} })),
        axios.get(`${API_URL}/live/summary`).catch(() => ({ data: null }))
      ]);
      setSummaryData(summaryRes.data);
      setTimeseriesData(timeseriesRes.data.timeseries || []);
      setDataOrigin(originRes.data);
      setSentimentData(sentimentRes.data.sentiment_breakdown || []);
      setNarrativeData(narrativeRes.data.clusters || []);
      setGraphData(graphRes.data || { nodes: [], links: [] });
      setMessages(messagesRes.data.messages || []);
      setSourcesStatus(sourcesRes.data || {});
      setLiveSummary(liveSumRes.data || null);
      setLastUpdated(new Date());
      setLoadError(null);
      setHasLoaded(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setLoadError(API_UNREACHABLE);
    } finally {
      if (!background) setLoading(false);
    }
  }, [realOnly]);

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setLoading(true);
      try {
        const searchRes = await axios.get(`${API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
        setInvestigationData(searchRes.data);
        openScreen('investigate');
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBackToDashboard = () => {
    setSearchQuery('');
    openScreen('analytics');
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!refreshKey) return;
    if (activeScreen === 'analytics' || activeScreen === 'graph' || activeScreen === 'investigate') {
      fetchData({ background: true });
    }
  }, [refreshKey, activeScreen, fetchData]);

  useEffect(() => {
    if (!loadError) return undefined;
    const timer = setInterval(() => { fetchData({ background: true }); }, 10000);
    return () => clearInterval(timer);
  }, [loadError, fetchData]);

  const toggleGroup = (groupId) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // If at root '/', render Landing Page
  if (currentPath === '/') {
    return <LandingPage onOpenDashboard={navigateToDashboard} />;
  }

  const totalPostsCount = summaryData?.total_posts ?? 0;
  const dataPhase = !hasLoaded && loading ? 'loading' : (!hasLoaded && loadError ? 'error' : 'ready');

  // If at '/dashboard', render Dashboard Shell
  return (
    <div className="netra-shell">
      {/* 200px Fixed Sidebar */}
      <aside className="netra-sidebar">
        <div>
          {/* Logo / Home button */}
          <div className="netra-sidebar__logo" onClick={navigateToLanding} title="Back to product home">
            <div className="netra-sidebar__logo-mark">N</div>
            <span>NETRA</span>
          </div>

          {/* Collapsible Nav Groups */}
          <nav className="mt-4 space-y-1">
            {NAV_GROUPS.map((group) => {
              const isOpen = openGroups[group.id];
              return (
                <div key={group.id} className="netra-sidebar__group">
                  <button
                    className="netra-sidebar__group-title"
                    onClick={() => toggleGroup(group.id)}
                  >
                    <span>{group.label}</span>
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>

                  {isOpen && (
                    <div className="mt-1 space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = activeScreen === item.id;
                        return (
                          <button
                            key={item.id}
                            className={`netra-sidebar__item ${isActive ? 'is-active' : ''}`}
                            onClick={() => openScreen(item.id)}
                          >
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Single Support Pill Button at Bottom (No Promo Card) */}
        <div className="netra-sidebar__support">
          <button className="pill w-full flex items-center justify-center gap-2 text-xs">
            <HelpCircle className="w-3.5 h-3.5" /> Support
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="netra-main">
        {/* Topbar */}
        <header className="netra-topbar">
          <div className="flex items-center gap-4">
            {investigationData && (
              <button
                onClick={handleBackToDashboard}
                className="pill flex items-center gap-1.5 text-xs text-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            )}
            <h1 className="netra-topbar__title" onClick={navigateToLanding} style={{ cursor: 'pointer' }}>
              NETRA <span>INTELLIGENCE</span>
            </h1>
          </div>

          {/* Global Search Input */}
          <div className="netra-topbar__search relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              type="text"
              placeholder="Search intelligence, topics, narratives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="ds-input--search text-xs py-1.5"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDemoDrawer(true)}
              className="pill text-[11px] flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium transition-colors cursor-pointer"
              title="Open Demo Mode Checklist & Platform Coverage"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Demo Checklist
            </button>
            <LiveStatusStrip summary={liveSummary} streamState={streamState} connected={backendConnected} realOnly={realOnly} onToggle={setRealOnly} onSources={() => openScreen('sources')} />
          </div>
        </header>

        {/* Content Area */}
        <main className="netra-content">
          <div className="netra-content__inner">
            {loadError && (
              <div className="mb-4">
                <ErrorState error={{ message: loadError }} onRetry={() => fetchData()} />
              </div>
            )}
            {/* SCREEN 1: ANALYTICS */}
            {activeScreen === 'analytics' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h1 className="text-xl font-light text-white tracking-wide">
                    Analytics <span className="text-indigo-300 font-normal">Dashboard</span>
                  </h1>
                  <Button variant="secondary" onClick={() => fetchData()} loading={loading}>
                    <RefreshCw className={loading ? 'animate-spin' : ''} /> Refresh Data
                  </Button>
                </div>

                {/* KPI Card Row (Real Counts & Source Verification) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Total Posts split by source_mode */}
                  <div className="glass p-4 flex flex-col justify-between">
                    <div>
                      <span className="label-xs text-slate-400">TOTAL INGESTION (BY MODE)</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value">
                          {dataPhase === 'loading' ? '…' : dataPhase === 'error' ? '—' : (summaryData?.total_posts ?? dataOrigin?.total ?? 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400">authoritative</span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {dataPhase === 'loading' && <span className="text-sm text-slate-300">Loading ingestion counts.</span>}
                      {dataPhase === 'error' && <span className="text-sm text-amber-200">Ingestion counts are unavailable until the API responds.</span>}
                      {dataPhase === 'ready' && (summaryData?.total_posts ?? dataOrigin?.total ?? 0) === 0 && <span className="text-sm text-slate-300">No posts collected yet.</span>}
                      {dataPhase === 'ready' && (summaryData?.total_posts ?? dataOrigin?.total ?? 0) > 0 && (
                        <>
                          <StatusBadge status="LIVE">LIVE: {dataOrigin?.live ?? 0}</StatusBadge>
                          <StatusBadge status="IDLE" title="Collected live through a disclosed third-party provider">LIVE_THIRD_PARTY: {dataOrigin?.live_third_party ?? 0}</StatusBadge>
                          <StatusBadge status="IDLE">IMPORT: {dataOrigin?.import ?? 0}</StatusBadge>
                          <StatusBadge status="SYNTH">SYNTH: {dataOrigin?.synth ?? 0}</StatusBadge>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Data Freshness */}
                  <div className="glass p-4 flex flex-col justify-between">
                    <div>
                      <span className="label-xs text-slate-400">DATA FRESHNESS</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value text-emerald-400">
                          {dataPhase === 'loading' ? '…' : dataPhase === 'error' ? '—' : liveSummary?.newest_item_age_seconds != null ? `${liveSummary.newest_item_age_seconds}s` : 'No items'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">newest item</span>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-sm font-mono">
                      {dataPhase === 'loading' && <span className="col-span-2 text-slate-300">Loading source freshness.</span>}
                      {dataPhase === 'error' && <span className="col-span-2 text-amber-200">Source freshness is unavailable until the API responds.</span>}
                      {dataPhase === 'ready' && Object.entries(sourcesStatus).filter(([, src]) => src.mode !== 'DISABLED' && src.reason !== 'not_enabled_in_this_build').map(([p]) => {
                        const src = sourcesStatus[p] || {};
                        const isFresh = src.status === 'LIVE' || (src.last_success && (Date.now() - new Date(src.last_success).getTime()) < 3600000);
                        const label = src.last_success
                          ? `${Math.max(0, Math.floor((Date.now() - new Date(src.last_success).getTime()) / 60000))}m ago`
                          : (src.status === 'LIVE' ? 'live' : 'idle');
                        return (
                          <div key={p} className="flex justify-between items-center text-slate-300">
                            <span className="capitalize text-slate-400">{p}:</span>
                            <span className={isFresh ? 'text-emerald-400 font-semibold' : 'text-slate-500'}>{label}</span>
                          </div>
                        );
                      })}
                      {dataPhase === 'ready' && !Object.values(sourcesStatus).some(src => src.mode !== 'DISABLED' && (src.last_success || src.status === 'LIVE')) && (
                        <span className="col-span-2 text-sm text-slate-300">No fresh items reported for the active sources.</span>
                      )}
                    </div>
                  </div>

                  {/* Card 3: Coverage Mini-Matrix */}
                  <div className="glass p-4 flex flex-col justify-between">
                    <div>
                      <span className="label-xs text-slate-400">COVERAGE MINI-MATRIX</span>
                      <div className="mt-2 space-y-1.5">
                        <div className="flex flex-wrap gap-1">
                          {dataPhase === 'loading' && <span className="text-sm text-slate-300">Loading coverage.</span>}
                          {dataPhase === 'error' && <span className="text-sm text-amber-200">Coverage is unavailable until the API responds.</span>}
                          {dataPhase === 'ready' && Object.keys(sourcesStatus).length === 0 && <span className="text-sm text-slate-300">No source status reported.</span>}
                          {dataPhase === 'ready' && Object.keys(sourcesStatus).map(p => {
                            const src = sourcesStatus[p] || {};
                            const isNotEnabled = src.status === 'Not enabled in this build' || src.mode === 'DISABLED';
                            const isLive = !isNotEnabled && src.status === 'LIVE';
                            return (
                              <span key={p} className={`px-1.5 py-0.5 rounded text-[10px] font-mono border capitalize flex items-center gap-1 ${
                                isNotEnabled ? 'bg-white/[0.02] border-white/5 text-slate-500' : 'bg-white/5 border-white/10 text-slate-300'
                              }`} title={isNotEnabled ? 'Not enabled in this build' : src.status}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isNotEnabled ? 'bg-slate-600' : isLive ? 'bg-emerald-400' : src.status === 'READY' ? 'bg-sky-400' : 'bg-slate-500'}`} />
                                {p}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openScreen('coverage')}
                      className="text-xs text-indigo-300 hover:text-indigo-200 flex items-center gap-1 font-medium link-underline pt-2"
                    >
                      View Coverage Matrix <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Card 4: Intelligence Signals */}
                  <div className="glass p-4 flex flex-col justify-between">
                    <div>
                      <span className="label-xs text-slate-400">INTELLIGENCE SIGNALS</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value">
                          {dataPhase === 'loading' ? '…' : dataPhase === 'error' ? '—' : (summaryData?.active_narratives ?? 0)}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-300">narratives</span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm font-mono text-slate-300 pt-1 border-t border-white/5">
                      {dataPhase === 'loading' && <span>Loading signals.</span>}
                      {dataPhase === 'error' && <span className="text-amber-200">Signals are unavailable until the API responds.</span>}
                      {dataPhase === 'ready' && (summaryData?.active_narratives ?? 0) === 0 && (summaryData?.active_alerts ?? 0) === 0 && <span>No narratives or alerts in the collected data.</span>}
                      {dataPhase === 'ready' && ((summaryData?.active_narratives ?? 0) > 0 || (summaryData?.active_alerts ?? 0) > 0) && (
                        <>
                          <span>Alerts: <strong className="text-amber-400">{summaryData?.active_alerts ?? 0}</strong></span>
                          <span>Sentiment: <strong className={summaryData?.avg_sentiment > 0 ? 'text-emerald-400' : 'text-slate-300'}>{summaryData?.avg_sentiment ?? '0.00'}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Main Visualization: Chart Card with Dynamic Hourly Volume Timeseries */}
                <ChartCard title="Narrative volume timeseries" subtitle="Hourly counts from the analytics API">

                  <div className="h-[240px] w-full relative">
                    {dataPhase === 'loading' ? (
                      <div className="flex items-center justify-center h-full text-slate-300 text-sm">Loading timeseries.</div>
                    ) : dataPhase === 'error' ? (
                      <div className="flex items-center justify-center h-full text-amber-200 text-sm text-center px-6">{loadError}</div>
                    ) : timeseriesData.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-300 text-sm">
                        No timeseries telemetry points available in the database.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timeseriesData}>
                          <defs>
                            <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9A9EE8" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#9A9EE8" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#C07070" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#C07070" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                          <XAxis dataKey="time" stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 10, fontFamily: 'JetBrains Mono' }} />
                          <Tooltip contentStyle={{ backgroundColor: '#08091A', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', fontSize: '12px' }} />
                          <Area type="monotone" dataKey="positive" stroke="#9A9EE8" fill="url(#posGrad)" strokeWidth={2} />
                          <Area type="monotone" dataKey="negative" stroke="#C07070" fill="url(#negGrad)" strokeWidth={2} />
                          <Area type="monotone" dataKey="neutral" stroke="#5B5F7A" strokeDasharray="3 3" fill="none" />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </ChartCard>

                {/* Dynamic Tracked Narratives Table (.data-table) */}
                <div className="glass p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-light text-white">
                      Tracked <span className="text-indigo-300 font-normal">Narratives</span>
                    </h2>
                    <span className="label-xs">Top Active Clusters</span>
                  </div>

                  {dataPhase === 'loading' ? (
                    <div className="p-8 text-center text-slate-300 text-sm">Loading narrative clusters.</div>
                  ) : dataPhase === 'error' ? (
                    <div className="p-8 text-center text-amber-200 text-sm">{loadError}</div>
                  ) : narrativeData.length === 0 ? (
                    <div className="p-8 text-center text-slate-300 text-sm">
                      No active narrative clusters found in the database.
                    </div>
                  ) : (
                    <DataTable
                      maxRows={5}
                      data={narrativeData}
                      columns={[
                        { header: 'Narrative', cell: (row) => row.name },
                        { header: 'Posts', cell: (row) => row.count },
                        { header: 'Share', cell: (row) => `${totalPostsCount > 0 ? Math.round((row.count / totalPostsCount) * 100) : 0}%` },
                        { header: 'Status', cell: () => <StatusBadge status="IDLE">Reported</StatusBadge> },
                      ]}
                    />
                  )}
                </div>
              </div>
            )}

            {activeScreen === 'live_feed' && <LiveFeedView refreshKey={refreshKey} onSelectPost={setSelectedProvenancePost} realOnly={realOnly} />}
            {activeScreen === 'alerts' && <AlertsView refreshKey={refreshKey} />}
            {activeScreen === 'youtube' && <YouTubeFeedView refreshKey={refreshKey} />}
            {activeScreen === 'meta' && <MetaFeedView refreshKey={refreshKey} />}
            {activeScreen === 'sources' && <SourcesTimelineView refreshKey={refreshKey} />}
            {activeScreen === 'watchlist' && <WatchlistView refreshKey={refreshKey} />}
            {activeScreen === 'coverage' && <CoverageView refreshKey={refreshKey} />}
            {activeScreen === 'demographics' && <DemographicsView refreshKey={refreshKey} />}
            {activeScreen === 'sentiment_timeline' && <SentimentTimelineView refreshKey={refreshKey} />}
            {activeScreen === 'trends' && <TrendsView refreshKey={refreshKey} />}
            {activeScreen === 'investigate' && (
              <InvestigationView
                investigationData={investigationData || { query: searchQuery, documents: messages }}
                graphData={graphData}
                onBack={handleBackToDashboard}
                searchQuery={searchQuery || 'cybersecurity'}
                onSelectPost={setSelectedProvenancePost}
              />
            )}
            {activeScreen === 'mutation' && <NarrativeTracker refreshKey={refreshKey} />}
            {activeScreen === 'correlation' && <CrossPlatformView refreshKey={refreshKey} />}
            {activeScreen === 'graph' && <NetworkGraph graphData={graphData} refreshKey={refreshKey} />}
            {activeScreen === 'network_intel' && <NetworkIntelligenceView refreshKey={refreshKey} />}
          </div>
        </main>
      </div>

      {/* Authoritative Provenance Drawer */}
      {selectedProvenancePost && (
        <ProvenanceDrawer
          post={selectedProvenancePost}
          onClose={() => setSelectedProvenancePost(null)}
        />
      )}

      {/* Demo Mode Checklist Drawer */}
      <DemoChecklistDrawer
        isOpen={showDemoDrawer}
        onClose={() => setShowDemoDrawer(false)}
        onNavigate={(screen) => openScreen(screen)}
      />
    </div>
  );
}

export default App;
