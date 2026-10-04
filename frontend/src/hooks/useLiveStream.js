import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

const jitter = ms => Math.round(ms * (0.8 + Math.random() * 0.4));

/** Push-first transport: batches renders, retries SSE, and falls back to polling. */
export function useLiveStream(onEvents) {
  const [state, setState] = useState('connecting');
  const cursor = useRef(null); const callback = useRef(onEvents); const queued = useRef([]);
  callback.current = onEvents;
  useEffect(() => {
    let source; let reconnect; let pollTimer; let stopped = false; let failures = 0; let delay = 1000;
    const flushTimer = window.setInterval(() => { if (queued.current.length) callback.current?.(queued.current.splice(0)); }, 1000);
    const poll = async () => { try { const { data } = await axios.get(`${API_URL}/events/latest`, { params: { since: cursor.current, limit: 50 } }); (data.events || []).forEach(event => { cursor.current = event.collected_at || cursor.current; queued.current.push(event); }); } catch { setState('offline'); } };
    const polling = () => { setState('polling'); poll(); clearInterval(pollTimer); pollTimer = window.setInterval(poll, 10000); };
    const connect = () => {
      if (stopped || document.hidden) return;
      setState('connecting'); source?.close(); source = new EventSource(`${API_URL}/stream`);
      source.addEventListener('heartbeat', () => { failures = 0; delay = 1000; setState('connected'); });
      source.addEventListener('post', message => { try { const event = JSON.parse(message.data); cursor.current = event.collected_at || cursor.current; queued.current.push(event); failures = 0; delay = 1000; setState('connected'); } catch { /* ignore malformed payload */ } });
      source.onerror = () => { source?.close(); if (stopped) return; failures += 1; if (failures >= 3) polling(); reconnect = window.setTimeout(connect, jitter(delay)); delay = Math.min(30000, delay * 2); };
    };
    const visibility = () => { if (document.hidden) { source?.close(); clearTimeout(reconnect); window.setTimeout(() => { if (document.hidden) clearInterval(pollTimer); }, 60000); } else { poll(); connect(); } };
    connect(); document.addEventListener('visibilitychange', visibility);
    return () => { stopped = true; source?.close(); clearTimeout(reconnect); clearInterval(pollTimer); clearInterval(flushTimer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return { connected: state === 'connected', state };
}
