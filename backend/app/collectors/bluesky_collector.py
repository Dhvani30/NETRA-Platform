"""Authenticated, public-topic Bluesky search. Session JWTs are memory-only."""
from __future__ import annotations
import hashlib, logging, os, re
from datetime import datetime, timezone
import httpx
from pymongo import MongoClient, UpdateOne
from app.schema import empty_metrics
from app.core.live_events import publish_documents
from app.connectors import set_connector_status
from app.core.env_utils import get_clean_env, is_source_enabled
from app.watchlist import topics

logger = logging.getLogger("NETRA.Bluesky")
def hid(value): return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value else None
def now(): return datetime.now(timezone.utc).isoformat()
def _iso(value):
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")).astimezone(timezone.utc).isoformat()
    except ValueError: return None
def _hashtags(text): return re.findall(r"(?<!\w)#([\w-]+)", text or "")
def _mentions(text): return re.findall(r"(?<!\w)@([\w.-]+)", text or "")

def map_post(post: dict, topic_id: str) -> dict:
    record = post.get("record") or {}; text = record.get("text") or ""; uri = post.get("uri") or ""
    reply = record.get("reply") or {}; parent = (reply.get("parent") or {}).get("uri")
    author = post.get("author") or {}; reason = post.get("reason") or {}
    post_id=hid(uri)
    return {"platform":"bluesky", "post_id":post_id, "canonical_id":f"bluesky:{post_id}", "topic_id":topic_id,
            "event_type":"repost" if reason.get("$type", "").endswith("reasonRepost") else "quote" if record.get("embed") else "post",
            "parent_id":hid(parent), "reply_to_author":hid((reply.get("parent") or {}).get("cid")), "author_id":hid(author.get("did")),
            "text":text, "text_content":text, "created_at":_iso(record.get("createdAt")), "collected_at":now(), "ingested_at":now(),
            "lang":(post.get("langs") or [None])[0], "hashtags":_hashtags(text), "mentions":_mentions(text), "urls":[],
            "url":None,
            "metrics":empty_metrics(likes=post.get("likeCount"), replies=post.get("replyCount"), shares=post.get("repostCount")),
            "source_mode":"LIVE", "dataset":None, "source_file":None, "processed":False}

def ingest_bluesky(target_db=None, client=None) -> dict:
    db = target_db if target_db is not None else MongoClient(get_clean_env("MONGO_URI","mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin"))[get_clean_env("DB_NAME","social_intel")]
    if not is_source_enabled("bluesky") and client is None:
        set_connector_status(db, "bluesky", "DISABLED", mode="DISABLED", message="Not enabled in this build.", reason="not_enabled_in_this_build")
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    handle=get_clean_env("BLUESKY_HANDLE").lstrip("@")
    password=get_clean_env("BLUESKY_APP_PASSWORD")
    if not handle or not password:
        set_connector_status(db,"bluesky","CREDENTIALS_REQUIRED",mode="LIVE",message="BLUESKY_HANDLE and BLUESKY_APP_PASSWORD are required.")
        return {"count":0,"status":"CREDENTIALS_REQUIRED","reason":"credentials_missing"}
    own = client is None; client = client or httpx.Client(); inserted=[]; calls=0
    try:
        login=client.post("https://bsky.social/xrpc/com.atproto.server.createSession",json={"identifier":handle,"password":password},timeout=20); calls+=1
        if not login.is_success:
            set_connector_status(db,"bluesky","CREDENTIALS_REQUIRED",mode="LIVE",message="Bluesky credentials were rejected.")
            return {"count":0,"status":"CREDENTIALS_REQUIRED","reason":"token_invalid_or_expired","api_calls":calls}
        jwt=(login.json().get("accessJwt") or "")
        for topic in topics(db):
            terms=topic["keywords"] + [f"#{tag}" for tag in topic["hashtags"]]
            for term in terms[:10]:
                response=client.get("https://bsky.social/xrpc/app.bsky.feed.searchPosts",params={"q":term,"limit":min(100,int(os.getenv("BLUESKY_MAX_POSTS","50"))),"sort":"latest"},headers={"Authorization":f"Bearer {jwt}"},timeout=20); calls+=1
                if response.status_code==429:
                    set_connector_status(db,"bluesky","RATE_LIMITED",mode="LIVE",message="Bluesky rate limited this run; retry is scheduled.")
                    return {"count":len(inserted),"status":"RATE_LIMITED","api_calls":calls}
                response.raise_for_status()
                docs=[map_post(post,topic["id"]) for post in response.json().get("posts",[]) if post.get("uri")]
                existing={row["post_id"] for row in db.raw_posts.find({"platform":"bluesky","post_id":{"$in":[d["post_id"] for d in docs]}},{"post_id":1})}
                if docs:
                    ops=[UpdateOne({"platform":"bluesky","post_id":d["post_id"]},{"$set":d},upsert=True) for d in docs]
                    try: db.raw_posts.bulk_write(ops,ordered=False)
                    except TypeError:
                        for doc in docs: db.raw_posts.update_one({"platform":"bluesky","post_id":doc["post_id"]},{"$set":doc},upsert=True)
                inserted.extend(d for d in docs if d["post_id"] not in existing)
        publish_documents(inserted); set_connector_status(db,"bluesky","LIVE",mode="LIVE",success=True)
        return {"count":len(inserted),"status":"LIVE","api_calls":calls}
    except httpx.HTTPError:
        set_connector_status(db,"bluesky","DEGRADED",mode="LIVE",message="Bluesky public search failed; retry is scheduled.")
        return {"count":len(inserted),"status":"DEGRADED","api_calls":calls}
    finally:
        if own: client.close()
