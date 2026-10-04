from datetime import datetime, timezone
import mongomock
from app.nlp import infer
from app.sentiment import rebuild_rollups, rebuild_threads, timeline

def test_language_routing_and_fallback(monkeypatch):
    monkeypatch.setattr(infer, "_pipeline", lambda *args, **kwargs: None)
    result = infer.infer_post({"text": "Yeh bahut bura attack hai 😟 https://example.test @netra"}, topic="security")
    assert result["lang"] == "hinglish"
    assert result["sentiment"]["method"] == "lexical-fallback"
    assert "😟" in result["nlp"]["normalized_text"]
    assert "[URL]" in result["nlp"]["normalized_text"]

def test_thread_aggregation_and_rollups():
    db = mongomock.MongoClient()["netra"]
    now = datetime(2026, 10, 4, 10, 30, tzinfo=timezone.utc).isoformat()
    db.raw_posts.insert_many([
        {"post_id":"root", "platform":"x", "created_at":now, "source_mode":"LIVE", "sentiment":{"label":"neutral", "score":0}, "emotions":{"label":"neutral"}, "stance":{"label":"neutral"}},
        {"post_id":"r1", "parent_id":"root", "platform":"x", "created_at":now, "source_mode":"LIVE", "sentiment":{"label":"negative", "score":-.8}, "emotions":{"label":"anger"}, "stance":{"label":"against"}},
        {"post_id":"r2", "parent_id":"root", "platform":"x", "created_at":now, "source_mode":"LIVE", "sentiment":{"label":"positive", "score":.4}, "emotions":{"label":"joy"}, "stance":{"label":"supportive"}},
    ])
    assert rebuild_threads(db.raw_posts, db) == 1
    thread = db.threads.find_one({"parent_id":"root"})
    assert thread["reply_count"] == 2 and thread["against_pct"] == 50.0
    assert rebuild_rollups(db.raw_posts, db) == 2
    rows = timeline(db, resolution="hour")
    assert rows[0]["polarity"]["negative"] == 1 and rows[0]["emotions"]["anger"] == 1

def test_incremental_query_excludes_current_version():
    assert infer.scoring_query()["$or"]

def test_incremental_scoring_does_not_rescore(monkeypatch):
    import app.analytic_engine as engine
    client = mongomock.MongoClient()
    post = {"post_id": "once", "text": "useful update", "created_at": datetime.now(timezone.utc).isoformat()}
    client[engine.DB_NAME][engine.COLLECTION_NAME].insert_one(post)
    monkeypatch.setattr(engine, "MongoClient", lambda *args, **kwargs: client)
    monkeypatch.setattr(engine, "infer_batch", lambda posts, **kwargs: [{"lang":"en", "sentiment":{"label":"positive", "score":.8, "method":"test", "model_version":infer.MODEL_VERSION, "confidence":.8, "scored_at":"2026-10-04T00:00:00+00:00"}, "emotions":{"label":"joy"}, "stance":{"label":"neutral"}, "sarcasm":{"prob":0}, "nlp":{}} for _ in posts])
    assert engine.run_ai_analytics(batch_size=10) == 1
    assert engine.run_ai_analytics(batch_size=10) == 0
