"""
NETRA Intelligence Platform API (NTRO SIH 2026).
"""
from __future__ import annotations
import os
import json
import re
from typing import Any

from bson import json_util
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

from pathlib import Path
from dotenv import load_dotenv

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("DB_NAME", "NETRA")
MONGO_COLLECTION = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

mongo_client: MongoClient = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5_000)
raw_posts: Collection = mongo_client[MONGO_DB_NAME][MONGO_COLLECTION]
neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

app = FastAPI(title="NETRA Intelligence Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _mongo_documents_to_json(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return json.loads(json_util.dumps(documents))

def _primary_label(labels: list[str]) -> str:
    return labels[0] if labels else "Node"

def _graph_node_id(node: Any, labels: list[str]) -> str:
    props = dict(node)
    if props.get("id") is not None: return str(props["id"])
    if props.get("name") is not None: return f"{_primary_label(labels)}:{props['name']}"
    return str(node.element_id)

def _graph_node_label(node: Any) -> str:
    props = dict(node)
    if props.get("name"): return str(props["name"])
    text = props.get("text")
    if text:
        text_str = str(text)
        return text_str if len(text_str) <= 50 else f"{text_str[:47]}..."
    if props.get("id"): return str(props["id"])
    return str(node.element_id)

def _fetch_graph_payload() -> dict[str, list[dict[str, str]]]:
    nodes_by_id: dict[str, dict[str, str]] = {}
    links: list[dict[str, str]] = []
    seen_post_texts = set()

    with neo4j_driver.session() as session:
        node_records = session.run("MATCH (n) RETURN n AS node, labels(n) AS labels")
        for record in node_records:
            node = record["node"]
            labels: list[str] = record["labels"]
            node_id = _graph_node_id(node, labels)
            
            if "Post" in labels:
                text = node.get("text", "")
                if text in seen_post_texts: continue
                seen_post_texts.add(text)
            
            nodes_by_id[node_id] = {
                "id": node_id, "label": _graph_node_label(node), "group": _primary_label(labels),
            }

        rel_records = session.run("MATCH (a)-[r]->(b) RETURN a AS source_node, labels(a) AS source_labels, b AS target_node, labels(b) AS target_labels, type(r) AS rel_type")
        for record in rel_records:
            source_id = _graph_node_id(record["source_node"], record["source_labels"])
            target_id = _graph_node_id(record["target_node"], record["target_labels"])
            if source_id in nodes_by_id and target_id in nodes_by_id:
                links.append({"source": source_id, "target": target_id, "type": str(record["rel_type"])})

    return {"nodes": list(nodes_by_id.values()), "links": links}

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/api/v1/feed")
def get_feed():
    cursor = raw_posts.find({}, {"_id": 0}).sort("published_at", -1).limit(50)
    return {"count": 50, "documents": _mongo_documents_to_json(list(cursor))}

@app.get("/api/v1/graph/data")
def get_graph():
    return _fetch_graph_payload()

@app.get("/api/v1/analytics/sentiment")
def get_sentiment_analytics():
    pipeline = [{"$group": {"_id": "$sentiment_label", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
    results = list(raw_posts.aggregate(pipeline))
    return {"sentiment_breakdown": [{"label": r["_id"] or "Neutral", "count": r["count"]} for r in results]}

@app.get("/api/v1/analytics/narratives")
def get_narrative_analytics():
    pipeline = [
        {"$group": {"_id": {"$ifNull": ["$narrative_name", {"$concat": ["Narrative_", {"$toString": {"$ifNull": ["$narrative_cluster", 0]} }]}]}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 10}
    ]
    results = list(raw_posts.aggregate(pipeline))
    return {"clusters": [{"name": r["_id"] or "Uncategorized", "count": r["count"]} for r in results]}

@app.get("/api/v1/messages")
def get_messages(limit: int = Query(20, ge=1, le=100)):
    cursor = raw_posts.find({}, {"_id": 0}).sort("published_at", -1).limit(limit)
    return {"messages": _mongo_documents_to_json(list(cursor))}

@app.get("/api/v1/search")
def search_messages(q: str = Query(..., min_length=1)):
    pattern = re.escape(q.strip())
    query = {"$or": [{"text_content": {"$regex": pattern, "$options": "i"}}, {"content": {"$regex": pattern, "$options": "i"}}]}
    cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", -1).limit(100)
    raw_documents = list(cursor)
    
    seen_texts = set()
    documents = []
    for doc in raw_documents:
        text = doc.get("text_content") or doc.get("content") or ""
        if text not in seen_texts:
            seen_texts.add(text)
            documents.append(doc)
            
    platforms = list(set(doc.get("platform", "UNKNOWN").upper() for doc in documents if doc.get("platform")))
    entities = set()
    for doc in documents:
        text = (doc.get("text_content") or doc.get("content") or "").lower()
        for kw in ["cisco", "cert-in", "india", "china", "nato", "sbi", "parliament", "microsoft", "google", "rbi", "sebi"]:
            if kw in text: entities.add(kw.upper() if len(kw) <= 3 else kw.title())
                
    return {
        "query": q,
        "summary": {"observations": len(documents), "entities": list(entities), "platforms": platforms, "activity_trend": f"+{len(documents)*12}%"},
        "provenance": f"Matched indicators: '{q}'. Found {len(documents)} observations across {', '.join(platforms)}.",
        "posts": documents
    }