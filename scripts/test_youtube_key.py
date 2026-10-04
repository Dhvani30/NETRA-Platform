import os
import sys
import json
import urllib.request
import urllib.parse
import urllib.error
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip()

def run_smoke_test():
    if not YOUTUBE_API_KEY:
        print("[!] ERROR: YOUTUBE_API_KEY is not set or empty in .env.")
        print("    Please set YOUTUBE_API_KEY in your root .env file.")
        sys.exit(1)

    query = "cybersecurity India"
    params = urllib.parse.urlencode({
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": 3,
        "key": YOUTUBE_API_KEY
    })
    url = f"https://www.googleapis.com/youtube/v3/search?{params}"

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "NETRA-YouTube-Tester/1.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8"))
            items = data.get("items", [])
            print(f"[+] SUCCESS: YouTube API key verified. Fetched {len(items)} sample videos for query '{query}':")
            for idx, item in enumerate(items, 1):
                vid = item.get("id", {}).get("videoId", "unknown")
                raw_title = item.get("snippet", {}).get("title", "No Title")
                clean_title = raw_title.encode("ascii", "replace").decode("ascii")
                print(f"    {idx}. ID: {vid} | Title: {clean_title}")
            return 0
    except urllib.error.HTTPError as e:
        status_code = e.code
        err_body = ""
        reason = ""
        try:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body)
            errors_list = err_json.get("error", {}).get("errors", [])
            if errors_list:
                reason = errors_list[0].get("reason", "")
            err_msg = err_json.get("error", {}).get("message", "")
        except Exception:
            err_msg = str(e)

        print(f"[!] YouTube API HTTP Error: {status_code}")
        if status_code in (400, 403):
            print("\n[!] LIKELY CAUSE:")
            if reason == "quotaExceeded" or "quota" in err_msg.lower():
                print("    - Quota Exceeded: Your YouTube Data API v3 daily quota (10,000 units) has been exhausted.")
            elif reason == "accessNotConfigured" or "has not been used" in err_msg.lower() or "disabled" in err_msg.lower():
                print("    - API Not Enabled: YouTube Data API v3 is not enabled in your Google Cloud Console project.")
                print("      Enable it at: https://console.cloud.google.com/apis/library/youtube.googleapis.com")
            elif reason in ("ipRefererBlocked", "forbidden", "keyInvalid") or "API key not valid" in err_msg or status_code == 400:
                print("    - Key Restriction or Invalid Key: The API key has restrictions (e.g. HTTP referrers, IP restrictions, or API scope restrictions) preventing this request, or the key is invalid.")
            else:
                print(f"    - Details: {err_msg} (reason: {reason})")
        else:
            print(f"    - Unexpected status code {status_code}: {err_msg}")
        sys.exit(1)
    except Exception as e:
        # Avoid printing full URL which contains the key
        print(f"[!] Network or connection error: {e.__class__.__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_smoke_test()
