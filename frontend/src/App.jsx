import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Search,
  RefreshCw,
  Share2,
  MessageSquare,
  Globe,
  Radio,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  Activity,
  Filter
} from 'lucide-react';
import InvestigationView from './components/InvestigationView';
import NetworkGraph from './components/NetworkGraph';

const API_URL = 'http://localhost:8000/api/v1';

// Restrained Editorial Palette
const EDITORIAL_COLORS = {
  sage: '#91A891',
  warm: '#B6A98A',
  negative: '#C0615A',
  neutral: '#B6A98A',
  positive: '#91A891',
  muted: '#686D65',
  slate: '#747D74',
  border: '#343934',
  panel: '#1E211F',
  surface: '#252925',
};

const SENTIMENT_COLORS = {
  Negative: EDITORIAL_COLORS.negative,
  Neutral: EDITORIAL_COLORS.neutral,
  Positive: EDITORIAL_COLORS.positive,
  ABSTAIN: EDITORIAL_COLORS.muted,
};

// Custom Minimalist Chart Tooltip
const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[#1E211F] border border-[#343934] px-3 py-2 rounded-sm shadow-xl text-xs font-sans">
        <p className="font-medium text-[#E5E6DF] mb-0.5">{label || item.name}</p>
        <div className="flex items-center gap-2 text-[#9B9F96]">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.fill || EDITORIAL_COLORS.sage }} />
          <span>Count:</span>
          <span className="font-mono text-[#E5E6DF] font-medium">{item.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [sentimentData, setSentimentData] = useState([]);
  const [narrativeData, setNarrativeData] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [selectedSentimentFilter, setSelectedSentimentFilter] = useState('ALL');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sentimentRes, narrativeRes, graphRes, messagesRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/sentiment`),
        axios.get(`${API_URL}/analytics/narratives`),
        axios.get(`${API_URL}/graph/data`),
        axios.get(`${API_URL}/messages?limit=50`)
      ]);
      setSentimentData(sentimentRes.data.sentiment_breakdown || []);
      setNarrativeData(narrativeRes.data.clusters || []);
      setGraphData(graphRes.data || { nodes: [], links: [] });
      setMessages(messagesRes.data.messages || []);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching intelligence feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setLoading(true);
      try {
        const searchRes = await axios.get(`${API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
        setInvestigationData(searchRes.data);
      } catch (error) {
        console.error('Search query failed:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleQuickSearch = async (queryText) => {
    setSearchQuery(queryText);
    setLoading(true);
    try {
      const searchRes = await axios.get(`${API_URL}/search?q=${encodeURIComponent(queryText)}`);
      setInvestigationData(searchRes.data);
    } catch (error) {
      console.error('Quick search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setInvestigationData(null);
    setSearchQuery('');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getPlatformIcon = (platform) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('twitter') || p.includes('x')) return <Share2 className="w-3.5 h-3.5 text-[#9B9F96]" />;
    if (p.includes('reddit')) return <MessageSquare className="w-3.5 h-3.5 text-[#9B9F96]" />;
    return <Globe className="w-3.5 h-3.5 text-[#9B9F96]" />;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Recent';
    const diffMs = new Date() - new Date(timestamp);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Filtered live feed
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      const matchesPlatform =
        platformFilter === 'ALL' ||
        (msg.platform && msg.platform.toLowerCase() === platformFilter.toLowerCase());
      const matchesSentiment =
        selectedSentimentFilter === 'ALL' ||
        (msg.sentiment_label && msg.sentiment_label.toUpperCase() === selectedSentimentFilter.toUpperCase());
      return matchesPlatform && matchesSentiment;
    });
  }, [messages, platformFilter, selectedSentimentFilter]);

  // Derived metrics for compact strip
  const totalObservations = useMemo(() => {
    return sentimentData.reduce((sum, item) => sum + (item.count || 0), 0) || messages.length || 0;
  }, [sentimentData, messages]);

  const dominantSentiment = useMemo(() => {
    if (!sentimentData.length) return { label: 'Neutral', ratio: '—' };
    const sorted = [...sentimentData].sort((a, b) => (b.count || 0) - (a.count || 0));
    const top = sorted[0];
    const percentage = totalObservations ? Math.round((top.count / totalObservations) * 100) : 0;
    return { label: top.label, ratio: `${percentage}%` };
  }, [sentimentData, totalObservations]);

  return (
    <div className="min-h-screen bg-[#171918] text-[#E5E6DF] font-sans selection:bg-[#91A891]/20">
      {/* ─── Compact Editorial Header ─── */}
      <header className="border-b border-[#343934] px-6 lg:px-10 py-3.5 sticky top-0 z-40 bg-[#171918]/95 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3.5">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-base tracking-tight text-[#E5E6DF]">NETRA</span>
              <span className="text-[11px] font-mono text-[#9B9F96] tracking-wider uppercase">SIH-NTRO</span>
            </div>
            <span className="h-3 w-px bg-[#343934] hidden sm:inline-block" />
            <span className="text-xs text-[#9B9F96] font-normal hidden sm:inline-block">
              Strategic Threat & Narrative Observatory
            </span>
          </div>

          {/* Controls & Navigation */}
          {!investigationData && (
            <div className="flex items-center gap-3 self-end md:self-auto text-xs">
              {/* Tab Selector */}
              <nav className="flex items-center bg-[#1E211F] p-0.5 rounded border border-[#343934]">
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    activeTab === 'analytics'
                      ? 'bg-[#252925] text-[#E5E6DF] shadow-sm'
                      : 'text-[#9B9F96] hover:text-[#E5E6DF]'
                  }`}
                >
                  Analytics & Feed
                </button>
                <button
                  onClick={() => setActiveTab('graph')}
                  className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                    activeTab === 'graph'
                      ? 'bg-[#252925] text-[#E5E6DF] shadow-sm'
                      : 'text-[#9B9F96] hover:text-[#E5E6DF]'
                  }`}
                >
                  Network Graph
                </button>
              </nav>

              <span className="h-3 w-px bg-[#343934] hidden sm:inline-block" />

              {/* Status Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-[#9B9F96] px-2 py-1 rounded bg-[#1E211F] border border-[#343934]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#91A891]" />
                <span>ATLAS LIVE</span>
              </div>

              {/* Refresh Action */}
              <button
                onClick={fetchData}
                disabled={loading}
                title="Synchronize Data"
                className="px-2.5 py-1 rounded bg-[#1E211F] hover:bg-[#252925] border border-[#343934] hover:border-[#424842] text-[#9B9F96] hover:text-[#E5E6DF] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-[#91A891]' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {lastUpdated && (
                <span className="text-[11px] font-mono text-[#686D65] hidden lg:inline">
                  {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content Canvas ─── */}
      <main className="max-w-[1600px] mx-auto px-6 lg:px-10 py-6">
        {/* Search Field (Only shown in main overview) */}
        {!investigationData && (
          <div className="mb-6">
            <div className="relative max-w-3xl">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-[#9B9F96] w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search entities, threat actors, zero-days, or narratives... (Press Enter to investigate)"
                className="w-full pl-10 pr-24 py-2.5 rounded bg-[#1E211F] border border-[#343934] text-xs text-[#E5E6DF] placeholder-[#686D65] focus:outline-none focus:border-[#91A891] transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <kbd className="text-[10px] font-mono text-[#686D65] bg-[#252925] px-1.5 py-0.5 rounded border border-[#343934]">
                  Enter ↵
                </kbd>
              </div>
            </div>
          </div>
        )}

        {/* ─── Mode Switching: Investigation View vs Dashboard ─── */}
        {investigationData ? (
          <InvestigationView
            investigationData={investigationData}
            graphData={graphData}
            onBack={handleBackToDashboard}
            searchQuery={searchQuery}
          />
        ) : (
          <>
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                {/* ─── 1. Compact Editorial Metrics Strip ─── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#343934] border border-[#343934] rounded overflow-hidden">
                  <div className="bg-[#1E211F] p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
                      Monitored Stream
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold font-mono text-[#E5E6DF]">{totalObservations}</span>
                      <span className="text-xs text-[#9B9F96]">signals ingested</span>
                    </div>
                  </div>

                  <div className="bg-[#1E211F] p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
                      Active Narratives
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold font-mono text-[#E5E6DF]">
                        {narrativeData.length || 0}
                      </span>
                      <span className="text-xs text-[#9B9F96]">clusters identified</span>
                    </div>
                  </div>

                  <div className="bg-[#1E211F] p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
                      Prevailing Sentiment
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-xl font-semibold font-mono"
                        style={{ color: SENTIMENT_COLORS[dominantSentiment.label] || EDITORIAL_COLORS.warm }}
                      >
                        {dominantSentiment.label}
                      </span>
                      <span className="text-xs text-[#9B9F96] font-mono">({dominantSentiment.ratio})</span>
                    </div>
                  </div>

                  <div className="bg-[#1E211F] p-4">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#9B9F96] mb-1">
                      Graph Entities
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-semibold font-mono text-[#E5E6DF]">
                        {graphData.nodes?.length || 0}
                      </span>
                      <span className="text-xs text-[#9B9F96]">nodes mapped</span>
                    </div>
                  </div>
                </div>

                {/* ─── 2. Asymmetric Editorial Grid ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Visual Analytics (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    {/* Narrative Landscape Panel */}
                    <section className="bg-[#1E211F] border border-[#343934] rounded p-5">
                      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[#343934]">
                        <div>
                          <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                            Narrative Convergence & Cluster Distribution
                          </h2>
                          <p className="text-xs text-[#9B9F96] mt-0.5">
                            Identified strategic themes sorted by signal density
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-[#686D65]">
                          DBSCAN / TF-IDF
                        </span>
                      </div>

                      {narrativeData.length === 0 ? (
                        <div className="py-16 text-center text-xs text-[#9B9F96]">
                          No narrative clusters computed yet.
                        </div>
                      ) : (
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={narrativeData}
                              layout="vertical"
                              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="2 2" stroke="#252925" horizontal={true} vertical={false} />
                              <XAxis
                                type="number"
                                stroke="#686D65"
                                fontSize={11}
                                tickLine={false}
                                axisLine={{ stroke: '#343934' }}
                              />
                              <YAxis
                                dataKey="name"
                                type="category"
                                width={130}
                                stroke="#9B9F96"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => (val.length > 18 ? `${val.substring(0, 18)}…` : val)}
                              />
                              <RechartsTooltip content={<CustomChartTooltip />} />
                              <Bar
                                dataKey="count"
                                fill={EDITORIAL_COLORS.sage}
                                radius={[0, 2, 2, 0]}
                                barSize={16}
                                onClick={(entry) => handleQuickSearch(entry.name)}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* Quick Filter Clickable Pills */}
                      <div className="mt-4 pt-3 border-t border-[#343934] flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-[#686D65] mr-1">Direct Dossier:</span>
                        {narrativeData.slice(0, 4).map((narrative, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleQuickSearch(narrative.name)}
                            className="text-[11px] font-sans px-2 py-0.5 rounded bg-[#252925] hover:bg-[#343934] border border-[#343934] text-[#9B9F96] hover:text-[#E5E6DF] transition-colors"
                          >
                            {narrative.name}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Sentiment Analysis Panel */}
                    <section className="bg-[#1E211F] border border-[#343934] rounded p-5">
                      <div className="flex items-baseline justify-between mb-4 pb-3 border-b border-[#343934]">
                        <div>
                          <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                            Tone Classification & Polarity Ratio
                          </h2>
                          <p className="text-xs text-[#9B9F96] mt-0.5">
                            Heuristic sentiment distribution evaluated across active observations
                          </p>
                        </div>
                        <span className="text-[11px] font-mono text-[#686D65]">
                          VADER NLP
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                        <div className="sm:col-span-5 h-[200px] flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={sentimentData}
                                dataKey="count"
                                nameKey="label"
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={2}
                                stroke="#1E211F"
                                strokeWidth={2}
                              >
                                {sentimentData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={SENTIMENT_COLORS[entry.label] || EDITORIAL_COLORS.muted}
                                  />
                                ))}
                              </Pie>
                              <RechartsTooltip content={<CustomChartTooltip />} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Breakdown Legend Table */}
                        <div className="sm:col-span-7 space-y-2 text-xs">
                          {sentimentData.map((item, idx) => {
                            const pct = totalObservations
                              ? Math.round((item.count / totalObservations) * 100)
                              : 0;
                            const isNeg = item.label?.toUpperCase() === 'NEGATIVE';
                            const isPos = item.label?.toUpperCase() === 'POSITIVE';
                            const color = isNeg
                              ? EDITORIAL_COLORS.negative
                              : isPos
                              ? EDITORIAL_COLORS.positive
                              : EDITORIAL_COLORS.neutral;

                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedSentimentFilter(selectedSentimentFilter === item.label ? 'ALL' : item.label)}
                                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                                  selectedSentimentFilter === item.label ? 'bg-[#252925] border border-[#343934]' : 'hover:bg-[#252925]/50'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                  <span className="text-[#E5E6DF] font-medium">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-3 font-mono">
                                  <span className="text-[#9B9F96]">{item.count} items</span>
                                  <span className="text-[#686D65] w-10 text-right">{pct}%</span>
                                </div>
                              </div>
                            );
                          })}
                          {selectedSentimentFilter !== 'ALL' && (
                            <button
                              onClick={() => setSelectedSentimentFilter('ALL')}
                              className="text-[11px] text-[#91A891] hover:underline pt-1 block"
                            >
                              Reset sentiment filter
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Right Column: Live Intelligence Feed (5 cols) */}
                  <div className="lg:col-span-5">
                    <section className="bg-[#1E211F] border border-[#343934] rounded flex flex-col h-[650px]">
                      {/* Feed Header */}
                      <div className="p-4 border-b border-[#343934] flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#91A891]" />
                            <h2 className="text-sm font-semibold tracking-tight text-[#E5E6DF]">
                              Intelligence Wire
                            </h2>
                          </div>
                          <p className="text-[11px] text-[#9B9F96] mt-0.5">
                            Real-time observations from monitored vectors
                          </p>
                        </div>

                        {/* Platform Filter Tabs */}
                        <div className="flex items-center gap-1 text-[11px] font-mono bg-[#252925] p-0.5 rounded border border-[#343934]">
                          {['ALL', 'X', 'REDDIT'].map((p) => (
                            <button
                              key={p}
                              onClick={() => setPlatformFilter(p)}
                              className={`px-2 py-0.5 rounded transition-colors ${
                                platformFilter === p
                                  ? 'bg-[#343934] text-[#E5E6DF]'
                                  : 'text-[#9B9F96] hover:text-[#E5E6DF]'
                              }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Stream Content */}
                      <div className="flex-1 overflow-y-auto divide-y divide-[#343934]/60 p-1">
                        {filteredMessages.length === 0 ? (
                          <div className="py-24 text-center text-xs text-[#9B9F96]">
                            No matching signals found in current stream.
                          </div>
                        ) : (
                          filteredMessages.map((msg, i) => {
                            const isNeg = msg.sentiment_label?.toUpperCase() === 'NEGATIVE';
                            const isPos = msg.sentiment_label?.toUpperCase() === 'POSITIVE';
                            const sentimentStyle = isNeg
                              ? 'text-[#C0615A] bg-[#C0615A]/10 border-[#C0615A]/20'
                              : isPos
                              ? 'text-[#91A891] bg-[#91A891]/10 border-[#91A891]/20'
                              : 'text-[#B6A98A] bg-[#B6A98A]/10 border-[#B6A98A]/20';

                            return (
                              <article
                                key={i}
                                onClick={() => handleQuickSearch(msg.author_username || msg.narrative_name || 'incident')}
                                className="p-3.5 hover:bg-[#252925] transition-colors rounded-sm cursor-pointer group"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-[#9B9F96] font-mono">
                                    {getPlatformIcon(msg.platform)}
                                    <span className="text-[#E5E6DF] font-medium">
                                      {msg.author_username || msg.platform?.toUpperCase() || 'ANON'}
                                    </span>
                                    <span>•</span>
                                    <span>{getRelativeTime(msg.published_at)}</span>
                                  </div>

                                  {msg.sentiment_label && (
                                    <span
                                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${sentimentStyle}`}
                                    >
                                      {msg.sentiment_label}
                                    </span>
                                  )}
                                </div>

                                <p className="text-xs text-[#E5E6DF]/90 leading-relaxed font-normal">
                                  {msg.text_content || msg.content || 'Content unparsed.'}
                                </p>

                                {msg.narrative_name && (
                                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#9B9F96]">
                                    <span className="inline-flex items-center gap-1 text-[#B6A98A] font-mono text-[10px]">
                                      <span className="w-1 h-1 rounded-full bg-[#B6A98A]" />
                                      {msg.narrative_name}
                                    </span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-[#91A891] flex items-center gap-0.5">
                                      Inspect <ChevronRight className="w-3 h-3" />
                                    </span>
                                  </div>
                                )}
                              </article>
                            );
                          })
                        )}
                      </div>

                      {/* Stream Footer */}
                      <div className="p-2.5 border-t border-[#343934] bg-[#171918]/60 text-[11px] text-[#686D65] font-mono flex items-center justify-between">
                        <span>Showing {filteredMessages.length} entries</span>
                        <span>Click entry to open dossier</span>
                      </div>
                    </section>
                  </div>
                </div>
              </div>
            )}

            {/* ─── Network Graph Tab ─── */}
            {activeTab === 'graph' && (
              <NetworkGraph graphData={graphData} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
