from datetime import datetime, timedelta, timezone
import sys
from pathlib import Path

import mongomock

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path: sys.path.insert(0, str(BACKEND_DIR))

from app.core.freshness import freshness
from app.core.live_events import event_from_document, recent_events
from app.core.live_summary import calculate_live_summary


def test_freshness_transitions_and_imports_are_never_live_fresh(monkeypatch):
    now = datetime(2026, 10, 4, tzinfo=timezone.utc)
    monkeypatch.setenv("TELEGRAM_POLL_SECONDS", "5")
    assert freshness("telegram", "LIVE", now-timedelta(seconds=9), now=now)["live_fresh"]
    assert freshness("telegram", "LIVE", now-timedelta(seconds=11), now=now)["freshness"] == "stale"
    assert not freshness("telegram", "IMPORT", now, now=now)["live_fresh"]


def test_event_payload_has_no_raw_identifier_and_recent_fallback():
    now = datetime.now(timezone.utc).isoformat()
    doc = {"platform": "telegram", "source_mode": "LIVE", "event_type": "message", "post_id": "safe-id",
           "author_id": "hashed-author", "text": "evidence", "created_at": now, "collected_at": now, "url": "https://example.test"}
    event = event_from_document(doc)
    assert "author_id" not in event and "author" not in event
    db = mongomock.MongoClient()["social_intel"]; db.raw_posts.insert_one(doc)
    events, cursor = recent_events(db.raw_posts)
    assert events[0]["post_id"] != "safe-id" and len(events[0]["post_id"]) == 16 and cursor == now


def test_live_summary_counts_rates_and_latency():
    now = datetime(2026, 10, 4, 12, tzinfo=timezone.utc)
    rows = [
        {"platform": "telegram", "source_mode": "LIVE", "created_at": (now-timedelta(seconds=10)).isoformat(), "collected_at": now.isoformat()},
        {"platform": "youtube", "source_mode": "IMPORT", "created_at": (now-timedelta(seconds=30)).isoformat(), "collected_at": (now-timedelta(minutes=10)).isoformat()},
        {"platform": "x", "source_mode": "SYNTH", "created_at": now.isoformat(), "collected_at": now.isoformat()},
    ]
    summary = calculate_live_summary(rows, now)
    assert summary["counts"]["5m"]["telegram:LIVE"] == 1
    assert summary["totals_by_source_mode"] == {"LIVE": 1, "LIVE_THIRD_PARTY": 0, "IMPORT": 1, "SYNTH": 1}
    assert summary["latency_seconds"]["telegram"] == {"median": 10.0, "p95": 10.0}
    assert len(summary["ingest_rate_per_minute"]) == 60
