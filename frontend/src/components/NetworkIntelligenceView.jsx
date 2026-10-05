import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Network, Users, GitMerge, Layers, RefreshCw, Share2, MessageSquare, Globe, Video } from 'lucide-react';
import { Badge, Button, GlassCard, KpiCard, ChartCard } from './ui/primitives';
import { WhyNothingArriving } from './ui/dataState';

import { API_URL } from '../config';

const getPlatformIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('youtube')) return <Video className="w-4 h-4 text-red-400" />;
  if (n.includes('twitter') || n.includes('x')) return <Share2 className="w-4 h-4 text-blue-400" />;
  if (n.includes('reddit')) return <MessageSquare className="w-4 h-4 text-orange-400" />;
  return <Globe className="w-4 h-4 text-emerald-400" />;
};

export default function NetworkIntelligenceView({ refreshKey = 0 }) {
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
  }, [refreshKey]);

  return (
    <div className="space-y-8" aria-busy={loading}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Graph Centrality & Clusters</span>
          <h1 className="netra-page-title">Network <span>Intelligence</span></h1>
          <p className="netra-page-subtitle">Degree centrality, cross-domain bridge nodes, and community structure.</p>
        </div>

        <Button variant="secondary" loading={loading} onClick={fetchIntelligence}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          {loading ? 'Recalculating…' : 'Recalculate'}
        </Button>
      </div>

      {loading ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-300 font-medium">Computing graph centrality metrics…</p>
        </GlassCard>
      ) : !data || ![data.influencers, data.bridges, data.communities].some((items) => items?.length > 0) ? (
        <div className="space-y-3">
          <GlassCard className="p-12 text-center">
            <Network className="w-8 h-8 text-gray-500 mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-gray-200">Graph intelligence returned no influencers, bridges, or communities.</h2>
            {data?.message && <p className="text-gray-400 text-sm">{data.message}</p>}
          </GlassCard>
          <WhyNothingArriving />
        </div>
      ) : (
        <>
          {/* Row of Max 4 KPI Cards */}
          <div className="netra-grid-12">
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Top Influencers"
                value={data.influencers?.length || 0}
                delta="Highest degree"
                deltaType="positive"
                subtext="Central nodes"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Bridge Nodes"
                value={data.bridges?.length || 0}
                delta="Cross-connectors"
                deltaType="warning"
                subtext="Inter-group links"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Communities"
                value={data.communities?.length || 0}
                delta="Clusters"
                deltaType="neutral"
                subtext="Distinct groups"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Total Graph Nodes"
                value={data.total_nodes || 0}
                delta="Network size"
                deltaType="positive"
                subtext="Mapped entities"
              />
            </div>
          </div>

          {/* Main Visualizations Grid */}
          <div className="netra-grid-12">
            <div className="col-span-12 lg:col-span-6">
              <ChartCard title="Top Key Influencers" subtitle="Highest degree centrality nodes">
                <div className="space-y-3 p-2">
                  {(data.influencers || []).slice(0, 5).map((inf, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        {getPlatformIcon(inf.name)}
                        <div>
                          <span className="font-semibold text-gray-100 text-sm">{inf.name}</span>
                          <span className="block text-xs text-gray-400">{inf.type || 'Entity'}</span>
                        </div>
                      </div>
                      <Badge variant="accent">{inf.degree} connections</Badge>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <div className="col-span-12 lg:col-span-6">
              <ChartCard title="Cross-Domain Bridge Nodes" subtitle="Nodes connecting separate clusters">
                <div className="space-y-3 p-2">
                  {(data.bridges || []).slice(0, 5).map((bridge, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <GitMerge className="w-4 h-4 text-indigo-400" />
                        <div>
                          <span className="font-semibold text-gray-100 text-sm">{bridge.name}</span>
                          <span className="block text-xs text-gray-400">{bridge.type || 'Topic'}</span>
                        </div>
                      </div>
                      <Badge variant="warning">{bridge.bridges_count || bridge.size || 1} bridges</Badge>
                    </div>
                  ))}
                </div>
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}