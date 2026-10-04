import os
import sys
from pathlib import Path
import mongomock
from unittest.mock import MagicMock, patch

# Add backend to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.collectors.telegram_ingestor import normalize, poll_once, hid
from app.graph_builder import build_user_edges, get_doc_author

def test_telegram_duplicate_ingest_idempotency(monkeypatch):
    """Verify that multiple ingestion cycles for the same Telegram update do not duplicate documents."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["test_social_intel"]
    posts_coll = test_db["raw_posts"]

    raw_update = {
        "update_id": 9991,
        "message": {
            "message_id": 101,
            "date": 1759478400,
            "chat": {"id": 12345678, "title": "Test Channel"},
            "from": {"id": 87654321, "first_name": "Analyst"},
            "text": "Cyber security threat detected in energy grid #critical #threat"
        }
    }

    # Verify normalization hashes raw IDs
    normalized = normalize(raw_update)
    assert normalized is not None
    assert normalized["platform"] == "telegram"
    assert normalized["post_id"] == f"{hid(12345678)}:101"
    assert normalized["author_id"] == hid(87654321)  # Hashed, no PII
    assert "#critical" in normalized["hashtags"]
    assert normalized["event_type"] == "message"
    assert normalized["ingested_at"]
    assert set(normalized["metrics"]) == {"likes", "replies", "shares", "views"}

    # Mock Telegram API response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"ok": True, "result": [raw_update]}

    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    monkeypatch.setenv("ENABLED_SOURCES", "telegram")
    with patch("httpx.get", return_value=mock_resp):
        # Run first ingestion cycle
        count_1 = poll_once(target_db=test_db)
        assert count_1 == 1
        assert posts_coll.count_documents({}) == 1

        # Run second ingestion cycle with same update (simulating offset re-read or duplicate)
        count_2 = poll_once(target_db=test_db)
        # Because of upsert on (platform, post_id), count remains 1!
        assert posts_coll.count_documents({}) == 1

        # Verify stored document
        saved_doc = posts_coll.find_one({"post_id": f"{hid(12345678)}:101"})
        assert saved_doc is not None
        assert saved_doc["author_id"] == hid(87654321)
        assert "87654321" not in saved_doc["author_id"]  # Raw ID never saved
        assert "12345678" not in str(saved_doc)
    print("[PASS] test_telegram_duplicate_ingest_idempotency")

def test_build_user_edges_idempotency():
    """Verify that build_user_edges creates edges for replies & forwards and is strictly idempotent."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["test_social_intel"]
    posts_coll = test_db["raw_posts"]

    # Seed 3 posts:
    # Post 1: Original by user_alpha
    # Post 2: Reply to Post 1 by user_beta
    # Post 3: Forward of Post 1 by user_gamma
    posts_coll.insert_many([
        {
            "canonical_id": "p1",
            "post_id": "p1",
            "platform": "telegram",
            "author_id": "user_alpha",
            "text": "Initial threat alert",
            "created_at": "2026-10-01T10:00:00Z"
        },
        {
            "canonical_id": "p2",
            "post_id": "p2",
            "platform": "telegram",
            "author_id": "user_beta",
            "reply_to_author": "user_alpha",
            "parent_id": "p1",
            "text": "Can confirm this CVE",
            "created_at": "2026-10-01T10:05:00Z"
        },
        {
            "canonical_id": "p3",
            "post_id": "p3",
            "platform": "telegram",
            "author_id": "user_gamma",
            "forwarded_from": "user_alpha",
            "text": "Forwarded intel",
            "created_at": "2026-10-01T10:10:00Z"
        }
    ])

    executed_queries = []

    class MockSession:
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
        def run(self, query, **kwargs):
            executed_queries.append({"query": query, "kwargs": kwargs})
            return MagicMock()

    class MockDriver:
        def session(self):
            return MockSession()
        def close(self):
            pass

    with patch("app.graph_builder.GraphDatabase.driver", return_value=MockDriver()):
        # Run 1
        edges_run1 = build_user_edges(test_db)
        assert edges_run1 == 2  # 1 reply + 1 forward

        # Verify Cypher used MERGE on User and Relationship
        merge_replies_found = any("MERGE (src)-[r:REPLIED_TO {post_id: row.post_id}]->(tgt)" in eq["query"] for eq in executed_queries)
        merge_forwards_found = any("MERGE (src)-[r:FORWARDED_FROM {post_id: row.post_id}]->(tgt)" in eq["query"] for eq in executed_queries)
        assert merge_replies_found, "REPLIED_TO must use MERGE for idempotency"
        assert merge_forwards_found, "FORWARDED_FROM must use MERGE for idempotency"

        # Run 2 (verify re-run executes the exact same idempotent MERGE)
        edges_run2 = build_user_edges(test_db)
        assert edges_run2 == 2

    print("[PASS] test_build_user_edges_idempotency")

if __name__ == "__main__":
    print("Running NETRA Continuous Collection & Edge Tests...")
    test_telegram_duplicate_ingest_idempotency()
    test_build_user_edges_idempotency()
    print("All tests passed successfully! [OK]")
