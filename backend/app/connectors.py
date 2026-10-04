"""Connector state shared by collectors and source-health reporting."""
from __future__ import annotations

from datetime import datetime, timezone

SOURCE_STATUSES = {
    "LIVE", "IMPORT", "READY", "CREDENTIALS_REQUIRED", "PERMISSION_REQUIRED",
    "RATE_LIMITED", "NO_CREDITS", "DEGRADED", "DISABLED", "ERROR", "NOT_ENABLED",
}


def set_connector_status(db, source: str, status: str, *, mode: str | None = None,
                         message: str | None = None, success: bool = False,
                         reason: str | None = None, **extra) -> None:
    if status not in SOURCE_STATUSES:
        raise ValueError(f"Unsupported connector status: {status}")
    now = datetime.now(timezone.utc).isoformat()
    fields = {"status": status, "updated_at": now}
    if mode:
        fields["mode"] = mode
    if reason:
        fields["reason"] = reason
    if success:
        fields["last_success"] = now
        fields["last_error"] = None
    elif message:
        fields["last_error"] = message
    if extra:
        fields.update(extra)
    db["collector_state"].update_one({"_id": f"connector:{source}"}, {"$set": fields}, upsert=True)


def connector_status(db, source: str) -> dict:
    return db["collector_state"].find_one({"_id": f"connector:{source}"}) or {}
