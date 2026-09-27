import { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, AlertTriangle, TrendingUp, Clock } from 'lucide-react';

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
  POSITIVE: '#10b981',
  NEGATIVE: '#ef4444',
  NEUTRAL: '#f59e0b',
  ABSTAIN: '#6b7280'
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

  return (
    <div className="space-y-6">
      {/* Header & Selector */}
      <div className="flex justify-between items-center p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
        <div>
          <h1 className="text-2xl font-bold tracking-wider" style={{ color: '#00f0ff' }}>
            NARRATIVE MUTATION TRACKER
          </h1>
          <p className="text-sm text-gray-400 mt-1">Track how intelligence narratives evolve over time</p>
        </div>
        <select 
          value={selectedNarrative}
          onChange={(e) => setSelectedNarrative(e.target.value)}
          className="px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-cyan-500"
        >
          {AVAILABLE_NARRATIVES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Analyzing narrative evolution...</div>
      ) : !data ? (
        <div className="text-center py-20 text-gray-400">No mutation data available.</div>
      ) : (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Total Observations</div>
              <div className="text-3xl font-bold text-white">{data.total_observations}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Mutation Events</div>
              <div className="text-3xl font-bold text-cyan-400">{data.mutations.length}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Current Sentiment</div>
              <div className="text-3xl font-bold" style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length-1]?.sentiment] || '#fff' }}>
                {data.timeline[data.timeline.length-1]?.sentiment || 'N/A'}
              </div>
            </div>
          </div>

          {/* Timeline Chart */}
          <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
              <Activity className="w-5 h-5" />
              ACTIVITY TIMELINE
            </h2>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <AreaChart data={data.timeline}>
                  <defs>
                    <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="phase" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333' }}
                    itemStyle={{ color: '#00f0ff' }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#00f0ff" fillOpacity={1} fill="url(#colorVolume)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Mutation Cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <TrendingUp className="w-5 h-5" />
                NARRATIVE EVOLUTION
              </h2>
              <div className="space-y-4">
                {data.mutations.length === 0 ? (
                  <p className="text-gray-400 text-sm">No significant mutations detected.</p>
                ) : (
                  data.mutations.map((m, i) => (
                    <div key={i} className="p-4 rounded border-l-4" style={{ backgroundColor: '#0a0a0f', borderColor: '#00f0ff' }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-cyan-400 uppercase">{m.phase}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {m.time}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {m.new_elements.map((el, j) => (
                          <span key={j} className="px-2 py-1 rounded text-xs font-medium bg-gray-800 text-white border border-gray-700">
                            + {el}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 text-xs text-gray-400">
                        Sentiment shifted to: <span className="font-bold" style={{ color: SENTIMENT_COLORS[m.sentiment_shift] || '#fff' }}>{m.sentiment_shift}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Summary / Insight Panel */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <AlertTriangle className="w-5 h-5" />
                INTELLIGENCE SUMMARY
              </h2>
              <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                <p>
                  The <span className="text-cyan-400 font-bold">{data.narrative}</span> narrative has been tracked across {data.total_observations} observations.
                </p>
                <p>
                  <strong className="text-white">Key Finding:</strong> The narrative has mutated {data.mutations.length} times, introducing new entities and shifting sentiment from 
                  <span className="text-gray-400"> {data.timeline[0]?.sentiment || 'Neutral'}</span> to 
                  <span className="font-bold" style={{ color: SENTIMENT_COLORS[data.timeline[data.timeline.length-1]?.sentiment] }}> {data.timeline[data.timeline.length-1]?.sentiment}</span>.
                </p>
                <p>
                  <strong className="text-white">Recommendation:</strong> Monitor the newly introduced entities for potential escalation.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}