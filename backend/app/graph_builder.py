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

MONGO_URI = os.getenv("MONGO_URI") or "mongodb://admin:password123@localhost:27017/?authSource=admin"
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

# --- 1. Dynamic Topic Extractor (Fixes the "General..." issue) ---
def get_topic(text, metadata, platform):
    # 1. Use metadata if available (Reddit subreddits, Telegram chat titles)
    if metadata.get("subreddit"): return metadata["subreddit"].title()
    if metadata.get("chat_title"): return metadata["chat_title"].title()

    # 2. Fallback for X/Telegram: Scan text for broad categories
    text_lower = text.lower()
    if any(x in text_lower for x in ["cyber", "hack", "breach", "malware", "ransomware", "vulnerability"]):
        return "Cybersecurity"
    if any(x in text_lower for x in ["ai", "artificial intelligence", "machine learning", "deepfake"]):
        return "Artificial Intelligence"
    if any(x in text_lower for x in ["china", "border", "navy", "war", "conflict", "geopolitics"]):
        return "Geopolitics"
    if any(x in text_lower for x in ["defence", "military", "army", "nato", "missile"]):
        return "Defence & Military"
    if any(x in text_lower for x in ["election", "vote", "parliament", "policy", "government"]):
        return "Politics & Governance"
    
    return "Global Intelligence" # Much better than "General..."

# --- 2. Semantic Narrative Detector (Fixes the duplicate label issue) ---
def get_narrative(text, topic):
    text_lower = text.lower()
    # Narratives should be specific events/themes, not broad categories
    if any(x in text_lower for x in ["ransomware", "zero-day", "lockbit"]):
        return "Ransomware & Zero-Day Attacks"
    if any(x in text_lower for x in ["data breach", "leak", "privacy", "dpdp"]):
        return "Data Privacy & Breaches"
    if any(x in text_lower for x in ["south china sea", "taiwan", "maritime"]):
        return "South China Sea Conflict"
    if any(x in text_lower for x in ["border", "territorial", "dispute"]):
        return "Border Security Disputes"
    if any(x in text_lower for x in ["ai regulation", "misinformation", "deepfake"]):
        return "AI Regulation & Deepfakes"
    if any(x in text_lower for x in ["defence", "military", "nato"]):
        return "Defence Modernization"
    
    # Fallback: Combine topic with a generic discourse tag to avoid exact duplicates
    return f"{topic} Discourse"

# --- 3. Entity Keyword Matcher ---
ENTITY_KEYWORDS = {
    "Organization": ["cisco", "nato", "un", "cert-in", "microsoft", "google", "ntro", "parliament", "defense ministry", "iisc", "isro", "sebi", "rbi"],
    "Location": ["india", "south china sea", "arctic", "bangalore", "mumbai", "delhi", "japan", "us", "usa", "eu", "border", "china", "pakistan", "taiwan"]
}

def extract_entities(text):
    text_lower = text.lower()
    entities = {"Organization": set(), "Location": set()}
    for entity_type, keywords in ENTITY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf'\b{re.escape(keyword)}\b', text_lower):
                entities[entity_type].add(keyword.title() if keyword.lower() not in ["us", "uk", "eu"] else keyword.upper())
    return entities

def build_knowledge_graph():
    print("[*] Starting NETRA Semantic Knowledge Graph Builder (Massive Mode)...")
    
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ping')
        collection = mongo_client[DB_NAME][COLLECTION_NAME]
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to MongoDB. Error: {e}")
        return
    
    # --- BALANCED MASSIVE INGESTION ---
    # Pull up to 500 docs per platform to make the graph look huge and messy
    reddit_docs = list(collection.find({"platform": {"$regex": "^reddit$", "$options": "i"}}).limit(500))
    x_docs = list(collection.find({"platform": {"$regex": "^x$", "$options": "i"}}).limit(500))
    telegram_docs = list(collection.find({"platform": {"$regex": "^telegram$", "$options": "i"}}).limit(500))
    
    documents = reddit_docs + x_docs + telegram_docs
    
    print(f"[DEBUG] Reddit: {len(reddit_docs)} | X: {len(x_docs)} | Telegram: {len(telegram_docs)}")
    
    valid_documents = [doc for doc in documents if (doc.get("text_content") or doc.get("content") or "").strip()]
    print(f"[DEBUG] Total valid posts to graph: {len(valid_documents)}")
    
    if not valid_documents:
        print("[-] No valid documents found.")
        return

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("RETURN 1")
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to Neo4j. Error: {e}")
        return
    
    print("[*] Clearing existing graph data...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Building massive semantic graph...")
    with driver.session() as session:
        for doc in valid_documents:
            canonical_id = doc.get("canonical_id") or f"{doc.get('platform', 'unk')}_{str(doc.get('_id'))}"
            platform = (doc.get("platform") or "UNKNOWN").upper()
            text = doc.get("text_content") or doc.get("content") or ""
            
            snippet = text[:50].replace('\n', ' ') + "..." if len(text) > 50 else text
            
            # Get clean Topic and Narrative
            metadata = doc.get("metadata", {})
            topic_name = get_topic(text, metadata, platform)
            narrative_name = get_narrative(text, topic_name)

            # 1. Post Node
            session.run(
                "MERGE (p:Post {id: $id}) SET p.name = $snippet, p.text = $text, p.platform = $platform",
                id=canonical_id, snippet=snippet, text=text[:300], platform=platform
            )
            
            # 2. Platform Node
            session.run(
                "MATCH (p:Post {id: $id}) MERGE (plat:Platform {name: $name}) MERGE (p)-[:POSTED_ON]->(plat)",
                id=canonical_id, name=platform
            )
            
            # 3. Topic Node (Broad Category)
            session.run(
                "MATCH (p:Post {id: $id}) MERGE (t:Topic {name: $name}) MERGE (p)-[:ABOUT]->(t)",
                id=canonical_id, name=topic_name
            )

            # 4. Narrative Node (Specific Event)
            session.run(
                "MATCH (p:Post {id: $id}) MERGE (n:Narrative {name: $name}) MERGE (p)-[:PART_OF]->(n)",
                id=canonical_id, name=narrative_name
            )

            # 5. Entity Nodes
            entities = extract_entities(text)
            for org in entities["Organization"]:
                session.run(
                    "MATCH (p:Post {id: $id}) MERGE (o:Organization {name: $name}) MERGE (p)-[:MENTIONS]->(o)",
                    id=canonical_id, name=org
                )
            for loc in entities["Location"]:
                session.run(
                    "MATCH (p:Post {id: $id}) MERGE (l:Location {name: $name}) MERGE (p)-[:ASSOCIATED_WITH]->(l)",
                    id=canonical_id, name=loc
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
    print("[+] Massive Semantic Knowledge Graph successfully built!")
    print("[*] Open http://localhost:7474 to visualize.")

if __name__ == "__main__":
    build_knowledge_graph()