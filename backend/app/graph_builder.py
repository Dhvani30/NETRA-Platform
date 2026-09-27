import os
import re
from pathlib import Path
from collections import Counter
from dotenv import load_dotenv
from pymongo import MongoClient
from neo4j import GraphDatabase

# --- Configuration ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Hardcoded fallback to ensure it NEVER tries to resolve a broken DNS string
MONGO_URI = os.getenv("MONGO_URI") or "mongodb://admin:password123@localhost:27017/?authSource=admin"
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

GRAPH_MAX_DOCS = int(os.getenv("GRAPH_MAX_DOCS", "1000"))

# --- Expanded Entity Keyword Matcher ---
ENTITY_KEYWORDS = {
    "Organization": ["cisco", "nato", "un", "cert-in", "microsoft", "google", "ntro", "parliament", "defense ministry", "iisc", "isro", "sebi", "rbi"],
    "Location": ["india", "south china sea", "arctic", "bangalore", "bengaluru", "mumbai", "delhi", "japan", "us", "usa", "eu", "border", "rural areas", "china", "pakistan"]
}

def extract_entities(text):
    text_lower = text.lower()
    entities = {"Organization": set(), "Location": set()}
    for entity_type, keywords in ENTITY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf'\b{re.escape(keyword)}\b', text_lower):
                entities[entity_type].add(keyword.title() if keyword.lower() != "us" else "US")
    return entities

def build_knowledge_graph():
    print("[*] Starting NETRA Semantic Knowledge Graph Builder...")
    
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ping')
        collection = mongo_client[DB_NAME][COLLECTION_NAME]
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to MongoDB. Error: {e}")
        return
    
    # --- DIAGNOSTIC 1: Total Documents ---
    total_count = collection.count_documents({})
    print(f"[DEBUG] Total MongoDB documents: {total_count}")
    
    # Fetch documents with configurable limit
    documents = list(collection.find({}).limit(GRAPH_MAX_DOCS))
    print(f"[DEBUG] Documents fetched (limit {GRAPH_MAX_DOCS}): {len(documents)}")
    
    # Filter valid documents
    valid_documents = []
    for doc in documents:
        text = doc.get("text_content") or doc.get("content") or ""
        if text.strip():
            valid_documents.append(doc)
            
    print(f"[DEBUG] Valid documents with text: {len(valid_documents)}")
    
    if not valid_documents:
        print("[-] No valid documents found. Check ingestion pipeline.")
        return

    # --- DIAGNOSTIC 2: Platform Distribution ---
    print("\n[DEBUG] Platform distribution:")
    platform_counts = Counter((doc.get("platform") or "UNKNOWN").upper() for doc in valid_documents)
    for platform, count in platform_counts.items():
        print(f"  {platform}: {count}")

    # --- DIAGNOSTIC 3: Missing Canonical IDs ---
    missing_ids = sum(1 for doc in valid_documents if not doc.get("canonical_id"))
    print(f"\n[DEBUG] Missing canonical_id: {missing_ids}")
    print("-" * 50)

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("RETURN 1")
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to Neo4j. Error: {e}")
        return
    
    print("[*] Clearing existing graph data for clean demo state...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Building semantic nodes and relationships...")
    with driver.session() as session:
        for doc in valid_documents:
            # CRITICAL FIX: Never use "unknown" as an ID. Fallback to MongoDB _id.
            canonical_id = doc.get("canonical_id")
            if canonical_id:
                post_id = canonical_id
            else:
                mongo_id = str(doc.get("_id"))
                platform_name = (doc.get("platform") or "unknown").lower()
                post_id = f"{platform_name}_{mongo_id}"
            
            platform = (doc.get("platform") or "UNKNOWN").upper()
            author = doc.get("author_username") or doc.get("author_id") or "anonymous"
            text = doc.get("text_content") or doc.get("content") or ""
            
            # Readable Snippet for Post Label
            snippet = text[:60].replace('\n', ' ') + "..." if len(text) > 60 else text
            
            # Topic & Narrative Logic
            topic_name = doc.get("metadata", {}).get("subreddit", platform.lower()).title()
            if platform == "X": topic_name = "Twitter_Trends"
            elif platform == "TELEGRAM": topic_name = "Telegram_Channel"
            
            cluster = doc.get("narrative_cluster", 0)
            narrative_name = f"Narrative_Cluster_{cluster}" if "narrative_cluster" in doc else f"Narrative_{topic_name}"

            # Create Post Node
            session.run(
                "MERGE (p:Post {id: $id}) "
                "SET p.name = $snippet, p.text = $text, p.author = $author, p.platform = $platform",
                id=post_id, snippet=snippet, text=text[:300], author=author, platform=platform
            )
            
            # Create Platform Node & POSTED_ON
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (plat:Platform {name: $platform}) "
                "MERGE (p)-[:POSTED_ON]->(plat)",
                platform=platform, post_id=post_id
            )
            
            # Create Topic Node & ABOUT
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (t:Topic {name: $name}) "
                "MERGE (p)-[:ABOUT]->(t)",
                name=topic_name, post_id=post_id
            )

            # Create Narrative Node & PART_OF
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (n:Narrative {name: $name}) "
                "MERGE (p)-[:PART_OF]->(n)",
                name=narrative_name, post_id=post_id
            )

            # Extract Entities & Create MENTIONS / ASSOCIATED_WITH
            entities = extract_entities(text)
            for org in entities["Organization"]:
                session.run(
                    "MATCH (p:Post {id: $post_id}) "
                    "MERGE (o:Organization {name: $name}) "
                    "MERGE (p)-[:MENTIONS]->(o)",
                    name=org, post_id=post_id
                )
            for loc in entities["Location"]:
                session.run(
                    "MATCH (p:Post {id: $post_id}) "
                    "MERGE (l:Location {name: $name}) "
                    "MERGE (p)-[:ASSOCIATED_WITH]->(l)",
                    name=loc, post_id=post_id
                )

    print("[*] Computing Network Centrality Metrics...")
    try:
        with driver.session() as session:
            session.run("CALL gds.graph.drop('netra_graph', {failIfMissing: false}) YIELD graphName")
            session.run("""
                CALL gds.graph.project('netra_graph', 
                    ['Post', 'Platform', 'Topic', 'Narrative', 'Organization', 'Location'],
                    {POSTED_ON: {orientation: 'UNDIRECTED'}, ABOUT: {orientation: 'UNDIRECTED'}, 
                     PART_OF: {orientation: 'UNDIRECTED'}, MENTIONS: {orientation: 'UNDIRECTED'}, 
                     ASSOCIATED_WITH: {orientation: 'UNDIRECTED'}})
            """)
            session.run("CALL gds.pageRank.write('netra_graph', {writeProperty: 'pageRankScore', maxIterations: 20})")
            session.run("CALL gds.graph.drop('netra_graph')")
            print("[+] Advanced GDS PageRank computed!")
    except Exception:
        print("[!] GDS not available. Falling back to basic Degree Centrality.")
        with driver.session() as session:
            session.run("MATCH (n) WITH n, count { MATCH (n)--() } AS degree SET n.degreeCentrality = degree")
        print("[+] Basic Degree Centrality computed.")

    driver.close()
    mongo_client.close()
    print("[+] Semantic Knowledge Graph successfully built!")
    print("[*] Open http://localhost:7474 to visualize (User: neo4j, Pass: password123).")

if __name__ == "__main__":
    build_knowledge_graph()