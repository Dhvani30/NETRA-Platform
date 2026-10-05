import os
import sys
import logging
from datetime import datetime, timezone
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from pymongo import MongoClient
from dotenv import load_dotenv
from app.core.env_utils import get_clean_env, is_source_enabled

# Path resolution for .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

MONGO_URI = get_clean_env("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = get_clean_env("DB_NAME", "social_intel")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("NETRA.Scheduler")

def get_db():
    return MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)[DB_NAME]

def record_collection_run(source: str, started_at: datetime, finished_at: datetime, status: str,
                          count: int, error: str = None, quota_used: int = 0,
                          api_calls: int = 0, cost_usd: float = 0.0,
                          items_fetched: int | None = None,
                          items_inserted: int | None = None):
    """Logs a run record to collection_runs collection."""
    try:
        db = get_db()
        record = {
            "source": source,
            "started_at": started_at.isoformat(),
            "finished_at": finished_at.isoformat(),
            "status": status,
            "count": count or 0,
            "items_fetched": count if items_fetched is None else items_fetched,
            "items_inserted": count if items_inserted is None else items_inserted,
            "error": error,
            "api_calls": api_calls or 0,
            "duration_seconds": round((finished_at - started_at).total_seconds(), 3),
        }
        if quota_used is not None:
            record["quota_used"] = quota_used
        if cost_usd is not None and cost_usd > 0:
            record["cost_usd"] = cost_usd
            record["estimated_cost_usd"] = cost_usd
        db["collection_runs"].insert_one(record)
        from app.core.heartbeats import update_heartbeat
        from app.core.audit import record_collection_event
        mode = "LIVE_THIRD_PARTY" if source == "x" else ("IMPORT" if source == "reddit" and status.lower() == "success" else "LIVE")
        update_heartbeat(db, source, status, mode, started_at, finished_at, count or 0, error)
        record_collection_event(
            db,
            who="scheduler",
            what=f"Collector {source} run finished: status={status}, items={count or 0}",
            source=source,
            event_type="collector_run",
            details={"items": count or 0, "status": status, "api_calls": api_calls or 0, "duration_seconds": (finished_at - started_at).total_seconds()}
        )
    except Exception as e:
        logger.error(f"Failed to record collection_run for {source}: {e}")

def run_job_safely(source: str, job_func) -> int:
    """Executes a job, logs outcomes, records to collection_runs, and prevents scheduler crash."""
    started_at = datetime.now(timezone.utc)
    status = "success"
    err_msg = None
    count = 0
    quota_used = 0
    api_calls = 0
    cost_usd = 0.0
    items_fetched = 0
    items_inserted = 0
    try:
        res = job_func()
        if hasattr(res, "summary"):
            summary = res.summary
            count = summary.get("count", int(res))
            items_fetched = summary.get("items_fetched", count)
            items_inserted = summary.get("items_inserted", count)
            quota_used = summary.get("quota_used", 0)
            api_calls = summary.get("api_calls", 0)
            status = summary.get("status", status)
        elif isinstance(res, dict):
            summary = res.get("summary", res)
            count = summary.get("count", 0)
            items_fetched = summary.get("items_fetched", count)
            inserted = summary.get("items_inserted", summary.get("inserted", count))
            items_inserted = sum(inserted.values()) if isinstance(inserted, dict) else inserted
            quota_used = summary.get("quota_used", 0)
            api_calls = summary.get("api_calls", 0)
            status = summary.get("status", status)
            # Collectors use this for non-exception outcomes such as an
            # intentionally skipped source.  Persist it so operators can see
            # why no collection took place without inspecting logs.
            if str(status).upper() not in {"SUCCESS", "LIVE", "IMPORT", "READY"}:
                err_msg = summary.get("error") or summary.get("message") or summary.get("reason")
                if not err_msg:
                    # Multi-platform collectors return a summary plus a
                    # per-platform outcome (for example, Meta).
                    err_msg = next(
                        (item.get("error") or item.get("message") or item.get("reason")
                         for item in res.values() if isinstance(item, dict)
                         and (item.get("error") or item.get("message") or item.get("reason"))),
                        None,
                    )
            cost_usd = float(summary.get("estimated_cost_usd") or summary.get("cost_usd") or 0.0)
        elif isinstance(res, int):
            count = res
            items_fetched = count
            items_inserted = count
        elif isinstance(res, (list, tuple)):
            count = len(res)
            items_fetched = count
            items_inserted = count
    except Exception as e:
        status = "error"
        err_msg = str(e)
        logger.error(f"Job execution failed for '{source}': {e}", exc_info=True)
    finally:
        finished_at = datetime.now(timezone.utc)
        record_collection_run(source, started_at, finished_at, status, count, err_msg,
                              quota_used=quota_used, api_calls=api_calls, cost_usd=cost_usd,
                              items_fetched=items_fetched, items_inserted=items_inserted)
        if source in {"telegram", "reddit", "youtube", "meta"}:
            try:
                from app.connectors import set_connector_status
                db = get_db()
                source_status = status.upper()
                if source_status == "SUCCESS":
                    source_status = "IMPORT" if source == "reddit" else "LIVE"
                if source_status.startswith("SKIPPED"):
                    source_status = "DISABLED"
                if source_status == "QUOTA_EXCEEDED":
                    source_status = "NO_CREDITS"
                targets = ("facebook", "instagram") if source == "meta" else (source,)
                for target in targets:
                    # Meta ingestor owns specific permission/rate states.
                    if source != "meta" or source_status in {"LIVE", "IMPORT", "DISABLED", "ERROR"}:
                        set_connector_status(db, target, source_status, mode="IMPORT" if source == "reddit" else "LIVE",
                                             message=err_msg, success=source_status in {"LIVE", "IMPORT"})
            except Exception as state_error:
                logger.warning(f"Failed to record connector status for '{source}': {state_error}")
    return count

# --- Individual Job Handlers ---

def job_telegram():
    if not is_source_enabled("telegram"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.telegram_ingestor import poll_once
    return poll_once()

def job_reddit():
    if not is_source_enabled("reddit"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    if get_clean_env("REDDIT_CLIENT_ID") and get_clean_env("REDDIT_CLIENT_SECRET"):
        try:
            from app.collectors.reddit_collector import ingest_reddit_posts
            c = ingest_reddit_posts()
            if c:
                return c
        except Exception as e:
            logger.warning(f"Live Reddit collector failed, falling back to replay: {e}")
    if get_clean_env("ENABLE_DATASET_IMPORT", "0").lower() in ("1", "true", "yes"):
        from app.collectors.reddit_ingestor import run_replay_ingestor
        return run_replay_ingestor()
    return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}

def job_youtube():
    if not is_source_enabled("youtube"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.youtube_ingestor import ingest_youtube_videos
    return ingest_youtube_videos()

def job_bluesky():
    if not is_source_enabled("bluesky"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.bluesky_collector import ingest_bluesky
    return ingest_bluesky()

def job_mastodon():
    if not is_source_enabled("mastodon"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.mastodon_collector import ingest_mastodon
    return ingest_mastodon()

def job_telegram_public():
    if not is_source_enabled("telegram") or not (get_clean_env("TELEGRAM_PUBLIC_ENABLED", "0").lower() in ("1", "true", "yes")):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Telegram public collector not enabled."}
    from app.collectors.telegram_public_collector import ingest_telegram_public
    return ingest_telegram_public()

def job_x_thirdparty():
    if not is_source_enabled("x"):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.x_thirdparty_ingestor import ingest_x_thirdparty
    return ingest_x_thirdparty()

def job_meta(platform=None):
    if platform and not is_source_enabled(platform):
        return {"count": 0, "status": "DISABLED", "reason": "not_enabled_in_this_build", "message": "Not enabled in this build."}
    from app.collectors.meta_ingestor import ingest_meta
    return ingest_meta(platform=platform)


def missing_credentials(source: str) -> str | None:
    """Return a safe human-readable missing-configuration reason, never a value."""
    required = {
        "telegram": ("TELEGRAM_BOT_TOKEN",),
        "youtube": ("YOUTUBE_API_KEY",),
        "facebook": ("META_ACCESS_TOKEN", "META_FACEBOOK_PAGE_ID"),
        # Instagram can use either its Login token or the Page token.
        "instagram": (),
        "reddit": ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"),
        "bluesky": ("BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD"),
        "mastodon": ("MASTODON_INSTANCE",),
        "x": ("TWITTERAPI_IO_KEY",),
    }
    if source == "instagram":
        if not (get_clean_env("INSTAGRAM_ACCESS_TOKEN") or get_clean_env("META_ACCESS_TOKEN")):
            return "INSTAGRAM_ACCESS_TOKEN or META_ACCESS_TOKEN"
        return None
    missing = [name for name in required.get(source, ()) if not get_clean_env(name)]
    return ", ".join(missing) if missing else None


def run_once() -> list[dict]:
    """Run every enabled collector once, recording one durable result per source."""
    jobs = {
        "telegram": job_telegram,
        "youtube": job_youtube,
        "facebook": lambda: job_meta("facebook"),
        "instagram": lambda: job_meta("instagram"),
        "reddit": job_reddit,
        "bluesky": job_bluesky,
        "mastodon": job_mastodon,
        "x": job_x_thirdparty,
    }
    outcomes = []
    for source, job in jobs.items():
        if not is_source_enabled(source):
            continue
        missing = missing_credentials(source)
        if missing:
            # Send a normal result through the same safe wrapper, so skipped
            # jobs are auditable and never prevent later sources from running.
            result = {"count": 0, "items_fetched": 0, "items_inserted": 0,
                      "status": "skipped: missing credentials",
                      "message": f"Missing credentials: {missing}"}
            run_job_safely(source, lambda r=result: r)
            outcomes.append({"source": source, "status": result["status"], "error": result["message"]})
            continue
        try:
            count = run_job_safely(source, job)
            outcomes.append({"source": source, "status": "finished", "count": count})
        except Exception as exc:  # Defensive: one source can never abort the pass.
            logger.exception("Unexpected once-mode wrapper failure for %s", source)
            outcomes.append({"source": source, "status": "error", "error": str(exc)})
    return outcomes

def job_meta_token_health(platform):
    """Daily, read-only token health check kept separate from polling."""
    from app.collectors.meta_ingestor import check_token_health
    return {"count": 0, "status": "LIVE" if check_token_health(get_db(), platform).get("valid") else "DEGRADED"}

def job_analytics():
    from app.analytic_engine import run_ai_analytics
    return run_ai_analytics()

def job_graph():
    from app.graph_builder import build_knowledge_graph
    return build_knowledge_graph()

def job_trends():
    from app.trends.engine import materialize
    db = get_db()
    return len(materialize(db, db[get_clean_env("COLLECTION_NAME", "raw_posts")]))

def start_scheduler():
    """Initializes and starts the BackgroundScheduler with active continuous tasks (Telegram, YouTube, Meta)."""
    scheduler = BackgroundScheduler(daemon=True)
    db = get_db()

    # Mark disabled-by-default sources in collector_state
    from app.connectors import set_connector_status
    all_sources = ["telegram", "youtube", "facebook", "instagram", "bluesky", "mastodon", "x", "reddit"]
    for src in all_sources:
        if not is_source_enabled(src):
            set_connector_status(db, src, "DISABLED", mode="DISABLED", message="Not enabled in this build.", reason="not_enabled_in_this_build")

    # 1. Telegram poller every 5 seconds (ACTIVE SCOPE: only if enabled)
    if is_source_enabled("telegram"):
        scheduler.add_job(
            func=lambda: run_job_safely("telegram", job_telegram),
            trigger="interval",
            seconds=5,
            id="job_telegram",
            name="Telegram Live Ingestor",
            max_instances=1,
            coalesce=True
        )

    if is_source_enabled("telegram") and (get_clean_env("TELEGRAM_PUBLIC_ENABLED", "0").lower() in ("1", "true", "yes")):
        scheduler.add_job(func=lambda: run_job_safely("telegram_public", job_telegram_public), trigger="interval", minutes=5,
                          jitter=13, id="job_telegram_public", name="Telegram Public Channel Ingestor", max_instances=1, coalesce=True)

    # 2. YouTube ingestor every 30 minutes (ACTIVE SCOPE: only if enabled)
    if is_source_enabled("youtube"):
        scheduler.add_job(
            func=lambda: run_job_safely("youtube", job_youtube),
            trigger="interval",
            minutes=30,
            jitter=30,
            id="job_youtube",
            name="YouTube Ingestor",
            max_instances=1,
            coalesce=True
        )

    # 3. Authorized Meta Graph API collection (ACTIVE SCOPE: Facebook + Instagram, only if enabled)
    meta_seconds = max(30, int(get_clean_env("META_POLL_SECONDS", "300")))
    for platform, jitter in (("facebook", 7), ("instagram", 19)):
        if is_source_enabled(platform):
            scheduler.add_job(func=lambda p=platform: run_job_safely(p, lambda: job_meta(p)), trigger="interval",
                              seconds=meta_seconds, jitter=jitter, id=f"job_meta_{platform}",
                              name=f"Meta {platform.title()} Graph API Ingestor", max_instances=1, coalesce=True)
            scheduler.add_job(func=lambda p=platform: run_job_safely(f"{p}_token_health", lambda: job_meta_token_health(p)), trigger="interval",
                              days=1, jitter=jitter + 41, id=f"job_meta_{platform}_token_health",
                              name=f"Meta {platform.title()} Token Health", max_instances=1, coalesce=True)

    # Conditionally schedule other collectors ONLY if explicitly enabled
    if is_source_enabled("bluesky"):
        scheduler.add_job(func=lambda: run_job_safely("bluesky", job_bluesky), trigger="interval", minutes=10,
                          jitter=23, id="job_bluesky", name="Bluesky Public Search", max_instances=1, coalesce=True)

    if is_source_enabled("mastodon"):
        scheduler.add_job(func=lambda: run_job_safely("mastodon", job_mastodon), trigger="interval", minutes=10,
                          jitter=31, id="job_mastodon", name="Mastodon Public Timeline", max_instances=1, coalesce=True)

    if is_source_enabled("x") and get_clean_env("TWITTERAPI_IO_KEY"):
        scheduler.add_job(func=lambda: run_job_safely("x", job_x_thirdparty), trigger="interval", minutes=30,
                          jitter=37, id="job_x_thirdparty", name="X Third-Party Capped Sample", max_instances=1, coalesce=True)

    if is_source_enabled("reddit"):
        scheduler.add_job(
            func=lambda: run_job_safely("reddit", job_reddit),
            trigger="interval",
            minutes=15,
            id="job_reddit",
            name="Reddit Ingestor",
            max_instances=1,
            coalesce=True
        )

    # 5. AI Analytics Engine every 10 minutes
    scheduler.add_job(
        func=lambda: run_job_safely("analytic_engine", job_analytics),
        trigger="interval",
        minutes=10,
        id="job_analytics",
        name="AI Analytics Engine",
        max_instances=1,
        coalesce=True
    )

    # 5. Semantic & User Knowledge Graph Builder every 10 minutes
    scheduler.add_job(
        func=lambda: run_job_safely("graph_builder", job_graph),
        trigger="interval",
        minutes=10,
        id="job_graph",
        name="Graph Builder & User Edges",
        max_instances=1,
        coalesce=True
    )

    scheduler.start()
    logger.info("NETRA Continuous Background Scheduler started successfully.")
    try:
        from app.core.audit import record_collection_event
        record_collection_event(get_db(), who="system", what="Continuous background scheduler started", event_type="scheduler_start")
    except Exception:
        pass
    return scheduler

if __name__ == "__main__":
    import time
    if "--once" in sys.argv:
        for outcome in run_once():
            logger.info("once: %s", outcome)
        raise SystemExit(0)
    logger.info("Starting scheduler in standalone test mode...")
    sched = start_scheduler()
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        sched.shutdown()
        try:
            from app.core.audit import record_collection_event
            record_collection_event(get_db(), who="system", what="Continuous background scheduler stopped", event_type="scheduler_stop")
        except Exception:
            pass
        logger.info("Scheduler stopped.")
