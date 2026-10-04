"""
CLI runner for NETRA Integrity Checker.
Verifies collection windows, source labeling, privacy, timestamps, and import provenance.
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR / "backend"))

from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(dotenv_path=BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "social_intel")

from app.core.integrity import run_integrity_check

def main():
    print("=" * 78)
    print("   NETRA INTELLIGENCE PLATFORM -- FORENSIC INTEGRITY AUDIT")
    print("=" * 78)
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
        report = run_integrity_check(client, DB_NAME)
    except Exception as e:
        print(f"[!] Critical Error connecting to database: {e}")
        sys.exit(1)

    print(f"Audit Timestamp: {report['checked_at']}")
    print(f"Total Documents Scanned: {report['total_documents']}\n")

    summary = report["summary"]
    print("--- GLOBAL AUDIT SUMMARY ---")
    print(f"  * LIVE Documents:             {summary['live_documents']}")
    print(f"  * LIVE_THIRD_PARTY Documents:  {summary['third_party_documents']}")
    print(f"  * IMPORT Documents:           {summary['imported_documents']}")
    print(f"  * SYNTH Documents:            {summary['synthetic_documents']}")
    print(f"  * Valid UTC ISO Timestamps:   {summary['valid_utc_timestamps']}")
    print(f"  * Null Timestamps:            {summary['null_timestamps']}")
    print(f"  * Future Timestamps Detected: {summary['future_timestamps']}")
    print(f"  * Time-Series Available:      {summary['time_series_available']}")
    print(f"  * Privacy Violations:         {summary['privacy_violations']}")
    print(f"  * Mislabeled LIVE Records:    {summary['mislabeled_live']}")
    print(f"  * Missing LIVE Identifiers:   {summary['missing_identifiers']}")
    print(f"  * Missing IMPORT Provenance:  {summary['missing_import_provenance']}\n")

    print("--- PER-SOURCE INTEGRITY BREAKDOWN ---")
    header = f"{'Source':<12} | {'Total':<6} | {'LIVE':<5} | {'3RD':<5} | {'IMPORT':<6} | {'Privacy':<8} | {'Modes':<8} | {'Status':<6}"
    print(header)
    print("-" * len(header))
    for src, details in sorted(report["per_source"].items()):
        priv_str = "CLEAN" if details["privacy_clean"] else "FAIL"
        mode_str = "CLEAN" if details["source_mode_clean"] else "FAIL"
        print(f"{src:<12} | {details['total']:<6} | {details['live_count']:<5} | {details['third_party_count']:<5} | {details['import_count']:<6} | {priv_str:<8} | {mode_str:<8} | {details['status']:<6}")

    print("\n" + "=" * 78)
    if report["verdict"] == "PASS":
        print("  FINAL AUDIT VERDICT: [PASS] -- ALL FORENSIC INTEGRITY CONSTRAINTS SATISFIED")
        print("=" * 78)
        sys.exit(0)
    else:
        print("  FINAL AUDIT VERDICT: [FAIL] -- INTEGRITY DEFECTS DETECTED")
        if report.get("issues"):
            print("  Top Detected Issues:")
            for issue in report["issues"][:10]:
                print(f"   - {issue}")
        print("=" * 78)
        sys.exit(1)

if __name__ == "__main__":
    main()
