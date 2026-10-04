"""Shared raw_posts schema helpers.

This module deliberately contains no collection logic.  It keeps the database
contract and its indexes consistent across collectors, scripts, and the API.
"""
from __future__ import annotations

from typing import Any


CORE_FIELDS = (
    "platform", "post_id", "canonical_id", "parent_id", "author_id",
    "reply_to_author", "event_type", "text", "created_at", "ingested_at",
    "lang", "hashtags", "mentions", "urls", "metrics", "source_mode",
    "dataset", "source_file",
)
DERIVED_FIELDS = ("sentiment", "emotions", "stance", "sarcasm", "topic_id", "narrative_id")
METRIC_FIELDS = ("likes", "replies", "shares", "views")


def empty_metrics(**values: Any) -> dict[str, Any]:
    """Return the canonical metrics object, using ``None`` for unknown values."""
    return {field: values.get(field) for field in METRIC_FIELDS}


def ensure_raw_post_indexes(collection) -> None:
    """Create query indexes without imposing uniqueness on legacy null IDs."""
    collection.create_index([("platform", 1), ("created_at", -1)], name="platform_created_at")
    collection.create_index([("platform", 1), ("source_mode", 1), ("created_at", -1)], name="platform_mode_created_at")
    collection.create_index([("created_at", -1)], name="created_at_desc")
    collection.create_index(
        [("platform", 1), ("post_id", 1)],
        unique=True,
        name="platform_post_id_unique",
        partialFilterExpression={"platform": {"$type": "string"}, "post_id": {"$type": "string"}},
    )
    collection.create_index([("source_mode", 1)], name="source_mode")
    collection.create_index([("author_id", 1)], name="author_id")
    collection.create_index([("parent_id", 1)], name="parent_id")
    collection.create_index([("sentiment.model_version", 1)], name="sentiment_model_version")


def ensure_sentiment_indexes(database) -> None:
    """Indexes for materialised views; safe for both MongoDB and mongomock."""
    database["threads"].create_index([("parent_id", 1)], unique=True, name="thread_parent_unique")
    database["sentiment_rollups"].create_index(
        [("resolution", 1), ("bucket", 1), ("platform", 1), ("source_mode", 1), ("topic", 1)],
        name="sentiment_rollup_lookup",
    )
    database["demographic_aggregates"].create_index(
        [("platform", 1), ("source_mode", 1), ("topic", 1), ("from", 1), ("to", 1)],
        unique=True,
        name="demographic_aggregate_lookup",
    )
    database["trends"].create_index([("narrative_id", 1), ("window_end", -1)], unique=True, name="trend_window_lookup")


def schema_health(collection) -> dict[str, Any]:
    """Return field coverage and source-mode counts without returning post data."""
    fields = list(CORE_FIELDS)
    result: dict[str, Any] = {"platforms": {}}
    platforms = collection.distinct("platform")
    for platform in sorted(str(p) for p in platforms if p is not None):
        query = {"platform": platform}
        total = collection.count_documents(query)
        coverage = {
            field: round((collection.count_documents({"$and": [query, {field: {"$exists": True, "$ne": None}}]}) / total) * 100, 2)
            if total else 0.0
            for field in fields
        }
        modes: dict[str, int] = {}
        for doc in collection.aggregate([
            {"$match": query},
            {"$group": {"_id": {"$ifNull": ["$source_mode", "$metadata.source_mode"]}, "count": {"$sum": 1}}},
        ]):
            modes[str(doc["_id"] or "UNKNOWN").upper()] = doc["count"]
        result["platforms"][platform] = {
            "documents": total,
            "coverage": coverage,
            "source_modes": modes,
            "time_series_available": coverage["created_at"] == 100.0,
        }
    return result
