"""Timestamp-safe timeline aggregation for canonical raw_posts documents."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone


def _parse(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def timeline(collection, start: str | None = None, end: str | None = None,
             platform: str | None = None, source_mode: str | None = None,
             bucket: str = "day") -> dict:
    if bucket not in {"hour", "day"}:
        raise ValueError("bucket must be 'hour' or 'day'")
    start_dt, end_dt = _parse(start), _parse(end)
    query = {"created_at": {"$exists": True, "$ne": None}}
    if platform:
        query["platform"] = platform.lower()
    if source_mode:
        query["source_mode"] = source_mode.upper()
    documents = list(collection.find(query, {"_id": 0, "created_at": 1, "platform": 1, "source_mode": 1}))
    dated = [(doc, _parse(doc.get("created_at"))) for doc in documents]
    dated = [(doc, at) for doc, at in dated if at is not None]
    if not dated:
        return {"from": start, "to": end, "bucket": bucket, "timeline": []}
    actual_start, actual_end = min(at for _, at in dated), max(at for _, at in dated)
    start_dt, end_dt = start_dt or actual_start, end_dt or actual_end
    counts = Counter()
    for doc, at in dated:
        if not start_dt <= at <= end_dt:
            continue
        key_time = at.replace(minute=0, second=0, microsecond=0) if bucket == "hour" else at.replace(hour=0, minute=0, second=0, microsecond=0)
        counts[(key_time.isoformat(), doc.get("platform") or "unknown", (doc.get("source_mode") or "UNKNOWN").upper())] += 1
    rows = [
        {"time": time, "platform": plat, "source_mode": mode, "count": count}
        for (time, plat, mode), count in sorted(counts.items())
    ]
    return {"from": start_dt.isoformat(), "to": end_dt.isoformat(), "bucket": bucket, "timeline": rows}
