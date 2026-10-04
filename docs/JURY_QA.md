# NETRA Intelligence Platform - Jury & Technical Evaluation Q&A

> **Purpose:** Honest, authoritative, and technically precise answers to the most rigorous questions from technical evaluators, intelligence officers, and jury members.

---

### Q1: "Are you really ingesting live data right now, or is this a canned simulation / replay?"

**Answer:**
> **We are ingesting genuine live data in real time.**
>
> You can verify this yourself on this machine in three ways:
> 1. **Live Demonstration:** Send a message to our configured Telegram bot right now. Within 2 seconds, you will observe the record appear on the Live Telemetry Feed with an authentic database timestamp (`created_at`) and an incrementing collection counter.
> 2. **Pipeline Telemetry:** Every incoming post is written to MongoDB (`social_intel.raw_posts`) with an exact `ingested_at` server timestamp and fanout via Server-Sent Events (`GET /api/v1/stream`). The ingest rate chart reflects actual database transactions, not periodic UI timers.
> 3. **Forensic Integrity Audit:** You can trigger `python scripts/integrity_check.py` or click *Re-verify Now* on the Sources page. The checker inspects every document in the database and verifies that live records fall strictly within current collection windows with valid platform IDs.

---

### Q2: "Why are X and Reddit labeled IMPORT or LIVE_THIRD_PARTY instead of LIVE?"

**Answer:**
> **Because we value forensic honesty over fake claims.**
>
> - **X (Twitter):** Following commercial API changes in 2023, access to the official live enterprise firehose costs $42,000/month. Any system claiming to offer unlimited "free official live X streaming" is either using brittle, unauthorized web scrapers (which violate platform terms and break under IP bans) or faking the feed. NETRA transparently uses verified public benchmark archives (`IMPORT`) plus an optional, rate-capped third-party live sample (`LIVE_THIRD_PARTY` via `twitterapi.io`) with strict daily budgets.
> - **Reddit:** Our developer application for official Reddit API access is currently under review. Rather than using unauthorized scrapers that compromise system stability, we ingest authenticated academic research datasets with complete chronological metadata. When the official API token is approved, live ingestion will activate immediately via our pre-wired connector.

---

### Q3: "Why can't your platform search arbitrary public Facebook or Instagram posts?"

**Answer:**
> **Meta's Platform Terms and API architecture strictly prohibit unauthorized public searches.**
>
> Unlike open protocols like Bluesky or Mastodon, Meta restricts Graph API access to accounts and Pages explicitly authorized by the developer:
> - **Facebook:** Ingestion requires Page Read permissions (`pages_read_engagement`, `pages_read_user_content`) on authorized company or institutional pages.
> - **Instagram:** Business Discovery is restricted to connected Professional/Creator accounts.
>
> Claiming to "monitor all public Facebook posts" without enterprise App Review permissions usually implies using unauthorized browser automation or botnets, which violates the Computer Fraud and Abuse Act (CFAA) and results in permanent domain blacklisting. NETRA operates strictly within compliant legal and technical parameters.

---

### Q4: "How do you protect privacy, prevent PII leaks, and safeguard API credentials?"

**Answer:**
> **Through multi-tier automated sanitization and forensic regex scanning:**
>
> 1. **Non-Invertible Identity Hashing:**
>    - Senders are never stored with raw phone numbers, full names, or handles.
>    - Every user identifier is cryptographically hashed: `SHA-256(user_id)` truncated to 12 characters (`usr_xxxxxxxxxxxx`).
> 2. **Pre-Storage Secret Redaction:**
>    - All connector ingestors route payloads through `sanitize_dict()`, which automatically scrubs fields matching `api_key`, `token`, `secret`, `password`, or `authorization`.
> 3. **Pattern-Based Integrity Scanner:**
>    - The integrity checker runs automated regex scans over all text and metadata fields to catch accidental leaks of Telegram Bot tokens (`\b\d{8,10}:[A-Za-z0-9_-]{35}\b`), Bearer tokens, or OAuth secrets.
> 4. **No Secrets in Preflight or Audit Logs:**
>    - The preflight checker prints only the *shape* and *length* of environment variables (e.g. `[OK] YOUTUBE_API_KEY is present (39 chars, ends with '...87b')`), never raw credentials.

---

### Q5: "Why do some documents show dates from weeks or months ago?"

**Answer:**
> **Because historical datasets are preserved with their authentic chronological timestamps.**
>
> In many demonstration systems, developers rewrite timestamps of old datasets to "today" to make the platform look active. In an intelligence context, **post-dating records is catastrophic data manipulation**.
>
> - If an imported Reddit or X post was authored on September 24, 2026, NETRA stores and displays `created_at: 2026-09-24T...`.
> - The UI provides time-window filters and an **Imported Dataset Notice** explaining the historical range.
> - The Integrity Checker explicitly flags and fails any document containing a future or synthetic timestamp mislabeled as `LIVE`.

---

### Q6: "How do you prevent quota exhaustion and rate limiting on platforms like YouTube?"

**Answer:**
> **With persistent budget trackers and backoff state machines:**
>
> - **YouTube Quota Budgeting:**
>   - YouTube Data API v3 allocates 10,000 quota units per day. A search call costs 100 units.
>   - NETRA maintains a persistent state document (`collector_state.youtube_quota`) tracking units consumed in the current Pacific Time day.
>   - If the quota ceiling is approached, the collector automatically transitions to `RATE_LIMITED` and calculates the exact countdown to midnight PT.
> - **Third-Party X Budget:**
>   - Enforces a configurable cap (`X_TP_DAILY_TWEET_BUDGET`, default 300 tweets). When exhausted, it halts queries gracefully without error.
> - **APScheduler Backoff:**
>   - Collectors retry with exponential backoff on network failures and record execution metadata in `collection_runs`.

---

### Q7: "How does the Integrity Checker work, and can someone fake the audit?"

**Answer:**
> **The Integrity Checker runs deterministic server-side validation directly against the database collection:**
>
> Every check inspects the underlying MongoDB documents:
> 1. **Source Mode Cross-Check:** Ensures no `LIVE_THIRD_PARTY`, `IMPORT`, or `SYNTH` document is labeled `LIVE`.
> 2. **ISO UTC & Future-Date Validation:** Parses every `created_at` timestamp with Python's `datetime.fromisoformat()` and confirms `created_at <= now_utc`.
> 3. **Identifier Presence:** Verifies that every live record has a native platform ID or permalink.
> 4. **Privacy Scanner:** Runs high-confidence regex patterns for credentials and raw handles across all documents.
> 5. **Import Provenance:** Confirms that all `IMPORT` documents carry `dataset` and `source_file` fields.
>
> If even a single document violates any rule, the checker returns `verdict: "FAIL"` with the exact offending document IDs.

---

### Q8: "How does the platform scale if collection volume increases 100x?"

**Answer:**
> **The architecture is decoupled for horizontal scalability:**
>
> 1. **Storage Tier:** MongoDB collection `raw_posts` is indexed on `(platform, post_id)` [unique], `created_at`, `collected_at`, `source_mode`, and `topic_id`. It natively supports sharding across a cluster.
> 2. **Streaming Tier:** Live telemetry uses Server-Sent Events with in-memory fanout and fallback HTTP cursor polling (`/api/v1/events/latest?since=...`). For 100x scale, this seamlessly transitions to Redis Pub/Sub or Apache Kafka without modifying the frontend.
> 3. **Collector Tier:** Collectors run as independent stateless workers scheduled via APScheduler or Celery workers.
> 4. **Graph Intelligence:** Graph relationships can be persisted and queried in Neo4j, with seamless in-memory graph clustering fallback when running on a single evaluation laptop.

---

### Q9: "What happens if an external API or conference Wi-Fi fails during evaluation?"

**Answer:**
> **The system features graceful, zero-downtime offline degradation:**
>
> - All previously ingested intelligence remains fully searchable in MongoDB.
> - The **Timeline Chart**, **Sentiment Engine**, **Cross-Platform Correlation**, and **Network Graph** continue serving verified database records.
> - The **Integrity Checker** runs completely on-device without requiring external internet.
> - If live collectors encounter network disconnects, their status switches to `DEGRADED` or `IDLE` with clear error messages, and scheduled retries resume automatically once connectivity returns.
