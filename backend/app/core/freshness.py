"""One canonical definition of live data freshness."""
from __future__ import annotations

import os
from datetime import datetime, timezone

DEFAULT_INTERVAL_SECONDS = {
    "telegram": 5, "youtube": 1800, "facebook": 300, "instagram": 300,
    "reddit": 900, "x": 900, "bluesky": 900, "mastodon": 900,
}


def polling_interval_seconds(source: str) -> int:
    key = f"{source.upper()}_POLL_SECONDS"
    fallback = DEFAULT_INTERVAL_SECONDS.get(source.lower(), 900)
    try:
        return max(1, int(os.getenv(key, str(fallback))))
    except ValueError:
        return fallback


def parse_time(value: str | datetime | None) -> datetime | None:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def freshness(source: str, mode: str | None, last_success_at: str | datetime | None, *, now: datetime | None = None) -> dict:
    interval = polling_interval_seconds(source)
    threshold = interval * 2
    success = parse_time(last_success_at)
    now = now or datetime.now(timezone.utc)
    age = max(0, (now - success).total_seconds()) if success else None
    live_fresh = (mode or "").upper() in {"LIVE", "LIVE_THIRD_PARTY"} and age is not None and age <= threshold
    return {"freshness": "live_fresh" if live_fresh else "stale", "live_fresh": live_fresh,
            "polling_interval_seconds": interval, "freshness_threshold_seconds": threshold,
            "last_success_age_seconds": round(age, 1) if age is not None else None}
