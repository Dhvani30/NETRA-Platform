import { useState, useEffect } from 'react';
import axios from 'axios';
import { Share2, MessageSquare, Globe, Activity, Video } from 'lucide-react';
import { Badge, Button, GlassCard, KpiCard, ChartCard, Input } from './ui/primitives';

import { API_URL } from '../config';

const PLATFORM_ICONS = {
  X: <Share2 className="w-4 h-4 text-blue-400" />,
  REDDIT: <MessageSquare className="w-4 h-4 text-orange-400" />,
  YOUTUBE: <Video className="w-4 h-4 text-red-400" />,
  TELEGRAM: <Globe className="w-4 h-4 text-sky-400" />,
  UNKNOWN: <Globe className="w-4 h-4 text-gray-400" />
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
    <div className="space-y-8" aria-busy={loading}>
      {/* Page Header & Search */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Cross-Platform Telemetry</span>
          <h1 className="netra-page-title">Platform <span>Correlation</span></h1>
          <p className="netra-page-subtitle">Map intelligence propagation trajectories across networks.</p>
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 max-w-sm w-full">
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchCorrelation(query)}
            placeholder="Search topic..."
            aria-label="Topic to track"
          />
          <Button variant="primary" onClick={() => fetchCorrelation(query)}>
            Track
          </Button>
        </div>
      </div>

      {loading ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <Activity className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-300 font-medium">Tracking cross-platform propagation flow…</p>
        </GlassCard>
      ) : !data || data.flow.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Globe className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-gray-200">No cross-platform correlation found</h2>
          <p className="text-gray-400 text-sm">Try entering another keyword to trace cross-network propagation.</p>
        </GlassCard>
      ) : (
        <>
          {/* Row of Max 4 KPI Cards */}
          <div className="netra-grid-12">
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Topic Tracked"
                value={data.query}
                delta="Active"
                deltaType="positive"
                subtext="Target term"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Platforms Involved"
                value={data.flow.length}
                delta="Multi-vector"
                deltaType="warning"
                subtext="Distribution networks"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Total Observations"
                value={data.total_posts}
                delta={data.total_posts > 0 ? `${data.total_posts} verified` : 'No signals'}
                deltaType="positive"
                subtext="Cross-post count"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Correlation Index"
                value={data.flow.length > 1 ? Math.min(0.98, ((data.flow.length / 4) * 0.7 + (data.total_posts > 10 ? 0.25 : 0.1))).toFixed(2) : (data.flow.length === 1 ? '0.25' : '0.00')}
                delta={data.flow.length > 1 ? 'Multi-platform' : 'Single vector'}
                deltaType={data.flow.length > 1 ? 'positive' : 'neutral'}
                subtext="Propagation confidence"
              />
            </div>
          </div>

          {/* Main Visualization: Propagation Timeline Flow */}
          <ChartCard
            title="Intelligence Spread Timeline"
            subtitle={`Cross-platform trajectory for "${data.query}"`}
            action={<Badge variant="accent">{data.query}</Badge>}
          >
            <div className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.flow.map((item, index) => (
                  <GlassCard key={index} className="p-5 flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {PLATFORM_ICONS[item.platform] || PLATFORM_ICONS.UNKNOWN}
                        <span className="font-semibold text-gray-100 text-sm">{item.platform}</span>
                      </div>
                      <Badge variant="neutral">{item.post_count} posts</Badge>
                    </div>

                    <time className="text-xs text-gray-400 font-mono">First seen: {formatTime(item.first_seen)}</time>

                    <p className="text-xs text-gray-300 line-clamp-3 bg-white/[0.02] p-2.5 rounded-lg border border-white/5">
                      "{item.sample_text}"
                    </p>
                  </GlassCard>
                ))}
              </div>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  );
}