import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, TrendingUp, Globe, Bell, RefreshCw, Video } from 'lucide-react';
import { Badge, Button, GlassCard, KpiCard, DataTable } from './ui/primitives';
import { WhyNothingArriving } from './ui/dataState';

import { API_URL } from '../config';

const SEVERITY_STYLES = {
  CRITICAL: { tone: 'danger', icon: <AlertTriangle className="w-4 h-4 text-red-400" /> },
  WARNING: { tone: 'warning', icon: <TrendingUp className="w-4 h-4 text-amber-400" /> },
  INFO: { tone: 'info', icon: <Globe className="w-4 h-4 text-sky-400" /> }
};

export default function AlertsView({ refreshKey = 0 }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await axios.get(`${API_URL}/analytics/alerts?t=${Date.now()}`);
      setAlerts(res.data.alerts || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAlerts(refreshKey > 0);
    const interval = setInterval(() => fetchAlerts(true), 30000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString();
  };

  const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alerts.filter((a) => a.severity === 'WARNING').length;

  const alertColumns = [
    {
      header: 'Severity',
      accessorKey: 'severity',
      cell: (row) => (
        <Badge variant={SEVERITY_STYLES[row.severity]?.tone || 'neutral'}>
          {row.severity}
        </Badge>
      )
    },
    {
      header: 'Alert Type',
      accessorKey: 'type',
      cell: (row) => <span className="font-semibold text-gray-200">{row.type || 'THREAT_SIGNAL'}</span>
    },
    {
      header: 'Message / Event',
      accessorKey: 'message',
      cell: (row) => <span className="text-gray-300 max-w-lg line-clamp-1">{row.message}</span>
    },
    {
      header: 'Target Entity',
      accessorKey: 'entity',
      cell: (row) => <span className="text-indigo-300 font-mono text-xs">{row.entity || row.narrative || 'System'}</span>
    },
    {
      header: 'Timestamp',
      accessorKey: 'timestamp',
      cell: (row) => <span className="text-gray-400 text-xs">{formatTime(row.timestamp)}</span>
    }
  ];

  return (
    <div className="space-y-8" aria-busy={loading}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Real-Time Threat Monitoring</span>
          <h1 className="netra-page-title">Intelligence <span>Alerts</span></h1>
          <p className="netra-page-subtitle">{loading ? 'Loading alerts.' : `${alerts.length} alerts returned by the API.`}</p>
        </div>

        <Button variant="secondary" onClick={() => fetchAlerts(true)} disabled={refreshing} loading={refreshing}>
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Scanning…' : 'Refresh'}
        </Button>
      </div>

      {loading ? (
        <GlassCard className="p-12 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-gray-300 font-medium">Scanning for threat signals…</p>
        </GlassCard>
      ) : alerts.length === 0 ? (
        <div className="space-y-3">
          <GlassCard className="p-12 text-center">
            <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-80" />
            <h2 className="text-lg font-semibold text-gray-200">The alerts API returned no rows.</h2>
          </GlassCard>
          <WhyNothingArriving />
        </div>
      ) : (
        <>
          {/* Row of Max 4 KPI Cards */}
          <div className="netra-grid-12">
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Total Alerts"
                value={alerts.length}
                delta="Active"
                deltaType="neutral"
                subtext="Notifications queued"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Critical Severity"
                value={criticalCount}
                delta={criticalCount > 0 ? "Action Required" : "Nominal"}
                deltaType={criticalCount > 0 ? "negative" : "positive"}
                subtext="Immediate review"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="Warnings"
                value={warningCount}
                delta="Elevated"
                deltaType="warning"
                subtext="Anomaly signals"
              />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <KpiCard
                label="System Health"
                value={alerts.length === 0 ? "100%" : `${Math.max(0, Math.round(((alerts.length - criticalCount) / alerts.length) * 100))}%`}
                delta={criticalCount === 0 ? "Optimal" : `${criticalCount} critical`}
                deltaType={criticalCount === 0 ? "positive" : "negative"}
                subtext="Alert severity ratio"
              />
            </div>
          </div>

          {/* Main Table: 56px Row Height, Max 8 Rows Visible + View All */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Live Alert Stream</h2>
              <div className="flex items-center gap-2">
                <Badge variant="danger">Critical: {criticalCount}</Badge>
                <Badge variant="warning">Warning: {warningCount}</Badge>
              </div>
            </div>

            <DataTable columns={alertColumns} data={alerts} maxRows={8} />
          </div>
        </>
      )}
    </div>
  );
}