"""Aggregate-only demographic profiler.

This module deliberately never writes a per-person inference.  ``author_id`` is
used only as an in-memory grouping key and is discarded before a result leaves
this module.  The persisted materialisation contains aggregate buckets only.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import os
import re
from typing import Any, Iterable

K_ANON_MIN_GROUP = int(os.getenv("K_ANON_MIN_GROUP", "10"))
UNKNOWN = "unknown/insufficient evidence"
SUPPRESSED = "other (suppressed)"

INTEREST_TERMS = {
    "technology": ("software", "developer", "technology", "cyber", "ai", "cloud", "programming"),
    "education": ("teacher", "education", "university", "college", "learning", "researcher"),
    "politics": ("policy", "election", "parliament", "government policy", "politics"),
    "finance": ("finance", "banking", "investor", "market", "fintech", "economics"),
    "media": ("journalist", "media", "news", "reporter", "editor"),
    "health": ("health", "doctor", "medical", "hospital", "public health"),
    "government": ("civil service", "public sector", "government", "ministry"),
    "business": ("business", "founder", "entrepreneur", "startup", "marketing"),
    "student": ("student", "undergraduate", "graduate student", "phd candidate"),
}

# Offline, deliberately coarse gazetteer.  It never emits a city or coordinate.
LOCATION_ALIASES = {
    "india": ("India", None), "delhi": ("India", "Delhi"), "mumbai": ("India", "Maharashtra"),
    "bengaluru": ("India", "Karnataka"), "bangalore": ("India", "Karnataka"), "kolkata": ("India", "West Bengal"),
    "usa": ("United States", None), "united states": ("United States", None), "new york": ("United States", "New York"),
    "california": ("United States", "California"), "uk": ("United Kingdom", None), "united kingdom": ("United Kingdom", None),
    "london": ("United Kingdom", None), "canada": ("Canada", None), "australia": ("Australia", None),
    "germany": ("Germany", None), "france": ("France", None), "japan": ("Japan", None), "singapore": ("Singapore", None),
}


def _text(post: dict[str, Any]) -> str:
    return str(post.get("text") or post.get("text_content") or post.get("content") or "")


def _profile_value(post: dict[str, Any], name: str) -> str:
    profile = post.get("profile") or post.get("author_profile") or post.get("author") or {}
    value = post.get(name) or (profile.get(name) if isinstance(profile, dict) else None) or ""
    return str(value)


def _parse_time(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _language(post: dict[str, Any]) -> tuple[str | None, float]:
    lang = str(post.get("lang") or _profile_value(post, "language") or "").strip().lower()
    aliases = {"en": "English", "english": "English", "hi": "Hindi", "hindi": "Hindi", "es": "Spanish", "fr": "French", "de": "German", "ja": "Japanese"}
    if lang in aliases:
        return aliases[lang], 0.9
    # Avoid language identification libraries/models here: a script cue is useful
    # but explicitly low confidence.
    text = _text(post) + " " + _profile_value(post, "bio")
    if re.search(r"[\u0900-\u097F]", text):
        return "Hindi", 0.55
    if re.search(r"[A-Za-z]", text):
        return "English", 0.45
    return None, 0.0


def _geography(location: str) -> tuple[str | None, float]:
    normalized = re.sub(r"\s+", " ", location.lower()).strip()
    if not normalized:
        return None, 0.0
    for alias in sorted(LOCATION_ALIASES, key=len, reverse=True):
        if re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", normalized):
            country, state = LOCATION_ALIASES[alias]
            return (f"{country} — {state}" if state else country), 0.9 if state else 0.8
    # pycountry is an offline ISO country gazetteer when installed.
    try:
        import pycountry  # type: ignore
        for country in pycountry.countries:
            if country.name.lower() in normalized or getattr(country, "official_name", "").lower() in normalized:
                return country.name, 0.8
    except ImportError:
        pass
    return None, 0.0


def _interest(text: str) -> tuple[str | None, float]:
    text = text.lower()
    scores = {label: sum(term in text for term in terms) for label, terms in INTEREST_TERMS.items()}
    label, score = max(scores.items(), key=lambda item: item[1])
    return (label, min(0.9, 0.5 + score * 0.12)) if score else (None, 0.0)


def _age(text: str) -> tuple[str | None, float, bool]:
    """Return age band only for an explicit stated age; never create a minor band."""
    lowered = text.lower()
    stated = re.search(r"\b(?:i am|i'm|aged?|age)\s*(\d{1,2})\b", lowered)
    if stated:
        age = int(stated.group(1))
        if age < 18:
            return None, 0.0, True
        if age <= 24: return "18-24", 0.95, False
        if age <= 34: return "25-34", 0.95, False
        if age <= 49: return "35-49", 0.95, False
        return "50+", 0.95, False
    # Explicit minor cues are excluded entirely from age aggregation.
    if re.search(r"\b(?:minor|underage|high school|school student|i am 1[0-7])\b", lowered):
        return None, 0.0, True
    return None, 0.0, False


def _posting_hour_pattern(posts: list[dict[str, Any]]) -> str:
    """Coarse UTC posting-hour distribution, never a precise timezone/location."""
    hours = [parsed.hour for post in posts if (parsed := _parse_time(post.get("created_at") or post.get("published_at")))]
    if not hours:
        return "posting hour unknown"
    daytime = sum(1 for hour in hours if 6 <= hour < 18)
    return "mostly UTC daytime" if daytime / len(hours) >= .6 else "mostly UTC evening/night"


def _bucket_dimension(values: list[tuple[str | None, float]], total: int, k: int, method: str, *, excluded: int = 0) -> dict[str, Any]:
    counts, confidences = Counter(), defaultdict(list)
    for label, confidence in values:
        if label:
            counts[label] += 1
            confidences[label].append(confidence)
    known = sum(counts.values())
    buckets: list[dict[str, Any]] = []
    suppressed = 0
    for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        if count < k:
            suppressed += count
        else:
            buckets.append({"label": label, "users": count, "percent": round(100 * count / total, 1) if total else 0.0,
                            "confidence": round(sum(confidences[label]) / len(confidences[label]), 2)})
    if suppressed:
        buckets.append({"label": SUPPRESSED, "users": suppressed, "percent": round(100 * suppressed / total, 1) if total else 0.0,
                        "confidence": 0.0, "suppressed": True})
    unknown = max(0, total - known - excluded)
    buckets.append({"label": UNKNOWN, "users": unknown, "percent": round(100 * unknown / total, 1) if total else 0.0, "confidence": 0.0})
    result = {"buckets": buckets, "coverage": round(100 * known / total, 1) if total else 0.0,
              "confidence": round(sum(c for _, c in values if c) / known, 2) if known else 0.0, "method": method}
    if excluded:
        result["excluded_minors"] = excluded
    return result


def build_demographics(posts: Iterable[dict[str, Any]], *, k_anonymity: int = K_ANON_MIN_GROUP) -> dict[str, Any]:
    """Build a safe aggregate from posts; this function has no database writes."""
    users: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for post in posts:
        author = post.get("author_id")
        if author is not None:  # no synthetic IDs: profiles without a stable public author are omitted
            users[(str(post.get("platform") or "unknown").lower(), str(author))].append(post)
    language, geography, interests, age, activity = [], [], [], [], []
    minors = 0
    for user_posts in users.values():
        bio = " ".join(_profile_value(p, "bio") for p in user_posts)
        content = " ".join(_text(p) for p in user_posts)
        lang_votes = [_language(p) for p in user_posts]
        language.append(max(lang_votes, key=lambda item: item[1], default=(None, 0.0)))
        geo_label, geo_confidence = _geography(next((_profile_value(p, "location") for p in user_posts if _profile_value(p, "location")), ""))
        # Multiple public timestamps provide only a very small stability cue. They
        # cannot create geography where the public location string is absent.
        timestamp_count = sum(_parse_time(p.get("created_at") or p.get("published_at")) is not None for p in user_posts)
        geography.append((geo_label, min(.9, geo_confidence + (.03 if geo_label and timestamp_count >= 3 else 0))))
        interests.append(_interest(f"{bio} {content}"))
        age_band, age_confidence, is_minor = _age(f"{bio} {content}")
        if is_minor: minors += 1
        else: age.append((age_band, age_confidence))
        replies = sum(1 for p in user_posts if str(p.get("event_type", "")).lower() in {"reply", "comment"} or p.get("parent_id"))
        ratio = replies / len(user_posts)
        activity_label = "high activity" if len(user_posts) >= 10 else "moderate activity" if len(user_posts) >= 3 else "low activity"
        reply_label = "reply-led" if ratio >= .6 else "original-led" if ratio <= .4 else "mixed interaction"
        activity.append((f"{activity_label}; {reply_label}; {_posting_hour_pattern(user_posts)}", 0.8))
    total = len(users)
    return {
        "total_users": total,
        "k_anonymity_min_group": k_anonymity,
        "language": _bucket_dimension(language, total, k_anonymity, "post language metadata and bio script cues"),
        "geography": _bucket_dimension(geography, total, k_anonymity, "public location text matched against an offline country/state gazetteer; posting-hour distribution is a low-confidence corroborating cue only and never yields a precise location"),
        "interests": _bucket_dimension(interests, total, k_anonymity, "fixed-taxonomy keyword similarity over public bio and content"),
        "age": _bucket_dimension(age, total, k_anonymity, "explicit stated-age cues only; minors excluded", excluded=minors),
        "activity_patterns": _bucket_dimension(activity, total, k_anonymity, "per-user public posting frequency, reply/original ratio, and coarse posting-hour distribution"),
        "privacy_note": "Aggregate-only output. No user IDs, bios, locations, or per-user demographic inferences are returned or stored. Buckets below k are suppressed.",
    }
