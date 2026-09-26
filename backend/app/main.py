import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure
from dotenv import load_dotenv
from neo4j import GraphDatabase # Added for Neo4j Graph Endpoint

# --- ROBUST PATH RESOLUTION ---
# main.py is in backend/app/. We need to go up 3 levels to reach the root (NETRA-Platform).
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables securely
load_dotenv(dotenv_path=ENV_FILE)

# --- Configuration (STRICT: No hardcoded URLs) ---
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

# Neo4j Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

# Fail Fast: If the URL is missing, stop immediately
if not MONGO_URI:
    raise ValueError(f"CRITICAL: MONGO_URI is not set in {ENV_FILE}!")

# --- Initialize FastAPI ---
app = FastAPI(
    title="NETRA Intelligence API",
    description="Production-grade social media intelligence analytics API",
    version="1.0.0"
)

# --- CORS Configuration (Allows React Frontend to talk to Backend) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Connection ---
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping') # Verify connection to Atlas
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    print("[+] Successfully connected to MongoDB Atlas.")
except ConnectionFailure:
    print("[-] Failed to connect to MongoDB. Check your MONGO_URI in .env.")
    client = None
    db = None
    collection = None

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "NETRA Intelligence API is running", "status": "healthy"}

@app.get("/api/v1/health")
def health_check():
    """Pipeline health and data volume metrics."""
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    total_docs = collection.count_documents({})
    live_count = collection.count_documents({"metadata.source_mode": "LIVE"})
    replay_count = collection.count_documents({"metadata.source_mode": "REPLAY"})
    
    return {
        "status": "healthy",
        "database": DB_NAME,
        "total_documents": total_docs,
        "live_sources": live_count,
        "replay_sources": replay_count
    }

@app.get("/api/v1/messages")
def get_messages(
    limit: int = Query(default=50, le=500), 
    platform: str = Query(default=None)
):
    """Fetch canonical messages with optional platform filtering."""
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    query = {}
    if platform:
        query["platform"] = platform.lower()
    
    # Fetch latest messages first based on published_at timestamp
    cursor = collection.find(query).sort("published_at", -1).limit(limit)
    messages = list(cursor)
    
    # Convert MongoDB ObjectId to string for JSON serialization
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        
    return {
        "count": len(messages),
        "messages": messages
    }

# --- AI Analytics Endpoints ---

@app.get("/api/v1/analytics/sentiment")
def get_sentiment_summary():
    """Returns the distribution of sentiment across all ingested messages."""
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    pipeline = [
        {"$group": {"_id": "$ai_analysis.sentiment_label", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    summary = list(collection.aggregate(pipeline))
    # Clean up the _id field for the frontend
    return {"sentiment_breakdown": [{"label": item["_id"] or "UNKNOWN", "count": item["count"]} for item in summary]}

@app.get("/api/v1/analytics/clusters")
def get_cluster_summary():
    """Returns the top narrative clusters and their sizes."""
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    pipeline = [
        {"$group": {"_id": "$ai_analysis.narrative_cluster", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    
    summary = list(collection.aggregate(pipeline))
    return {"narrative_clusters": [{"cluster_id": item["_id"], "post_count": item["count"]} for item in summary]}

@app.get("/api/v1/messages/ai")
def get_ai_filtered_messages(
    sentiment: str = Query(default=None, description="Filter by POSITIVE, NEGATIVE, or NEUTRAL"),
    cluster: int = Query(default=None, description="Filter by narrative cluster ID (e.g., 0, 1, 2)"),
    limit: int = Query(default=50, le=500)
):
    """Fetch messages filtered by AI-derived sentiment or narrative cluster."""
    if collection is None:
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    query = {}
    if sentiment:
        query["ai_analysis.sentiment_label"] = sentiment.upper()
    if cluster is not None:
        query["ai_analysis.narrative_cluster"] = cluster
    
    cursor = collection.find(query).sort("published_at", -1).limit(limit)
    messages = list(cursor)
    
    for msg in messages:
        msg["_id"] = str(msg["_id"])
        
    return {
        "count": len(messages),
        "filters_applied": {"sentiment": sentiment, "cluster": cluster},
        "messages": messages
    }

# --- Neo4j Graph Endpoint ---

@app.get("/api/v1/graph/data")
def get_graph_data():
    """Fetches nodes and links from Neo4j for frontend visualization."""
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            # Fetch all nodes and relationships
            result = session.run("MATCH (p:Post)-[r:MENTIONS]->(e:Entity) RETURN p.id AS source, e.name AS target, e.type AS type LIMIT 100")
            
            nodes = []
            links = []
            node_set = set()
            
            for record in result:
                source = record["source"]
                target = record["target"]
                ent_type = record["type"]
                
                if source not in node_set:
                    nodes.append({"id": source, "group": "Post"})
                    node_set.add(source)
                if target not in node_set:
                    nodes.append({"id": target, "group": ent_type})
                    node_set.add(target)
                    
                links.append({"source": source, "target": target})
                
        driver.close()
        return {"nodes": nodes, "links": links}
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import uvicorn
    # Reload=False to prevent the exit issue when running directly
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)