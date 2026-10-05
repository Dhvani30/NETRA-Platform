import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const blank = { name: '', keywords: [], hashtags: [], languages: ['en'], subreddits: [], telegram_channels: [], youtube_queries: [], enabled: true };
export default function WatchlistView({ refreshKey = 0 }) {
  const [topics, setTopics] = useState([]); const [form, setForm] = useState(blank); const [error, setError] = useState('');
  const load = () => axios.get(`${API_URL}/watchlist`).then(r => setTopics(r.data.topics || []));
  useEffect(() => { load().catch(() => setError('Could not load watchlist.')); }, [refreshKey]);
  const add = async e => { e.preventDefault(); setError(''); try { await axios.post(`${API_URL}/watchlist`, form); setForm(blank); load(); } catch (err) { setError(err.response?.data?.detail || 'Topic could not be saved.'); } };
  const remove = async id => { await axios.delete(`${API_URL}/watchlist/${id}`); load(); };
  const list = key => ({ value: (form[key] || []).join(', '), onChange: e => setForm({ ...form, [key]: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }) });
  return <div className="space-y-5"><div className="netra-page-header"><span className="netra-page-eyebrow">Public topic monitoring</span><h1 className="netra-page-title">Topic <span>Watchlist</span></h1><p className="netra-page-subtitle">Maximum 20 topics and 10 values per topic field.</p></div>
    <form className="glass p-4 grid md:grid-cols-2 gap-3" onSubmit={add}><input className="ds-input" required maxLength="80" placeholder="Topic name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
      <input className="ds-input" placeholder="Keywords, comma separated" {...list('keywords')} /><input className="ds-input" placeholder="Hashtags, comma separated" {...list('hashtags')} /><input className="ds-input" placeholder="YouTube queries, comma separated" {...list('youtube_queries')} /><input className="ds-input" placeholder="Public Telegram channels, comma separated" {...list('telegram_channels')} /><button className="pill" type="submit">Add topic</button>{error && <p className="text-xs text-rose-300 md:col-span-2">{error}</p>}</form>
    <div className="space-y-2">{topics.map(topic => <div className="glass p-4 flex justify-between gap-3" key={topic.id}><div><p className="text-white">{topic.name}</p><p className="text-xs text-slate-400">Keywords: {topic.keywords.join(', ') || '—'} · Hashtags: {topic.hashtags.map(v => `#${v}`).join(' ') || '—'} · Channels: {topic.telegram_channels.length}</p></div><button className="pill text-rose-300" onClick={() => remove(topic.id)}>Remove</button></div>)}</div>
  </div>;
}
