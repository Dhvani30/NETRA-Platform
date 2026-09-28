import { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, TrendingUp, Globe, Bell, BellOff, RefreshCw } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';

const SEVERITY_STYLES = {
  CRITICAL: { bg: 'bg-red-900/20', border: 'border-red-600', text: 'text-red-400', icon: <AlertTriangle className="w-5 h-5 text-red-500" /> },
  WARNING: { bg: 'bg-orange-900/20', border: 'border-orange-600', text: 'text-orange-400', icon: <TrendingUp className="w-5 h-5 text-orange-500" /> },
  INFO: { bg: 'bg-blue-900/20', border: 'border-blue-600', text: 'text-blue-400', icon: <Globe className="w-5 h-5 text-blue-500" /> }
};

const TYPE_ICONS = {
  ACCELERATION: <TrendingUp className="w-6 h-6" />,
  SENTIMENT: <AlertTriangle className="w-6 h-6" />,
  ENTITY: <Globe className="w-6 h-6" />
};

export default function AlertsView() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // State for button spinner

  const fetchAlerts = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Added ?t=... to prevent browser caching so you see fresh data every time
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
    // Auto-refresh every 30 seconds
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center p-4 rounded-lg border border-gray-800" style={{ backgroundColor: '#13131f' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-red-900/30 border border-red-600">
            <Bell className="w-6 h-6 text-red-500 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-white">
              INTELLIGENCE ALERTS
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {alerts.length} active notifications • Auto-refreshing
            </p>
          </div>
        </div>
        
        {/* FIXED REFRESH BUTTON */}
        <button 
          onClick={() => fetchAlerts(true)}
          disabled={refreshing}
          className={`px-4 py-2 rounded text-white text-sm font-medium flex items-center gap-2 transition-all ${
            refreshing ? 'bg-gray-600 cursor-wait' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> 
          {refreshing ? 'Scanning...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400">Scanning intelligence feeds...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-20 text-gray-400 flex flex-col items-center">
          <BellOff className="w-12 h-12 mb-4 opacity-50" />
          <p>No active alerts at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.INFO;
            return (
              <div 
                key={alert.id} 
                className={`p-5 rounded-lg border-l-4 transition-all hover:scale-[1.01] ${style.bg} ${style.border}`}
                style={{ backgroundColor: '#13131f' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${style.bg} ${style.text}`}>
                      {TYPE_ICONS[alert.type] || <AlertTriangle />}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-white">{alert.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${style.bg} ${style.text} border ${style.border}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed max-w-3xl">
                        {alert.description}
                      </p>
                      <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Detected {formatTime(alert.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}