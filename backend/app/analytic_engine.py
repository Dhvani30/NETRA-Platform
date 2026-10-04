import os
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN
from sklearn.neighbors import NearestNeighbors

# --- ROBUST PATH RESOLUTION ---
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

# Load environment variables securely
load_dotenv(dotenv_path=ENV_FILE)

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "NETRA")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "raw_posts")

if not MONGO_URI:
    raise ValueError(f"CRITICAL: MONGO_URI is not set in {ENV_FILE}!")


def run_ai_analytics(batch_size=200):
    print("[*] Starting NETRA AI Analytics Engine...")
    
    # 1. Connect to Database
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # 2. Fetch ONLY unprocessed documents (Efficiency & Idempotency)
    print(f"[*] Fetching up to {batch_size} unprocessed documents from MongoDB...")
    cursor = collection.find({"processed": {"$ne": True}}).limit(batch_size)
    documents = list(cursor)
    
    if not documents:
        print("[+] No unprocessed documents found. System is fully caught up!")
        return

    print(f"[+] Loaded {len(documents)} documents for analysis.")

    # 3. Initialize AI Models
    analyzer = SentimentIntensityAnalyzer()
    
    # Extract texts and IDs safely
    doc_ids = [doc["_id"] for doc in documents]
    texts = [str(doc.get("text_content", "")).strip() for doc in documents]

    # 4. Sentiment Analysis (VADER) + ABSTAIN Logic
    print("[*] Running VADER Sentiment Analysis...")
    sentiment_results = []
    for text in texts:
        # ABSTAIN LOGIC: Suppress AI outputs when data coverage is insufficient
        if len(text) < 10:
            sentiment_results.append({
                "sentiment_score": 0.0,
                "sentiment_label": "ABSTAIN",
                "confidence": 0.0
            })
        else:
            scores = analyzer.polarity_scores(text)
            compound = scores['compound']
            
            if compound >= 0.05:
                label = "POSITIVE"
            elif compound <= -0.05:
                label = "NEGATIVE"
            else:
                label = "NEUTRAL"
            
            sentiment_results.append({
                "sentiment_score": float(compound),
                "sentiment_label": label,
                "confidence": float(abs(compound))
            })

    # 5. Narrative Clustering (TF-IDF + DBSCAN + Nearest-Neighbor Fallback)
    print("[*] Running Narrative Clustering (TF-IDF + DBSCAN)...")
    
    # Filter out empty/short texts for clustering to avoid vectorization errors
    valid_indices = [i for i, text in enumerate(texts) if len(text) >= 10]
    valid_texts = [texts[i] for i in valid_indices]
    
    # Default cluster for all is -1 (Noise/Unclustered)
    cluster_assignments = [-1] * len(texts)
    
    if len(valid_texts) >= 2:
        vectorizer = TfidfVectorizer(
            stop_words='english', 
            max_features=1000, 
            ngram_range=(1, 2)
        )
        tfidf_matrix = vectorizer.fit_transform(valid_texts)
        
        # --- IMPROVEMENT 1: More inclusive DBSCAN parameters ---
        # eps=0.7 (was 0.5): allows more posts to be considered "similar enough"
        # min_samples=1 (was 2): even single posts can form their own cluster
        clustering = DBSCAN(eps=0.7, min_samples=1, metric='cosine')
        valid_clusters = clustering.fit_predict(tfidf_matrix)
        
        # Map cluster assignments back to original document indices
        for idx, cluster_id in zip(valid_indices, valid_clusters):
            cluster_assignments[idx] = int(cluster_id)
        
        # --- IMPROVEMENT 2: Nearest-Neighbor Fallback for remaining noise ---
        # Reassign any post still labeled -1 to its nearest valid cluster
        noise_indices_in_valid = [
            i for i, c in enumerate(valid_clusters) if c == -1
        ]
        clustered_indices_in_valid = [
            i for i, c in enumerate(valid_clusters) if c != -1
        ]
        
        if noise_indices_in_valid and clustered_indices_in_valid:
            print(f"[*] Found {len(noise_indices_in_valid)} noise points. Running nearest-neighbor fallback...")
            
            clustered_vectors = tfidf_matrix[clustered_indices_in_valid]
            clustered_labels = [valid_clusters[i] for i in clustered_indices_in_valid]
            noise_vectors = tfidf_matrix[noise_indices_in_valid]
            
            nbrs = NearestNeighbors(n_neighbors=1, metric='cosine').fit(clustered_vectors)
            _, nearest = nbrs.kneighbors(noise_vectors)
            
            for i, nn_idx in enumerate(nearest):
                valid_idx = noise_indices_in_valid[i]
                original_idx = valid_indices[valid_idx]
                cluster_assignments[original_idx] = int(clustered_labels[nn_idx[0]])

    # --- IMPROVEMENT 3: Re-number clusters to be contiguous (0, 1, 2, ...) ---
    # This makes the graph cleaner (no gaps like Cluster_0, Cluster_5, Cluster_12)
    unique_clusters = sorted(set(cluster_assignments))
    cluster_map = {old: new for new, old in enumerate(unique_clusters)}
    cluster_assignments = [cluster_map[c] for c in cluster_assignments]

    # 6. Update MongoDB with AI Enrichments
    print("[*] Writing AI enrichments back to MongoDB...")
    updated_count = 0
    
    for i, doc_id in enumerate(doc_ids):
        update_data = {
            "$set": {
                "ai_analysis": sentiment_results[i],
                "narrative_cluster": cluster_assignments[i],
                "processed": True,  # Mark as done so we don't process it again
                "processed_at": datetime.now(timezone.utc).isoformat()
            }
        }
        collection.update_one({"_id": doc_id}, update_data)
        updated_count += 1

    # 7. Print Cluster Summary Report
    print(f"\n[+] AI Analytics complete. Enriched {updated_count} documents.")
    print("[*] Cluster Distribution:")
    from collections import Counter
    cluster_counts = Counter(cluster_assignments)
    for cluster_id, count in sorted(cluster_counts.items()):
        print(f"    Cluster {cluster_id}: {count} posts")
    
    noise_count = cluster_counts.get(-1, 0)
    if noise_count > 0:
        print(f"    [!] WARNING: {noise_count} posts remain uncategorized.")
    else:
        print(f"    [+] SUCCESS: 0 posts remain uncategorized!")
    
    print("\n[*] Check MongoDB 'ai_analysis', 'narrative_cluster', and 'processed' fields to verify!")


if __name__ == "__main__":
    run_ai_analytics()