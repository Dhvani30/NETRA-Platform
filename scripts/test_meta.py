import os, requests
from dotenv import load_dotenv

load_dotenv()
V = os.getenv("META_GRAPH_VERSION")
TOKEN = os.getenv("META_ACCESS_TOKEN")
PAGE = os.getenv("META_FACEBOOK_PAGE_ID")
IG = os.getenv("INSTAGRAM_ACCOUNT_ID")
IG_TOKEN = os.getenv("INSTAGRAM_ACCESS_TOKEN")
FB = f"https://graph.facebook.com/{V}"

def show(label, r):
    j = r.json()
    if "error" in j:
        e = j["error"]
        print(f"{label}: ERROR {r.status_code} code={e.get('code')} {e.get('message')}")
        return None
    return j

print("token starts with:", (TOKEN or "")[:3], "| ig token starts with:", (IG_TOKEN or "")[:2])

# 1. Facebook Page
j = show("Page", requests.get(f"{FB}/{PAGE}", params={"fields": "name,instagram_business_account", "access_token": TOKEN}, timeout=20))
if j:
    print("Page name:", j.get("name"), "| linked instagram:", "instagram_business_account" in j)

# 2. Facebook posts and comments
j = show("Posts", requests.get(f"{FB}/{PAGE}/posts", params={"fields": "id,created_time,comments.summary(true).limit(0)", "limit": 5, "access_token": TOKEN}, timeout=20))
if j:
    print("Facebook posts returned:", len(j.get("data", [])))

# 3. Instagram through the Page token
j = show("IG via Page token", requests.get(f"{FB}/{IG}", params={"fields": "username,media_count", "access_token": TOKEN}, timeout=20))
if j:
    print("IG username:", j.get("username"), "| media:", j.get("media_count"))
    j2 = show("IG media", requests.get(f"{FB}/{IG}/media", params={"fields": "id,timestamp,comments_count", "limit": 5, "access_token": TOKEN}, timeout=20))
    if j2:
        print("IG media returned:", len(j2.get("data", [])))

# 4. Instagram through the Instagram Login token
if IG_TOKEN:
    j = show("IG Login token", requests.get("https://graph.instagram.com/me", params={"fields": "user_id,username,account_type", "access_token": IG_TOKEN}, timeout=20))
    if j:
        print("IG Login OK:", j.get("username"), j.get("account_type"))