import io
import logging
import os
import sys
from pathlib import Path
import mongomock
import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.env_utils import get_clean_env, find_dotenv_duplicates, is_source_enabled, get_enabled_sources
from app.core.secret_masker import mask_secrets, sanitize_data, SecretRedactionFilter, install_secret_redaction
from app.core.audit import record_collection_event
from main import app


def test_mask_secrets_patterns():
    # 1. Meta / Instagram tokens
    fake_meta = "EAAGtesttoken12345678901234567890"
    masked_meta = mask_secrets(f"Connecting with token {fake_meta}")
    assert fake_meta not in masked_meta
    assert "EAA***" in masked_meta

    fake_ig = "IGtesttoken12345678901234567890"
    masked_ig = mask_secrets(f"IG Auth: {fake_ig}")
    assert fake_ig not in masked_ig
    assert "IG***" in masked_ig

    # 2. Telegram Bot tokens
    fake_tg = "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ123456789"
    masked_tg = mask_secrets(f"Telegram polling with {fake_tg}")
    assert fake_tg not in masked_tg
    assert "123456789:***" in masked_tg

    # 3. Google API keys
    fake_google = "AIzaSyD_TestGoogleKey123456789012345"
    masked_google = mask_secrets(f"YouTube request using {fake_google}")
    assert fake_google not in masked_google
    assert "AIz***" in masked_google

    # 4. Bearer tokens
    fake_bearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0"
    masked_bearer = mask_secrets(f"Header: {fake_bearer}")
    assert "eyJhbGciOi" not in masked_bearer
    assert "[REDACTED_BEARER_TOKEN]" in masked_bearer

    # 5. MongoDB URI with credentials
    fake_mongo = "mongodb://admin:super_secret_password_123@cluster0.mongodb.net/social_intel?authSource=admin"
    masked_mongo = mask_secrets(fake_mongo)
    assert "super_secret_password_123" not in masked_mongo
    assert "mongodb://admin:[REDACTED_PASSWORD]@cluster0.mongodb.net" in masked_mongo

    # 6. Passwords and app secrets
    fake_secret_json = '{"app_secret": "my_super_secret_app_key_456", "user": "test"}'
    masked_json = mask_secrets(fake_secret_json)
    assert "my_super_secret_app_key_456" not in masked_json
    assert "[REDACTED]" in masked_json


def test_logger_redaction_filter():
    install_secret_redaction()
    log_stream = io.StringIO()
    handler = logging.StreamHandler(log_stream)
    handler.addFilter(SecretRedactionFilter())

    test_logger = logging.getLogger("NETRA.TestLogger")
    test_logger.addHandler(handler)
    test_logger.setLevel(logging.INFO)

    secret_key = "AIzaSyFakeKeyForTesting12345678901234"
    test_logger.info("Initializing collector with key: %s", secret_key)
    handler.flush()

    output = log_stream.getvalue()
    assert secret_key not in output
    assert "AIz***" in output


def test_audit_logger_masks_secrets():
    db = mongomock.MongoClient()["social_intel"]
    secret_token = "EAAGtestsecrettoken1234567890123456"
    db_uri = "mongodb://user:super_secret_pwd@localhost:27017/db"

    doc = record_collection_event(
        db,
        who=f"user_with_{secret_token}",
        what=f"Manual sync triggered with {db_uri}",
        source="facebook",
        details={"token": secret_token, "config_uri": db_uri, "api_calls": 5}
    )

    assert secret_token not in doc["who"]
    assert "super_secret_pwd" not in doc["what"]
    assert doc["details"]["token"] == "[REDACTED]"
    assert "super_secret_pwd" not in str(doc["details"]["config_uri"])


def test_api_error_masks_secrets():
    client = TestClient(app)
    fake_token = "EAAGtestsecrettoken1234567890123456"

    # Trigger a 422 with a fake secret in the path/query
    res = client.get(f"/api/v1/meta/feed?platform=invalid_platform_{fake_token}")
    assert res.status_code == 422
    assert fake_token not in res.text


def test_get_clean_env_stripping(monkeypatch):
    # Whitespace and newlines
    monkeypatch.setenv("TEST_VAR_WS", "  \n  clean_value  \t \r \n")
    assert get_clean_env("TEST_VAR_WS") == "clean_value"

    # Matching single and double quotes
    monkeypatch.setenv("TEST_VAR_QUOTES1", '"quoted_value"')
    assert get_clean_env("TEST_VAR_QUOTES1") == "quoted_value"

    monkeypatch.setenv("TEST_VAR_QUOTES2", "'single_quoted'")
    assert get_clean_env("TEST_VAR_QUOTES2") == "single_quoted"

    # Leading "Bearer "
    monkeypatch.setenv("TEST_VAR_BEARER", "Bearer my_bearer_token_value")
    assert get_clean_env("TEST_VAR_BEARER") == "my_bearer_token_value"

    # Zero-width and non-breaking spaces (\ufeff, \u200b, \u00a0)
    monkeypatch.setenv("TEST_VAR_ZWSP", "\ufeff\u200bvalue_with_zero_width\u00a0")
    assert get_clean_env("TEST_VAR_ZWSP") == "value_with_zero_width"


def test_clean_facebook_page_id_extraction(monkeypatch):
    # 1. Plain numeric ID
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "100089123456789")
    assert get_clean_env("META_FACEBOOK_PAGE_ID") == "100089123456789"

    # 2. URL with ?id= query parameter
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "https://www.facebook.com/profile.php?id=987654321012345")
    assert get_clean_env("META_FACEBOOK_PAGE_ID") == "987654321012345"

    # 3. URL with path ID
    monkeypatch.setenv("META_FACEBOOK_PAGE_ID", "https://facebook.com/page-slug-112233445566/")
    assert get_clean_env("META_FACEBOOK_PAGE_ID") == "112233445566"


def test_find_dotenv_duplicates(tmp_path):
    fake_env = tmp_path / ".env"
    fake_env.write_text(
        "MONGO_URI=mongodb://localhost:27017\n"
        "TELEGRAM_BOT_TOKEN=123:abc\n"
        "# A comment\n"
        "MONGO_URI=mongodb://remote:27017\n"
        "YOUTUBE_API_KEY=AIzaSy123\n"
        "TELEGRAM_BOT_TOKEN=456:def\n"
    )
    duplicates = find_dotenv_duplicates(fake_env)
    assert "MONGO_URI" in duplicates
    assert duplicates["MONGO_URI"] == [1, 4]
    assert "TELEGRAM_BOT_TOKEN" in duplicates
    assert duplicates["TELEGRAM_BOT_TOKEN"] == [2, 6]
    assert "YOUTUBE_API_KEY" not in duplicates


def test_scheduler_registers_only_enabled_sources(monkeypatch):
    from app.scheduler import start_scheduler
    from apscheduler.schedulers.background import BackgroundScheduler
    from unittest.mock import MagicMock

    monkeypatch.setenv("ENABLED_SOURCES", "telegram,youtube,facebook,instagram")
    monkeypatch.delenv("ENABLE_BLUESKY", raising=False)
    monkeypatch.delenv("ENABLE_MASTODON", raising=False)
    monkeypatch.delenv("ENABLE_X", raising=False)
    monkeypatch.delenv("ENABLE_REDDIT", raising=False)

    sched = start_scheduler()
    try:
        job_ids = [job.id for job in sched.get_jobs()]
        # Collector jobs present
        assert "job_telegram" in job_ids
        assert "job_youtube" in job_ids
        assert "job_meta_facebook" in job_ids
        assert "job_meta_instagram" in job_ids

        # Disabled jobs NOT present
        assert "job_bluesky" not in job_ids
        assert "job_mastodon" not in job_ids
        assert "job_x_thirdparty" not in job_ids
        assert "job_reddit" not in job_ids
    finally:
        sched.shutdown()


def test_check_env_warnings_on_policy_violations(tmp_path, monkeypatch):
    """Verify that audit_environment produces all required warning types."""
    import sys
    scripts_dir = BACKEND_DIR.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from check_env import audit_environment

    # Clear any host environment variables for isolation
    for k in [
        "TELEGRAM_BOT_TOKEN", "YOUTUBE_API_KEY", "META_ACCESS_TOKEN",
        "INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_ACCOUNT_ID", "META_INSTAGRAM_ACCOUNT_ID",
        "NEO4J_PASSWORD", "TELEGRAM_SESSION", "ZENROWS_API_KEY", "MONGO_URI"
    ]:
        monkeypatch.delenv(k, raising=False)

    test_env = tmp_path / ".env"
    test_env.write_text(
        "ENABLED_SOURCES=telegram,youtube,facebook,instagram\n"
        "MONGO_URI=mongodb+srv://admin:pass@cluster.mongodb.net/test\n"
        "NEO4J_PASSWORD=short_pw\n"
        "TELEGRAM_SESSION=1bvtestsessionstringfullaccount\n"
        "TELEGRAM_PUBLIC_ENABLED=0\n"
        "ZENROWS_API_KEY=zr_test_proxy_key\n"
        "META_FACEBOOK_PAGE_ID=https://facebook.com/my-page-123456789/\n"
        "TRAILING_SPACE_VAR=value_with_space   \n"
        "DUPLICATE_KEY=first_val\n"
        "DUPLICATE_KEY=second_val\n"
    )

    rows, warnings = audit_environment(dotenv_path=test_env)

    warn_text = "\n".join(warnings)
    # 1. Missing credentials for enabled sources
    assert "[MISSING_CREDENTIAL] Source 'telegram'" in warn_text
    assert "[MISSING_CREDENTIAL] Source 'youtube'" in warn_text
    assert "[MISSING_CREDENTIAL] Source 'facebook'" in warn_text
    assert "[MISSING_CREDENTIAL] Source 'instagram'" in warn_text

    # 2. Neo4j password < 12 characters
    assert "[WEAK_CREDENTIALS] NEO4J_PASSWORD is shorter than 12 characters" in warn_text

    # 3. Mongo short password and atlas srv
    assert "[WEAK_CREDENTIALS] MONGO_URI contains credentials with a short password" in warn_text
    assert "[ATLAS_SECURITY_REMINDER] MONGO_URI is mongodb+srv" in warn_text

    # 4. Telegram session while feature is disabled
    assert "[UNUSED_SESSION_CREDENTIAL] 'TELEGRAM_SESSION' is set while Telegram MTProto/public collector is disabled" in warn_text

    # 5. Unrecognised / unused variable like ZENROWS_API_KEY
    assert "[UNUSED_VARIABLE] Variable 'ZENROWS_API_KEY' is set in .env but unused in this build" in warn_text

    # 6. URL in ID field
    assert "[URL_IN_ID] Variable 'META_FACEBOOK_PAGE_ID' suggests an ID field but contains a URL" in warn_text

    # 7. Trailing spaces & duplicate variable
    assert "[TRAILING_SPACES] 'TRAILING_SPACE_VAR'" in warn_text
    assert "[DUPLICATE] Variable 'DUPLICATE_KEY'" in warn_text


def test_preflight_nogo_when_enabled_source_missing_credentials(monkeypatch):
    """Verify that preflight returns NO-GO (exit code 1) when an enabled source lacks credentials."""
    import sys
    scripts_dir = BACKEND_DIR.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    import preflight

    # Enable telegram but leave token empty
    monkeypatch.setenv("ENABLED_SOURCES", "telegram")
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.setenv("MONGO_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("NEO4J_PASSWORD", "strong_password_over_12_chars")

    exit_code = preflight.run_preflight()
    assert exit_code == 1
    assert preflight.enabled_source_statuses.get("telegram")[0] == "NO-GO"


def test_preflight_go_with_warnings_when_sources_pass_but_warnings_exist(monkeypatch):
    """Verify that preflight returns GO WITH WARNINGS (exit code 0) when enabled sources are live/bypassed but warnings exist."""
    import sys
    scripts_dir = BACKEND_DIR.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    import preflight

    # Mock database check to avoid dependency on live Mongo/Neo4j state during unit tests
    monkeypatch.setattr(preflight, "check_databases", lambda: None)

    # No enabled sources (or all disabled) but weak password present
    monkeypatch.setenv("ENABLED_SOURCES", "")
    monkeypatch.setenv("MONGO_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("NEO4J_PASSWORD", "short_pw")  # triggers warning

    exit_code = preflight.run_preflight()
    assert exit_code == 0
    assert len(preflight.warnings) > 0


def test_scan_secrets_detects_scraping_providers(tmp_path):
    """Verify that scan_secrets finds ZENROWS and other proxy/scraper providers without printing secrets."""
    import sys
    scripts_dir = BACKEND_DIR.parent / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from scan_secrets import scan_file_for_scraping_providers

    test_file = tmp_path / "test_module.py"
    test_file.write_text(
        "# Some code\n"
        "ZENROWS_API_KEY = 'something'\n"
        "import scrapingbee\n"
        "url = 'https://api.brightdata.com/proxy'\n"
    )

    findings = scan_file_for_scraping_providers(test_file)
    detected_providers = [f[2] for f in findings]
    assert any("ZenRows" in p for p in detected_providers)
    assert any("ScrapingBee" in p for p in detected_providers)
    assert any("BrightData" in p for p in detected_providers)
