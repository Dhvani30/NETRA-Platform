"""
scripts/scan_secrets.py
Scans working tree and recent git history for:
1. Unmasked secret patterns (tokens, API keys, credentials).
2. References to scraping/proxy providers (ZenRows, ScrapingBee, BrightData, OxyLabs, SmartProxy, ScraperAPI, etc.)
Reports file, line, and pattern name only.
Privacy guarantee: Never echoes or prints detected secret values.
"""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Compiled pattern list for secrets: (pattern_name, regex)
SECRET_PATTERNS = [
    ("Meta Access Token", re.compile(r'\bEAA[A-Za-z0-9_-]{25,}\b')),
    ("Instagram Login Token", re.compile(r'\bIG[A-Za-z0-9_-]{25,}\b')),
    ("Telegram Bot Token", re.compile(r'\b\d{8,12}:[A-Za-z0-9_-]{30,40}\b')),
    ("Google API Key", re.compile(r'\bAIza[0-9A-Za-z-_]{35}\b')),
    ("Bearer Token", re.compile(r'(?i)bearer\s+[A-Za-z0-9\-._~+/]{25,}')),
    ("MongoDB URI Password", re.compile(r'mongodb(?:\+srv)?:\/\/[^:]+:([^@\s\/]{4,})@')),
    ("Generic Secret Key", re.compile(r'\bsk-[A-Za-z0-9]{25,}\b')),
]

# Scraping and third-party proxy provider patterns (git grep style check)
SCRAPING_PROVIDER_PATTERNS = [
    ("ZenRows Proxy/Scraper", re.compile(r'(?i)zenrows')),
    ("ScrapingBee Provider", re.compile(r'(?i)scrapingbee')),
    ("BrightData Provider", re.compile(r'(?i)(?:brightdata|luminati)')),
    ("OxyLabs Provider", re.compile(r'(?i)oxylabs')),
    ("SmartProxy Provider", re.compile(r'(?i)smartproxy')),
    ("ScraperAPI Provider", re.compile(r'(?i)scraperapi')),
    ("Crawlbase Provider", re.compile(r'(?i)crawlbase')),
    ("Apify Actor/Scraper", re.compile(r'(?i)apify')),
]

IGNORED_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    "dist",
    "build",
    ".cache",
    ".vite",
    ".pytest_cache",
    "backups",
    "import",
}

IGNORED_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development",
    ".env.test",
    "package-lock.json",
    "yarn.lock",
}

IGNORED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".svg",
    ".session",
    ".session-journal",
    ".pyc",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".zip",
    ".tar",
    ".gz",
    ".mp4",
    ".mkv",
    ".avi",
    ".webm",
    ".mov",
    ".mp3",
    ".wav",
}


def is_benign_placeholder(text: str, file_path: Path | None = None) -> bool:
    """Check if line is an intentional placeholder, documentation comment, or test mock."""
    lower = text.lower()
    if file_path and "tests" in file_path.parts:
        return True
    return any(p in lower for p in (
        "your_", "placeholder", "example", "fake", "mock", "dummy",
        "user:pass", "admin:admin", "user:password", "admin:password",
        "your_mongo_password", "your_neo4j_password", "[redacted", "[redacted_password]"
    ))


def scan_file_for_secrets(file_path: Path) -> list[tuple[str, int, str]]:
    """Scan a single text file for raw secrets."""
    findings = []
    if file_path.name in IGNORED_FILES or file_path.name.startswith(".env."):
        return findings
    if file_path.suffix.lower() in IGNORED_EXTENSIONS:
        return findings

    try:
        rel_path = str(file_path.relative_to(BASE_DIR))
    except ValueError:
        rel_path = str(file_path)

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, start=1):
                clean_line = line.strip()
                if is_benign_placeholder(clean_line, file_path=file_path):
                    continue
                for name, pat in SECRET_PATTERNS:
                    if pat.search(line):
                        findings.append((rel_path, line_no, name))
    except Exception:
        pass
    return findings


def scan_file_for_scraping_providers(file_path: Path) -> list[tuple[str, int, str]]:
    """Scan a text file for references to scraping/proxy providers."""
    findings = []
    if file_path.name in IGNORED_FILES or file_path.name.startswith(".env.") or file_path.name == "scan_secrets.py":
        return findings
    if file_path.suffix.lower() in IGNORED_EXTENSIONS:
        return findings

    try:
        rel_path = str(file_path.relative_to(BASE_DIR))
    except ValueError:
        rel_path = str(file_path)

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            for line_no, line in enumerate(f, start=1):
                for name, pat in SCRAPING_PROVIDER_PATTERNS:
                    if pat.search(line):
                        findings.append((rel_path, line_no, name))
    except Exception:
        pass
    return findings


def scan_git_history(num_commits: int = 10) -> tuple[list[tuple[str, int, str]], list[tuple[str, int, str]]]:
    """Scans recent git diffs for secret patterns and scraping provider references."""
    secret_findings = []
    provider_findings = []
    try:
        cmd = ["git", "log", f"-n{num_commits}", "-p", "--no-color"]
        res = subprocess.run(cmd, cwd=str(BASE_DIR), capture_output=True, text=True, errors="ignore")
        if res.returncode == 0:
            current_file = "git_history"
            line_no = 0
            for line in res.stdout.splitlines():
                line_no += 1
                if line.startswith("+++ b/"):
                    current_file = line[6:]
                if line.startswith("+") and not line.startswith("+++"):
                    added_text = line[1:]
                    if not is_benign_placeholder(added_text):
                        for name, pat in SECRET_PATTERNS:
                            if pat.search(added_text):
                                secret_findings.append((f"git_history:{current_file}", line_no, name))
                    if current_file != "scripts/scan_secrets.py":
                        for name, pat in SCRAPING_PROVIDER_PATTERNS:
                            if pat.search(added_text):
                                provider_findings.append((f"git_history:{current_file}", line_no, name))
    except Exception:
        pass
    return secret_findings, provider_findings


def main():
    print("=" * 80)
    print("          NETRA STATIC CODE & GIT SECRET SCANNER")
    print("=" * 80)

    wt_secrets = []
    wt_providers = []

    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for f in files:
            p = Path(root) / f
            wt_secrets.extend(scan_file_for_secrets(p))
            wt_providers.extend(scan_file_for_scraping_providers(p))

    git_secrets, git_providers = scan_git_history(10)

    all_secrets = wt_secrets + git_secrets
    all_providers = wt_providers + git_providers

    fmt = "{:<45} | {:<8} | {:<24}"
    header = fmt.format("File / Source", "Line", "Pattern Name")

    print("\n--- 1. UNMASKED SECRET PATTERN AUDIT ---")
    print(header)
    print("-" * len(header))
    if all_secrets:
        for file_ref, line_no, pat_name in all_secrets:
            print(fmt.format(file_ref[:45], str(line_no), pat_name[:24]))
        print(f"[!] {len(all_secrets)} unmasked secret(s) found!")
    else:
        print("[OK] No unmasked secrets detected in working tree or recent git commits.")

    print("\n--- 2. SCRAPING / PROXY PROVIDER REFERENCES (AUDIT REVIEW) ---")
    print(header)
    print("-" * len(header))
    if all_providers:
        for file_ref, line_no, pat_name in all_providers:
            print(fmt.format(file_ref[:45], str(line_no), pat_name[:24]))
        print(f"[*] {len(all_providers)} scraping provider reference(s) located for manual review.")
    else:
        print("[OK] No scraping or proxy provider references located in codebase.")

    print("=" * 80)
    if all_secrets:
        print(f"SCAN RESULT: FAILED ({len(all_secrets)} secret patterns detected)")
        print("=" * 80)
        return 1
    else:
        print("SCAN RESULT: CLEAN (0 secrets found)")
        print("=" * 80)
        return 0


if __name__ == "__main__":
    sys.exit(main())
