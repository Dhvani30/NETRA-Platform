import os, requests
from dotenv import load_dotenv

load_dotenv()
t = (os.getenv("INSTAGRAM_ACCESS_TOKEN") or "").strip().strip('"').strip("'")
print("token length:", len(t))

r = requests.get(
    "https://graph.instagram.com/me",
    params={"fields": "user_id,username,account_type,media_count", "access_token": t},
    timeout=20,
)
j = r.json()
print("status:", r.status_code)
if "error" in j:
    print({k: j["error"].get(k) for k in ("message", "type", "code")})
else:
    print(j)