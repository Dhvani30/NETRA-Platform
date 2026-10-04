"""Read-only, secret-safe diagnostic for the authorized Meta collector."""
from __future__ import annotations

import re
import sys
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
load_dotenv(ROOT / ".env")

from app.core.env_utils import env_was_cleaned, get_clean_env, validate_token_shape
from app.collectors.meta_ingestor import _ok, _redact


def _check_env(name: str, *, token_prefix: str | None = None, required: bool = False) -> bool:
    raw = os.environ.get(name, "")
    value = get_clean_env(name)
    state = "present" if raw else "missing"
    cleaned = "cleaned" if env_was_cleaned(name) else "clean"
    if token_prefix:
        # Validate raw input: diagnostics must expose paste artefacts before a
        # collector can normalize them away. Only non-secret facts are shown.
        shape = validate_token_shape(raw, token_prefix)
        detail = "ok" if shape["ok"] else ",".join(shape["problems"])
        print(f"{name}: {state}; {cleaned}; length={len(raw)}; shape={detail}")
        return shape["ok"] or (not required and not value)
    print(f"{name}: {state}; {cleaned}; length={len(value)}")
    return bool(value) or not required


def _response_ok(response: httpx.Response, label: str) -> bool:
    if _ok(response):
        print(f"{label}: ok")
        return True
    try:
        code = response.json().get("error", {}).get("code", "unknown")
    except ValueError:
        code = "unknown"
    print(f"{label}: failed; Graph error code={code}")
    return False


def _recent_count(client: httpx.Client, url: str, token: str, label: str) -> bool:
    response = client.get(url, params={"fields": "id", "limit": 25, "access_token": token}, timeout=20)
    if not _response_ok(response, f"{label} access"):
        return False
    print(f"{label} recent posts: {len(response.json().get('data', []))} (up to 25 checked)")
    return True


def main() -> int:
    print(f".env file: {'found' if (ROOT / '.env').exists() else 'missing'}")
    env_ok = _check_env("META_ACCESS_TOKEN", token_prefix="EAA", required=True)
    env_ok &= _check_env("META_FACEBOOK_PAGE_ID", required=True)
    graph_version = get_clean_env("META_GRAPH_VERSION", "v26.0")
    version_ok = bool(re.fullmatch(r"v\d+(?:\.\d+)?", graph_version))
    print(f"META_GRAPH_VERSION: {'valid' if version_ok else 'invalid'}; length={len(graph_version)}")
    ig_token_ok = _check_env("INSTAGRAM_ACCESS_TOKEN", token_prefix="IG")
    _check_env("INSTAGRAM_ACCOUNT_ID")
    _check_env("META_INSTAGRAM_ACCOUNT_ID")
    _check_env("META_APP_ID")
    _check_env("META_APP_SECRET")

    page_token = get_clean_env("META_ACCESS_TOKEN")
    page_id = get_clean_env("META_FACEBOOK_PAGE_ID")
    ig_token = get_clean_env("INSTAGRAM_ACCESS_TOKEN")
    ig_id = get_clean_env("INSTAGRAM_ACCOUNT_ID") or get_clean_env("META_INSTAGRAM_ACCOUNT_ID")
    passed = env_ok and version_ok and ig_token_ok
    next_steps: list[str] = []
    if not passed:
        next_steps.append("Correct the missing or malformed required values, then rerun this read-only check.")
        print("What to do next:\n- " + "\n- ".join(next_steps))
        return 1

    try:
        with httpx.Client() as client:
            token_response = client.get(
                f"https://graph.facebook.com/{graph_version}/me",
                params={"fields": "id", "access_token": page_token}, timeout=20,
            )
            if not _response_ok(token_response, "Facebook token validity"):
                next_steps.append("Regenerate or renew the system-user/Page token and confirm it has Page access.")
                passed = False
            page_response = client.get(
                f"https://graph.facebook.com/{graph_version}/{page_id}",
                params={"fields": "id,instagram_business_account", "access_token": page_token}, timeout=20,
            )
            page_ok = _response_ok(page_response, "Facebook Page access")
            passed &= page_ok
            if page_ok:
                _recent_count(client, f"https://graph.facebook.com/{graph_version}/{page_id}/posts", page_token, "Facebook")
                linked_id = (page_response.json().get("instagram_business_account") or {}).get("id")
                ig_id = ig_id or linked_id
            if not ig_id:
                print("Instagram linked account: not found")
                next_steps.append("Link a professional Instagram account to the Facebook Page, or set INSTAGRAM_ACCOUNT_ID.")
                passed = False
            else:
                ig_host = "https://graph.instagram.com" if ig_token else "https://graph.facebook.com"
                active_token = ig_token or page_token
                passed &= _recent_count(client, f"{ig_host}/{graph_version}/{ig_id}/media", active_token, "Instagram")
    except httpx.HTTPError as exc:
        print(f"Network check: failed; {_redact(exc)}")
        next_steps.append("Check network access to graph.facebook.com and rerun this script.")
        passed = False

    if not next_steps and passed:
        next_steps.append("Configuration checks passed. Run the collector; an empty feed is expected until the Page or account has content.")
    print("What to do next:\n- " + "\n- ".join(next_steps))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
