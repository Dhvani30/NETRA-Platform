"""Explicit, auditable trend thresholds and score weights."""
WINDOW_HOURS = 6
BUCKET_HOURS = 1
SCORE_WEIGHTS = {"volume_growth": .30, "burst_zscore": .20, "author_diversity": .15, "cross_platform": .15, "engagement_growth": .10, "recency": .10}
STATUS_THRESHOLDS = {"viral_z": 4.0, "rising_z": 2.0, "emerging_z": 1.0, "declining_growth": -.20}
