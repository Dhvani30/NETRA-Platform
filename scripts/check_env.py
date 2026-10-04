"""
scripts/check_env.py
Inspects environment configuration: per variable SET/EMPTY, length, first 3 characters only.
Outputs actionable warnings for:
- Missing credentials on enabled sources (Telegram, YouTube, Facebook, Instagram)
- Weak / default Neo4j passwords (<12 chars or known defaults)
- Weak / default MongoDB credentials & mongodb+srv Atlas network access reminders
- Unused *_SESSION strings (full-account credentials) when feature is disabled
- Unrecognised/unused environment variables (e.g., ZENROWS_API_KEY)
- URLs in ID fields
- Duplicate variable definitions and trailing spaces
Privacy guarantee: Never prints or logs sensitive values beyond the first 3 characters.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

# Set up path to backend modules
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from app.core.env_utils import get_clean_env, find_dotenv_duplicates, is_source_enabled, get_enabled_sources

DOTENV_PATH = BASE_DIR / ".env"

RECOGNIZED_VARS = {
    "ENABLED_SOURCES",
    "MONGO_URI",
    "DB_NAME",
    "COLLECTION_NAME",
    "NEO4J_URI",
    "NEO4J_USER",
    "NEO4J_PASSWORD",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_API_ID",
    "TELEGRAM_API_HASH",
    "TELEGRAM_PUBLIC_ENABLED",
    "TELEGRAM_PUBLIC_MAX_MESSAGES",
    "TELEGRAM_SESSION",
    "YOUTUBE_API_KEY",
    "YOUTUBE_QUERIES",
    "YOUTUBE_CHANNEL_IDS",
    "YOUTUBE_DAILY_QUOTA_BUDGET",
    "YOUTUBE_MAX_COMMENT_PAGES",
    "META_ACCESS_TOKEN",
    "META_FACEBOOK_PAGE_ID",
    "META_FACEBOOK_PAGE",
    "META_GRAPH_VERSION",
    "META_APP_ID",
    "META_APP_SECRET",
    "INSTAGRAM_ACCESS_TOKEN",
    "INSTAGRAM_ACCOUNT_ID",
    "META_INSTAGRAM_ACCOUNT_ID",
    "META_POLL_SECONDS",
    "META_MAX_PAGES",
    "META_COMMENT_LOOKBACK_DAYS",
    "META_AUTO_REFRESH_IG",
    "META_WEBHOOK_VERIFY_TOKEN",
    "TWITTERAPI_IO_KEY",
    "X_QUERIES",
    "X_TP_MAX_TWEETS_PER_RUN",
    "X_TP_MAX_PAGES",
    "X_TP_DAILY_TWEET_BUDGET",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "REDDIT_USER_AGENT",
    "BLUESKY_HANDLE",
    "BLUESKY_APP_PASSWORD",
    "BLUESKY_MAX_POSTS",
    "MASTODON_INSTANCE",
    "MASTODON_TOKEN",
    "MASTODON_ACCESS_TOKEN",
    "MASTODON_MAX_POSTS",
    "ENABLE_BLUESKY",
    "ENABLE_MASTODON",
    "ENABLE_X",
    "ENABLE_REDDIT",
    "ENABLE_DATASET_IMPORT",
}


def parse_raw_dotenv(path: Path) -> dict[str, list[tuple[int, str]]]:
    """Reads raw .env file preserving whitespace and duplicate occurrences."""
    entries: dict[str, list[tuple[int, str]]] = {}
    if not path.is_file():
        return entries
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        for line_no, line in enumerate(f, start=1):
            clean = line.strip()
            if not clean or clean.startswith("#"):
                continue
            match = re.match(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$', line)
            if match:
                k = match.group(1)
                raw_val = match.group(2).rstrip("\r\n")
                entries.setdefault(k, []).append((line_no, raw_val))
    return entries


def audit_environment(dotenv_path: Path | None = None) -> tuple[list[dict[str, str]], list[str]]:
    """Runs a complete environment audit and returns table rows plus warnings."""
    from dotenv import load_dotenv
    target_dotenv = dotenv_path or DOTENV_PATH
    if target_dotenv.is_file():
        load_dotenv(target_dotenv, override=True)

    raw_entries = parse_raw_dotenv(target_dotenv)
    duplicates = find_dotenv_duplicates(target_dotenv)
    warnings: list[str] = []

    # 1. Duplicate variable warnings
    for var, lines in duplicates.items():
        warnings.append(f"[DUPLICATE] Variable '{var}' is defined multiple times on lines: {lines}.")

    # 2. Enabled source credentials check
    enabled_sources = get_enabled_sources()

    if "telegram" in enabled_sources:
        tg_bot_token = get_clean_env("TELEGRAM_BOT_TOKEN")
        if not tg_bot_token:
            warnings.append("[MISSING_CREDENTIAL] Source 'telegram' is enabled in ENABLED_SOURCES but required variable 'TELEGRAM_BOT_TOKEN' is empty.")

    if "youtube" in enabled_sources:
        yt_key = get_clean_env("YOUTUBE_API_KEY")
        if not yt_key:
            warnings.append("[MISSING_CREDENTIAL] Source 'youtube' is enabled in ENABLED_SOURCES but required variable 'YOUTUBE_API_KEY' is empty.")

    if "facebook" in enabled_sources:
        meta_token = get_clean_env("META_ACCESS_TOKEN")
        fb_page_id = get_clean_env("META_FACEBOOK_PAGE_ID")
        if not meta_token or not fb_page_id:
            warnings.append("[MISSING_CREDENTIAL] Source 'facebook' is enabled in ENABLED_SOURCES but required credentials (META_ACCESS_TOKEN and META_FACEBOOK_PAGE_ID) are incomplete.")

    if "instagram" in enabled_sources:
        ig_account_id = get_clean_env("INSTAGRAM_ACCOUNT_ID") or get_clean_env("META_INSTAGRAM_ACCOUNT_ID")
        ig_token = get_clean_env("INSTAGRAM_ACCESS_TOKEN") or get_clean_env("META_ACCESS_TOKEN")
        if not ig_account_id or not ig_token:
            warnings.append("[MISSING_CREDENTIAL] Source 'instagram' is enabled in ENABLED_SOURCES but required credentials (INSTAGRAM_ACCOUNT_ID plus META_ACCESS_TOKEN/INSTAGRAM_ACCESS_TOKEN) are incomplete.")

    # 3. Variable inspection loop
    all_keys = sorted(set(RECOGNIZED_VARS) | set(raw_entries.keys()))
    rows = []

    for var in all_keys:
        clean_val = get_clean_env(var, "")
        status = "SET" if clean_val else "EMPTY"
        length = len(clean_val)
        prefix = (clean_val[:3] + "***") if length >= 3 else ("***" if length > 0 else "")
        rows.append({
            "name": var,
            "status": status,
            "length": str(length),
            "prefix": prefix
        })

        # Trailing / leading spaces on raw line
        if var in raw_entries:
            for line_no, raw_val in raw_entries[var]:
                if raw_val != raw_val.strip():
                    warnings.append(f"[TRAILING_SPACES] '{var}' on line {line_no} contains leading/trailing whitespace.")

        # Unrecognised / unused variables
        if var in raw_entries and var not in RECOGNIZED_VARS and clean_val:
            warnings.append(f"[UNUSED_VARIABLE] Variable '{var}' is set in .env but unused in this build.")

        if clean_val or (var in raw_entries and raw_entries[var]):
            # URL in ID field
            is_url_in_id = False
            if re.search(r'(_ID$|_ACCOUNT_ID$|_PAGE_ID$)', var):
                if "facebook.com" in clean_val.lower() or clean_val.startswith("http://") or clean_val.startswith("https://"):
                    is_url_in_id = True
                elif var in raw_entries:
                    for _, raw_val in raw_entries[var]:
                        if "facebook.com" in raw_val.lower() or raw_val.strip().startswith("http://") or raw_val.strip().startswith("https://"):
                            is_url_in_id = True
                            break
            if is_url_in_id:
                warnings.append(f"[URL_IN_ID] Variable '{var}' suggests an ID field but contains a URL. Loader extracts numeric ID, but setting numeric ID directly is recommended.")

            # Session strings when feature is disabled
            if var.endswith("_SESSION") or var == "TELEGRAM_SESSION":
                tg_public_enabled = get_clean_env("TELEGRAM_PUBLIC_ENABLED", "0").lower() in ("1", "true", "yes")
                if not tg_public_enabled or "telegram" not in enabled_sources:
                    warnings.append(f"[UNUSED_SESSION_CREDENTIAL] '{var}' is set while Telegram MTProto/public collector is disabled. Note: Session strings represent full-account credentials.")

            # Neo4j password checks
            if var == "NEO4J_PASSWORD":
                if clean_val.lower() in {"neo4j", "password", "admin", "12345678", "root"}:
                    warnings.append("[DEFAULT_CREDENTIALS] NEO4J_PASSWORD equals a known insecure default password.")
                elif len(clean_val) < 12:
                    warnings.append(f"[WEAK_CREDENTIALS] NEO4J_PASSWORD is shorter than 12 characters (length: {len(clean_val)}).")

            # MongoDB URI checks
            if var == "MONGO_URI":
                # Atlas SRV check
                if clean_val.startswith("mongodb+srv://"):
                    warnings.append("[ATLAS_SECURITY_REMINDER] MONGO_URI is mongodb+srv. Reminder: Restrict MongoDB Atlas Network Access (IP Access List) to authorised deployment IPs (manual step).")

                # Local unauthenticated check
                if "localhost:27017" in clean_val and "@" not in clean_val:
                    warnings.append("[DEFAULT_CREDENTIALS] MONGO_URI uses unauthenticated local connection (mongodb://localhost:27017).")
                else:
                    # Parse password safely without printing
                    m_auth = re.search(r'mongodb(?:\+srv)?:\/\/(?:[^:]+:)?([^@]+)@', clean_val)
                    if m_auth:
                        pwd = m_auth.group(1)
                        if len(pwd) < 8:
                            warnings.append(f"[WEAK_CREDENTIALS] MONGO_URI contains credentials with a short password (<8 characters, length: {len(pwd)}).")
                        elif pwd.lower() in {"admin", "password", "root", "123456", "12345678", "pass", "test", "mongo"}:
                            warnings.append("[WEAK_CREDENTIALS] MONGO_URI contains credentials with a known common/default password.")

            # Token prefix checks
            if var == "META_ACCESS_TOKEN" and not clean_val.startswith("EAA"):
                warnings.append(f"[UNEXPECTED_PREFIX] '{var}' does not start with expected prefix 'EAA'.")
            elif var == "INSTAGRAM_ACCESS_TOKEN" and not (clean_val.startswith("IG") or clean_val.startswith("EAA")):
                warnings.append(f"[UNEXPECTED_PREFIX] '{var}' does not start with expected prefix 'IG' or 'EAA'.")
            elif var == "TELEGRAM_BOT_TOKEN" and not re.match(r'^\d+:', clean_val):
                warnings.append(f"[UNEXPECTED_PREFIX] '{var}' does not start with numeric bot ID prefix '<digits>:'.")
            elif var == "YOUTUBE_API_KEY" and not clean_val.startswith("AIza"):
                warnings.append(f"[UNEXPECTED_PREFIX] '{var}' does not start with standard Google prefix 'AIza'.")

    return rows, warnings


def check_env():
    print("=" * 80)
    print("          NETRA ENVIRONMENT AUDITOR & SHAPE VALIDATOR")
    print("=" * 80)

    rows, warnings = audit_environment()

    fmt = "{:<28} | {:<8} | {:<8} | {:<12}"
    header = fmt.format("Variable Name", "Status", "Length", "Prefix (3ch)")
    print(header)
    print("-" * len(header))

    for r in rows:
        print(fmt.format(r["name"], r["status"], r["length"], r["prefix"]))

    print("=" * 80)
    print(f"AUDIT SUMMARY: {len(warnings)} Warning(s) Detected")
    print("=" * 80)
    if warnings:
        for w in warnings:
            print(f"  ! {w}")
    else:
        print("  [OK] All environment variable shapes, prefixes, and credential policies pass inspection.")
    print("=" * 80)
    return 0


if __name__ == "__main__":
    sys.exit(check_env())