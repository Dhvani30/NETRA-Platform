# NETRA Intelligence Platform
### Next-Generation Social Media Intelligence & Narrative Tracking System

**NETRA** is a real-time intelligence dashboard built to monitor, analyze, and visualize social media narratives. Developed for the Smart India Hackathon (SIH) 2026, it processes unstructured social data into clear, actionable intelligence using graph analytics, cross-platform correlation, and privacy-focused demographic tools.

---

## Key Features

### 1. Real-Time Analytics Dashboard
- Live sentiment distribution and emerging narrative tracking.
- High-throughput intelligence feed with platform filters.

### 2. Narrative Mutation Tracker
- Follows how stories evolve over time (e.g., shifting from "Cyber Attack" to "Ransomware").
- Displays phase-by-phase volume changes, sentiment shifts, and newly introduced entities.

### 3. Cross-Platform Correlation
- Maps a story's lifecycle as it spreads across platforms like X, Reddit, and Telegram.
- Pinpoints the "patient zero" platform and tracks amplification patterns.

### 4. Automated Intelligence Alerts
- Real-time threat detection triggered by data volume spikes, sudden sentiment shifts, and high-value keywords.
- Auto-refreshing priority queue categorized by Critical, Warning, and Info.

### 5. Privacy-Safe Demographics
- Infers audience profiles (Profession, Region, Age Bracket) using behavioral heuristics and narrative context.
- **100% PII-free:** Gathers insights without storing personal user data.

### 6. Advanced Network Intelligence (Neo4j)
- **Top Influencers:** Identifies nodes with the highest degree centrality.
- **Bridge Nodes:** Detects critical entities connecting separate communities or platforms.
- **Community Clustering:** Maps the structural groupings within the intelligence graph.

### 7. Deep Search & Investigation Mode
- Context-aware search to isolate specific entities or narratives.
- Generates a dedicated "Investigation View" showing provenance, activity trends, and targeted evidence feeds.

### 8. Interactive Network Graph
- Fully zoomable and pannable force-directed graph.
- Supports subgraph filtering, hover tooltips, and dynamic node highlighting.

---

## Tech Stack

| Component | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Recharts, `react-force-graph-2d`, Lucide Icons |
| **Backend API** | Python, FastAPI, Uvicorn, Pydantic |
| **Databases** | MongoDB (Document/Time-series), Neo4j (Graph/Relationships) |
| **Data Pipeline** | Custom Python ETL scripts, Regex/Heuristic NLP |

---

## Architecture & Data Flow

1. **Ingestion:** Raw social media posts are ingested into **MongoDB**.
2. **Analytics Engine:** A Python pipeline processes text for sentiment, entities, and narrative clustering.
3. **Graph Construction:** Relationships (Post $\leftrightarrow$ Entity $\leftrightarrow$ Platform) are mapped and stored in **Neo4j**.
4. **API Layer:** **FastAPI** serves aggregated analytics and graph payloads to the frontend.
5. **Visualization:** The **React** dashboard renders real-time charts, alerts, and the interactive force-graph.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- MongoDB (Running on `localhost:27017`)
- Neo4j (Running on `bolt://localhost:7687`)

### 1. Clone the Repository
```bash
git clone [https://github.com/your-username/netra-platform.git](https://github.com/your-username/netra-platform.git)
cd netra-platform
