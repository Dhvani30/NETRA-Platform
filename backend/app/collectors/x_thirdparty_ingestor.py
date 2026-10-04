"""Small, capped twitterapi.io sample. This is never represented as official X API data."""
from __future__ import annotations
import hashlib, logging, os, re
from datetime import datetime, timezone
import httpx
from pymongo import MongoClient, UpdateOne
from app.schema import empty_metrics
from app.connectors import set_connector_status
from app.core.live_events import publish_documents
from app.core.env_utils import get_clean_env, is_source_enabled
from app.watchlist import topics

logger=logging.getLogger("NETRA.XThirdParty")
API="https://api.twitterapi.io/twitter/tweet/advanced_search"
def hid(value): return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value not in (None,"") else None
def now(): return datetime.now(timezone.utc).isoformat()
def parse_created_at(value):
    try: return datetime.strptime(value,"%a %b %d %H:%M:%S %z %Y").astimezone(timezone.utc).isoformat()
    except (TypeError,ValueError): return None
def _value(item,*names):
    return next((item.get(name) for name in names if isinstance(item,dict) and item.get(name) is not None),None)
def _list(item,*names): return _value(item,*names) or []
def _bucket(n):
    try: n=int(n or 0)
    except (TypeError,ValueError): return "unknown"
    return "0" if n==0 else "1-99" if n<100 else "100-999" if n<1000 else "1k-9.9k" if n<10000 else "10k+"
def profile_signals(author):
    # Raw bio/location/name/handle never leave this function.
    bio=str(_value(author,"description","profile_bio") or "").lower(); loc=str(author.get("location") or "").lower()
    interests="security" if any(x in bio for x in ("security","cyber","infosec")) else "technology" if any(x in bio for x in ("tech","ai","software")) else "other"
    country="india" if "india" in loc else "us" if any(x in loc for x in ("usa","united states")) else "unknown"
    created=parse_created_at(author.get("createdAt")); years=(datetime.now(timezone.utc)-datetime.fromisoformat(created)).days/365 if created else None
    age="unknown" if years is None else "<1y" if years<1 else "1-5y" if years<5 else "5y+"
    return {"bio_language":"en" if re.search(r"[a-z]",bio) else "unknown","interest_category":interests,"location_country_or_state":country,
            "followers_bucket":_bucket(_value(author,"followers","followersCount")),"following_bucket":_bucket(_value(author,"following","followingCount")),
            "account_age_bucket":age,"is_automated":bool(author.get("isAutomated")),"is_verified":bool(author.get("isVerified"))}
def _entities(tweet):
    entities=tweet.get("entities") or {}; hashtags=[str(_value(item,"text","tag","name") or "").lower().lstrip("#") for item in _list(entities,"hashtags","hashTags")]
    urls=[_value(item,"expanded_url","expandedUrl","url") if isinstance(item,dict) else str(item) for item in _list(entities,"urls","url")]
    mentions=[hid(_value(item,"id","user_id","userId")) for item in _list(entities,"user_mentions","userMentions","mentions") if isinstance(item,dict)]
    return [x for x in hashtags if x],[x for x in urls if x],[x for x in mentions if x]
def map_tweet(tweet,topic_id):
    author=tweet.get("author") or {}; hashes,urls,mentions=_entities(tweet); retweet=tweet.get("retweeted_tweet") or tweet.get("retweetedTweet"); quote=tweet.get("quoted_tweet") or tweet.get("quotedTweet")
    event="repost" if retweet else "quote" if quote else "reply" if tweet.get("isReply") else "post"; tid=str(tweet.get("id") or "")
    retweet_author=retweet.get("author") if isinstance(retweet,dict) else {}
    repost_author_id=hid(_value(retweet_author,"id","userId","user_id")) if isinstance(retweet_author,dict) else None
    return {"platform":"x","post_id":tid,"canonical_id":f"x:twitterapi:{tid}","topic_id":topic_id,"event_type":event,"parent_id":str(tweet.get("inReplyToId")) if tweet.get("inReplyToId") else None,
            "reply_to_author":hid(tweet.get("inReplyToUserId")),"conversation_id":str(tweet.get("conversationId")) if tweet.get("conversationId") else None,"author_id":hid(author.get("id")),
            "text":str(tweet.get("text") or ""),"text_content":str(tweet.get("text") or ""),"created_at":parse_created_at(tweet.get("createdAt")),"collected_at":now(),"ingested_at":now(),"lang":tweet.get("lang"),"hashtags":hashes,"mentions":mentions,"urls":urls,"url":f"https://x.com/i/web/status/{tid}" if tid else None,
            "repost_of":str(_value(retweet or {},"id")) if retweet else None,"repost_of_author":repost_author_id,"quote_of":str(_value(quote or {},"id")) if quote else None,
            "metrics":empty_metrics(likes=_value(tweet,"likeCount","like_count","likes"),shares=_value(tweet,"retweetCount","retweet_count","retweets"),replies=_value(tweet,"replyCount","reply_count","replies"),views=_value(tweet,"viewCount","view_count","views")),
            "profile_signals":profile_signals(author),"source_mode":"LIVE_THIRD_PARTY","provider":"twitterapi.io","dataset":None,"source_file":None,"processed":False}
def _budget(db):
    key="x_thirdparty_budget"; day=datetime.now(timezone.utc).date().isoformat(); doc=db.collector_state.find_one({"_id":key}) or {}
    return (int(doc.get("used",0)) if doc.get("day")==day else 0),day,key
def ingest_x_thirdparty(target_db=None,client=None):
    db=target_db if target_db is not None else MongoClient(get_clean_env("MONGO_URI","mongodb://localhost:27017"))[get_clean_env("DB_NAME","social_intel")]; key=get_clean_env("TWITTERAPI_IO_KEY")
    if not is_source_enabled("x") and client is None:
        set_connector_status(db, "x", "DISABLED", mode="DISABLED", message="Not enabled in this build.", reason="not_enabled_in_this_build")
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    if not key:
        set_connector_status(db,"x","DISABLED",mode="LIVE_THIRD_PARTY",message="TWITTERAPI_IO_KEY is not configured; imported datasets remain available.",reason="credentials_missing"); return {"count":0,"status":"DISABLED","reason":"credentials_missing"}
    max_tweets=max(1,int(get_clean_env("X_TP_MAX_TWEETS_PER_RUN","50"))); max_pages=max(1,int(get_clean_env("X_TP_MAX_PAGES","2"))); daily=max(1,int(get_clean_env("X_TP_DAILY_TWEET_BUDGET","300"))); used,day,state_key=_budget(db)
    if used>=daily: set_connector_status(db,"x","NO_CREDITS",mode="LIVE_THIRD_PARTY",message="Third-party X daily sample budget reached."); return {"count":0,"status":"NO_CREDITS","budget_used":used,"budget_limit":daily}
    own=client is None; client=client or httpx.Client(); inserted=[]; calls=0
    try:
        topic_list=topics(db)
        if not topic_list:
            fallback_q=[v.strip() for v in os.getenv("X_QUERIES","").split(",") if v.strip()] or ["cybersecurity India"]
            topic_list=[{"id":"x_default","keywords":fallback_q}]
        for topic in topic_list:
            for query in (topic.get("keywords") or [value for value in os.getenv("X_QUERIES","").split(",") if value])[:10]:
                cursor=None
                for _ in range(max_pages):
                    remaining=min(max_tweets-len(inserted),daily-used-len(inserted))
                    if remaining<=0: break
                    params={"query":query,"queryType":"Latest","cursor":cursor,"limit":min(20,remaining)}; params={k:v for k,v in params.items() if v}
                    response=client.get(API,headers={"X-API-Key":key},params=params,timeout=25); calls+=1
                    if response.status_code in {402,429}:
                        used += len(inserted); db.collector_state.update_one({"_id":state_key},{"$set":{"day":day,"used":used,"limit":daily,"updated_at":now()}},upsert=True); publish_documents(inserted)
                        if response.status_code==429: set_connector_status(db,"x","RATE_LIMITED",mode="LIVE_THIRD_PARTY",message="twitterapi.io rate limited this run."); return {"count":len(inserted),"status":"RATE_LIMITED","api_calls":calls,"budget_used":used,"budget_limit":daily,"estimated_cost_usd":round(len(inserted)*.00015,6)}
                        set_connector_status(db,"x","NO_CREDITS",mode="LIVE_THIRD_PARTY",message="twitterapi.io credits are unavailable."); return {"count":len(inserted),"status":"NO_CREDITS","api_calls":calls,"budget_used":used,"budget_limit":daily,"estimated_cost_usd":round(len(inserted)*.00015,6)}
                    response.raise_for_status(); body=response.json(); docs=[map_tweet(tweet,topic["id"]) for tweet in body.get("tweets",[]) if tweet.get("id")][:remaining]
                    existing={d["post_id"] for d in db.raw_posts.find({"platform":"x","post_id":{"$in":[x["post_id"] for x in docs]}},{"post_id":1})}
                    if docs:
                        ops=[UpdateOne({"platform":"x","post_id":d["post_id"]},{"$set":d},upsert=True) for d in docs]
                        try: db.raw_posts.bulk_write(ops,ordered=False)
                        except TypeError:
                            for doc in docs: db.raw_posts.update_one({"platform":"x","post_id":doc["post_id"]},{"$set":doc},upsert=True)
                    new_docs=[d for d in docs if d["post_id"] not in existing]
                    if new_docs:
                        try:
                            from app.graph_builder import build_user_edges
                            build_user_edges(db,docs=new_docs)
                        except Exception as ge:
                            logger.debug(f"Edge builder notice: {ge}")
                    inserted.extend(new_docs); cursor=body.get("next_cursor") or body.get("nextCursor")
                    if not body.get("has_next_page") or not cursor or len(inserted)>=max_tweets: break
        used+=len(inserted); db.collector_state.update_one({"_id":state_key},{"$set":{"day":day,"used":used,"limit":daily,"updated_at":now()}},upsert=True); publish_documents(inserted); set_connector_status(db,"x","LIVE",mode="LIVE_THIRD_PARTY",success=True)
        return {"count":len(inserted),"status":"LIVE","api_calls":calls,"budget_used":used,"budget_limit":daily,"estimated_cost_usd":round(len(inserted)*.00015,6)}
    except httpx.HTTPError:
        set_connector_status(db,"x","DEGRADED",mode="LIVE_THIRD_PARTY",message="twitterapi.io request failed; retry is scheduled."); return {"count":len(inserted),"status":"DEGRADED","api_calls":calls}
    finally:
        if own: client.close()
