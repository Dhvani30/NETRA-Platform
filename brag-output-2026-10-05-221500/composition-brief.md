# Hyperframes Composition Brief: NETRA

## Objective

Create a 60-second premium launch film for NETRA — Network Engine for Threat Recognition & Analytics. It must feel like a flagship technology product reveal, never a conventional dashboard tour or an advertisement.

## Output

- Composition directory: `brag-output-2026-10-05-221500/composition/`
- Rendered video: `brag-output-2026-10-05-221500/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 60 seconds (explicitly overrides the normal short-form Brag duration)

## Source Material

- Project root: `NETRA-Platform`
- Primary files read: `README.md`, `frontend/src/components/LandingPage.jsx`, `frontend/src/components/NetworkIntelligenceView.jsx`, `frontend/src/components/InvestigationView.jsx`, `frontend/src/App.jsx`, `design-source/src/pages/Dashboard.tsx`
- Product: NETRA Intelligence Platform
- Grounded capability: NETRA ingests and correlates public cross-platform signals into narrative, graph, geographic, and threat intelligence; it includes network graph, deep investigation, timeline, provenance/evidence, alerts, cross-platform correlation, and privacy-safe demographics.
- Exact copy required: `NETRA`, `Network Engine for Threat Recognition & Analytics`, `FROM NOISE TO INTELLIGENCE.`

## Creative Direction

- Tone: cinematic
- Visual thesis: **Signals → Patterns → Connections → Context → Threats → Intelligence**
- The signature visual is an **Intelligence Field**: exquisite small points and hairline relationships suspended in depth. It begins chaotic, organizes magnetically, becomes a graph, becomes geography, becomes a threat, and finally becomes the NETRA mark.
- Only show the product UI from 40s onward. Make it an original command environment, not a reuse of the current UI or a grid of cards.
- Avoid: hacker tropes, matrix rain, neon grids, stock social screenshots, generic AI imagery, template dashboard cards, giant warning banners, generic feature-list copy, excessive red, excessive glow.

## Visual system

- Obsidian `#06080D`, graphite `#121923`, midnight `#0C1422`
- Soft silver `#EDF3FA`, secondary `#AAB8C8`, electric blue `#66B8FF`, crimson `#E24755` only for threat state
- Editorial serif display typography with clean technical sans metadata
- Three visual planes in every scene: atmospheric background, information field / interface midground, fine particulate foreground
- Convey depth with parallax, perspective, varying blur/opacity, and camera-like transform choreography

## Storyboard

Follow `brag-plan.md` as the creative contract:

1. Signal Field — 0–7s
2. Pattern Extraction — 7–15s
3. Living Network — 15–25s
4. Context / India Map — 25–32s
5. Detection — 32–40s
6. NETRA Command Environment — 40–48s
7. Fluid Investigation — 48–53s
8. Hero Mark — 53–57s
9. Final Reveal — 57–60s

## Audio

- No narration.
- The external media resolver found no reusable score and could not produce a catalog asset; create a local, original procedural score using FFmpeg synthesis if necessary. It must be a subtle, non-lyrical bed, not an upbeat stock track.
- Timeline: sparse high tones (0–7), low pulse and harmonic system (7–32), narrow tension / one impact at 40, resolved harmonic tail (40–60).
- Use no more than a few material SFX-like accents. It is better to be quiet than busy.
- Let low-frequency energy lightly drive the perceived brightness of field halos where feasible; do not add visible equalizer graphics.

## Hyperframes instructions

- Use one standalone deterministic composition with `data-duration="60"`, a single paused GSAP timeline registered as `netra-launch`.
- Use seeded math for any procedural spatial distribution; never use unseeded `Math.random`, clocks, or network dependencies.
- Use actual HTML/SVG/CSS visualizations, not screen recordings. A canvas is permitted for the Intelligence Field only if its deterministic seek behavior is robust; otherwise generate static DOM/SVG nodes and animate them through GSAP.
- Include a `.motion.json` sidecar describing the key visual states.
- Keep text sparse, large, high contrast, and held long enough to read.
- Before delivery: lint, `check --snapshots`, inspect snapshots, `keyframes`, focused motion proof, preview, then await final approval before render.
