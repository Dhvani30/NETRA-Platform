import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, KpiCard, DataTable, StatusBadge } from './ui/primitives';
import { EmptyState, ErrorState, ScreenSkeleton } from './ui/dataState';
import { API_URL } from '../config';

export default function AlertsView() {
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const loadedOnce = useRef(false);
  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/analytics/alerts`, { params: { t: Date.now() } });
      setAlerts(res.data.alerts || []);
      setError(null);
    } catch {
      setError("Can't reach the NETRA API. Start the backend and retry.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    void loadAlerts();
  }, []);

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
        <StatusBadge status={row.severity === 'CRITICAL' ? 'ERROR' : 'IDLE'}>
          {row.severity}
        </StatusBadge>
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
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="netra-page-header mb-0">
          <span className="netra-page-eyebrow">Real-Time Threat Monitoring</span>
          <h1 className="netra-page-title">Intelligence <span>Alerts</span></h1>
          <p className="netra-page-subtitle">Alerts returned by the analytics API.</p>
        </div>
        <Button variant="secondary" onClick={loadAlerts} loading={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </div>

      {error ? (
        <ErrorState error={{ message: error }} onRetry={loadAlerts} />
      ) : loading ? (
        <ScreenSkeleton />
      ) : alerts.length === 0 ? (
        <EmptyState>The alerts API returned no rows.</EmptyState>
      ) : (
        <>
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
