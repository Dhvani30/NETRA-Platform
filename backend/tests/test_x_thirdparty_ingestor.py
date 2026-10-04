import os
import sys
from pathlib import Path
from datetime import datetime, timezone
import mongomock

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app.collectors import x_thirdparty_ingestor as collector

class MockResponse:
    def __init__(self, body, code=200):
        self.body = body
        self.status_code = code
        self.is_success = code < 400

    def json(self):
        return self.body

    def raise_for_status(self):
        if not self.is_success:
            raise collector.httpx.HTTPStatusError("HTTP Error", request=None, response=self)

class MockClient:
    def __init__(self, responses):
        self.responses = iter(responses)

    def get(self, *args, **kwargs):
        return next(self.responses)

    def close(self):
        pass

def sample_tweet(**overrides):
    base = {
        "id": "tweet-101",
        "text": "Cyber threat intelligence alert #CyberSecurity #ThreatIntel",
        "createdAt": "Sun Oct 04 03:44:26 +0000 2026",
        "inReplyToId": None,
        "inReplyToUserId": None,
        "conversationId": "conv-999",
        "isReply": False,
        "lang": "en",
        "likeCount": 15,
        "retweetCount": 7,
        "replyCount": 3,
        "quoteCount": 2,
        "viewCount": 500,
        "entities": {
            "hashtags": [{"text": "CyberSecurity"}, {"tag": "ThreatIntel"}],
            "urls": [{"expanded_url": "https://threats.example.com/cve-2026"}],
            "user_mentions": [{"id": "user-victim-99"}]
        },
        "author": {
            "id": "author-8888",
            "name": "Jane RealName",
            "userName": "jane_handle",
            "description": "Cybersecurity researcher and threat analyst",
            "profile_bio": "Confidential personal bio text",
            "location": "New Delhi, India",
            "followers": 2500,
            "following": 350,
            "createdAt": "Sun Oct 04 03:44:26 +0000 2021",
            "isVerified": True,
            "isAutomated": False
        }
    }
    base.update(overrides)
    return base

def test_created_at_parsing():
    """Verify %a %b %d %H:%M:%S %z %Y format parses to UTC ISO string."""
    ts = "Sun Oct 04 03:44:26 +0000 2026"
    parsed = collector.parse_created_at(ts)
    assert parsed == "2026-10-04T03:44:26+00:00"

    # Check None/invalid values
    assert collector.parse_created_at(None) is None
    assert collector.parse_created_at("invalid-date") is None

def test_event_types():
    """Verify mapping of repost, quote, reply, and standard post."""
    # 1. Repost (retweeted_tweet present)
    repost_t = sample_tweet(retweeted_tweet={"id": "original-post-1", "author": {"id": "orig-author-99"}})
    doc_repost = collector.map_tweet(repost_t, "topic-cyber")
    assert doc_repost["event_type"] == "repost"
    assert doc_repost["repost_of"] == "original-post-1"
    assert doc_repost["repost_of_author"] == collector.hid("orig-author-99")

    # 2. Quote (quoted_tweet present)
    quote_t = sample_tweet(quoted_tweet={"id": "quoted-post-2"})
    doc_quote = collector.map_tweet(quote_t, "topic-cyber")
    assert doc_quote["event_type"] == "quote"
    assert doc_quote["quote_of"] == "quoted-post-2"

    # 3. Reply (isReply = True or inReplyToId present)
    reply_t = sample_tweet(isReply=True, inReplyToId="parent-post-3", inReplyToUserId="parent-user-4")
    doc_reply = collector.map_tweet(reply_t, "topic-cyber")
    assert doc_reply["event_type"] == "reply"
    assert doc_reply["parent_id"] == "parent-post-3"
    assert doc_reply["reply_to_author"] == collector.hid("parent-user-4")

    # 4. Standard post
    post_t = sample_tweet()
    doc_post = collector.map_tweet(post_t, "topic-cyber")
    assert doc_post["event_type"] == "post"
    assert doc_post["parent_id"] is None

def test_reply_mapping_and_hashing():
    """Verify author IDs and reply targets are hashed with sha256 16-char prefix."""
    raw_user = "user-to-reply-1234"
    raw_author = "author-5678"
    t = sample_tweet(isReply=True, inReplyToId="msg-1", inReplyToUserId=raw_user)
    t["author"]["id"] = raw_author

    doc = collector.map_tweet(t, "topic-cyber")

    expected_reply_hash = collector.hid(raw_user)
    expected_author_hash = collector.hid(raw_author)

    assert doc["reply_to_author"] == expected_reply_hash
    assert doc["author_id"] == expected_author_hash
    assert raw_user not in (doc["reply_to_author"], doc["author_id"])
    assert raw_author not in (doc["reply_to_author"], doc["author_id"])
    assert len(doc["author_id"]) == 16
    assert len(doc["reply_to_author"]) == 16

def test_entity_parsing_both_styles():
    """Verify entity parser defensively handles snake_case, camelCase, and alternate key names."""
    # Style A: standard snake_case
    tweet_a = sample_tweet(entities={
        "hashtags": [{"text": "CyberSecurity"}],
        "urls": [{"expanded_url": "https://a.test/intel"}],
        "user_mentions": [{"id": "mention-user-1"}]
    })
    doc_a = collector.map_tweet(tweet_a, "topic-1")
    assert doc_a["hashtags"] == ["cybersecurity"]
    assert doc_a["urls"] == ["https://a.test/intel"]
    assert doc_a["mentions"] == [collector.hid("mention-user-1")]

    # Style B: camelCase / alt key names (tag, expandedUrl, userId)
    tweet_b = sample_tweet(entities={
        "hashTags": [{"tag": "ZeroDay"}, {"name": "Exploit"}],
        "urls": [{"expandedUrl": "https://b.test/report"}],
        "userMentions": [{"userId": "mention-user-2"}]
    })
    doc_b = collector.map_tweet(tweet_b, "topic-1")
    assert doc_b["hashtags"] == ["zeroday", "exploit"]
    assert doc_b["urls"] == ["https://b.test/report"]
    assert doc_b["mentions"] == [collector.hid("mention-user-2")]

def test_privacy_no_raw_handles_or_names_persisted():
    """Verify strict privacy: no author name, username, bio, raw location, or photo in doc."""
    t = sample_tweet()
    doc = collector.map_tweet(t, "topic-1")
    doc_str = str(doc)

    # Assert raw PII strings never appear in the persisted document
    assert "Jane RealName" not in doc_str
    assert "jane_handle" not in doc_str
    assert "Confidential personal bio text" not in doc_str
    assert "New Delhi, India" not in doc_str
    assert "profile_bio" not in doc
    assert "userName" not in doc
    assert "name" not in doc

    # Assert coarse profile_signals are extracted safely
    signals = doc["profile_signals"]
    assert signals["bio_language"] in {"en", "unknown"}
    assert signals["interest_category"] == "security"
    assert signals["location_country_or_state"] == "india"
    assert signals["followers_bucket"] == "1k-9.9k"
    assert signals["following_bucket"] == "100-999"
    assert signals["account_age_bucket"] in {"1-5y", "5y+"}
    assert signals["is_verified"] is True
    assert signals["is_automated"] is False

def test_caps_and_budget(monkeypatch):
    """Verify X_TP_MAX_TWEETS_PER_RUN, X_TP_DAILY_TWEET_BUDGET, and cost estimation."""
    db = mongomock.MongoClient()["social_intel"]
    db.watchlist.insert_one({
        "id": "t1", "name": "Threats", "keywords": ["cve"], "hashtags": [],
        "languages": [], "subreddits": [], "telegram_channels": [], "youtube_queries": [],
        "enabled": True
    })

    monkeypatch.setenv("TWITTERAPI_IO_KEY", "mock-secret-key-12345")
    monkeypatch.setenv("X_TP_MAX_TWEETS_PER_RUN", "2")
    monkeypatch.setenv("X_TP_DAILY_TWEET_BUDGET", "3")

    # Run 1: 2 tweets ingested (capped by per-run max)
    mock_tweets_run1 = [
        sample_tweet(id="tw-1"),
        sample_tweet(id="tw-2"),
        sample_tweet(id="tw-3")
    ]
    client_1 = MockClient([MockResponse({"tweets": mock_tweets_run1, "has_next_page": False})])
    res_1 = collector.ingest_x_thirdparty(db, client=client_1)

    assert res_1["count"] == 2
    assert res_1["budget_used"] == 2
    assert res_1["estimated_cost_usd"] == round(2 * 0.00015, 6)
    assert res_1["status"] == "LIVE"

    # Run 2: Only 1 remaining in daily budget (3 - 2 = 1)
    mock_tweets_run2 = [
        sample_tweet(id="tw-4"),
        sample_tweet(id="tw-5")
    ]
    client_2 = MockClient([MockResponse({"tweets": mock_tweets_run2, "has_next_page": False})])
    res_2 = collector.ingest_x_thirdparty(db, client=client_2)

    assert res_2["count"] == 1
    assert res_2["budget_used"] == 3
    assert res_2["estimated_cost_usd"] == round(1 * 0.00015, 6)

    # Run 3: Daily budget exhausted -> NO_CREDITS immediately
    res_3 = collector.ingest_x_thirdparty(db, client=MockClient([]))
    assert res_3["status"] == "NO_CREDITS"
    assert res_3["count"] == 0

def test_clean_stop_on_402_and_429(monkeypatch):
    """Verify 402 returns NO_CREDITS and 429 returns RATE_LIMITED cleanly."""
    db = mongomock.MongoClient()["social_intel"]
    db.watchlist.insert_one({"id": "t1", "name": "T", "keywords": ["q"], "hashtags": [], "languages": [], "subreddits": [], "telegram_channels": [], "youtube_queries": [], "enabled": True})
    monkeypatch.setenv("TWITTERAPI_IO_KEY", "mock-key")

    # Test 429 Rate Limit
    client_429 = MockClient([MockResponse({}, code=429)])
    res_429 = collector.ingest_x_thirdparty(db, client=client_429)
    assert res_429["status"] == "RATE_LIMITED"

    # Test 402 Payment / No Credits
    client_402 = MockClient([MockResponse({}, code=402)])
    res_402 = collector.ingest_x_thirdparty(db, client=client_402)
    assert res_402["status"] == "NO_CREDITS"

def test_missing_key_disabled(monkeypatch):
    """Verify collector is cleanly DISABLED without key."""
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLE_X", "1")
    monkeypatch.delenv("TWITTERAPI_IO_KEY", raising=False)
    res = collector.ingest_x_thirdparty(db)
    assert res["status"] == "DISABLED"
    assert res["count"] == 0
    assert res["reason"] == "credentials_missing"

def test_secret_redaction(monkeypatch):
    """Verify the API key is never leaked in status records or responses."""
    secret_key = "super_secret_twitterapi_key_xyz999"
    monkeypatch.setenv("TWITTERAPI_IO_KEY", secret_key)
    db = mongomock.MongoClient()["social_intel"]
    db.watchlist.insert_one({"id": "t1", "name": "T", "keywords": ["q"], "hashtags": [], "languages": [], "subreddits": [], "telegram_channels": [], "youtube_queries": [], "enabled": True})

    # Cause a rate limit
    client = MockClient([MockResponse({}, code=429)])
    res = collector.ingest_x_thirdparty(db, client=client)

    # Check that secret_key is not in returned dictionary
    assert secret_key not in str(res)

    # Check collector_state
    connector_doc = db.collector_state.find_one({"_id": "connector:x"}) or {}
    assert secret_key not in str(connector_doc)
