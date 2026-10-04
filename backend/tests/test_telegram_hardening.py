import json
from unittest.mock import MagicMock, patch

import httpx
import mongomock

from app.collectors.telegram_ingestor import hid, normalize, poll_once


def msg(kind="message", **extra):
    data = {"message_id": 9, "date": 1760000000, "chat": {"id": 42, "title": "Test", "username": "public_test"},
            "from": {"id": 7}, "text": "hello #tag @person https://example.test"}
    data.update(extra)
    return {"update_id": 20, kind: data}


def response(status=200, result=None):
    r = MagicMock(status_code=status)
    r.json.return_value = {"ok": status == 200, "result": result or []}
    r.raise_for_status.side_effect = httpx.HTTPStatusError("bad", request=MagicMock(), response=r) if status >= 400 else None
    return r


def test_content_variants_and_redaction():
    reply = msg(reply_to_message={"message_id": 8, "from": {"id": 6}})
    forward = msg(forward_origin={"sender_user": {"id": 5}})
    caption = msg(caption="caption", text=None)
    for update in (msg("message"), msg("edited_message"), msg("channel_post"), msg("edited_channel_post"), caption):
        doc = normalize(update)
        assert doc and doc["created_at"] and doc["source_mode"] == "LIVE"
        assert doc["post_id"].split(":")[0] == hid(42)
        assert doc["sender_id"] == hid(7)
        assert doc["post_id"] != "42:9" and doc["sender_id"] != "7"
    assert normalize(reply)["event_type"] == "reply"
    assert normalize(reply)["reply_to_author"] == hid(6)
    assert normalize(forward)["forwarded_from"] == hid(5)
    assert normalize({"update_id": 1, "message": {"message_id": 1, "chat": {"id": 1}, "new_chat_members": []}}) is None


def test_statuses_offsets_lease_and_409(monkeypatch):
    monkeypatch.setenv("ENABLED_SOURCES", "telegram")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "test-token")
    db = mongomock.MongoClient().db
    calls = [response(409), response(200, [msg()]), response(200, [])]
    with patch("httpx.get", side_effect=calls), patch("httpx.post", return_value=response() ) as webhook:
        result = poll_once(db)
    assert result == 1 and webhook.call_count == 1
    assert db.collector_state.find_one({"_id": "telegram_bot_offset"})["offset"] == 21
    assert db.raw_posts.count_documents({"platform": "telegram"}) == 1
    db.collector_state.update_one({"_id": "telegram_poller_lease"}, {"$set": {"locked_until": 9999999999, "lease_id": "other"}})
    assert poll_once(db).summary["reason"] == "lease_held"
    db.collector_state.update_one({"_id": "telegram_poller_lease"}, {"$set": {"locked_until": 0}})
    with patch("httpx.get", return_value=response(401)):
        assert poll_once(db).summary["reason"] == "token_invalid"
    with patch("httpx.get", side_effect=httpx.ConnectError("offline")):
        assert poll_once(db).summary["status"] == "DEGRADED"
