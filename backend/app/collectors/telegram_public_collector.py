"""Opt-in, read-only Telethon collection for an explicit public-channel allowlist."""
from __future__ import annotations

import asyncio
import hashlib
from datetime import datetime, timezone

from pymongo import MongoClient

from app.connectors import set_connector_status
from app.core.env_utils import get_clean_env, is_source_enabled
from app.core.live_events import publish_documents
from app.schema import empty_metrics


def hid(value): return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value is not None else None
def now(): return datetime.now(timezone.utc).isoformat()
def channels(): return [v.strip().lstrip("@") for v in get_clean_env("TELEGRAM_CHANNELS", "").split(",") if v.strip()]


def map_message(message, channel: str):
    text = getattr(message, "message", None) or ""
    date = getattr(message, "date", None)
    channel_hash = hid(channel)
    message_id = getattr(message, "id", None)
    if not message_id or not text:
        return None
    reply = getattr(message, "reply_to", None)
    parent = getattr(reply, "reply_to_msg_id", None)
    created_at = date.astimezone(timezone.utc).isoformat() if date else now()
    return {"platform": "telegram_public", "post_id": f"{channel_hash}:{message_id}",
            "canonical_id": f"telegram_public:{channel_hash}:{message_id}",
            "event_type": "reply" if parent else "message", "parent_id": f"{channel_hash}:{parent}" if parent else None,
            "author_id": hid(getattr(message, "sender_id", None)), "sender_id": hid(getattr(message, "sender_id", None)),
            "reply_to_author": None, "forwarded_from": hid(getattr(message, "fwd_from", None)),
            "text": text, "text_content": text, "created_at": created_at, "published_at": created_at,
            "collected_at": now(), "ingested_at": now(), "lang": None, "hashtags": [], "mentions": [], "urls": [],
            "url": f"https://t.me/{channel}/{message_id}", "permalink": f"https://t.me/{channel}/{message_id}",
            "metrics": empty_metrics(), "source_mode": "LIVE", "dataset": None, "source_file": None, "processed": False}


async def _collect(db, api_id: int, api_hash: str, session_value: str):
    from telethon import TelegramClient
    from telethon.sessions import StringSession
    client = TelegramClient(StringSession(session_value or None), api_id, api_hash)
    inserted = []
    try:
        await client.connect()
        for channel in channels():
            key = f"telegram_public_checkpoint:{hid(channel)}"
            checkpoint = db.collector_state.find_one({"_id": key}) or {}
            latest = int(checkpoint.get("last_message_id", 0))
            entity = await client.get_entity(channel)  # allowlist only; never joins or sends
            async for message in client.iter_messages(entity, min_id=latest, limit=int(get_clean_env("TELEGRAM_PUBLIC_MAX_MESSAGES", "50"))):
                latest = max(latest, message.id)
                doc = map_message(message, channel)
                if not doc:
                    continue
                if not db.raw_posts.find_one({"platform": "telegram_public", "post_id": doc["post_id"]}, {"_id": 1}): inserted.append(doc)
                db.raw_posts.update_one({"platform": "telegram_public", "post_id": doc["post_id"]}, {"$set": doc}, upsert=True)
            db.collector_state.update_one({"_id": key}, {"$set": {"last_message_id": latest, "last_polled_at": now()}}, upsert=True)
    finally:
        await client.disconnect()
    return inserted


def ingest_telegram_public(target_db=None):
    db = target_db if target_db is not None else MongoClient(get_clean_env("MONGO_URI", "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin"))[get_clean_env("DB_NAME", "social_intel")]
    if not is_source_enabled("telegram") or get_clean_env("TELEGRAM_PUBLIC_ENABLED", "false").lower() not in {"1", "true", "yes"}:
        set_connector_status(db, "telegram_public", "DISABLED", mode="LIVE", reason="not_enabled_in_this_build")
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build"}
    api_id, api_hash, session = get_clean_env("TELEGRAM_API_ID"), get_clean_env("TELEGRAM_API_HASH"), get_clean_env("TELEGRAM_SESSION")
    if not api_id or not api_hash or not channels():
        set_connector_status(db, "telegram_public", "CREDENTIALS_REQUIRED", mode="LIVE", reason="public_config_missing")
        return {"count": 0, "status": "CREDENTIALS_REQUIRED", "reason": "public_config_missing"}
    try:
        inserted = asyncio.run(_collect(db, int(api_id), api_hash, session))
    except Exception as exc:
        if exc.__class__.__name__ == "FloodWaitError":
            seconds = int(getattr(exc, "seconds", 0))
            if seconds: time_await(seconds)
            set_connector_status(db, "telegram_public", "RATE_LIMITED", mode="LIVE", reason="flood_wait", retry_after_seconds=seconds)
            return {"count": 0, "status": "RATE_LIMITED", "reason": "flood_wait"}
        set_connector_status(db, "telegram_public", "DEGRADED", mode="LIVE", reason="network_error")
        return {"count": 0, "status": "DEGRADED", "reason": "network_error"}
    publish_documents(inserted)
    set_connector_status(db, "telegram_public", "LIVE", mode="LIVE", success=True)
    return {"count": len(inserted), "status": "LIVE"}


def time_await(seconds: int):
    """Synchronous boundary for FloodWait; isolated for tests and bounded by Telegram's value."""
    import time
    time.sleep(seconds)
