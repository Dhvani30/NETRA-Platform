#!/usr/bin/env python
"""Report raw-post provenance counts; optionally and safely purge SYNTH only."""
from __future__ import annotations

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / '.env')
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017'), serverSelectionTimeoutMS=5000)
collection = client[os.getenv('DB_NAME', 'social_intel')][os.getenv('COLLECTION_NAME', 'raw_posts')]


def rows():
    return list(collection.aggregate([
        {'$group': {'_id': {
            'platform': {'$ifNull': ['$platform', 'unknown']},
            'source_mode': {'$toUpper': {'$ifNull': ['$source_mode', '$metadata.source_mode']}},
            'dataset': '$dataset', 'source_file': '$source_file',
        }, 'count': {'$sum': 1}, 'oldest': {'$min': '$created_at'}, 'newest': {'$max': '$created_at'}}},
        {'$sort': {'_id.platform': 1, '_id.source_mode': 1, '_id.dataset': 1}},
    ]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--details', action='store_true', help='show platform, mode, provenance, oldest/newest, count')
    parser.add_argument('--purge-synth', action='store_true', help='delete only SYNTH/SYNTHETIC records after confirmation')
    args = parser.parse_args()
    if args.details or not args.purge_synth:
        for row in rows():
            key = row['_id']; print(f"platform={key['platform']} mode={key['source_mode'] or 'UNKNOWN'} dataset={key.get('dataset') or '—'} source_file={key.get('source_file') or '—'} oldest={row.get('oldest') or '—'} newest={row.get('newest') or '—'} count={row['count']}")
    if args.purge_synth:
        query = {'$or': [{'source_mode': {'$in': ['SYNTH', 'SYNTHETIC']}}, {'metadata.source_mode': {'$in': ['SYNTH', 'SYNTHETIC']}}]}
        count = collection.count_documents(query)
        answer = input(f"About to delete {count} SYNTH rows only. Type PURGE SYNTH to confirm: ")
        if answer == 'PURGE SYNTH': print(f"Deleted {collection.delete_many(query).deleted_count} SYNTH rows.")
        else: print('Cancelled; no rows deleted.')


if __name__ == '__main__': main()
