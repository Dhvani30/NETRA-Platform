"""Safe, idempotent Telegram Bot API polling."""
from __future__ import annotations

import hashlib
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv
from pymongo import MongoClient, ReturnDocument, UpdateOne

from app.connectors import set_connector_status
from app.core.env_utils import get_clean_env, is_source_enabled
from app.core.live_events import publish_documents
from app.schema import empty_metrics

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
MONGO_URI = get_clean_env("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = get_clean_env("DB_NAME", "social_intel")
URL_RE = re.compile(r"https?://[^\s<>()]+", re.I)
TAG_RE = re.compile(r"(?<!\w)#([\w_]+)", re.UNICODE)
MENTION_RE = re.compile(r"(?<!\w)@([\w_]+)", re.UNICODE)


def get_db():
    return MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)[DB_NAME]


def hid(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()[:16] if value is not None else None


class PollResult(int):
    """Integer-compatible result for legacy callers plus scheduler metadata."""
    def __new__(cls, count: int, status="LIVE", reason=None, **extra):
        result = int.__new__(cls, count)
        result.summary = {"count": count, "status": status, "reason": reason, **extra}
        return result


def _token():
    return get_clean_env("TELEGRAM_BOT_TOKEN", "")


def _api(token: str) -> str:
    return f"https://api.telegram.org/bot{token}"


def _update_message(update: dict):
    for kind in ("message", "edited_message", "channel_post", "edited_channel_post"):
        if update.get(kind):
            return kind, update[kind]
    return None, None


def normalize(update: dict):
    """Map content updates without retaining Telegram account or chat IDs."""
    update_type, message = _update_message(update)
    if not message:
        return None
    text = message.get("text") or message.get("caption")
    if not text:  # service messages, joins, pins, and media without captions
        return None
    chat = message.get("chat") or {}
    chat_id, message_id = chat.get("id"), message.get("message_id")
    if chat_id is None or message_id is None:
        return None
    sender = message.get("from") or message.get("sender_chat") or {}
    reply = message.get("reply_to_message") or {}
    reply_sender = reply.get("from") or reply.get("sender_chat") or {}
    forward = message.get("forward_origin") or {}
    forward_sender = forward.get("sender_user") or forward.get("sender_chat") or forward.get("chat") or {}
    chat_hash = hid(chat_id)
    post_id = f"{chat_hash}:{message_id}"
    parent_id = f"{chat_hash}:{reply['message_id']}" if reply.get("message_id") else None
    username = chat.get("username")
    permalink = f"https://t.me/{username}/{message_id}" if username else None
    created_at = datetime.fromtimestamp(message.get("date", time.time()), tz=timezone.utc).isoformat()
    collected_at = datetime.now(timezone.utc).isoformat()
    event_type = "reply" if parent_id else ("forward" if forward else update_type)
    return {
        "platform": "telegram", "post_id": post_id, "canonical_id": f"telegram:{post_id}",
        "event_type": event_type, "update_type": update_type, "parent_id": parent_id,
        "author_id": hid(sender.get("id")), "sender_id": hid(sender.get("id")),
        "reply_to_author": hid(reply_sender.get("id")), "forwarded_from": hid(forward_sender.get("id")),
        "channel_title": chat.get("title") or None, "text": text, "text_content": text,
        "created_at": created_at, "published_at": created_at, "collected_at": collected_at,
        "ingested_at": collected_at, "hashtags": [f"#{v}" for v in TAG_RE.findall(text)],
        "mentions": [f"@{v}" for v in MENTION_RE.findall(text)], "urls": URL_RE.findall(text),
        "url": permalink, "permalink": permalink, "lang": None, "metrics": empty_metrics(),
        "source_mode": "LIVE", "dataset": None, "source_file": None, "processed": False,
    }


def acquire_poller_lock(state_coll, timeout_seconds=20):
    """Acquire an atomic expiring lease without replacing a live owner."""
    now, lease_id = time.time(), uuid.uuid4().hex
    try:
        doc = state_coll.find_one_and_update(
            {"_id": "telegram_poller_lease", "$or": [{"locked_until": {"$lte": now}}, {"locked_until": {"$exists": False}}]},
            {"$set": {"lease_id": lease_id, "locked_until": now + timeout_seconds,
                      "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True, return_document=ReturnDocument.AFTER,
        )
        return lease_id if doc and doc.get("lease_id") == lease_id else None
    except Exception:  # duplicate-key means another process won the lease
        return None


def release_poller_lock(state_coll, lease_id):
    if lease_id:
        state_coll.update_one({"_id": "telegram_poller_lease", "lease_id": lease_id}, {"$set": {"locked_until": 0}})


def _status(db, status, reason=None, success=False, **extra):
    set_connector_status(db, "telegram", status, mode="LIVE", reason=reason, success=success, **extra)


def _get_updates(api, offset):
    return httpx.get(f"{api}/getUpdates", params={"offset": offset, "timeout": 5,
                      "allowed_updates": '["message","edited_message","channel_post","edited_channel_post"]'})


def _bot_username(state, api):
    """Cache public bot identity so polling does not add a request every turn."""
    cached = state.find_one({"_id": "telegram_bot_identity"}) or {}
    if cached.get("username"):
        return cached["username"]
    try:
        body = httpx.get(f"{api}/getMe", timeout=12).json()
        username = (body.get("result") or {}).get("username")
        if username:
            state.update_one({"_id": "telegram_bot_identity"}, {"$set": {"username": username}}, upsert=True)
        return username
    except (httpx.HTTPError, ValueError, AttributeError):
        return None


def poll_once(target_db=None):
    """Poll Bot API once. Returns an int-compatible :class:`PollResult`."""
    if not is_source_enabled("telegram"):
        return PollResult(0, "DISABLED", "not_enabled_in_this_build")
    db = target_db if target_db is not None else get_db()
    state, posts = db["collector_state"], db["raw_posts"]
    token = _token()
    if not token:
        _status(db, "CREDENTIALS_REQUIRED", "token_missing")
        return PollResult(0, "CREDENTIALS_REQUIRED", "token_missing")
    lease_id = acquire_poller_lock(state)
    if not lease_id:
        return PollResult(0, "LIVE", "lease_held")
    try:
        offset = (state.find_one({"_id": "telegram_bot_offset"}) or {}).get("offset", 0)
        api = _api(token)
        try:
            response = _get_updates(api, offset)
            if response.status_code == 409:
                # A bounded recovery: exactly one deleteWebhook and one retry per poll.
                httpx.post(f"{api}/deleteWebhook", params={"drop_pending_updates": "false"}, timeout=12)
                response = _get_updates(api, offset)
            if response.status_code == 401:
                _status(db, "CREDENTIALS_REQUIRED", "token_invalid")
                return PollResult(0, "CREDENTIALS_REQUIRED", "token_invalid")
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError:
            _status(db, "DEGRADED", "http_error")
            return PollResult(0, "DEGRADED", "http_error")
        except httpx.HTTPError:
            _status(db, "DEGRADED", "network_error")
            return PollResult(0, "DEGRADED", "network_error")

        updates, ops, new_docs, last_update_id, chat_hashes = payload.get("result", []), [], [], None, set()
        for update in updates:
            update_id = update.get("update_id")
            if isinstance(update_id, int):
                last_update_id = max(last_update_id or update_id, update_id)
            doc = normalize(update)
            if not doc:
                continue
            chat_hashes.add(doc["post_id"].split(":", 1)[0])
            if not posts.find_one({"platform": "telegram", "post_id": doc["post_id"]}, {"_id": 1}):
                new_docs.append(doc)
            ops.append(UpdateOne({"platform": "telegram", "post_id": doc["post_id"]}, {"$set": doc}, upsert=True))
        if ops:
            try:
                posts.bulk_write(ops, ordered=False)
            except TypeError:  # mongomock compatibility
                for operation in ops:
                    posts.update_one(operation._filter, operation._doc, upsert=operation._upsert)
            publish_documents(new_docs)
        if last_update_id is not None:  # commit only after all document upserts succeed
            state.update_one({"_id": "telegram_bot_offset"}, {"$set": {"offset": last_update_id + 1,
                "last_polled_at": datetime.now(timezone.utc).isoformat()}}, upsert=True)
        reason, username = ("no_new_messages" if not ops else "active"), _bot_username(state, api)
        _status(db, "LIVE", reason, success=True, bot_username=username, distinct_chat_count=len(chat_hashes))
        return PollResult(len(ops), "LIVE", reason, bot_username=username, distinct_chat_count=len(chat_hashes))
    finally:
        release_poller_lock(state, lease_id)
