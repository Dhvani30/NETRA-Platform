import sys
from pathlib import Path

import mongomock

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.demographics.profiler import UNKNOWN, build_demographics


def post(author, *, lang="en", text="technology developer", bio="", location="", event="post"):
    return {"author_id": author, "platform": "reddit", "lang": lang, "text": text,
            "bio": bio, "location": location, "event_type": event}


def test_k_anonymity_suppresses_tiny_segment_and_keeps_unknown_honest():
    rows = [post(f"u{i}", lang="en") for i in range(10)] + [post("rare", lang="ja")]
    result = build_demographics(rows, k_anonymity=10)
    languages = {bucket["label"]: bucket for bucket in result["language"]["buckets"]}
    assert languages["English"]["users"] == 10
    assert languages["other (suppressed)"]["users"] == 1
    assert languages[UNKNOWN]["users"] == 0
    assert result["language"]["coverage"] == 100.0


def test_minors_are_excluded_from_age_and_unknown_is_visible():
    rows = [post("minor", bio="I am 16 and a student")] + [post(f"adult{i}", bio="I am 22") for i in range(10)]
    result = build_demographics(rows, k_anonymity=10)["age"]
    labels = {bucket["label"]: bucket for bucket in result["buckets"]}
    assert "18-24" in labels
    assert all("16" not in label and "minor" not in label for label in labels)
    assert result["excluded_minors"] == 1
    assert UNKNOWN in labels


def test_coverage_uses_users_with_enough_signal_not_post_count():
    rows = [post("known", location="Delhi, India"), post("known", location="Delhi, India"), post("unknown")]
    result = build_demographics(rows, k_anonymity=1)["geography"]
    assert result["coverage"] == 50.0
    assert next(bucket for bucket in result["buckets"] if bucket["label"] == UNKNOWN)["users"] == 1


def test_endpoint_returns_no_hashed_identifier_or_per_user_field(monkeypatch):
    # Import lazily because the API module creates its production clients at import time.
    import main
    db_client = mongomock.MongoClient()
    db = db_client["social_intel"]
    db["raw_posts"].insert_many([post(f"hash_{i}", bio="I am 22") for i in range(10)])
    monkeypatch.setattr(main, "raw_posts", db["raw_posts"])
    monkeypatch.setattr(main, "mongo_client", db_client)
    monkeypatch.setattr(main, "MONGO_DB_NAME", "social_intel")
    response = main.get_demographics(from_time=None, to_time=None)
    serialized = str(response)
    assert "hash_" not in serialized
    assert "author_id" not in serialized
    stored = db["demographic_aggregates"].find_one({}, {"_id": 0})
    assert "hash_" not in str(stored)
    assert "author_id" not in str(stored)
