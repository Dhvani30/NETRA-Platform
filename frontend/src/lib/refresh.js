import { useCallback, useEffect, useRef, useState } from 'react';

const envMs = (name, fallback) => Math.max(0, Number(import.meta.env[name] || fallback) * 1000);
export const REFRESH_INTERVALS = Object.freeze({
  events: envMs('VITE_REFRESH_EVENTS_SECONDS', 10), health: envMs('VITE_REFRESH_HEALTH_SECONDS', 15),
  summary: envMs('VITE_REFRESH_SUMMARY_SECONDS', 30), analytics: envMs('VITE_REFRESH_ANALYTICS_SECONDS', 120),
  manual: 0,
});
const inFlight = new Map();
const jitter = ms => Math.round(ms * (0.85 + Math.random() * 0.3));

/** A safe polling primitive: no overlap, no background polling, and no stale writes. */
export function useAutoRefresh(fetcher, { interval = REFRESH_INTERVALS.analytics, key, enabled = true, manual = false, onData } = {}) {
  const [state, setState] = useState({ loading: false, refreshing: false, error: null, failures: 0, updatedAt: null, paused: false });
  const controller = useRef(null); const timer = useRef(null); const generation = useRef(0); const fetcherRef = useRef(fetcher); const onDataRef = useRef(onData);
  fetcherRef.current = fetcher; onDataRef.current = onData;
  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const run = useCallback(async ({ force = false } = {}) => {
    if (!enabled || (!force && (manual || document.hidden))) return;
    clear(); controller.current?.abort(); const token = ++generation.current;
    setState(prev => ({ ...prev, refreshing: prev.updatedAt !== null, loading: prev.updatedAt === null, error: null }));
    const requestKey = key || String(fetcherRef.current);
    let task = inFlight.get(requestKey);
    if (!task) { const aborter = new AbortController(); task = Promise.resolve(fetcherRef.current(aborter.signal)).finally(() => inFlight.delete(requestKey)); task.controller = aborter; inFlight.set(requestKey, task); }
    try {
      const data = await task;
      if (token !== generation.current) return;
      onDataRef.current?.(data);
      setState(prev => ({ ...prev, loading: false, refreshing: false, error: null, failures: 0, updatedAt: new Date(), paused: false }));
    } catch (error) {
      if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED' || token !== generation.current) return;
      setState(prev => ({ ...prev, loading: false, refreshing: false, error, failures: prev.failures + 1 }));
    }
  }, [clear, enabled, key, manual]);
  useEffect(() => {
    if (!enabled) return undefined;
    const schedule = () => { clear(); if (!manual && !document.hidden) timer.current = setTimeout(async () => { await run(); schedule(); }, jitter(Math.min(interval || 0, 60000))); };
    const visibility = () => { if (document.hidden) { clear(); controller.current?.abort(); setState(prev => ({ ...prev, paused: true })); } else { run({ force: true }); schedule(); } };
    run({ force: true }); schedule(); document.addEventListener('visibilitychange', visibility);
    return () => { clear(); controller.current?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [clear, enabled, interval, manual, run]);
  const retry = useCallback(() => run({ force: true }), [run]);
  return { ...state, refresh: retry, offline: state.failures >= 10, interval };
}
