import os
import sys
import json
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch
import mongomock

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.collectors.youtube_ingestor import ingest_youtube_videos, hid

def create_mock_response(data: dict):
    bio = BytesIO(json.dumps(data).encode("utf-8"))
    mock_resp = MagicMock()
    mock_resp.read.side_effect = bio.read
    mock_resp.__enter__.return_value = mock_resp
    return mock_resp

def create_http_error(code: int, reason: str, message: str = ""):
    error_body = json.dumps({
        "error": {
            "code": code,
            "message": message or reason,
            "errors": [{"reason": reason, "message": message or reason}]
        }
    }).encode("utf-8")
    fp = BytesIO(error_body)
    err = urllib.error.HTTPError(
        url="https://www.googleapis.com/youtube/v3/test",
        code=code,
        msg=reason,
        hdrs={},
        fp=fp
    )
    return err

def test_video_first_retention_when_comments_disabled():
    """Verify video document is retained in MongoDB even when comments are disabled."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["social_intel"]

    search_resp = {
        "items": [{"id": {"videoId": "vid_disabled_01"}}]
    }
    videos_resp = {
        "items": [{
            "id": "vid_disabled_01",
            "snippet": {
                "title": "Restricted Comments Video",
                "description": "Educational content",
                "channelTitle": "Security Channel",
                "channelId": "UC_SEC_01",
                "publishedAt": "2026-10-01T12:00:00Z"
            },
            "statistics": {"viewCount": "5000", "likeCount": "250", "commentCount": "0"}
        }]
    }

    def mock_urlopen(req, timeout=12):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        if "search" in url:
            return create_mock_response(search_resp)
        elif "videos" in url:
            return create_mock_response(videos_resp)
        elif "commentThreads" in url:
            raise create_http_error(403, "commentsDisabled", "The video has disabled comments")
        return create_mock_response({})

    with patch("urllib.request.urlopen", side_effect=mock_urlopen), \
         patch("app.collectors.youtube_ingestor.YOUTUBE_QUERIES", ["test_query"]):
        result = ingest_youtube_videos(target_db=test_db)
        assert result["videos_count"] == 1
        assert result["comments_count"] == 0

        # Confirm video is retained in raw_posts
        video_doc = test_db["raw_posts"].find_one({"post_id": "vid_disabled_01"})
        assert video_doc is not None
        assert video_doc["event_type"] == "video"
        assert video_doc["platform"] == "youtube"
        assert video_doc["source_mode"] == "LIVE"
        assert video_doc["author_id"] == hid("UC_SEC_01")
        assert video_doc["created_at"] == video_doc["published_at"]
        assert video_doc["ingested_at"]
        assert set(video_doc["metrics"]) == {"likes", "replies", "shares", "views"}
    print("[PASS] test_video_first_retention_when_comments_disabled")

def test_quota_exceeded_handling():
    """Verify collector halts cleanly without crashing when quotaExceeded is encountered."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["social_intel"]

    def mock_urlopen(req, timeout=12):
        raise create_http_error(403, "quotaExceeded", "The request cannot be completed because you have exceeded your quota.")

    with patch("urllib.request.urlopen", side_effect=mock_urlopen):
        result = ingest_youtube_videos(target_db=test_db)
        assert result["status"] in ("NO_CREDITS", "quota_exceeded")
    print("[PASS] test_quota_exceeded_handling")

def test_duplicate_ingest_not_creating_duplicates():
    """Verify repeated ingestion of identical videos and comments is strictly idempotent."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["social_intel"]

    search_resp = {"items": [{"id": {"videoId": "vid_dup_01"}}]}
    videos_resp = {
        "items": [{
            "id": "vid_dup_01",
            "snippet": {
                "title": "Idempotent Video",
                "description": "Testing idempotency",
                "channelTitle": "Channel A",
                "channelId": "UC_A_01",
                "publishedAt": "2026-10-01T10:00:00Z"
            },
            "statistics": {"viewCount": "100", "likeCount": "10", "commentCount": "1"}
        }]
    }
    comments_resp = {
        "items": [{
            "snippet": {
                "topLevelComment": {
                    "id": "comm_dup_01",
                    "snippet": {
                        "textOriginal": "Duplicate check comment",
                        "authorChannelId": {"value": "UC_USER_01"},
                        "publishedAt": "2026-10-01T10:05:00Z",
                        "likeCount": 2
                    }
                }
            }
        }]
    }

    def mock_urlopen(req, timeout=12):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        if "search" in url:
            return create_mock_response(search_resp)
        elif "videos" in url:
            return create_mock_response(videos_resp)
        elif "commentThreads" in url:
            return create_mock_response(comments_resp)
        return create_mock_response({})

    with patch("urllib.request.urlopen", side_effect=mock_urlopen), \
         patch("app.collectors.youtube_ingestor.YOUTUBE_QUERIES", ["test_query"]):
        # Run 1
        res1 = ingest_youtube_videos(target_db=test_db)
        total_1 = test_db["raw_posts"].count_documents({"platform": "youtube"})
        assert total_1 == 2  # 1 video + 1 comment

        # Run 2 (re-ingest)
        res2 = ingest_youtube_videos(target_db=test_db)
        total_2 = test_db["raw_posts"].count_documents({"platform": "youtube"})
        assert total_2 == 2, f"Expected 2 documents after duplicate ingest, found {total_2}"
    print("[PASS] test_duplicate_ingest_not_creating_duplicates")

def test_reply_parent_and_author_mapping():
    """Verify hierarchical reply_to_author and parent_id mapping for video, comment, and reply."""
    mock_client = mongomock.MongoClient()
    test_db = mock_client["social_intel"]

    search_resp = {"items": [{"id": {"videoId": "vid_hier_01"}}]}
    videos_resp = {
        "items": [{
            "id": "vid_hier_01",
            "snippet": {
                "title": "Hierarchy Test Video",
                "description": "Hierarchy description",
                "channelTitle": "Creator Channel",
                "channelId": "UC_CREATOR_99",
                "publishedAt": "2026-10-02T08:00:00Z"
            },
            "statistics": {"viewCount": "1000", "likeCount": "50", "commentCount": "2"}
        }]
    }
    comments_resp = {
        "items": [{
            "snippet": {
                "topLevelComment": {
                    "id": "top_comm_001",
                    "snippet": {
                        "textOriginal": "Top level question",
                        "authorChannelId": {"value": "UC_QUESTIONER_1"},
                        "publishedAt": "2026-10-02T08:15:00Z",
                        "likeCount": 5
                    }
                }
            },
            "replies": {
                "comments": [{
                    "id": "rep_comm_002",
                    "snippet": {
                        "textOriginal": "Replying answer",
                        "authorChannelId": {"value": "UC_ANSWERER_2"},
                        "publishedAt": "2026-10-02T08:30:00Z",
                        "likeCount": 1
                    }
                }]
            }
        }]
    }

    def mock_urlopen(req, timeout=12):
        url = req.full_url if hasattr(req, "full_url") else str(req)
        if "search" in url:
            return create_mock_response(search_resp)
        elif "videos" in url:
            return create_mock_response(videos_resp)
        elif "commentThreads" in url:
            return create_mock_response(comments_resp)
        return create_mock_response({})

    with patch("urllib.request.urlopen", side_effect=mock_urlopen), \
         patch("app.collectors.youtube_ingestor.YOUTUBE_QUERIES", ["test_query"]):
        res = ingest_youtube_videos(target_db=test_db)
        assert res["videos_count"] == 1
        assert res["comments_count"] == 2

        video_doc = test_db["raw_posts"].find_one({"post_id": "vid_hier_01"})
        top_comm_doc = test_db["raw_posts"].find_one({"post_id": "top_comm_001"})
        reply_doc = test_db["raw_posts"].find_one({"post_id": "rep_comm_002"})

        # 1. Video checks
        assert video_doc["author_id"] == hid("UC_CREATOR_99")
        assert video_doc["parent_id"] is None
        assert video_doc["reply_to_author"] is None

        # 2. Top-level comment checks
        assert top_comm_doc["author_id"] == hid("UC_QUESTIONER_1")
        assert top_comm_doc["parent_id"] == "vid_hier_01"
        assert top_comm_doc["reply_to_author"] == hid("UC_CREATOR_99")  # Targets video author

        # 3. Reply checks
        assert reply_doc["author_id"] == hid("UC_ANSWERER_2")
        assert reply_doc["parent_id"] == "top_comm_001"  # Targets parent comment
        assert reply_doc["reply_to_author"] == hid("UC_QUESTIONER_1")  # Targets top-level comment author

        # Privacy verification: raw channel IDs must NOT be present in author fields
        for doc in [video_doc, top_comm_doc, reply_doc]:
            assert not doc["author_id"].startswith("UC_")
            assert len(doc["author_id"]) == 16  # SHA-256 trimmed to 16 hex
    print("[PASS] test_reply_parent_and_author_mapping")

if __name__ == "__main__":
    print("Running YouTube Collector Unit Tests...")
    test_video_first_retention_when_comments_disabled()
    test_quota_exceeded_handling()
    test_duplicate_ingest_not_creating_duplicates()
    test_reply_parent_and_author_mapping()
    print("All YouTube tests passed successfully! [OK]")
