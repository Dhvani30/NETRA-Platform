import os, requests
from dotenv import load_dotenv

load_dotenv()
Q = "cybersecurity"

r = requests.get("https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts",
                 params={"q": Q, "limit": 5}, timeout=20)
print("public search status:", r.status_code)
if r.ok:
    posts = r.json().get("posts", [])
    print("posts returned:", len(posts))
    for p in posts[:3]:
        print(p["record"].get("createdAt"), "|", len(p["record"].get("text", "")), "chars")
else:
    print(r.text[:200])
    h, pw = os.getenv("BLUESKY_HANDLE"), os.getenv("BLUESKY_APP_PASSWORD")
    print("login credentials in .env:", bool(h and pw))