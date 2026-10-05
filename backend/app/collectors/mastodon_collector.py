"""Read-only public Mastodon hashtag timelines."""
from __future__ import annotations
import hashlib, html, logging, os, re
from datetime import datetime, timezone
import httpx
from pymongo import MongoClient, UpdateOne
from app.schema import empty_metrics
from app.core.live_events import publish_documents
from app.connectors import set_connector_status
from app.core.env_utils import get_clean_env, is_source_enabled
from app.watchlist import topics

logger=logging.getLogger("NETRA.Mastodon")
def hid(value): return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value else None
def now(): return datetime.now(timezone.utc).isoformat()
def clean_html(value): return html.unescape(re.sub(r"<[^>]+>", "", value or "")).strip()
def tags(value): return [str(t.get("name") or "") for t in value or [] if t.get("name")]
def map_status(status: dict, topic_id: str, instance: str) -> dict:
    boost=status.get("reblog") or {}; item=boost or status; account=item.get("account") or {}; text=clean_html(item.get("content"))
    canonical=item.get("url") or f"https://{instance}/statuses/{item.get('id','')}"; event_id=hashlib.sha256(canonical.encode()).hexdigest()[:24]
    return {"platform":"mastodon","post_id":event_id,"canonical_id":f"mastodon:{event_id}","topic_id":topic_id,
            "event_type":"boost" if boost else "reply" if item.get("in_reply_to_id") else "post", "parent_id":item.get("in_reply_to_id"),
            "reply_to_author":hid(item.get("in_reply_to_account_id")),"author_id":hid(account.get("id")),"text":text,"text_content":text,
            "created_at":item.get("created_at"),"collected_at":now(),"ingested_at":now(),"lang":item.get("language"),
            "hashtags":tags(item.get("tags")),"mentions":[hid(m.get("id")) for m in item.get("mentions") or []],"urls":[],"url":None,
            "metrics":empty_metrics(likes=item.get("favourites_count"),replies=item.get("replies_count"),shares=item.get("reblogs_count")),
            "source_mode":"LIVE","dataset":None,"source_file":None,"processed":False}

def _instances():
    values=[value.strip().lower() for value in get_clean_env("MASTODON_INSTANCE", "mastodon.social").split(",") if value.strip()]
    return [value for value in values if re.fullmatch(r"[a-z0-9.-]+",value)]

def ingest_mastodon(target_db=None, client=None) -> dict:
    db=target_db if target_db is not None else MongoClient(get_clean_env("MONGO_URI","mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin"))[get_clean_env("DB_NAME","social_intel")]; own=client is None; client=client or httpx.Client()
    if not is_source_enabled("mastodon") and own:
        set_connector_status(db, "mastodon", "DISABLED", mode="DISABLED", message="Not enabled in this build.", reason="not_enabled_in_this_build")
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    m_token = get_clean_env("MASTODON_TOKEN")
    headers={"Authorization":f"Bearer {m_token}"} if m_token else {}; inserted=[]; calls=0
    try:
        for topic in topics(db):
            for tag in topic["hashtags"][:10]:
                for instance in _instances():
                    state=db.collector_state.find_one({"_id":f"mastodon:{instance}:{tag}"}) or {}; params={"limit":min(40,int(os.getenv("MASTODON_MAX_POSTS","40")))}
                    if state.get("since_id"): params["since_id"]=state["since_id"]
                    response=client.get(f"https://{instance}/api/v1/timelines/tag/{tag}",params=params,headers=headers,timeout=20); calls+=1
                    if response.status_code==429:
                        set_connector_status(db,"mastodon","RATE_LIMITED",mode="LIVE",message="Mastodon rate limited this run; retry is scheduled."); return {"count":len(inserted),"status":"RATE_LIMITED","api_calls":calls}
                    response.raise_for_status(); rows=response.json(); docs=[map_status(row,topic["id"],instance) for row in rows]
                    existing={row["post_id"] for row in db.raw_posts.find({"platform":"mastodon","post_id":{"$in":[d["post_id"] for d in docs]}},{"post_id":1})}
                    if docs:
                        ops=[UpdateOne({"platform":"mastodon","post_id":d["post_id"]},{"$set":d},upsert=True) for d in docs]
                        try: db.raw_posts.bulk_write(ops,ordered=False)
                        except TypeError:
                            for doc in docs: db.raw_posts.update_one({"platform":"mastodon","post_id":doc["post_id"]},{"$set":doc},upsert=True)
                    inserted.extend(d for d in docs if d["post_id"] not in existing)
                    if rows: db.collector_state.update_one({"_id":f"mastodon:{instance}:{tag}"},{"$set":{"since_id":str(rows[0].get("id")),"last_polled_at":now()}},upsert=True)
        publish_documents(inserted); set_connector_status(db,"mastodon","LIVE",mode="LIVE",success=True); return {"count":len(inserted),"status":"LIVE","api_calls":calls}
    except httpx.HTTPError:
        set_connector_status(db,"mastodon","DEGRADED",mode="LIVE",message="Mastodon public timeline failed; retry is scheduled."); return {"count":len(inserted),"status":"DEGRADED","api_calls":calls}
    finally:
        if own: client.close()
