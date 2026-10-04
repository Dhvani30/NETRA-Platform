import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { API_URL } from '../config';

const EMOTIONS = ['anxiety', 'anger', 'excitement', 'joy', 'sadness', 'neutral'];
const COLORS = { anxiety:'#f59e0b', anger:'#ef4444', excitement:'#a78bfa', joy:'#34d399', sadness:'#60a5fa', neutral:'#64748b', positive:'#34d399', negative:'#ef4444', supportive:'#34d399', against:'#ef4444' };

function Chart({ title, data, keys, shifts, onPoint }) {
  return <div className="glass p-5"><h2 className="text-sm text-white mb-4">{title}</h2><div className="h-56">
    <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} onClick={(event) => event?.activeLabel && onPoint(event.activeLabel)} stackOffset="expand">
      <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false}/><XAxis dataKey="time" tick={{fill:'#94a3b8', fontSize:10}}/><YAxis tickFormatter={(value) => `${Math.round(value * 100)}%`} tick={{fill:'#94a3b8', fontSize:10}}/><Tooltip /><Legend />
      {shifts.map((shift) => <ReferenceLine key={shift.bucket} x={shift.bucket} stroke="#fbbf24" strokeDasharray="3 3" />)}
      {keys.map((key) => <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={COLORS[key]} fill={COLORS[key]} fillOpacity={.55}/>)}</AreaChart></ResponsiveContainer>
  </div></div>;
}

export default function SentimentTimelineView() {
  const [timeline, setTimeline] = useState([]), [shifts, setShifts] = useState([]), [point, setPoint] = useState(null);
  useEffect(() => { Promise.all([axios.get(`${API_URL}/sentiment/timeline`), axios.get(`${API_URL}/sentiment/shifts`)]).then(([a,b]) => { setTimeline(a.data.timeline || []); setShifts(b.data.shifts || []); }).catch(console.error); }, []);
  const data = useMemo(() => timeline.map((row) => ({ time: row.bucket, ...row.emotions, ...row.polarity, ...row.stance })), [timeline]);
  const selected = shifts.find((shift) => shift.bucket === point) || shifts[0];
  return <div className="space-y-5"><div className="flex justify-between items-center"><h1 className="text-xl text-white font-light">Sentiment <span className="text-indigo-300">Timeline</span></h1><span className="pill text-xs">{timeline.length} windows</span></div>
    {!data.length ? <div className="glass p-8 text-slate-500 text-sm">No scored sentiment windows yet. The next analytics batch will populate this view.</div> : <><Chart title="Emotion mix" data={data} keys={EMOTIONS} shifts={shifts} onPoint={setPoint}/><div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><Chart title="Polarity mix" data={data} keys={['positive','negative','neutral']} shifts={shifts} onPoint={setPoint}/><Chart title="Stance mix" data={data} keys={['supportive','against','neutral']} shifts={shifts} onPoint={setPoint}/></div></>}
    <div className="glass p-5"><h2 className="text-sm text-white mb-3">Posts driving {selected?.bucket || 'selected shift'}</h2>{selected?.posts?.length ? <div className="space-y-3">{selected.posts.map((post, index) => <div key={post.canonical_id || post.post_id || index} className="border-b border-white/10 pb-3 text-xs"><p className="text-slate-200">{post.text || post.text_content}</p><p className="mt-1 text-slate-400">{post.sentiment?.label || 'unscored'} · {Math.round((post.sentiment?.confidence || 0) * 100)}% · {post.emotions?.label || 'neutral'} · {post.stance?.label || 'neutral'}</p></div>)}</div> : <p className="text-xs text-slate-500">Click a timeline point with a shift marker to inspect contributing posts.</p>}</div>
  </div>;
}
