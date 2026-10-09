import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Network, Users, GitMerge, Layers, RefreshCw, Share2, MessageSquare, Globe, Video } from 'lucide-react';
import { Badge, Button, Card } from './ui/primitives';
import { API_URL } from '../config';
import './NetworkIntelligenceView.css';

const COLORS = ['var(--ds-color-accent)', 'var(--ds-color-accent-dim)', 'var(--ds-color-chart-muted-1)', 'var(--ds-color-chart-muted-2)', 'var(--ds-color-chart-muted-3)', 'var(--ds-color-chart-muted-4)', 'var(--ds-color-blue-muted)'];

// ✅ ADDED: Helper to show platform icons in the intelligence lists
const getPlatformIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('youtube')) return <Video className="w-4 h-4" />;
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
    <section className="network-intel" aria-labelledby="network-intel-heading" aria-busy={loading}>
      <header className="network-intel__header">
        <div className="network-intel__heading">
          <span className="network-intel__heading-icon" aria-hidden="true"><Network /></span>
          <div>
            <p className="network-intel__eyebrow">Network Analysis</p>
            <h1 id="network-intel-heading">Network <span>Intelligence</span></h1>
            <p>Centrality, bridge nodes, and community detection.</p>
          </div>
        </div>
        <Button variant="secondary" loading={loading} onClick={fetchIntelligence} className="network-intel__refresh">
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          {loading ? 'Recalculating…' : 'Recalculate'}
        </Button>
      </header>

      {loading ? (
        <Card className="network-intel__state" role="status">
          <RefreshCw className="network-intel__state-icon animate-spin" />
          <p>Running graph algorithms…</p>
        </Card>
      ) : !data || ![data.influencers, data.bridges, data.communities].some((items) => items?.length > 0) ? (
        <Card className="network-intel__state">
          <Network className="network-intel__state-icon" />
          <h2>No network intelligence data</h2>
          <p>{data?.message || 'No graph intelligence data available.'}</p>
        </Card>
      ) : (
        <>
          <div className="network-intel__stats">
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><Users aria-hidden="true" /><span>Top Influencers</span></div>
              <strong>{data.influencers?.length || 0}</strong>
              <p>Highest degree centrality</p>
            </Card>
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><GitMerge aria-hidden="true" /><span>Bridge Nodes</span></div>
              <strong>{data.bridges?.length || 0}</strong>
              <p>Cross-community connectors</p>
            </Card>
            <Card className="network-intel__stat">
              <div className="network-intel__stat-label"><Layers aria-hidden="true" /><span>Communities</span></div>
              <strong>{data.communities?.length || 0}</strong>
              <p>Distinct node clusters</p>
            </Card>
          </div>

          <div className="network-intel__grid">
            <Card className="network-intel__panel">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><Users aria-hidden="true" /><h2>Top Influencers</h2></div>
                <Badge variant="accent">Degree Centrality</Badge>
              </header>
              <div className="network-intel__list">
                {data.influencers?.length > 0 ? data.influencers.map((inf, i) => (
                  <article key={i} className="network-intel__influencer">
                    <span className="network-intel__rank">{i + 1}</span>
                    <span className="network-intel__entity-icon" aria-hidden="true">{inf.type === 'Platform' && getPlatformIcon(inf.name)}</span>
                    <div className="network-intel__entity">
                      <h3>{formatName(inf.name)}</h3>
                      <Badge variant="neutral">{inf.type || 'Entity'}</Badge>
                    </div>
                    <div className="network-intel__metric">
                      <strong>{inf.degree}</strong><span>Connections</span>
                    </div>
                  </article>
                )) : (
                  <div className="network-intel__empty">No influencer data available.</div>
                )}
              </div>
            </Card>

            <Card className="network-intel__panel">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><GitMerge aria-hidden="true" /><h2>Bridge Nodes</h2></div>
                <Badge variant="warning">Cross-Community</Badge>
              </header>
              <p className="network-intel__description">Entities that connect disparate platforms or narratives, acting as information conduits.</p>
              <div className="network-intel__list">
                {data.bridges?.length > 0 ? data.bridges.map((bridge, i) => (
                  <article key={i} className="network-intel__bridge">
                    <div className="network-intel__bridge-entity">
                      {['YOUTUBE', 'X', 'TWITTER', 'REDDIT'].includes(bridge.name.toUpperCase()) && getPlatformIcon(bridge.name)}
                      <h3>{formatName(bridge.name)}</h3>
                    </div>
                    <Badge variant="accent">Score: {bridge.bridge_score}</Badge>
                  </article>
                )) : (
                  <div className="network-intel__empty">No strong bridge nodes detected in current graph topology.</div>
                )}
              </div>
            </Card>

            <Card className="network-intel__panel network-intel__communities">
              <header className="network-intel__panel-heading">
                <div className="network-intel__panel-title"><Layers aria-hidden="true" /><h2>Community Clusters</h2></div>
              </header>
              {data.communities?.length > 0 ? (
                <div className="network-intel__chart">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.communities}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                      <XAxis dataKey="community" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                      <YAxis stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} cursor={{ fill: 'var(--ds-color-glass-hover)' }} />
                      <Bar dataKey="size" radius={[4, 4, 0, 0]}>
                        {data.communities.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="network-intel__empty">No community data available.</div>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}