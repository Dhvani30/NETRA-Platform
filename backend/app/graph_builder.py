import os
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
    
    # Fetch ONLY processed documents (ensures AI analysis is complete)
    documents = list(collection.find({
        "processed": True,
        "text_content": {"$ne": ""}
    }))
    
    if not documents:
        print("[-] No processed documents found. Run the AI Analytics Engine first!")
        return

    print(f"[+] Loaded {len(documents)} processed documents for graph building.")

    # 2. Connect to Neo4j
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    
    print("[*] Clearing existing graph data (ensuring clean demo state)...")
    with driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")

    print("[*] Building Author, Post, and Topic nodes with relationships...")
    with driver.session() as session:
        for doc in documents:
            post_id = doc.get("canonical_id", "unknown")
            platform = doc.get("platform", "unknown")
            author = doc.get("author_username", doc.get("author_id", "anonymous"))
            text = doc.get("text_content", "")
            cluster = doc.get("narrative_cluster", -1)
            sentiment = doc.get("ai_analysis", {}).get("sentiment_label", "NEUTRAL")
            
            # 1. Create/Update Author Node
            session.run(
                "MERGE (a:Author {username: $author, platform: $platform}) "
                "ON CREATE SET a.created_at = datetime()",
                author=author, platform=platform
            )
            
            # 2. Create Post Node
            session.run(
                "MERGE (p:Post {id: $id}) "
                "SET p.platform = $platform, p.text = $text, p.sentiment = $sentiment",
                id=post_id, platform=platform, text=text[:200], sentiment=sentiment
            )
            
            # 3. Create Relationship: Author -> POSTED -> Post
            session.run(
                "MATCH (a:Author {username: $author, platform: $platform}) "
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (a)-[:POSTED]->(p)",
                author=author, platform=platform, post_id=post_id
            )
            
            # 4. Create Topic Node and Relationship: Post -> BELONGS_TO -> Topic
            topic_name = f"Cluster_{cluster}" if cluster != -1 else "Uncategorized"
            session.run(
                "MATCH (p:Post {id: $post_id}) "
                "MERGE (t:Topic {name: $topic_name, cluster_id: $cluster}) "
                "MERGE (p)-[:BELONGS_TO]->(t)",
                topic_name=topic_name, cluster=cluster, post_id=post_id
            )

    print("[*] Computing Network Centrality Metrics...")
    try:
        with driver.session() as session:
            # Project the graph for Neo4j Graph Data Science (GDS) library
            session.run("""
                CALL gds.graph.project(
                    'netra_graph',
                    ['Author', 'Post', 'Topic'],
                    {
                        POSTED: {orientation: 'UNDIRECTED'},
                        BELONGS_TO: {orientation: 'UNDIRECTED'}
                    }
                )
            """)
            
            # Compute PageRank (Identifies High-Reach / Key Opinion Leaders)
            print("  -> Computing PageRank...")
            session.run("""
                CALL gds.pageRank.write('netra_graph', {
                    writeProperty: 'pageRankScore',
                    maxIterations: 20,
                    dampingFactor: 0.85
                })
            """)
            
            # Compute Betweenness Centrality (Identifies Bridge Nodes connecting clusters)
            print("  -> Computing Betweenness Centrality...")
            session.run("""
                CALL gds.betweenness.write('netra_graph', {
                    writeProperty: 'betweennessScore'
                })
            """)
            
            # Drop the projected graph to free up RAM
            session.run("CALL gds.graph.drop('netra_graph')")
            print("[+] Advanced GDS metrics successfully computed!")
            
    except Exception as e:
        print(f"[!] Warning: Graph Data Science (GDS) library not available. Falling back to basic Degree Centrality.")
        print(f"   (To enable advanced metrics, add NEO4J_PLUGINS: [\"graph-data-science\"] to your docker-compose.yml)")
        
        with driver.session() as session:
            # FIXED: Neo4j 5.x syntax for counting relationships
            session.run("""
                MATCH (n)
                WITH n, count { MATCH (n)--() } AS degree
                SET n.degreeCentrality = degree
            """)
        print("[+] Basic Degree Centrality computed successfully!")

    driver.close()
    print("[+] Knowledge Graph successfully built and enriched in Neo4j!")
    print("[*] Open http://localhost:7474 in your browser to visualize the graph.")
    print("[*] Pro Tip: Run 'MATCH (n) RETURN n ORDER BY n.degreeCentrality DESC LIMIT 10' to see top influencers.")

if __name__ == "__main__":
    build_knowledge_graph()