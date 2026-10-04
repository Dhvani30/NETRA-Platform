# NETRA Intelligence Platform - 5-Minute Live Demo Runbook

> **Target Audience:** SIH Jury & Technical Evaluators
> **Platform Version:** 1.0.0 (SIH PS 26152)
> **Operating Mode:** Dual Live Stream + Audited Public Archives
> **Integrity Baseline:** 100% Cryptographically & Forensically Auditable

---

## Pre-Demo Checklist (T-minus 2 Minutes)

Before bringing the jury to the screen:

1. **Run Preflight Verification:**
   ```bash
   python scripts/preflight.py
   ```
   *Expected:* Output ends with `[GO FOR DEMO] -- System is fully preflight-ready.`

2. **Run Integrity Check:**
   ```bash
   python scripts/integrity_check.py
   ```
   *Expected:* `[PASS] -- ALL FORENSIC INTEGRITY CONSTRAINTS SATISFIED (0 violations).`

3. **Launch the Demo Stack (Windows):**
   ```cmd
   scripts\start_demo.bat
   ```
   *This starts the scheduler, FastAPI backend (`http://localhost:8000`), and Vite frontend (`http://localhost:5173`).*

4. **Open Browser:**
   Navigate to `http://localhost:5173/dashboard` with Live Telemetry Feed active.

---

## 5-Minute Demonstration Script

### Minute 1: The "Real & Live" Architecture (Live Telemetry Feed)

* **Action:** Direct the jury's attention to the **Live Telemetry Feed** (`/dashboard`).
* **Talking Points:**
  - *"Welcome to NETRA. Most intelligence dashboards in competitions play canned loop animations or synthetic timers. NETRA is fundamentally different: every single card moving on this screen is backed by an authoritative MongoDB write and Server-Sent Event (SSE) fanout."*
  - Point to the **Source Mode Badges** on each post:
    - `LIVE` (Emerald): The API currently reports a real-time stream or poll for that source.
    - `LIVE_THIRD_PARTY` (Amber): Real-time capped third-party sample (X via twitterapi.io).
    - `IMPORT` (Sky): Audited research benchmark datasets in native chronological ranges.
    - `SYNTH` (Purple): Isolated baseline datasets for stress testing.
  - Show the live filter tabs: Click `LIVE` to isolate only real-time streaming items.

---

### Minute 2: Live Ingestion Proof (Telegram Live Publish)

* **Action:** Execute a live post to the monitored Telegram bot or channel.
  1. Open Telegram on your phone or desktop.
  2. Send a message to your configured bot (or monitored channel) containing target keywords:
     `"Alert: Security audit update for critical infrastructure sector #cyberdefense #netra"`
  3. Keep the dashboard visible to the jury.
* **Observation:**
  - Within **1 to 2 seconds**, the new message appears at the top of the Live Feed.
  - The row flashes green with the `LIVE` badge and relative timestamp `ingested 1s ago`.
  - Point out that the author handle is **privacy-sanitized**: raw phone numbers and names are replaced with a non-invertible 12-character SHA-256 hash (e.g. `usr_9f4c2e8a1d0b`).

---

### Minute 3: Authoritative Provenance & Zero Secrets

* **Action:** Click on the newly arrived Telegram post (or any row) to open the **Provenance Drawer**.
* **Talking Points:**
  - *"Anyone can claim their data is live. In NETRA, every post carries forensic provenance."*
  - Show the drawer contents:
    - **Native ID & Platform Timestamp:** Exact UTC ISO-8601 timestamp (`created_at`).
    - **Collection Run Lineage:** Displays the exact collection execution ID that ingested the record, execution duration, and items collected.
    - **Zero Secrets / Zero PII Guarantee:** Toggle *View Raw JSON* to prove that internal Telegram Bot tokens, headers, and phone numbers are completely stripped before writing to disk.

---

### Minute 4: Pipeline Proof & Live Ingestion Telemetry

* **Action:** Scroll to the **Pipeline Proof Panel** on the Live Feed view.
* **Talking Points:**
  - **Ingest-Rate Chart:** Point to the 60-minute stacked area chart showing real ingestion velocity (posts per minute segmented by platform).
  - **Latency Percentiles:** Show median and P95 latency per platform:
    - Telegram: **~2.2s P95 latency** (true live polling).
    - YouTube: **~42s median latency** (quota-bounded poll cycles).
  - **Source Heartbeat Table:** Point out the next scheduled collector countdown and status (`HEALTHY`, `IDLE`, or `SCHEDULED`).

---

### Minute 5: Coverage Matrix & Forensic Integrity Panel

* **Action:** Navigate to **Sources & Timeline** from the sidebar (or click *Integrity Panel* from the topbar's *Demo Checklist* drawer).
* **Talking Points:**
  1. **Honest Platform Coverage:**
     - Open the **Demo Checklist Drawer** (topbar button).
     - Show the clear 3-way partition:
       - *Live Ingestion:* Telegram, YouTube, Bluesky, Mastodon.
       - *Not enabled in this build:* X and Reddit are shown only when the source-status API reports them disabled.
       - *Commercial App Restrictions:* Facebook & Instagram (own business pages only; Meta restricts arbitrary public topic searches without App Review).
  2. **Integrity Panel Verification:**
     - Show the **Data Integrity & Forensic Verification** card on the Sources page.
     - Click **"Re-verify Now"**.
     - Show that the backend re-audits all database documents against 5 forensic guardrails:
       - *Source Mode Isolation:* 0 mislabeled records.
       - *UTC ISO Timestamps:* 100% compliant, 0 future post-dated timestamps.
       - *Collection Window & IDs:* 0 missing permalinks or native IDs.
       - *Privacy & Token Sanitization:* 0 credential or handle leaks detected.
       - *Import Lineage:* 100% of imported datasets possess `dataset` and `source_file` attributes.
     - The panel returns `[PASS] 0 VIOLATIONS`.

---

## Fallback & Emergency Procedures

If conference Wi-Fi is lost or an external API experiences temporary outages:

### Scenario A: Total Internet Loss (Offline Demo Mode)
1. The NETRA backend operates locally with full persistence in MongoDB (`social_intel`).
2. Even with zero internet connectivity:
   - The **Integrity Panel** functions 100% locally and passes audit.
   - The **Historical Timeline**, **Sentiment Breakdown**, and **Network Graph** serve cached verified data.
   - The **Vite Frontend** and **FastAPI Backend** run completely offline on localhost.
3. State honestly to the jury:
   - *"Our architecture cleanly decouples the frontend visualization layer and local document database from the upstream network pollers. Even in disconnected tactical environments, intelligence analysts retain complete access to all historical and local evidence."*

### Scenario B: YouTube Quota Exceeded (HTTP 403)
- The YouTube collector automatically enforces a 10,000 unit/day quota ceiling. If exhausted:
  - The collector status switches to `RATE_LIMITED` / `QUOTA_EXHAUSTED`.
  - Next run countdown shows when the quota resets (Midnight Pacific Time).
  - The Live Feed and Provenance drawer continue displaying all previously ingested YouTube videos without crashing.

### Scenario C: Third-Party X API Quota Exceeded
- The third-party X ingestor has a daily cap (`X_TP_DAILY_TWEET_BUDGET=300`).
- If the cap is reached, the collector stops querying and marks state `BUDGET_REACHED`.
- Existing X records remain accessible with explicit `LIVE_THIRD_PARTY` badges.

---

## Demo Conclusion Wrap-Up

Close with this summary:
> *"NETRA is built for high-stakes intelligence environments where credibility is non-negotiable. We do not fake feeds with timers; we do not violate provider terms with brittle scrapers; and we verify every record against cryptographic and forensic integrity rules before presenting it to decision-makers."*
