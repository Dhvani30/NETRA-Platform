import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Search, Globe, MessageSquare, RefreshCw, Share2 } from 'lucide-react';
import InvestigationView from './components/InvestigationView';
import NetworkGraph from './components/NetworkGraph';
import NarrativeTracker from './components/NarrativeTracker';
import CrossPlatformView from './components/CrossPlatformView';
import AlertsView from './components/AlertsView';
import DemographicsView from './components/DemographicsView';
import NetworkIntelligenceView from './components/NetworkIntelligenceView';
import { Badge, Button, Card, Input } from './components/ui/primitives';
import './components/AnalyticsView.css';

const API_URL = 'http://localhost:8000/api/v1';
const SENTIMENT_COLORS = { Positive: 'var(--ds-color-green-muted)', Negative: 'var(--ds-color-red-muted)', Neutral: 'var(--ds-color-amber-muted)', ABSTAIN: 'var(--ds-color-text-3)' };

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
  
  // 🔄 MAGIC REFRESH KEY
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sentimentRes, narrativeRes, graphRes, messagesRes] = await Promise.all([
        axios.get(`${API_URL}/analytics/sentiment`),
        axios.get(`${API_URL}/analytics/narratives`),
        axios.get(`${API_URL}/graph/data`),
        axios.get(`${API_URL}/messages?limit=20`)
      ]);
      setSentimentData(sentimentRes.data.sentiment_breakdown || []);
      setNarrativeData(narrativeRes.data.clusters || []);
      setGraphData(graphRes.data || { nodes: [], links: [] });
      setMessages(messagesRes.data.messages || []);
      setLastUpdated(new Date());
    } catch (error) { 
      console.error('Error fetching data:', error); 
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
        console.error('Error searching:', error); 
      } finally { 
        setLoading(false); 
      }
    }
  };

  const handleBackToDashboard = () => { 
    setInvestigationData(null); 
    setSearchQuery(''); 
  };

  useEffect(() => { fetchData(); }, []);

  const getPlatformIcon = (platform) => {
    const p = platform?.toLowerCase() || '';
    if (p.includes('twitter') || p.includes('x')) return <Share2 className="w-4 h-4" />;
    if (p.includes('reddit')) return <MessageSquare className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const diffMs = new Date() - new Date(timestamp);
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="netra-app min-h-screen p-6">
      {/* Header */}
      <header className="netra-header mb-8 flex justify-between items-center">
        <h1 className="netra-title">NETRA <span>INTELLIGENCE</span></h1>
        {!investigationData && (
          <div className="netra-toolbar flex gap-2 items-center flex-wrap">
            <Button variant="nav" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')}>
              Analytics
            </Button>
            <Button variant="nav" active={activeTab === 'mutation'} onClick={() => setActiveTab('mutation')}>
              Mutation Tracker
            </Button>
            <Button variant="nav" active={activeTab === 'correlation'} onClick={() => setActiveTab('correlation')}>
              Cross-Platform
            </Button>
            <Button variant="nav" active={activeTab === 'alerts'} onClick={() => setActiveTab('alerts')}>
              Alerts
            </Button>
            <Button variant="nav" active={activeTab === 'demographics'} onClick={() => setActiveTab('demographics')}>
              Demographics
            </Button>
            <Button variant="nav" active={activeTab === 'network_intel'} onClick={() => setActiveTab('network_intel')}>
              Network Intel
            </Button>
            <Button variant="nav" active={activeTab === 'graph'} onClick={() => setActiveTab('graph')}>
              Network Graph
            </Button>
            
            {/* 🔄 FIXED REFRESH BUTTON */}
            <Button variant="secondary" loading={loading} className="flex items-center gap-2" onClick={() => { fetchData(); setRefreshKey(prev => prev + 1); }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            
            {lastUpdated && <Badge>Last Updated: {lastUpdated.toLocaleTimeString()}</Badge>}
          </div>
        )}
      </header>

      {/* Search Bar */}
      {!investigationData && (
        <div className="netra-search-wrap mb-6">
          <div className="relative">
            <Search className="netra-search-icon absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" />
            <Input
              type="text" 
              placeholder="Investigate topic, entity, or narrative... (press Enter)"
              aria-label="Search investigations"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onKeyDown={handleSearch} 
              className="ds-input--search w-full"
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {investigationData ? (
        <InvestigationView investigationData={investigationData} graphData={graphData} onBack={handleBackToDashboard} searchQuery={searchQuery} />
      ) : (
        <>
          {activeTab === 'analytics' && (
            <section className="analytics-view" aria-labelledby="analytics-heading">
              <header className="analytics-view__header">
                <p className="analytics-view__eyebrow">Dashboard</p>
                <h1 id="analytics-heading" className="analytics-view__title">Analytics</h1>
              </header>
              {loading && !lastUpdated ? (
                <Card className="analytics-view__loading" role="status">
                  <RefreshCw className="analytics-view__loading-icon animate-spin" />
                  <p>Loading analytics…</p>
                </Card>
              ) : (
                <div className="analytics-view__grid">
                  <Card className="analytics-view__card">
                    <header className="analytics-view__card-header"><h2>Sentiment Distribution</h2></header>
                    {sentimentData.length === 0 ? (
                      <div className="analytics-view__empty"><p>No sentiment data available.</p></div>
                    ) : (
                      <div className="analytics-view__chart">
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie data={sentimentData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                              {sentimentData.map((entry, index) => <Cell key={"cell-" + index} fill={SENTIMENT_COLORS[entry.label] || 'var(--ds-color-text-3)'} />)}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} itemStyle={{ color: 'var(--ds-color-text-1)' }} />
                            <Legend wrapperStyle={{ color: 'var(--ds-color-text-2)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                  <Card className="analytics-view__card">
                    <header className="analytics-view__card-header"><h2>Emerging Narratives</h2></header>
                    {narrativeData.length === 0 ? (
                      <div className="analytics-view__empty"><p>No narrative data available.</p></div>
                    ) : (
                      <div className="analytics-view__chart">
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={narrativeData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                            <XAxis type="number" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                            <YAxis dataKey="name" type="category" width={100} stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} itemStyle={{ color: 'var(--ds-color-text-1)' }} />
                            <Bar dataKey="count" fill="var(--ds-color-accent)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                  <Card className="analytics-view__card analytics-view__feed-card">
                    <header className="analytics-view__card-header"><h2>Live Intelligence Feed</h2></header>
                    {messages.length === 0 ? (
                      <div className="analytics-view__empty"><p>No messages available.</p></div>
                    ) : (
                      <div className="analytics-view__feed">
                        {messages.map((msg, i) => (
                          <article key={i} className="analytics-view__message">
                            <div className="analytics-view__message-meta">
                              <span className="analytics-view__platform-icon">{getPlatformIcon(msg.platform)}</span>
                              <span className="analytics-view__platform">{msg.platform?.toUpperCase() || 'UNKNOWN'}</span>
                              <span className="analytics-view__separator">·</span>
                              <span className="analytics-view__time">{getRelativeTime(msg.published_at)}</span>
                            </div>
                            <p className="analytics-view__message-text">{msg.text_content?.substring(0, 150) || 'No content'}...</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </section>
          )}
          
          {/* 🔄 PASSING REFRESH KEY TO FORCE REMOUNT */}
          {activeTab === 'mutation' && (
            <NarrativeTracker key={refreshKey} />
          )}

          {activeTab === 'correlation' && (
            <CrossPlatformView key={refreshKey} />
          )}

          {activeTab === 'alerts' && (
            <AlertsView key={refreshKey} />
          )}

          {activeTab === 'demographics' && (
            <DemographicsView key={refreshKey} />
          )}

          {activeTab === 'network_intel' && (
            <NetworkIntelligenceView key={refreshKey} />
          )}
          
          {activeTab === 'graph' && (
            <NetworkGraph graphData={graphData} key={refreshKey} />
          )}
        </>
      )}
    </div>
  );
}

export default App;