# NETRA `raw_posts` data dictionary

`social_intel.raw_posts` is the canonical record store. All timestamps are UTC
ISO-8601 strings when the source provides a timestamp. A missing source
timestamp is `null`; collection code must never substitute the current time
for `created_at`.

| Field | Type | Meaning |
| --- | --- | --- |
| `platform` | string | Lowercase origin, for example `telegram`, `youtube`, `reddit`, or `x`. |
| `post_id` | string | Native post/message/comment identifier within the platform. |
| `canonical_id` | string | Stable identifier, normally `<platform>:<post_id>`. |
| `parent_id` | string/null | Native parent post identifier for a reply/comment. |
| `author_id` | string/null | SHA-256-truncated identifier made with the collector `hid()` helper. Raw usernames and user IDs must not be stored. |
| `reply_to_author` | string/null | Hashed author identifier of the reply target. |
| `event_type` | string | `post`, `message`, `video`, `comment`, or `reply`. |
| `text` | string/null | Source text retained for analysis. `text_content` is a legacy compatibility alias. |
| `created_at` | UTC ISO-8601 string/null | Source publication/creation time. |
| `ingested_at` | UTC ISO-8601 string/null | Time NETRA received the record. |
| `lang` | string/null | Source-supplied language code; `null` when unknown. |
| `hashtags`, `mentions`, `urls` | arrays | Parsed source values; empty when none/unknown. |
| `metrics` | object | Always has `likes`, `replies`, `shares`, and `views`; individual unknowns are `null`. |
| `source_mode` | string | Origin truth label: `LIVE`, `IMPORT`, or `SYNTH`. |
| `dataset` | string/null | Named imported or synthetic dataset. |
| `source_file` | string/null | Relative import filename, never its contents. |

`published_at`, `collected_at`, `text_content`, and `ai_analysis` remain only
as backward-compatible legacy fields. New analytics must read canonical fields.

## Derived fields

Derived fields are nullable until a method produces them. Whenever a derived
value is present, it includes `method`, `model_version`, `confidence` (0–1),
and `scored_at` (UTC ISO-8601). The value properties are:

| Field | Value properties |
| --- | --- |
| `sentiment` | `label` (`positive`, `negative`, `neutral`), signed `score` |
| `emotions` | `label`, plus `anxiety`, `anger`, `excitement`, `joy`, `sadness`, `neutral` probabilities |
| `stance` | `label`, `confidence` |
| `sarcasm` | `prob` |
| `topic_id` | `value` |
| `narrative_id` | `value` |

NLP fields use `netra-nlp-2026-10-v1`. Models are lazy-loaded from the local
Hugging Face cache; setting `NETRA_NLP_ALLOW_DOWNLOAD=true` permits first-use
downloads. When a model is unavailable, `method` is `lexical-fallback` and the
fallback is retained in the record for audit. `threads` stores reply aggregates
and `sentiment_rollups` materialises hourly and daily platform/source/topic
mixes for timeline APIs.

For `emotions`, each named emotion is a score; for values without a supported
model the entire derived field is `null`, not a fabricated score.

## Indexes

The API startup and normalization script create: `(platform, created_at)`, a
partial unique `(platform, post_id)` index (only records with both string IDs),
`source_mode`, `author_id`, and `parent_id`. The partial unique index preserves
historical records with missing native IDs while preventing duplicate valid IDs.

## Writer audit (before this schema pass)

| Writer | Fields written | Missing/different fields before correction |
| --- | --- | --- |
| Telegram live ingestor | IDs, hashes, text, `created_at`, `collected_at`, tags, mentions, `source_mode` | No `ingested_at`, `event_type`, language, URLs, canonical metrics, dataset/source file. |
| YouTube live ingestor | IDs, hash IDs, hierarchy, `created_at`/`published_at`, text, partial metrics | No `ingested_at`, language/tags/URLs, canonical metric keys; raw channel display name was retained. |
| Reddit replay importer | `canonical_id`, `native_id`, `text_content`, `published_at`, `ingested_at`, noncanonical metrics | No `post_id`, hash author, hierarchy/event/text/created fields; `REPLAY` label rather than `IMPORT`. |
| Reddit PRAW collector | `canonical_id`, `native_id`, raw username, `published_at`, `ingested_at`, noncanonical metrics | No canonical identity/hierarchy/text/created fields; raw username and `REAL` source label. |
| Synthetic seeder | `canonical_id`, raw username, `text_content`, `published_at`, `ingested_at` | No native IDs, hash identity, hierarchy/event/text/metrics/lang/tags; source was `SYNTHETIC` rather than `SYNTH`. |
