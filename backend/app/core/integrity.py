"""
Authoritative Integrity Checker for NETRA Intelligence Platform.
Validates live collection windows, source labeling, privacy guarantees,
timestamp ISO validity, and dataset provenance across all ingested records.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone, timedelta
from typing import Any
from collections import defaultdict

TOKEN_PATTERNS = [
    re.compile(r'\b\d{8,10}:[A-Za-z0-9_-]{35}\b'),  # Telegram bot tokens
    re.compile(r'Bearer\s+[A-Za-z0-9_\-\.]{20,}'),     # Bearer tokens
    re.compile(r'(?:api[_-]?key|token|secret)[=:\s]+["\']?([A-Za-z0-9_\-]{20,})', re.IGNORECASE),  # API keys
]

FORBIDDEN_PROFILE_KEYS = {
    "userName", "screen_name", "author_username", "description", "profile_bio"
}


def parse_iso_utc(ts: Any) -> datetime | None:
    """Parses ISO timestamp string into UTC datetime, returning None if invalid."""
    if not ts or not isinstance(ts, str):
        return None
    try:
        # Handles Z and +00:00 offsets
        clean = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def run_integrity_check(mongo_client, db_name: str = "social_intel") -> dict[str, Any]:
    """
    Executes comprehensive forensic verification over the raw_posts collection.
    Returns audit counts and explicit pass/fail verdict per source and category.
    """
    db = mongo_client[db_name]
    raw_posts = db["raw_posts"]

    now = datetime.now(timezone.utc)
    max_future_time = now + timedelta(minutes=5)  # 5-minute skew tolerance

    all_docs = list(raw_posts.find({}, {
        "platform": 1,
        "source_mode": 1,
        "metadata.source_mode": 1,
        "post_id": 1,
        "native_id": 1,
        "canonical_id": 1,
        "url": 1,
        "urls": 1,
        "created_at": 1,
        "published_at": 1,
        "collected_at": 1,
        "ingested_at": 1,
        "dataset": 1,
        "source_file": 1,
        "author": 1,
        "author_username": 1,
        "text": 1,
        "text_content": 1
    }))

    total_count = len(all_docs)

    # Per-source tallies
    sources = defaultdict(lambda: {
        "total": 0,
        "live_count": 0,
        "import_count": 0,
        "third_party_count": 0,
        "synth_count": 0,
        "valid_timestamps": 0,
        "null_timestamps": 0,
        "future_timestamps": 0,
        "missing_identifier": 0,
        "mislabeled_live": 0,
        "privacy_violations": 0,
        "missing_import_provenance": 0,
        "issues": []
    })

    global_issues = []
    privacy_violations_count = 0
    mislabeled_live_count = 0
    future_timestamps_count = 0
    missing_import_provenance_count = 0
    missing_identifier_count = 0
    null_timestamps_count = 0
    valid_timestamps_count = 0

    for doc in all_docs:
        platform = str(doc.get("platform") or "unknown").lower()
        src = sources[platform]
        src["total"] += 1

        source_mode = str(doc.get("source_mode") or "SYNTH").upper()
        if source_mode == "LIVE":
            src["live_count"] += 1
        elif source_mode == "LIVE_THIRD_PARTY":
            src["third_party_count"] += 1
        elif source_mode == "IMPORT":
            src["import_count"] += 1
        else:
            src["synth_count"] += 1

        # Check 1: Valid UTC ISO created_at and future timestamp checks
        raw_created = doc.get("created_at") or doc.get("published_at")
        if not raw_created:
            src["null_timestamps"] += 1
            null_timestamps_count += 1
            src["issues"].append(f"Document {doc.get('post_id')} has missing created_at")
        else:
            parsed_dt = parse_iso_utc(raw_created)
            if not parsed_dt:
                src["null_timestamps"] += 1
                null_timestamps_count += 1
                src["issues"].append(f"Document {doc.get('post_id')} has invalid ISO timestamp: {raw_created}")
            else:
                src["valid_timestamps"] += 1
                valid_timestamps_count += 1
                if parsed_dt > max_future_time:
                    src["future_timestamps"] += 1
                    future_timestamps_count += 1
                    issue_msg = f"Document {doc.get('post_id')} timestamp {raw_created} is in the future"
                    src["issues"].append(issue_msg)
                    global_issues.append(issue_msg)

        # Check 2: LIVE documents must have an identifier and created_at
        if source_mode == "LIVE":
            has_id = bool(doc.get("post_id") or doc.get("native_id") or doc.get("canonical_id") or doc.get("url") or (doc.get("urls") and doc.get("urls")[0]))
            if not has_id:
                src["missing_identifier"] += 1
                missing_identifier_count += 1
                issue_msg = f"LIVE document on {platform} missing permalink and platform ID"
                src["issues"].append(issue_msg)
                global_issues.append(issue_msg)

        # Check 3: Labeling Integrity: LIVE_THIRD_PARTY, IMPORT, and SYNTH never labeled LIVE
        meta_mode = ((doc.get("metadata") or {}).get("source_mode") or "").upper()
        if source_mode == "LIVE":
            if meta_mode in {"IMPORT", "REPLAY", "LIVE_THIRD_PARTY", "THIRD_PARTY", "SYNTH", "SYNTHETIC"}:
                src["mislabeled_live"] += 1
                mislabeled_live_count += 1
                issue_msg = f"Document {doc.get('post_id')} labeled LIVE but metadata indicates {meta_mode}"
                src["issues"].append(issue_msg)
                global_issues.append(issue_msg)
            elif platform == "x":
                # X cannot be labeled LIVE official API; must be LIVE_THIRD_PARTY or IMPORT
                src["mislabeled_live"] += 1
                mislabeled_live_count += 1
                issue_msg = f"X document {doc.get('post_id')} mislabeled LIVE (must be LIVE_THIRD_PARTY or IMPORT)"
                src["issues"].append(issue_msg)
                global_issues.append(issue_msg)

        # Check 4: Privacy & Token Leakage Prevention
        has_privacy_issue = False
        if doc.get("author_username"):
            has_privacy_issue = True
        author_dict = doc.get("author")
        if isinstance(author_dict, dict):
            for k in FORBIDDEN_PROFILE_KEYS:
                if author_dict.get(k):
                    has_privacy_issue = True
                    break

        # Token pattern search in text content
        content_text = f"{doc.get('text', '')} {doc.get('text_content', '')} {doc.get('url', '')}"
        for pat in TOKEN_PATTERNS:
            if pat.search(content_text):
                has_privacy_issue = True
                break

        if has_privacy_issue:
            src["privacy_violations"] += 1
            privacy_violations_count += 1
            issue_msg = f"Document {doc.get('post_id')} violates privacy / contains raw handle or secret token"
            src["issues"].append(issue_msg)
            global_issues.append(issue_msg)

        # Check 5: IMPORT documents must carry dataset and source_file
        if source_mode == "IMPORT":
            has_dataset = bool(doc.get("dataset") and str(doc.get("dataset")).strip() not in {"None", ""})
            has_source_file = bool(doc.get("source_file") and str(doc.get("source_file")).strip() not in {"None", ""})
            if not has_dataset or not has_source_file:
                src["missing_import_provenance"] += 1
                missing_import_provenance_count += 1
                issue_msg = f"IMPORT document {doc.get('post_id')} on {platform} missing dataset or source_file"
                src["issues"].append(issue_msg)
                global_issues.append(issue_msg)

    # Calculate status per source
    per_source_report = {}
    for platform, data in sources.items():
        is_clean = (
            data["mislabeled_live"] == 0 and
            data["privacy_violations"] == 0 and
            data["future_timestamps"] == 0 and
            data["missing_identifier"] == 0 and
            data["missing_import_provenance"] == 0
        )
        per_source_report[platform] = {
            "total": data["total"],
            "live_count": data["live_count"],
            "third_party_count": data["third_party_count"],
            "import_count": data["import_count"],
            "synth_count": data["synth_count"],
            "valid_timestamps": data["valid_timestamps"],
            "null_timestamps": data["null_timestamps"],
            "future_timestamps": data["future_timestamps"],
            "time_series_available": data["valid_timestamps"] > 0,
            "privacy_clean": data["privacy_violations"] == 0,
            "source_mode_clean": data["mislabeled_live"] == 0,
            "identifier_clean": data["missing_identifier"] == 0,
            "import_provenance_clean": data["missing_import_provenance"] == 0,
            "status": "PASS" if is_clean else "FAIL",
            "issues": data["issues"][:5]  # Cap reported issues
        }

    overall_pass = (
        privacy_violations_count == 0 and
        mislabeled_live_count == 0 and
        future_timestamps_count == 0 and
        missing_import_provenance_count == 0 and
        missing_identifier_count == 0
    )

    return {
        "verdict": "PASS" if overall_pass else "FAIL",
        "total_documents": total_count,
        "checked_at": now.isoformat(),
        "summary": {
            "live_documents": sum(s["live_count"] for s in sources.values()),
            "third_party_documents": sum(s["third_party_count"] for s in sources.values()),
            "imported_documents": sum(s["import_count"] for s in sources.values()),
            "synthetic_documents": sum(s["synth_count"] for s in sources.values()),
            "valid_utc_timestamps": valid_timestamps_count,
            "null_timestamps": null_timestamps_count,
            "future_timestamps": future_timestamps_count,
            "time_series_available": valid_timestamps_count > 0,
            "privacy_violations": privacy_violations_count,
            "mislabeled_live": mislabeled_live_count,
            "missing_identifiers": missing_identifier_count,
            "missing_import_provenance": missing_import_provenance_count
        },
        "per_source": per_source_report,
        "issues": global_issues[:20]
    }
