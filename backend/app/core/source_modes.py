"""Canonical source-mode vocabulary used by API, collectors, and scripts."""
from __future__ import annotations

LIVE = "LIVE"
LIVE_THIRD_PARTY = "LIVE_THIRD_PARTY"
IMPORT = "IMPORT"
SYNTH = "SYNTH"
SOURCE_MODES = (LIVE, LIVE_THIRD_PARTY, IMPORT, SYNTH)

_ALIASES = {
    "REAL": LIVE,
    "THIRD_PARTY": LIVE_THIRD_PARTY,
    "3RD_PARTY": LIVE_THIRD_PARTY,
    "REPLAY": IMPORT,
    "SYNTHETIC": SYNTH,
}


def canonical_source_mode(value: object, default: str = SYNTH) -> str:
    """Normalize legacy labels at the boundary; never emit a legacy value."""
    mode = str(value or default).strip().upper()
    return _ALIASES.get(mode, mode if mode in SOURCE_MODES else default)


def is_fresh_live(mode: object, age_seconds: float | None) -> bool:
    return canonical_source_mode(mode) in {LIVE, LIVE_THIRD_PARTY} and age_seconds is not None and age_seconds < 300
