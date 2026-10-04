import os, requests
from dotenv import load_dotenv

load_dotenv()
inst = os.getenv("MASTODON_INSTANCE")
tok = os.getenv("MASTODON_TOKEN")
headers = {"Authorization": f"Bearer {tok}"} if tok else {}

r = requests.get(f"https://{inst}/api/v1/timelines/tag/cybersecurity",
                 params={"limit": 5}, headers=headers, timeout=20)
print("status:", r.status_code)
if r.ok:
    posts = r.json()
    print("posts returned:", len(posts))
    for p in posts[:3]:
        print(p["created_at"], "|", p["language"], "|", len(p["content"]), "chars")
else:
    print(r.text[:200])