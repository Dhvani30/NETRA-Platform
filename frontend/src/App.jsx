import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ForceGraph2D from 'react-force-graph-2d';

const API_URL = 'http://127.0.0.1:8000/api/v1';
const COLORS = ['#10b981', '#f59e0b', '#ef4444']; // Green, Amber, Red

function App() {
  const [activeTab, setActiveTab] = useState('analytics');
  const [sentimentData, setSentimentData] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Fetch Analytics
    axios.get(`${API_URL}/analytics/sentiment`).then(res => setSentimentData(res.data.sentiment_breakdown));
    // Fetch Graph
    axios.get(`${API_URL}/graph/data`).then(res => setGraphData(res.data));
    // Fetch Recent Messages
    axios.get(`${API_URL}/messages?limit=10`).then(res => setMessages(res.data.messages));
  }, []);

  return (
    <div className="min-h-screen p-6 font-sans">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold text-emerald-400 tracking-wider">NETRA INTELLIGENCE DASHBOARD</h1>
        <div className="flex gap-4">
          <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded ${activeTab === 'analytics' ? 'bg-emerald-600' : 'bg-gray-700'}`}>Analytics</button>
          <button onClick={() => setActiveTab('graph')} className={`px-4 py-2 rounded ${activeTab === 'graph' ? 'bg-emerald-600' : 'bg-gray-700'}`}>Network Graph</button>
        </div>
      </header>

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-2 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Sentiment Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={sentimentData} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                  {sentimentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Live Intelligence Feed</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className="p-3 bg-gray-900 rounded border-l-4 border-emerald-500">
                  <p className="text-sm text-gray-400">{msg.platform.toUpperCase()} • {msg.canonical_id}</p>
                  <p className="text-white mt-1">{msg.text_content.substring(0, 100)}...</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-[600px]">
          <h2 className="text-xl font-bold mb-2">Entity Relationship Network</h2>
          <ForceGraph2D
            graphData={graphData}
            nodeLabel="id"
            nodeColor={node => node.group === 'Post' ? '#10b981' : '#f59e0b'}
            linkColor={() => '#4b5563'}
            backgroundColor="#1f2937"
          />
        </div>
      )}
    </div>
  );
}

export default App;