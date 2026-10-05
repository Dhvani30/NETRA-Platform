import { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock } from 'lucide-react';
import { Badge, KpiCard, ChartCard, PillTabs } from './ui/primitives';
import { EmptyState, ErrorState, ScreenSkeleton } from './ui/dataState';

import { API_URL } from '../config';

const SENTIMENT_COLORS = {
  POSITIVE: 'var(--ds-color-green-muted)',
  NEGATIVE: 'var(--ds-color-red-muted)',
  NEUTRAL: 'var(--ds-color-amber-muted)',
  ABSTAIN: 'var(--ds-color-text-3)'
};

export default function NarrativeTracker({ refreshKey = 0 }) {
  const [narratives, setNarratives] = useState([]);
  const [selectedNarrative, setSelectedNarrative] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API_URL}/analytics/narratives`).then(result => {
      const names = (result.data?.clusters || []).map(row => row.name).filter(Boolean);
      setNarratives(names);
      setSelectedNarrative(current => current || names[0] || '');
    }).catch(() => setNarratives([]));
  }, [refreshKey]);

  useEffect(() => {
    if (selectedNarrative) fetchMutationData(selectedNarrative);
  }, [selectedNarrative, refreshKey]);

  const fetchMutationData = async (narrative) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/mutation?narrative=${encodeURIComponent(narrative)}`);
      setData(res.data?.timeline ? res.data : null);
      setError(null);
    } catch (error) {
      setError("Can't reach the NETRA API. Start the backend and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8" aria-busy={loading}>
      {/* Page Header & Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Mutation Tracker</span>
          <h1 className="netra-page-title">Narrative <span>Mutation</span></h1>
          <p className="netra-page-subtitle">Track how intelligence narratives evolve and morph across time.</p>
        </div>

        {/* Max 3 Filter Pills per row with overflow dropdown */}
        <div className="flex items-center gap-2">
          <PillTabs
            tabs={narratives}
            activeTab={selectedNarrative}
            onChange={(narrative) => setSelectedNarrative(narrative)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={{ message: error }} onRetry={() => selectedNarrative && fetchMutationData(selectedNarrative)} />
      ) : loading ? (
        <ScreenSkeleton />
      ) : !data ? (
        <EmptyState>No mutation history was returned for this narrative.</EmptyState>
      ) : (
        <>
          {/* Row of Max 4 KPI Cards */}
          <div className="netra-grid-12">
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Total Observations"
                value={data.total_observations}
                delta={data.timeline.length > 1 ? `${data.timeline.length} epochs` : 'Baseline'}
                deltaType="positive"
                subtext="Sample size"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Mutation Events"
                value={data.mutations.length}
                delta={data.mutations.length > 2 ? 'High Drift' : (data.mutations.length > 0 ? 'Moderate' : 'Stable')}
                deltaType={data.mutations.length > 2 ? 'warning' : 'neutral'}
                subtext="Semantic shifts"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Current Sentiment"
                value={data.timeline[data.timeline.length - 1]?.sentiment || 'N/A'}
                delta="Latest phase"
                deltaType="neutral"
                subtext="Current classification"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Tracking Velocity"
                value={data.mutations.length > 2 ? 'High' : (data.mutations.length > 0 ? 'Moderate' : 'Stable')}
                delta={data.total_observations > 20 ? 'Active' : 'Nominal'}
                deltaType="positive"
                subtext="Propagation rate"
              />
            </div>
          </div>

          {/* Main Focal Visualization: Activity Timeline */}
          <ChartCard
            title="Activity Timeline & Volume"
            subtitle={`Evolution phases for "${data.narrative}"`}
            action={<Badge variant="accent">{data.timeline.length} phases</Badge>}
          >
            {data.timeline.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No timeline observations available.</div>
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.timeline}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#9a9ee8" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#9a9ee8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                    <XAxis dataKey="phase" stroke="#5b5f7a" tick={{ fill: '#8e92b0', fontSize: 11 }} />
                    <YAxis stroke="#5b5f7a" tick={{ fill: '#8e92b0', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 17, 35, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#f2f3fa' }} />
                    <Area type="monotone" dataKey="volume" stroke="#b8bbee" strokeWidth={2} fillOpacity={1} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-gray-100">Narrative Mutation Events</h2>
              <Badge variant="accent">{data.mutations.length} mutations</Badge>
            </div>
            {data.mutations.length === 0 ? (
              <div className="glass relative z-10 p-6 text-sm text-slate-400">No significant mutations detected.</div>
            ) : (
              <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.mutations.map((m, i) => (
                  <article key={`${m.phase}-${i}`} className="glass relative z-10 p-4">
                    <header className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-medium text-white">{m.phase}</h3>
                      <span className="pill shrink-0 font-mono text-[10px]">M-{String(i + 1).padStart(2, '0')}</span>
                    </header>
                    <dl className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 p-2">
                        <dt className="label-xs">Time</dt>
                        <dd className="mt-1 flex items-center gap-1 font-mono text-xs text-slate-200">
                          <Clock className="h-3 w-3" /> {m.time}
                        </dd>
                      </div>
                      <div className="rounded-lg border border-white/10 p-2">
                        <dt className="label-xs">Sentiment</dt>
                        <dd className="mt-1 font-mono text-xs" style={{ color: SENTIMENT_COLORS[m.sentiment_shift] || '#f2f3fa' }}>
                          {m.sentiment_shift}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {m.new_elements.map((el, j) => (
                        <Badge key={j} variant="neutral">+ {el}</Badge>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <article className="glass relative z-10 p-4">
            <header className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-medium text-gray-100">Intelligence Synthesis</h2>
              <span className="pill font-mono text-[10px]">{data.narrative}</span>
            </header>
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <dt className="label-xs">Observations</dt>
                <dd className="mt-1 font-mono text-sm text-white">{data.total_observations}</dd>
              </div>
              <div>
                <dt className="label-xs">Mutations</dt>
                <dd className="mt-1 font-mono text-sm text-white">{data.mutations.length}</dd>
              </div>
              <div>
                <dt className="label-xs">Start</dt>
                <dd className="mt-1 font-mono text-sm text-white">{data.timeline[0]?.sentiment || 'Neutral'}</dd>
              </div>
              <div>
                <dt className="label-xs">Latest</dt>
                <dd className="mt-1 font-mono text-sm" style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length - 1]?.sentiment] || '#f2f3fa' }}>
                  {data.timeline[data.timeline.length - 1]?.sentiment || 'Neutral'}
                </dd>
              </div>
            </dl>
          </article>
        </>
      )}
    </div>
  );
}