import json
import io
import sys
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
import mongomock
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.collectors.youtube_ingestor import (
    ingest_youtube_videos,
    YouTubeQuotaManager,
    hid,
    get_next_pacific_midnight_utc
)


def make_mock_search_response(video_ids=["vid_101", "vid_102"]):
    return {
        "items": [
            {
                "id": {"videoId": vid},
                "snippet": {
                    "publishedAt": "2026-10-04T12:00:00Z",
                    "title": f"Cybersecurity Trends for {vid}",
                    "description": f"Detailed description for {vid}",
                    "channelId": f"channel_{vid}",
                    "channelTitle": f"TechChannel {vid}"
                }
            }
            for vid in video_ids
        ]
    }


def make_mock_videos_response(video_ids=["vid_101", "vid_102"]):
    return {
        "items": [
            {
                "id": vid,
                "snippet": {
                    "publishedAt": "2026-10-04T12:00:00Z",
                    "title": f"Cybersecurity Trends for {vid}",
                    "description": f"Detailed description for {vid}",
                    "channelId": f"channel_{vid}",
                    "channelTitle": f"TechChannel {vid}",
                    "thumbnails": {"high": {"url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"}}
                },
                "statistics": {
                    "viewCount": "12500",
                    "likeCount": "450",
                    "commentCount": "12"
                }
            }
            for vid in video_ids
        ]
    }


def make_mock_comment_threads_response(video_id="vid_101"):
    return {
        "items": [
            {
                "id": f"comment_{video_id}_1",
                "snippet": {
                    "topLevelComment": {
                        "id": f"comment_{video_id}_1",
                        "snippet": {
                            "textOriginal": "Great analysis on Indian cybersecurity!",
                            "textDisplay": "Great analysis on Indian cybersecurity!",
                            "authorDisplayName": "SecResearcher_RawName",
                            "authorChannelId": {"value": "UC_RawUserChannel123"},
                            "publishedAt": "2026-10-04T12:30:00Z",
                            "likeCount": 5
                        }
                    }
                },
                "replies": {
                    "comments": [
                        {
                            "id": f"reply_{video_id}_1_1",
                            "snippet": {
                                "textOriginal": "Agreed, critical infrastructure protection is key.",
                                "textDisplay": "Agreed, critical infrastructure protection is key.",
                                "authorDisplayName": "ReplyUser_RawName",
                                "authorChannelId": {"value": "UC_ReplyUserChannel456"},
                                "publishedAt": "2026-10-04T12:45:00Z",
                                "likeCount": 2
                            }
                        }
                    ]
                }
            }
        ]
    }


def test_youtube_video_first_retention_and_comment_disabled(monkeypatch):
    """Test that videos are retained even when comments are disabled on the video."""
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLED_SOURCES", "youtube")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaSyFakeKeyForTesting12345678901234")
    monkeypatch.setenv("YOUTUBE_QUERIES", "cybersecurity India")

    def mock_api_get(endpoint, params, quota_mgr, cost, api_key=None):
        if endpoint == "search":
            return make_mock_search_response(["vid_nodisable", "vid_disabled"])
        elif endpoint == "videos":
            return make_mock_videos_response(["vid_nodisable", "vid_disabled"])
        elif endpoint == "commentThreads":
            if params.get("videoId") == "vid_disabled":
                raise PermissionError("commentsDisabled")
            return make_mock_comment_threads_response("vid_nodisable")
        return {}

    monkeypatch.setattr("app.collectors.youtube_ingestor.api_get", mock_api_get)

    res = ingest_youtube_videos(target_db=db)
    assert res["status"] == "success"
    assert res["videos_count"] == 2
    assert res["comments_count"] == 2
    assert res["replies_count"] == 1

    # Check both videos are saved
    posts = list(db["raw_posts"].find({"event_type": "video"}))
    assert len(posts) == 2
    video_ids = {p["post_id"] for p in posts}
    assert "vid_nodisable" in video_ids
    assert "vid_disabled" in video_ids

    # Check that each video has created_at and source_mode LIVE
    for v in posts:
        assert v["source_mode"] == "LIVE"
        assert v["created_at"] is not None
        assert v["permalink"].startswith("https://www.youtube.com/watch?v=")
        # Author / Channel names are never stored raw
        assert "TechChannel" not in str(v["author_id"])
        assert "channel_" not in str(v["author_id"])


def test_youtube_reply_mapping_and_privacy(monkeypatch):
    """Test reply hierarchy, reply_to_author hashing, and zero privacy leaks."""
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLED_SOURCES", "youtube")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaSyFakeKeyForTesting12345678901234")

    def mock_api_get(endpoint, params, quota_mgr, cost, api_key=None):
        if endpoint == "search":
            return make_mock_search_response(["vid_101"])
        elif endpoint == "videos":
            return make_mock_videos_response(["vid_101"])
        elif endpoint == "commentThreads":
            return make_mock_comment_threads_response("vid_101")
        return {}

    monkeypatch.setattr("app.collectors.youtube_ingestor.api_get", mock_api_get)

    res = ingest_youtube_videos(target_db=db)
    assert res["status"] == "success"

    video = db["raw_posts"].find_one({"event_type": "video", "post_id": "vid_101"})
    comment = db["raw_posts"].find_one({"event_type": "comment", "post_id": "comment_vid_101_1"})
    reply = db["raw_posts"].find_one({"event_type": "reply", "post_id": "reply_vid_101_1_1"})

    assert video is not None
    assert comment is not None
    assert reply is not None

    # Top-level comment points to video
    assert comment["parent_id"] == "vid_101"
    assert comment["reply_to_author"] == video["author_id"]

    # Reply points to top-level comment
    assert reply["parent_id"] == "comment_vid_101_1"
    assert reply["reply_to_author"] == comment["author_id"]

    # Every event type is timeline-ready and explicitly marked as live.
    for doc in [video, comment, reply]:
        assert doc["created_at"]
        assert doc["source_mode"] == "LIVE"

    # Privacy verification: Raw display names or channels must NEVER appear
    for doc in [video, comment, reply]:
        doc_str = json.dumps(doc, default=str)
        assert "SecResearcher_RawName" not in doc_str
        assert "ReplyUser_RawName" not in doc_str
        assert "UC_RawUserChannel123" not in doc_str
        assert "UC_ReplyUserChannel456" not in doc_str
        assert "channel_vid_101" not in doc_str
        assert "AIzaSy" not in doc_str


def test_youtube_quota_exceeded_handling(monkeypatch):
    """Test quotaExceeded error sets status NO_CREDITS with reason daily_quota_reached."""
    from app.collectors.youtube_ingestor import QuotaExceededException
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLED_SOURCES", "youtube")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaSyFakeKeyForTesting12345678901234")

    def mock_api_get(endpoint, params, quota_mgr, cost, api_key=None):
        raise QuotaExceededException("Daily quota exceeded.")

    monkeypatch.setattr("app.collectors.youtube_ingestor.api_get", mock_api_get)

    res = ingest_youtube_videos(target_db=db)
    assert res["status"] == "NO_CREDITS"
    assert res["reason"] == "daily_quota_reached"
    assert res["resume_at"] is not None

    state = db["collector_state"].find_one({"_id": "connector:youtube"})
    assert state["status"] == "NO_CREDITS"
    assert state["reason"] == "daily_quota_reached"


def test_youtube_invalid_key_handling(monkeypatch):
    """Test invalid API key triggers CREDENTIALS_REQUIRED with key_invalid reason."""
    from app.collectors.youtube_ingestor import InvalidKeyException
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLED_SOURCES", "youtube")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaSyInvalidKeyTest123456789012345")

    def mock_api_get(endpoint, params, quota_mgr, cost, api_key=None):
        raise InvalidKeyException("keyInvalid")

    monkeypatch.setattr("app.collectors.youtube_ingestor.api_get", mock_api_get)

    res = ingest_youtube_videos(target_db=db)
    assert res["status"] == "CREDENTIALS_REQUIRED"
    assert res["reason"] == "key_invalid"

    state = db["collector_state"].find_one({"_id": "connector:youtube"})
    assert state["status"] == "CREDENTIALS_REQUIRED"
    assert state["reason"] == "key_invalid"


def test_youtube_duplicate_upsert(monkeypatch):
    """Test that multiple runs update existing documents without duplicating them."""
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("ENABLED_SOURCES", "youtube")
    monkeypatch.setenv("YOUTUBE_API_KEY", "AIzaSyFakeKeyForTesting12345678901234")

    def mock_api_get(endpoint, params, quota_mgr, cost, api_key=None):
        if endpoint == "search":
            return make_mock_search_response(["vid_101"])
        elif endpoint == "videos":
            return make_mock_videos_response(["vid_101"])
        elif endpoint == "commentThreads":
            return make_mock_comment_threads_response("vid_101")
        return {}

    monkeypatch.setattr("app.collectors.youtube_ingestor.api_get", mock_api_get)

    # Run 1
    res1 = ingest_youtube_videos(target_db=db)
    count1 = db["raw_posts"].count_documents({"platform": "youtube"})
    assert count1 == 3  # 1 video, 1 comment, 1 reply

    # Run 2 with same content
    res2 = ingest_youtube_videos(target_db=db)
    count2 = db["raw_posts"].count_documents({"platform": "youtube"})
    assert count2 == 3  # No duplicates created
