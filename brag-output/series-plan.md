# NETRA | Product walkthrough series plan

**Status:** Storyboard and voiceover planning only. No captures, compositions, or renders created.

## Series arc and chapter lengths

Observe → investigate → trace change and spread → prioritize → add audience context → inspect relationships → explain how calculations are produced. Chapters are self-contained and also form one continuous explainer.

| # | Chapter | Target | Components |
|---|---|---:|---|
| 00 | Intro — From posts to a clearer picture | 0:30 | App shell, overview |
| 01 | Analytics dashboard | 1:00 | Navigation, Sentiment Distribution, Emerging Narratives, Live Intelligence Feed, Refresh |
| 02 | Deep Search & Investigation | 1:00 | Search, summary cards, provenance, entity/platform tags, evidence feed, filtered graph |
| 03 | Narrative Mutation | 1:15 | Selector, summary cards, Activity Timeline, Narrative Evolution, Intelligence Summary |
| 04 | Cross-Platform Correlation | 1:00 | Topic search, spread timeline, platform breakdown |
| 05 | Intelligence Alerts | 1:00 | Alert queue, severities, types, refresh and polling |
| 06 | Demographics | 1:00 | Profession, region, age-bracket and language charts |
| 07 | Network Intelligence | 1:00 | Top Influencers, Bridge Nodes, Community Clusters chart |
| 08 | Network Graph | 1:00 | Force layout, legend, hover, click-focus, zoom/reset, investigation subgraph |
| 09 | How the numbers are made | 1:30 | Ingestion, VADER, TF-IDF/DBSCAN, MongoDB, Neo4j, API |
| 10 | Outro — Read the signal, inspect the evidence | 0:20 | Dashboard, evidence, title |

**Total:** 10:55. Content chapters are 1:00–1:30 (within requested 45–90 seconds); intro 0:30 and outro 0:20.

## Creative and production direction

- **Story:** Observe → investigate → track change and spread → prioritize → contextualize → inspect connections → understand calculations.
- **Voice:** Clear, confident, conversational and non-technical. Explain each named metric, then its decision value. Never present heuristics as measured facts.
- **UI:** Use screen captures of the active `frontend/` app and faithful close-ups for readable callouts. Preserve real UI labels. `design-source/` is a prototype; use only for visual reference, never as evidence of shipped functionality or data.
- **Data safety:** Captures use sanitized demo records or fictional stand-ins. Do not expose handles, personal data, credentials, or environment values.
- **Palette:** `#08091a` / `#0a0a0f` backgrounds; `#11122a` elevated panels; lavender `#9a9ee8`, bright `#b8bbee`, dim `#7b7fc4`; text `#f2f3fa`, muted `#8e92b0`; green `#70a888`, red `#c07070`, amber `#c09060`, blue `#7090cc`. Use restrained radial lavender glow and fine glass borders.
- **Fonts:** Space Grotesk for headings/body; JetBrains Mono for timestamps, counts and labels.
- **Motion:** Establish screen, then 1.15–1.3× push-in. Isolate each component with a soft lavender outline; animate bars, timeline points and graph links as explanatory overlays. Keep text settled and readable. Clean slides/crossfades between chapters, direct cuts within views.
- **Music:** Bundled `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`, steady and restrained under narration (target 0.12–0.18 volume). Chapter fades, consistent identity; don't force cuts to beats. Use vol-11 only if a warmer intro/outro bridge is needed. Cue timing selected at composition using the bundled preset.
- **SFX:** Sparse, low-level UI clicks for search/refresh/selector and soft drop/impact accents for major reveals, from bundled library after reviewing `sfx-analysis.md`. Never score every data point.
- **Titles:** Match tab names. Lower thirds use Space Grotesk chapter names and JetBrains Mono metric labels. Outro resolves to NETRA and “Read the signal. Inspect the evidence.”

## Accuracy guardrails

- Sentiment and alerts read top-level `sentiment_label`; enrichment writes VADER results to nested `ai_analysis.sentiment_label`. Do not imply the chart reads the nested field absent confirmation.
- Emerging Narratives counts `narrative_name`, falling back to cluster id; it is not a trend forecast.
- Mutation uses four chronological, roughly equal-count slices—not fixed time intervals. Dominant sentiment is the most frequent label in each slice.
- Cross-platform results are case-insensitive text matches. Earliest observed platform is not proof of origin.
- Alerts use collection-wide thresholds: total posts >5; negative labels >20%; multiple platforms; configured keyword matches. They are not rolling-baseline anomaly detection. Alerts poll every 30 seconds; other dashboard views do not globally poll.
- Profession/region/age/language are rule-based estimates. Language counts derive from total posts rather than language detection; age uses platform/text length. Clearly call these illustrative context.
- Top Influencers rank by degree. Bridge score counts distinct neighboring label-type pairs and may fall back to high-degree nodes; it is not betweenness. Community Clusters counts nodes by Neo4j label, not detected communities. Do not reuse prototype betweenness/cohesion metrics.
- Investigation Activity Trend is `+12% × observation count` for >2 matches, else `0%`; it is not a time-series trend. Avoid persuasive use of this percentage.
- Graph builder reads up to 500 Reddit, X and Telegram posts per platform. Avoid broader live-coverage claims. Demo pipeline may inject canned posts.

## Storyboards and scripts

Timed scenes, visual actions, exact metric callouts, on-screen text and full narration are in `scripts/chapter-00.md` through `scripts/chapter-10.md`.

## Source map

Active UI: `frontend/src/App.jsx`, `frontend/src/components/`. API calculations: `backend/main.py`. Enrichment/graph: `backend/app/analytic_engine.py`, `backend/app/graph_builder.py`, `backend/app/pipeline.py`. Palette/type: `frontend/src/components/AnalyticsView.css`, `frontend/src/components/ui/primitives.css`, `frontend/src/index.css`. Prototype reference: `design-source/src/pages/Dashboard.tsx`.
