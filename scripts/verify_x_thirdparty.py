import os
import sys
import json
from pathlib import Path
from collections import Counter
from dotenv import load_dotenv
from pymongo import MongoClient

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

BACKEND_DIR = BASE_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.collectors.x_thirdparty_ingestor import ingest_x_thirdparty

def main():
    print("==================================================")
    print("  NETRA X Third-Party Collector Live Verification  ")
    print("==================================================")

    db = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "social_intel")]

    # Run collector once with real key
    result = ingest_x_thirdparty(target_db=db)

    print(f"\nStatus: {result.get('status')}")
    print(f"Tweets inserted: {result.get('count', 0)}")
    print(f"API calls made: {result.get('api_calls', 0)}")
    print(f"Budget used: {result.get('budget_used', 0)} / {result.get('budget_limit', 300)}")
    print(f"Estimated cost (USD): ${result.get('estimated_cost_usd', 0.0):.6f}")

    # Inspect documents stored in raw_posts for LIVE_THIRD_PARTY
    docs = list(db.raw_posts.find({"platform": "x", "source_mode": "LIVE_THIRD_PARTY"}).sort("ingested_at", -1).limit(50))

    event_counts = Counter(d.get("event_type", "unknown") for d in docs)
    print(f"\nEvent type counts (latest {len(docs)} documents): {dict(event_counts)}")

    reply_to_author_count = sum(1 for d in docs if d.get("reply_to_author"))
    print(f"Documents with reply_to_author: {reply_to_author_count} / {len(docs)}")

    if docs:
        sample = dict(docs[0])
        # Format for readable output and remove mongo _id
        sample.pop("_id", None)
        print("\nOne sample document:")
        print(json.dumps(sample, indent=2, default=str))

    print("\nVerification complete.")

if __name__ == "__main__":
    main()
