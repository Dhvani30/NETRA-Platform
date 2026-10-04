import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
import hashlib
from app.schema import empty_metrics
from app.core.env_utils import get_clean_env, is_source_enabled

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_FILE)

MONGO_URI = get_clean_env("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = get_clean_env("DB_NAME", "social_intel")
COLLECTION_NAME = get_clean_env("COLLECTION_NAME", "raw_posts")

REDDIT_CLIENT_ID = get_clean_env("REDDIT_CLIENT_ID", "")
REDDIT_CLIENT_SECRET = get_clean_env("REDDIT_CLIENT_SECRET", "")
REDDIT_USER_AGENT = get_clean_env("REDDIT_USER_AGENT", "NETRAIntelligencePlatform/1.0")

SUBREDDITS = [
    "cybersecurity",
    "geopolitics",
    "technology",
    "artificial",
    "OSINT",
    "defence",
    "india"
]

def init_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    collection.create_index("canonical_id", unique=True)
    return collection

def hid(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value else None

def ingest_reddit_posts():
    if not is_source_enabled("reddit"):
        print("[!] Reddit collector disabled in this build.")
        return 0

    if not REDDIT_CLIENT_ID or not REDDIT_CLIENT_SECRET:
        print("[!] REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET missing in .env. Skipping live Reddit ingestion.")
        return 0

    try:
        import praw
    except ImportError:
        print("[!] PRAW library not installed. Install via 'pip install praw' for live Reddit ingestion.")
        return 0

    print("[*] Starting Real Reddit PRAW Ingestion...")
    collection = init_db()
    total_ingested = 0

    try:
        reddit = praw.Reddit(
            client_id=REDDIT_CLIENT_ID,
            client_secret=REDDIT_CLIENT_SECRET,
            user_agent=REDDIT_USER_AGENT
        )

        for sub_name in SUBREDDITS:
            try:
                subreddit = reddit.subreddit(sub_name)
                for post in subreddit.hot(limit=5):
                    if post.stickied:
                        continue

                    post_id = post.id
                    canonical_id = f"reddit:{sub_name}:{post_id}"
                    published_at = datetime.fromtimestamp(post.created_utc, tz=timezone.utc).isoformat()

                    doc = {
                        "canonical_id": canonical_id,
                        "platform": "reddit",
                        "post_id": post_id,
                        "native_id": post_id,
                        "event_type": "post",
                        "parent_id": None,
                        "author_id": hid(str(post.author or "deleted")),
                        "reply_to_author": None,
                        "text": f"{post.title} | {post.selftext[:400]}",
                        "text_content": f"{post.title} | {post.selftext[:400]}",
                        "created_at": published_at,
                        "published_at": published_at,
                        "ingested_at": datetime.now(timezone.utc).isoformat(),
                        "lang": None,
                        "hashtags": [], "mentions": [], "urls": [],
                        "url": f"https://reddit.com{post.permalink}",
                        "metrics": empty_metrics(likes=post.score, replies=post.num_comments),
                        "metadata": {
                            "source_mode": "LIVE",
                            "subreddit": sub_name,
                            "upvote_ratio": post.upvote_ratio
                        },
                        "source_mode": "LIVE",
                        "dataset": None,
                        "source_file": None,
                        "processed": False
                    }

                    collection.update_one(
                        {"canonical_id": canonical_id},
                        {"$set": doc},
                        upsert=True
                    )
                    total_ingested += 1
                    print(f"  [+] Ingested r/{sub_name}: '{post.title[:50]}...'")

            except Exception as sub_err:
                print(f"  [!] Error fetching r/{sub_name}: {sub_err}")

    except Exception as e:
        print(f"[!] PRAW authentication/network error: {e}")

    print(f"[+] Reddit ingestion cycle complete. Total posts processed/updated: {total_ingested}.")
    return total_ingested

def main():
    once = "--once" in sys.argv
    if once:
        ingest_reddit_posts()
    else:
        print("[*] Running Reddit Collector daemon (every hour)...")
        while True:
            ingest_reddit_posts()
            print("[*] Sleeping for 1 hour (3600s)...")
            time.sleep(3600)

if __name__ == "__main__":
    main()
