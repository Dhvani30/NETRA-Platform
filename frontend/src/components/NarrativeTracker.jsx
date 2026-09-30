import { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import { Badge, Card } from './ui/primitives';
import './NarrativeTracker.css';

const API_URL = 'http://localhost:8000/api/v1';

// Pre-defined narratives to track (matches your database)
const AVAILABLE_NARRATIVES = [
  "Cyber Attack",
  "AI Development and Regulation",
  "Defence and Security",
  "South China Sea Tensions",
  "Financial Technology",
  "Startup Ecosystem"
];

const SENTIMENT_COLORS = {
  POSITIVE: 'var(--ds-color-green-muted)',
  NEGATIVE: 'var(--ds-color-red-muted)',
  NEUTRAL: 'var(--ds-color-amber-muted)',
  ABSTAIN: 'var(--ds-color-text-3)'
};

export default function NarrativeTracker() {
  const [selectedNarrative, setSelectedNarrative] = useState("Cyber Attack");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMutationData(selectedNarrative);
  }, [selectedNarrative]);

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

  // ✅ ADDED: Platform icon helper for consistency across the app
  return (
    <section className="narrative-tracker" aria-labelledby="mutation-heading" aria-busy={loading}>
      <header className="narrative-tracker__header">
        <div className="narrative-tracker__heading">
          <p className="narrative-tracker__eyebrow">Narrative Tracker</p>
          <h1 id="mutation-heading">Narrative <span>Mutation</span></h1>
          <p>Track how intelligence narratives evolve over time.</p>
        </div>
        <label className="narrative-tracker__selector">
          <span>Tracked narrative</span>
          <select value={selectedNarrative} onChange={(e) => setSelectedNarrative(e.target.value)} className="narrative-tracker__select">
            {AVAILABLE_NARRATIVES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </header>
      {loading ? (
        <Card className="narrative-tracker__state" role="status">
          <Activity className="narrative-tracker__state-icon animate-spin" />
          <p>Analyzing narrative evolution…</p>
        </Card>
      ) : !data ? (
        <Card className="narrative-tracker__state" role="status">
          <Activity className="narrative-tracker__state-icon" />
          <h2>No mutation data available</h2>
          <p>Select a narrative to view its tracking data.</p>
        </Card>
      ) : (
        <>
          <div className="narrative-tracker__stats">
            <Card className="narrative-tracker__stat">
              <span className="narrative-tracker__stat-label">Total Observations</span>
              <strong>{data.total_observations}</strong>
            </Card>
            <Card className="narrative-tracker__stat">
              <span className="narrative-tracker__stat-label">Mutation Events</span>
              <strong className="narrative-tracker__stat-accent">{data.mutations.length}</strong>
            </Card>
            <Card className="narrative-tracker__stat">
              <span className="narrative-tracker__stat-label">Current Sentiment</span>
              <strong className="narrative-tracker__stat-sentiment" style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length-1]?.sentiment] || 'var(--ds-color-text-1)' }}>
                {data.timeline[data.timeline.length-1]?.sentiment || 'N/A'}
              </strong>
            </Card>
          </div>
          <Card className="narrative-tracker__panel narrative-tracker__timeline">
            <header className="narrative-tracker__panel-heading">
              <div className="narrative-tracker__panel-title"><Activity aria-hidden="true" /><h2>Activity Timeline</h2></div>
            </header>
            {data.timeline.length === 0 ? (
              <div className="narrative-tracker__empty"><p>No timeline observations available.</p></div>
            ) : (
              <div className="narrative-tracker__chart">
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={data.timeline}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--ds-color-accent)" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="var(--ds-color-accent)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                    <XAxis dataKey="phase" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                    <YAxis stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} itemStyle={{ color: 'var(--ds-color-accent-bright)' }} />
                    <Area type="monotone" dataKey="volume" stroke="var(--ds-color-accent-bright)" fillOpacity={1} fill="url(#colorVolume)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <div className="narrative-tracker__details">
            <Card className="narrative-tracker__panel">
              <header className="narrative-tracker__panel-heading">
                <div className="narrative-tracker__panel-title"><TrendingUp aria-hidden="true" /><h2>Narrative Evolution</h2></div>
                <Badge variant="accent">{data.mutations.length} events</Badge>
              </header>
              {data.mutations.length === 0 ? (
                <div className="narrative-tracker__empty"><p>No significant mutations detected.</p></div>
              ) : (
                <ol className="narrative-tracker__events">
                  {data.mutations.map((m, i) => (
                    <li key={i} className="narrative-tracker__event">
                      <div className="narrative-tracker__event-heading">
                        <Badge variant="accent">{m.phase}</Badge>
                        <span className="narrative-tracker__event-time"><Clock aria-hidden="true" />{m.time}</span>
                      </div>
                      <div className="narrative-tracker__elements">
                        {m.new_elements.map((el, j) => <Badge key={j} variant="neutral">+ {el}</Badge>)}
                      </div>
                      <p className="narrative-tracker__sentiment">
                        Sentiment shifted to:{' '}
                        <strong style={{ color: SENTIMENT_COLORS[m.sentiment_shift] || 'var(--ds-color-text-1)' }}>{m.sentiment_shift}</strong>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
            <Card className="narrative-tracker__panel narrative-tracker__summary">
              <header className="narrative-tracker__panel-heading">
                <div className="narrative-tracker__panel-title"><AlertTriangle aria-hidden="true" /><h2>Intelligence Summary</h2></div>
              </header>
              <div className="narrative-tracker__summary-copy">
                <p>The <strong>{data.narrative}</strong> narrative has been tracked across <strong>{data.total_observations}</strong> observations.</p>
                <p>
                  <strong>Key Finding:</strong> The narrative has mutated <strong>{data.mutations.length}</strong> times, introducing new entities and shifting sentiment from
                  <span> {data.timeline[0]?.sentiment || 'Neutral'}</span> to
                  <strong style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length-1]?.sentiment] }}> {data.timeline[data.timeline.length-1]?.sentiment}</strong>.
                </p>
                <p><strong>Recommendation:</strong> Monitor the newly introduced entities for potential escalation.</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </section>
  );
}