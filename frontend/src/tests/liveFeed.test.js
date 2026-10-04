import test from 'node:test';
import assert from 'node:assert';
import {
  addEventToFeed,
  addEventsBatchToFeed,
  MAX_LIVE_FEED_ITEMS,
  formatIngestedAgo,
  formatLatency,
  calculateFreshness,
  getSourceModeClass
} from '../utils/liveFeedReducer.js';

test('addEventToFeed deduplicates by post_id and canonical_id', () => {
  const initial = [
    { post_id: 'post-1', platform: 'telegram', source_mode: 'LIVE' },
    { post_id: 'post-2', platform: 'youtube', source_mode: 'LIVE' },
  ];

  // Try inserting duplicate post-1
  const duplicate = { post_id: 'post-1', platform: 'telegram', source_mode: 'LIVE' };
  const res1 = addEventToFeed(initial, duplicate);
  assert.strictEqual(res1.length, 2, 'Should not add duplicate post_id');

  // Try inserting duplicate by canonical_id
  const canonicalInitial = [
    { canonical_id: 't.me/123', post_id: 'hash1', platform: 'telegram' }
  ];
  const duplicateCanonical = { canonical_id: 't.me/123', post_id: 'hash2', platform: 'telegram' };
  const res2 = addEventToFeed(canonicalInitial, duplicateCanonical);
  assert.strictEqual(res2.length, 1, 'Should not add duplicate canonical_id');
});

test('addEventToFeed caps strictly at MAX_LIVE_FEED_ITEMS (200)', () => {
  let feed = [];
  for (let i = 0; i < 250; i++) {
    feed = addEventToFeed(feed, { post_id: `post-${i}`, text: `message ${i}` });
  }

  assert.strictEqual(feed.length, MAX_LIVE_FEED_ITEMS, `Feed should be capped at ${MAX_LIVE_FEED_ITEMS}`);
  // Most recent post should be at index 0 (newest first)
  assert.strictEqual(feed[0].post_id, 'post-249');
  // Oldest kept should be post-50
  assert.strictEqual(feed[feed.length - 1].post_id, 'post-50');
});

test('addEventToFeed flags new item with _isNew', () => {
  const feed = [];
  const updated = addEventToFeed(feed, { post_id: 'new-1', text: 'alert' });
  assert.strictEqual(updated[0]._isNew, true);
  assert.ok(typeof updated[0]._receivedAt === 'number');
});

test('formatIngestedAgo correctly computes relative time string', () => {
  const now = 1760000000000;
  const t5sAgo = new Date(now - 5000).toISOString();
  const t45sAgo = new Date(now - 45000).toISOString();
  const t3mAgo = new Date(now - 180000).toISOString();
  const t2hAgo = new Date(now - 7200000).toISOString();

  assert.strictEqual(formatIngestedAgo(t5sAgo, now), 'ingested 5s ago');
  assert.strictEqual(formatIngestedAgo(t45sAgo, now), 'ingested 45s ago');
  assert.strictEqual(formatIngestedAgo(t3mAgo, now), 'ingested 3m ago');
  assert.strictEqual(formatIngestedAgo(t2hAgo, now), 'ingested 2h ago');
  assert.strictEqual(formatIngestedAgo(null, now), 'ingested just now');
});

test('calculateFreshness assigns proper health status and color', () => {
  const now = 1760000000000;
  const recent = new Date(now - 30000).toISOString();
  const lagging = new Date(now - 1200000).toISOString();
  const stale = new Date(now - 10000000).toISOString();

  const freshRes = calculateFreshness(recent, now);
  assert.strictEqual(freshRes.status, 'fresh');
  assert.strictEqual(freshRes.label, '30s ago');

  const laggingRes = calculateFreshness(lagging, now);
  assert.strictEqual(laggingRes.status, 'lagging');

  const staleRes = calculateFreshness(stale, now);
  assert.strictEqual(staleRes.status, 'stale');

  const emptyRes = calculateFreshness(null, now);
  assert.strictEqual(emptyRes.status, 'idle');
  assert.strictEqual(emptyRes.label, 'No data');
});

test('getSourceModeClass returns distinct CSS class per mode', () => {
  assert.strictEqual(getSourceModeClass('LIVE'), 'pill--live');
  assert.strictEqual(getSourceModeClass('REAL'), 'pill--live');
  assert.strictEqual(getSourceModeClass('LIVE_THIRD_PARTY'), 'pill--live-third-party');
  assert.strictEqual(getSourceModeClass('IMPORT'), 'pill--import');
  assert.strictEqual(getSourceModeClass('REPLAY'), 'pill--import');
  assert.strictEqual(getSourceModeClass('SYNTH'), 'pill--synth');
  assert.strictEqual(getSourceModeClass(undefined), 'pill--synth');
});
