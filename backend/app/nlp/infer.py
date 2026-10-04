"""Offline-safe sentiment, emotion, irony and stance inference.

No model is imported or downloaded at API startup.  Transformers pipelines are
created only on the first scoring call and, by default, only from an already
present Hugging Face cache.  This makes an air-gapped deployment deterministic:
it records a lexical fallback instead of silently hanging while downloading.
"""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from typing import Any

MODEL_VERSION = "netra-nlp-2026-10-v1"
POLARITY_MODEL = "cardiffnlp/twitter-xlm-roberta-base-sentiment"
EMOTION_MODEL = "j-hartmann/emotion-english-distilroberta-base"
IRONY_MODEL = "cardiffnlp/twitter-roberta-base-irony"
STANCE_MODEL = "facebook/bart-large-mnli"
MULTILINGUAL_STANCE_MODEL = "joeddav/xlm-roberta-large-xnli"
EMOTION_KEYS = ("anxiety", "anger", "excitement", "joy", "sadness", "neutral")

_URL = re.compile(r"https?://\S+|www\.\S+", re.I)
_MENTION = re.compile(r"(?<!\w)@[\w_]+")
_DEVANAGARI = re.compile(r"[\u0900-\u097f]")
_MODELS: dict[str, Any] = {}
_MODEL_ERRORS: dict[str, str] = {}


def normalize_text(text: str | None) -> str:
    """Remove volatile identifiers while deliberately retaining emoji."""
    value = str(text or "").strip()
    value = _URL.sub("[URL]", value)
    return _MENTION.sub("[USER]", value)


def detect_language(text: str | None) -> str:
    """Best-effort language detection with a useful Hinglish route."""
    value = str(text or "")
    if _DEVANAGARI.search(value):
        return "hi" if len(_DEVANAGARI.findall(value)) > len(value) * .08 else "hinglish"
    try:
        from langdetect import detect  # optional dependency
        language = detect(value) if len(value.strip()) >= 12 else "unknown"
        return language.lower()
    except Exception:
        # Common Romanised Hindi markers prevent Hinglish being treated as English.
        return "hinglish" if re.search(r"\b(hai|nahi|nahin|kya|bahut|kaise|aur|bhai)\b", value, re.I) else "en"


def _allow_download() -> bool:
    return os.getenv("NETRA_NLP_ALLOW_DOWNLOAD", "false").lower() in {"1", "true", "yes"}


def _pipeline(name: str, task: str, model: str):
    """Get an optional cached pipeline, caching failures too."""
    if name in _MODELS:
        return _MODELS[name]
    if name in _MODEL_ERRORS:
        return None
    try:
        if not _allow_download():
            # Hugging Face honours this before touching the network. It is set
            # here (rather than module import) so API startup stays inert.
            os.environ.setdefault("HF_HUB_OFFLINE", "1")
        from transformers import pipeline  # deliberately lazy
        kwargs = {} if _allow_download() else {"model_kwargs": {"local_files_only": True}, "tokenizer_kwargs": {"local_files_only": True}}
        _MODELS[name] = pipeline(task, model=model, **kwargs)
        return _MODELS[name]
    except Exception as exc:  # model/dependency unavailable is a supported state
        _MODEL_ERRORS[name] = f"{type(exc).__name__}: {exc}"
        return None


@lru_cache(maxsize=1)
def _lexicon_analyzer():
    try:
        from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        return SentimentIntensityAnalyzer()
    except Exception:
        return None


def _lexical(text: str) -> tuple[str, float, float]:
    analyzer = _lexicon_analyzer()
    if analyzer:
        score = float(analyzer.polarity_scores(text)["compound"])
    else:
        positive = len(re.findall(r"\b(good|great|love|win|safe|excellent|happy)\b", text, re.I))
        negative = len(re.findall(r"\b(bad|hate|risk|attack|fear|angry|fail|sad)\b", text, re.I))
        score = max(-1.0, min(1.0, (positive - negative) / max(1, positive + negative)))
    label = "positive" if score >= .05 else "negative" if score <= -.05 else "neutral"
    return label, score, min(1.0, abs(score))


def _base(method: str, confidence: float) -> dict[str, Any]:
    return {"method": method, "model_version": MODEL_VERSION, "confidence": round(float(confidence), 4), "scored_at": datetime.now(timezone.utc).isoformat()}


def _polarity(text: str, language: str) -> dict[str, Any]:
    model = _pipeline("polarity", "sentiment-analysis", POLARITY_MODEL)
    if not model:
        label, score, confidence = _lexical(text)
        return {"label": label, "score": score, **_base("lexical-fallback", confidence)}
    try:
        result = model(text, truncation=True)[0]
        raw = str(result["label"]).lower()
        # Cardiff labels are usually negative/neutral/positive, but support LABEL_n.
        label = {"label_0": "negative", "label_1": "neutral", "label_2": "positive"}.get(raw, raw)
        score = {"positive": 1.0, "negative": -1.0, "neutral": 0.0}.get(label, 0.0) * float(result["score"])
        return {"label": label if label in {"positive", "negative", "neutral"} else "neutral", "score": round(score, 4), **_base(POLARITY_MODEL, float(result["score"]))}
    except Exception:
        label, score, confidence = _lexical(text)
        return {"label": label, "score": score, **_base("lexical-fallback", confidence)}


def _emotion_bucket(label: str) -> str:
    value = label.lower()
    if value in {"fear", "anxiety", "nervousness"}: return "anxiety"
    if value in {"anger", "annoyance", "disgust"}: return "anger"
    if value in {"excitement", "surprise", "optimism"}: return "excitement"
    if value in {"joy", "love", "admiration", "gratitude"}: return "joy"
    if value in {"sadness", "grief", "disappointment", "remorse"}: return "sadness"
    return "neutral"


def _emotions(text: str) -> dict[str, Any]:
    model = _pipeline("emotion", "text-classification", EMOTION_MODEL)
    probs = {key: 0.0 for key in EMOTION_KEYS}
    if model:
        try:
            rows = model(text, truncation=True, top_k=None)
            rows = rows[0] if rows and isinstance(rows[0], list) else rows
            for row in rows:
                bucket = _emotion_bucket(str(row["label"]))
                probs[bucket] = max(probs[bucket], float(row["score"]))
            total = sum(probs.values())
            if total:
                probs = {k: round(v / total, 4) for k, v in probs.items()}
            label = max(probs, key=probs.get)
            return {**probs, "label": label, **_base(EMOTION_MODEL, probs[label])}
        except Exception:
            pass
    polarity, _, confidence = _lexical(text)
    label = "joy" if polarity == "positive" else "sadness" if polarity == "negative" else "neutral"
    probs[label] = 1.0
    return {**probs, "label": label, **_base("lexical-fallback", confidence)}


def _sarcasm(text: str) -> dict[str, Any]:
    model = _pipeline("irony", "text-classification", IRONY_MODEL)
    if model:
        try:
            result = model(text, truncation=True)[0]
            probability = float(result["score"]) if "irony" in str(result["label"]).lower() or str(result["label"]).endswith("1") else 1 - float(result["score"])
            return {"prob": round(probability, 4), **_base(IRONY_MODEL, max(probability, 1-probability))}
        except Exception:
            pass
    probability = .35 if re.search(r"\b(yeah right|sure|obviously|totally)\b|🙄|/s\b", text, re.I) else .0
    return {"prob": probability, **_base("lexical-fallback", 1 - probability)}


def _stance(text: str, topic: str | None, language: str = "en") -> dict[str, Any]:
    if not topic:
        return {"label": "neutral", **_base("not-requested", 0.0)}
    stance_model = MULTILINGUAL_STANCE_MODEL if language not in {"en", "unknown"} else STANCE_MODEL
    model = _pipeline("stance-multilingual" if stance_model == MULTILINGUAL_STANCE_MODEL else "stance", "zero-shot-classification", stance_model)
    if model:
        try:
            answer = model(text, candidate_labels=["supportive of " + topic, "against " + topic, "neutral toward " + topic], multi_label=False)
            label = answer["labels"][0].split(" ", 1)[0]
            return {"label": "supportive" if label == "supportive" else "against" if label == "against" else "neutral", **_base(stance_model, float(answer["scores"][0]))}
        except Exception:
            pass
    label, score, confidence = _lexical(text)
    stance = "supportive" if label == "positive" else "against" if label == "negative" else "neutral"
    return {"label": stance, **_base("lexical-fallback", confidence)}


def infer_post(post: dict[str, Any], topic: str | None = None) -> dict[str, Any]:
    """Score one raw post without mutating its original text."""
    original = str(post.get("text") or post.get("text_content") or "")
    cleaned = normalize_text(original)
    language = detect_language(cleaned)
    inferred_topic = topic or post.get("topic") or post.get("narrative_name") or post.get("topic_id", {}).get("value")
    sentiment = _polarity(cleaned, language)
    route = "multilingual" if language not in {"en", "unknown"} else "english"
    return {"lang": language, "sentiment": sentiment, "emotions": _emotions(cleaned), "stance": _stance(cleaned, inferred_topic, language), "sarcasm": _sarcasm(cleaned), "nlp": {"method": sentiment["method"], "model_version": MODEL_VERSION, "confidence": sentiment["confidence"], "scored_at": sentiment["scored_at"], "normalized_text": cleaned, "model_route": route}}


def infer_batch(posts: list[dict[str, Any]], topic: str | None = None, batch_size: int = 32) -> list[dict[str, Any]]:
    """Public batch interface; model pipelines apply their own vectorisation when available."""
    return [infer_post(post, topic) for post in posts]


def scoring_query() -> dict[str, Any]:
    """Posts without this version are eligible, including legacy VADER results."""
    return {"$or": [{"sentiment": {"$exists": False}}, {"sentiment.model_version": {"$ne": MODEL_VERSION}}]}
