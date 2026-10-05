export function sourceArrivalReason(name, source, now = Date.now()) {
  const label = String(name || 'source');
  if (!source) return `${label} status has not been reported.`;
  if (source.mode === 'DISABLED' || source.status === 'DISABLED' || source.reason === 'not_enabled_in_this_build') {
    return `${label} is not enabled in this build${source.reason ? `: ${source.reason}` : ''}.`;
  }
  const detail = `${source.reason || ''} ${source.message || ''}`;
  if (/quota/i.test(detail)) {
    const resume = source.quota_reset_at ? new Date(source.quota_reset_at).toLocaleString() : null;
    return resume ? `${label} daily quota reached, resumes at ${resume}.` : `${label} daily quota reached.`;
  }
  if (source.message) return source.message;
  if (source.last_item_at) {
    const minutes = Math.max(0, Math.floor((now - new Date(source.last_item_at).getTime()) / 60000));
    return `${label} connected, no new messages in the last ${minutes} minutes.`;
  }
  if (label === 'facebook' || label === 'instagram') {
    return `${label} connected, no content yet: publish a post and a comment, then press Sync now.`;
  }
  return `${label} is ${String(source.status || 'idle').replaceAll('_', ' ')} and has not reported a new item.`;
}
