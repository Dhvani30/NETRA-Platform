import sys
from pathlib import Path
from datetime import datetime, timezone
import mongomock
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from main import app, mongo_client, MONGO_DB_NAME

client = TestClient(app)

def test_live_runs_endpoint_shape_and_no_secrets():
    db = mongo_client[MONGO_DB_NAME]
    db["collection_runs"].insert_one({
        "source": "telegram",
        "started_at": "2026-10-04T10:00:00+00:00",
        "finished_at": "2026-10-04T10:00:05+00:00",
        "status": "success",
        "count": 5,
        "api_calls": 2,
        "cost_usd": 0.0,
        "token": "secret_token_12345_do_not_leak"
    })

    res = client.get("/api/v1/live/runs?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "runs" in data
    assert len(data["runs"]) >= 1

    first_run = data["runs"][0]
    assert "source" in first_run
    assert "started_at" in first_run
    assert "finished_at" in first_run
    assert "status" in first_run
    assert "items" in first_run
    assert "api_calls" in first_run
    # Strict privacy: no credentials/tokens exposed
    assert "secret_token_12345_do_not_leak" not in str(data)

def test_post_provenance_endpoint_sanitizes_usernames():
    db = mongo_client[MONGO_DB_NAME]
    db["raw_posts"].delete_many({"canonical_id": "x:twitterapi:test-prov-101"})
    now_iso = datetime.now(timezone.utc).isoformat()
    db["raw_posts"].insert_one({
        "post_id": "test-prov-101",
        "canonical_id": "x:twitterapi:test-prov-101",
        "platform": "x",
        "source_mode": "LIVE_THIRD_PARTY",
        "author_id": "masked_author_hash",
        "author_username": "raw_private_handle",
        "author": {"name": "Private User", "userName": "raw_private_handle"},
        "text": "Cyber security threat disclosure",
        "created_at": now_iso,
        "collected_at": now_iso,
        "ingested_at": now_iso,
        "url": "https://x.com/i/web/status/test-prov-101"
    })

    res = client.get("/api/v1/post/test-prov-101")
    assert res.status_code == 200
    data = res.json()
    assert "post" in data
    post = data["post"]
    assert post["post_id"] == "test-prov-101"
    assert post["source_mode"] == "LIVE_THIRD_PARTY"
    # Ensure raw usernames are sanitized
    assert "raw_private_handle" not in str(data)
    assert "Private User" not in str(data)
    db["raw_posts"].delete_many({"canonical_id": "x:twitterapi:test-prov-101"})

def test_events_latest_endpoint():
    res = client.get("/api/v1/events/latest?limit=10")
    assert res.status_code == 200
    data = res.json()
    assert "events" in data
    assert isinstance(data["events"], list)
