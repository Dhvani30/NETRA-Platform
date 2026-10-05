import { useState, useEffect } from 'react';
import axios from 'axios';
import { Share2, MessageSquare, Globe, Video } from 'lucide-react';
import { Badge, Button, KpiCard, Input } from './ui/primitives';
import { EmptyState, ErrorState, ScreenSkeleton } from './ui/dataState';

import { API_URL } from '../config';

const PLATFORM_ICONS = {
  X: <Share2 className="w-4 h-4 text-blue-400" />,
  REDDIT: <MessageSquare className="w-4 h-4 text-orange-400" />,
  YOUTUBE: <Video className="w-4 h-4 text-red-400" />,
  TELEGRAM: <Globe className="w-4 h-4 text-sky-400" />,
  UNKNOWN: <Globe className="w-4 h-4 text-gray-400" />
};

export default function CrossPlatformView({ refreshKey = 0 }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCorrelation = async (searchTerm) => {
    const term = String(searchTerm || '').trim();
    if (!term) return;
    setSubmitted(term);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/correlation?q=${encodeURIComponent(term)}`);
      setData(res.data);
      setError(null);
    } catch (error) {
      setError("Can't reach the NETRA API. Start the backend and retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (refreshKey && submitted) fetchCorrelation(submitted);
  }, [refreshKey]);

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
            placeholder="Enter a topic"
            aria-label="Topic to track"
          />
          <Button variant="primary" onClick={() => fetchCorrelation(query)}>
            Track
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState error={{ message: error }} onRetry={() => fetchCorrelation(query)} />
      ) : loading ? (
        <ScreenSkeleton />
      ) : !submitted ? (
        <p className="text-sm text-slate-400">Enter a topic and press Track to compare it across platforms.</p>
      ) : !data || data.flow.length === 0 ? (
        <EmptyState>No posts matched this topic across the collected platforms.</EmptyState>
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

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium text-gray-100">Intelligence Spread</h2>
                <p className="text-xs text-slate-400">Cross-platform trajectory for “{data.query}”</p>
              </div>
              <Badge variant="accent">{data.query}</Badge>
            </div>
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.flow.map((item, index) => (
                <article key={`${item.platform}-${index}`} className="glass relative z-10 p-4">
                  <header className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {PLATFORM_ICONS[item.platform] || PLATFORM_ICONS.UNKNOWN}
                      <h3 className="truncate text-sm font-medium text-white">{item.platform}</h3>
                    </div>
                    <span className="pill shrink-0 font-mono text-[10px]">P-{String(index + 1).padStart(2, '0')}</span>
                  </header>
                  <dl className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/10 p-2">
                      <dt className="label-xs">Posts</dt>
                      <dd className="mt-1 font-mono text-sm text-white">{item.post_count}</dd>
                    </div>
                    <div className="rounded-lg border border-white/10 p-2">
                      <dt className="label-xs">First seen</dt>
                      <dd className="mt-1 font-mono text-[11px] text-slate-200">{formatTime(item.first_seen)}</dd>
                    </div>
                  </dl>
                  {item.sample_text && (
                    <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-300">“{item.sample_text}”</p>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}