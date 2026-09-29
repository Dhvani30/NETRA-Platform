import { useState, useEffect } from 'react';
import axios from 'axios';
import { Share2, MessageSquare, Globe, ArrowRight, Activity, Video } from 'lucide-react'; // Changed Youtube to Video

const API_URL = 'http://localhost:8000/api/v1';

const PLATFORM_ICONS = {
  X: <Share2 className="w-5 h-5" />,
  REDDIT: <MessageSquare className="w-5 h-5" />,
  YOUTUBE: <Video className="w-5 h-5" />, // Using Video icon
  TELEGRAM: <Globe className="w-5 h-5" />,
  UNKNOWN: <Globe className="w-5 h-5" />
};

const PLATFORM_COLORS = {
  X: '#3b82f6',       // Blue
  REDDIT: '#ef4444',  // Red
  YOUTUBE: '#ff0000', // YouTube Red
  TELEGRAM: '#0088cc',// Telegram Blue
  UNKNOWN: '#6b7280'  // Gray
};

export default function CrossPlatformView() {
  const [query, setQuery] = useState('cisco');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCorrelation = async (searchTerm) => {
    if (!searchTerm.trim()) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/correlation?q=${encodeURIComponent(searchTerm)}`);
      setData(res.data);
    } catch (error) {
      console.error("Error fetching correlation:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrelation(query);
  }, []);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="flex justify-between items-center p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
        <div>
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: '#00f0ff' }}>
            CROSS-PLATFORM CORRELATION
          </h1>
          <p className="text-sm text-gray-400 mt-1">Track how intelligence spreads across social networks</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCorrelation(query)}
            className="px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-cyan-500"
            placeholder="Enter topic..."
          />
          <button 
            onClick={() => fetchCorrelation(query)}
            className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
          >
            Track
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Analyzing cross-platform spread...</div>
      ) : !data || data.flow.length === 0 ? (
        <div className="text-center py-20 text-gray-400">No cross-platform data found for this topic.</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Topic Tracked</div>
              <div className="text-xl font-bold text-white capitalize">{data.query}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Platforms Involved</div>
              <div className="text-xl font-bold text-cyan-400">{data.flow.length}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Total Observations</div>
              <div className="text-xl font-bold text-emerald-400">{data.total_posts}</div>
            </div>
          </div>

          {/* Timeline Flow */}
          <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2" style={{ color: '#00f0ff' }}>
              <Activity className="w-5 h-5" />
              INTELLIGENCE SPREAD TIMELINE
            </h2>
            
            <div className="relative">
              {/* Connecting Line */}
              <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-700 z-0"></div>
              
              <div className="flex justify-between relative z-10">
                {data.flow.map((item, index) => (
                  <div key={index} className="flex flex-col items-center w-1/4 px-2">
                    {/* Platform Icon Node */}
                    <div 
                      className="w-16 h-16 rounded-full flex items-center justify-center border-4 mb-4 shadow-lg"
                      style={{ 
                        backgroundColor: '#0a0a0f', 
                        borderColor: PLATFORM_COLORS[item.platform] || '#6b7280',
                        color: PLATFORM_COLORS[item.platform] || '#6b7280'
                      }}
                    >
                      {PLATFORM_ICONS[item.platform] || PLATFORM_ICONS.UNKNOWN}
                    </div>
                    
                    {/* Platform Name */}
                    <div className="text-sm font-bold text-white mb-1">{item.platform}</div>
                    
                    {/* Time */}
                    <div className="text-xs text-cyan-400 mb-2">{formatTime(item.first_seen)}</div>
                    
                    {/* Volume */}
                    <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
                      {item.post_count} posts
                    </div>

                    {/* Sample Text (Tooltip style) */}
                    <div className="mt-3 text-xs text-gray-500 text-center italic px-2 hidden md:block">
                      "{item.sample_text}"
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detailed Evidence List */}
          <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-lg font-bold mb-4" style={{ color: '#00f0ff' }}>PLATFORM BREAKDOWN</h2>
            <div className="space-y-3">
              {data.flow.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded border-l-4" style={{ backgroundColor: '#0a0a0f', borderColor: PLATFORM_COLORS[item.platform] }}>
                  <div className="flex items-center gap-4">
                    <div style={{ color: PLATFORM_COLORS[item.platform] }}>
                      {PLATFORM_ICONS[item.platform]}
                    </div>
                    <div>
                      <div className="font-bold text-white">{item.platform}</div>
                      <div className="text-xs text-gray-400">First detected: {formatTime(item.first_seen)}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-cyan-400">{item.post_count} posts</div>
                    <div className="text-xs text-gray-500 max-w-xs truncate">{item.sample_text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}