import os
import sys
import time
import json
import hashlib
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

from app.schema import empty_metrics
from app.watchlist import ensure_seed
from app.connectors import set_connector_status
from app.core.live_events import publish_documents
from app.core.env_utils import get_clean_env, is_source_enabled

# Path resolution for .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE)

MONGO_URI = get_clean_env("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = get_clean_env("DB_NAME", "social_intel")
COLLECTION_NAME = get_clean_env("COLLECTION_NAME", "raw_posts")

YOUTUBE_API_KEY = get_clean_env("YOUTUBE_API_KEY", "")
YOUTUBE_QUERIES = [q.strip() for q in get_clean_env("YOUTUBE_QUERIES", "cybersecurity India,technology India,AI India").split(",") if q.strip()]
YOUTUBE_CHANNEL_IDS = [c.strip() for c in get_clean_env("YOUTUBE_CHANNEL_IDS", "").split(",") if c.strip()]
YOUTUBE_DAILY_QUOTA_BUDGET = int(get_clean_env("YOUTUBE_DAILY_QUOTA_BUDGET", "8000"))
YOUTUBE_MAX_COMMENT_PAGES = int(get_clean_env("YOUTUBE_MAX_COMMENT_PAGES", "2"))
_INITIAL_YOUTUBE_QUERIES = tuple(YOUTUBE_QUERIES)


def get_db():
    return MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)[DB_NAME]


def hid(x):
    """Securely hash YouTube channel/user IDs to preserve privacy (PII-free)."""
    if not x:
        return None
    return hashlib.sha256(str(x).encode()).hexdigest()[:16]


def get_next_pacific_midnight_utc() -> str:
    """Computes the next midnight Pacific time in UTC ISO-8601 string."""
    now_pt = datetime.now(ZoneInfo("America/Los_Angeles"))
    next_midnight_pt = (now_pt + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return next_midnight_pt.astimezone(timezone.utc).isoformat()


class QuotaExceededException(Exception):
    pass


class InvalidKeyException(Exception):
    pass


class YouTubeQuotaManager:
    """Manages and enforces daily YouTube Data API v3 quota usage resetting at midnight Pacific Time."""
    def __init__(self, db, budget=YOUTUBE_DAILY_QUOTA_BUDGET):
        self.db = db
        self.state_coll = db["collector_state"]
        self.budget = budget

    def get_today_pt(self) -> str:
        return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")

    def get_quota_used_today(self) -> int:
        today_pt = self.get_today_pt()
        try:
            doc = self.state_coll.find_one({"_id": "youtube_quota"})
            if not doc or doc.get("date_pt") != today_pt:
                return 0
            return int(doc.get("units_used", 0))
        except Exception as e:
            print(f"[!] Warning reading quota state: {e}")
            return 0

    def can_consume(self, cost: int) -> bool:
        used = self.get_quota_used_today()
        if (used + cost) > self.budget:
            print(f"[!] YouTube quota budget would be exceeded ({used} + {cost} > {self.budget} units). Skipping API call.")
            return False
        return True

    def record_consumption(self, cost: int):
        today_pt = self.get_today_pt()
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            doc = self.state_coll.find_one({"_id": "youtube_quota"})
            if not doc or doc.get("date_pt") != today_pt:
                self.state_coll.update_one(
                    {"_id": "youtube_quota"},
                    {"$set": {"date_pt": today_pt, "units_used": cost, "last_updated": now_iso}},
                    upsert=True
                )
            else:
                self.state_coll.update_one(
                    {"_id": "youtube_quota"},
                    {"$inc": {"units_used": cost}, "$set": {"last_updated": now_iso}},
                    upsert=True
                )
        except Exception as e:
            print(f"[!] Warning recording quota consumption: {e}")


def should_fetch_comments(state_coll, video_id: str, published_at_iso: str) -> bool:
    """Caches video IDs so comments are not refetched repeatedly unless video is <24h old and unfetched in 6h."""
    try:
        doc = state_coll.find_one({"_id": f"yt_video_{video_id}"})
        now = datetime.now(timezone.utc)
        if not doc:
            return True

        last_fetched_str = doc.get("last_comments_fetched_at")
        if not last_fetched_str:
            return True

        try:
            published_dt = datetime.fromisoformat(published_at_iso.replace("Z", "+00:00"))
            last_fetched_dt = datetime.fromisoformat(last_fetched_str.replace("Z", "+00:00"))
        except Exception:
            return False

        age_hours = (now - published_dt).total_seconds() / 3600.0
        since_last_fetch = (now - last_fetched_dt).total_seconds() / 3600.0

        # For fresh videos (<24h), refresh comments at most once every 6 hours
        if age_hours <= 24.0 and since_last_fetch >= 6.0:
            return True

        return False
    except Exception:
        return True


def mark_comments_fetched(state_coll, video_id: str, published_at_iso: str):
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        state_coll.update_one(
            {"_id": f"yt_video_{video_id}"},
            {"$set": {
                "video_id": video_id,
                "published_at": published_at_iso,
                "last_comments_fetched_at": now_iso
            }},
            upsert=True
        )
    except Exception as e:
        print(f"[!] Warning updating video cache: {e}")


def api_get(endpoint: str, params: dict, quota_mgr: YouTubeQuotaManager, cost: int, api_key: str | None = None) -> dict:
    """Executes a GET request against the YouTube Data API v3 while tracking quota and catching errors."""
    if not quota_mgr.can_consume(cost):
        raise QuotaExceededException("Daily quota budget reached.")

    active_key = api_key or get_clean_env("YOUTUBE_API_KEY", "")
    p = params.copy()
    p["key"] = active_key
    query_str = urllib.parse.urlencode(p)
    url = f"https://www.googleapis.com/youtube/v3/{endpoint}?{query_str}"

    req = urllib.request.Request(url, headers={"User-Agent": "NETRA-YouTube-Ingestor/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
            quota_mgr.record_consumption(cost)
            return data
    except urllib.error.HTTPError as e:
        status_code = e.code
        err_msg = ""
        reason = ""
        try:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body)
            errors_list = err_json.get("error", {}).get("errors", [])
            if errors_list:
                reason = errors_list[0].get("reason", "")
            err_msg = err_json.get("error", {}).get("message", "")
        except Exception:
            err_msg = str(e)

        if status_code == 403 and (reason == "quotaExceeded" or "quota" in err_msg.lower()):
            print("[!] YouTube Quota Exceeded (403). Halting run cleanly.")
            raise QuotaExceededException("YouTube daily quota limit reached.")
        elif status_code in (400, 403) and (reason in ("keyInvalid", "forbidden", "accessNotConfigured", "ipRefererBlocked") or "key" in err_msg.lower() or "not enabled" in err_msg.lower()):
            if reason != "commentsDisabled" and "disabled" not in err_msg.lower():
                print(f"[!] YouTube Key Invalid or API disabled (HTTP {status_code}): {reason}")
                raise InvalidKeyException(f"YouTube API key invalid: {reason}")

        if status_code == 403 and (reason in ("commentsDisabled", "forbidden") or "disabled" in err_msg.lower()):
            # Signal comments disabled to caller
            raise PermissionError("commentsDisabled")
        else:
            print(f"[!] YouTube API HTTP Error {status_code} ({reason}): {err_msg}")
            raise e
    except (urllib.error.URLError, TimeoutError) as e:
        print(f"[!] YouTube network error: {e}")
        raise ConnectionError(f"Network error: {e}")
    except Exception as e:
        print(f"[!] YouTube request error: {e}")
        raise e


def ingest_youtube_videos(target_db=None) -> dict:
    """
    Video-first live YouTube collection within daily quota budget.
    Fetches videos for configured queries, then paginates commentThreads and replies.
    Returns: dict with {count, status, quota_used, api_calls, videos_count, comments_count}
    """
    if not is_source_enabled("youtube"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "quota_used": 0, "api_calls": 0, "videos_count": 0, "comments_count": 0}

    api_key = get_clean_env("YOUTUBE_API_KEY", "")
    db = target_db if target_db is not None else get_db()

    if not api_key:
        print("[!] YOUTUBE_API_KEY is missing in .env. Skipping real YouTube ingestion.")
        set_connector_status(db, "youtube", "CREDENTIALS_REQUIRED", mode="LIVE", reason="key_missing", message="YOUTUBE_API_KEY is missing.")
        return {"count": 0, "status": "CREDENTIALS_REQUIRED", "reason": "key_missing", "quota_used": 0, "api_calls": 0, "videos_count": 0, "comments_count": 0}

    ensure_seed(db)
    collection = db[COLLECTION_NAME]
    state_coll = db["collector_state"]
    quota_budget = int(get_clean_env("YOUTUBE_DAILY_QUOTA_BUDGET", "8000"))
    quota_mgr = YouTubeQuotaManager(db, budget=quota_budget)

    initial_quota = quota_mgr.get_quota_used_today()
    total_videos = 0
    total_comments = 0
    total_replies = 0
    api_calls = 0
    run_status = "success"
    error_reason = None
    resume_time = None

    if not quota_mgr.can_consume(100):
        run_status = "NO_CREDITS"
        error_reason = "daily_quota_reached"
        resume_time = get_next_pacific_midnight_utc()
        set_connector_status(
            db, "youtube", "NO_CREDITS", mode="LIVE",
            reason="daily_quota_reached",
            message="YouTube daily quota reached.",
            resume_at=resume_time,
            next_reset_at=resume_time
        )
        return {
            "count": 0,
            "videos_count": 0,
            "comments_count": 0,
            "quota_used": 0,
            "quota_used_today": initial_quota,
            "api_calls": 0,
            "status": "NO_CREDITS",
            "reason": "daily_quota_reached",
            "resume_at": resume_time
        }

    # Get last successful run timestamp to fetch recent content
    last_state = state_coll.find_one({"_id": "youtube_collector"}) or {}
    last_run_iso = last_state.get("last_success_at")

    if not last_run_iso:
        last_run_iso = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Read the operational config per run, allowing a supervisor to update its
    # environment without a code change.  The module-level override remains
    # useful for deterministic unit tests.
    env_queries = [q.strip() for q in get_clean_env("YOUTUBE_QUERIES", "cybersecurity India,technology India,AI India").split(",") if q.strip()]
    queries = list(YOUTUBE_QUERIES) if tuple(YOUTUBE_QUERIES) != _INITIAL_YOUTUBE_QUERIES else env_queries
    channels = [c.strip() for c in get_clean_env("YOUTUBE_CHANNEL_IDS", "").split(",") if c.strip()]

    print(f"[*] Starting Real YouTube Ingestion (Queries: {len(queries)}, Channels: {len(channels)}, Budget: {quota_mgr.budget} units)...")

    # The environment is the operational source of truth.  Watchlists are a UI
    # concern and must not silently replace the configured production queries.
    # Deduplication avoids spending another 100-unit search on repeated values.
    search_targets = []
    seen_queries = set()
    for query in queries:
        key = query.casefold()
        if key not in seen_queries:
            search_targets.append({"type": "query", "val": query, "topic_id": "youtube-env"})
            seen_queries.add(key)
    for cid in channels:
        search_targets.append({"type": "channel", "val": cid, "topic_id": None})

    try:
        for target in search_targets:
            if not quota_mgr.can_consume(100):
                run_status = "NO_CREDITS"
                error_reason = "daily_quota_reached"
                resume_time = get_next_pacific_midnight_utc()
                break

            search_params = {
                "part": "snippet",
                "type": "video",
                "order": "date",
                "maxResults": 10,
                "publishedAfter": last_run_iso
            }
            if target["type"] == "query":
                search_params["q"] = target["val"]
                topic_label = target["val"]
            else:
                search_params["channelId"] = target["val"]
                topic_label = "Channel Feed"

            try:
                search_data = api_get("search", search_params, quota_mgr, cost=100, api_key=api_key)
                api_calls += 1
            except QuotaExceededException:
                run_status = "NO_CREDITS"
                error_reason = "daily_quota_reached"
                resume_time = get_next_pacific_midnight_utc()
                break
            except InvalidKeyException:
                run_status = "CREDENTIALS_REQUIRED"
                error_reason = "key_invalid"
                break
            except ConnectionError as e:
                run_status = "DEGRADED"
                error_reason = "network_error"
                print(f"[!] Network error during search.list for '{target['val']}': {e}")
                break
            except Exception as e:
                print(f"[!] Error in search.list for '{target['val']}': {e}")
                continue

            items = search_data.get("items", [])
            video_ids = [item["id"]["videoId"] for item in items if "videoId" in item.get("id", {})]
            if not video_ids:
                continue

            # Fetch video statistics via videos.list (cost: 1 unit)
            if not quota_mgr.can_consume(1):
                run_status = "NO_CREDITS"
                error_reason = "daily_quota_reached"
                resume_time = get_next_pacific_midnight_utc()
                break

            ids_str = ",".join(video_ids)
            try:
                details_data = api_get("videos", {
                    "part": "snippet,statistics,contentDetails",
                    "id": ids_str
                }, quota_mgr, cost=1, api_key=api_key)
                api_calls += 1
            except QuotaExceededException:
                run_status = "NO_CREDITS"
                error_reason = "daily_quota_reached"
                resume_time = get_next_pacific_midnight_utc()
                break
            except InvalidKeyException:
                run_status = "CREDENTIALS_REQUIRED"
                error_reason = "key_invalid"
                break
            except ConnectionError as e:
                run_status = "DEGRADED"
                error_reason = "network_error"
                break
            except Exception as e:
                print(f"[!] Error fetching videos.list: {e}")
                details_data = {}

            video_items = details_data.get("items", [])
            video_map = {v["id"]: v for v in video_items}

            # Process each video (Video-First retention)
            for vid in video_ids:
                v_obj = video_map.get(vid)
                snippet = v_obj.get("snippet", {}) if v_obj else {}
                stats = v_obj.get("statistics", {}) if v_obj else {}

                title = snippet.get("title", "")
                description = snippet.get("description", "")
                channel_id = snippet.get("channelId", "")
                published_at = snippet.get("publishedAt") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

                view_count = int(stats.get("viewCount", 0)) if stats.get("viewCount") else 0
                like_count = int(stats.get("likeCount", 0)) if stats.get("likeCount") else 0
                comment_count = int(stats.get("commentCount", 0)) if stats.get("commentCount") else 0

                canonical_id = f"youtube:{vid}"
                # Never persist display names, handles, avatars, or raw channel IDs.
                video_author_id = hid(channel_id)

                # Strictly preserve privacy: No raw author/channel names or avatars
                video_doc = {
                    "canonical_id": canonical_id,
                    "post_id": vid,
                    "native_id": vid,
                    "platform": "youtube",
                    "topic_id": target.get("topic_id"),
                    "event_type": "video",
                    "parent_id": None,
                    "reply_to_author": None,
                    "forwarded_from": None,
                    "author_id": video_author_id,
                    "text": f"{title}\n{description}".strip(),
                    "text_content": f"{title} | {description[:400]}",
                    "created_at": published_at,
                    "published_at": published_at,
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                    "lang": snippet.get("defaultLanguage") or snippet.get("defaultAudioLanguage") or None,
                    "hashtags": [],
                    "mentions": [],
                    "urls": [],
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "permalink": f"https://www.youtube.com/watch?v={vid}",
                    "metrics": empty_metrics(likes=like_count, replies=comment_count, views=view_count),
                    "metadata": {
                        "source_mode": "LIVE",
                        "event_type": "video",
                        "title": title,
                        "channel_id_hash": video_author_id,
                        "topic": topic_label
                    },
                    "source_mode": "LIVE",
                    "dataset": None,
                    "source_file": None,
                    "processed": False
                }

                collection.update_one(
                    {"platform": "youtube", "post_id": vid},
                    {"$set": video_doc},
                    upsert=True
                )
                publish_documents([video_doc])
                total_videos += 1

                # Check if we should fetch comments for this video
                if not should_fetch_comments(state_coll, vid, published_at):
                    continue

                # Fetch comments and replies
                next_page_token = None
                pages_fetched = 0
                comment_ops = []
                max_comment_pages = int(get_clean_env("YOUTUBE_MAX_COMMENT_PAGES", "2"))

                while pages_fetched < max_comment_pages:
                    if not quota_mgr.can_consume(1):
                        run_status = "NO_CREDITS"
                        error_reason = "daily_quota_reached"
                        resume_time = get_next_pacific_midnight_utc()
                        break

                    ct_params = {
                        "part": "snippet,replies",
                        "videoId": vid,
                        "order": "time",
                        "maxResults": 100
                    }
                    if next_page_token:
                        ct_params["pageToken"] = next_page_token

                    try:
                        ct_data = api_get("commentThreads", ct_params, quota_mgr, cost=1, api_key=api_key)
                        api_calls += 1
                    except QuotaExceededException:
                        run_status = "NO_CREDITS"
                        error_reason = "daily_quota_reached"
                        resume_time = get_next_pacific_midnight_utc()
                        break
                    except InvalidKeyException:
                        run_status = "CREDENTIALS_REQUIRED"
                        error_reason = "key_invalid"
                        break
                    except PermissionError:
                        # Comments disabled: skipped quietly
                        break
                    except ConnectionError:
                        run_status = "DEGRADED"
                        error_reason = "network_error"
                        break
                    except Exception as e:
                        print(f"  [!] Error fetching comments for '{vid}': {e}")
                        break

                    ct_items = ct_data.get("items", [])
                    if not ct_items:
                        break

                    for ct in ct_items:
                        # Top-level comment
                        top_comment = ct.get("snippet", {}).get("topLevelComment", {})
                        cid = top_comment.get("id")
                        c_snippet = top_comment.get("snippet", {})
                        c_text = c_snippet.get("textOriginal") or c_snippet.get("textDisplay", "")
                        c_published = c_snippet.get("publishedAt") or published_at
                        c_author_ch_id = (c_snippet.get("authorChannelId", {}) or {}).get("value")
                        c_likes = int(c_snippet.get("likeCount", 0))

                        top_comment_author_hash = hid(c_author_ch_id) if c_author_ch_id else hid(c_snippet.get("authorDisplayName", "anon"))

                        if cid:
                            comment_doc = {
                                "canonical_id": f"youtube:comment:{cid}",
                                "post_id": cid,
                                "native_id": cid,
                                "platform": "youtube",
                                "topic_id": target.get("topic_id"),
                                "event_type": "comment",
                                "parent_id": vid,
                                "reply_to_author": video_author_id,  # Points to video author
                                "forwarded_from": None,
                                "author_id": top_comment_author_hash,
                                "text": c_text,
                                "text_content": c_text,
                                "created_at": c_published,
                                "published_at": c_published,
                                "collected_at": datetime.now(timezone.utc).isoformat(),
                                "ingested_at": datetime.now(timezone.utc).isoformat(),
                                "lang": None,
                                "hashtags": [],
                                "mentions": [],
                                "urls": [],
                                "url": f"https://www.youtube.com/watch?v={vid}&lc={cid}",
                                "permalink": f"https://www.youtube.com/watch?v={vid}&lc={cid}",
                                "metrics": empty_metrics(likes=c_likes),
                                "metadata": {
                                    "source_mode": "LIVE",
                                    "event_type": "comment",
                                    "parent_post_id": vid
                                },
                                "source_mode": "LIVE",
                                "dataset": None,
                                "source_file": None,
                                "processed": False
                            }
                            comment_ops.append(
                                UpdateOne({"platform": "youtube", "post_id": cid}, {"$set": comment_doc}, upsert=True)
                            )
                            total_comments += 1

                        # Nested replies
                        replies_list = ct.get("replies", {}).get("comments", [])
                        for rep in replies_list:
                            rid = rep.get("id")
                            r_snippet = rep.get("snippet", {})
                            r_text = r_snippet.get("textOriginal") or r_snippet.get("textDisplay", "")
                            r_published = r_snippet.get("publishedAt") or published_at
                            r_author_ch_id = (r_snippet.get("authorChannelId", {}) or {}).get("value")
                            r_likes = int(r_snippet.get("likeCount", 0))

                            reply_author_hash = hid(r_author_ch_id) if r_author_ch_id else hid(r_snippet.get("authorDisplayName", "anon"))

                            if rid:
                                reply_doc = {
                                    "canonical_id": f"youtube:comment:{rid}",
                                    "post_id": rid,
                                    "native_id": rid,
                                    "platform": "youtube",
                                    "topic_id": target.get("topic_id"),
                                    "event_type": "reply",
                                    "parent_id": cid,  # Points to top-level comment
                                    "reply_to_author": top_comment_author_hash,  # Points to top comment author
                                    "forwarded_from": None,
                                    "author_id": reply_author_hash,
                                    "text": r_text,
                                    "text_content": r_text,
                                    "created_at": r_published,
                                    "published_at": r_published,
                                    "collected_at": datetime.now(timezone.utc).isoformat(),
                                    "ingested_at": datetime.now(timezone.utc).isoformat(),
                                    "lang": None,
                                    "hashtags": [],
                                    "mentions": [],
                                    "urls": [],
                                    "url": f"https://www.youtube.com/watch?v={vid}&lc={rid}",
                                    "permalink": f"https://www.youtube.com/watch?v={vid}&lc={rid}",
                                    "metrics": empty_metrics(likes=r_likes),
                                    "metadata": {
                                        "source_mode": "LIVE",
                                        "event_type": "reply",
                                        "parent_post_id": cid
                                    },
                                    "source_mode": "LIVE",
                                    "dataset": None,
                                    "source_file": None,
                                    "processed": False
                                }
                                comment_ops.append(
                                    UpdateOne({"platform": "youtube", "post_id": rid}, {"$set": reply_doc}, upsert=True)
                                )
                                total_replies += 1

                    pages_fetched += 1
                    next_page_token = ct_data.get("nextPageToken")
                    if not next_page_token:
                        break

                if comment_ops:
                    try:
                        collection.bulk_write(comment_ops)
                    except TypeError:
                        for op in comment_ops:
                            collection.update_one(op._filter, op._doc, upsert=op._upsert)

                mark_comments_fetched(state_coll, vid, published_at)

            if run_status != "success":
                break

    except QuotaExceededException:
        run_status = "NO_CREDITS"
        error_reason = "daily_quota_reached"
        resume_time = get_next_pacific_midnight_utc()
    except InvalidKeyException:
        run_status = "CREDENTIALS_REQUIRED"
        error_reason = "key_invalid"
    except ConnectionError:
        run_status = "DEGRADED"
        error_reason = "network_error"

    # Record state
    if run_status == "success":
        state_coll.update_one(
            {"_id": "youtube_collector"},
            {"$set": {
                "last_success_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "last_videos_count": total_videos,
                "last_comments_count": total_comments,
                "last_replies_count": total_replies
            }},
            upsert=True
        )

    quota_now = quota_mgr.get_quota_used_today()
    quota_used_in_run = max(0, quota_now - initial_quota)
    total_count = total_videos + total_comments + total_replies

    print(f"[+] YouTube Ingestion finished: {total_count} items ({total_videos} videos, {total_comments} comments, {total_replies} replies). Quota used in run: {quota_used_in_run} (Total today: {quota_now}/{quota_mgr.budget}). Status: {run_status}")

    if run_status == "success":
        set_connector_status(db, "youtube", "LIVE", mode="LIVE", success=True, reason="active")
    elif run_status == "NO_CREDITS":
        set_connector_status(
            db, "youtube", "NO_CREDITS", mode="LIVE",
            reason="daily_quota_reached",
            message="YouTube daily quota reached.",
            resume_at=resume_time,
            next_reset_at=resume_time
        )
    elif run_status == "CREDENTIALS_REQUIRED":
        set_connector_status(
            db, "youtube", "CREDENTIALS_REQUIRED", mode="LIVE",
            reason="key_invalid",
            message="YouTube API key invalid or unauthorized."
        )
    elif run_status == "DEGRADED":
        set_connector_status(
            db, "youtube", "DEGRADED", mode="LIVE",
            reason="network_error",
            message="YouTube network connection failed."
        )

    return {
        "count": total_count,
        "videos_count": total_videos,
        "comments_count": total_comments + total_replies,
        "replies_count": total_replies,
        "quota_used": quota_used_in_run,
        "quota_used_today": quota_now,
        "api_calls": api_calls,
        "status": run_status,
        "reason": error_reason,
        "resume_at": resume_time
    }


def main():
    res = ingest_youtube_videos()
    print("Execution result:", res)


if __name__ == "__main__":
    main()
