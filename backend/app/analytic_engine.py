import os
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

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

def run_ai_analytics():
    print("[*] Starting NETRA AI Analytics Engine...")
    
    # 1. Connect to Database
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]
    
    # 2. Fetch all unprocessed or all messages
    print("[*] Fetching data from MongoDB Atlas...")
    cursor = collection.find({})
    documents = list(cursor)
    
    if not documents:
        print("[-] No documents found in database. Exiting.")
        return

    print(f"[+] Loaded {len(documents)} documents for analysis.")

    # 3. Initialize AI Models
    analyzer = SentimentIntensityAnalyzer()
    
    # Prepare data for Pandas/Scikit-Learn
    df = pd.DataFrame(documents)
    
    # Ensure text_content exists and is string
    df['text_content'] = df['text_content'].fillna("").astype(str)

    # 4. Sentiment Analysis (VADER is optimized for social media text)
    print("[*] Running VADER Sentiment Analysis...")
    sentiment_scores = df['text_content'].apply(lambda x: analyzer.polarity_scores(x))
    df['sentiment_compound'] = sentiment_scores.apply(lambda x: x['compound'])
    
    def get_sentiment_label(score):
        if score >= 0.05: return "POSITIVE"
        elif score <= -0.05: return "NEGATIVE"
        else: return "NEUTRAL"
        
    df['sentiment_label'] = df['sentiment_compound'].apply(get_sentiment_label)

    # 5. Narrative Clustering (TF-IDF + KMeans)
    print("[*] Running Narrative Clustering (TF-IDF + KMeans)...")
    # Determine number of clusters (max 5, or less if we have fewer docs)
    n_clusters = min(5, len(df)) 
    
    vectorizer = TfidfVectorizer(stop_words='english', max_features=1000)
    tfidf_matrix = vectorizer.fit_transform(df['text_content'])
    
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    df['narrative_cluster'] = kmeans.fit_predict(tfidf_matrix)

    # 6. Update MongoDB with AI Enrichments
    print("[*] Writing AI enrichments back to MongoDB Atlas...")
    updated_count = 0
    for index, row in df.iterrows():
        doc_id = row['_id']
        update_data = {
            "$set": {
                "ai_analysis": {
                    "sentiment_score": float(row['sentiment_compound']),
                    "sentiment_label": row['sentiment_label'],
                    "narrative_cluster": int(row['narrative_cluster'])
                }
            }
        }
        collection.update_one({"_id": doc_id}, update_data)
        updated_count += 1

    print(f"[+] AI Analytics complete. Enriched {updated_count} documents.")
    print("[*] Check MongoDB Atlas 'ai_analysis' field to see the results!")

if __name__ == "__main__":
    run_ai_analytics()