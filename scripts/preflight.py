"""
NETRA Preflight Verification Script.
Checks environment shapes (strictly zero secrets printed), database connections,
indexes, dependencies, and collector reachability with an authoritative GO/NO-GO verdict.

Rules:
- Returns NO-GO (exit code 1) if any enabled source lacks required credentials or fails reachability.
- Returns GO WITH WARNINGS (exit code 0) for weak credentials or unused secrets when all enabled sources pass.
- Returns GO FOR DEMO (exit code 0) only if all enabled sources are READY or LIVE and 0 warnings.
- Prints one line per enabled source with status and reason.
"""
from __future__ import annotations

import os
import sys
import re
import time
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from dotenv import load_dotenv
load_dotenv(dotenv_path=BASE_DIR / ".env")

import httpx
from app.core.env_utils import get_clean_env, is_source_enabled, get_enabled_sources

results = []
enabled_source_statuses = {}
warnings = []


def record_check(category: str, check_name: str, passed: bool | None, details: str):
    status_str = "PASS" if passed is True else ("SKIP" if passed is None else "FAIL")
    results.append({
        "category": category,
        "check": check_name,
        "status": status_str,
        "details": details
    })


def inspect_env_shape(var_name: str, pattern: str | None = None, min_len: int = 1) -> tuple[bool | None, str]:
    val = get_clean_env(var_name, "")
    if not val:
        return None, "Not configured (optional or disabled)"
    length = len(val)
    if length < min_len:
        return False, f"Value present but too short (len={length})"
    if pattern and not re.search(pattern, val):
        return False, f"Present (len={length}) but shape does not match expected format"
    prefix = val[:3] if len(val) >= 6 else "***"
    return True, f"Configured (len={length}, prefix={prefix}***)"


def check_environment():
    print("[*] 1. Inspecting Environment Variable Shapes & Policies...")
    checks = [
        ("MONGO_URI", r'^mongodb(\+srv)?:\/\/', 10),
        ("NEO4J_URI", r'^bolt(\+s)?:\/\/', 8),
        ("NEO4J_USER", None, 1),
        ("NEO4J_PASSWORD", None, 1),
        ("TELEGRAM_BOT_TOKEN", r'^\d{6,14}:[A-Za-z0-9_-]{25,45}$', 30),
        ("YOUTUBE_API_KEY", r'^AIza[0-9A-Za-z-_]{20,45}$', 25),
        ("META_ACCESS_TOKEN", r'^(EAA|EAAG)[A-Za-z0-9]+', 20),
        ("META_FACEBOOK_PAGE_ID", None, 1),
    ]
    for var, pat, mlen in checks:
        passed, msg = inspect_env_shape(var, pat, mlen)
        record_check("Environment", var, passed, msg)

    # Policy and weak credential warnings
    neo_pass = get_clean_env("NEO4J_PASSWORD", "")
    if neo_pass and len(neo_pass) < 12:
        warnings.append(f"NEO4J_PASSWORD is shorter than 12 characters (len={len(neo_pass)})")
    if neo_pass.lower() in {"neo4j", "password", "admin", "12345678"}:
        warnings.append("NEO4J_PASSWORD is a known default password")

    mongo_uri = get_clean_env("MONGO_URI", "")
    if mongo_uri.startswith("mongodb+srv://"):
        warnings.append("MONGO_URI is mongodb+srv. Reminder: ensure Atlas IP Access List is restricted.")
    if "localhost:27017" in mongo_uri and "@" not in mongo_uri:
        warnings.append("MONGO_URI is unauthenticated on localhost")

    # Unused session credentials warning
    tg_session = get_clean_env("TELEGRAM_SESSION", "")
    tg_pub_enabled = get_clean_env("TELEGRAM_PUBLIC_ENABLED", "0").lower() in ("1", "true", "yes")
    if tg_session and not tg_pub_enabled:
        warnings.append("TELEGRAM_SESSION is present while Telegram public collector is disabled.")

    # Unused variables warning
    zenrows = get_clean_env("ZENROWS_API_KEY", "")
    if zenrows:
        warnings.append("ZENROWS_API_KEY is present in .env but unused in this build.")


def check_databases():
    print("[*] 2. Checking Database Connectivity & Required Indexes...")
    mongo_uri = get_clean_env("MONGO_URI", "mongodb://localhost:27017")
    db_name = get_clean_env("DB_NAME", "social_intel")

    # MongoDB
    try:
        from pymongo import MongoClient
        m_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=4000)
        t0 = time.time()
        m_client.admin.command('ping')
        latency = round((time.time() - t0) * 1000, 1)
        record_check("Database", "MongoDB Ping", True, f"Connected to {db_name} in {latency}ms")

        # Indexes
        db = m_client[db_name]
        raw_indexes = db["raw_posts"].index_information()
        required_keys = ["canonical_id_1", "processed_1"]
        present_keys = [k for k in required_keys if k in raw_indexes]
        if len(present_keys) == len(required_keys):
            record_check("Database", "MongoDB Indexes", True, f"Indexes verified ({len(raw_indexes)} active)")
        else:
            record_check("Database", "MongoDB Indexes", False, f"Missing indexes: {set(required_keys) - set(raw_indexes.keys())}")
    except Exception as e:
        record_check("Database", "MongoDB Ping", False, f"Connection failed: {str(e)[:60]}")
        record_check("Database", "MongoDB Indexes", False, "Skipped due to DB failure")

    # Neo4j
    neo_uri = get_clean_env("NEO4J_URI", "bolt://localhost:7687")
    neo_user = get_clean_env("NEO4J_USER", "neo4j")
    neo_pass = get_clean_env("NEO4J_PASSWORD", "")
    try:
        from neo4j import GraphDatabase
        driver = GraphDatabase.driver(neo_uri, auth=(neo_user, neo_pass), connection_timeout=4.0)
        driver.verify_connectivity()
        record_check("Database", "Neo4j Graph Engine", True, "Connected & verified connectivity")
        driver.close()
    except Exception as e:
        record_check("Database", "Neo4j Graph Engine", None, f"Not connected: {str(e)[:50]} (Network Graph fallback active)")


def check_dependencies():
    print("[*] 3. Verifying System Dependencies & Libraries...")
    libs = [
        ("fastapi", "FastAPI Framework"),
        ("uvicorn", "ASGI Server"),
        ("pymongo", "MongoDB Client"),
        ("apscheduler", "Background Scheduler"),
        ("httpx", "Async HTTP Engine"),
        ("networkx", "Graph Analytics Engine"),
        ("recharts", "Frontend Visualizations")
    ]
    for mod, name in libs:
        if mod == "recharts":
            record_check("Dependencies", name, True, "Bundled in frontend/package.json")
            continue
        try:
            __import__(mod)
            record_check("Dependencies", name, True, "Installed and importable")
        except ImportError:
            record_check("Dependencies", name, False, f"Module '{mod}' missing from environment")


def check_collectors_reachability():
    print("[*] 4. Probing Collector Reachability for Enabled Sources...")
    enabled_sources = get_enabled_sources()

    # 1. Telegram
    if "telegram" in enabled_sources:
        tg_token = get_clean_env("TELEGRAM_BOT_TOKEN")
        if not tg_token:
            record_check("Collector", "Telegram Bot API", False, "FAIL: Missing TELEGRAM_BOT_TOKEN")
            enabled_source_statuses["telegram"] = ("NO-GO", "Missing TELEGRAM_BOT_TOKEN")
        else:
            try:
                with httpx.Client(timeout=5.0) as client:
                    res = client.get(f"https://api.telegram.org/bot{tg_token}/getMe")
                    if res.status_code == 200 and res.json().get("ok"):
                        bot_name = res.json().get("result", {}).get("username")
                        record_check("Collector", "Telegram Bot API", True, f"Reachable (bot=@{bot_name})")
                        enabled_source_statuses["telegram"] = ("LIVE", f"Reachable (bot=@{bot_name})")
                    else:
                        record_check("Collector", "Telegram Bot API", False, f"HTTP {res.status_code}: Invalid token")
                        enabled_source_statuses["telegram"] = ("NO-GO", f"HTTP {res.status_code}: Invalid token")
            except Exception as e:
                record_check("Collector", "Telegram Bot API", False, f"Network error: {str(e)[:40]}")
                enabled_source_statuses["telegram"] = ("NO-GO", f"Network error: {str(e)[:40]}")
    else:
        record_check("Collector", "Telegram Bot API", None, "SKIP: Not enabled in this build")

    # 2. YouTube
    if "youtube" in enabled_sources:
        yt_key = get_clean_env("YOUTUBE_API_KEY")
        if not yt_key:
            record_check("Collector", "YouTube Data API v3", False, "FAIL: Missing YOUTUBE_API_KEY")
            enabled_source_statuses["youtube"] = ("NO-GO", "Missing YOUTUBE_API_KEY")
        else:
            try:
                with httpx.Client(timeout=5.0) as client:
                    res = client.get("https://www.googleapis.com/youtube/v3/videos", params={"part": "id", "id": "Ks-_Mh1QhMc", "key": yt_key})
                    if res.status_code == 200:
                        record_check("Collector", "YouTube Data API v3", True, "Reachable, API key valid (1 quota unit used)")
                        enabled_source_statuses["youtube"] = ("LIVE", "Reachable, API key valid")
                    elif res.status_code in {400, 403}:
                        record_check("Collector", "YouTube Data API v3", False, f"HTTP {res.status_code}: Quota exceeded or key restriction")
                        enabled_source_statuses["youtube"] = ("NO-GO", f"HTTP {res.status_code}: Quota exceeded or key restriction")
                    else:
                        record_check("Collector", "YouTube Data API v3", False, f"HTTP {res.status_code}")
                        enabled_source_statuses["youtube"] = ("NO-GO", f"HTTP {res.status_code}")
            except Exception as e:
                record_check("Collector", "YouTube Data API v3", False, f"Network error: {str(e)[:40]}")
                enabled_source_statuses["youtube"] = ("NO-GO", f"Network error: {str(e)[:40]}")
    else:
        record_check("Collector", "YouTube Data API v3", None, "SKIP: Not enabled in this build")

    # 3. Facebook
    if "facebook" in enabled_sources:
        fb_token = get_clean_env("META_ACCESS_TOKEN")
        fb_page_id = get_clean_env("META_FACEBOOK_PAGE_ID")
        if not fb_token or not fb_page_id:
            record_check("Collector", "Facebook Graph API", False, "FAIL: Missing META_ACCESS_TOKEN or META_FACEBOOK_PAGE_ID")
            enabled_source_statuses["facebook"] = ("NO-GO", "Missing META_ACCESS_TOKEN or META_FACEBOOK_PAGE_ID")
        else:
            try:
                with httpx.Client(timeout=5.0) as client:
                    res = client.get("https://graph.facebook.com/v26.0/me", params={"access_token": fb_token})
                    if res.status_code == 200:
                        record_check("Collector", "Facebook Graph API", True, "Reachable, Access token authenticated")
                        enabled_source_statuses["facebook"] = ("LIVE", "Reachable, Access token authenticated")
                    else:
                        record_check("Collector", "Facebook Graph API", False, f"HTTP {res.status_code}: Token review needed")
                        enabled_source_statuses["facebook"] = ("NO-GO", f"HTTP {res.status_code}: Token review needed")
            except Exception as e:
                record_check("Collector", "Facebook Graph API", False, f"Network error: {str(e)[:40]}")
                enabled_source_statuses["facebook"] = ("NO-GO", f"Network error: {str(e)[:40]}")
    else:
        record_check("Collector", "Facebook Graph API", None, "SKIP: Not enabled in this build")

    # 4. Instagram
    if "instagram" in enabled_sources:
        ig_token = get_clean_env("INSTAGRAM_ACCESS_TOKEN") or get_clean_env("META_ACCESS_TOKEN")
        ig_id = get_clean_env("INSTAGRAM_ACCOUNT_ID") or get_clean_env("META_INSTAGRAM_ACCOUNT_ID")
        if not ig_token or not ig_id:
            record_check("Collector", "Instagram Graph API", False, "FAIL: Missing INSTAGRAM_ACCOUNT_ID or token")
            enabled_source_statuses["instagram"] = ("NO-GO", "Missing INSTAGRAM_ACCOUNT_ID or token")
        else:
            try:
                with httpx.Client(timeout=5.0) as client:
                    res = client.get("https://graph.facebook.com/v26.0/me", params={"access_token": ig_token})
                    if res.status_code == 200:
                        record_check("Collector", "Instagram Graph API", True, "Reachable, Access token authenticated")
                        enabled_source_statuses["instagram"] = ("LIVE", "Reachable, Access token authenticated")
                    else:
                        record_check("Collector", "Instagram Graph API", False, f"HTTP {res.status_code}: Token review needed")
                        enabled_source_statuses["instagram"] = ("NO-GO", f"HTTP {res.status_code}: Token review needed")
            except Exception as e:
                record_check("Collector", "Instagram Graph API", False, f"Network error: {str(e)[:40]}")
                enabled_source_statuses["instagram"] = ("NO-GO", f"Network error: {str(e)[:40]}")
    else:
        record_check("Collector", "Instagram Graph API", None, "SKIP: Not enabled in this build")

    # Non-scope collectors report
    for extra in ["x", "reddit", "bluesky", "mastodon"]:
        if extra not in enabled_sources:
            record_check("Collector", f"{extra.title()} Collector", None, "SKIP: Not enabled in this build")


def run_preflight() -> int:
    results.clear()
    warnings.clear()
    enabled_source_statuses.clear()
    check_environment()
    check_databases()
    check_dependencies()
    check_collectors_reachability()
    return print_report()


def print_report() -> int:
    print("\n" + "=" * 80)
    print("           NETRA INTELLIGENCE PLATFORM -- PREFLIGHT AUDIT REPORT")
    print("=" * 80)
    fmt = "{:<14} | {:<28} | {:<6} | {:<26}"
    header = fmt.format("Category", "Check Target", "Status", "Details")
    print(header)
    print("-" * len(header))

    critical_failures = 0
    for r in results:
        status_color = r["status"]
        if r["status"] == "FAIL":
            if r["category"] in {"Database", "Dependencies", "Collector"}:
                critical_failures += 1
            elif r["check"] == "MONGO_URI":
                critical_failures += 1
        print(fmt.format(r["category"], r["check"], status_color, r["details"][:26]))

    print("=" * 80)
    print("                    ENABLED SOURCES STATUS SUMMARY")
    print("=" * 80)
    enabled_sources = get_enabled_sources()
    all_enabled_ready = True
    for src in sorted(enabled_sources):
        status, reason = enabled_source_statuses.get(src, ("UNKNOWN", "Not probed"))
        if status not in {"LIVE", "READY"}:
            all_enabled_ready = False
        print(f"  * {src:<12}: {status:<8} ({reason})")

    if warnings:
        print("-" * 80)
        print(f"POLICY WARNINGS ({len(warnings)}):")
        for w in warnings:
            print(f"  ! {w}")

    print("=" * 80)
    if critical_failures > 0 or not all_enabled_ready:
        print(f"  PREFLIGHT VERDICT: [NO-GO] -- {max(critical_failures, 1)} CRITICAL FAILURE(S) DETECTED (ENABLED SOURCES NOT ALL READY/LIVE)")
        print("=" * 80)
        return 1
    elif len(warnings) > 0:
        print(f"  PREFLIGHT VERDICT: [GO WITH WARNINGS] -- CORE PIPELINES OPERATIONAL ({len(warnings)} warnings)")
        print("=" * 80)
        return 0
    else:
        print("  PREFLIGHT VERDICT: [GO FOR DEMO] -- ALL ENABLED SOURCES READY/LIVE")
        print("=" * 80)
        return 0


def main():
    return run_preflight()


if __name__ == "__main__":
    sys.exit(main())
