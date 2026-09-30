# Chapter 00 composition brief

Create a 30-second narrated NETRA series intro, 1920x1080 (1080p), 16:9, using Kokoro `af_heart`. Follow the approved Chapter 00 storyboard and `brag-output/scripts/chapter-00.md`; the short narration has been tightened to fit 30 seconds and split into four scene clips for timing alignment.

Source: active app at `frontend/src/App.jsx`, `frontend/src/components/`, `frontend/src/components/AnalyticsView.css`, and `frontend/src/index.css`. Recreate the active Analytics UI faithfully, using sanitized sample text and no numerical data claims. Exact named elements: NETRA Intelligence, Analytics, Sentiment Distribution, Emerging Narratives, Live Intelligence Feed, Search, Mutation Tracker, Cross-Platform, Alerts, Demographics, Network Intel, Network Graph, Refresh, Last Updated.

Style: see `DESIGN.md`. Use Space Grotesk and JetBrains Mono; indigo-black surfaces and muted lavender accent. Smooth crossfade between the four scene frames. Push in on the real component recreations; outline the current component with a soft lavender rule. Sequential callouts enter at the matching scene voiceover start: dashboard/NETRA at 0s; the two named charts at 6s; search and workflow tabs at 13s; final feature chapter cards at 21s. Keep each callout visible for the remainder of its scene. No beat snap if it moves a callout away from narration.

Audio: copied bundled `happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`; bundled cue preset is `C:\Users\dkm12\.agents\skills\brag\assets\music\cues\happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json` (109.96 BPM; use 8.74s or 13.11s only if compatible with narration timing). Low music under voice at 0.13; fade gently at start/end. One quiet `interface/click_003.ogg` on a navigation/search action at low volume. SFX library guidance: `C:\Users\dkm12\.agents\skills\brag\assets\sfx\sfx-analysis.md`. Voice assets are separate Kokoro-generated scene clips in `assets/voiceover/`.

No narration text, sample post content, or visual is allowed to assert a feature or metric not confirmed by the active code.
