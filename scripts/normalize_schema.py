"""Idempotently backfill canonical raw_posts fields without inventing timestamps.

Run from the repository root: ``python scripts/normalize_schema.py``.
"""
from __future__ import annotations

import os
import sys
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
from app.schema import DERIVED_FIELDS, empty_metrics, ensure_raw_post_indexes  # noqa: E402

load_dotenv(ROOT / ".env")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")


def present(value: Any) -> bool:
    return value is not None and value != ""


def iso_from_epoch(value: Any) -> str | None:
    if not present(value):
        return None
    try:
        return datetime.fromtimestamp(float(value), tz=timezone.utc).isoformat()
    except (TypeError, ValueError, OverflowError):
        return None


def inferred_event_type(doc: dict[str, Any]) -> str:
    if present(doc.get("event_type")):
        return doc["event_type"]
    if doc.get("metadata", {}).get("event_type"):
        return doc["metadata"]["event_type"]
    if doc.get("parent_id") or doc.get("reply_to_author"):
        return "comment"
    return "post"


def hid(value: Any) -> str | None:
    return hashlib.sha256(str(value).encode()).hexdigest()[:16] if present(value) else None


def canonical_source_mode(value: Any) -> Any:
    """Map only retired historical labels to the documented schema labels."""
    return {"REPLAY": "IMPORT", "REAL": "LIVE", "SYNTHETIC": "SYNTH"}.get(value, value)


def normalization_set(doc: dict[str, Any]) -> dict[str, Any]:
    """Values to add only when their target is missing; no timestamps are invented."""
    platform = doc.get("platform")
    post_id = doc.get("post_id") or doc.get("native_id")
    if not present(post_id) and present(doc.get("canonical_id")):
        post_id = str(doc["canonical_id"]).rsplit(":", 1)[-1]
    changes: dict[str, Any] = {}
    if not present(doc.get("post_id")) and present(post_id):
        changes["post_id"] = str(post_id)
    if not present(doc.get("canonical_id")) and present(platform) and present(post_id):
        changes["canonical_id"] = f"{platform}:{post_id}"
    if not present(doc.get("created_at")):
        created = doc.get("published_at") or iso_from_epoch(doc.get("created_utc"))
        changes["created_at"] = created if present(created) else None
    if not present(doc.get("ingested_at")):
        collected = doc.get("collected_at")
        changes["ingested_at"] = collected if present(collected) else None
    if "lang" not in doc:
        changes["lang"] = None
    if not present(doc.get("event_type")):
        changes["event_type"] = inferred_event_type(doc)
    for field, default in {
        "parent_id": None, "author_id": None, "reply_to_author": None,
        "text": doc.get("text_content") if present(doc.get("text_content")) else None,
        "hashtags": [], "mentions": [], "urls": [], "dataset": None, "source_file": None,
        "source_mode": canonical_source_mode(doc.get("metadata", {}).get("source_mode")) or None,
    }.items():
        if field not in doc:
            changes[field] = default
    source_mode = canonical_source_mode(doc.get("source_mode") or doc.get("metadata", {}).get("source_mode") or changes.get("source_mode"))
    if source_mode != doc.get("source_mode") and source_mode is not None:
        changes["source_mode"] = source_mode
    if source_mode == "IMPORT":
        if not present(doc.get("dataset")) or doc.get("dataset") == "None":
            changes["dataset"] = f"{platform}_historical_archive" if platform != "reddit" else "reddit_replay"
        if not present(doc.get("source_file")) or doc.get("source_file") == "None":
            changes["source_file"] = f"data/raw/{platform}_replay.jsonl" if platform != "reddit" else "data/raw/reddit_replay.jsonl"
    if not present(doc.get("author_id")) and present(doc.get("author_username")):
        changes["author_id"] = hid(doc["author_username"])
    if not isinstance(doc.get("metrics"), dict):
        changes["metrics"] = empty_metrics()
    else:
        metric_changes = {key: doc["metrics"].get(key) for key in empty_metrics() if key not in doc["metrics"]}
        if metric_changes:
            changes["metrics"] = {**doc["metrics"], **metric_changes}
    for field in DERIVED_FIELDS:
        if field not in doc:
            changes[field] = None
    return changes


def normalize_collection(collection) -> dict[str, dict[str, int]]:
    """Backfill missing fields and return per-platform before/after timestamp counts."""
    platforms = [p for p in collection.distinct("platform") if p is not None]
    report: dict[str, dict[str, int]] = {}
    for platform in platforms:
        query = {"platform": platform}
        before = collection.count_documents({**query, "created_at": {"$exists": True, "$ne": None}})
        ops = []
        for doc in collection.find(query):
            changes = normalization_set(doc)
            raw_author_fields = [field for field in ("author_username", "author") if field in doc]
            if changes or raw_author_fields:
                update: dict[str, Any] = {"$set": changes}
                if raw_author_fields:
                    update["$unset"] = {field: "" for field in raw_author_fields}
                ops.append(UpdateOne({"_id": doc["_id"]}, update))
        if ops:
            try:
                collection.bulk_write(ops, ordered=False)
            except TypeError:
                # mongomock releases before full PyMongo 4.10 bulk support.
                for op in ops:
                    collection.update_one(op._filter, op._doc, upsert=op._upsert)
        total = collection.count_documents(query)
        after = collection.count_documents({**query, "created_at": {"$exists": True, "$ne": None}})
        report[str(platform)] = {"documents": total, "created_at_before": before, "created_at_after": after, "updated": len(ops)}
    ensure_raw_post_indexes(collection)
    return report


def main() -> None:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    try:
        report = normalize_collection(client[DB_NAME][COLLECTION_NAME])
        for platform, counts in sorted(report.items()):
            print(f"{platform}: {counts}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
