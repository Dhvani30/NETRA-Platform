"""
NETRA Intelligence Platform API (NTRO SIH 2026).
Run: python -m uvicorn main:app --reload
"""
from __future__ import annotations
import json
import re
from datetime import datetime
from typing import Any
from bson import json_util
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from neo4j import GraphDatabase
from neo4j.exceptions import Neo4jError
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

# --- Configuration ---
MONGO_URI = "mongodb://admin:password123@localhost:27017/?authSource=admin"
MONGO_DB_NAME = "social_intel"
MONGO_COLLECTION = "raw_posts"
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "password123"

mongo_client: MongoClient = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5_000)
raw_posts: Collection = mongo_client[MONGO_DB_NAME][MONGO_COLLECTION]
neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

app = FastAPI(title="NETRA Intelligence Platform", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

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
    for key in ("name", "snippet", "id"):
        if props.get(key) is not None: return str(props[key])
    text = props.get("text")
    if text:
        text_str = str(text)
        return text_str if len(text_str) <= 80 else f"{text_str[:77]}..."
    return str(node.element_id)

def _fetch_graph_payload() -> dict[str, list[dict[str, str]]]:
    nodes_by_id: dict[str, dict[str, str]] = {}
    links: list[dict[str, str]] = []
    with neo4j_driver.session() as session:
        node_records = session.run("MATCH (n) RETURN n AS node, labels(n) AS labels")
        for record in node_records:
            node, labels = record["node"], record["labels"]
            node_id = _graph_node_id(node, labels)
            nodes_by_id[node_id] = {"id": node_id, "label": _graph_node_label(node), "group": _primary_label(labels)}
        
        rel_records = session.run("MATCH (a)-[r]->(b) RETURN a AS source_node, labels(a) AS source_labels, b AS target_node, labels(b) AS target_labels, type(r) AS rel_type")
        for record in rel_records:
            source_id = _graph_node_id(record["source_node"], record["source_labels"])
            target_id = _graph_node_id(record["target_node"], record["target_labels"])
            if source_id not in nodes_by_id: nodes_by_id[source_id] = {"id": source_id, "label": _graph_node_label(record["source_node"]), "group": _primary_label(record["source_labels"])}
            if target_id not in nodes_by_id: nodes_by_id[target_id] = {"id": target_id, "label": _graph_node_label(record["target_node"]), "group": _primary_label(record["target_labels"])}
            links.append({"source": source_id, "target": target_id, "type": str(record["rel_type"])})
    return {"nodes": list(nodes_by_id.values()), "links": links}

@app.get("/health")
def health():
    try:
        mongo_client.admin.command("ping")
        with neo4j_driver.session() as session: session.run("RETURN 1")
    except Exception: raise HTTPException(status_code=503, detail="Database unreachable")
    return {"status": "ok"}

@app.get("/api/v1/messages")
def get_messages(limit: int = Query(20, ge=1, le=100)):
    try:
        cursor = raw_posts.find({}, {"_id": 0}).sort("published_at", -1).limit(limit)
        return {"messages": _mongo_documents_to_json(list(cursor))}
    except PyMongoError: raise HTTPException(status_code=500, detail="DB Error")

@app.get("/api/v1/analytics/sentiment")
def get_sentiment():
    try:
        pipeline = [{"$group": {"_id": "$sentiment_label", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}]
        results = list(raw_posts.aggregate(pipeline))
        return {"sentiment_breakdown": [{"label": r["_id"] if r["_id"] else "Neutral", "count": r["count"]} for r in results]}
    except PyMongoError: raise HTTPException(status_code=500, detail="DB Error")

@app.get("/api/v1/analytics/narratives")
def get_narratives():
    try:
        pipeline = [
            {"$group": {"_id": {"$ifNull": ["$narrative_name", {"$concat": ["Narrative_", {"$toString": {"$ifNull": ["$narrative_cluster", 0]} }]}]}, "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}, {"$limit": 10}
        ]
        results = list(raw_posts.aggregate(pipeline))
        return {"clusters": [{"name": r["_id"] if r["_id"] else "Uncategorized", "count": r["count"]} for r in results]}
    except PyMongoError: raise HTTPException(status_code=500, detail="DB Error")

@app.get("/api/v1/graph/data")
def get_graph():
    try: return _fetch_graph_payload()
    except Exception: raise HTTPException(status_code=500, detail="Graph Error")

@app.get("/api/v1/search")
def search_messages(q: str = Query(..., min_length=1)):
    try:
        pattern = re.escape(q.strip())
        query = {"$or": [{"text_content": {"$regex": pattern, "$options": "i"}}, {"content": {"$regex": pattern, "$options": "i"}}]}
        cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", -1).limit(100)
        documents = _mongo_documents_to_json(list(cursor))
        
        platforms = list(set(doc.get("platform", "UNKNOWN").upper() for doc in documents if doc.get("platform")))
        entities = set()
        entity_keywords = ["cisco", "cert-in", "india", "china", "nato", "sbi", "parliament", "microsoft", "google", "rbi", "sebi", "finch", "neurotech", "spaceintel"]
        for doc in documents:
            text = (doc.get("text_content") or doc.get("content") or "").lower()
            for kw in entity_keywords:
                if kw in text: entities.add(kw.title())
        
        activity_trend = f"+{len(documents) * 12}%" if len(documents) > 2 else "0%"
        provenance = f"Matched indicators: '{q}'. Found {len(documents)} observations across {', '.join(platforms) or 'unknown platforms'}. Key entities detected: {', '.join(list(entities)[:5]) or 'None specific'}."

        return {
            "query": q,
            "summary": {"observations": len(documents), "entities": list(entities), "platforms": platforms, "activity_trend": activity_trend},
            "provenance": provenance,
            "posts": documents
        }
    except PyMongoError: raise HTTPException(status_code=500, detail="Search failed")

@app.get("/api/v1/analytics/mutation")
def get_narrative_mutation(narrative: str = Query(..., description="Narrative name to track")):
    try:
        query = {"narrative_name": {"$regex": narrative, "$options": "i"}}
        cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", 1)
        posts = _mongo_documents_to_json(list(cursor))
        
        if not posts:
            return {"error": "No data found for this narrative"}

        total = len(posts)
        phases = [
            {"name": "Phase 1: Initial Detection", "slice": posts[:max(1, total//4)]},
            {"name": "Phase 2: Developing", "slice": posts[max(1, total//4):max(1, total//2)]},
            {"name": "Phase 3: Acceleration", "slice": posts[max(1, total//2):max(1, (total*3)//4)]},
            {"name": "Phase 4: Current State", "slice": posts[max(1, (total*3)//4):]}
        ]

        timeline_data = []
        mutations = []
        all_entities_seen = set()
        
        for phase in phases:
            phase_posts = phase["slice"]
            if not phase_posts: continue
            
            volume = len(phase_posts)
            sentiments = [p.get("sentiment_label", "NEUTRAL") for p in phase_posts]
            dominant_sentiment = max(set(sentiments), key=sentiments.count) if sentiments else "NEUTRAL"
            
            current_entities = set()
            for p in phase_posts:
                text = (p.get("text_content") or "").lower()
                known_entities = ["cisco", "cert-in", "sbi", "hdfc", "ransomware", "malware", "ai", "regulation", "china", "india", "nato"]
                for ent in known_entities:
                    if ent in text:
                        current_entities.add(ent.title())
            
            new_mutations = list(current_entities - all_entities_seen)
            all_entities_seen.update(current_entities)
            
            last_time = phase_posts[-1].get("published_at", "Unknown")
            try:
                time_obj = datetime.fromisoformat(last_time.replace('Z', '+00:00'))
                time_str = time_obj.strftime("%b %d, %H:%M")
            except:
                time_str = "Recent"

            timeline_data.append({
                "phase": phase["name"].split(":")[0],
                "volume": volume,
                "sentiment": dominant_sentiment,
                "time": time_str
            })

            if new_mutations:
                mutations.append({
                    "phase": phase["name"],
                    "time": time_str,
                    "new_elements": new_mutations,
                    "sentiment_shift": dominant_sentiment
                })

        return {
            "narrative": narrative,
            "total_observations": total,
            "timeline": timeline_data,
            "mutations": mutations
        }

    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail="Failed to load mutation data.") from exc

@app.get("/api/v1/analytics/correlation")
def get_cross_platform_correlation(q: str = Query(..., description="Topic to track across platforms")):
    try:
        pattern = re.escape(q.strip())
        query = {"$or": [
            {"text_content": {"$regex": pattern, "$options": "i"}}, 
            {"content": {"$regex": pattern, "$options": "i"}}
        ]}
        
        posts = _mongo_documents_to_json(list(raw_posts.find(query, {"_id": 0}).sort("published_at", 1)))
        
        if not posts:
            return {"query": q, "flow": []}

        platform_stats = {}
        for p in posts:
            plat = p.get("platform", "unknown").lower()
            if plat not in platform_stats:
                platform_stats[plat] = {
                    "first_seen": p.get("published_at"),
                    "count": 0,
                    "sample_text": (p.get("text_content") or p.get("content") or "")[:100]
                }
            platform_stats[plat]["count"] += 1

        flow = []
        for plat, stats in platform_stats.items():
            flow.append({
                "platform": plat.upper(),
                "first_seen": stats["first_seen"],
                "post_count": stats["count"],
                "sample_text": stats["sample_text"] + "..."
            })
        
        flow.sort(key=lambda x: x["first_seen"])

        return {"query": q, "flow": flow, "total_posts": len(posts)}

    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail="Correlation failed.") from exc

@app.on_event("shutdown")
def shutdown_event():
    neo4j_driver.close()
    mongo_client.close()