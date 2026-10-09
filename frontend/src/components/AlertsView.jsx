import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, TrendingUp, Globe, Bell, BellOff, RefreshCw, Video } from 'lucide-react';
import { Badge, Button, Card } from './ui/primitives';
import { API_URL } from '../config';
import './AlertsView.css';


const SEVERITY_STYLES = {
  CRITICAL: { tone: 'danger', icon: <AlertTriangle className="w-5 h-5" /> },
  WARNING: { tone: 'warning', icon: <TrendingUp className="w-5 h-5" /> },
  INFO: { tone: 'info', icon: <Globe className="w-5 h-5" /> }
};

const TYPE_ICONS = {
  ACCELERATION: <TrendingUp className="w-6 h-6" />,
  SENTIMENT: <AlertTriangle className="w-6 h-6" />,
  ENTITY: <Globe className="w-6 h-6" />
};

const highlightPlatforms = (text) => {
  if (!text) return null;
  const parts = text.split(/(YOUTUBE|X|REDDIT|TELEGRAM)/gi);
  return parts.map((part, i) => {
    if (part.toUpperCase() === 'YOUTUBE') {
      return <span key={i} className="alerts-view__platform alerts-view__platform--youtube"><Video className="w-3 h-3" />YOUTUBE</span>;
    }
    if (['X', 'REDDIT', 'TELEGRAM'].includes(part.toUpperCase())) {
      return <span key={i} className="alerts-view__platform">{part}</span>;
    }
    return part;
  });
};

export default function AlertsView() {
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
    fetchAlerts();
    const interval = setInterval(() => fetchAlerts(true), 30000);
    return () => clearInterval(interval);
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

  return (
    <section className="alerts-view" aria-labelledby="alerts-heading">
      <header className="alerts-view__header">
        <div className="alerts-view__heading-group">
          <span className="alerts-view__heading-icon" aria-hidden="true"><Bell /></span>
          <div>
            <p className="alerts-view__eyebrow">Live monitoring</p>
            <h1 className="alerts-view__title" id="alerts-heading">Intelligence <span>Alerts</span></h1>
            <p className="alerts-view__subtitle">{alerts.length} active notifications · Auto-refreshing</p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => fetchAlerts(true)} disabled={refreshing} loading={refreshing} className="alerts-view__refresh">
          <RefreshCw className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Scanning…' : 'Refresh'}
        </Button>
      </header>

      {!loading && alerts.length > 0 && (
        <div className="alerts-view__summary" role="group" aria-label="Alert counts by severity">
          <Badge variant="danger">Critical · {alerts.filter((alert) => alert.severity === 'CRITICAL').length}</Badge>
          <Badge variant="warning">Warning · {alerts.filter((alert) => alert.severity === 'WARNING').length}</Badge>
        </div>
      )}

      {loading ? (
        <Card className="alerts-view__state" role="status">
          <RefreshCw className="alerts-view__state-icon animate-spin" />
          <p>Scanning intelligence feeds…</p>
        </Card>
      ) : alerts.length === 0 ? (
        <Card className="alerts-view__state">
          <BellOff className="alerts-view__state-icon" />
          <h2>No active alerts</h2>
          <p>No active alerts at this time.</p>
        </Card>
      ) : (
        <div className="alerts-view__list" aria-live="polite">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
            return (
              <Card key={alert.id} className={`alerts-view__item alerts-view__item--${style.tone}`}>
                <div className={`alerts-view__type-icon alerts-view__type-icon--${style.tone}`} aria-hidden="true">
                  {TYPE_ICONS[alert.type] || <AlertTriangle />}
                </div>
                <div className="alerts-view__content">
                  <div className="alerts-view__item-heading">
                    <div className="alerts-view__title-group">
                      <h2 className="alerts-view__item-title">{alert.title}</h2>
                      <Badge variant={style.tone}>{alert.severity}</Badge>
                    </div>
                    <span className="alerts-view__timestamp">{formatTime(alert.timestamp)}</span>
                  </div>
                  <p className="alerts-view__description">{highlightPlatforms(alert.description)}</p>
                  <div className="alerts-view__metadata">
                    <span className={`alerts-view__severity-icon alerts-view__severity-icon--${style.tone}`} aria-hidden="true">{style.icon}</span>
                    <span>{alert.type || 'Alert'}</span><span className="alerts-view__separator">·</span>
                    <span>Detected {formatTime(alert.timestamp)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}