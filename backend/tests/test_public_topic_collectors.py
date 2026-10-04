import os, sys
from pathlib import Path
import mongomock
import pytest

BACKEND = Path(__file__).resolve().parent.parent
if str(BACKEND) not in sys.path: sys.path.insert(0, str(BACKEND))
from app.watchlist import validate_topic, ensure_seed, topics
from app.collectors import bluesky_collector, mastodon_collector, telegram_public_collector

class Response:
    def __init__(self, body, code=200): self.body,self.status_code=body,code; self.is_success=code < 400
    def json(self): return self.body
    def raise_for_status(self):
        if not self.is_success: raise bluesky_collector.httpx.HTTPStatusError("error",request=None,response=self)
class Client:
    def __init__(self, responses): self.responses=iter(responses)
    def post(self,*a,**k): return next(self.responses)
    def get(self,*a,**k): return next(self.responses)
    def close(self): pass

def topic(): return {"id":"cybersecurity-india","name":"Cybersecurity India","keywords":["cybersecurity India"],"hashtags":["cybersecurity"],"languages":["en"],"subreddits":[],"telegram_channels":[],"youtube_queries":["cybersecurity India"],"enabled":True}

def test_watchlist_validation_and_seed(monkeypatch):
    db=mongomock.MongoClient()["social_intel"]; ensure_seed(db,["extra"])
    assert topics(db)
    with pytest.raises(ValueError): validate_topic({"name":"x","keywords":[str(i) for i in range(11)]})

def test_bluesky_mapping_credentials_and_rate_limit(monkeypatch):
    db=mongomock.MongoClient()["social_intel"]; db.watchlist.insert_one(topic())
    monkeypatch.setenv("BLUESKY_HANDLE","handle"); monkeypatch.setenv("BLUESKY_APP_PASSWORD","password")
    post={"uri":"at://did:plc:test/app.bsky.feed.post/1","record":{"text":"#cybersecurity evidence","createdAt":"2026-10-04T00:00:00Z"},"author":{"did":"did:plc:author"},"likeCount":1,"replyCount":2,"repostCount":3,"langs":["en"]}
    result=bluesky_collector.ingest_bluesky(db,Client([Response({"accessJwt":"secret"}),Response({"posts":[post]}),Response({"posts":[]})]))
    doc=db.raw_posts.find_one({"platform":"bluesky"}); assert result["count"]==1 and doc["author_id"] != "did:plc:author" and doc["topic_id"]=="cybersecurity-india"
    limited=bluesky_collector.ingest_bluesky(db,Client([Response({"accessJwt":"secret"}),Response({},429)])); assert limited["status"]=="RATE_LIMITED"

def test_mastodon_mapping_and_telegram_missing_credentials(monkeypatch):
    db=mongomock.MongoClient()["social_intel"]; db.watchlist.insert_one(topic()); monkeypatch.setenv("MASTODON_INSTANCE","mastodon.social")
    row={"id":"1","url":"https://mastodon.social/@person/1","content":"<p>Public <b>#cybersecurity</b></p>","created_at":"2026-10-04T00:00:00Z","account":{"id":"account"},"tags":[{"name":"cybersecurity"}],"mentions":[]}
    result=mastodon_collector.ingest_mastodon(db,Client([Response([row]),Response([])]))
    doc=db.raw_posts.find_one({"platform":"mastodon"}); assert result["count"]==1 and doc["author_id"] != "account" and "person" not in str(doc)
    assert db.collector_state.find_one({"_id":"mastodon:mastodon.social:cybersecurity"})["since_id"] == "1"
    monkeypatch.setenv("TELEGRAM_PUBLIC_ENABLED","true"); monkeypatch.delenv("TELEGRAM_API_ID",raising=False); monkeypatch.delenv("TELEGRAM_API_HASH",raising=False)
    assert telegram_public_collector.ingest_telegram_public(db)["status"]=="CREDENTIALS_REQUIRED"
