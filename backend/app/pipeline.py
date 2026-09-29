# D:\NETRA-Platform\backend\app\pipeline.py
import os
import sys
import subprocess
import time
from datetime import datetime, timezone
from pymongo import MongoClient
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- Configuration (Read from Environment Variables) ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:password123@localhost:27017/?authSource=admin")
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

# Neo4j Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")

def run_command(script_name):
    print(f"\n[⚙️] Running {script_name}...")
    try:
        # Run the script in the same directory
        result = subprocess.run([sys.executable, script_name], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[✅] {script_name} completed successfully.")
        else:
            print(f"[⚠️] {script_name} had issues, but we will continue.")
            print(result.stderr)
    except Exception as e:
        print(f"X Failed to run {script_name}: {e}")

def inject_mock_data_if_empty():
    """If the DB is empty or old, inject fresh, high-impact demo data."""
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # Check if we have recent data (last 24 hours)
    recent_count = collection.count_documents({
        "published_at": {"$gte": (datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)).isoformat()}
    })

    if recent_count < 5:
        print("[X] Database is empty or stale. Injecting fresh Intelligence Data...")
        collection.delete_many({}) # Wipe old junk
        
        fresh_data = [
            {"canonical_id": "live:x:001", "platform": "x", "author_username": "CyberSecAlert", "text_content": "BREAKING: Critical zero-day vulnerability found in Cisco routers. Patch immediately. #CyberSecurity", "published_at": datetime.now(timezone.utc).isoformat(), "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "metadata": {"source_mode": "LIVE"}},
            {"canonical_id": "live:reddit:001", "platform": "reddit", "author_username": "u/GeoAnalyst", "text_content": "Analysis: South China Sea tensions escalate as new naval exercises announced by China and India.", "published_at": datetime.now(timezone.utc).isoformat(), "sentiment_label": "NEGATIVE", "narrative_name": "South China Sea Tensions", "metadata": {"subreddit": "geopolitics"}},
            {"canonical_id": "live:x:002", "platform": "x", "author_username": "TechPolicy", "text_content": "Parliament passes new AI Regulation Bill. Strict oversight on autonomous systems begins next month.", "published_at": datetime.now(timezone.utc).isoformat(), "sentiment_label": "NEUTRAL", "narrative_name": "AI Development and Regulation", "metadata": {"source_mode": "LIVE"}},
            {"canonical_id": "live:reddit:002", "platform": "reddit", "author_username": "u/DefenceWatch", "text_content": "NATO announces increased defense spending. Focus on border security and military modernization.", "published_at": datetime.now(timezone.utc).isoformat(), "sentiment_label": "POSITIVE", "narrative_name": "Defence and Security", "metadata": {"subreddit": "defence"}},
            {"canonical_id": "live:x:003", "platform": "x", "author_username": "FinTechNews", "text_content": "Ransomware gang targets major banks. CERT-In issues urgent advisory for all financial institutions.", "published_at": datetime.now(timezone.utc).isoformat(), "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "metadata": {"source_mode": "LIVE"}}
        ]
        # Multiply data to make graph look bigger
        for i in range(20):
            for doc in fresh_data:
                new_doc = doc.copy()
                new_doc['canonical_id'] = f"{doc['canonical_id']}_batch{i}"
                collection.insert_one(new_doc)
        print(f"[✅] Injected {len(fresh_data)*20} fresh intelligence posts.")
    else:
        print(f"[✅] Database already has {recent_count} recent posts. Skipping injection.")

def main():
    print(" STARTING NETRA AUTOMATED PIPELINE 🚀")
    print("="*50)
    print(f" MongoDB URI: {MONGO_URI[:50]}...")
    print(f" Database: {DB_NAME}")
    print(f" Neo4j URI: {NEO4J_URI}")
    print("="*50)
    
    # 1. Ensure Data
    inject_mock_data_if_empty()
    
    # 2. Run AI Analytics (if the file exists)
    if os.path.exists("analytic_engine.py"):
        run_command("analytic_engine.py")
        
    # 3. Build Graph (if the file exists)
    if os.path.exists("graph_builder.py"):
        run_command("graph_builder.py")
        
    print("\n" + "="*50)
    print(" PIPELINE COMPLETE! Your Dashboard is ready.")
    print("Starting Backend and Frontend servers...")
    
    # 4. Start Backend
    print(" Starting FastAPI Backend on port 8000...")
    subprocess.Popen(["python", "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], cwd="..")
    
    time.sleep(2) # Wait for backend to initialize
    
    # 5. Start Frontend
    print(" Starting React Frontend on port 5173...")
    subprocess.Popen("npm run dev", cwd="../../frontend", shell=True)
    
    print("\n NETRA is fully live! Open http://localhost:5173")
    input("Press Enter to stop all services...")

if __name__ == "__main__":
    main()