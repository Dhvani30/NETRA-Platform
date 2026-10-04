"""Safe environment value handling; values are never returned to logs."""
from __future__ import annotations
import logging, os, re
from pathlib import Path

logger = logging.getLogger("NETRA.Env")
_EDGE_NOISE = " \t\r\n\ufeff\u200b\u200c\u200d\u00a0"

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_ENABLED_SOURCES = "telegram,youtube,facebook,instagram"

# Names only: this list is deliberately safe to send to logs. Never include
# the corresponding values in startup diagnostics.
CREDENTIAL_ENV_VARS = (
    "MONGO_URI",
    "NEO4J_PASSWORD",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_API_ID",
    "TELEGRAM_API_HASH",
    "TELEGRAM_SESSION",
    "YOUTUBE_API_KEY",
    "META_ACCESS_TOKEN",
    "INSTAGRAM_ACCESS_TOKEN",
    "META_APP_SECRET",
    "META_WEBHOOK_VERIFY_TOKEN",
    "TWITTERAPI_IO_KEY",
    "REDDIT_CLIENT_ID",
    "REDDIT_CLIENT_SECRET",
    "BLUESKY_APP_PASSWORD",
    "MASTODON_TOKEN",
    "ZENROWS_API_KEY",
)


def _clean(value: object) -> str:
    """Normalize copy/paste artefacts without ever exposing the original value."""
    if value is None:
        return ""
    value = str(value)
    # Quoting and Bearer prefixes can be nested after copy/paste, so normalize
    # until no safe edge-only transformation remains.
    while True:
        cleaned = value.strip(_EDGE_NOISE)
        if len(cleaned) >= 2 and cleaned[:1] == cleaned[-1:] and cleaned[:1] in {"'", '"'}:
            cleaned = cleaned[1:-1]
        if cleaned.lower().startswith("bearer "):
            cleaned = cleaned[7:].strip(_EDGE_NOISE)
        if cleaned == value:
            return cleaned
        value = cleaned


def _clean_facebook_page_id(val: str) -> str:
    """Extract numeric page id if val is given as a Facebook URL, or return val."""
    if not val:
        return val
    # Check if query parameter ?id=... or &id=...
    m_id = re.search(r'[?&]id=([0-9]+)', val)
    if m_id:
        return m_id.group(1)
    if "facebook.com" in val.lower() or val.startswith("http://") or val.startswith("https://"):
        m_num = re.findall(r'(\d{5,})', val)
        if m_num:
            return m_num[-1]
        path = val.split("?")[0].rstrip("/")
        slug = path.split("/")[-1]
        if slug:
            return slug
    return val


def env_was_cleaned(name: str, default: str = "", aliases: list[str] | tuple[str, ...] | None = None) -> bool:
    """Return only whether normalizing an environment variable changed it."""
    raw = None
    if name in os.environ:
        raw = os.environ[name]
    elif aliases:
        for alias in aliases:
            if alias in os.environ:
                raw = os.environ[alias]
                break
    if raw is None:
        raw = default
    cleaned = _clean(raw)
    if name == "META_FACEBOOK_PAGE_ID" or (aliases and "META_FACEBOOK_PAGE_ID" in aliases):
        cleaned = _clean_facebook_page_id(cleaned)
    return cleaned != str(raw)


def get_clean_env(name: str, default: str = "", aliases: list[str] | tuple[str, ...] | None = None) -> str:
    """Read an environment variable, strip edge noise/quotes/Bearer, and extract IDs when appropriate."""
    if isinstance(default, (list, tuple)):
        aliases = list(default)
        default = ""

    raw = None
    if name in os.environ:
        raw = os.environ[name]
    elif aliases:
        for alias in aliases:
            if alias in os.environ:
                raw = os.environ[alias]
                break

    if raw is None:
        raw = default

    cleaned = _clean(raw)
    if name == "META_FACEBOOK_PAGE_ID" or (aliases and "META_FACEBOOK_PAGE_ID" in aliases):
        cleaned = _clean_facebook_page_id(cleaned)

    if cleaned != str(raw):
        logger.warning("Environment variable %s was cleaned before use.", name)

    return cleaned


def log_credential_presence() -> None:
    """Log only credential variable names grouped by presence; never their values."""
    present_names = [name for name in CREDENTIAL_ENV_VARS if get_clean_env(name)]
    present = [f"{name}=****" for name in present_names]
    missing = [f"{name}=<missing>" for name in CREDENTIAL_ENV_VARS if name not in present_names]
    logger.info(
        "Credential presence check: present=%s missing=%s",
        ", ".join(present) or "none",
        ", ".join(missing) or "none",
    )


def find_dotenv_duplicates(dotenv_path: Path | str | None = None) -> dict[str, list[int]]:
    """Scan .env line by line to detect duplicate variable definitions (names and line numbers only)."""
    if dotenv_path is None:
        dotenv_path = BASE_DIR / ".env"
    path = Path(dotenv_path)
    if not path.is_file():
        return {}

    key_lines: dict[str, list[int]] = {}
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, start=1):
                clean_line = line.strip()
                if not clean_line or clean_line.startswith("#"):
                    continue
                match = re.match(r'^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', clean_line)
                if match:
                    key = match.group(1)
                    key_lines.setdefault(key, []).append(line_no)
    except Exception as e:
        logger.debug("Failed reading .env for duplicates: %s", e)
        return {}

    duplicates = {k: lines for k, lines in key_lines.items() if len(lines) > 1}
    for k, lines in duplicates.items():
        logger.warning("Duplicate environment variable '%s' defined on lines: %s", k, lines)
    return duplicates


def get_enabled_sources() -> set[str]:
    """Return set of lower-cased enabled collection source identifiers."""
    raw = get_clean_env("ENABLED_SOURCES", DEFAULT_ENABLED_SOURCES)
    enabled = {s.strip().lower() for s in raw.split(",") if s.strip()}
    for src in ["bluesky", "mastodon", "x", "reddit"]:
        flag = get_clean_env(f"ENABLE_{src.upper()}", "0").lower()
        if flag in ("1", "true", "yes"):
            enabled.add(src)
    return enabled


def is_source_enabled(source: str) -> bool:
    """Check if a specific source is enabled in the current build/environment."""
    return source.lower() in get_enabled_sources()


def validate_token_shape(token: str, expected_prefix: str = "EAA") -> dict:
    """Perform safe, local-only token validation before an HTTP request."""
    problems = []
    if not token:
        problems.append("missing")
    else:
        # Graph access tokens are much longer than an ID or placeholder. This
        # guard is local-only, so malformed values cost no API calls.
        if len(token) < 100:
            problems.append("too_short")
        if not token.startswith(expected_prefix):
            problems.append("unexpected_prefix")
        if re.search(r"\s", token):
            problems.append("contains_whitespace")
        if "'" in token or '"' in token:
            problems.append("contains_quotes")
        if re.search(r"[^A-Za-z0-9_.|\-]", token):
            problems.append("invalid_characters")
    return {"ok": not problems, "problems": problems, "expected_prefix": expected_prefix}
