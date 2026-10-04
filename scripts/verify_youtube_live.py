import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from app.collectors.youtube_ingestor import ingest_youtube_videos, get_db

def main():
    db = get_db()
    print("Executing Real YouTube Live Ingestor...")
    res = ingest_youtube_videos(db)
    print("\n" + "=" * 60)
    print("           YOUTUBE LIVE INGESTION RUN SUMMARY")
    print("=" * 60)
    print(f"Status:            {res.get('status')}")
    print(f"Reason:            {res.get('reason')}")
    print(f"Items Collected:   {res.get('count')}")
    print(f"Videos:            {res.get('videos_count')}")
    print(f"Comments:          {res.get('comments_count')}")
    print(f"Replies:           {res.get('replies_count')}")
    print(f"API Calls in Run:  {res.get('api_calls')}")
    print(f"Quota Used in Run: {res.get('quota_used')}")
    print(f"Quota Used Today:  {res.get('quota_used_today')}")
    print(f"Resume / Reset:    {res.get('resume_at')}")

    print("\n" + "=" * 60)
    print("         DB TOTAL DOCUMENT COUNTS BY EVENT TYPE")
    print("=" * 60)
    pipeline = [
        {"$match": {"platform": "youtube"}},
        {"$group": {"_id": "$event_type", "count": {"$sum": 1}}}
    ]
    for row in db["raw_posts"].aggregate(pipeline):
        print(f"  * {row['_id']}: {row['count']}")

    print("\n" + "=" * 60)
    print("               SAMPLE VIDEO DOCUMENT (HASHED)")
    print("=" * 60)
    sample_video = db["raw_posts"].find_one({"platform": "youtube", "event_type": "video"}, {"_id": 0})
    if sample_video:
        # Mask text if too long for display preview
        preview = dict(sample_video)
        if len(preview.get("text", "")) > 180:
            preview["text"] = preview["text"][:180] + "..."
        print(json.dumps(preview, indent=2, default=str))
    else:
        print("No video documents found.")

    print("\n" + "=" * 60)
    print("           SAMPLE COMMENT / REPLY DOCUMENT (HASHED)")
    print("=" * 60)
    sample_comment = db["raw_posts"].find_one(
        {"platform": "youtube", "event_type": {"$in": ["comment", "reply"]}},
        {"_id": 0}
    )
    if sample_comment:
        preview = dict(sample_comment)
        if len(preview.get("text", "")) > 180:
            preview["text"] = preview["text"][:180] + "..."
        print(json.dumps(preview, indent=2, default=str))
    else:
        print("No comment/reply documents found.")

if __name__ == "__main__":
    main()
