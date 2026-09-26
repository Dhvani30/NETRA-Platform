import os
import spacy
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from neo4j import GraphDatabase

# --- ROBUST PATH RESOLUTION ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables securely
load_dotenv(dotenv_path=ENV_FILE)

# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")

def build_knowledge_graph():
    print("[*] Starting NETRA Knowledge Graph Builder...")
    
    # 1. Connect to MongoDB
    mongo_client = MongoClient(MONGO_URI)
    collection = mongo_client[DB_NAME][COLLECTION_NAME]
    documents = list(collection.find({"text_content": {"$ne": ""}}))
    
    if not documents:
        print("[-] No documents found. Exiting.")
        return

    print(f"[+] Loaded {len(documents)} documents for entity extraction.")

    # 2. Initialize NLP Model (Lightweight)
    print("[*] Loading spaCy NLP model...")
    nlp = spacy.load("en_core_web_sm")

    # 3. Connect to Neo4j
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    print("[*] Clearing existing graph data (for clean demo)...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Extracting entities and building graph relationships...")
    with driver.session() as session:
        for doc in documents:
            post_id = doc.get("canonical_id", "unknown")
            platform = doc.get("platform", "unknown")
            text = doc.get("text_content", "")
            
            # Create the Post Node
            session.run(
                "MERGE (p:Post {id: $id, platform: $platform}) "
                "SET p.text = substring($text, 0, 100) + '...'",
                id=post_id, platform=platform, text=text
            )
            
            # Extract Entities using spaCy
            spacy_doc = nlp(text)
            for ent in spacy_doc.ents:
                # Focus on Organizations, Locations, and geopolitical entities
                if ent.label_ in ["ORG", "GPE", "PERSON", "PRODUCT"]:
                    entity_name = ent.text.strip().upper()
                    entity_type = ent.label_
                    
                    # Create Entity Node and Relationship
                    session.run(
                        "MERGE (e:Entity {name: $name, type: $type}) "
                        "MERGE (p:Post {id: $post_id}) "
                        "MERGE (p)-[:MENTIONS]->(e)",
                        name=entity_name, type=entity_type, post_id=post_id
                    )

    driver.close()
    print("[+] Knowledge Graph successfully built in Neo4j!")
    print("[*] Open http://localhost:7474 in your browser to visualize the graph.")

if __name__ == "__main__":
    build_knowledge_graph()
    