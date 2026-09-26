# ⚙️ NETRA Platform - Setup Guide

This guide provides the exact steps to configure and run the NETRA intelligence pipeline locally.

## 📋 Prerequisites
Ensure these are installed on your machine:
1. **Docker Desktop** (with WSL 2 enabled on Windows)
2. **Python 3.10+** (with "Add to PATH" checked)
3. **Git**

---

## 🚀 Step-by-Step Setup

### 1. Configure Environment Variables
Create a file named `.env` in the **root directory** (`D:\NETRA-Platform\.env`) and paste the following. 
*(⚠️ **CRITICAL:** Replace the `MONGO_URI` value with your actual MongoDB Atlas connection string).*

```env
MONGO_URI=mongodb+srv://<your_user>:<your_password>@cluster0.xxxxx.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin
DB_NAME=NETRA
COLLECTION_NAME=raw_posts

# Local Docker Services
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
REDIS_HOST=localhost
REDIS_PORT=6379
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
```

### 2. Start Local Infrastructure
Open PowerShell in the root directory and run:
```powershell
cd docker
docker-compose up -d
```
*(This starts Neo4j, Kafka, Redis, and n8n in the background).*

### 3. Install Python Dependencies
Return to the root directory and install required packages:
```powershell
cd ..
pip install fastapi uvicorn pymongo python-dotenv vaderSentiment scikit-learn pandas
```

### 4. Ingest Benchmark Data
Run the deterministic replay ingestor to populate MongoDB with schema-compliant data (bypasses live API blocks):
```powershell
python backend/app/collectors/reddit_ingestor.py
```

### 5. Run AI Analytics Engine
Process the ingested data to generate sentiment scores and narrative clusters:
```powershell
python backend/app/analytic_engine.py
```

### 6. Start the FastAPI Backend
Launch the local API server:
```powershell
python backend/app/main.py
```

---

## ✅ Verification
1. Open your browser and go to: **http://127.0.0.1:8000/docs**
2. Click on **`GET /api/v1/health`** -> **Try it out** -> **Execute**.
3. You should see `"total_documents": 34` (or higher), confirming the database, AI engine, and API are fully connected.


