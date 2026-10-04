import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path: sys.path.insert(0, str(BACKEND_DIR))

from app.trends.config import SCORE_WEIGHTS
from app.trends.engine import backtest, compute, narrative_id
import mongomock
from app.trends.engine import materialize

def post(index, stamp, text="#spike cyber alert", platform="reddit"):
    return {"_id": index, "author_id": f"u{index}", "platform": platform, "text": text, "created_at": stamp.isoformat(), "metrics": {"likes": 10}}

def test_burst_detection_marks_planted_spike_rising_or_viral():
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    rows, i = [], 0
    for hour in range(24):
        count = 10 if hour >= 18 else 1
        for _ in range(count): rows.append(post(i, base + timedelta(hours=hour))); i += 1
    trends, _ = compute(rows, at=base + timedelta(hours=23))
    spike = next(row for row in trends if row["label"] == "spike")
    assert spike["burst_zscore"] >= 2
    assert spike["status"] in {"RISING", "VIRAL"}

def test_narrative_id_links_similar_labels_across_windows():
    first = narrative_id("cyber security alert")
    second = narrative_id("security cyber alert", [{"label": "cyber security alert", "narrative_id": first}])
    assert first == second

def test_score_is_exact_weighted_sum_of_exposed_components():
    rows = [post(i, datetime(2026, 1, 1, tzinfo=timezone.utc) + timedelta(hours=i)) for i in range(12)]
    trend = compute(rows)[0][0]
    expected = sum(SCORE_WEIGHTS[key] * trend["score_components"][key] for key in SCORE_WEIGHTS)
    assert abs(trend["score"] - expected) < .0002

def test_forecast_backtest_runs_on_history():
    result = backtest([1, 2, 2, 3, 5, 8, 13, 21])
    assert result["origins"] > 0
    assert result["mae"] >= 0 and result["smape"] >= 0

def test_materialize_writes_stable_ids_to_posts_and_trend_collection():
    db = mongomock.MongoClient()["social_intel"]
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    db.raw_posts.insert_many([post(i, base + timedelta(hours=i)) for i in range(8)])
    materialize(db, db.raw_posts)
    saved = db.raw_posts.find_one({})
    assert saved["narrative_id"].startswith("nar_") and saved["topic_id"].startswith("top_")
    assert db.trends.count_documents({}) == 1
