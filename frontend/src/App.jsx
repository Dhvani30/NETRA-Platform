import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Search, Globe, MessageSquare, RefreshCw, Share2 } from 'lucide-react';
import InvestigationView from './components/InvestigationView';
import NetworkGraph from './components/NetworkGraph';
import NarrativeTracker from './components/NarrativeTracker';
import CrossPlatformView from './components/CrossPlatformView';
import AlertsView from './components/AlertsView';

const API_URL = 'http://localhost:8000/api/v1';
const SENTIMENT_COLORS = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#f59e0b', ABSTAIN: '#6b7280' };

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
    <div className="min-h-screen p-6 font-sans" style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold tracking-wider" style={{ color: '#00f0ff' }}>NETRA INTELLIGENCE DASHBOARD</h1>
        {!investigationData && (
          <div className="flex gap-3 items-center">
            <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded transition-colors text-sm font-medium ${activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Analytics
            </button>
            <button onClick={() => setActiveTab('mutation')} className={`px-4 py-2 rounded transition-colors text-sm font-medium ${activeTab === 'mutation' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Mutation Tracker
            </button>
            <button onClick={() => setActiveTab('correlation')} className={`px-4 py-2 rounded transition-colors text-sm font-medium ${activeTab === 'correlation' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Cross-Platform
            </button>
            <button onClick={() => setActiveTab('alerts')} className={`px-4 py-2 rounded transition-colors text-sm font-medium ${activeTab === 'alerts' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Alerts
            </button>
            <button onClick={() => setActiveTab('graph')} className={`px-4 py-2 rounded transition-colors text-sm font-medium ${activeTab === 'graph' ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
              Network Graph
            </button>
            <button onClick={fetchData} disabled={loading} className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 flex items-center gap-2 text-gray-300 transition-colors text-sm font-medium">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            {lastUpdated && <span className="text-xs text-gray-400 ml-2">Last Updated: {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        )}
      </header>

      {/* Search Bar */}
      {!investigationData && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Investigate topic, entity, or narrative... (press Enter)" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              onKeyDown={handleSearch} 
              className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500 transition-colors" 
              style={{ backgroundColor: '#13131f' }} 
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
            <div className="grid grid-cols-3 gap-8">
              <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
                <h2 className="text-xl font-bold mb-4">Sentiment Distribution</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={sentimentData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                      {sentimentData.map((entry, index) => <Cell key={`cell-${index}`} fill={SENTIMENT_COLORS[entry.label] || '#888888'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333' }} itemStyle={{ color: '#fff' }} />
                    <Legend wrapperStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
                <h2 className="text-xl font-bold mb-4">Emerging Narratives</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={narrativeData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" />
                    <YAxis dataKey="name" type="category" width={100} stroke="#888" />
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333' }} itemStyle={{ color: '#fff' }} />
                    <Bar dataKey="count" fill="#00f0ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
                <h2 className="text-xl font-bold mb-4">Live Intelligence Feed</h2>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {messages.length === 0 ? <p className="text-gray-400 text-center py-8">No messages available</p> : messages.map((msg, i) => (
                    <div key={i} className="p-3 rounded border-l-4" style={{ backgroundColor: '#0a0a0f', borderColor: '#00f0ff' }}>
                      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                        {getPlatformIcon(msg.platform)} <span>{msg.platform?.toUpperCase() || 'UNKNOWN'}</span> <span>•</span> <span>{getRelativeTime(msg.published_at)}</span>
                      </div>
                      <p className="text-white mt-1 text-sm">{msg.text_content?.substring(0, 150) || 'No content'}...</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'mutation' && (
            <NarrativeTracker />
          )}

          {activeTab === 'correlation' && (
            <CrossPlatformView />
          )}

          {activeTab === 'alerts' && (
            <AlertsView />
          )}
          
          {activeTab === 'graph' && (
            <NetworkGraph graphData={graphData} />
          )}
        </>
      )}
    </div>
  );
}

export default App;