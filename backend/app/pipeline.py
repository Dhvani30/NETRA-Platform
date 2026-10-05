import os
import sys
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from pymongo import MongoClient
from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ROOT_DIR = BACKEND_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"

# Ensure backend directory is in sys.path
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Load environment variables from .env file
load_dotenv(dotenv_path=ROOT_DIR / ".env")

# --- Configuration (Read from Environment Variables) ---
<<<<<<< HEAD
# NOTE: Ensure your .env points to your MongoDB Atlas cluster where your private scraper writes data.
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password123")
=======
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")
DATABASE_URL = os.getenv("DATABASE_URL", "") # Required for PostgreSQL graph
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd

def run_command(script_name):
    print(f"\n[*] Running {script_name}...")
    try:
        script_path = APP_DIR / script_name if not os.path.isabs(script_name) else script_name
<<<<<<< HEAD
        result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
=======
        
        # 🚨 CRITICAL FIX: Run the subprocess from the BACKEND_DIR 
        # so that "app" imports (like app.graph_db) resolve correctly.
        result = subprocess.run(
            [sys.executable, str(script_path)], 
            cwd=str(BACKEND_DIR),  # <--- THIS IS THE FIX
            capture_output=True, 
            text=True
        )
        
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
        if result.returncode == 0:
            print(f"[+] {script_name} completed successfully.")
        else:
            print(f"[!] {script_name} had issues, but we will continue.")
            print(result.stderr)
    except Exception as e:
        print(f"[X] Failed to run {script_name}: {e}")

def check_real_data():
    """Check and report the amount of real data ingested by the external scraper."""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        total_count = collection.count_documents({})
        print(f"[✅] Found {total_count} total documents in MongoDB '{COLLECTION_NAME}'.")
        
        if total_count == 0:
            print("[!] WARNING: Database is empty. Ensure your external scraper is running and writing to this MongoDB Atlas cluster.")
        else:
            print("[✅] Real data detected. Proceeding with graph sync...")
            
        client.close()
    except Exception as e:
        print(f"[X] Failed to connect to MongoDB: {e}")
        print("Please check your MONGO_URI in the .env file.")

def main():
    print("🚀 STARTING NETRA AUTOMATED PIPELINE (READ-ONLY MODE) 🚀")
    print("="*60)
    print(f" MongoDB URI: {MONGO_URI[:45]}... (Atlas Cloud)")
    print(f" Database: {DB_NAME}")
    print(f" Collection: {COLLECTION_NAME}")
<<<<<<< HEAD
    print(f" Neo4j URI: {NEO4J_URI}")
=======
    print(f" Graph DB: PostgreSQL (DATABASE_URL)")
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
    print("="*60)
    
    # 1. Check for real data from external scraper
    check_real_data()
    
    # 2. Run AI Analytics (OPTIONAL)
<<<<<<< HEAD
    # NOTE: Only run this if your external scraper does NOT already calculate 
    # 'sentiment_label' and 'narrative_name' before writing to MongoDB.
    if os.path.exists("analytic_engine.py"):
        print("\n[ℹ️] Running analytic_engine.py to ensure sentiment/narratives are processed...")
        run_command("analytic_engine.py")
        
    # 3. Build/Update Neo4j Graph (CRUCIAL)
    # This reads the real MongoDB data and builds the Network Graph for the dashboard.
    if os.path.exists("graph_builder.py"):
        print("\n[ℹ️] Syncing MongoDB data to Neo4j Graph Database...")
=======
    if os.path.exists(APP_DIR / "analytic_engine.py"):
        print("\n[ℹ️] Running analytic_engine.py to ensure sentiment/narratives are processed...")
        run_command("analytic_engine.py")
        
    # 3. Build/Update PostgreSQL Graph (CRUCIAL)
    if os.path.exists(APP_DIR / "graph_builder.py"):
        print("\n[ℹ️] Syncing MongoDB data to PostgreSQL graph database...")
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
        run_command("graph_builder.py")
        
    print("\n" + "="*60)
    print("✅ PIPELINE COMPLETE! Dashboard is ready with live data.")
    print("Starting Backend and Frontend servers...")
    print("="*60)
    
    # 4. Start Backend
    print("🔄 Starting FastAPI Backend on port 8000...")
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    subprocess.Popen(["python", "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], cwd=backend_dir)
    
    time.sleep(3) # Wait for backend to initialize
    
    # 5. Start Frontend
    print("🔄 Starting React Frontend on port 5173...")
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
    subprocess.Popen("npm run dev", cwd=frontend_dir, shell=True)
    
<<<<<<< HEAD
    print("\n🌟 NETRA is fully live! Open http://localhost:5173")
=======
    print("\n🌟 NETRA is fully live! Open http://localhost:5173 or http://localhost:5174")
>>>>>>> a8ead338865215b43923c72005cc9123ace1e9bd
    print("💡 Tip: To update the graph with newly scraped data, just run this pipeline.py again.")
    input("\nPress Enter to stop all services...")

if __name__ == "__main__":
    main()