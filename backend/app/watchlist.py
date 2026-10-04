"""Validated topic watchlist shared by public collectors."""
from __future__ import annotations
import json, re
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
SEED_FILE = ROOT / "data" / "watchlist.json"
FIELDS = ("keywords", "hashtags", "languages", "subreddits", "telegram_channels", "youtube_queries")

def validate_topic(topic: dict, *, creating: bool = False) -> dict:
    value = dict(topic)
    name = str(value.get("name") or "").strip()
    if not 1 <= len(name) <= 80: raise ValueError("name must be 1–80 characters")
    value["name"] = name
    value["id"] = str(value.get("id") or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or uuid4().hex)
    if not re.fullmatch(r"[a-z0-9-]{1,80}", value["id"]): raise ValueError("id must contain lowercase letters, digits, or hyphens")
    for field in FIELDS:
        entries = value.get(field) or []
        if not isinstance(entries, list): raise ValueError(f"{field} must be a list")
        if len(entries) > 10: raise ValueError(f"{field} supports at most 10 values")
        cleaned = [str(entry).strip().lstrip("#") if field == "hashtags" else str(entry).strip() for entry in entries]
        if any(not entry or len(entry) > 120 for entry in cleaned): raise ValueError(f"{field} values must be 1–120 characters")
        value[field] = cleaned
    if len(value["keywords"]) > 10: raise ValueError("at most 10 keywords per topic")
    value["enabled"] = bool(value.get("enabled", True))
    return {key: value[key] for key in ("id", "name", *FIELDS, "enabled")}

def ensure_seed(db, youtube_queries: list[str] | None = None) -> None:
    if db["watchlist"].count_documents({}): return
    try: rows = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError): rows = []
    if youtube_queries:
        rows.append({"id":"youtube-env","name":"YouTube environment queries","keywords":youtube_queries[:10],"youtube_queries":youtube_queries[:10],"enabled":True})
    for row in rows:
        try:
            topic = validate_topic(row); db["watchlist"].update_one({"id":topic["id"]},{"$set":topic},upsert=True)
        except ValueError: continue

def topics(db, enabled_only: bool = True) -> list[dict]:
    ensure_seed(db)
    query = {"enabled": True} if enabled_only else {}
    return list(db["watchlist"].find(query, {"_id": 0}).sort("name", 1))
