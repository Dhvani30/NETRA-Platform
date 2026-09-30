# Chapter 05 — Intelligence Alerts
**Target:** 1:00

| Time | Visual / component | On-screen text | Voiceover |
|---|---|---|---|
| 0:00–0:08 | Open Alerts; show active count, severity badges and Refresh. | INTELLIGENCE ALERTS · AUTO-REFRESH 30s | Intelligence Alerts presents conditions NETRA’s backend flags in the stored collection. The screen requests updated alerts every thirty seconds and also has a manual Refresh control. |
| 0:08–0:22 | Focus High Data Ingestion; overlay threshold line at 5. | ACCELERATION · CRITICAL · TOTAL POSTS > 5 | The Acceleration alert is triggered when total stored posts exceed five. It reports collection size; it is not a comparison with a historical volume baseline. |
| 0:22–0:36 | Focus negative sentiment alert; animate ratio to threshold. | SENTIMENT · WARNING · NEGATIVE LABELS > 20% | The Sentiment alert counts posts with a negative label and warns when they exceed twenty percent of labeled posts. That can prompt a closer read of the underlying observations. |
| 0:36–0:48 | Show cross-platform and keyword alerts with type labels. | ENTITY · MULTIPLE PLATFORMS · KEYWORD MATCHES | An informational alert appears when more than one platform is represented. A separate critical alert appears when configured keywords are found in post text. These are simple collection-wide conditions. |
| 0:48–1:00 | Show severity counts, refresh animation and timestamp. | SEVERITY · GENERATED AT REFRESH | Critical, Warning and Info describe alert priority in the interface. Timestamps are generated when the endpoint runs, and alerts are recalculated from the collection rather than a rolling time window. |
