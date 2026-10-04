# Dashboard truth audit

| File | Claim removed | Replacement |
|---|---|---|
| `frontend/src/components/DemoChecklistDrawer.jsx` | Static active sources, imported/replay source types, and “genuine real-time” status | Groups and details are calculated from `/health/sources`. |
| `frontend/src/App.jsx` | Fixed origin counter labels | Counts come from `/live/summary` by `source_mode`; the URL-persisted real-data filter is passed to the feed. |
| `frontend/src/components/LiveStatusStrip.jsx` | Static source health | Per-source freshness, age, hourly count, mode, and 60-minute series come from `/health/sources`. |
| `frontend/src/components/LiveFeedView.jsx` | Default platform series and raw author fallback | The API determines platforms; only the API-provided short author ID is displayed. |
| `frontend/src/components/MetaFeedView.jsx` | Generic Meta restriction narrative | Status, reason, route, token expiry, schedule and usage come from `/health/sources`. |
| `docs/DEMO_RUNBOOK.md` | X archive and Reddit academic replay claims | Disabled sources are API-reported and never represented as imports. |
| `docs/PLATFORM_COVERAGE.md` | Facebook/Instagram marked `RESTRICTED` | API-reported connected source state, route, expiry and sync status. |
