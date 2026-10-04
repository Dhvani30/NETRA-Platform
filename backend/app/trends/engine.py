"""Time-relative, replayable trend computation with optional ML acceleration.

BERTopic is loaded only when requested and cached locally. The deterministic
fallback is intentionally first-class so imports and historical replay work in
offline deployments.
"""
from __future__ import annotations
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from hashlib import sha1
import math, re
from typing import Any, Iterable
from .config import SCORE_WEIGHTS, STATUS_THRESHOLDS, WINDOW_HOURS

TOKEN = re.compile(r"(?<!\w)#?[\w]{3,}", re.UNICODE)
STOP = {"the","and","for","with","this","that","from","have","are","was","will","about","your","into","just","not","you","our","but"}

def parse_time(value: Any) -> datetime | None:
    if isinstance(value, datetime): return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")) if value else None
    except ValueError: return None

def floor_hour(value: datetime) -> datetime: return value.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
def text(post: dict[str, Any]) -> str: return str(post.get("text") or post.get("text_content") or "")

def terms(value: str) -> list[str]:
    return [t.lower() for t in TOKEN.findall(value) if t.lower().lstrip("#") not in STOP]

def topic_label(post: dict[str, Any]) -> str:
    """Return BERTopic label when locally available, otherwise a stable n-gram label."""
    existing = post.get("topic") or post.get("narrative_name")
    if existing: return str(existing)[:80]
    tokens = terms(text(post))
    hashtags = [t for t in tokens if t.startswith("#")]
    if hashtags: return hashtags[0].lstrip("#")
    pairs = [f"{tokens[i]} {tokens[i+1]}" for i in range(len(tokens)-1)]
    return (pairs[0] if pairs else (tokens[0] if tokens else "other"))[:80]

def model_labels(posts: list[dict[str, Any]]) -> dict[int, str]:
    """Try BERTopic + multilingual embeddings lazily; return no labels on any offline miss."""
    if len(posts) < 5: return {}
    try:
        from bertopic import BERTopic
        from sentence_transformers import SentenceTransformer
        import os
        # Model construction happens only during a trend run, never API startup.
        model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2", local_files_only=os.getenv("NETRA_TRENDS_ALLOW_DOWNLOAD", "false").lower() not in {"1", "true"})
        topic_model = BERTopic(embedding_model=model, calculate_probabilities=False, verbose=False, min_topic_size=3)
        ids, _ = topic_model.fit_transform([text(post) or "other" for post in posts])
        labels = {}
        for post, topic in zip(posts, ids):
            words = topic_model.get_topic(topic) or []
            label = " ".join(word for word, _ in words[:2]) or topic_label(post)
            labels[id(post)] = label[:80]
        return labels
    except Exception:
        return {}

def narrative_id(label: str, known: Iterable[dict[str, Any]] = ()) -> str:
    """Link adjacent-window labels by Jaccard token similarity; else stable hash."""
    current = set(terms(label))
    for row in known:
        candidate = set(terms(str(row.get("label", ""))))
        if current and candidate and len(current & candidate) / len(current | candidate) >= .5:
            return str(row["narrative_id"])
    return "nar_" + sha1(" ".join(sorted(current or {label.lower()})).encode()).hexdigest()[:12]

def robust_z(value: float, baseline: list[float]) -> float:
    if not baseline: return 0.0
    ordered = sorted(baseline); median = ordered[len(ordered)//2]
    mad = sorted(abs(v-median) for v in baseline)[len(baseline)//2]
    return round((value-median) / max(.5, 1.4826 * mad), 3)

def status(growth: float, zscore: float, acceleration: float) -> str:
    if zscore >= STATUS_THRESHOLDS["viral_z"] and acceleration > 0: return "VIRAL"
    if zscore >= STATUS_THRESHOLDS["rising_z"] and growth > 0: return "RISING"
    if zscore >= STATUS_THRESHOLDS["emerging_z"] and growth > 0: return "EMERGING"
    if growth <= STATUS_THRESHOLDS["declining_growth"]: return "DECLINING"
    return "STABLE"

def forecast(series: list[float], horizon: int = 12) -> dict[str, Any]:
    """12h forecast; statsmodels is optional to keep offline execution reliable."""
    if not series: return {"horizon_hours": horizon, "volumes": [], "method": "insufficient-history", "likely_to_go_viral": 0.0}
    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        fit = ExponentialSmoothing(series, trend="add", initialization_method="estimated").fit(optimized=True)
        values = [max(0, round(float(v), 2)) for v in fit.forecast(horizon)]
        method = "exponential-smoothing"
    except Exception:
        slope = (series[-1]-series[0]) / max(1, len(series)-1)
        values, method = [max(0, round(series[-1] + slope*(i+1), 2)) for i in range(horizon)], "linear-fallback"
    z = robust_z(series[-1], series[:-1]); probability = max(0, min(1, .15 + .12*max(0,z) + .35*max(0, (series[-1]-series[-2] if len(series)>1 else 0)/max(1,series[-1]))))
    return {"horizon_hours": horizon, "volumes": values, "method": method, "likely_to_go_viral": round(probability, 2)}

def backtest(series: list[float], min_train: int = 4) -> dict[str, float | int]:
    errors = []
    for cut in range(min_train, len(series)):
        predicted = forecast(series[:cut], 1)["volumes"]
        if predicted: errors.append((float(predicted[0]), series[cut]))
    if not errors: return {"origins": 0, "mae": 0.0, "smape": 0.0}
    mae = sum(abs(a-b) for a,b in errors)/len(errors)
    smape = sum(2*abs(a-b)/max(1,abs(a)+abs(b)) for a,b in errors)*100/len(errors)
    return {"origins": len(errors), "mae": round(mae, 3), "smape": round(smape, 3)}

def compute(posts: Iterable[dict[str, Any]], *, at: datetime | None = None, known: Iterable[dict[str, Any]] = ()) -> tuple[list[dict[str, Any]], dict[Any, dict[str, str]]]:
    rows = [(post, parse_time(post.get("created_at") or post.get("published_at") or post.get("ingested_at"))) for post in posts]
    rows = [(p,t) for p,t in rows if t and (at is None or t <= at)]
    if not rows: return [], {}
    end = floor_hour(at or max(t for _,t in rows)); start = end-timedelta(hours=WINDOW_HOURS-1)
    ml_labels = model_labels([p for p,_ in rows])
    label_for = lambda post: ml_labels.get(id(post), topic_label(post))
    groups: dict[str, list[tuple[dict[str, Any],datetime]]] = defaultdict(list)
    for post, stamp in rows:
        if start <= floor_hour(stamp) <= end: groups[label_for(post)].append((post,stamp))
    all_history: dict[str, Counter] = defaultdict(Counter)
    for post, stamp in rows:
        all_history[label_for(post)][floor_hour(stamp)] += 1
    outputs, updates = [], {}
    for label, window_rows in groups.items():
        history = all_history[label]; hourly = [history[end-timedelta(hours=i)] for i in range(23,-1,-1)]
        current, previous = sum(hourly[-6:]), sum(hourly[-12:-6]); growth = (current-previous)/max(1,previous)
        z = robust_z(current, [sum(hourly[i:i+6]) for i in range(0, max(0,len(hourly)-11))])
        acceleration = growth - ((sum(hourly[-18:-12])-sum(hourly[-24:-18]))/max(1,sum(hourly[-24:-18])))
        authors = {str(p.get("author_id")) for p,_ in window_rows if p.get("author_id")}; platforms = {str(p.get("platform","unknown")).lower() for p,_ in window_rows}
        engagements = [sum(float((p.get("metrics") or {}).get(k) or 0) for k in ("likes","shares","replies","views")) for p,_ in window_rows]
        recency = sum(1 for _,t in window_rows if t >= end-timedelta(hours=1))/max(1,len(window_rows))
        components = {"volume_growth": min(1,max(0,(growth+1)/2)), "burst_zscore": min(1,max(0,z/5)), "author_diversity": min(1,len(authors)/max(1,len(window_rows))), "cross_platform": min(1,len(platforms)/3), "engagement_growth": min(1,sum(engagements)/max(1,100*len(window_rows))), "recency": recency}
        score = sum(SCORE_WEIGHTS[k]*components[k] for k in SCORE_WEIGHTS)
        nid = narrative_id(label, known)
        key_terms = Counter(token for p,_ in window_rows for token in terms(text(p))).most_common(8)
        # Keyword/hashtag counts use the same current six-hour window versus the
        # preceding six-hour rolling baseline as the topic volume calculation.
        baseline_rows = [(p,t) for p,t in rows if label_for(p) == label and end-timedelta(hours=11) <= floor_hour(t) < start]
        baseline_terms = Counter(token for p,_ in baseline_rows for token in terms(text(p)))
        keyword_metrics = [{"term": term, "count": count, "baseline_count": baseline_terms[term],
                            "growth_percent": round(100*(count-baseline_terms[term])/max(1,baseline_terms[term]), 1),
                            "burst_zscore": robust_z(count, [baseline_terms[term]])}
                           for term,count in key_terms]
        outputs.append({"narrative_id": nid, "topic_id": "top_"+sha1(label.lower().encode()).hexdigest()[:12], "label": label, "window_end": end.isoformat(), "window_start": start.isoformat(), "volume": current, "growth_percent": round(growth*100,1), "burst_zscore": z, "status": status(growth,z,acceleration), "score": round(score,4), "score_components": {k: round(v,4) for k,v in components.items()}, "keywords": [k for k,_ in key_terms], "hashtags": [k for k,_ in key_terms if k.startswith("#")], "keyword_metrics": keyword_metrics, "platform_mix": dict(Counter(str(p.get("platform","unknown")).lower() for p,_ in window_rows)), "timeline": [{"bucket": (end-timedelta(hours=i)).isoformat(), "volume": hourly[-(i+1)]} for i in range(min(24,len(hourly)-1),-1,-1)], "forecast": forecast(hourly[-12:]), "earliest_observed_at": min(t for p,t in rows if label_for(p)==label).isoformat()})
        for post,_ in window_rows: updates[id(post)] = {"narrative_id": nid, "topic_id": "top_"+sha1(label.lower().encode()).hexdigest()[:12]}
    return sorted(outputs, key=lambda row: row["score"], reverse=True), updates

def materialize(database, posts_collection, *, at: datetime | None = None) -> list[dict[str, Any]]:
    posts = list(posts_collection.find({}))
    known = list(database["trends"].find({}, {"narrative_id":1,"label":1}))
    trends, updates = compute(posts, at=at, known=known)
    by_id = {id(post): post for post in posts}
    for marker, fields in updates.items(): posts_collection.update_one({"_id": by_id[marker]["_id"]}, {"$set": fields})
    # Label historical posts too when the deterministic fallback identifies the
    # same narrative; this makes evidence/replay available after the first run.
    fallback_ids = {trend["label"]: {"narrative_id": trend["narrative_id"], "topic_id": trend["topic_id"]} for trend in trends}
    for post in posts:
        if topic_label(post) in fallback_ids:
            posts_collection.update_one({"_id": post["_id"]}, {"$set": fallback_ids[topic_label(post)]})
    for trend in trends: database["trends"].replace_one({"narrative_id":trend["narrative_id"], "window_end":trend["window_end"]}, trend, upsert=True)
    return trends
