/**
 * Utilities and reducer functions for the Live Telemetry Feed.
 */

export const MAX_LIVE_FEED_ITEMS = 200;

import { canonicalSourceMode } from '../lib/sourceModes.js';

export function getSourceModeClass(sourceMode) {
  const mode = canonicalSourceMode(sourceMode);
  if (mode === 'LIVE_THIRD_PARTY') return 'pill--live-third-party';
  if (mode === 'LIVE') return 'pill--live';
  if (mode === 'IMPORT') return 'pill--import';
  return 'pill--synth';
}

export function formatIngestedAgo(collectedAt, now = Date.now()) {
  if (!collectedAt) return 'ingested just now';
  const ts = new Date(collectedAt).getTime();
  if (isNaN(ts)) return 'ingested recently';
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) {
    return `ingested ${diffSec}s ago`;
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `ingested ${diffMin}m ago`;
  }
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `ingested ${diffHours}h ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `ingested ${diffDays}d ago`;
}

export function formatLatency(seconds) {
  if (seconds == null || isNaN(seconds)) return 'N/A';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${Number(seconds).toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export function calculateFreshness(latestDate, now = Date.now()) {
  if (!latestDate) {
    return { label: 'No data', status: 'idle', color: 'text-slate-500' };
  }
  const ts = new Date(latestDate).getTime();
  if (isNaN(ts)) return { label: 'Unknown', status: 'idle', color: 'text-slate-500' };
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec <= 60) {
    return { label: `${diffSec}s ago`, status: 'fresh', color: 'text-emerald-400' };
  }
  if (diffSec <= 600) {
    return { label: `${Math.floor(diffSec / 60)}m ago`, status: 'recent', color: 'text-sky-400' };
  }
  if (diffSec <= 3600) {
    return { label: `${Math.floor(diffSec / 60)}m ago`, status: 'lagging', color: 'text-amber-400' };
  }
  const h = Math.floor(diffSec / 3600);
  return { label: `${h}h ago`, status: 'stale', color: 'text-slate-400' };
}

/**
 * Adds an event to the feed list:
 * - Deduplicates by post_id or canonical_id
 * - Prepend newest first
 * - Caps at maxItems (default 200)
 * - Flags newly inserted row with _isNew: true
 */
export function addEventToFeed(currentEvents, newEvent, maxItems = MAX_LIVE_FEED_ITEMS) {
  if (!newEvent) return currentEvents;
  const newId = newEvent.canonical_id || newEvent.post_id || newEvent.raw_post_id;
  if (!newId) return currentEvents;

  // Deduplicate
  const exists = currentEvents.some(
    e => (e.canonical_id || e.post_id || e.raw_post_id) === newId
  );
  if (exists) return currentEvents;

  const itemWithFlag = {
    ...newEvent,
    _isNew: true,
    _receivedAt: Date.now()
  };

  const updated = [itemWithFlag, ...currentEvents];
  if (updated.length > maxItems) {
    return updated.slice(0, maxItems);
  }
  return updated;
}

/**
 * Batch add events (e.g. from polling fallback)
 */
export function addEventsBatchToFeed(currentEvents, newEventsList, maxItems = MAX_LIVE_FEED_ITEMS) {
  if (!newEventsList || !newEventsList.length) return currentEvents;
  let result = [...currentEvents];
  for (const item of newEventsList) {
    result = addEventToFeed(result, item, maxItems);
  }
  return result;
}
