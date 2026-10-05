import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';
export default function CoverageView({ refreshKey = 0 }) {
  const [rows, setRows] = useState({});
  useEffect(() => {
    axios.get(`${API_URL}/coverage`).then(r => setRows(r.data)).catch(() => setRows({}));
  }, [refreshKey]);

  return (
    <div className="space-y-5">
      <div className="netra-page-header">
        <span className="netra-page-eyebrow">Evidence boundary</span>
        <h1 className="netra-page-title">Coverage <span>Map</span></h1>
        <p className="netra-page-subtitle">Platform ingestion capabilities, access scopes, and provider limitations.</p>
      </div>

      <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-200">
        Enabled and disabled sources below come from the coverage API.
      </div>

      <div className="glass overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-400 border-b border-white/10">
            <tr>
              <th className="p-3">Platform</th>
              <th>Mode</th>
              <th>Scope</th>
              <th>Status</th>
              <th>Last 24h</th>
              <th>Limitation</th>
              <th>Enable Full Access</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(rows).map(([name, row]) => {
              const isNotEnabled = row.status === 'Not enabled in this build' || row.mode === 'DISABLED';
              return (
                <tr className="border-t border-white/5 hover:bg-white/[0.02]" key={name}>
                  <td className="p-3 capitalize text-white font-medium">{name}</td>
                  <td>
                    <span className={`pill text-[10px] ${
                      isNotEnabled ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : row.mode === 'LIVE_THIRD_PARTY' ? 'pill--live-third-party'
                      : row.mode === 'LIVE' ? 'pill--live'
                      : 'pill--import'
                    }`}>
                      {isNotEnabled ? '—' : (row.mode || 'LIVE')}
                    </span>
                  </td>
                  <td className="text-slate-300">{row.scope}</td>
                  <td>
                    <span className={`pill text-[10px] ${
                      isNotEnabled ? 'bg-slate-800 text-slate-400 border border-slate-700' : ''
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="font-mono text-slate-200">{isNotEnabled ? '—' : (row.items_last_24h ?? 0)}</td>
                  <td className="text-slate-400 max-w-xs">{row.limitation_note}</td>
                  <td className="text-slate-400 max-w-xs">{row.what_is_needed_to_enable_full_access}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
