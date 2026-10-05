import { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, Clock } from 'lucide-react';
import { Badge, GlassCard, KpiCard, ChartCard, PillTabs } from './ui/primitives';

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
      setData(res.data);
    } catch (error) {
      console.error("Error fetching mutation data:", error);
      setData(null);
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

      {loading ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <Activity className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-300 font-medium">Analyzing narrative mutation history…</p>
        </GlassCard>
      ) : !data ? (
        <GlassCard className="p-12 text-center">
          <Activity className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-gray-200">No mutation data available</h2>
          <p className="text-gray-400 text-sm">Select a narrative filter above to load intelligence tracking.</p>
        </GlassCard>
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

          {/* Secondary Section: 12-Column Grid for Events & Intelligence Summary */}
          <div className="netra-grid-12">
            <div className="col-span-12 lg:col-span-7">
              <GlassCard className="p-6 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-gray-100">Narrative Mutation Events</h2>
                    <Badge variant="accent">{data.mutations.length} mutations</Badge>
                  </div>
                  {data.mutations.length === 0 ? (
                    <p className="text-gray-400 text-sm py-4">No significant mutations detected.</p>
                  ) : (
                    <div className="space-y-4">
                      {data.mutations.slice(0, 5).map((m, i) => (
                        <div key={i} className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="accent">{m.phase}</Badge>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {m.time}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {m.new_elements.map((el, j) => (
                              <Badge key={j} variant="neutral">+ {el}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-gray-300">
                            Sentiment shifted to:{' '}
                            <strong style={{ color: SENTIMENT_COLORS[m.sentiment_shift] || '#f2f3fa' }}>
                              {m.sentiment_shift}
                            </strong>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>

            <div className="col-span-12 lg:col-span-5">
              <GlassCard className="p-6 h-full space-y-4">
                <h2 className="text-base font-semibold text-gray-100">Intelligence Synthesis</h2>
                <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
                  <p>
                    The <strong className="text-gray-100">{data.narrative}</strong> narrative has been tracked across <strong className="text-gray-100">{data.total_observations}</strong> telemetry points.
                  </p>
                  <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-xs text-indigo-200">
                    <strong>Key Finding:</strong> Mutated <strong>{data.mutations.length}</strong> times, introducing new entities and shifting sentiment from
                    <span className="text-gray-100"> {data.timeline[0]?.sentiment || 'Neutral'}</span> to
                    <strong style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length-1]?.sentiment] }}> {data.timeline[data.timeline.length-1]?.sentiment}</strong>.
                  </div>
                  <p className="text-xs text-gray-400">
                    <strong>Actionable Insight:</strong> Monitor newly introduced entities for potential escalation across social channels.
                  </p>
                </div>
              </GlassCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}