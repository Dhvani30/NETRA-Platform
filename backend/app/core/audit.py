"""
Audit logging for manual collection triggers, syncs, and collector lifecycle events.
Strictly ensures zero secrets, passwords, or tokens are logged.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.core.secret_masker import mask_secrets, sanitize_data

SENSITIVE_KEYS = {"token", "key", "secret", "password", "auth", "credential"}


def sanitize_dict(data: dict[str, Any] | None) -> dict[str, Any]:
    if not data:
        return {}
    return sanitize_data(data)


def record_collection_event(
    db,
    who: str,
    what: str,
    source: str | None = None,
    event_type: str = "collector_action",
    details: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Records an immutable audit event in the collection_events collection with full secret masking."""
    now = datetime.now(timezone.utc).isoformat()
    clean_what = mask_secrets(what)
    clean_details = sanitize_data(details) if details else {}
    event_doc = {
        "who": mask_secrets(who),
        "when": now,
        "what": clean_what,
        "source": source,
        "event_type": event_type,
        "details": clean_details
    }
    try:
        db["collection_events"].insert_one(event_doc)
    except Exception as e:
        # Non-blocking if collection fails
        print(f"[!] Failed to log collection event: {e}")
    return event_doc


def get_recent_collection_events(db, limit: int = 50) -> list[dict[str, Any]]:
    """Retrieves recent audit events for compliance inspections."""
    try:
        events = list(db["collection_events"].find(
            {},
            {"_id": 0}
        ).sort("when", -1).limit(limit))
        return events
    except Exception as e:
        print(f"[!] Error fetching collection events: {e}")
        return []
