import os
import json
import pymongo
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

# --- ROBUST PATH RESOLUTION ---
# Dynamically finds the root directory (D:\NETRA-Platform) based on this script's location
# __file__ is ...\backend\app\collectors\reddit_ingestor.py
# .parent = collectors -> app -> backend -> NETRA-Platform (Root)
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables from the root .env file
load_dotenv(dotenv_path=ENV_FILE)

# --- Configuration (STRICT: No hardcoded URLs) ---
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")
REPLAY_FILE = BASE_DIR / "data" / "raw" / "reddit_replay.jsonl"

# Fail Fast: If the URL is missing, stop immediately and tell the user where to look
if not MONGO_URI:
    raise ValueError(f"CRITICAL: MONGO_URI is not set in {ENV_FILE}!")

def init_db():
    client = pymongo.MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    collection.create_index("canonical_id", unique=True)
    return collection

def generate_high_volume_dataset():
    """Generates a robust, diverse dataset for AI processing."""
    base_time = datetime(2026, 9, 25, 12, 0, 0, tzinfo=timezone.utc)
    
    # 30 Realistic, Intelligence-Relevant Posts
    templates = [
        ("cybersecurity", "Critical zero-day in Cisco IOS", "Remote code execution vulnerability found in enterprise routers.", "sec_researcher", 450, 89),
        ("cybersecurity", "Ransomware gang targets healthcare", "New strain encrypts MRI machines, demands BTC.", "threat_intel", 890, 150),
        ("india", "New DPDP Act enforcement begins", "Government issues first round of penalties for data mishandling.", "policy_analyst", 1200, 340),
        ("india", "Digital India initiative expands", "New fiber optic cables laid in rural areas to boost connectivity.", "tech_journalist", 650, 120),
        ("worldnews", "UN cyber treaty negotiations stall", "Member states disagree on attribution of state-sponsored attacks.", "diplomatic_corps", 2100, 560),
        ("worldnews", "Global supply chain cyber disruption", "Major shipping logistics firm hit by coordinated DDoS.", "logistics_watch", 1500, 410),
        ("geopolitics", "South China Sea cyber ops", "Satellite imagery reveals new undersea cable tapping infrastructure.", "geo_strategist", 890, 210),
        ("geopolitics", "NATO announces cyber defense pact", "Article 5 now explicitly covers critical infrastructure attacks.", "defense_watch", 1100, 280),
        ("technology", "AI models running on edge devices", "New 7B parameter models run efficiently on standard smartphones.", "tech_enthusiast", 2100, 560),
        ("technology", "Quantum computing breaks RSA-2048", "Theoretical milestone achieved, practical application still years away.", "quantum_dev", 3500, 890),
        ("artificial", "LLMs weaponized for phishing", "AI-generated emails bypass traditional spam filters with 99% accuracy.", "ai_ethics", 670, 195),
        ("artificial", "Deepfake detection algorithms improve", "New neural network identifies synthetic media with 98% precision.", "ml_researcher", 540, 110),
        ("OSINT", "Coordinated disinformation network exposed", "Open source investigators trace bot network across 5 platforms.", "osint_analyst", 540, 87),
        ("OSINT", "Satellite imagery reveals military buildup", "Commercial SAR data shows new armored divisions at border.", "sat_intel", 780, 145),
        ("defence", "Military adopts zero-trust architecture", "Defense ministry mandates strict identity verification for all systems.", "defense_watch", 420, 95),
        ("defence", "Drone swarm tactics evolve", "New decentralized command protocols make jamming ineffective.", "tactical_analyst", 610, 130),
        ("cybersecurity", "Supply chain attack via npm package", "Malicious code injected into popular JavaScript library.", "app_sec", 920, 210),
        ("india", "Cyber command expands recruitment", "Indian Armed Forces looking for ethical hackers and cryptographers.", "recruiter_india", 340, 50),
        ("worldnews", "Global internet fragmentation accelerates", "More countries implementing sovereign internet gateways.", "net_policy", 1800, 450),
        ("geopolitics", "Arctic resource competition heats up", "New shipping routes require advanced cyber-physical security.", "arctic_watch", 410, 75),
        ("technology", "6G research begins in Japan", "Terahertz frequencies promise 1Tbps speeds but raise security concerns.", "telecom_eng", 890, 200),
        ("artificial", "Autonomous weapons ethics debate", "UN committee discusses banning fully autonomous lethal systems.", "ethics_board", 1500, 380),
        ("OSINT", "Leaked documents reveal surveillance program", "Whistleblower drops 10GB of internal memos on secure drop.", "leak_tracker", 2200, 600),
        ("defence", "Hypersonic missile defense tested", "New laser system successfully intercepts Mach 5 target.", "defense_tech", 1300, 290),
        ("cybersecurity", "Critical flaw in 5G core network", "Researchers demonstrate ability to intercept voice calls.", "5g_sec", 750, 160),
        ("india", "Startup ecosystem booms in Bangalore", "New cybersecurity unicorns emerge from IISc incubators.", "startup_watch", 560, 90),
        ("worldnews", "Global chip shortage eases", "New fabrication plants in US and EU come online.", "supply_chain", 980, 220),
        ("geopolitics", "Space force establishes orbital patrol", "New satellites designed to track and disable hostile assets.", "space_intel", 1100, 250),
        ("technology", "Neural interface breakthrough", "Brain-computer interface allows typing at 100 words per minute.", "neuro_tech", 2800, 700),
        ("artificial", "AI hallucinations cause financial crash", "Algorithmic trading bot misinterprets news, triggers flash crash.", "fin_tech", 1900, 480)
    ]

    data = []
    for i, (sub, title, text, author, score, comments) in enumerate(templates):
        # Stagger timestamps by 10 minutes to simulate a real timeline
        post_time = base_time + timedelta(minutes=i*10)
        data.append({
            "platform": "reddit",
            "native_id": f"mock_{i:04d}",
            "subreddit": sub,
            "title": title,
            "selftext": text,
            "author": author,
            "created_utc": int(post_time.timestamp()),
            "score": score,
            "num_comments": comments,
            "permalink": f"/r/{sub}/comments/mock_{i:04d}/"
        })
    return data

def run_replay_ingestor():
    print("[*] Starting NETRA Reddit REPLAY Ingestion Daemon...")
    print("[!] Note: Using deterministic replay layer due to Reddit API restrictions.")
    
    collection = init_db()
    REPLAY_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    if not REPLAY_FILE.exists():
        print(f"[*] Generating high-volume deterministic replay dataset at {REPLAY_FILE}...")
        sample_data = generate_high_volume_dataset()
        with open(REPLAY_FILE, 'w', encoding='utf-8') as f:
            for item in sample_data:
                f.write(json.dumps(item) + '\n')
        print(f"[+] Replay dataset generated with {len(sample_data)} posts.")

    print("[*] Processing replay dataset into Canonical Schema...")
    count = 0
    with open(REPLAY_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip(): continue
            post = json.loads(line)
            
            post_id = post.get('native_id', 'unknown')
            canonical_id = f"reddit:{post.get('subreddit', 'unknown')}:{post_id}"
            
            doc = {
                "canonical_id": canonical_id,
                "platform": "reddit",
                "native_id": post_id,
                "text_content": f"{post.get('title', '')}\n\n{post.get('selftext', '')[:500]}",
                "author_username": post.get('author', 'deleted'),
                "published_at": datetime.fromtimestamp(post.get('created_utc', 0), tz=timezone.utc).isoformat(),
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "url": f"https://reddit.com{post.get('permalink', '')}",
                "metrics": {
                    "upvotes": post.get('score', 0),
                    "comments": post.get('num_comments', 0)
                },
                "metadata": {
                    "subreddit": post.get('subreddit'),
                    "source_mode": "REPLAY"
                }
            }

            collection.update_one({"canonical_id": canonical_id}, {"$set": doc}, upsert=True)
            count += 1
            
    print(f"[+] Ingestion cycle complete. {count} posts processed/updated to MongoDB Atlas.")
    print("[*] Reddit pipeline is now ready for AI/Blockchain processing.")

if __name__ == "__main__":
    run_replay_ingestor()