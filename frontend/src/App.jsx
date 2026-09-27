import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';
import { Search, Globe, MessageSquare, RefreshCw, Share2 } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';
const SENTIMENT_COLORS = { Positive: '#10b981', Negative: '#ef4444', Neutral: '#f59e0b' };
const NODE_COLORS = {
  Platform: '#3b82f6',
  Post: '#f97316',
  Narrative: '#ec4899',
  Organization: '#a855f7',
  Location: '#eab308'
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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch sentiment data
      const sentimentRes = await axios.get(`${API_URL}/analytics/sentiment`);
      setSentimentData(sentimentRes.data.sentiment_breakdown || []);

      // Fetch narrative data
      const narrativeRes = await axios.get(`${API_URL}/analytics/narratives`);
      setNarrativeData(narrativeRes.data.clusters || []);

      // Fetch graph data
      const graphRes = await axios.get(`${API_URL}/graph/data`);
      setGraphData(graphRes.data || { nodes: [], links: [] });

      // Fetch messages
      const messagesRes = await axios.get(`${API_URL}/messages?limit=20`);
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
        setMessages(searchRes.data.documents || []);
      } catch (error) {
        console.error('Error searching:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getPlatformIcon = (platform) => {
    const platformLower = platform?.toLowerCase() || '';
    if (platformLower.includes('twitter') || platformLower.includes('x')) return <Share2 className="w-4 h-4" />;
    if (platformLower.includes('reddit')) return <MessageSquare className="w-4 h-4" />;
    return <Globe className="w-4 h-4" />;
  };

  const parseCanonicalId = (canonicalId) => {
    if (!canonicalId) return 'Unknown';
    if (canonicalId.startsWith('reddit:')) {
      const parts = canonicalId.split(':');
      return parts.length > 2 ? `r/${parts[1]}` : 'Reddit';
    }
    if (canonicalId.startsWith('x:')) {
      const parts = canonicalId.split(':');
      return parts.length > 1 ? `@${parts[1]}` : 'X';
    }
    return canonicalId;
  };

  const getRelativeTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getNodeColor = (node) => {
    return NODE_COLORS[node.group] || '#888888';
  };

  return (
    <div className="min-h-screen p-6 font-sans" style={{ backgroundColor: '#0a0a0f', color: '#ffffff' }}>
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold tracking-wider" style={{ color: '#00f0ff' }}>NETRA INTELLIGENCE DASHBOARD</h1>
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded ${activeTab === 'analytics' ? 'bg-emerald-600' : 'bg-gray-700'}`}
          >
            Analytics
          </button>
          <button 
            onClick={() => setActiveTab('graph')}
            className={`px-4 py-2 rounded ${activeTab === 'graph' ? 'bg-emerald-600' : 'bg-gray-700'}`}
          >
            Network Graph
          </button>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {lastUpdated && (
            <span className="text-sm text-gray-400">
              Last Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search posts... (press Enter to search)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            className="w-full pl-10 pr-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
            style={{ backgroundColor: '#13131f' }}
          />
        </div>
      </div>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-3 gap-8">
          {/* Sentiment Distribution */}
          <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-xl font-bold mb-4">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie 
                  data={sentimentData} 
                  dataKey="count" 
                  nameKey="label" 
                  cx="50%" 
                  cy="50%" 
                  outerRadius={100} 
                  label
                >
                  {sentimentData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={SENTIMENT_COLORS[entry.label] || '#888888'} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Legend 
                  wrapperStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Emerging Narratives */}
          <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-xl font-bold mb-4">Emerging Narratives</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={narrativeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#888" />
                <YAxis dataKey="name" type="category" width={100} stroke="#888" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Bar dataKey="count" fill="#00f0ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Live Intelligence Feed */}
          <div className="p-6 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-xl font-bold mb-4">Live Intelligence Feed</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No messages available</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className="p-3 rounded border-l-4" style={{ backgroundColor: '#0a0a0f', borderColor: '#00f0ff' }}>
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                      {getPlatformIcon(msg.platform)}
                      <span>{msg.platform?.toUpperCase() || 'UNKNOWN'}</span>
                      <span>•</span>
                      <span>{parseCanonicalId(msg.canonical_id)}</span>
                      <span>•</span>
                      <span>{getRelativeTime(msg.published_at)}</span>
                    </div>
                    <p className="text-white mt-1">{msg.text_content?.substring(0, 100) || 'No content'}...</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <div className="p-4 rounded-lg shadow-lg" style={{ backgroundColor: '#13131f', height: 'calc(100vh - 200px)' }}>
          <h2 className="text-xl font-bold mb-2">Entity Relationship Network</h2>
          {graphData.nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-xl">No graph data available. Run graph_builder.py first.</p>
            </div>
          ) : (
            <ForceGraph2D
              graphData={graphData}
              width={window.innerWidth - 80}
              height={window.innerHeight - 200}
              nodeLabel="label"
              nodeColor={getNodeColor}
              linkColor="#555"
              backgroundColor="#13131f"
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;