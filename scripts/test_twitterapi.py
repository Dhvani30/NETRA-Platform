import os, requests
from dotenv import load_dotenv

load_dotenv()
key = (os.getenv("TWITTERAPI_IO_KEY") or "").strip()
print("key length:", len(key))

r = requests.get(
    "https://api.twitterapi.io/twitter/tweet/advanced_search",
    params={"query": "AI agents", "queryType": "Latest"},
    headers={"X-API-Key": key},
    timeout=30,
)
print("status:", r.status_code)
j = r.json()
print("top-level keys:", list(j.keys()))
tweets = j.get("tweets") or j.get("data") or []
print("tweets returned:", len(tweets))
if tweets:
    t = tweets[0]
    print("tweet fields:", sorted(t.keys()))
    print("author fields:", sorted((t.get("author") or {}).keys()))