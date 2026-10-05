"""Build an idempotent PostgreSQL graph from raw MongoDB posts."""
import os
import re
from pathlib import Path
import sys
from dotenv import load_dotenv
from pymongo import MongoClient
from psycopg2.extras import Json, execute_values

# Path resolution
BASE_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = Path(__file__).resolve().parents[1]

<<<<<<< HEAD
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")
=======
load_dotenv(dotenv_path=BASE_DIR / '.env')

# 🚨 CRITICAL FIX: Ensure backend directory is in sys.path BEFORE importing app modules
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.graph_db import get_connection, initialize_pool

MONGO_URI = os.getenv("MONGO_URI") or "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin"
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

ENTITY_KEYWORDS = {
    "Organization": ["cisco", "nato", "un", "cert-in", "microsoft", "google", "ntro", "parliament", "defense ministry", "iisc", "isro", "sebi", "rbi", "sbi", "hdfc"],
    "Location": ["india", "south china sea", "arctic", "bangalore", "mumbai", "delhi", "japan", "us", "usa", "eu", "border", "china", "pakistan", "taiwan", "beijing"],
}
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd

def get_topic(text, metadata, platform):
    if metadata.get("subreddit"): return str(metadata["subreddit"]).title()
    if metadata.get("chat_title"): return str(metadata["chat_title"]).title()
    text_lower = text.lower()
<<<<<<< HEAD
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
=======
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
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd

def get_narrative(text, topic):
    text_lower = text.lower()
<<<<<<< HEAD
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
=======
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
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
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
<<<<<<< HEAD
    print("[*] Starting NETRA Semantic Knowledge Graph Builder (Massive Mode)...")

=======
    print("[*] Syncing NETRA semantic graph into PostgreSQL...")
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
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
<<<<<<< HEAD
        print(f"[!] CRITICAL: Cannot connect to MongoDB. Error: {e}")
        return

    # --- BALANCED MASSIVE INGESTION ---
    # Pull up to 500 docs per platform to make the graph look huge and messy
    reddit_docs = list(collection.find({"platform": {"$regex": "^reddit$", "$options": "i"}}).limit(500))
    x_docs = list(collection.find({"platform": {"$regex": "^x$", "$options": "i"}}).limit(500))
    telegram_docs = list(collection.find({"platform": {"$regex": "^telegram$", "$options": "i"}}).limit(500))
    youtube_docs = list(collection.find({"platform": {"$regex": "^youtube$", "$options": "i"}}).limit(500))
    facebook_docs = list(collection.find({"platform": {"$regex": "^facebook$", "$options": "i"}}).limit(500))
    instagram_docs = list(collection.find({"platform": {"$regex": "^instagram$", "$options": "i"}}).limit(500))

    documents = reddit_docs + x_docs + telegram_docs + youtube_docs + facebook_docs + instagram_docs

    print(f"[DEBUG] Reddit: {len(reddit_docs)} | X: {len(x_docs)} | Telegram: {len(telegram_docs)} | YouTube: {len(youtube_docs)}")

    valid_documents = [doc for doc in documents if (doc.get("text_content") or doc.get("content") or doc.get("text") or "").strip()]
    print(f"[DEBUG] Total valid posts to graph: {len(valid_documents)}")

    if not valid_documents:
        print("[-] No valid documents found.")
        mongo_client.close()
        return 0

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("RETURN 1")
    except Exception as e:
        print(f"[!] CRITICAL: Cannot connect to Neo4j. Error: {e}")
        mongo_client.close()
        return 0

    print("[*] Clearing existing graph data...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Building massive semantic graph...")
    with driver.session() as session:
        for doc in valid_documents:
            canonical_id = doc.get("canonical_id") or doc.get("post_id") or f"{doc.get('platform', 'unk')}_{str(doc.get('_id'))}"
            platform = (doc.get("platform") or "UNKNOWN").upper()
            text = doc.get("text_content") or doc.get("content") or doc.get("text") or ""

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
        try:
            with driver.session() as session:
                session.run("MATCH (n) WITH n, count { MATCH (n)--() } AS degree SET n.degreeCentrality = degree")
            print("[+] Basic Degree Centrality computed.")
        except Exception as e:
            print(f"[!] Degree centrality note: {e}")

    driver.close()

    # Also build user interaction edges
    try:
        build_user_edges(mongo_client[DB_NAME])
    except Exception as e:
        print(f"[!] Error building user edges: {e}")

    mongo_client.close()
    print("[+] Massive Semantic Knowledge Graph successfully built!")
    print("[*] Open http://localhost:7474 to visualize.")
    return len(valid_documents)

def get_doc_author(doc):
    """Resolves author id/username cleanly across diverse platform schemas."""
    if not doc:
        return None
    return (
        doc.get("author_id")
        or (doc.get("metadata") or {}).get("channel")
    )

def build_user_edges(db, docs=None):
    """
    Creates (:User {id})-[:REPLIED_TO {post_id, ts, platform}]->(:User),
    (:User)-[:REPOSTED {post_id, ts, platform}]->(:User),
    and (:User)-[:FORWARDED_FROM {post_id, ts, platform}]->(:User).
    Uses batched UNWIND with MERGE so re-runs are idempotent.
    Adds uniqueness constraints on User.id.
    Resolves parent post author if reply_to_author or repost_of_author is missing.
    """
    print("[*] Building User-to-User interaction edges...")
    collection = db[COLLECTION_NAME]

    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        with driver.session() as session:
            session.run("RETURN 1")
    except Exception as e:
        print(f"[!] Warning: Cannot connect to Neo4j in build_user_edges ({e}). Continuing.")
        return 0

    # Ensure uniqueness constraint on User.id
    try:
        with driver.session() as session:
            session.run("CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE")
    except Exception:
        try:
            with driver.session() as session:
                session.run("CREATE CONSTRAINT ON (u:User) ASSERT u.id IS UNIQUE")
        except Exception:
            pass

    # Query all posts with interaction indicators if docs not provided
    if docs is None:
        interaction_query = {
            "$or": [
                {"reply_to_author": {"$ne": None}},
                {"parent_id": {"$ne": None}},
                {"forwarded_from": {"$ne": None}},
                {"repost_of_author": {"$ne": None}},
                {"repost_of": {"$ne": None}}
            ]
        }
        docs = list(collection.find(interaction_query))
    else:
        # Filter provided docs for interaction cues
        docs = [
            d for d in docs
            if d.get("reply_to_author") or d.get("parent_id")
            or d.get("forwarded_from") or d.get("repost_of_author") or d.get("repost_of")
        ]
    print(f"[*] Found {len(docs)} documents with user interaction cues.")

    reply_batch = []
    forward_batch = []
    repost_batch = []
    parent_author_cache = {}

    for doc in docs:
        src_user = get_doc_author(doc)
        if not src_user:
            continue

        platform = (doc.get("platform") or "unknown").lower()
        post_id = doc.get("canonical_id") or doc.get("post_id") or doc.get("native_id") or str(doc.get("_id"))
        ts = doc.get("created_at") or doc.get("published_at") or doc.get("ingested_at") or datetime.now(timezone.utc).isoformat()

        # 1. Forwarded edges
        fwd_user = doc.get("forwarded_from")
        if fwd_user and str(fwd_user) != str(src_user):
            forward_batch.append({
                "source_id": str(src_user),
                "target_id": str(fwd_user),
                "post_id": str(post_id),
                "ts": str(ts),
                "platform": str(platform)
            })

        # 2. Reply edges
        tgt_user = doc.get("reply_to_author")
        if not tgt_user and doc.get("parent_id"):
            parent_id = doc.get("parent_id")
            if parent_id not in parent_author_cache:
                parent_doc = collection.find_one({
                    "$or": [
                        {"post_id": parent_id},
                        {"canonical_id": parent_id},
                        {"native_id": parent_id}
                    ]
                })
                parent_author_cache[parent_id] = get_doc_author(parent_doc) if parent_doc else None
            tgt_user = parent_author_cache.get(parent_id)

        if tgt_user and str(tgt_user) != str(src_user):
            reply_batch.append({
                "source_id": str(src_user),
                "target_id": str(tgt_user),
                "post_id": str(post_id),
                "ts": str(ts),
                "platform": str(platform)
            })

        # 3. Repost edges
        repost_tgt = doc.get("repost_of_author")
        if not repost_tgt and doc.get("repost_of"):
            repost_id = doc.get("repost_of")
            if repost_id not in parent_author_cache:
                parent_doc = collection.find_one({
                    "$or": [
                        {"post_id": repost_id},
                        {"canonical_id": repost_id},
                        {"native_id": repost_id}
                    ]
                })
                parent_author_cache[repost_id] = get_doc_author(parent_doc) if parent_doc else None
            repost_tgt = parent_author_cache.get(repost_id)

        if repost_tgt and str(repost_tgt) != str(src_user):
            repost_batch.append({
                "source_id": str(src_user),
                "target_id": str(repost_tgt),
                "post_id": str(post_id),
                "ts": str(ts),
                "platform": str(platform)
            })

    total_edges = 0
    BATCH_SIZE = 500

    cypher_replies = """
    UNWIND $batch AS row
    MERGE (src:User {id: row.source_id})
    MERGE (tgt:User {id: row.target_id})
    MERGE (src)-[r:REPLIED_TO {post_id: row.post_id}]->(tgt)
    SET r.ts = row.ts, r.platform = row.platform
    """

    cypher_forwards = """
    UNWIND $batch AS row
    MERGE (src:User {id: row.source_id})
    MERGE (tgt:User {id: row.target_id})
    MERGE (src)-[r:FORWARDED_FROM {post_id: row.post_id}]->(tgt)
    SET r.ts = row.ts, r.platform = row.platform
    """

    cypher_reposts = """
    UNWIND $batch AS row
    MERGE (src:User {id: row.source_id})
    MERGE (tgt:User {id: row.target_id})
    MERGE (src)-[r:REPOSTED {post_id: row.post_id}]->(tgt)
    SET r.ts = row.ts, r.platform = row.platform
    """

    with driver.session() as session:
        for i in range(0, len(reply_batch), BATCH_SIZE):
            chunk = reply_batch[i:i + BATCH_SIZE]
            session.run(cypher_replies, batch=chunk)
            total_edges += len(chunk)

        for i in range(0, len(forward_batch), BATCH_SIZE):
            chunk = forward_batch[i:i + BATCH_SIZE]
            session.run(cypher_forwards, batch=chunk)
            total_edges += len(chunk)

        for i in range(0, len(repost_batch), BATCH_SIZE):
            chunk = repost_batch[i:i + BATCH_SIZE]
            session.run(cypher_reposts, batch=chunk)
            total_edges += len(chunk)

    driver.close()
    print(f"[+] build_user_edges complete: {total_edges} edges merged ({len(reply_batch)} replies, {len(forward_batch)} forwards, {len(repost_batch)} reposts).")
    return total_edges
=======
        print(f"[!] Error building knowledge graph: {e}")
    finally:
        mongo_client.close()
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd

if __name__ == "__main__":
    build_knowledge_graph()
