import os
import sys
from pathlib import Path

import httpx
import mongomock
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.collectors import meta_ingestor
from app.connectors import connector_status
from app.core.env_utils import get_clean_env, validate_token_shape
from app.timeline import timeline


class FakeResponse:
    def __init__(self, data, status=200):
        self.data, self.status_code = data, status
        self.request = httpx.Request("GET", "https://graph.facebook.com/test")

    def json(self):
        return self.data

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("error", request=self.request, response=self)


class FakeClient:
    def __init__(self, responses):
        self.responses = iter(responses)

    def __enter__(self): return self
    def __exit__(self, *args): return False
    def get(self, *args, **kwargs): return next(self.responses)


def test_meta_missing_token_sets_credentials_required(monkeypatch):
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("META_ACCESS_TOKEN", "")
    monkeypatch.delenv("INSTAGRAM_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("INSTAGRAM_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("META_INSTAGRAM_ACCOUNT_ID", raising=False)
    meta_ingestor.initialize_meta_status(db)
    assert connector_status(db, "facebook")["status"] == "CREDENTIALS_REQUIRED"
    result = meta_ingestor.ingest_meta(db)
    assert result["facebook"]["reason"] == "token_missing"
    assert result["instagram"]["reason"] == "instagram_not_configured"
    assert result["summary"]["status"] == "CREDENTIALS_REQUIRED"
    assert connector_status(db, "facebook")["status"] == "CREDENTIALS_REQUIRED"
    assert connector_status(db, "instagram")["status"] == "DISABLED"


def test_meta_graph_success_and_permission_and_rate_statuses(monkeypatch):
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("META_ACCESS_TOKEN", "EAA" + "a" * 120)
    monkeypatch.setenv("META_GRAPH_VERSION", "v22.0")
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "page")
    monkeypatch.setenv("META_INSTAGRAM_ACCOUNT_ID", "ig")
    monkeypatch.delenv("INSTAGRAM_ACCESS_TOKEN", raising=False)
    responses = [
        FakeResponse({"data": [{"id": "post1", "message": "Public page post", "created_time": "2026-10-01T00:00:00+0000", "from": {"id": "page-author"}}]}),
        FakeResponse({"data": [{"id": "comment1", "message": "Public comment", "created_time": "2026-10-01T01:00:00+0000", "from": {"id": "commenter"}}]}),
        FakeResponse({"data": []}),
        FakeResponse({"data": [{"id": "media1", "caption": "Public media", "timestamp": "2026-10-01T02:00:00+0000", "username": "professional"}]}),
        FakeResponse({"data": []}),
    ]
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: FakeClient(responses))
    result = meta_ingestor.ingest_meta(db)
    assert result["facebook"]["status"] == "LIVE"
    assert result["instagram"]["status"] == "LIVE"
    assert result["summary"]["status"] == "LIVE"
    assert db["raw_posts"].count_documents({"platform": "facebook"}) == 2
    assert db["raw_posts"].find_one({"post_id": "post1"})["author_id"] != "page-author"
    assert connector_status(db, "facebook")["status"] == "LIVE"

    permission = FakeResponse({"error": {"code": 10, "message": "permission denied"}}, status=403)
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: FakeClient([permission, permission]))
    meta_ingestor.ingest_meta(db)
    assert connector_status(db, "facebook")["status"] == "PERMISSION_REQUIRED"

    rate = FakeResponse({"error": {"code": 613, "message": "rate limit"}}, status=429)
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: FakeClient([rate, rate]))
    meta_ingestor.ingest_meta(db)
    assert connector_status(db, "facebook")["status"] == "RATE_LIMITED"


def test_meta_public_export_import(monkeypatch, tmp_path):
    db = mongomock.MongoClient()["social_intel"]
    export_dir = tmp_path / "data" / "import" / "meta"
    export_dir.mkdir(parents=True)
    (export_dir / "facebook_public.json").write_text('[{"id":"export1","message":"Exported public post","created_time":"2026-10-01T00:00:00+0000","from":{"id":"public-author"}}]')
    monkeypatch.setattr(meta_ingestor, "IMPORT_DIR", export_dir)
    monkeypatch.setattr(meta_ingestor, "ROOT", tmp_path)
    assert meta_ingestor.import_meta_exports(db) == 1
    doc = db["raw_posts"].find_one({"post_id": "export1"})
    assert doc["source_mode"] == "IMPORT"
    assert doc["author_id"] != "public-author"
    assert connector_status(db, "facebook")["status"] == "IMPORT"


def test_timeline_defaults_to_actual_range_and_buckets_filters():
    coll = mongomock.MongoClient()["social_intel"]["raw_posts"]
    coll.insert_many([
        {"platform": "telegram", "source_mode": "LIVE", "created_at": "2026-10-01T01:10:00+00:00"},
        {"platform": "telegram", "source_mode": "LIVE", "created_at": "2026-10-01T01:40:00+00:00"},
        {"platform": "facebook", "source_mode": "IMPORT", "created_at": "2026-10-02T02:00:00+00:00"},
    ])
    hourly = timeline(coll, bucket="hour")
    assert hourly["from"] == "2026-10-01T01:10:00+00:00"
    assert hourly["timeline"][0]["count"] == 2
    assert timeline(coll, platform="facebook", source_mode="IMPORT")["timeline"][0]["count"] == 1
    assert timeline(coll, platform="instagram")["timeline"] == []
    with pytest.raises(ValueError):
        timeline(coll, bucket="week")


def test_clean_env_and_token_shape_are_local_and_secret_safe(monkeypatch, caplog):
    token = "EAA" + "a" * 120
    monkeypatch.setenv("META_ACCESS_TOKEN", f" \u200bBearer '{token}'\u00a0\n")
    assert get_clean_env("META_ACCESS_TOKEN") == token
    assert "META_ACCESS_TOKEN" in caplog.text
    assert token not in caplog.text
    assert validate_token_shape("IG" + "a" * 120, "IG")["ok"]
    assert validate_token_shape("bad token", "EAA")["problems"] == ["too_short", "unexpected_prefix", "contains_whitespace", "invalid_characters"]


def test_malformed_token_makes_zero_api_calls(monkeypatch):
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("META_ACCESS_TOKEN", "not-a-token")
    monkeypatch.delenv("INSTAGRAM_ACCESS_TOKEN", raising=False)
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "page")
    def no_client():
        raise AssertionError("network client must not be created for malformed tokens")
    monkeypatch.setattr(meta_ingestor.httpx, "Client", no_client)
    result = meta_ingestor.ingest_meta(db)
    assert result["facebook"]["reason"] == "token_malformed"
    assert result["facebook"]["api_calls"] == 0
    assert result["instagram"]["reason"] == "token_malformed"
    assert result["instagram"]["api_calls"] == 0


def test_instagram_discovery_is_persisted_and_uses_page_graph(monkeypatch):
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("META_ACCESS_TOKEN", "EAA" + "a" * 120)
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "page")
    monkeypatch.setenv("META_GRAPH_VERSION", "v26.0")
    monkeypatch.delenv("INSTAGRAM_ACCESS_TOKEN", raising=False)
    monkeypatch.delenv("INSTAGRAM_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("META_INSTAGRAM_ACCOUNT_ID", raising=False)
    calls = []
    class DiscoverClient(FakeClient):
        def get(self, url, *args, **kwargs):
            calls.append(url)
            return super().get(url, *args, **kwargs)
    responses = [
        FakeResponse({"instagram_business_account": {"id": "ig-discovered"}}),
        FakeResponse({"data": []}),
    ]
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: DiscoverClient(responses))
    result = meta_ingestor.ingest_meta(db, platform="instagram")
    assert result["instagram"]["status"] == "LIVE"
    assert db["collector_state"].find_one({"_id": "meta_discovered_instagram"})["account_id"] == "ig-discovered"
    assert all(url.startswith("https://graph.facebook.com/") for url in calls)


def test_meta_log_redaction_never_emits_token(caplog):
    token = "EAA" + "b" * 120
    meta_ingestor.logger.warning("Meta request failed: access_token=%s", token)
    assert token not in caplog.text
    assert "[REDACTED]" in caplog.text
    assert token not in meta_ingestor._redact(f"https://example.test/?access_token={token}")
    response = FakeResponse({"error": {"code": 190}}, status=400)
    response.text = f"access_token={token}"
    with pytest.raises(httpx.HTTPStatusError) as exc:
        meta_ingestor._pages(FakeClient([response]), "https://graph.facebook.com/test", {}, 1)
    assert token not in str(exc.value)


def test_instagram_uses_page_route_then_falls_back_only_on_permission(monkeypatch):
    db = mongomock.MongoClient()["social_intel"]
    monkeypatch.setenv("META_ACCESS_TOKEN", "EAA" + "a" * 120)
    monkeypatch.setenv("INSTAGRAM_ACCESS_TOKEN", "IG" + "b" * 120)
    monkeypatch.setenv("INSTAGRAM_ACCOUNT_ID", "ig-account")
    monkeypatch.setenv("META_GRAPH_VERSION", "v26.0")
    calls = []
    class RouteClient(FakeClient):
        def get(self, url, *args, **kwargs):
            calls.append(url)
            return super().get(url, *args, **kwargs)
    permission = FakeResponse({"error": {"code": 10, "message": "missing permission"}}, status=403)
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: RouteClient([permission]))
    # A new client is created for the fallback route.
    original = meta_ingestor.httpx.Client
    clients = iter([RouteClient([permission]), RouteClient([FakeResponse({"data": []})])])
    monkeypatch.setattr(meta_ingestor.httpx, "Client", lambda: next(clients))
    result = meta_ingestor.ingest_meta(db, platform="instagram")
    assert result["instagram"]["status"] == "LIVE"
    assert result["instagram"]["route"] == "instagram_login_graph"
    assert result["instagram"]["reason"] == "no_content_yet"
    assert calls[0].startswith("https://graph.facebook.com/")
    assert calls[1].startswith("https://graph.instagram.com/")


def test_token_shape_rejects_short_or_pasted_values_before_network():
    assert "too_short" in validate_token_shape("EAA" + "a" * 90, "EAA")["problems"]
    pasted = validate_token_shape(" 'EAA" + "a" * 120 + "' ", "EAA")
    assert "contains_whitespace" in pasted["problems"]
    assert "contains_quotes" in pasted["problems"]
