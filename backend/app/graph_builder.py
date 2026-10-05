"""Build an idempotent PostgreSQL graph from raw MongoDB posts."""
import re
from pathlib import Path
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from psycopg2.extras import Json, execute_values

# Path resolution
BASE_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(dotenv_path=BASE_DIR / '.env')

# 🚨 CRITICAL FIX: Ensure backend directory is in sys.path BEFORE importing app modules
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.env_utils import get_clean_env

from app.graph_db import get_connection, initialize_pool

MONGO_URI = get_clean_env("MONGO_URI", "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin")
DB_NAME = get_clean_env("DB_NAME", "NETRA")
COLLECTION_NAME = get_clean_env("COLLECTION_NAME", "raw_posts")

ENTITY_KEYWORDS = {
    "Organization": ["cisco", "nato", "un", "cert-in", "microsoft", "google", "ntro", "parliament", "defense ministry", "iisc", "isro", "sebi", "rbi", "sbi", "hdfc"],
    "Location": ["india", "south china sea", "arctic", "bangalore", "mumbai", "delhi", "japan", "us", "usa", "eu", "border", "china", "pakistan", "taiwan", "beijing"],
}

def get_topic(text, metadata, platform):
    if metadata.get("subreddit"): return str(metadata["subreddit"]).title()
    if metadata.get("chat_title"): return str(metadata["chat_title"]).title()
    text_lower = text.lower()
    for words, topic in [
        (["cyber", "hack", "breach", "malware", "ransomware", "vulnerability"], "Cybersecurity"),
        (["ai", "artificial intelligence", "machine learning", "deepfake"], "Artificial Intelligence"),
        (["china", "border", "navy", "war", "conflict", "geopolitics"], "Geopolitics"),
        (["defence", "military", "army", "nato", "missile"], "Defence & Military"),
        (["election", "vote", "parliament", "policy", "government"], "Politics & Governance"),
        (["bank", "fintech", "rbi", "sebi", "sbi", "hdfc", "economy", "market"], "Financial Technology")
    ]:
        if any(word in text_lower for word in words): return topic
    return "Global Intelligence"

def get_narrative(text, topic):
    text_lower = text.lower()
    for words, narrative in [
        (["ransomware", "zero-day", "lockbit"], "Ransomware & Zero-Day Attacks"),
        (["data breach", "leak", "privacy", "dpdp"], "Data Privacy & Breaches"),
        (["south china sea", "taiwan", "maritime"], "South China Sea Conflict"),
        (["border", "territorial", "dispute"], "Border Security Disputes"),
        (["ai regulation", "misinformation", "deepfake"], "AI Regulation & Deepfakes"),
        (["defence", "military", "nato"], "Defence Modernization"),
        (["cyber", "hack", "ransomware", "vulnerability", "cert-in", "zero-day", "malware"], "Cyber Attack"),
        (["ai", "artificial intelligence", "regulation", "algorithm", "tech policy"], "AI Development and Regulation"),
        (["defence", "military", "nato", "border", "security", "army", "forces"], "Defence and Security"),
        (["china", "south china sea", "taiwan", "navy", "beijing", "tensions"], "South China Sea Tensions"),
        (["bank", "fintech", "rbi", "sebi", "sbi", "hdfc", "economy", "market"], "Financial Technology")
    ]:
        if any(word in text_lower for word in words): return narrative
    return f"{topic} Discourse"

def extract_entities(text):
    text_lower = text.lower()
    entities = {"Organization": set(), "Location": set()}
    for entity_type, keywords in ENTITY_KEYWORDS.items():
        for keyword in keywords:
            if re.search(rf"\b{re.escape(keyword)}\b", text_lower):
                entities[entity_type].add(keyword.upper() if keyword.lower() in {"us", "uk", "eu"} else keyword.title())
    return entities

def _upsert_nodes_edges(nodes, edges):
    with get_connection() as connection, connection.cursor() as cursor:
        execute_values(cursor, """INSERT INTO graph_nodes (id,label,node_type,properties) VALUES %s
            ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label,node_type=EXCLUDED.node_type,properties=EXCLUDED.properties""",
            [(node_id, label, kind, Json(properties)) for node_id, label, kind, properties in nodes])
        execute_values(cursor, """INSERT INTO graph_edges (source,target,edge_type) VALUES %s
            ON CONFLICT (source,target,edge_type) DO NOTHING""", edges)

def build_knowledge_graph():
    print("[*] Syncing NETRA semantic graph into PostgreSQL...")
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    try:
        mongo_client.admin.command("ping")
        collection = mongo_client[DB_NAME][COLLECTION_NAME]
        
        # 🚨 CRITICAL FIX: Fetch ALL platforms (including youtube, instagram) instead of just reddit|x|telegram
        documents = list(collection.find({}).limit(1500))
        
        documents = [doc for doc in documents if (doc.get("text_content") or doc.get("content") or "").strip()]
        if not documents:
            print("[-] No valid documents found.")
            return
        
        initialize_pool()
        all_nodes, all_edges = {}, set()
        
        for doc in documents:
            post_id = str(doc.get("canonical_id") or f"{doc.get('platform', 'unk')}_{doc.get('_id')}")
            platform = str(doc.get("platform") or "UNKNOWN").upper()
            text = str(doc.get("text_content") or doc.get("content") or "")
            snippet = text[:50].replace("\n", " ") + ("..." if len(text) > 50 else "")
            metadata = doc.get("metadata") or {}
            
            topic = get_topic(text, metadata, platform)
            narrative = get_narrative(text, topic)
            
            post_node = (post_id, snippet or post_id, "Post", {"text": text[:300], "platform": platform})
            all_nodes[post_id] = post_node
            
            relationships = [("Platform", platform, "POSTED_ON"), ("Topic", topic, "ABOUT"), ("Narrative", narrative, "PART_OF")]
            
            author = str(doc.get('author_username') or doc.get('author') or doc.get('author_id', '')).strip()
            if author and author.lower() not in {'deleted', '[deleted]', 'unknown', 'anon'}:
                relationships.append(('Author', author, 'AUTHORED'))
                
            for entity_type, values in extract_entities(text).items():
                relationships.extend((entity_type, value, "MENTIONS" if entity_type == "Organization" else "ASSOCIATED_WITH") for value in values)
            
            for kind, label, relation in relationships:
                entity_id = f"{kind}:{label}"
                all_nodes[entity_id] = (entity_id, label, kind, {})
                all_edges.add((post_id, entity_id, relation))
        
        _upsert_nodes_edges(list(all_nodes.values()), list(all_edges))
        print(f"[+] Upserted {len(all_nodes)} nodes and {len(all_edges)} edges from {len(documents)} posts.")
        
    except Exception as e:
        print(f"[!] Error building knowledge graph: {e}")
    finally:
        mongo_client.close()

if __name__ == "__main__":
    build_knowledge_graph()
