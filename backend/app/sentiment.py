"""Materialised thread and time-window sentiment views."""
from __future__ import annotations
from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any

POLARITY = ("positive", "negative", "neutral")
EMOTIONS = ("anxiety", "anger", "excitement", "joy", "sadness", "neutral")
STANCES = ("supportive", "against", "neutral")

def _date(value: Any):
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc)
    except (TypeError, ValueError): return None

def _topic(post): return str(post.get("topic") or post.get("narrative_name") or post.get("topic_id", {}).get("value") or "__all__")

def rebuild_threads(posts, database) -> int:
    coll, threads = posts, database["threads"]
    parents = coll.distinct("parent_id", {"parent_id": {"$ne": None}})
    changed = 0
    for parent_id in parents:
        replies = list(coll.find({"parent_id": parent_id, "sentiment.label": {"$exists": True}}))
        if not replies: continue
        root = coll.find_one({"$or": [{"post_id": parent_id}, {"canonical_id": parent_id}, {"native_id": parent_id}]})
        scores = [float(r.get("sentiment", {}).get("score", 0)) for r in replies]
        emotions = Counter(r.get("emotions", {}).get("label", "neutral") for r in replies)
        against = sum(r.get("stance", {}).get("label") == "against" for r in replies)
        threads.update_one({"parent_id": str(parent_id)}, {"$set": {"parent_id": str(parent_id), "parent_post_id": str((root or {}).get("post_id") or parent_id), "platform": (root or replies[0]).get("platform"), "reply_count": len(replies), "mean_polarity": round(sum(scores)/len(scores), 4), "dominant_emotion": emotions.most_common(1)[0][0], "against_pct": round(against * 100 / len(replies), 2), "updated_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        changed += 1
    return changed

def rebuild_rollups(posts, database) -> int:
    groups = defaultdict(list)
    for post in posts.find({"sentiment.label": {"$exists": True}}):
        when = _date(post.get("created_at") or post.get("published_at") or post.get("ingested_at"))
        if not when: continue
        for resolution, stamp in (("hour", when.replace(minute=0, second=0, microsecond=0)), ("day", when.replace(hour=0, minute=0, second=0, microsecond=0))):
            groups[(resolution, stamp.isoformat(), post.get("platform") or "unknown", (post.get("source_mode") or "UNKNOWN").upper(), _topic(post))].append(post)
    rollups = database["sentiment_rollups"]
    rollups.delete_many({})
    rows = []
    for (resolution, bucket, platform, source_mode, topic), values in groups.items():
        polarity, emotion, stance = Counter(), Counter(), Counter()
        for item in values:
            polarity[item.get("sentiment", {}).get("label", "neutral")] += 1
            emotion[item.get("emotions", {}).get("label", "neutral")] += 1
            stance[item.get("stance", {}).get("label", "neutral")] += 1
        rows.append({"resolution": resolution, "bucket": bucket, "platform": platform, "source_mode": source_mode, "topic": topic, "count": len(values), "polarity": {k: polarity[k] for k in POLARITY}, "emotions": {k: emotion[k] for k in EMOTIONS}, "stance": {k: stance[k] for k in STANCES}, "updated_at": datetime.now(timezone.utc).isoformat()})
    if rows: rollups.insert_many(rows)
    return len(rows)

def timeline(database, start=None, end=None, platform=None, source_mode=None, topic=None, resolution="hour"):
    query = {"resolution": resolution}
    if start or end: query["bucket"] = {**({"$gte": start} if start else {}), **({"$lte": end} if end else {})}
    if platform: query["platform"] = platform.lower()
    if source_mode: query["source_mode"] = source_mode.upper()
    if topic: query["topic"] = topic
    return list(database["sentiment_rollups"].find(query, {"_id": 0}).sort("bucket", 1))

def shifts(database, threshold=.25):
    rows = list(database["sentiment_rollups"].find({"resolution": "hour"}, {"_id": 0}).sort("bucket", 1))
    series = defaultdict(list)
    for row in rows:
        series[(row["platform"], row["source_mode"], row["topic"])].append(row)
    results = []
    for (platform, source_mode, topic), series_rows in series.items():
        previous = None
        for row in series_rows:
            total = max(1, row["count"]); score = (row["polarity"].get("positive", 0)-row["polarity"].get("negative", 0))/total
            if previous and abs(score-previous[0]) >= threshold:
                start = _date(row["bucket"])
                from datetime import timedelta
                window = {"$gte": start.isoformat(), "$lt": (start + timedelta(hours=1)).isoformat()}
                drivers = list(database["raw_posts"].find({"platform": platform, "$or": [{"created_at": window}, {"published_at": window}]}, {"_id": 0}).sort("sentiment.confidence", -1).limit(10))
                results.append({"bucket": row["bucket"], "platform": platform, "source_mode": source_mode, "topic": topic, "previous_score": round(previous[0], 3), "score": round(score, 3), "delta": round(score-previous[0], 3), "posts": drivers})
            previous = (score, row)
    return results
