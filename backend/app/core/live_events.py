"""Privacy-safe recent-insert events for single and multi-worker deployments."""
from __future__ import annotations

import queue
import threading
import hashlib
from collections import deque
from datetime import datetime, timezone

_subscribers: set[queue.Queue] = set()
_lock = threading.Lock()
_history: deque[dict] = deque(maxlen=200)
_event_id = 0
_watcher_started = False


def event_from_document(doc: dict) -> dict:
    text = str(doc.get("text") or doc.get("text_content") or "")
    raw_pid = str(doc.get("post_id") or doc.get("canonical_id") or "")
    event_post_id = hashlib.sha256(raw_pid.encode()).hexdigest()[:16] if raw_pid else hashlib.sha256(text[:60].encode()).hexdigest()[:16]
    author_id = doc.get("author_id")
    short_author = str(author_id)[:12] if author_id else None
    return {
        "platform": doc.get("platform"),
        "source_mode": doc.get("source_mode") or "UNKNOWN",
        "event_type": doc.get("event_type") or "post",
        "post_id": event_post_id,
        "author_short_id": short_author,
        "created_at": doc.get("created_at") or doc.get("published_at"),
        "collected_at": doc.get("collected_at") or doc.get("ingested_at"),
        "ingested_at": doc.get("ingested_at") or doc.get("collected_at"),
        "text_preview": text[:140],
        "text": text,
        "permalink": doc.get("url") or (doc.get("urls") or [None])[0],
        "topic_id": doc.get("topic_id") or doc.get("narrative_id"),
        "dataset": doc.get("dataset"),
        "metrics": doc.get("metrics"),
        "sentiment_label": doc.get("sentiment_label") or (doc.get("sentiment") or {}).get("label"),
        "author_known": bool(author_id),
    }


def publish_documents(documents: list[dict]) -> None:
    global _event_id
    events = [event_from_document(doc) for doc in documents]
    with _lock:
        for event in events:
            _event_id += 1
            event["id"] = str(_event_id)
            _history.append(event)
        subscribers = tuple(_subscribers)
    for subscriber in subscribers:
        for event in events:
            try: subscriber.put_nowait(event)
            except queue.Full: pass


def subscribe() -> queue.Queue:
    subscriber: queue.Queue = queue.Queue(maxsize=200)
    with _lock: _subscribers.add(subscriber)
    return subscriber


def unsubscribe(subscriber: queue.Queue) -> None:
    with _lock: _subscribers.discard(subscriber)


def replay_after(last_event_id: str | None) -> list[dict]:
    """Return at most the retained 200 events newer than Last-Event-ID."""
    try: last_id = int(last_event_id or 0)
    except (TypeError, ValueError): last_id = 0
    with _lock:
        return [event.copy() for event in _history if int(event["id"]) > last_id]


def start_shared_watcher(collection, poll_seconds: float = 3.0) -> None:
    """One process-wide Mongo poller fans new records out to all SSE clients."""
    global _watcher_started
    with _lock:
        if _watcher_started: return
        _watcher_started = True
    def watch() -> None:
        cursor = None
        while True:
            try:
                events, cursor = recent_events(collection, cursor, 200)
                # Events read from Mongo are already privacy-safe representations;
                # publish_documents accepts documents, so fan out directly here.
                global _event_id
                with _lock:
                    for event in events:
                        _event_id += 1
                        event["id"] = str(_event_id)
                        _history.append(event)
                    subscribers = tuple(_subscribers)
                for subscriber in subscribers:
                    for event in events:
                        try: subscriber.put_nowait(event)
                        except queue.Full: break
            except Exception:
                # Database outages are represented by SSE reconnect/poll fallback.
                pass
            threading.Event().wait(poll_seconds)
    threading.Thread(target=watch, name="netra-live-event-watcher", daemon=True).start()


def recent_events(collection, since: str | None = None, limit: int = 50) -> tuple[list[dict], str | None]:
    query = {"$or": [{"collected_at": {"$exists": True}}, {"ingested_at": {"$exists": True}}]}
    projection = {"_id": 0, "platform": 1, "source_mode": 1, "event_type": 1,
        "post_id": 1, "canonical_id": 1, "author_id": 1, "created_at": 1, "published_at": 1,
        "collected_at": 1, "ingested_at": 1, "text": 1, "text_content": 1,
        "url": 1, "urls": 1, "topic_id": 1, "narrative_id": 1, "dataset": 1,
        "metrics": 1, "sentiment": 1, "sentiment_label": 1, "parent_id": 1,
        "conversation_id": 1, "reply_to_author": 1}
    if since:
        query = {"$and": [query, {"$or": [{"collected_at": {"$gt": since}}, {"ingested_at": {"$gt": since}}]}]}
        rows = list(collection.find(query, projection).sort("collected_at", 1).limit(limit))
    else:
        rows = list(collection.find(query, projection).sort("collected_at", -1).limit(limit))
        rows.reverse()
    events = [event_from_document(row) for row in rows]
    cursor = events[-1].get("collected_at") if events else since
    return events, cursor
