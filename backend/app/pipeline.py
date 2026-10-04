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

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "social_intel")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")

def run_command(script_name):
    print(f"\n[*] Running {script_name}...")
    try:
        script_path = APP_DIR / script_name if not os.path.isabs(script_name) else script_name
        result = subprocess.run([sys.executable, str(script_path)], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[+] {script_name} completed successfully.")
        else:
            print(f"[!] {script_name} had issues, but we will continue.")
            print(result.stderr)
    except Exception as e:
        print(f"X Failed to run {script_name}: {e}")

def check_database_status():
    """Reports current database state without modifying or auto-injecting data."""
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        total_count = collection.count_documents({})
        real_count = collection.count_documents({"$or": [{"metadata.source_mode": "REAL"}, {"metadata.source_mode": "LIVE"}]})
        synthetic_count = collection.count_documents({"metadata.source_mode": "SYNTHETIC"})

        print(f"[+] Database Check: {total_count} total posts ({real_count} REAL/LIVE, {synthetic_count} SYNTHETIC).")
        if total_count == 0:
            print("[i] Database is empty. To populate initial seed data safely, run: python app/seed_diverse_data.py --confirm")
    except Exception as e:
        print(f"[!] Database check warning: {e}")

def main():
    once_mode = "--once" in sys.argv
    print("=" * 60)
    print(f" STARTING NETRA PIPELINE ({'ONE-SHOT MODE' if once_mode else 'CONTINUOUS SCHEDULER MODE'})")
    print("=" * 60)
    print(f" MongoDB URI: {MONGO_URI[:50]}...")
    print(f" Database: {DB_NAME}")
    print(f" Neo4j URI: {NEO4J_URI}")
    print("=" * 60)

    # 1. Check Data Status
    check_database_status()

    scheduler = None
    if once_mode:
        # Legacy one-shot sequence
        if (APP_DIR / "analytic_engine.py").exists():
            run_command("analytic_engine.py")
        if (APP_DIR / "graph_builder.py").exists():
            run_command("graph_builder.py")
    else:
        # Continuous sequence: launch APScheduler
        try:
            from app.scheduler import start_scheduler
            scheduler = start_scheduler()
            print("[+] Continuous Background Scheduler running (Telegram, Reddit, YouTube, Analytics, Graph).")
        except Exception as e:
            print(f"[!] Could not start APScheduler: {e}")

    print("\n" + "=" * 60)
    print("Starting Backend and Frontend servers...")

    backend_proc = None
    frontend_proc = None
    try:
        # Start Backend (FastAPI on :8000)
        print(" Starting FastAPI Backend on port 8000...")
        backend_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app", "--reload", "--port", "8000"],
            cwd=str(BACKEND_DIR)
        )
        time.sleep(2)  # Wait for backend to initialize

        # Start Frontend (Vite on :5173)
        if FRONTEND_DIR.exists():
            print(" Starting React Frontend on port 5173...")
            frontend_proc = subprocess.Popen("npm run dev", cwd=str(FRONTEND_DIR), shell=True)

        print("\n NETRA is live! Dashboard available at: http://localhost:5173")
        print(" FastAPI Swagger documentation: http://localhost:8000/docs")
        try:
            input("Press Enter to stop all services...\n")
        except (KeyboardInterrupt, EOFError):
            pass
    except KeyboardInterrupt:
        print("\nStopping services...")
    finally:
        if scheduler:
            try:
                scheduler.shutdown(wait=False)
                print("[*] Scheduler stopped.")
            except Exception:
                pass
        if backend_proc:
            backend_proc.terminate()
        if frontend_proc:
            frontend_proc.terminate()
        print("[*] All NETRA services shutdown.")

if __name__ == "__main__":
    main()