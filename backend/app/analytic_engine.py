"""Incremental NLP enrichment and materialised sentiment views."""
from __future__ import annotations
import os
from collections import Counter
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from app.nlp.infer import MODEL_VERSION, infer_batch, scoring_query
from app.sentiment import rebuild_rollups, rebuild_threads

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

def run_ai_analytics(batch_size: int = 200, inference_batch_size: int = 32, topic: str | None = None) -> int:
    """Score only documents whose NLP model version is stale or missing."""
    client = MongoClient(MONGO_URI)
    db, posts = client[DB_NAME], client[DB_NAME][COLLECTION_NAME]
    documents = list(posts.find(scoring_query()).sort("_id", 1).limit(batch_size))
    if not documents:
        return 0
    results = infer_batch(documents, topic=topic, batch_size=inference_batch_size)
    for document, result in zip(documents, results):
        update = {"$set": {"lang": document.get("lang") or result["lang"], "sentiment": result["sentiment"], "emotions": result["emotions"], "stance": result["stance"], "sarcasm": result["sarcasm"], "nlp": result["nlp"], "ai_analysis": {"sentiment_score": result["sentiment"]["score"], "sentiment_label": result["sentiment"]["label"].upper(), "confidence": result["sentiment"]["confidence"]}, "sentiment_label": result["sentiment"]["label"].upper(), "processed": True, "processed_at": result["sentiment"]["scored_at"]}}
        # update_one avoids an incompatibility between recent PyMongo operations
        # and older mongomock versions, and batches are deliberately bounded.
        posts.update_one({"_id": document["_id"], "$or": [{"sentiment": {"$exists": False}}, {"sentiment.model_version": {"$ne": MODEL_VERSION}}]}, update)
    rebuild_threads(posts, db)
    rebuild_rollups(posts, db)
    labels = Counter(result["sentiment"]["label"] for result in results)
    print(f"[NLP] scored={len(results)} model={MODEL_VERSION} labels={dict(labels)}")
    return len(results)

if __name__ == "__main__":
    run_ai_analytics()
