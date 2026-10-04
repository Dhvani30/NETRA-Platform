import os, requests
from dotenv import load_dotenv

load_dotenv()
handle = (os.getenv("BLUESKY_HANDLE") or "").strip().lstrip("@")
pw = (os.getenv("BLUESKY_APP_PASSWORD") or "").strip()
print("handle:", handle, "| password length:", len(pw))

# 1. Log in
r = requests.post("https://bsky.social/xrpc/com.atproto.server.createSession",
                  json={"identifier": handle, "password": pw}, timeout=20)
print("login status:", r.status_code)
if not r.ok:
    print(r.text[:200])
    raise SystemExit(1)
jwt = r.json()["accessJwt"]

# 2. Search with the session
s = requests.get("https://bsky.social/xrpc/app.bsky.feed.searchPosts",
                 params={"q": "cybersecurity", "limit": 5, "sort": "latest"},
                 headers={"Authorization": f"Bearer {jwt}"}, timeout=20)
print("search status:", s.status_code)
if s.ok:
    posts = s.json().get("posts", [])
    print("posts returned:", len(posts))
    for p in posts[:3]:
        print(p["record"].get("createdAt"), "|", len(p["record"].get("text", "")), "chars")
else:
    print(s.text[:200])