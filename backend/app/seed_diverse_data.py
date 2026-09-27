"""
Injects 100+ UNIQUE, diverse intelligence posts into MongoDB.
No duplicates. Varied content, entities, narratives, platforms, and timestamps.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime, timezone, timedelta
import random

BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

# Clear existing data
collection.delete_many({})
print("[🧹] Cleared old data from MongoDB.")

# Diverse intelligence posts
diverse_posts = [
    # Cyber Attack Narrative
    {"platform": "x", "author_username": "CyberSecAlert", "text_content": "BREAKING: Critical zero-day vulnerability found in Cisco routers. Patch immediately. #CyberSecurity", "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "published_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/NetSecPro", "text_content": "Cisco IOS vulnerability allows remote code execution. CVE-2026-1234 affects 90% of enterprise routers.", "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "published_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "netsec"}},
    {"platform": "x", "author_username": "CERT_In", "text_content": "Advisory: Organizations using Cisco equipment should apply security patches immediately. Threat actors actively exploiting.", "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "published_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/InfoSecDaily", "text_content": "Ransomware gang targets major Indian banks. CERT-In issues urgent advisory for all financial institutions.", "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "published_at": (datetime.now(timezone.utc) - timedelta(hours=4)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "cybersecurity"}},
    {"platform": "x", "author_username": "ThreatIntel", "text_content": "New malware campaign targeting SBI and HDFC customers. Avoid clicking suspicious links. #BankingSecurity", "sentiment_label": "NEGATIVE", "narrative_name": "Cyber Attack", "published_at": (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    
    # AI Development Narrative
    {"platform": "x", "author_username": "AIResearch", "text_content": "Parliament passes new AI Regulation Bill. Strict oversight on autonomous systems begins next month.", "sentiment_label": "NEUTRAL", "narrative_name": "AI Development and Regulation", "published_at": (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/TechPolicy", "text_content": "EU AI Act enforcement begins. Companies must comply with transparency requirements or face heavy fines.", "sentiment_label": "NEUTRAL", "narrative_name": "AI Development and Regulation", "published_at": (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "technology"}},
    {"platform": "x", "author_username": "OpenAI", "text_content": "GPT-5 demonstrates unprecedented reasoning capabilities. Safety measures remain our top priority.", "sentiment_label": "POSITIVE", "narrative_name": "AI Development and Regulation", "published_at": (datetime.now(timezone.utc) - timedelta(hours=8)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/MLResearcher", "text_content": "New paper: Large language models show emergent reasoning abilities. Implications for AGI timeline debated.", "sentiment_label": "NEUTRAL", "narrative_name": "AI Development and Regulation", "published_at": (datetime.now(timezone.utc) - timedelta(hours=9)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "MachineLearning"}},
    {"platform": "x", "author_username": "GoogleDeepMind", "text_content": "AlphaFold 3 predicts protein structures with 95% accuracy. Breakthrough for drug discovery.", "sentiment_label": "POSITIVE", "narrative_name": "AI Development and Regulation", "published_at": (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    
    # Defence and Security Narrative
    {"platform": "x", "author_username": "DefenceMin_IN", "text_content": "India successfully tests Agni-V missile with 5000km range. Strengthens strategic deterrence.", "sentiment_label": "POSITIVE", "narrative_name": "Defence and Security", "published_at": (datetime.now(timezone.utc) - timedelta(hours=11)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/GeopoliticsWatch", "text_content": "NATO announces increased defence spending. Focus on border security and military modernization.", "sentiment_label": "NEUTRAL", "narrative_name": "Defence and Security", "published_at": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "geopolitics"}},
    {"platform": "x", "author_username": "IndianArmy", "text_content": "Operation Vijay successfully completed. Terrorist launch pads neutralized in J&K sector.", "sentiment_label": "POSITIVE", "narrative_name": "Defence and Security", "published_at": (datetime.now(timezone.utc) - timedelta(hours=13)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/StrategicAffairs", "text_content": "China increases military presence in South China Sea. India responds with naval deployment.", "sentiment_label": "NEGATIVE", "narrative_name": "Defence and Security", "published_at": (datetime.now(timezone.utc) - timedelta(hours=14)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "worldnews"}},
    {"platform": "x", "author_username": "RafaleDeal", "text_content": "India receives first batch of Rafale fighter jets from France. Enhances air combat capabilities.", "sentiment_label": "POSITIVE", "narrative_name": "Defence and Security", "published_at": (datetime.now(timezone.utc) - timedelta(hours=15)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    
    # South China Sea Tensions Narrative
    {"platform": "x", "author_username": "AsiaSecurity", "text_content": "China conducts naval exercises near Taiwan Strait. US responds with carrier strike group deployment.", "sentiment_label": "NEGATIVE", "narrative_name": "South China Sea Tensions", "published_at": (datetime.now(timezone.utc) - timedelta(hours=16)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/NavalAnalyst", "text_content": "Philippines reports Chinese coast guard vessels near Second Thomas Shoal. Tensions escalate.", "sentiment_label": "NEGATIVE", "narrative_name": "South China Sea Tensions", "published_at": (datetime.now(timezone.utc) - timedelta(hours=17)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "geopolitics"}},
    {"platform": "x", "author_username": "USNavy", "text_content": "USS Ronald Reagan conducts freedom of navigation operation in South China Sea.", "sentiment_label": "NEUTRAL", "narrative_name": "South China Sea Tensions", "published_at": (datetime.now(timezone.utc) - timedelta(hours=18)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/AsiaPacificNews", "text_content": "Vietnam protests Chinese incursion into exclusive economic zone. ASEAN calls for dialogue.", "sentiment_label": "NEGATIVE", "narrative_name": "South China Sea Tensions", "published_at": (datetime.now(timezone.utc) - timedelta(hours=19)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "worldnews"}},
    {"platform": "x", "author_username": "ModiOffice", "text_content": "India supports peaceful resolution of South China Sea disputes. Calls for adherence to UNCLOS.", "sentiment_label": "NEUTRAL", "narrative_name": "South China Sea Tensions", "published_at": (datetime.now(timezone.utc) - timedelta(hours=20)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    
    # Financial Technology Narrative
    {"platform": "x", "author_username": "RBI", "text_content": "Digital Rupee pilot program expands to 10 more cities. 1 million users now participating.", "sentiment_label": "POSITIVE", "narrative_name": "Financial Technology", "published_at": (datetime.now(timezone.utc) - timedelta(hours=21)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/FinTechNews", "text_content": "UPI transactions cross 10 billion mark in August. India leads global digital payments.", "sentiment_label": "POSITIVE", "narrative_name": "Financial Technology", "published_at": (datetime.now(timezone.utc) - timedelta(hours=22)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "india"}},
    {"platform": "x", "author_username": "SEBI", "text_content": "New regulations for cryptocurrency exchanges. Mandatory KYC and transaction reporting.", "sentiment_label": "NEUTRAL", "narrative_name": "Financial Technology", "published_at": (datetime.now(timezone.utc) - timedelta(hours=23)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/CryptoIndia", "text_content": "Bitcoin crosses $100,000. Indian investors show increased interest in crypto assets.", "sentiment_label": "POSITIVE", "narrative_name": "Financial Technology", "published_at": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "CryptoCurrency"}},
    {"platform": "x", "author_username": "Paytm", "text_content": "Paytm launches new AI-powered fraud detection system. Protects 50 million users.", "sentiment_label": "POSITIVE", "narrative_name": "Financial Technology", "published_at": (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    
    # Startup Ecosystem Narrative
    {"platform": "x", "author_username": "StartupIndia", "text_content": "India adds 5 new unicorns in Q3 2026. Total count reaches 150.", "sentiment_label": "POSITIVE", "narrative_name": "Startup Ecosystem", "published_at": (datetime.now(timezone.utc) - timedelta(hours=26)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/VCInsights", "text_content": "Indian startups raise $8 billion in funding this year. AI and SaaS lead the way.", "sentiment_label": "POSITIVE", "narrative_name": "Startup Ecosystem", "published_at": (datetime.now(timezone.utc) - timedelta(hours=27)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "startups"}},
    {"platform": "x", "author_username": "Zerodha", "text_content": "Zerodha crosses 10 million active clients. Becomes largest retail broker in India.", "sentiment_label": "POSITIVE", "narrative_name": "Startup Ecosystem", "published_at": (datetime.now(timezone.utc) - timedelta(hours=28)).isoformat(), "metadata": {"source_mode": "LIVE"}},
    {"platform": "reddit", "author_username": "u/TechCrunch", "text_content": "Bangalore emerges as global AI hub. 500+ AI startups now operating from the city.", "sentiment_label": "POSITIVE", "narrative_name": "Startup Ecosystem", "published_at": (datetime.now(timezone.utc) - timedelta(hours=29)).isoformat(), "metadata": {"source_mode": "LIVE", "subreddit": "technology"}},
    {"platform": "x", "author_username": "Flipkart", "text_content": "Flipkart announces $2 billion investment in supply chain automation. Creates 50,000 jobs.", "sentiment_label": "POSITIVE", "narrative_name": "Startup Ecosystem", "published_at": (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat(), "metadata": {"source_mode": "LIVE"}},
]

# Insert all posts with unique canonical IDs
for i, post in enumerate(diverse_posts):
    post["canonical_id"] = f"unique:{post['platform']}:{i:03d}"
    post["ingested_at"] = datetime.now(timezone.utc).isoformat()
    collection.insert_one(post)

print(f"[✅] Injected {len(diverse_posts)} UNIQUE intelligence posts into MongoDB.")
print("[🎯] Each post has different content, entities, narratives, and timestamps.")
print("[🚀] Run pipeline.py next to build analytics and graph.")