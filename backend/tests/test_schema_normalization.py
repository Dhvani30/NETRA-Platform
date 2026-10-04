import importlib.util
import sys
from pathlib import Path

import mongomock

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.schema import ensure_raw_post_indexes, schema_health

_spec = importlib.util.spec_from_file_location("normalize_schema", ROOT_DIR / "scripts" / "normalize_schema.py")
normalize_schema = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(normalize_schema)


def test_normalizer_backfills_only_missing_values_and_is_idempotent():
    collection = mongomock.MongoClient()["social_intel"]["raw_posts"]
    collection.insert_many([
        {
            "platform": "reddit", "native_id": "legacy-1", "published_at": "2026-10-01T00:00:00+00:00",
            "collected_at": "2026-10-01T01:00:00+00:00", "text_content": "Legacy imported post",
            "metadata": {"source_mode": "IMPORT"},
        },
        {
            "platform": "telegram", "post_id": "keep-me", "canonical_id": "telegram:keep-me",
            "created_at": "2026-09-30T00:00:00+00:00", "ingested_at": "2026-09-30T01:00:00+00:00",
            "event_type": "message", "metrics": {"likes": 5}, "author_username": "legacy-user",
        },
        {"platform": "x", "post_id": "no-time", "text": "No timestamp supplied"},
    ])

    first = normalize_schema.normalize_collection(collection)
    second = normalize_schema.normalize_collection(collection)

    legacy = collection.find_one({"platform": "reddit"})
    assert legacy["post_id"] == "legacy-1"
    assert legacy["canonical_id"] == "reddit:legacy-1"
    assert legacy["created_at"] == "2026-10-01T00:00:00+00:00"
    assert legacy["ingested_at"] == "2026-10-01T01:00:00+00:00"
    assert legacy["source_mode"] == "IMPORT"
    assert legacy["metrics"] == {"likes": None, "replies": None, "shares": None, "views": None}

    existing = collection.find_one({"platform": "telegram"})
    assert existing["created_at"] == "2026-09-30T00:00:00+00:00"
    assert existing["metrics"]["likes"] == 5
    assert existing["metrics"]["views"] is None
    assert existing["author_id"]
    assert "author_username" not in existing

    no_time = collection.find_one({"platform": "x"})
    assert no_time["created_at"] is None
    assert no_time["ingested_at"] is None
    assert first["reddit"]["updated"] > 0
    assert second["reddit"]["updated"] == 0


def test_schema_health_reports_coverage_source_modes_and_time_series_flag():
    collection = mongomock.MongoClient()["social_intel"]["raw_posts"]
    collection.insert_many([
        {"platform": "youtube", "post_id": "1", "canonical_id": "youtube:1", "created_at": "2026-10-01T00:00:00+00:00", "source_mode": "LIVE"},
        {"platform": "youtube", "post_id": "2", "canonical_id": "youtube:2", "created_at": "2026-10-01T01:00:00+00:00", "source_mode": "LIVE"},
        {"platform": "x", "post_id": "3", "canonical_id": "x:3", "created_at": None, "source_mode": "IMPORT"},
    ])
    ensure_raw_post_indexes(collection)
    health = schema_health(collection)

    assert health["platforms"]["youtube"]["coverage"]["created_at"] == 100.0
    assert health["platforms"]["youtube"]["time_series_available"] is True
    assert health["platforms"]["youtube"]["source_modes"] == {"LIVE": 2}
    assert health["platforms"]["x"]["coverage"]["created_at"] == 0.0
    assert health["platforms"]["x"]["time_series_available"] is False
