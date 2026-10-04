"""Data-origin normalization and honest real-time summary calculations."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from statistics import median

from app.core.freshness import parse_time

SOURCE_MODES = ("LIVE", "LIVE_THIRD_PARTY", "IMPORT", "SYNTH")


def canonical_mode(value: str | None) -> str:
    mode = (value or "SYNTH").upper()
    if mode in {"REAL", "LIVE"}: return "LIVE"
    if mode in {"LIVE_THIRD_PARTY", "THIRD_PARTY"}: return "LIVE_THIRD_PARTY"
    if mode in {"IMPORT", "REPLAY"}: return "IMPORT"
    return "SYNTH"


def percentile(values: list[float], fraction: float) -> float | None:
    if not values: return None
    values = sorted(values); index = max(0, min(len(values)-1, round((len(values)-1) * fraction)))
    return round(values[index], 2)


def calculate_live_summary(rows: list[dict], now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    windows = {"5m": now-timedelta(minutes=5), "1h": now-timedelta(hours=1), "24h": now-timedelta(hours=24)}
    counts = {label: defaultdict(int) for label in windows}
    totals = Counter(); latency = defaultdict(list); newest = None; series = Counter()
    series_platforms = defaultdict(lambda: defaultdict(int))
    seen_platforms = set()
    for row in rows:
        mode = canonical_mode(row.get("source_mode") or (row.get("metadata") or {}).get("source_mode"))
        platform = str(row.get("platform") or "unknown").lower()
        seen_platforms.add(platform)
        totals[mode] += 1
        collected = parse_time(row.get("collected_at") or row.get("ingested_at"))
        created = parse_time(row.get("created_at"))
        if collected:
            if newest is None or collected > newest: newest = collected
            for label, start in windows.items():
                if collected >= start: counts[label][f"{platform}:{mode}"] += 1
            minute = collected.replace(second=0, microsecond=0).isoformat()
            if collected >= now-timedelta(hours=1):
                series[minute] += 1
                series_platforms[minute][platform] += 1
        if collected and created and collected >= created:
            latency[platform].append((collected-created).total_seconds())
    minute_series = []
    platform_keys = sorted(seen_platforms or ["telegram", "youtube", "x", "reddit"])
    for offset in range(59, -1, -1):
        point = (now-timedelta(minutes=offset)).replace(second=0, microsecond=0).isoformat()
        point_data = {"minute": point, "count": series[point]}
        for p in platform_keys:
            point_data[p] = series_platforms[point][p]
        minute_series.append(point_data)
    return {"counts": {label: dict(value) for label, value in counts.items()}, "ingest_rate_per_minute": minute_series,
            "platforms": platform_keys,
            "latency_seconds": {platform: {"median": round(median(values), 2), "p95": percentile(values, .95)} for platform, values in latency.items()},
            "newest_item_age_seconds": round((now-newest).total_seconds(), 1) if newest else None,
            "totals_by_source_mode": {mode: totals[mode] for mode in SOURCE_MODES}}
