import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Network, Users, GitMerge, Layers, RefreshCw, Share2, MessageSquare, Globe, Video } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';
const COLORS = ['#00f0ff', '#a855f7', '#ec4899', '#3b82f6', '#eab308', '#10b981', '#ef4444'];

// ✅ ADDED: Helper to show platform icons in the intelligence lists
const getPlatformIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('youtube')) return <Video className="w-4 h-4 text-red-500" />;
  if (n.includes('twitter') || n.includes('x')) return <Share2 className="w-4 h-4" />;
  if (n.includes('reddit')) return <MessageSquare className="w-4 h-4" />;
  return <Globe className="w-4 h-4" />;
};

export default function NetworkIntelligenceView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchIntelligence = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/graph/intelligence?t=${Date.now()}`);
      setData(res.data);
    } catch (error) {
      console.error("Error fetching graph intelligence:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, []);

  const formatName = (name) => {
    if (!name || name === 'Unknown Node') return 'Unknown Entity';
    // Truncate long names
    return name.length > 30 ? name.substring(0, 27) + '...' : name;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-cyan-900/30 border border-cyan-600">
            <Network className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-white">
              ADVANCED NETWORK INTELLIGENCE
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Centrality, Bridge Nodes, and Community Detection
            </p>
          </div>
        </div>
        <button 
          onClick={fetchIntelligence}
          disabled={loading}
          className={`px-4 py-2 rounded text-white text-sm font-medium flex items-center gap-2 transition-all ${
            loading ? 'bg-gray-600 cursor-wait' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 
          {loading ? 'Recalculating...' : 'Recalculate'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Running graph algorithms...</div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">No graph intelligence data available.</div>
      ) : (
        <>
          {/* Top Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-400 font-medium">Top Influencers</span>
              </div>
              <div className="text-3xl font-bold text-white">{data.influencers?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Highest degree centrality</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="flex items-center gap-2 mb-2">
                <GitMerge className="w-5 h-5 text-cyan-400" />
                <span className="text-sm text-gray-400 font-medium">Bridge Nodes</span>
              </div>
              <div className="text-3xl font-bold text-white">{data.bridges?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Cross-community connectors</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-gray-400 font-medium">Communities</span>
              </div>
              <div className="text-3xl font-bold text-white">{data.communities?.length || 0}</div>
              <div className="text-xs text-gray-500 mt-1">Distinct node clusters</div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Top Influencers */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Users className="w-5 h-5" /> TOP INFLUENCERS (Degree Centrality)
              </h2>
              <div className="space-y-3">
                {data.influencers?.length > 0 ? data.influencers.map((inf, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded bg-gray-900/50 border border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-600">#{i + 1}</span>
                      <div className="flex items-center gap-2">
                        {/* Show platform icon if the influencer is a platform */}
                        {inf.type === 'Platform' && getPlatformIcon(inf.name)}
                        <div>
                          <div className="font-bold text-white">{formatName(inf.name)}</div>
                          <div className="text-xs text-purple-400">{inf.type || 'Entity'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-cyan-400">{inf.degree}</div>
                      <div className="text-xs text-gray-500">Connections</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500 text-sm">No influencer data available.</div>
                )}
              </div>
            </div>

            {/* Bridge Nodes */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <GitMerge className="w-5 h-5" /> CRITICAL BRIDGE NODES
              </h2>
              <p className="text-xs text-gray-400 mb-4">Entities that connect disparate platforms or narratives, acting as information conduits.</p>
              <div className="space-y-3">
                {data.bridges?.length > 0 ? data.bridges.map((bridge, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded bg-gray-900/50 border border-gray-800">
                    <div className="flex items-center gap-2">
                      {/* Attempt to show platform icon if the bridge name is a platform */}
                      {['YOUTUBE', 'X', 'TWITTER', 'REDDIT'].includes(bridge.name.toUpperCase()) && getPlatformIcon(bridge.name)}
                      <div className="font-bold text-white">{formatName(bridge.name)}</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-cyan-900/30 text-cyan-400 text-xs font-bold border border-cyan-800">
                      Score: {bridge.bridge_score}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    No strong bridge nodes detected in current graph topology.
                  </div>
                )}
              </div>
            </div>

            {/* Community Clusters Chart */}
            <div className="col-span-2 p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Layers className="w-5 h-5" /> COMMUNITY CLUSTER DISTRIBUTION
              </h2>
              {data.communities?.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No community data available.</div>
              ) : (
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.communities || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="community" 
                        stroke="#888" 
                        style={{ fontSize: '11px' }}
                        tick={{ fill: '#888' }}
                      />
                      <YAxis stroke="#888" tick={{ fill: '#888' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333', color: '#fff' }} 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      />
                      <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                        {(data.communities || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}