"""
NETRA Platform - Diverse Data Seeder
Generates realistic, varied social media intelligence data with natural distributions.
"""
import random
import uuid
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient
import hashlib

import os
import sys
from dotenv import load_dotenv
from app.schema import empty_metrics

load_dotenv()

# --- Configuration ---
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = "social_intel"
COLLECTION_NAME = "raw_posts"

# Chaotic, non-linear narrative distributions (Real data has spikes and dips!)
NARRATIVES = {
    "Cyber Attack": {"weight": 28, "platforms": ["X", "Reddit", "YouTube"]},
    "AI Development and Regulation": {"weight": 42, "platforms": ["X", "Reddit", "YouTube"]}, # Spike!
    "Defence and Security": {"weight": 15, "platforms": ["X", "Reddit"]},
    "Financial Technology": {"weight": 35, "platforms": ["X", "Reddit", "YouTube"]}, # Another spike!
    "South China Sea Tensions": {"weight": 22, "platforms": ["X", "Reddit"]},
    "Startup Ecosystem": {"weight": 18, "platforms": ["X", "Reddit", "YouTube"]}
}

SENTIMENTS = ["POSITIVE", "NEGATIVE", "NEUTRAL"]

CONTENT_TEMPLATES = {
    "Cyber Attack": [
        "New vulnerability discovered in {entity} systems. Experts warn of potential ransomware attacks.",
        "Major data breach at {entity}. Millions of records exposed in sophisticated cyber attack.",
        "CERT-In issues warning about {entity} targeting critical infrastructure.",
        "Ransomware group claims responsibility for attack on {entity}. Demand: $50M in cryptocurrency.",
        "Zero-day exploit in {entity} software being actively exploited in the wild."
    ],
    "AI Development and Regulation": [
        "New AI regulations proposed for {entity}. Tech industry pushes back.",
        "{entity} announces breakthrough in artificial intelligence research.",
        "EU AI Act impacts {entity} operations. Compliance deadline set for 2026.",
        "Debate intensifies over {entity} AI ethics and transparency.",
        "{entity} releases new AI model, raising concerns about job displacement."
    ],
    "Defence and Security": [
        "{entity} conducts military exercises near disputed border.",
        "New defense pact signed between nations. {entity} plays key role.",
        "{entity} announces increase in defense budget amid regional tensions.",
        "Intelligence report highlights {entity} capabilities in cyber warfare.",
        "{entity} deploys advanced missile defense systems."
    ],
    "Financial Technology": [
        "{entity} launches new digital payment platform. Competition heats up.",
        "RBI issues new guidelines for {entity} fintech operations.",
        "{entity} reports record growth in digital transactions.",
        "Blockchain integration by {entity} revolutionizes banking sector.",
        "{entity} faces scrutiny over data privacy in financial services."
    ],
    "South China Sea Tensions": [
        "{entity} naval vessels spotted in disputed waters.",
        "Diplomatic tensions rise as {entity} asserts territorial claims.",
        "{entity} conducts joint military drills with allies in South China Sea.",
        "International court ruling on {entity} maritime boundaries ignored.",
        "{entity} builds new military installations on artificial islands."
    ],
    "Startup Ecosystem": [
        "{entity} secures $100M in Series C funding. Valuation soars.",
        "New unicorn emerges: {entity} reaches $1B valuation.",
        "{entity} announces expansion into international markets.",
        "Startup {entity} disrupts traditional industry with innovative solution.",
        "{entity} faces challenges as market conditions tighten."
    ]
}

ENTITIES = [
    "Cisco", "Microsoft", "Google", "CERT-In", "RBI", "SBI", "HDFC",
    "NATO", "China", "India", "USA", "Parliament", "SEBI", "FinTech Corp",
    "NeuroTech AI", "SpaceIntel", "Defense Dynamics", "CyberShield"
]

def generate_realistic_content(narrative):
    templates = CONTENT_TEMPLATES.get(narrative, ["Update on {entity} situation."])
    template = random.choice(templates)
    entity = random.choice(ENTITIES)
    return template.format(entity=entity)

def generate_sentiment():
    return random.choices(SENTIMENTS, weights=[20, 50, 30])[0]

def hid(value):
    return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value else None

def generate_posts():
    posts = []
    total_posts = 150
    total_weight = sum(narr["weight"] for narr in NARRATIVES.values())

    for narrative_name, narr_config in NARRATIVES.items():
        base_count = int((narr_config["weight"] / total_weight) * total_posts)
        # Add 25% variance for organic messiness
        post_count = base_count + random.randint(-int(base_count * 0.25), int(base_count * 0.25))
        post_count = max(3, post_count)

        print(f"Generating {post_count} posts for '{narrative_name}'...")

        for i in range(post_count):
            platform = random.choice(narr_config["platforms"])
            hours_ago = random.randint(0, 168)
            published_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)

            post_id = uuid.uuid4().hex[:12]
            canonical_id = f"synth:{platform.lower()}:{post_id}"
            text = generate_realistic_content(narrative_name)
            scored_at = datetime.now(timezone.utc).isoformat()
            sentiment_label = generate_sentiment()

            post = {
                "canonical_id": canonical_id,
                "platform": platform.lower(),
                "post_id": post_id,
                "event_type": "post",
                "parent_id": None,
                "author_id": hid(f"synthetic-user-{random.randint(1000, 9999)}"),
                "reply_to_author": None,
                "text": text,
                "text_content": text,
                "sentiment_label": sentiment_label,
                "narrative_name": narrative_name,
                "created_at": published_at.isoformat(),
                "published_at": published_at.isoformat(),
                "metadata": {
                    "source_mode": "SYNTH",
                    "narrative_cluster": hashlib.md5(narrative_name.encode()).hexdigest()[:8]
                },
                "source_mode": "SYNTH",
                "dataset": "netra_synthetic_seed",
                "source_file": None,
                "ingested_at": scored_at,
                "lang": None,
                "hashtags": [], "mentions": [], "urls": [],
                "metrics": empty_metrics(),
                "sentiment": {
                    "label": sentiment_label, "score": None,
                    "method": "synthetic_seed", "model_version": "seed-v1",
                    "confidence": 1.0, "scored_at": scored_at,
                },
                "narrative_id": {
                    "value": hashlib.md5(narrative_name.encode()).hexdigest()[:8],
                    "method": "synthetic_seed", "model_version": "seed-v1",
                    "confidence": 1.0, "scored_at": scored_at,
                },
            }
            posts.append(post)

    return posts

def main():
    if "--confirm" not in sys.argv:
        print("[!] Safety Stop: Seeding will insert synthetic data into MongoDB.")
        print("    To proceed, execute explicitly: python app/seed_diverse_data.py --confirm")
        sys.exit(1)

    print("Connecting to MongoDB...")
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    print("Generating realistic, varied synthetic intelligence data...")
    posts = generate_posts()

    print("Clearing existing synthetic data (preserving REAL/LIVE data)...")
    collection.delete_many({
        "metadata.source_mode": {"$in": ["SYNTH", "SYNTHETIC", "SEEDED_REALISTIC"]},
        "canonical_id": {"$regex": "_batch\\d+$"}
    })

    print(f"Inserting {len(posts)} synthetic posts with realistic spread...")
    result = collection.insert_many(posts)

    print(f"\nSuccess! Inserted {len(result.inserted_ids)} synthetic documents.")
    print("\nDistribution Summary:")
    for narrative in NARRATIVES.keys():
        count = collection.count_documents({"narrative_name": narrative, "metadata.source_mode": "SYNTHETIC"})
        print(f"  - {narrative}: {count} posts")

    client.close()

if __name__ == "__main__":
    main()
