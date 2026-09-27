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

# --- Semantic Narrative Detector ---
def detect_narrative(text, default_topic):
    text_lower = text.lower()
    if any(x in text_lower for x in ["ransomware", "malware", "cyber attack", "data breach", "zero-day", "vulnerability"]):
        return "Cyber Attack"
    if any(x in text_lower for x in ["artificial intelligence", "ai regulation", "ai model", "machine learning"]):
        return "AI Development and Regulation"
    if any(x in text_lower for x in ["south china sea", "china", "navy", "maritime", "taiwan"]):
        return "South China Sea Tensions"
    if any(x in text_lower for x in ["border", "border security", "territorial", "dispute"]):
        return "Border Security"
    if any(x in text_lower for x in ["defence", "defense", "military", "nato", "army"]):
        return "Defence and Security"
    if any(x in text_lower for x in ["election", "vote", "parliament", "government", "policy"]):
        return "Political and Governance"
    return default_topic.replace("_", " ").title()

# --- Expanded Entity Keyword Matcher ---
ENTITY_KEYWORDS = {
    "Organization": ["cisco", "nato", "un", "cert-in", "microsoft", "google", "ntro", "parliament", "defense ministry", "iisc", "isro", "sebi", "rbi", "telegram", "twitter", "reddit"],
    "Location": ["india", "south china sea", "arctic", "bangalore", "bengaluru", "mumbai", "delhi", "japan", "us", "usa", "eu", "border", "rural areas", "china", "pakistan", "taiwan"]
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
    print("[*] Starting NETRA Semantic Knowledge Graph Builder (Clean)...")
    
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ping')
        collection = mongo_client[DB_NAME][COLLECTION_NAME]
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to MongoDB. Error: {e}")
        return
    
    # --- BALANCED INGESTION ---
    reddit_docs = list(collection.find({"platform": {"$regex": "^reddit$", "$options": "i"}}).limit(80))
    x_docs = list(collection.find({"platform": {"$regex": "^x$", "$options": "i"}}).limit(80))
    telegram_docs = list(collection.find({"platform": {"$regex": "^telegram$", "$options": "i"}}).limit(40))
    
    documents = reddit_docs + x_docs + telegram_docs
    
    print(f"[DEBUG] Reddit docs fetched: {len(reddit_docs)}")
    print(f"[DEBUG] X docs fetched: {len(x_docs)}")
    print(f"[DEBUG] Telegram docs fetched: {len(telegram_docs)}")
    print(f"[DEBUG] Total selected: {len(documents)}")
    
    valid_documents = []
    for doc in documents:
        text = doc.get("text_content") or doc.get("content") or ""
        if text.strip():
            valid_documents.append(doc)
            
    print(f"[DEBUG] Valid documents with text: {len(valid_documents)}")
    
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
    
    print("[*] Clearing existing graph data for clean demo state...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Building semantic nodes and relationships...")
    with driver.session() as session:
        for doc in valid_documents:
            canonical_id = doc.get("canonical_id")
            if canonical_id:
                post_id = canonical_id
            else:
                mongo_id = str(doc.get("_id"))
                platform_name = (doc.get("platform") or "unknown").lower()
                post_id = f"{platform_name}_{mongo_id}"
            
            platform = (doc.get("platform") or "UNKNOWN").upper()
            text = doc.get("text_content") or doc.get("content") or ""
            
            snippet = text[:60].replace('\n', ' ') + "..." if len(text) > 60 else text
            
            metadata = doc.get("metadata", {})
            if metadata.get("subreddit"):
                topic_name = metadata["subreddit"].title()
            elif metadata.get("chat_title"):
                topic_name = metadata["chat_title"].title()
            else:
                topic_name = "General_Discussion"
            
            narrative_name = detect_narrative(text, topic_name)

            # 1. Post Node
            session.run(
                "MERGE (p:Post {id: $id}) "
                "SET p.name = $snippet, p.text = $text, p.platform = $platform",
                id=post_id, snippet=snippet, text=text[:300], platform=platform
            )
            
            # 2. Platform Node
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (plat:Platform {name: $platform}) "
                "MERGE (p)-[:POSTED_ON]->(plat)",
                platform=platform, post_id=post_id
            )
            
            # 3. Topic Node
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (t:Topic {name: $name}) "
                "MERGE (p)-[:ABOUT]->(t)",
                name=topic_name, post_id=post_id
            )

            # 4. Narrative Node
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (n:Narrative {name: $name}) "
                "MERGE (p)-[:PART_OF]->(n)",
                name=narrative_name, post_id=post_id
            )

            # 5. Entity Nodes
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