"""Strict secret redaction and masking for logs, error messages, and stored audit records."""
from __future__ import annotations

import logging
import re
from typing import Any

# Compiled regex patterns for secret detection
PATTERNS = [
    # 1. Meta / Instagram Tokens
    (re.compile(r'(EAA[A-Za-z0-9_-]{15,})'), lambda m: m.group(1)[:3] + "***"),
    (re.compile(r'(IG[A-Za-z0-9_-]{15,})'), lambda m: m.group(1)[:2] + "***"),

    # 2. Telegram Bot Tokens (digits:25-45 chars)
    (re.compile(r'(\d{6,14}):([A-Za-z0-9_-]{25,45})'), lambda m: m.group(1) + ":***"),

    # 3. Google API Keys (AIza...)
    (re.compile(r'(AIza[0-9A-Za-z_-]{20,45})'), lambda m: m.group(1)[:3] + "***"),

    # 4. Bearer Tokens
    (re.compile(r'(?i)(bearer\s+)([A-Za-z0-9\-._~+/]{10,}=*)'), r'\1[REDACTED_BEARER_TOKEN]'),

    # 5. MongoDB URIs with Credentials
    (re.compile(r'(mongodb(?:\+srv)?:\/\/[^:]+:)([^@\s\/]+)(@)'), r'\1[REDACTED_PASSWORD]\3'),

    # 6. Passwords and App Secrets in key-value / JSON / CLI strings
    (re.compile(r'(?i)(["\']?(?:password|client_secret|app_secret|secret_key|api_key|access_token|auth_token)["\']?\s*[:=]\s*["\']?)([^"\'\s,}{]{4,})(["\']?)'),
     r'\1[REDACTED]\3'),

    # 7. URL Query Parameters for Secrets
    (re.compile(r'(?i)([?&](?:password|secret|api_key|access_token|token)=)([^&\s]+)'),
     r'\1[REDACTED]'),
]


def mask_secrets(text: str | None) -> str:
    """Mask all sensitive tokens, credentials, and keys within text string."""
    if not text or not isinstance(text, str):
        return "" if text is None else str(text)

    masked = text
    for pattern, repl in PATTERNS:
        if callable(repl):
            masked = pattern.sub(repl, masked)
        else:
            masked = pattern.sub(repl, masked)
    return masked


def sanitize_data(data: Any) -> Any:
    """Recursively sanitize dictionary, list, or primitive data structures."""
    if data is None:
        return None
    if isinstance(data, str):
        return mask_secrets(data)
    if isinstance(data, dict):
        clean = {}
        for k, v in data.items():
            k_clean = str(k)
            if any(s in k_clean.lower() for s in {"token", "secret", "password", "credential", "auth_header"}):
                clean[k] = "[REDACTED]"
            else:
                clean[k] = sanitize_data(v)
        return clean
    if isinstance(data, (list, tuple, set)):
        items = [sanitize_data(x) for x in data]
        if isinstance(data, tuple):
            return tuple(items)
        if isinstance(data, set):
            return set(items)
        return items
    return data


class SecretRedactionFilter(logging.Filter):
    """Logging filter that sanitizes log records before emission."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if record.msg:
                if isinstance(record.msg, str):
                    record.msg = mask_secrets(record.msg)
                else:
                    record.msg = mask_secrets(str(record.msg))

            if record.args:
                if isinstance(record.args, dict):
                    record.args = {k: mask_secrets(v) if isinstance(v, str) else sanitize_data(v) for k, v in record.args.items()}
                elif isinstance(record.args, (list, tuple)):
                    record.args = tuple(mask_secrets(a) if isinstance(a, str) else sanitize_data(a) for a in record.args)

            if record.exc_text:
                record.exc_text = mask_secrets(record.exc_text)
        except Exception:
            pass
        return True


class SecretRedactionFormatter(logging.Formatter):
    """Logging formatter that unconditionally ensures masked string representation."""

    def format(self, record: logging.LogRecord) -> str:
        if "%(levelprefix)" in self._style._fmt and not hasattr(record, "levelprefix"):
            record.levelprefix = record.levelname
        formatted = super().format(record)
        return mask_secrets(formatted)


def install_secret_redaction() -> None:
    """Install the secret redaction filter and formatter on root, uvicorn, and core loggers."""
    redaction_filter = SecretRedactionFilter()

    # 1. Root logger
    root_logger = logging.getLogger()
    if redaction_filter not in root_logger.filters:
        root_logger.addFilter(redaction_filter)
    for handler in root_logger.handlers:
        if redaction_filter not in handler.filters:
            handler.addFilter(redaction_filter)
        if handler.formatter:
            handler.formatter = SecretRedactionFormatter(
                fmt=handler.formatter._fmt,
                datefmt=handler.formatter.datefmt
            )

    # 2. Uvicorn & Web loggers
    target_loggers = ["uvicorn", "uvicorn.access", "uvicorn.error", "fastapi", "NETRA"]
    for name in target_loggers:
        lg = logging.getLogger(name)
        if redaction_filter not in lg.filters:
            lg.addFilter(redaction_filter)
        for h in lg.handlers:
            if redaction_filter not in h.filters:
                h.addFilter(redaction_filter)
            if h.formatter:
                h.formatter = SecretRedactionFormatter(
                    fmt=h.formatter._fmt,
                    datefmt=h.formatter.datefmt
                )
