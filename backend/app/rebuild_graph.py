import os
from pathlib import Path
from dotenv import load_dotenv
from neo4j import GraphDatabase
from pymongo import MongoClient
from datetime import datetime

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

# Connect to databases
mongo_client = MongoClient(MONGO_URI)
mongo_db = mongo_client[DB_NAME]
posts = mongo_db[COLLECTION_NAME]

neo4j_driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

def rebuild_graph():
    with neo4j_driver.session() as session:
        # Clear existing data
        print("[🗑️] Clearing existing Neo4j data...")
        session.run("MATCH (n) DETACH DELETE n")
        
        # Fetch posts from MongoDB
        print("[] Fetching posts from MongoDB...")
        all_posts = list(posts.find({}))
        
        print(f"[] Processing {len(all_posts)} posts...")
        
        for i, post in enumerate(all_posts):
            if i % 10 == 0:
                print(f"  Processing post {i}/{len(all_posts)}")
            
            # Extract data
            post_id = post.get("canonical_id", f"post_{i}")
            platform = post.get("platform", "unknown")
            text = post.get("text_content") or post.get("content") or ""
            narrative = post.get("narrative_name") or f"Narrative_{post.get('narrative_cluster', 0)}"
            sentiment = post.get("sentiment_label", "UNKNOWN")
            
            # Create Post node
            session.run("""
                MERGE (p:Post {id: $post_id})
                SET p.text = $text,
                    p.platform = $platform,
                    p.sentiment = $sentiment,
                    p.published_at = $published_at
            """, {
                "post_id": post_id,
                "text": text[:200] if text else "",
                "platform": platform.upper(),
                "sentiment": sentiment,
                "published_at": post.get("published_at", "")
            })
            
            # Create Narrative node and link
            if narrative:
                session.run("""
                    MERGE (n:Narrative {name: $narrative})
                    MERGE (p:Post {id: $post_id})
                    MERGE (p)-[:PART_OF]->(n)
                """, {"narrative": narrative, "post_id": post_id})
            
            # Extract and create entities
            text_lower = text.lower()
            entities = {
                "Cisco": ["cisco"],
                "CERT-In": ["cert-in", "cert in"],
                "India": ["india"],
                "China": ["china"],
                "RBI": ["rbi", "reserve bank"],
                "SEBI": ["sebi"],
                "SBI": ["sbi", "state bank"],
                "Microsoft": ["microsoft"],
                "Google": ["google"],
                "NATO": ["nato"],
                "Parliament": ["parliament"]
            }
            
            for entity_name, keywords in entities.items():
                if any(kw in text_lower for kw in keywords):
                    session.run("""
                        MERGE (e:Organization {name: $entity})
                        MERGE (p:Post {id: $post_id})
                        MERGE (p)-[:MENTIONS]->(e)
                    """, {"entity": entity_name, "post_id": post_id})
            
            # Create Platform node and link
            session.run("""
                MERGE (plat:Platform {name: $platform})
                MERGE (p:Post {id: $post_id})
                MERGE (p)-[:POSTED_ON]->(plat)
            """, {"platform": platform.upper(), "post_id": post_id})
        
        print("[✅] Graph rebuild complete!")
        print(f"   Created {len(all_posts)} Post nodes")
        print("   Created Narrative, Organization, and Platform nodes")
        print("   Established relationships")

if __name__ == "__main__":
    rebuild_graph()