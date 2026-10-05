"""Privacy-safe collector for Pages and professional Instagram via Meta Graph API."""
from __future__ import annotations
import csv, hashlib, json, logging, os, re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
import httpx
from dotenv import load_dotenv
from pymongo import UpdateOne
from app.connectors import set_connector_status
from app.schema import empty_metrics
from app.core.env_utils import get_clean_env, validate_token_shape, is_source_enabled
from app.core.live_events import publish_documents

ROOT = Path(__file__).resolve().parents[3]; load_dotenv(ROOT / ".env")
IMPORT_DIR = ROOT / "data" / "import" / "meta"
MONGO_URI=get_clean_env("MONGO_URI","mongodb+srv://admin:admin123@cluster0.joyab6x.mongodb.net/NETRA?retryWrites=true&w=majority&authSource=admin"); DB_NAME=get_clean_env("DB_NAME","social_intel")
logger=logging.getLogger("NETRA.Meta")
class MetaRedactionFilter(logging.Filter):
    """Remove secret query values and token-looking fragments from every Meta log."""
    pattern=re.compile(r"(?:(?:access_token|client_secret|fb_exchange_token)=)([^&\s]+)|\b(?:EAA|IG)[A-Za-z0-9_.|\-]{20,}\b",re.I)
    def filter(self, record):
        # Resolve formatting first: replacing a value after a %s placeholder
        # would otherwise leave logging with incompatible message arguments.
        record.msg=self.pattern.sub("[REDACTED]",record.getMessage()); record.args=()
        return True
if not any(isinstance(f,MetaRedactionFilter) for f in logger.filters): logger.addFilter(MetaRedactionFilter())
def hid(value: Any)->str|None: return hashlib.sha256(str(value).encode()).hexdigest()[:16] if value not in (None,"") else None
def _now(): return datetime.now(timezone.utc).isoformat()
def _iso(v):
    try: return datetime.fromisoformat(str(v).replace("Z","+00:00")).astimezone(timezone.utc).isoformat() if v else None
    except (ValueError,TypeError): return None
def _redact(v): return MetaRedactionFilter.pattern.sub("[REDACTED]",str(v))
def _raw_env(name):
    """Keep supplied token bytes intact so validation catches paste artefacts."""
    return os.environ.get(name, "")
def _cfg(p, discovered_instagram_id=None):
    page_token=_raw_env("META_ACCESS_TOKEN"); ig_token=_raw_env("INSTAGRAM_ACCESS_TOKEN")
    ident=(get_clean_env("INSTAGRAM_ACCOUNT_ID") or get_clean_env("META_INSTAGRAM_ACCOUNT_ID") or discovered_instagram_id) if p=="instagram" else get_clean_env("META_FACEBOOK_PAGE_ID")
    # Instagram starts on the Page/system-user Graph route. The optional
    # Instagram Login token is a permission-error fallback only.
    return {"token":page_token,"page_token":page_token,"ig_token":ig_token if p=="instagram" else "","using_page_token":p=="instagram","using_instagram_login":False,"id":ident,"v":get_clean_env("META_GRAPH_VERSION","v26.0"),"pages":max(1,int(get_clean_env("META_MAX_PAGES","3"))),"lookback":max(1,int(get_clean_env("META_COMMENT_LOOKBACK_DAYS","7")))}
def _doc(p,item,event,parent_id=None,reply_to_author=None,url=None):
    ident=str(item.get("id") or ""); text=item.get("message") or item.get("text") or item.get("caption") or ""
    if not ident: return None
    author=item.get("from") if isinstance(item.get("from"),dict) else {}; raw=author.get("id") or item.get("username") or item.get("from_id") or item.get("user_id")
    reactions=((item.get("reactions") or {}).get("summary") or {}).get("total_count")
    metrics=empty_metrics(likes=item.get("like_count"),replies=item.get("comment_count") or item.get("comments_count"),shares=((item.get("shares") or {}).get("count") if isinstance(item.get("shares"),dict) else None));metrics["reactions"]=reactions
    return {"platform":p,"post_id":ident,"canonical_id":f"{p}:{ident}","event_type":event,"parent_id":str(parent_id) if parent_id else None,"reply_to_author":reply_to_author,"author_id":hid(raw or f"anon:{p}:{ident}"),"author_known":bool(raw),"text":text,"text_content":text,"created_at":_iso(item.get("created_time") or item.get("timestamp") or item.get("created_at")),"lang":None,"hashtags":re.findall(r"(?<!\w)#\w+",text),"mentions":re.findall(r"(?<!\w)@\w+",text),"urls":[url] if url else [],"url":url,"metrics":metrics,"source_mode":"LIVE","collected_at":_now(),"ingested_at":_now(),"processed":False}
def _error(resp):
    try: e=resp.json().get("error",{})
    except ValueError: e={}
    code,msg=e.get("code"),_redact(e.get("message") or "Meta Graph API request failed")
    if code==190:return "CREDENTIALS_REQUIRED","token expired or invalid"
    if resp.status_code==429 or code in {4,17,32,613}:return "RATE_LIMITED","Meta rate limit reached; retry is scheduled."
    if code in {10,200,299} or resp.status_code in {401,403} or "permission" in msg.lower():return "PERMISSION_REQUIRED",f"Meta permission required: {msg[:180]}"
    return "DEGRADED","Meta Graph API request failed; retry is scheduled."
def _ok(response): return getattr(response,"is_success", getattr(response,"status_code",500) < 400)
def _host(cfg):
    """Page/system-user tokens always use Graph Facebook; Login tokens use IG Graph."""
    return "https://graph.instagram.com" if cfg.get("using_instagram_login") else "https://graph.facebook.com"
class MetaGraphError(httpx.HTTPStatusError):
    def __init__(self, response, calls):
        super().__init__(_redact(getattr(response,"text","Meta error")),request=response.request,response=response)
        self.calls=calls
def _pages(client,url,params,cap):
    rows=[]; calls=0
    for _ in range(cap):
        r=client.get(url,params=params,timeout=20);calls+=1
        if not _ok(r):raise MetaGraphError(r,calls)
        body=r.json();rows.extend(body.get("data",[]));url=(body.get("paging") or {}).get("next");params={}
        if not url:break
    return rows,calls
def _comments(client,host,cfg,p,oid,parent_author):
    fields="id,message,created_time,like_count,comment_count,parent,from,comments{id,message,created_time,like_count,comment_count,parent,from}" if p=="facebook" else "id,text,timestamp,username,like_count,replies{id,text,timestamp,username,like_count}"
    rows,calls=_pages(client,f"{host}/{cfg['v']}/{oid}/comments",{"fields":fields,"access_token":cfg["token"]},cfg["pages"]);docs=[]
    for row in rows:
        parent=(row.get("parent") or {}).get("id") or oid; top=_doc(p,row,"reply" if parent!=oid else "comment",parent,parent_author)
        if top:docs.append(top)
        for reply in row.get("comments") or row.get("replies") or []:
            rd=_doc(p,reply,"reply",row.get("id"),top.get("author_id") if top else None)
            if rd:docs.append(rd)
    return docs,calls
def check_token_health(db,p,client=None):
    stored=db["collector_state"].find_one({"_id":"meta_discovered_instagram"}) or {}
    cfg=_cfg(p, stored.get("account_id"));health={"valid":False,"expires_at":None,"type":None,"scopes":[],"checked_at":_now()}
    if not cfg["token"]:db["collector_state"].update_one({"_id":f"meta_token:{p}"},{"$set":health},upsert=True);return health
    if not validate_token_shape(cfg["token"], "IG" if cfg.get("using_instagram_login") else "EAA")["ok"]:
        db["collector_state"].update_one({"_id":f"meta_token:{p}"},{"$set":health},upsert=True);return health
    own=client is None;client=client or httpx.Client()
    try:
        aid,secret=get_clean_env("META_APP_ID"),get_clean_env("META_APP_SECRET")
        if aid and secret:
            r=client.get(f"https://graph.facebook.com/{cfg['v']}/debug_token",params={"input_token":cfg["token"],"access_token":f"{aid}|{secret}"},timeout=15);d=r.json().get("data",{}) if _ok(r) else {};expiry=datetime.fromtimestamp(d["expires_at"],timezone.utc).date().isoformat() if d.get("expires_at") else None;health.update(valid=bool(d.get("is_valid")),expires_at=expiry,type=d.get("type"),scopes=d.get("scopes") or [])
        else:health["valid"]=_ok(client.get(f"{_host(cfg)}/{cfg['v']}/me",params={"fields":"id","access_token":cfg["token"]},timeout=15))
    except httpx.HTTPError:pass
    finally:
        if own:client.close()
    db["collector_state"].update_one({"_id":f"meta_token:{p}"},{"$set":health},upsert=True)
    if health["expires_at"] and datetime.fromisoformat(health["expires_at"]).date()<=(datetime.now(timezone.utc)+timedelta(days=7)).date():set_connector_status(db,p,"DEGRADED",mode="LIVE",message="Token expires within 7 days; update .env before collection stops.")
    return health
def initialize_meta_status(db):
    for p in ("facebook","instagram"):
        stored=db["collector_state"].find_one({"_id":"meta_discovered_instagram"}) or {}
        cfg=_cfg(p, stored.get("account_id"))
        if p=="instagram" and not cfg["id"] and not cfg["page_token"] and not cfg["ig_token"]:set_connector_status(db,p,"DISABLED",mode="LIVE",message="Instagram is not configured; Facebook polling continues independently.")
        elif not cfg["token"] or (p=="facebook" and not cfg["id"]):set_connector_status(db,p,"CREDENTIALS_REQUIRED",mode="LIVE",message="Meta token or Page ID is missing.")
        else:check_token_health(db,p)
def import_meta_exports(db):
    """Compatibility import path for explicitly supplied exports; never scraped."""
    count=0
    if not IMPORT_DIR.exists():return count
    for path in list(IMPORT_DIR.glob("*.json"))+list(IMPORT_DIR.glob("*.csv")):
        try:
            rows=json.loads(path.read_text(encoding="utf-8")) if path.suffix==".json" else list(csv.DictReader(path.open(encoding="utf-8")))
            rows=rows if isinstance(rows,list) else rows.get("data",[])
            for row in rows:
                p=str(row.get("platform") or ("instagram" if "instagram" in path.name.lower() else "facebook")).lower();d=_doc(p,row,row.get("event_type") or "post",row.get("parent_id"))
                if d:db["raw_posts"].update_one({"platform":p,"post_id":d["post_id"]},{"$set":{**d,"source_mode":"IMPORT","dataset":"meta_public_export","source_file":str(path)}},upsert=True);count+=1;set_connector_status(db,p,"IMPORT",mode="IMPORT",success=True)
        except (OSError,ValueError,json.JSONDecodeError,csv.Error):continue
    return count
def _result(status="READY",reason=None,message=None,step="validate_env"):
    return {"status":status,"reason":reason,"message":message,"first_failing_step":step,"route":None,"api_calls":0,"count":0,"inserted":{"posts":0,"comments":0,"replies":0}}
def _shape_message(problems, expected_prefix):
    text=[]
    if "too_short" in problems:text.append("is shorter than a Page token")
    if "unexpected_prefix" in problems:text.append(f"does not start with {expected_prefix}")
    if "contains_whitespace" in problems:text.append("contains whitespace")
    if "contains_quotes" in problems:text.append("contains quotes")
    if "invalid_characters" in problems:text.append("contains unsupported characters")
    return "Token " + "; ".join(text or ["is missing"]) + ". Paste the full token with no quotes or whitespace."
def _discover_instagram(client,cfg):
    r=client.get(f"https://graph.facebook.com/{cfg['v']}/{get_clean_env('META_FACEBOOK_PAGE_ID')}",params={"fields":"instagram_business_account","access_token":cfg["page_token"]},timeout=20)
    if not _ok(r):raise httpx.HTTPStatusError(_redact(getattr(r,"text","Meta error")),request=r.request,response=r)
    return ((r.json().get("instagram_business_account") or {}).get("id"))
def ingest_meta(target_db=None,platform=None,_instagram_fallback=False):
    if target_db is None:
        from pymongo import MongoClient
        target_db=MongoClient(MONGO_URI,serverSelectionTimeoutMS=5000)[DB_NAME]
    per={}
    for p in ([platform] if platform else ["facebook","instagram"]):
        if p not in {"facebook","instagram"}: raise ValueError("platform must be facebook, instagram, or None")
        r=_result()
        if not is_source_enabled(p):
            r.update(status="DISABLED",reason="not_enabled_in_this_build",message="Not enabled in this build.")
            set_connector_status(target_db,p,"DISABLED",mode="DISABLED",message=r["message"],reason="not_enabled_in_this_build")
            per[p]=r;continue
        stored=target_db["collector_state"].find_one({"_id":"meta_discovered_instagram"}) or {}
        cfg=_cfg(p, stored.get("account_id"))
        if p=="instagram" and _instagram_fallback:
            cfg.update(token=cfg["ig_token"],using_page_token=False,using_instagram_login=True)
        r["route"] = "instagram_login_graph" if cfg["using_instagram_login"] else ("instagram_page_graph" if p=="instagram" else "facebook_page_graph")
        if not re.fullmatch(r"v\d+(?:\.\d+)?", cfg["v"]):
            r.update(status="CREDENTIALS_REQUIRED",reason="config_invalid",message="META_GRAPH_VERSION must be a value such as v22.0.");set_connector_status(target_db,p,"CREDENTIALS_REQUIRED",mode="LIVE",message=r["message"]);per[p]=r;continue
        if p=="instagram" and not cfg["id"] and not cfg["ig_token"] and not cfg["page_token"]:
            r.update(status="DISABLED",reason="instagram_not_configured",message="Instagram credentials are not configured; Facebook remains active.");set_connector_status(target_db,p,"DISABLED",mode="LIVE",message=r["message"]);per[p]=r;continue
        if not cfg["token"]:
            r.update(status="CREDENTIALS_REQUIRED",reason="token_missing",message="Meta token is missing.");set_connector_status(target_db,p,"CREDENTIALS_REQUIRED",mode="LIVE",message=r["message"]);per[p]=r;continue
        # Prefix follows the route actually being attempted, not the mere
        # presence of an optional fallback credential.
        expected_prefix="IG" if cfg.get("using_instagram_login") else "EAA"
        shape=validate_token_shape(cfg["token"], expected_prefix)
        if not shape["ok"]:
            r.update(status="CREDENTIALS_REQUIRED",reason="token_malformed",message=_shape_message(shape["problems"], expected_prefix),first_failing_step="validate_shape");set_connector_status(target_db,p,"CREDENTIALS_REQUIRED",mode="LIVE",message=r["message"]);per[p]=r;continue
        if not cfg["id"] and p=="facebook":
            r.update(status="CREDENTIALS_REQUIRED",reason="page_id_missing",message="META_FACEBOOK_PAGE_ID is missing.");set_connector_status(target_db,p,"CREDENTIALS_REQUIRED",mode="LIVE",message=r["message"]);per[p]=r;continue
        try:
            with httpx.Client() as client:
                if p=="instagram" and not cfg["id"]:
                    cfg["id"]=_discover_instagram(client,cfg);r["api_calls"]+=1
                    if not cfg["id"]:
                        r.update(status="DISABLED",reason="instagram_not_linked",message="No professional Instagram account is linked to this Facebook Page.",first_failing_step="call_graph");set_connector_status(target_db,p,"DISABLED",mode="LIVE",message=r["message"]);per[p]=r;continue
                    target_db["collector_state"].update_one({"_id":"meta_discovered_instagram"},{"$set":{"account_id":cfg["id"],"discovered_at":_now()}},upsert=True)
                host=_host(cfg);edge="posts" if p=="facebook" else "media";fields="id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true),from" if p=="facebook" else "id,caption,media_type,permalink,timestamp,like_count,comments_count";params={"fields":fields,"access_token":cfg["token"]}
                wm=target_db["collector_state"].find_one({"_id":f"meta_watermark:{p}"}) or {}
                if wm.get("latest_created_at"):params["since"]=wm["latest_created_at"]
                rows,calls=_pages(client,f"{host}/{cfg['v']}/{cfg['id']}/{edge}",params,cfg["pages"]);r["api_calls"]+=calls;docs=[]
                for item in rows:
                    post=_doc(p,item,"post",url=item.get("permalink_url") or item.get("permalink"));
                    if post:docs.append(post)
                    created=_iso(item.get("created_time") or item.get("timestamp"))
                    if created and created>=(datetime.now(timezone.utc)-timedelta(days=cfg["lookback"])).isoformat():
                        cs,cc=_comments(client,host,cfg,p,str(item.get("id")),post.get("author_id") if post else None);docs.extend(cs);r["api_calls"]+=cc
                ids=[d["post_id"] for d in docs];existing={d["post_id"] for d in target_db["raw_posts"].find({"platform":p,"post_id":{"$in":ids}},{"post_id":1})} if ids else set()
                if docs:
                    operations=[UpdateOne({"platform":p,"post_id":d["post_id"]},{"$set":d},upsert=True) for d in docs]
                    try:target_db["raw_posts"].bulk_write(operations,ordered=False)
                    except TypeError:
                        for d in docs:target_db["raw_posts"].update_one({"platform":p,"post_id":d["post_id"]},{"$set":d},upsert=True)
                    publish_documents([d for d in docs if d["post_id"] not in existing])
                for d in docs:
                    if d["post_id"] not in existing:r["inserted"][d["event_type"]+"s"]+=1
                r["count"]+=len(docs);newest=max((d.get("created_at") for d in docs if d.get("created_at")),default=None)
                if newest:target_db["collector_state"].update_one({"_id":f"meta_watermark:{p}"},{"$max":{"latest_created_at":newest},"$set":{"last_comment_checked":_now()}},upsert=True)
                set_connector_status(target_db,p,"LIVE",mode="LIVE",success=True)
                if not rows:
                    r.update(status="LIVE",reason="no_content_yet",message="Graph access succeeded, but this account has no content in the current collection window.",first_failing_step=None)
                else:
                    r.update(status="LIVE",reason=None,message="Instagram is using the Page token." if cfg["using_page_token"] else "Collection succeeded.",first_failing_step=None)
        except httpx.HTTPStatusError as exc:
            st,msg=_error(exc.response);reason="token_invalid_or_expired" if getattr(exc.response,"status_code",None)==190 or (lambda x: x.get("error",{}).get("code") if isinstance(x,dict) else None)(exc.response.json())==190 else ("permission_missing" if st=="PERMISSION_REQUIRED" else "rate_limited" if st=="RATE_LIMITED" else "network_error");r.update(status=st,reason=reason,message=msg,first_failing_step="call_graph");set_connector_status(target_db,p,st,mode="LIVE",message=msg)
            r["api_calls"] += getattr(exc,"calls",1)
            # The Page/system-user route is the default. Retry with the
            # optional Instagram Login token only after its real permission
            # error; never use it to mask malformed or expired Page tokens.
            if p=="instagram" and not _instagram_fallback and reason=="permission_missing" and cfg.get("ig_token"):
                fallback_shape=validate_token_shape(cfg["ig_token"], "IG")
                if fallback_shape["ok"]:
                    retry=ingest_meta(target_db, platform="instagram", _instagram_fallback=True)
                    retry["instagram"]["api_calls"] += r["api_calls"]
                    retry["summary"]["api_calls"] += r["api_calls"]
                    return retry
        except (httpx.HTTPError,ValueError) as exc:
            logger.warning("Meta %s connection failed: %s",p,_redact(exc));r.update(status="DEGRADED",reason="network_error",message="Meta Graph API connection failed; retry is scheduled.",first_failing_step="call_graph");set_connector_status(target_db,p,"DEGRADED",mode="LIVE",message=r["message"])
        per[p]=r
    for source, value in per.items():
        target_db["collector_state"].update_one({"_id":f"connector:{source}"},{"$set":{"reason":value["reason"],"message":value["message"],"updated_at":_now()}},upsert=True)
    statuses=[v["status"] for v in per.values()]; overall="LIVE" if "LIVE" in statuses else (statuses[0] if statuses else "READY")
    summary={"status":overall,"count":sum(v["count"] for v in per.values()),"api_calls":sum(v["api_calls"] for v in per.values()),"inserted":{k:sum(v["inserted"][k] for v in per.values()) for k in ("posts","comments","replies")}}
    # Keep per-platform records top-level so callers cannot accidentally collapse a partial failure.
    return {**per, "summary":summary}
