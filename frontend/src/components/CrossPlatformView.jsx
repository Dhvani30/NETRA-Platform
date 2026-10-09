import { useState, useEffect } from 'react';
import axios from 'axios';
import { Share2, MessageSquare, Globe, Activity, Video } from 'lucide-react';
import { Badge, Button, Card, Input } from './ui/primitives';
import { API_URL } from '../config';
import './CrossPlatformView.css';


const PLATFORM_ICONS = {
  X: <Share2 className="w-5 h-5" />,
  REDDIT: <MessageSquare className="w-5 h-5" />,
  YOUTUBE: <Video className="w-5 h-5" />, // Using Video icon
  TELEGRAM: <Globe className="w-5 h-5" />,
  UNKNOWN: <Globe className="w-5 h-5" />
};

const PLATFORM_COLORS = {
  X: 'var(--ds-color-accent-bright)',       // Blue
  REDDIT: 'var(--ds-color-accent-bright)',  // Red
  YOUTUBE: 'var(--ds-color-accent-bright)', // YouTube Red
  TELEGRAM: 'var(--ds-color-accent-bright)',// Telegram Blue
  UNKNOWN: 'var(--ds-color-text-3)'  // Gray
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
    <section className="cross-platform-view" aria-labelledby="correlation-heading" aria-busy={loading}>
      <header className="cross-platform-view__header">
        <div className="cross-platform-view__heading">
          <p className="cross-platform-view__eyebrow">Cross-Platform</p>
          <h1 id="correlation-heading">Correlation</h1>
          <p>Track how intelligence spreads across social networks.</p>
        </div>
        <div className="cross-platform-view__search">
          <Input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchCorrelation(query)} className="cross-platform-view__input" placeholder="Enter topic..." aria-label="Topic to track" />
          <Button variant="primary" onClick={() => fetchCorrelation(query)}>Track</Button>
        </div>
      </header>

      {loading ? (
        <Card className="cross-platform-view__state" role="status">
          <Activity className="cross-platform-view__state-icon animate-spin" />
          <p>Analyzing cross-platform spread…</p>
        </Card>
      ) : !data || data.flow.length === 0 ? (
        <Card className="cross-platform-view__state">
          <Globe className="cross-platform-view__state-icon" />
          <h2>No cross-platform data found</h2>
          <p>Try another topic to view its platform spread.</p>
        </Card>
      ) : (
        <>
          <div className="cross-platform-view__stats">
            <Card className="cross-platform-view__stat"><span className="cross-platform-view__stat-label">Topic Tracked</span><strong className="cross-platform-view__topic">{data.query}</strong></Card>
            <Card className="cross-platform-view__stat"><span className="cross-platform-view__stat-label">Platforms Involved</span><strong className="cross-platform-view__stat-accent">{data.flow.length}</strong></Card>
            <Card className="cross-platform-view__stat"><span className="cross-platform-view__stat-label">Total Observations</span><strong className="cross-platform-view__stat-accent">{data.total_posts}</strong></Card>
          </div>

          <Card className="cross-platform-view__panel">
            <header className="cross-platform-view__panel-heading">
              <div className="cross-platform-view__panel-title"><Activity aria-hidden="true" /><h2>Intelligence Spread Timeline</h2></div>
              <Badge variant="accent">{data.query}</Badge>
            </header>
            <div className="cross-platform-view__flow">
              {data.flow.map((item, index) => (
                <article key={index} className="cross-platform-view__flow-step" style={{ '--platform-tone': PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.UNKNOWN }}>
                  <div className="cross-platform-view__node" aria-hidden="true">{PLATFORM_ICONS[item.platform] || PLATFORM_ICONS.UNKNOWN}</div>
                  <h3>{item.platform}</h3>
                  <time>{formatTime(item.first_seen)}</time>
                  <Badge variant="neutral">{item.post_count} posts</Badge>
                  <p>{item.sample_text}</p>
                </article>
              ))}
            </div>
          </Card>

          <Card className="cross-platform-view__panel">
            <header className="cross-platform-view__panel-heading">
              <div className="cross-platform-view__panel-title"><Globe aria-hidden="true" /><h2>Platform Breakdown</h2></div>
            </header>
            <div className="cross-platform-view__breakdown">
              {data.flow.map((item, index) => (
                <article key={index} className="cross-platform-view__breakdown-item" style={{ '--platform-tone': PLATFORM_COLORS[item.platform] || PLATFORM_COLORS.UNKNOWN }}>
                  <div className="cross-platform-view__platform-info">
                    <span className="cross-platform-view__platform-icon" aria-hidden="true">{PLATFORM_ICONS[item.platform]}</span>
                    <div><h3>{item.platform}</h3><p>First detected: {formatTime(item.first_seen)}</p></div>
                  </div>
                  <div className="cross-platform-view__platform-data">
                    <strong>{item.post_count} posts</strong><p>{item.sample_text}</p>
                  </div>
                </article>
              ))}
            </div>
          </Card>
        </>
      )}
    </section>
  );
}