"""Shared collector heartbeat persistence."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.freshness import polling_interval_seconds


def _stamp(value: datetime) -> str: return value.astimezone(timezone.utc).isoformat()


def update_heartbeat(db, source: str, status: str, mode: str, started_at: datetime, finished_at: datetime,
                     count: int = 0, error: str | None = None) -> dict:
    now = _stamp(finished_at)
    one_hour = _stamp(finished_at - timedelta(hours=1))
    one_day = _stamp(finished_at - timedelta(hours=24))
    platforms = [source]
    query = {"platform": {"$in": platforms}}
    recent = lambda since: {"$and": [query, {"$or": [{"collected_at": {"$gte": since}}, {"ingested_at": {"$gte": since}}]}]}
    newest = db["raw_posts"].find_one(query, sort=[("collected_at", -1), ("ingested_at", -1)]) or {}
    errors = db["collection_runs"].count_documents({"source": source, "status": "error", "finished_at": {"$gte": one_hour}})
    interval = polling_interval_seconds(source)
    fields = {"source": source, "status": status.upper(), "mode": mode.upper(), "last_run_at": now,
              "items_last_hour": db["raw_posts"].count_documents(recent(one_hour)),
              "items_last_24h": db["raw_posts"].count_documents(recent(one_day)), "errors_last_hour": errors,
              "next_run_at": _stamp(finished_at + timedelta(seconds=interval)), "polling_interval_seconds": interval}
    if status.lower() == "success" or status.upper() in {"LIVE", "IMPORT", "LIVE_THIRD_PARTY"}:
        fields["last_success_at"] = now
    if newest:
        fields["last_item_at"] = newest.get("created_at")
    if error:
        fields["last_error"] = error
    db["collector_state"].update_one({"_id": f"heartbeat:{source}"}, {"$set": fields}, upsert=True)
    return fields
