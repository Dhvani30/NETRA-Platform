import os, requests
from dotenv import load_dotenv

load_dotenv()
key = (os.getenv("TWITTERAPI_IO_KEY") or "").strip()
r = requests.get("https://api.twitterapi.io/twitter/tweet/advanced_search",
                 params={"query": "AI agents", "queryType": "Latest"},
                 headers={"X-API-Key": key}, timeout=30)
tweets = r.json().get("tweets", [])
print("createdAt samples:", [t.get("createdAt") for t in tweets[:2]])
print("type values:", sorted({str(t.get("type")) for t in tweets}))
print("replies in sample:", sum(1 for t in tweets if t.get("isReply")))
print("with inReplyToId:", sum(1 for t in tweets if t.get("inReplyToId")))
print("entities keys:", sorted({k for t in tweets for k in (t.get("entities") or {}).keys()}))
e = next((t["entities"] for t in tweets if t.get("entities")), {})
for k, v in e.items():
    if isinstance(v, list) and v and isinstance(v[0], dict):
        print(f"entities.{k} item keys:", sorted(v[0].keys()))