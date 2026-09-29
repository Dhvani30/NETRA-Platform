import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, Globe, Briefcase, Languages, ShieldCheck } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';

const COLORS = ['#00f0ff', '#a855f7', '#ec4899', '#3b82f6', '#eab308', '#10b981', '#ef4444'];

export default function DemographicsView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDemographics();
  }, []);

  const fetchDemographics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/demographics?t=${Date.now()}`);
      setData(res.data);
    } catch (error) {
      console.error("Error fetching demographics:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-purple-900/30 border border-purple-600">
            <Users className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-white">
              AUDIENCE DEMOGRAPHICS
            </h1>
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              Privacy-Safe Aggregated Inference • No PII Stored
            </p>
          </div>
        </div>
        <button 
          onClick={fetchDemographics}
          disabled={loading}
          className={`px-4 py-2 rounded text-white text-sm font-medium transition-all ${
            loading ? 'bg-gray-600 cursor-wait' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          Refresh Analysis
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Inferring audience demographics...</div>
      ) : !data || data.total_analyzed === 0 ? (
        <div className="text-center py-20 text-gray-400">No data available for demographic inference.</div>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Total Analyzed</div>
              <div className="text-3xl font-bold text-white">{data.total_analyzed}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Active Regions</div>
              <div className="text-3xl font-bold text-cyan-400">{data.regions?.length || 0}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Professional Sectors</div>
              <div className="text-3xl font-bold text-purple-400">{data.professions?.length || 0}</div>
            </div>
            <div className="p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <div className="text-sm text-gray-400 mb-1">Languages Detected</div>
              <div className="text-3xl font-bold text-emerald-400">{data.languages?.length || 0}</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Professional Interest */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Briefcase className="w-5 h-5" /> PROFESSIONAL INTEREST (Inferred)
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={data.professions || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis type="number" stroke="#888" />
                    <YAxis dataKey="name" type="category" width={150} stroke="#888" style={{ fontSize: '12px' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Bar dataKey="value" fill="#a855f7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic Region */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Globe className="w-5 h-5" /> GEOGRAPHIC REGION (Inferred)
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie 
                      data={data.regions || []} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      outerRadius={100} 
                      label={({ name, percent }) => name ? `${name} ${(percent * 100).toFixed(0)}%` : ''} 
                      labelLine={false}
                    >
                      {(data.regions || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Age Bracket */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Users className="w-5 h-5" /> AGE BRACKET (Platform Heuristic)
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={data.age_brackets || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" stroke="#888" />
                    <YAxis stroke="#888" />
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Bar dataKey="value" fill="#ec4899" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Language */}
            <div className="p-6 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: '#00f0ff' }}>
                <Languages className="w-5 h-5" /> LANGUAGE DISTRIBUTION
              </h2>
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie 
                      data={data.languages || []} 
                      dataKey="value" 
                      nameKey="name" 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={5}
                    >
                      {(data.languages || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#13131f', border: '1px solid #333', color: '#fff' }} />
                    <Legend wrapperStyle={{ color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}