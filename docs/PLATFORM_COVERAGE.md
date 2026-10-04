# NETRA Intelligence Platform - Platform Coverage & Data Ingestion Matrix

> **Core Tenet:** Truth in Advertising. Every platform's technical boundary, commercial terms, and compliance scope are stated honestly. NETRA never misrepresents imported archives as live, never disguises scrapers as official enterprise endpoints, and adheres to provider Terms of Service.

---

## Authoritative Coverage Matrix

| Platform | Ingestion Mode | Public Topic Monitoring? | Technical Method | Credential Requirements | Quota / Rate Limits | Compliance & Legal Boundary |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Telegram** | `LIVE` | Yes (Configured public channels & bot) | Telegram Bot API `getUpdates` + MTProto public channel reader | `TELEGRAM_BOT_TOKEN` | 30 requests/sec | Official Telegram Bot API; monitors public broadcast channels and configured topic groups. |
| **YouTube** | `LIVE` | Yes (Global public video & comment search) | YouTube Data API v3 (`search().list`, `videos().list`) | `YOUTUBE_API_KEY` | 10,000 quota units/day (~100 search queries) | Official Google Cloud YouTube Data API; enforces automatic quota budget tracking reset daily at Midnight PT. |
| **Bluesky** | `LIVE` | Yes (Global public post search & firehose) | AT Protocol public search endpoint (`app.bsky.feed.searchPosts`) | `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD` | 3,000 queries/5 min | Decentralized authenticated AT Protocol public API; completely permissible for open-source intelligence. |
| **Mastodon** | `LIVE` | Yes (Public federated hashtag/topic search) | Mastodon REST API v1 (`/api/v1/timelines/tag/`, `/api/v1/search`) | None required for public instances; optional access token | 300 requests/5 min per instance | Fully federated open-source Fediverse protocol; queries public instances with zero vendor lock-in. |
| **X (Twitter)** | `IMPORT` + `LIVE_THIRD_PARTY` | Capped Sample (Third-party) + Historical Archives | Historical research datasets (`IMPORT`) + `twitterapi.io` advanced search (`LIVE_THIRD_PARTY`) | `TWITTERAPI_IO_KEY` | Hard daily budget (default 300 tweets/day) | **Honest Statement:** Official X API Enterprise firehose costs $42,000/month. NETRA relies on verified research datasets plus an optional capped third-party sample. It is **never** labeled official X API. |
| **Reddit** | `IMPORT` | Pending Official API Approval | Pre-collected academic benchmark datasets (`IMPORT`) | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` (configured) | 100 queries/min (when approved) | **Honest Statement:** Reddit developer application is in review. To ensure demo reliability and prevent IP bans, historical research archives are utilized with explicit chronological provenance. |
| **Facebook** | API-reported status | API-reported authorized Page scope | Meta Graph API Page route | Page Access Token | API-reported | The dashboard reports connector status, route, token expiry and last sync from `/health/sources`; it never labels a connected source “restricted”. |
| **Instagram** | API-reported status | API-reported connected account scope | Instagram Login or Page Graph route | Meta Access Token | API-reported | The dashboard reports connector status, route, token expiry and last sync from `/health/sources`; it never labels a connected source “restricted”. |

---

## Detailed Platform Breakdowns

### 1. Telegram (`LIVE`)
- **Ingestion Architecture:** Continuous background poller polling `getUpdates` with local SQLite/Mongo offset management.
- **Privacy Enforcement:**
  - Raw phone numbers and private chats are completely filtered out.
  - Senders are hashed with `SHA-256(user_id)` truncated to 12 characters.
  - Channels are recorded by public username/id.
- **Latency:** Sub-3-second P95 end-to-end ingestion latency.

### 2. YouTube (`LIVE`)
- **Ingestion Architecture:** APScheduler job runs periodic query cycles (default every 30 minutes) against configured watchlist topics (e.g. `cybersecurity India`, `critical infrastructure threat`).
- **Quota Safety System:**
  - YouTube Data API v3 charges 100 quota units per `search().list` call against a 10,000 unit daily quota.
  - NETRA automatically counts units consumed per calendar day (America/Los_Angeles timezone).
  - If daily consumption exceeds the configured safety ceiling (e.g. 8,000 units), collection halts until reset, preventing unexpected service interruption.

### 3. Bluesky & Mastodon (`LIVE`)
- **Ingestion Architecture:** Open, federated public protocol listeners.
- **Advantage for Intelligence:**
  - Unencumbered by commercial walled gardens.
  - Decentralized and censorship-resistant.
  - Immediate ingestion of emerging international cyber threat indicators and hacktivist declarations.

### 4. X / Twitter (`IMPORT` + `LIVE_THIRD_PARTY`)
- **The Reality of X Ingestion:**
  - Following the deprecation of the free Academic API in 2023, access to the official X API requires an Enterprise subscription starting at $42,000/month.
  - "Free scrapers" (e.g., twint, snscrape) are brittle, frequently blocked, and violate platform terms.
- **NETRA's Dual Solution:**
  1. **Historical Research Datasets (`IMPORT`):** High-volume, clean public datasets containing threat indicators and narrative shifts, shown in their authentic historical time ranges.
  2. **Capped Third-Party Sample (`LIVE_THIRD_PARTY`):** Integration with `twitterapi.io` allowing capped daily searches (default 300 tweets/day) for breaking topics. Explicitly badged as third-party.

### 5. Reddit (`IMPORT`)
- **Current State:** Research datasets spanning historical disinformation and narrative propagation benchmark datasets.
- **Next Steps:** Reddit Developer API credentials and OAuth client integration are pre-wired. Upon completion of Reddit's app review process, live subreddit streaming will activate automatically without architecture changes.

### 6. Meta Platforms: Facebook & Instagram (API-reported connector state)
- **Why Arbitrary Public Search is Disabled:**
  - Unlike Twitter or Mastodon, Meta does not offer a public search API for arbitrary personal Facebook posts or Instagram captions.
  - Third-party scrapers violate the Computer Fraud and Abuse Act (CFAA) and Meta Platform Terms.
- **NETRA's Ethical Stance:**
  - Ingestion is limited to authorized Pages and professional Instagram accounts using official Meta Graph API Webhooks and Page tokens.
  - Disclosed transparently on the dashboard and coverage matrix.
