import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Users, Globe, Briefcase, Languages, ShieldCheck, RefreshCw } from 'lucide-react';
import { Badge, Button, Card } from './ui/primitives';
import './DemographicsView.css';

const API_URL = 'http://localhost:8000/api/v1';

const COLORS = ['var(--ds-color-accent)', 'var(--ds-color-accent-dim)', 'var(--ds-color-chart-muted-1)', 'var(--ds-color-chart-muted-2)', 'var(--ds-color-chart-muted-3)', 'var(--ds-color-chart-muted-4)', 'var(--ds-color-blue-muted)'];

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
    <section className="demographics-view" aria-labelledby="demographics-heading" aria-busy={loading}>
      <header className="demographics-view__header">
        <div className="demographics-view__heading">
          <span className="demographics-view__heading-icon" aria-hidden="true"><Users /></span>
          <div>
            <p className="demographics-view__eyebrow">Privacy-Safe</p>
            <h1 id="demographics-heading">Audience <span>Demographics</span></h1>
            <p>Aggregated inference with no personally identifiable information.</p>
          </div>
        </div>
        <div className="demographics-view__actions">
          <Badge variant="success"><ShieldCheck aria-hidden="true" />Aggregated · No PII</Badge>
          <Button variant="secondary" loading={loading} onClick={fetchDemographics}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh Analysis
          </Button>
        </div>
      </header>

      {loading ? (
        <Card className="demographics-view__state" role="status">
          <RefreshCw className="demographics-view__state-icon animate-spin" />
          <p>Inferring audience demographics…</p>
        </Card>
      ) : !data || data.total_analyzed === 0 || ![data.regions, data.professions, data.age_brackets, data.languages].some((items) => items?.length > 0) ? (
        <Card className="demographics-view__state">
          <Users className="demographics-view__state-icon" />
          <h2>No demographic data available</h2>
          <p>No data available for demographic inference.</p>
        </Card>
      ) : (
        <>
          <div className="demographics-view__stats">
            <Card className="demographics-view__stat">
              <span>Total Analyzed</span><strong>{data.total_analyzed}</strong>
            </Card>
            <Card className="demographics-view__stat">
              <span>Active Regions</span><strong className="demographics-view__accent">{data.regions?.length || 0}</strong>
            </Card>
            <Card className="demographics-view__stat">
              <span>Professional Sectors</span><strong className="demographics-view__accent">{data.professions?.length || 0}</strong>
            </Card>
            <Card className="demographics-view__stat">
              <span>Languages Detected</span><strong className="demographics-view__accent">{data.languages?.length || 0}</strong>
            </Card>
          </div>

          <div className="demographics-view__grid">
            <Card className="demographics-view__panel">
              <header className="demographics-view__panel-heading">
                <div className="demographics-view__panel-title"><Briefcase aria-hidden="true" /><h2>Professional Interest</h2></div>
                <Badge variant="neutral">Inferred</Badge>
              </header>
              {(data.professions || []).length === 0 ? (
                <div className="demographics-view__empty"><p>No professional interest data available.</p></div>
              ) : (
                <div className="demographics-view__chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.professions || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={76} paddingAngle={2}>
                        {(data.professions || []).map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} />
                      <Legend wrapperStyle={{ color: 'var(--ds-color-text-2)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="demographics-view__panel">
              <header className="demographics-view__panel-heading">
                <div className="demographics-view__panel-title"><Globe aria-hidden="true" /><h2>Geographic Region</h2></div>
                <Badge variant="neutral">Inferred</Badge>
              </header>
              {(data.regions || []).length === 0 ? (
                <div className="demographics-view__empty"><p>No regional data available.</p></div>
              ) : (
                <div className="demographics-view__chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={data.regions || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={46} outerRadius={76} paddingAngle={2}>
                        {(data.regions || []).map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} />
                      <Legend wrapperStyle={{ color: 'var(--ds-color-text-2)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="demographics-view__panel">
              <header className="demographics-view__panel-heading">
                <div className="demographics-view__panel-title"><Users aria-hidden="true" /><h2>Age Bracket</h2></div>
                <Badge variant="neutral">Platform Heuristic</Badge>
              </header>
              {(data.age_brackets || []).length === 0 ? (
                <div className="demographics-view__empty"><p>No age bracket data available.</p></div>
              ) : (
                <div className="demographics-view__chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.age_brackets || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                      <XAxis type="number" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                      <YAxis dataKey="name" type="category" width={72} stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} cursor={{ fill: 'var(--ds-color-glass-hover)' }} />
                      <Bar dataKey="value" fill="var(--ds-color-accent)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="demographics-view__panel">
              <header className="demographics-view__panel-heading">
                <div className="demographics-view__panel-title"><Languages aria-hidden="true" /><h2>Language Distribution</h2></div>
              </header>
              {(data.languages || []).length === 0 ? (
                <div className="demographics-view__empty"><p>No language data available.</p></div>
              ) : (
                <div className="demographics-view__chart">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.languages || []} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--ds-color-glass-border)" />
                      <XAxis type="number" stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-3)' }} />
                      <YAxis dataKey="name" type="category" width={88} stroke="var(--ds-color-text-3)" tick={{ fill: 'var(--ds-color-text-2)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--ds-color-bg-elevated)', border: '1px solid var(--ds-color-glass-border)', borderRadius: 'var(--ds-radius-md)', color: 'var(--ds-color-text-1)' }} cursor={{ fill: 'var(--ds-color-glass-hover)' }} />
                      <Bar dataKey="value" fill="var(--ds-color-accent-bright)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}