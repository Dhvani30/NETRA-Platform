"""
NETRA Intelligence Platform API (NTRO SIH 2026).

Serves the React dashboard with MongoDB feed/search data and Neo4j graph exports.
Run: `python -m uvicorn main:app --reload` from the `backend` directory.
"""

from __future__ import annotations

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

MONGO_URI = "mongodb://admin:password123@localhost:27017/?authSource=admin"
MONGO_DB_NAME = "social_intel"
MONGO_COLLECTION = "raw_posts"

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "password123"

mongo_client: MongoClient = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5_000)
raw_posts: Collection = mongo_client[MONGO_DB_NAME][MONGO_COLLECTION]

neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

app = FastAPI(
    title="NETRA Intelligence Platform",
    description="Social media intelligence API for feed, search, and knowledge graph views.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _mongo_documents_to_json(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert BSON types (e.g. datetimes, ObjectId) into JSON-serializable values."""
    return json.loads(json_util.dumps(documents))


def _primary_label(labels: list[str]) -> str:
    return labels[0] if labels else "Node"


def _graph_node_id(node: Any, labels: list[str]) -> str:
    """Stable node identifier for force-graph consumers."""
    props = dict(node)
    if props.get("id") is not None:
        return str(props["id"])
    if props.get("name") is not None:
        return f"{_primary_label(labels)}:{props['name']}"
    return str(node.element_id)


def _graph_node_label(node: Any) -> str:
    props = dict(node)
    for key in ("name", "snippet", "id"):
        value = props.get(key)
        if value is not None:
            return str(value)
    text = props.get("text")
    if text:
        text_str = str(text)
        return text_str if len(text_str) <= 80 else f"{text_str[:77]}..."
    return str(node.element_id)


def _check_mongo_connection() -> None:
    mongo_client.admin.command("ping")


def _check_neo4j_connection() -> None:
    with neo4j_driver.session() as session:
        session.run("RETURN 1").single()


def _fetch_graph_payload() -> dict[str, list[dict[str, str]]]:
    """Export all Neo4j nodes and relationships for dashboard visualization."""
    nodes_by_id: dict[str, dict[str, str]] = {}
    links: list[dict[str, str]] = []

    with neo4j_driver.session() as session:
        node_records = session.run("MATCH (n) RETURN n AS node, labels(n) AS labels")
        for record in node_records:
            node = record["node"]
            labels: list[str] = record["labels"]
            node_id = _graph_node_id(node, labels)
            nodes_by_id[node_id] = {
                "id": node_id,
                "label": _graph_node_label(node),
                "group": _primary_label(labels),
            }

        rel_records = session.run(
            """
            MATCH (a)-[r]->(b)
            RETURN a AS source_node, labels(a) AS source_labels,
                   b AS target_node, labels(b) AS target_labels,
                   type(r) AS rel_type
            """
        )
        for record in rel_records:
            source_id = _graph_node_id(record["source_node"], record["source_labels"])
            target_id = _graph_node_id(record["target_node"], record["target_labels"])

            if source_id not in nodes_by_id:
                nodes_by_id[source_id] = {
                    "id": source_id,
                    "label": _graph_node_label(record["source_node"]),
                    "group": _primary_label(record["source_labels"]),
                }
            if target_id not in nodes_by_id:
                nodes_by_id[target_id] = {
                    "id": target_id,
                    "label": _graph_node_label(record["target_node"]),
                    "group": _primary_label(record["target_labels"]),
                }

            links.append(
                {
                    "source": source_id,
                    "target": target_id,
                    "type": str(record["rel_type"]),
                }
            )

    return {"nodes": list(nodes_by_id.values()), "links": links}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Verify MongoDB and Neo4j connectivity."""
    try:
        _check_mongo_connection()
        _check_neo4j_connection()
    except (PyMongoError, Neo4jError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="One or more data stores are unreachable.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Health check failed.",
        ) from exc

    return {"status": "ok"}


@app.get("/api/v1/feed", tags=["feed"])
def get_feed() -> dict[str, Any]:
    """Return the 50 most recent posts sorted by published_at (newest first)."""
    try:
        cursor = raw_posts.find({}, {"_id": 0}).sort("published_at", -1).limit(50)
        documents = _mongo_documents_to_json(list(cursor))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load feed from MongoDB.",
        ) from exc

    return {"count": len(documents), "documents": documents}


@app.get("/api/v1/graph/data", tags=["graph"])
def get_graph() -> dict[str, list[dict[str, str]]]:
    """Return all Neo4j nodes and relationships in force-graph JSON shape."""
    try:
        return _fetch_graph_payload()
    except Neo4jError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load graph data from Neo4j.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unexpected error while building graph response.",
        ) from exc


@app.get("/api/v1/analytics/sentiment", tags=["analytics"])
def get_sentiment_analytics() -> dict[str, Any]:
    """Count documents by sentiment_label in raw_posts collection."""
    try:
        pipeline = [
            {"$group": {"_id": "$sentiment_label", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        results = list(raw_posts.aggregate(pipeline))
        sentiment_breakdown = [
            {"label": result["_id"] if result["_id"] else "Neutral", "count": result["count"]}
            for result in results
        ]
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load sentiment analytics from MongoDB.",
        ) from exc

    return {"sentiment_breakdown": sentiment_breakdown}


@app.get("/api/v1/analytics/narratives", tags=["analytics"])
def get_narrative_analytics() -> dict[str, Any]:
    """Count documents by narrative_name or narrative_cluster in raw_posts collection."""
    try:
        pipeline = [
            {
                "$group": {
                    "_id": {
                        "$ifNull": [
                            "$narrative_name", 
                            {"$concat": ["Narrative_", {"$toString": {"$ifNull": ["$narrative_cluster", 0]} }]}
                        ]
                    },
                    "count": {"$sum": 1}
                }
            },
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        results = list(raw_posts.aggregate(pipeline))
        clusters = [
            {"name": result["_id"] if result["_id"] else "Uncategorized", "count": result["count"]}
            for result in results
        ]
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load narrative analytics from MongoDB.",
        ) from exc

    return {"clusters": clusters}


@app.get("/api/v1/messages", tags=["messages"])
def get_messages(limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    """Return recent posts from raw_posts collection."""
    try:
        cursor = raw_posts.find({}, {"_id": 0}).sort("published_at", -1).limit(limit)
        documents = _mongo_documents_to_json(list(cursor))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load messages from MongoDB.",
        ) from exc

    return {"messages": documents}


@app.get("/api/v1/search", tags=["search"])
def search_messages(
    q: str = Query(..., min_length=1, description="Case-insensitive keyword for text search"),
) -> dict[str, Any]:
    """Case-insensitive regex search on text_content or content in raw_posts."""
    try:
        pattern = re.escape(q.strip())
        query = {
            "$or": [
                {"text_content": {"$regex": pattern, "$options": "i"}},
                {"content": {"$regex": pattern, "$options": "i"}}
            ]
        }
        cursor = raw_posts.find(query, {"_id": 0}).sort("published_at", -1).limit(100)
        documents = _mongo_documents_to_json(list(cursor))
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Search failed due to a database error.",
        ) from exc

    return {"documents": documents}


@app.on_event("shutdown")
def shutdown_event() -> None:
    """Close database clients on application shutdown."""
    neo4j_driver.close()
    mongo_client.close()