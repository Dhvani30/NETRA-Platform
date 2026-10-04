import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import mongomock
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.collectors import bluesky_collector, mastodon_collector, x_thirdparty_ingestor, reddit_collector, reddit_ingestor
from main import app

def test_collectors_disabled_by_default(monkeypatch):
    """Ensure non-scope collectors are disabled by default and return DISABLED status."""
    db = mongomock.MongoClient()["social_intel"]

    # Ensure flags are not enabled
    for flag in ["ENABLE_BLUESKY", "ENABLE_MASTODON", "ENABLE_X", "ENABLE_REDDIT", "ENABLE_DATASET_IMPORT"]:
        monkeypatch.delenv(flag, raising=False)

    # 1. Bluesky
    bsky_res = bluesky_collector.ingest_bluesky(db)
    assert bsky_res["status"] == "DISABLED"
    assert bsky_res["count"] == 0
    assert "Not enabled in this build" in bsky_res["message"]

    # 2. Mastodon
    masto_res = mastodon_collector.ingest_mastodon(db)
    assert masto_res["status"] == "DISABLED"
    assert masto_res["count"] == 0
    assert "Not enabled in this build" in masto_res["message"]

    # 3. X Third-party
    x_res = x_thirdparty_ingestor.ingest_x_thirdparty(db)
    assert x_res["status"] == "DISABLED"
    assert x_res["count"] == 0
    assert "Not enabled in this build" in x_res["message"]

    # 4. Reddit live collector
    reddit_count = reddit_collector.ingest_reddit_posts()
    assert reddit_count == 0

    # 5. Reddit dataset import
    replay_count = reddit_ingestor.run_replay_ingestor()
    assert replay_count == 0


def test_api_health_sources_reports_disabled_build(monkeypatch):
    """Ensure /api/v1/health/sources reports non-scope platforms as DISABLED with reason not_enabled_in_this_build."""
    monkeypatch.setenv("ENABLED_SOURCES", "telegram,youtube,facebook,instagram")

    client = TestClient(app)
    res = client.get("/api/v1/health/sources")
    assert res.status_code == 200
    data = res.json()

    # Active scope
    for active in ["telegram", "youtube", "facebook", "instagram"]:
        assert active in data
        assert data[active]["status"] != "DISABLED"

    # Disabled scope
    for disabled in ["x", "reddit", "bluesky", "mastodon"]:
        assert disabled in data
        assert data[disabled]["status"] == "DISABLED"
        assert data[disabled]["reason"] == "not_enabled_in_this_build"
        assert data[disabled]["mode"] == "DISABLED"
        assert data[disabled]["freshness"] == "disabled"
        assert data[disabled]["items_last_hour"] == 0


def test_api_coverage_reports_disabled_build(monkeypatch):
    """Ensure /api/v1/coverage reports non-scope platforms with mode DISABLED and status DISABLED."""
    monkeypatch.setenv("ENABLED_SOURCES", "telegram,youtube,facebook,instagram")

    client = TestClient(app)
    res = client.get("/api/v1/coverage")
    assert res.status_code == 200
    data = res.json()

    for disabled in ["x", "reddit", "bluesky", "mastodon"]:
        assert disabled in data
        assert data[disabled]["status"] == "DISABLED"
        assert data[disabled]["reason"] == "not_enabled_in_this_build"
        assert data[disabled]["mode"] == "DISABLED"
        assert data[disabled]["scope"] == "Not enabled in this build"
