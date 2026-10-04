export const SOURCE_MODES = Object.freeze({
  LIVE: 'LIVE',
  LIVE_THIRD_PARTY: 'LIVE_THIRD_PARTY',
  IMPORT: 'IMPORT',
  SYNTH: 'SYNTH',
});

const aliases = { REAL: SOURCE_MODES.LIVE, THIRD_PARTY: SOURCE_MODES.LIVE_THIRD_PARTY, '3RD_PARTY': SOURCE_MODES.LIVE_THIRD_PARTY, REPLAY: SOURCE_MODES.IMPORT, SYNTHETIC: SOURCE_MODES.SYNTH };

export function canonicalSourceMode(value) {
  const mode = String(value || SOURCE_MODES.SYNTH).trim().toUpperCase();
  return aliases[mode] || (Object.values(SOURCE_MODES).includes(mode) ? mode : SOURCE_MODES.SYNTH);
}

export const MODE_LEGEND = Object.freeze({
  LIVE: 'Collected from a first-party or authorized source. It is only real-time while newer than five minutes.',
  LIVE_THIRD_PARTY: 'Collected live through a disclosed third-party provider. It is only real-time while newer than five minutes.',
  IMPORT: 'Historical dataset import; dates are the original source dates, not collection time.',
  SYNTH: 'Synthetic or demonstration data; never real data.',
});

export function isFreshLive(mode, timestamp, now = Date.now()) {
  const age = new Date(timestamp || 0).getTime();
  return [SOURCE_MODES.LIVE, SOURCE_MODES.LIVE_THIRD_PARTY].includes(canonicalSourceMode(mode)) && Number.isFinite(age) && now - age < 300000;
}
