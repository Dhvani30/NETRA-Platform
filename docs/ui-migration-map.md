# NETRA UI migration map

This map compares the exported design in `/design-source` with the existing app in `/frontend`. It is a planning artifact only. The design is a prototype with sample data; the existing app owns the operational state, API calls, and interaction behavior.

Status meanings:

- **Direct match** — design element and existing feature are aligned closely enough to carry forward without meaningful behavior or structure changes.
- **Needs adaptation** — a corresponding feature exists, but its data, interaction, structure, or layout must adapt to preserve existing behavior.
- **New, UI-only** — no corresponding existing feature logic was found. Implementation must remain presentational unless new logic is separately authorized.
- **Missing in new design (keep + restyle)** — an existing feature has no equivalent in the design and must remain available in the redesigned UI.

## Screen and layout mapping

| New design screen/component | Existing screen/component | Status | Mapping notes |
|---|---|---|---|
| Home landing page (`/`): hero, platform overview, feature cards, process steps, privacy section, CTA, footer | None. Existing app renders Analytics at `/`; there is no landing page. | **New, UI-only** | The exported page contains counters and preview fixtures. Do not treat these as live analytics or create new business behavior. Its route conflicts with the existing root screen; see conflicts below. |
| Dashboard shell (`/dashboard`): sidebar groups, screen title, top bar, content region | `App` header, active-tab controls, search and conditional screen content | **Needs adaptation** | Design has nine sidebar screens and a route-based outer shell. Existing screens are state-selected inside `App` and there is no router. Retain existing state selection and handlers while applying the new shell styling and mapping existing tabs. |
| Analytics: KPI cards, narrative volume timeseries, top narratives, live feed | `App` Analytics tab: sentiment pie chart, emerging-narratives bar chart, live intelligence message feed | **Needs adaptation** | Bind only to existing sentiment/narrative/message data. Design KPI figures, timeseries, top-narrative table, and feed entries are fixtures without matching API state; do not present them as live values. Keep existing charts/feed if the design has no corresponding data representation. |
| Deep Search: query bar, filter pills, provenance trail, evidence feed | `App.handleSearch` and `InvestigationView` | **Needs adaptation** | Preserve Enter-to-search, `/search?q=…`, investigation result data, back behavior, and graph props. Restyle the existing result view. Provenance/evidence structures and filter behavior shown by the design have no matching logic and must not be invented. |
| Narrative Tracker: selectable phases, entity cards, volume chart | `NarrativeTracker` (`activeTab === 'mutation'`) | **Needs adaptation** | Existing component fetches mutation data for a selected narrative and renders its response. Retain selection, endpoint, data shape, loading and error behavior; adapt the visual hierarchy. Design phase data and interactions are fixtures. |
| Cross-Platform Correlation: topic input, spread timeline, hourly platform volume | `CrossPlatformView` (`activeTab === 'correlation'`) | **Needs adaptation** | Existing query state calls `/analytics/correlation`. Preserve the request and response behavior. Map returned data into the new layout only where fields support it; design timeline and chart fixtures are not backend behavior. |
| Intelligence Alerts: severity summary and alert list | `AlertsView` (`activeTab === 'alerts'`) | **Needs adaptation** | Existing alert API, refresh control, loading/refresh states and response fields remain authoritative. Restyle the list and severity treatments; do not assume the design’s sample count or alert content is live. |
| Privacy-Safe Demographics: profession, region, age, language charts | `DemographicsView` (`activeTab === 'demographics'`) | **Needs adaptation** | Bind to the existing demographics response and preserve refresh, loading, empty-data and error handling. Chart types/fields should follow the actual response, not design fixtures. |
| Network Graph: platform filter, graph, hover detail | `NetworkGraph` in the Graph tab and inside `InvestigationView` | **Needs adaptation** | Reuse the existing graph component and its incoming `graphData`, `searchQuery`/`highlightQuery` behavior, selection, hover and zoom behavior. Adapt the design’s synthetic graph and filter presentation to real graph data; preserve both use cases. |
| Network Intelligence: influencers, bridge nodes, communities | `NetworkIntelligenceView` (`activeTab === 'network_intel'`) | **Needs adaptation** | Preserve `/graph/intelligence`, response fields and recalculate behavior. Restyle existing result fields; do not replace them with hard-coded design values. |
| Live YouTube Feed: video cards with duration, topic, channel, views and fetched time | No dedicated YouTube screen. Existing Analytics has a generic multi-platform `messages` feed. | **New, UI-only** | No matching dedicated video-card data source or screen logic was found. The general feed is not equivalent. Keep it in Analytics; make this screen a visual placeholder unless matching existing message fields support display without invented filtering or behavior. |

## Reusable design components

| New design component | Existing equivalent | Status | Mapping notes |
|---|---|---|---|
| `GlassCard`, `FloatCard` | No shared card component; current views use utility classes and inline styles | **New, UI-only** | Presentational surfaces only; no state or data behavior. |
| `TwoToneTitle` / Home `TwoTone`, `SectionLabel` / Home `LabelXs` | No shared title/label components | **New, UI-only** | Presentational typography. Home and Dashboard versions are separate local implementations in the export. |
| `Pill`, `PillTabs`, `PlatformChip` | Existing buttons, filters and controls inside `App` and screen components | **Needs adaptation** | Keep only interactions that map to existing state/handlers. Design filter pills without matching logic remain display-only. Pill supports active/inactive states; tabs and platform chips expose selection callbacks. |
| `SentimentPill`, `SeverityLine`, `ChangePill` | Sentiment and severity data shown in Analytics, Alerts and feature screens | **Needs adaptation** | Map colors/labels to existing response values. Design sentiment (`positive`/`neutral`/`negative`) and trend fixtures must not be assumed to match API enums or semantics. Severity variants are critical, warning and info; change pill is sign-based. |
| `MiniBarViz`, `MiniSparkline`, `MiniWaveform`, `MiniDotMatrix`, `KpiCard` | No equivalent KPI-card state or metric model in current Analytics | **Needs adaptation** | Visual patterns can be reused only after existing data supports a displayed metric. Do not use prototype fixed counts or fabricate calculations. |
| `PlatformAvatar` | `App.getPlatformIcon()` and platform icons in existing views | **Needs adaptation** | Use the compact avatar treatment while retaining existing platform detection and icon semantics. |
| Home `DashboardPreview` | No existing preview component | **New, UI-only** | Static marketing preview; do not connect fixture content to production claims without approved data. |
| Home `useCounter`, `useInView` | No corresponding existing app behavior | **New, UI-only** | Presentation hooks for landing-page count-up and reveal effects; no API or store dependency. |
| Dashboard sidebar group collapse and selected navigation states | Existing `activeTab` state and tab controls in `App` | **Needs adaptation** | Preserve existing state keys and navigation behavior. Group collapse and the design’s extra navigation entries are new UI state/features; do not imply unmatched entries have implemented logic. |

## Existing features missing from the new design (keep + restyle)

| Existing screen/component or behavior | Design coverage | Status | Proposed handling |
|---|---|---|---|
| App-wide **Refresh** action: `fetchData()` plus `refreshKey` remount behavior | No equivalent refresh control in the new shell | **Missing in new design (keep + restyle)** | Retain a visible refresh action and its current handler. |
| Dynamic **Last Updated** timestamp | Design shows a static “Live · 2m ago” pill | **Missing in new design (keep + restyle)** | Keep the actual `lastUpdated` value; do not replace it with static copy. |
| Existing loading, empty, error and manual-refresh states in feature views | Design is primarily static and does not model all current request states | **Missing in new design (keep + restyle)** | Keep each existing component’s state handling and controls; restyle these states in the new design language. |
| Full investigation result behavior and graph context | Deep Search presents fixture provenance/evidence content rather than `InvestigationView` behavior | **Missing in new design (keep + restyle)** | Preserve search API result content, back action and graph. Fit them into the Deep Search visual structure. |
| Generic, multi-platform message feed | Design includes a sample Analytics feed and a separate YouTube fixture feed | **Needs adaptation** | Keep the live `messages` feed and its current platform/time/content fields in Analytics. Do not silently narrow it to YouTube. |
| Network Graph investigation highlighting and shared use | Design graph page is a standalone synthetic graph | **Missing in new design (keep + restyle)** | Preserve `NetworkGraph` props and both parent use cases; the design screen is only one presentation context. |

## Layout and logic conflicts with proposed resolutions

| Conflict | Proposed resolution |
|---|---|
| **Root route conflict:** Existing `/` is the operational app; design assigns `/` to Home and `/dashboard` to the dashboard. Existing code has no router. | Do not change routing as part of a visual migration. First adapt the design shell to the existing state-driven app at `/`. Treat the landing page as UI-only until a route change is explicitly approved. |
| **Navigation model conflict:** Existing seven tab keys plus conditional investigation differ from the design’s nine sidebar screens and grouped/collapsible navigation. | Keep existing `activeTab` values, search state, and event handlers. Map matching entries to the new shell; leave unmatched navigation entries as placeholders or omit them pending approval. |
| **Header search conflict:** Existing header input submits to `/search` and opens `InvestigationView`; design header search only changes local text and switches to a mock Deep Search screen. | Wire the redesigned input to existing `handleSearch` and preserve Enter behavior and result view. Do not substitute the mock search state. |
| **Design fixture conflict:** Dashboard charts, KPI values, alerts, demographic distributions, network metrics and video cards are hard-coded design data, while the existing app reads API responses. | Existing API results and models remain authoritative. Use a design widget only when current state can populate it without changing API contracts or inventing calculations; otherwise retain/restyle the existing feature presentation. |
| **New UI controls with no matching logic:** Filters, Track/search affordances, Support/How it works controls, and a dedicated YouTube screen include controls/content not backed by equivalent existing logic. | Keep them presentational or omit them from the first migration slice. Do not attach new behavior or imply backend capability. The YouTube Feed remains explicitly UI-only unless existing data supports it. |
| **Layout sizing conflict:** Design dashboard is a fixed full-viewport sidebar/main shell; existing app screens use their own responsive grids and scroll behavior. | Adapt shell dimensions to existing screen content and preserve responsive behavior, loading views, and scrollable graph/chart areas. |

No existing prop names, function signatures, endpoints, store actions, or route definitions should change under this mapping. This document records proposed UI adaptation only; it does not authorize implementation of new logic or routing.
