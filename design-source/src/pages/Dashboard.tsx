import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import ForceGraph2D from 'react-force-graph-2d'

/* ─── Design tokens (mirror CSS) ────────────────────────────────────────────*/
const C = {
  accent:       '#9A9EE8',
  accentDim:    '#7B7FC4',
  accentBright: '#B8BBEE',
  accentFaint:  'rgba(154,158,232,0.12)',
  text1:        '#F2F3FA',
  text2:        '#8E92B0',
  text3:        '#5B5F7A',
  border:       'rgba(255,255,255,0.09)',
  glass:        'rgba(255,255,255,0.04)',
  redM:         '#C07070',
  amberM:       '#C09060',
  greenM:       '#70A888',
  blueM:        '#7090CC',
}

type Platform  = 'X' | 'Reddit' | 'YouTube'
type Sentiment = 'positive' | 'neutral' | 'negative'
type AlertSeverity = 'critical' | 'warning' | 'info'
type Screen =
  | 'analytics' | 'search' | 'narrative' | 'correlation'
  | 'alerts' | 'demographics' | 'network-graph' | 'network-intel' | 'youtube-feed'

/* ─── Shared micro-components ────────────────────────────────────────────────*/

function GlassCard({ children, className = '', style = {}, large, onClick }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; large?: boolean; onClick?: () => void
}) {
  return (
    <div className={`glass ${large ? 'glass-lg' : ''} ${className}`} style={style} onClick={onClick}>{children}</div>
  )
}

function FloatCard({ children, className = '', style = {} }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div className={`glass-float ${className}`} style={style}>{children}</div>
  )
}

function TwoToneTitle({ a, b, size = 36 }: { a: string; b: string; size?: number }) {
  return (
    <span className="two-tone-title" style={{ fontSize: size }}>
      <span className="t1">{a} </span><span className="t2">{b}</span>
    </span>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="label-xs mb-3" style={{ color: C.text3 }}>{children}</p>
}

function Pill({ children, active, onClick, className = '', style }: {
  children: React.ReactNode; active?: boolean; onClick?: () => void; className?: string; style?: React.CSSProperties
}) {
  return (
    <button onClick={onClick} className={`pill ${active ? 'pill-active' : ''} ${className}`} style={style}>
      {children}
    </button>
  )
}

function PillTabs({ tabs, active, onChange }: {
  tabs: string[]; active: string; onChange: (t: string) => void
}) {
  return (
    <div className="flex p-1 rounded-full" style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.09)',
      gap: 2,
    }}>
      {tabs.map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className="pill"
          style={{
            background: active === t ? 'linear-gradient(135deg, rgba(230,232,242,0.18) 0%, rgba(155,160,184,0.22) 100%)' : 'transparent',
            border: active === t ? '1px solid rgba(154,158,232,0.3)' : '1px solid transparent',
            color: active === t ? '#E6E8F2' : C.text3,
            fontWeight: active === t ? 600 : 400,
            transition: 'all 0.15s',
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function PlatformChip({ platform, active, onClick }: {
  platform: Platform; active?: boolean; onClick?: () => void
}) {
  const labels: Record<Platform, string> = { X: '𝕏', Reddit: 'R', YouTube: '▶' }
  return (
    <button onClick={onClick} className={`pill-icon ${active ? 'active' : ''}`} title={platform}>
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? C.accent : C.text3 }}>
        {labels[platform]}
      </span>
    </button>
  )
}

function SentimentPill({ sentiment }: { sentiment: Sentiment }) {
  const map: Record<Sentiment, { label: string; color: string }> = {
    positive: { label: '↑ Positive', color: C.greenM },
    neutral:  { label: '→ Neutral',  color: C.text3 },
    negative: { label: '↓ Negative', color: C.redM },
  }
  const { label, color } = map[sentiment]
  return (
    <span className="pill" style={{ color, borderColor: `${color}40`, background: `${color}10`, fontSize: 10 }}>
      {label}
    </span>
  )
}

function SeverityLine({ severity }: { severity: AlertSeverity }) {
  const color = severity === 'critical' ? C.redM : severity === 'warning' ? C.amberM : C.blueM
  return (
    <div style={{
      position: 'absolute', left: 0, top: '20%', bottom: '20%',
      width: 2, borderRadius: 2, background: color,
    }} />
  )
}

function ChangePill({ val }: { val: string }) {
  const pos = val.startsWith('+')
  return (
    <span className="pill" style={{
      fontSize: 10, padding: '2px 8px',
      color: pos ? C.greenM : C.redM,
      borderColor: pos ? `${C.greenM}40` : `${C.redM}40`,
      background: pos ? `${C.greenM}10` : `${C.redM}10`,
    }}>
      {val}
    </span>
  )
}

// Mini-visualizations for KPI cards
function MiniBarViz() {
  const bars = [3, 5, 4, 7, 6, 8, 7, 9, 8, 10]
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 4, height: `${h * 10}%`, borderRadius: 2,
          background: i >= bars.length - 3 ? C.accent : `rgba(154,158,232,0.3)`,
          transition: 'height 0.5s',
        }} />
      ))}
    </div>
  )
}

function MiniSparkline() {
  const pts = [8, 12, 7, 15, 11, 18, 14, 20, 16, 22]
  const max = Math.max(...pts)
  const w = 64, h = 32
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (pts.length - 1)) * w},${h - (p / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity={0.3} />
          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={path + ` L${w},${h} L0,${h} Z`} fill="url(#sg)" />
      <path d={path} fill="none" stroke={C.accent} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

function MiniWaveform() {
  const bars = [4, 9, 6, 12, 8, 14, 10, 14, 8, 12, 6, 9, 4]
  const max = 16
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, height: `${(h / max) * 100}%`, borderRadius: 2,
          background: `rgba(154,158,232,${0.2 + (h / max) * 0.6})`,
        }} />
      ))}
    </div>
  )
}

function MiniDotMatrix() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 3, width: 44 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i < 12 ? `rgba(154,158,232,${0.3 + (i / 12) * 0.5})` : 'rgba(255,255,255,0.07)',
        }} />
      ))}
    </div>
  )
}

function KpiCard({ label, badge, value, mini, accentVal }: {
  label: string; badge: string; value: string
  mini: React.ReactNode; accentVal?: boolean
}) {
  return (
    <GlassCard className="p-4" style={{ overflow: 'hidden' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="label-xs">{label}</span>
          </div>
          <p className="font-mono kpi-value" style={{ fontSize: 28, fontWeight: 300, lineHeight: 1.1 }}>
            {value}
          </p>
        </div>
        <div style={{ flexShrink: 0, marginTop: 4, opacity: 0.35 }}>{mini}</div>
      </div>
    </GlassCard>
  )
}

const CT = {
  contentStyle: {
    background: 'rgba(16,17,30,0.92)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12, fontSize: 11, color: C.text1, backdropFilter: 'blur(20px)',
  },
  labelStyle:   { color: C.text3, marginBottom: 4, fontSize: 10 },
  itemStyle:    { color: C.text1 },
}

/* ─── Mock data ──────────────────────────────────────────────────────────────*/

const sentimentData = [
  { t: 'AUG 13', pos: 22, neu: 28, neg: 18, forecast: null },
  { t: 'SEP 11', pos: 28, neu: 32, neg: 24, forecast: null },
  { t: 'NOV 13', pos: 35, neu: 30, neg: 28, forecast: null },
  { t: 'JAN 9',  pos: 42, neu: 38, neg: 34, forecast: 38 },
  { t: 'MAR 10', pos: 38, neu: 35, neg: 32, forecast: 40 },
  { t: 'MAY 11', pos: 48, neu: 40, neg: 28, forecast: 44 },
]

const topNarratives = [
  { id: 'N-41', label: 'AI Regulation Debate', platform: 'X' as Platform, posts: 14230, share: 0.71, trend: '+18%', sentiment: 'neutral' as Sentiment },
  { id: 'N-89', label: 'Cybersecurity Breach Rumor', platform: 'Reddit' as Platform, posts: 9870, share: 0.49, trend: '+34%', sentiment: 'negative' as Sentiment },
  { id: 'N-12', label: 'Election Misinformation', platform: 'YouTube' as Platform, posts: 7640, share: 0.38, trend: '+11%', sentiment: 'negative' as Sentiment },
  { id: 'N-57', label: 'Open-Source AI Release', platform: 'X' as Platform, posts: 6120, share: 0.31, trend: '+6%', sentiment: 'positive' as Sentiment },
  { id: 'N-73', label: 'Economic Policy Critique', platform: 'Reddit' as Platform, posts: 4980, share: 0.25, trend: '-3%', sentiment: 'negative' as Sentiment },
]

const liveFeed = [
  { id: 'F-8821', platform: 'X' as Platform, handle: '@analyst_7x', text: 'The proposed AI bill could reshape data sovereignty rules globally.', sentiment: 'neutral' as Sentiment, ts: '2m ago' },
  { id: 'F-8820', platform: 'Reddit' as Platform, handle: 'u/techwatch99', text: 'Major breach: 40k hashed credentials in forum dump. Verify before sharing.', sentiment: 'negative' as Sentiment, ts: '5m ago' },
  { id: 'F-8819', platform: 'YouTube' as Platform, handle: 'CyberPulse', text: 'BREAKING: New exploit on live stream — patch not yet available.', sentiment: 'negative' as Sentiment, ts: '8m ago' },
  { id: 'F-8818', platform: 'X' as Platform, handle: '@infosec_arc', text: 'Llama-4 weights dropped. Open-source community moving fast on benchmarks.', sentiment: 'positive' as Sentiment, ts: '11m ago' },
  { id: 'F-8817', platform: 'Reddit' as Platform, handle: 'u/policy_desk', text: 'EU AI Act enforcement timeline slipped again. Industry expects Q4 delay.', sentiment: 'neutral' as Sentiment, ts: '14m ago' },
  { id: 'F-8816', platform: 'YouTube' as Platform, handle: 'DataFront', text: 'Biometric data harvesting in consumer app — 10M+ users affected.', sentiment: 'negative' as Sentiment, ts: '18m ago' },
]

const provenanceSteps = [
  { platform: 'X' as Platform, handle: '@sec_thread', ts: '1h ago', label: 'Origin post', desc: 'First public mention of the vulnerability' },
  { platform: 'Reddit' as Platform, handle: 'u/threat_intel', ts: '2h ago', label: 'Cross-platform amplification', desc: 'Reddit r/cybersecurity picks up and annotates' },
  { platform: 'YouTube' as Platform, handle: 'CyberPulse', ts: '3h ago', label: 'Video content generation', desc: 'Explainer video; 14k views in 1h' },
]

const searchResults = [
  { id: 'F-7701', platform: 'X' as Platform, handle: '@sec_thread', text: 'Cybersecurity posture across critical infra is weaker than official assessments suggest.', sentiment: 'negative' as Sentiment, ts: '1h ago', firstPost: true },
  { id: 'F-7702', platform: 'Reddit' as Platform, handle: 'u/threat_intel', text: 'Cross-referencing with the CISA advisory — TTPs match a known APT cluster.', sentiment: 'negative' as Sentiment, ts: '2h ago' },
  { id: 'F-7703', platform: 'YouTube' as Platform, handle: 'CyberPulse', text: 'Full walkthrough of the attack surface — watch before it gets taken down.', sentiment: 'negative' as Sentiment, ts: '3h ago' },
  { id: 'F-7704', platform: 'X' as Platform, handle: '@netwatch_ai', text: 'Attribution cluster tightening. 3 orgs independently confirmed the IOCs.', sentiment: 'negative' as Sentiment, ts: '4h ago' },
]

const narrativePhases = [
  { phase: 1, label: 'Seeding', timeRange: '00:00–04:00', entities: ['AI regulation', 'data sovereignty'], sentiment: 'neutral' as Sentiment, desc: 'Initial narrative seeded by 3 accounts on X. Low volume, technical framing.', posts: 420 },
  { phase: 2, label: 'Amplification', timeRange: '04:00–10:00', entities: ['AI regulation', 'surveillance', 'privacy'], sentiment: 'negative' as Sentiment, desc: 'Reddit picks up thread; sentiment shifts negative. Privacy angle introduced.', posts: 2140 },
  { phase: 3, label: 'Mutation', timeRange: '10:00–18:00', entities: ['mass surveillance', 'government overreach', 'censorship'], sentiment: 'negative' as Sentiment, desc: 'Core narrative mutated. Original AI framing replaced by surveillance panic.', posts: 7890 },
  { phase: 4, label: 'Saturation', timeRange: '18:00–24:00', entities: ['censorship', 'civil liberties', 'protest'], sentiment: 'negative' as Sentiment, desc: 'YouTube explainer videos dominate. Mainstream media picks up the mutated frame.', posts: 14230 },
]

const correlationStory = [
  { platform: 'X' as Platform, event: 'Origin post: "AI model risks"', time: '09:14', relativeHours: 0, posts: 12 },
  { platform: 'Reddit' as Platform, event: 'r/artificial amplification', time: '11:40', relativeHours: 2.4, posts: 380 },
  { platform: 'YouTube' as Platform, event: 'Explainer video published', time: '14:22', relativeHours: 5.1, posts: 1200 },
]

const correlationVol = [
  { hour: '09:00', X: 12, Reddit: 0, YouTube: 0 },
  { hour: '11:00', X: 134, Reddit: 89, YouTube: 0 },
  { hour: '12:00', X: 280, Reddit: 340, YouTube: 0 },
  { hour: '14:00', X: 670, Reddit: 890, YouTube: 340 },
  { hour: '15:00', X: 820, Reddit: 1100, YouTube: 1200 },
]

const alerts = [
  { id: 'ALT-0091', severity: 'critical' as AlertSeverity, type: 'Volume Spike', narrative: 'Cybersecurity breach rumor', detail: 'Post volume increased 340% in 30 min — threshold: 200%', platform: 'Reddit' as Platform, ts: '04:12 · 4 min ago', triggered: 'Auto · Volume Model v2.1' },
  { id: 'ALT-0090', severity: 'warning' as AlertSeverity, type: 'Sentiment Shift', narrative: 'AI regulation debate', detail: 'Avg sentiment dropped from +0.42 to −0.18 in 2h window', platform: 'X' as Platform, ts: '03:54 · 22 min ago', triggered: 'Auto · Sentiment Classifier' },
  { id: 'ALT-0089', severity: 'critical' as AlertSeverity, type: 'Keyword Match', narrative: 'Election misinformation cluster', detail: 'High-risk keyword matched 1,840 posts across 3 platforms', platform: 'YouTube' as Platform, ts: '03:38 · 38 min ago', triggered: 'Auto · Keyword Engine' },
  { id: 'ALT-0088', severity: 'info' as AlertSeverity, type: 'New Narrative', narrative: 'Open-source AI model release', detail: 'Emerging cluster detected; 6 seed accounts, 3 communities', platform: 'X' as Platform, ts: '03:04 · 1h 12m ago', triggered: 'Auto · Cluster Detector' },
  { id: 'ALT-0087', severity: 'warning' as AlertSeverity, type: 'Cross-Platform Spread', narrative: 'Economic policy critique', detail: 'Narrative jumped from Reddit → X in under 90 min', platform: 'X' as Platform, ts: '02:12 · 2h 04m ago', triggered: 'Auto · Diffusion Monitor' },
]

const professionData = [
  { name: 'Tech Professional', value: 31 }, { name: 'Student', value: 22 },
  { name: 'Researcher', value: 18 }, { name: 'Journalist', value: 14 },
  { name: 'Policy/Govt', value: 9 }, { name: 'Other', value: 6 },
]
const regionData = [
  { name: 'South Asia', value: 38 }, { name: 'North America', value: 27 },
  { name: 'Europe', value: 19 }, { name: 'Southeast Asia', value: 11 }, { name: 'Other', value: 5 },
]
const ageBandData = [
  { band: '18–24', pct: 24 }, { band: '25–34', pct: 38 },
  { band: '35–44', pct: 21 }, { band: '45–54', pct: 11 }, { band: '55+', pct: 6 },
]
const languageData = [
  { name: 'English', pct: 54 }, { name: 'Hindi', pct: 18 },
  { name: 'Spanish', pct: 10 }, { name: 'Arabic', pct: 8 }, { name: 'Other', pct: 10 },
]

const DEMO_PALETTE = [C.accent, C.accentDim, '#6B6FAA', '#B0B4E8', '#8090CC', '#C0C4F0']

const influencers = [
  { rank: 1, handle: '@netwatch_ai',  platform: 'X' as Platform, followers: '142K', community: 'InfoSec',  score: 98 },
  { rank: 2, handle: 'u/threat_intel', platform: 'Reddit' as Platform, followers: '89K',  community: 'CyberSec', score: 91 },
  { rank: 3, handle: 'CyberPulse',    platform: 'YouTube' as Platform, followers: '76K',  community: 'InfoSec',  score: 87 },
  { rank: 4, handle: '@analyst_7x',   platform: 'X' as Platform, followers: '54K',  community: 'Policy',   score: 79 },
  { rank: 5, handle: 'u/policy_desk', platform: 'Reddit' as Platform, followers: '41K',  community: 'Policy',   score: 72 },
]
const bridgeNodes = [
  { id: 'B-001', handle: '@cross_link1',  communities: ['InfoSec', 'Policy'], platforms: ['X', 'Reddit'] as Platform[], betweenness: 0.84, desc: 'Connects InfoSec researchers to policy discussion forums' },
  { id: 'B-002', handle: 'CyberPulse',   communities: ['InfoSec', 'Mainstream'], platforms: ['YouTube', 'X'] as Platform[], betweenness: 0.71, desc: 'YouTube content drives X amplification across communities' },
  { id: 'B-003', handle: 'u/bridge_actor', communities: ['CyberSec', 'General'], platforms: ['Reddit'] as Platform[], betweenness: 0.63, desc: 'High-karma account spanning technical and general subreddits' },
]
const communities = [
  { id: 'C-01', name: 'InfoSec Core',    size: 1840, platforms: ['X', 'Reddit'] as Platform[], cohesion: 0.91, sentiment: 'negative' as Sentiment, desc: 'Tightly-knit security researchers sharing threat intel' },
  { id: 'C-02', name: 'Policy Watchers', size: 1230, platforms: ['X', 'Reddit'] as Platform[], cohesion: 0.74, sentiment: 'neutral' as Sentiment,  desc: 'Government and academic users tracking regulation narrative' },
  { id: 'C-03', name: 'Tech Amplifiers', size: 2340, platforms: ['YouTube', 'X'] as Platform[], cohesion: 0.62, sentiment: 'neutral' as Sentiment,  desc: 'Broad tech audience; high reach, lower cohesion' },
  { id: 'C-04', name: 'Fringe Cluster',  size: 640,  platforms: ['Reddit'] as Platform[], cohesion: 0.88, sentiment: 'negative' as Sentiment, desc: 'High internal engagement; extreme framing detected' },
]
const youtubeVideos = [
  { id: 'YT-001', title: 'AI Regulation: What the New Bill Really Means', channel: 'PolicyBytes', topic: 'AI Policy',     views: '48K',  duration: '18:32', fetchedAgo: '2h 14m', sentiment: 'neutral' as Sentiment },
  { id: 'YT-002', title: 'BREAKING: Major Cybersecurity Breach Exposed',  channel: 'CyberPulse',  topic: 'Cybersecurity', views: '112K', duration: '9:44',  fetchedAgo: '3h 01m', sentiment: 'negative' as Sentiment },
  { id: 'YT-003', title: "Open Source LLMs Are Winning — Here's Why",     channel: 'DataFront',   topic: 'AI/ML',         views: '67K',  duration: '22:10', fetchedAgo: '3h 00m', sentiment: 'positive' as Sentiment },
  { id: 'YT-004', title: 'Election Integrity Under Threat? A Deep Dive',  channel: 'GovWatch',    topic: 'Elections',     views: '84K',  duration: '31:07', fetchedAgo: '2h 58m', sentiment: 'negative' as Sentiment },
  { id: 'YT-005', title: 'How Misinformation Spreads: Live Case Study',   channel: 'InfoLab',     topic: 'Disinfo',       views: '29K',  duration: '14:55', fetchedAgo: '2h 51m', sentiment: 'neutral' as Sentiment },
  { id: 'YT-006', title: 'Privacy-Preserving AI — Research Roundup',      channel: 'TechReview',  topic: 'AI Policy',     views: '21K',  duration: '26:40', fetchedAgo: '2h 44m', sentiment: 'positive' as Sentiment },
]

function buildGraphData() {
  return {
    nodes: [
      { id: 'n1', label: '@netwatch_ai',  platform: 'X',       group: 'InfoSec',  influence: 98, val: 8 },
      { id: 'n2', label: 'u/threat_intel', platform: 'Reddit',  group: 'CyberSec', influence: 91, val: 7 },
      { id: 'n3', label: 'CyberPulse',    platform: 'YouTube',  group: 'InfoSec',  influence: 87, val: 7 },
      { id: 'n4', label: '@analyst_7x',   platform: 'X',       group: 'Policy',   influence: 79, val: 6 },
      { id: 'n5', label: 'u/policy_desk', platform: 'Reddit',  group: 'Policy',   influence: 72, val: 5 },
      { id: 'n6', label: '@cross_link1',  platform: 'X',       group: 'Bridge',   influence: 84, val: 6 },
      { id: 'n7', label: '@infosec_arc',  platform: 'X',       group: 'InfoSec',  influence: 65, val: 5 },
      { id: 'n8', label: 'u/sec_thread',  platform: 'Reddit',  group: 'CyberSec', influence: 58, val: 4 },
      { id: 'n9', label: 'DataFront',     platform: 'YouTube',  group: 'InfoSec',  influence: 61, val: 5 },
      { id: 'n10',label: '@netpol_watch', platform: 'X',       group: 'Policy',   influence: 55, val: 4 },
      { id: 'n11',label: 'u/bridge_actor',platform: 'Reddit',  group: 'Bridge',   influence: 63, val: 5 },
      { id: 'n12',label: 'GovWatch',      platform: 'YouTube',  group: 'Policy',   influence: 48, val: 4 },
      { id: 'n13',label: '@techwatch_x',  platform: 'X',       group: 'InfoSec',  influence: 42, val: 3 },
      { id: 'n14',label: 'u/data_watch',  platform: 'Reddit',  group: 'CyberSec', influence: 38, val: 3 },
      { id: 'n15',label: 'PolicyBytes',   platform: 'YouTube',  group: 'Policy',   influence: 44, val: 3 },
    ],
    links: [
      { source:'n1',target:'n2',value:3 },{ source:'n1',target:'n6',value:4 },
      { source:'n1',target:'n7',value:2 },{ source:'n2',target:'n8',value:3 },
      { source:'n2',target:'n11',value:3},{ source:'n3',target:'n9',value:2 },
      { source:'n3',target:'n6',value:3 },{ source:'n4',target:'n5',value:2 },
      { source:'n4',target:'n10',value:3},{ source:'n5',target:'n11',value:3},
      { source:'n6',target:'n2',value:4 },{ source:'n6',target:'n4',value:3 },
      { source:'n7',target:'n13',value:2},{ source:'n8',target:'n14',value:2},
      { source:'n9',target:'n12',value:2},{ source:'n10',target:'n15',value:2},
      { source:'n11',target:'n14',value:2},{ source:'n12',target:'n15',value:2},
      { source:'n13',target:'n14',value:1},
    ],
  }
}

/* ─── Platform helpers ───────────────────────────────────────────────────────*/
function PlatformAvatar({ platform }: { platform: Platform }) {
  const label: Record<Platform, string> = { X: '𝕏', Reddit: 'R', YouTube: '▶' }
  return <div className="circle-avatar">{label[platform]}</div>
}

/* ─── Screen: Analytics ──────────────────────────────────────────────────────*/
function ScreenAnalytics() {
  const [activePlatforms, setActivePlatforms] = useState<Set<Platform>>(
    new Set(['X', 'Reddit', 'YouTube'])
  )
  const toggleP = (p: Platform) =>
    setActivePlatforms(prev => { const s = new Set(prev); s.has(p) ? s.delete(p) : s.add(p); return s })

  return (
    <div className="animate-fade-up space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Posts" badge="24h" value="52,841" mini={<MiniBarViz />} accentVal />
        <KpiCard label="Avg Sentiment" badge="24h" value="−0.14" mini={<MiniSparkline />} />
        <KpiCard label="Active Narratives" badge="7d" value="23" mini={<MiniWaveform />} />
        <KpiCard label="Active Alerts" badge="Now" value="5" mini={<MiniDotMatrix />} />
      </div>

      {/* Chart card with floating overlays */}
      <GlassCard large className="p-5" style={{ position: 'relative' }}>
        {/* Chart header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
            <TwoToneTitle a="Narrative Volume" b="Timeseries" size={18} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {(['X', 'Reddit', 'YouTube'] as Platform[]).map(p => (
              <PlatformChip key={p} platform={p} active={activePlatforms.has(p)} onClick={() => toggleP(p)} />
            ))}
            <Pill>Filters <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></Pill>
          </div>
        </div>

        <div style={{ position: 'relative' }}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={sentimentData} margin={{ top: 8, right: 16, left: -20, bottom: 0 }}>
              <defs>
                {[['gP', C.accent], ['gN', C.redM], ['gNe', C.text3]].map(([id, color]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="85%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: C.text3, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.text3, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
              <Tooltip {...CT} />
              {activePlatforms.has('X') && (
                <Area type="monotone" dataKey="pos" name="Positive" stroke={C.accent} strokeWidth={2} fill="url(#gP)" dot={false} />
              )}
              {activePlatforms.has('Reddit') && (
                <Area type="monotone" dataKey="neg" name="Negative" stroke={C.redM} strokeWidth={2} fill="url(#gN)" dot={false} />
              )}
              {activePlatforms.has('YouTube') && (
                <Area type="monotone" dataKey="neu" name="Neutral" stroke={C.text3} strokeWidth={1.5} fill="url(#gNe)" dot={false} strokeDasharray="5 3" />
              )}
              <Area type="monotone" dataKey="forecast" name="Forecast" stroke={C.accentBright} strokeWidth={1.5} fill="none" dot={false} strokeDasharray="3 3" connectNulls />
            </AreaChart>
          </ResponsiveContainer>

          {/* Floating overlay cards */}
          <FloatCard style={{
            position: 'absolute', bottom: 8, left: 8, width: 140, padding: '12px 14px',
            zIndex: 10,
          }}>
            <p className="label-xs mb-1">Median Time between platforms</p>
            <p className="font-mono" style={{ fontSize: 28, fontWeight: 300, color: C.text1, lineHeight: 1 }}>2.4D</p>
            <p className="label-xs mt-1" style={{ color: C.greenM }}>↓ 0.3 Days ↓</p>
            <MiniSparkline />
          </FloatCard>

          <FloatCard style={{
            position: 'absolute', top: 8, right: 8, width: 140, padding: '12px 14px',
            zIndex: 10,
          }}>
            <p className="label-xs mb-1">Negative Sentiment</p>
            <div className="flex items-end gap-2">
              <p className="font-mono" style={{ fontSize: 26, fontWeight: 300, color: C.text1, lineHeight: 1 }}>61.2%</p>
              <span className="pill" style={{ fontSize: 9, color: C.redM, borderColor: `${C.redM}30`, background: `${C.redM}10`, marginBottom: 2 }}>↑ 2.1%</span>
            </div>
            <div style={{ marginTop: 10, position: 'relative' }}>
              <svg width={80} height={80} viewBox="0 0 80 80" style={{ display: 'block', margin: '0 auto' }}>
                <circle cx="40" cy="40" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                <circle cx="40" cy="40" r="28" fill="none" stroke={C.redM} strokeWidth="8"
                  strokeDasharray={`${0.612 * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                  strokeDashoffset={2 * Math.PI * 28 * 0.25}
                  strokeLinecap="round" transform="rotate(-90 40 40)" />
              </svg>
            </div>
          </FloatCard>
        </div>
      </GlassCard>

      {/* Narratives table */}
      <GlassCard>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <TwoToneTitle a="Top" b="Narratives" size={15} />
          <Pill>Last 24h <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></Pill>
        </div>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Narrative</th>
              <th>Platform</th>
              <th>Posts</th>
              <th>Share</th>
              <th>Sentiment</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {topNarratives.map(n => (
              <tr key={n.id} style={{ cursor: 'default' }}>
                <td>
                  <div className="flex items-center gap-3">
                    <PlatformAvatar platform={n.platform} />
                    <div>
                      <p style={{ color: C.text1, fontSize: 12, fontWeight: 500 }}>{n.label}</p>
                      <p className="font-mono" style={{ fontSize: 10, color: C.text3 }}>{n.id}</p>
                    </div>
                  </div>
                </td>
                <td><span className="pill" style={{ fontSize: 10 }}>{n.platform}</span></td>
                <td><span className="font-mono" style={{ color: C.text1 }}>{n.posts.toLocaleString()}</span></td>
                <td style={{ width: 120 }}>
                  <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${n.share * 100}%` }} /></div>
                  <p className="font-mono" style={{ fontSize: 9, color: C.text3, marginTop: 2 }}>{(n.share * 100).toFixed(0)}%</p>
                </td>
                <td><SentimentPill sentiment={n.sentiment} /></td>
                <td><ChangePill val={n.trend} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontSize: 11, color: C.text3, cursor: 'pointer' }}>View all narratives →</span>
        </div>
      </GlassCard>

      {/* Live feed */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <TwoToneTitle a="Live" b="Intelligence Feed" size={15} />
          <div className="flex items-center gap-1.5">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenM, display: 'inline-block', animation: 'shimmer 2s ease-in-out infinite' }} />
            <span className="label-xs" style={{ color: C.greenM }}>Live</span>
          </div>
        </div>
        <div>
          {liveFeed.slice(0, 5).map((item, i) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '10px 0',
              borderBottom: i < 4 ? `1px solid rgba(255,255,255,0.04)` : 'none',
            }}>
              <PlatformAvatar platform={item.platform} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span className="font-mono" style={{ fontSize: 11, color: C.text3 }}>{item.handle}</span>
                  <SentimentPill sentiment={item.sentiment} />
                  <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{item.ts}</span>
                </div>
                <p style={{ fontSize: 12.5, color: C.text2, lineHeight: 1.5 }}>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

/* ─── Screen: Deep Search ────────────────────────────────────────────────────*/
function ScreenSearch() {
  const [query, setQuery] = useState('cybersecurity')
  const [searched, setSearched] = useState(true)
  return (
    <div className="animate-fade-up space-y-5">
      {/* Search bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 999, padding: '10px 20px',
        backdropFilter: 'blur(20px)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setSearched(true)}
          placeholder="Search narratives, handles, keywords…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: C.text1, fontFamily: 'JetBrains Mono', }}
        />
        <button onClick={() => setSearched(true)} style={{
          background: C.accent, color: '#0B0C14', border: 'none',
          borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'Space Grotesk',
        }}>Search</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {['All Platforms', 'All Sentiment', 'All Time'].map(f => (
          <Pill key={f}>{f}</Pill>
        ))}
      </div>

      {searched && (
        <>
          {/* Provenance trail */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <TwoToneTitle a="Provenance" b="Trail" size={16} />
              <Pill>How it spread</Pill>
            </div>
            <div style={{ position: 'relative', paddingLeft: 36 }}>
              <div style={{ position: 'absolute', left: 13, top: 12, bottom: 12, width: 1, background: 'rgba(154,158,232,0.2)' }} />
              {provenanceSteps.map((step, i) => (
                <div key={i} style={{ position: 'relative', marginBottom: i < provenanceSteps.length - 1 ? 24 : 0 }}>
                  <div style={{
                    position: 'absolute', left: -36, top: 4,
                    width: 14, height: 14, borderRadius: '50%',
                    border: `1.5px solid ${C.accentDim}`,
                    background: i === 0 ? C.accentDim : '#0B0C14',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i === 0 && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0B0C14' }} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <Pill style={{ fontSize: 10 }}>{step.platform}</Pill>
                    <span className="font-mono" style={{ fontSize: 11, color: C.text3 }}>{step.handle}</span>
                    <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{step.ts}</span>
                  </div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.accent, marginBottom: 2 }}>{step.label}</p>
                  <p style={{ fontSize: 12, color: C.text3 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Evidence feed */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between mb-4">
              <TwoToneTitle a="Evidence" b="Feed" size={16} />
              <span className="label-xs">{searchResults.length} results for "{query}"</span>
            </div>
            <div>
              {searchResults.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 0', cursor: 'pointer',
                  borderBottom: i < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  {item.firstPost && (
                    <span className="pill" style={{ fontSize: 9, color: C.accent, borderColor: `${C.accent}40`, background: `${C.accent}10`, flexShrink: 0, marginTop: 2 }}>ORIGIN</span>
                  )}
                  <PlatformAvatar platform={item.platform} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="font-mono" style={{ fontSize: 11, color: C.text3 }}>{item.handle}</span>
                      <span className="pill" style={{ fontSize: 10 }}>{item.platform}</span>
                      <SentimentPill sentiment={item.sentiment} />
                      <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{item.ts}</span>
                    </div>
                    <p style={{ fontSize: 12.5, color: C.text2 }}>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  )
}

/* ─── Screen: Narrative Mutation Tracker ─────────────────────────────────────*/
function ScreenNarrative() {
  const [active, setActive] = useState(3)
  return (
    <div className="animate-fade-up space-y-5">
      {/* Phase cards connected by line */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '5%', right: '5%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(154,158,232,0.3) 20%, rgba(154,158,232,0.3) 80%, transparent)',
          zIndex: 0,
        }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {narrativePhases.map(p => (
            <GlassCard
              key={p.phase}
              className="p-4"
              style={{
                cursor: 'pointer', zIndex: 1,
                border: active === p.phase ? `1px solid rgba(154,158,232,0.4)` : undefined,
                background: active === p.phase ? 'rgba(154,158,232,0.08)' : undefined,
              }}
              onClick={() => setActive(p.phase)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: active === p.phase ? C.accent : 'rgba(154,158,232,0.15)',
                  border: `1.5px solid ${active === p.phase ? C.accent : C.accentDim}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  color: active === p.phase ? '#0B0C14' : C.accent,
                  fontFamily: 'JetBrains Mono',
                }}>{p.phase}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: active === p.phase ? C.text1 : C.text2 }}>{p.label}</span>
              </div>
              <p className="font-mono" style={{ fontSize: 10, color: C.text3, marginBottom: 4 }}>{p.timeRange}</p>
              <p className="font-mono" style={{ fontSize: 20, fontWeight: 300, color: active === p.phase ? C.accent : C.text1 }}>{p.posts.toLocaleString()}</p>
              <p className="label-xs mt-1">posts</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Active phase detail */}
      {narrativePhases.filter(p => p.phase === active).map(p => (
        <div key={p.phase} className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up">
          <GlassCard className="p-5">
            <p className="label-xs mb-3">Phase {p.phase}: {p.label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <SentimentPill sentiment={p.sentiment} />
              <span className="font-mono" style={{ fontSize: 11, color: C.text3 }}>{p.posts.toLocaleString()} posts · {p.timeRange}</span>
            </div>
            <p style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>{p.desc}</p>
          </GlassCard>
          <GlassCard className="p-5">
            <p className="label-xs mb-3">Key Entities</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.entities.map(e => <Pill key={e} style={{ fontSize: 11, color: C.text1, borderColor: C.border }}>{e}</Pill>)}
            </div>
            {active > 1 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="label-xs mb-2" style={{ color: C.amberM }}>Entities mutated since Phase 1</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.entities.slice(1).map(e => (
                    <Pill key={e} style={{ fontSize: 11, color: C.amberM, borderColor: `${C.amberM}40`, background: `${C.amberM}10` }}>↑ {e}</Pill>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      ))}

      {/* Volume chart */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <TwoToneTitle a="Phase" b="Volume" size={16} />
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={narrativePhases} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.text3 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.text3, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip {...CT} />
            <Bar dataKey="posts" radius={[6,6,0,0]}>
              {narrativePhases.map(p => <Cell key={p.phase} fill={active === p.phase ? C.accent : 'rgba(154,158,232,0.2)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  )
}

/* ─── Screen: Cross-Platform Correlation ─────────────────────────────────────*/
function ScreenCorrelation() {
  const [query, setQuery] = useState('AI')
  return (
    <div className="animate-fade-up space-y-5">
      <div style={{
        display: 'flex', gap: 12,
        background: C.glass,
        border: `1px solid ${C.border}`,
        borderRadius: 999, padding: '8px 16px',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Track a topic across platforms…"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: C.text1, fontFamily: 'JetBrains Mono' }} />
        <button style={{ background: C.accent, color: '#0B0C14', border: 'none', borderRadius: 999, padding: '4px 16px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'Space Grotesk' }}>Track</button>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-6">
          <TwoToneTitle a="Spread" b="Timeline" size={16} />
          <span className="label-xs">"{query}" · diffusion map</span>
        </div>
        {/* Horizontal platform flow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflow: 'auto' }}>
          {correlationStory.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < correlationStory.length - 1 ? 1 : 'none' }}>
              <div style={{ flexShrink: 0 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'rgba(154,158,232,0.1)',
                  border: `1.5px solid rgba(154,158,232,0.3)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, color: C.accent, fontWeight: 600,
                  marginBottom: 8,
                }}>
                  {step.platform === 'X' ? '𝕏' : step.platform === 'Reddit' ? 'R' : '▶'}
                </div>
                <p style={{ fontSize: 11, color: C.text1, fontWeight: 500, textAlign: 'center', marginBottom: 2 }}>{step.platform}</p>
                <p className="font-mono" style={{ fontSize: 10, color: C.text3, textAlign: 'center' }}>{step.time}</p>
                {step.relativeHours > 0 && (
                  <p className="pill" style={{ fontSize: 9, color: C.amberM, marginTop: 4, borderColor: `${C.amberM}30`, background: `${C.amberM}08` }}>+{step.relativeHours}h</p>
                )}
                {step.relativeHours === 0 && (
                  <p className="pill" style={{ fontSize: 9, color: C.accent, marginTop: 4, borderColor: `${C.accent}30`, background: `${C.accent}08` }}>ORIGIN</p>
                )}
              </div>
              {i < correlationStory.length - 1 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 16px', marginBottom: 32 }}>
                  <div style={{ width: '100%', height: 1, background: `linear-gradient(90deg, rgba(154,158,232,0.4), rgba(154,158,232,0.1))` }} />
                  <p className="font-mono" style={{ fontSize: 9, color: C.text3 }}>{correlationStory[i + 1].posts.toLocaleString()} posts</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <TwoToneTitle a="Hourly Volume" b="by Platform" size={16} />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={correlationVol} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: C.text3, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.text3, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip {...CT} />
            <Bar dataKey="X" fill={C.accent} fillOpacity={0.7} radius={[3,3,0,0]} />
            <Bar dataKey="Reddit" fill={C.accentDim} fillOpacity={0.7} radius={[3,3,0,0]} />
            <Bar dataKey="YouTube" fill={C.accentBright} fillOpacity={0.5} radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {[['X', C.accent], ['Reddit', C.accentDim], ['YouTube', C.accentBright]].map(([p, c]) => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.text3 }}>
              <span style={{ width: 12, height: 2, borderRadius: 1, background: c, display: 'inline-block' }} />{p}
            </span>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}

/* ─── Screen: Alerts ─────────────────────────────────────────────────────────*/
function ScreenAlerts() {
  const sevColor: Record<AlertSeverity, string> = { critical: C.redM, warning: C.amberM, info: C.blueM }
  return (
    <div className="animate-fade-up space-y-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <TwoToneTitle a="Intelligence" b="Alerts" size={20} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.greenM, display: 'inline-block' }} />
          <span className="label-xs" style={{ color: C.greenM }}>Live monitoring</span>
        </div>
      </div>
      {/* Header stats row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <span className="pill" style={{ fontSize: 11, color: C.redM, borderColor: `${C.redM}40`, background: `${C.redM}12`, padding: '4px 12px' }}>
          ● Critical · 2
        </span>
        <span className="pill" style={{ fontSize: 11, color: C.amberM, borderColor: `${C.amberM}40`, background: `${C.amberM}12`, padding: '4px 12px' }}>
          ● Warning · 2
        </span>
      </div>
      {alerts.map(a => (
        <div key={a.id} className="glass" style={{ padding: '14px 16px 14px 20px', position: 'relative' }}>
          <SeverityLine severity={a.severity} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flexShrink: 0 }}>
              <span className="pill" style={{
                fontSize: 9, padding: '2px 8px',
                color: sevColor[a.severity],
                borderColor: `${sevColor[a.severity]}40`,
                background: `${sevColor[a.severity]}12`,
              }}>● {a.severity.toUpperCase()}</span>
              <p className="font-mono" style={{ fontSize: 9, color: C.text3, marginTop: 4 }}>{a.id}</p>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>{a.type}</span>
                  <span style={{ color: C.text3, margin: '0 6px' }}>·</span>
                  <span style={{ fontSize: 13, color: C.text2 }}>{a.narrative}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pill style={{ fontSize: 10 }}>{a.platform}</Pill>
                  <span className="font-mono" style={{ fontSize: 10, color: C.text3 }}>{a.ts}</span>
                </div>
              </div>
              <p style={{ fontSize: 12, color: C.text2, marginBottom: 4 }}>{a.detail}</p>
              <p className="font-mono" style={{ fontSize: 10, color: C.text3 }}>Triggered by: {a.triggered}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── Screen: Demographics ───────────────────────────────────────────────────*/
function ScreenDemographics() {
  return (
    <div className="animate-fade-up space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <TwoToneTitle a="Privacy-Safe" b="Demographics" size={20} />
        <Pill style={{ color: C.greenM, borderColor: `${C.greenM}40`, background: `${C.greenM}0a`, fontSize: 11 }}>
          🛡 Aggregated · No PII
        </Pill>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[
          { title: 'Inferred', sub: 'Profession', data: professionData },
          { title: 'Inferred', sub: 'Region', data: regionData },
        ].map(({ title, sub, data }) => (
          <GlassCard key={sub} className="p-5">
            <TwoToneTitle a={title} b={sub} size={15} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={62} dataKey="value" paddingAngle={2}>
                    {data.map((_, i) => <Cell key={i} fill={DEMO_PALETTE[i % DEMO_PALETTE.length]} />)}
                  </Pie>
                  <Tooltip {...CT} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {data.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: DEMO_PALETTE[i % DEMO_PALETTE.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: C.text2, flex: 1 }}>{d.name}</span>
                    <span className="font-mono" style={{ fontSize: 11, color: C.text3 }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ))}

        <GlassCard className="p-5">
          <TwoToneTitle a="Age" b="Distribution" size={15} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ageBandData.map(d => (
              <div key={d.band} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 11, color: C.text3, width: 40, flexShrink: 0 }}>{d.band}</span>
                <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                  <div className="progress-bar-fill" style={{ width: `${d.pct}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accentDim})` }} />
                </div>
                <span className="font-mono" style={{ fontSize: 11, color: C.text3, width: 30, textAlign: 'right' }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <TwoToneTitle a="Detected" b="Language" size={15} />
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {languageData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="font-mono" style={{ fontSize: 11, color: C.text3, width: 56, flexShrink: 0 }}>{d.name}</span>
                <div className="progress-bar" style={{ flex: 1, height: 4 }}>
                  <div className="progress-bar-fill" style={{ width: `${d.pct}%`, background: `linear-gradient(90deg, #8B8FD8, #6B6FAA)` }} />
                </div>
                <span className="font-mono" style={{ fontSize: 11, color: C.text3, width: 30, textAlign: 'right' }}>{d.pct}%</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  )
}

/* ─── Screen: Network Graph ──────────────────────────────────────────────────*/
function ScreenNetworkGraph() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ width: 800, height: 520 })
  const [hovered, setHovered] = useState<{ node: any; x: number; y: number } | null>(null)
  const [filterP, setFilterP] = useState<Platform | 'All'>('All')
  const graphData = useMemo(() => buildGraphData(), [])
  const filteredData = useMemo(() => {
    if (filterP === 'All') return graphData
    const ns = graphData.nodes.filter(n => n.platform === filterP)
    const ids = new Set(ns.map(n => n.id))
    return { nodes: ns, links: graphData.links.filter(l => ids.has(l.source as string) && ids.has(l.target as string)) }
  }, [graphData, filterP])

  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      setDims({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const nodeColor = useCallback((n: any) => {
    if (n.group === 'Bridge') return C.amberM
    const m: Record<string, string> = { InfoSec: C.accent, CyberSec: C.accentDim, Policy: '#6B6FAA' }
    return m[n.group] || C.text3
  }, [])

  const groupColors: Record<string, string> = { InfoSec: C.accent, CyberSec: C.accentDim, Policy: '#6B6FAA', Bridge: C.amberM }

  return (
    <div className="animate-fade-up space-y-4">
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <TwoToneTitle a="Network" b="Graph" size={20} />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(groupColors).map(([g, c]) => (
            <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.text3 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{g}
            </span>
          ))}
        </div>
      </div>

      <GlassCard style={{ overflow: 'hidden', position: 'relative', height: 540 }}>
        {/* Filter panel — floating over canvas */}
        <div className="glass-float" style={{
          position: 'absolute', top: 12, left: 12, zIndex: 10, padding: '10px 14px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <p className="label-xs">Filter Platform</p>
          {(['All', 'X', 'Reddit', 'YouTube'] as const).map(p => (
            <button key={p} onClick={() => setFilterP(p)} className="pill" style={{
              background: filterP === p ? 'rgba(154,158,232,0.18)' : 'transparent',
              color: filterP === p ? C.accentBright : C.text3,
              border: `1px solid ${filterP === p ? 'rgba(154,158,232,0.3)' : C.border}`,
              justifyContent: 'flex-start',
            }}>{p}</button>
          ))}
          <p className="label-xs" style={{ marginTop: 4 }}>{filteredData.nodes.length} nodes · {filteredData.links.length} edges</p>
        </div>

        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
          {filteredData.nodes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              <p style={{ fontSize: 13, color: C.text3 }}>No nodes match filter.</p>
              <button onClick={() => setFilterP('All')} style={{ color: C.accent, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}>Reset</button>
            </div>
          ) : (
            <ForceGraph2D
              graphData={filteredData}
              width={dims.width} height={dims.height}
              backgroundColor="#0B0C14"
              nodeColor={nodeColor}
              nodeRelSize={4}
              nodeVal={(n: any) => n.val}
              linkColor={() => 'rgba(154,158,232,0.12)'}
              linkWidth={1}
              nodeLabel={() => ''}
              onNodeHover={(n: any, _p: any, ev: any) => {
                if (n) setHovered({ node: n, x: ev?.clientX || 0, y: ev?.clientY || 0 })
                else setHovered(null)
              }}
              nodeCanvasObjectMode={() => 'after'}
              nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, gs: number) => {
                // Soft glow
                const r = n.val * 4
                const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 2)
                grad.addColorStop(0, nodeColor(n) + '60')
                grad.addColorStop(1, 'transparent')
                ctx.beginPath()
                ctx.arc(n.x, n.y, r * 2, 0, 2 * Math.PI)
                ctx.fillStyle = grad
                ctx.fill()
                // Label
                const sz = Math.max(7, 9 / gs)
                ctx.font = `${sz}px JetBrains Mono`
                ctx.fillStyle = 'rgba(142,146,176,0.8)'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'top'
                ctx.fillText(n.label, n.x, n.y + r + 2)
              }}
            />
          )}
        </div>

        {hovered && (
          <div className="glass-float" style={{ position: 'fixed', left: hovered.x + 12, top: hovered.y - 70, padding: '10px 14px', zIndex: 100, pointerEvents: 'none', minWidth: 140 }}>
            <p className="font-mono" style={{ fontSize: 12, color: C.text1, fontWeight: 600 }}>{hovered.node.label}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <Pill style={{ fontSize: 10 }}>{hovered.node.platform}</Pill>
              <span style={{ fontSize: 11, color: C.text3 }}>{hovered.node.group}</span>
            </div>
            <p style={{ fontSize: 11, color: C.text3, marginTop: 4 }}>
              Influence: <span className="font-mono" style={{ color: C.accent }}>{hovered.node.influence}</span>
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  )
}

/* ─── Screen: Network Intelligence ──────────────────────────────────────────*/
function ScreenNetworkIntel() {
  return (
    <div className="animate-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Influencers */}
        <GlassCard className="p-5">
          <TwoToneTitle a="Top" b="Influencers" size={15} />
          <p style={{ fontSize: 11, color: C.text3, marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>Accounts with the largest measurable reach in the active narrative cluster.</p>
          {influencers.map(inf => (
            <div key={inf.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <span className="font-mono" style={{ fontSize: 11, color: C.text3, width: 16 }}>{inf.rank}</span>
              <PlatformAvatar platform={inf.platform} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="font-mono" style={{ fontSize: 11, color: C.text1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inf.handle}</p>
                <p style={{ fontSize: 10, color: C.text3 }}>{inf.community} · {inf.followers}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p className="font-mono" style={{ fontSize: 16, fontWeight: 300, color: C.accent }}>{inf.score}</p>
              </div>
            </div>
          ))}
        </GlassCard>

        {/* Bridge Nodes */}
        <GlassCard className="p-5">
          <TwoToneTitle a="Bridge" b="Nodes" size={15} />
          <p style={{ fontSize: 11, color: C.text3, marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>Accounts linking separate communities — key to cross-group narrative diffusion.</p>
          {bridgeNodes.map(b => (
            <div key={b.id} className="glass" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.amberM, flexShrink: 0 }} />
                <span className="font-mono" style={{ fontSize: 12, color: C.text1, fontWeight: 600 }}>{b.handle}</span>
                <span className="font-mono" style={{ fontSize: 10, color: C.amberM, marginLeft: 'auto' }}>β={b.betweenness}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {b.platforms.map(p => <Pill key={p} style={{ fontSize: 9 }}>{p}</Pill>)}
                {b.communities.map(co => <Pill key={co} style={{ fontSize: 9, color: C.text3 }}>{co}</Pill>)}
              </div>
              <p style={{ fontSize: 11, color: C.text3 }}>{b.desc}</p>
            </div>
          ))}
        </GlassCard>

        {/* Communities */}
        <GlassCard className="p-5">
          <TwoToneTitle a="Network" b="Communities" size={15} />
          <p style={{ fontSize: 11, color: C.text3, marginTop: 4, marginBottom: 16, lineHeight: 1.5 }}>Clusters with high intra-group interaction. Higher cohesion = tighter echo chamber.</p>
          {communities.map(co => (
            <div key={co.id} className="glass" style={{ padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text1 }}>{co.name}</span>
                <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{co.size.toLocaleString()} nodes</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <SentimentPill sentiment={co.sentiment} />
                <div className="progress-bar" style={{ flex: 1 }}>
                  <div className="progress-bar-fill" style={{ width: `${co.cohesion * 100}%` }} />
                </div>
                <span className="font-mono" style={{ fontSize: 10, color: C.text3 }}>{(co.cohesion * 100).toFixed(0)}%</span>
              </div>
              <p style={{ fontSize: 11, color: C.text3, marginBottom: 6 }}>{co.desc}</p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {co.platforms.map(p => <Pill key={p} style={{ fontSize: 9 }}>{p}</Pill>)}
              </div>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  )
}

/* ─── Screen: YouTube Feed ───────────────────────────────────────────────────*/
function ScreenYouTubeFeed() {
  return (
    <div className="animate-fade-up space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <TwoToneTitle a="Live" b="YouTube Feed" size={20} />
        <Pill>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          Fetched every 3 hrs
        </Pill>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {youtubeVideos.map(v => (
          <GlassCard key={v.id} style={{ overflow: 'hidden', cursor: 'pointer' }}>
            {/* Thumbnail */}
            <div style={{
              height: 140, background: 'rgba(154,158,232,0.06)',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'transform 0.2s',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill={C.text2}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              </div>
              <span className="pill font-mono" style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, padding: '2px 8px' }}>{v.duration}</span>
              <span className="pill" style={{ position: 'absolute', top: 8, left: 8, fontSize: 9, color: C.accent, borderColor: `${C.accent}30`, background: `${C.accent}0a` }}>{v.topic}</span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              <p style={{ fontSize: 12.5, fontWeight: 500, color: C.text1, lineHeight: 1.4, marginBottom: 8 }}>{v.title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: C.text3 }}>{v.channel}</span>
                <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{v.views} views</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <SentimentPill sentiment={v.sentiment} />
                <span className="font-mono" style={{ fontSize: 10, color: C.text3, marginLeft: 'auto' }}>{v.fetchedAgo} ago</span>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

/* ─── Nav config ─────────────────────────────────────────────────────────────*/
const NAV_GROUPS = [
  {
    label: 'MONITOR',
    items: [
      { id: 'analytics' as Screen, label: 'Analytics' },
      { id: 'alerts' as Screen, label: 'Alerts', badge: 5 },
      { id: 'youtube-feed' as Screen, label: 'YouTube Feed' },
      { id: 'demographics' as Screen, label: 'Demographics' },
    ],
  },
  {
    label: 'INVESTIGATE',
    items: [
      { id: 'search' as Screen, label: 'Deep Search' },
      { id: 'narrative' as Screen, label: 'Narrative Tracker' },
      { id: 'correlation' as Screen, label: 'Cross-Platform' },
    ],
  },
  {
    label: 'NETWORK',
    items: [
      { id: 'network-graph' as Screen, label: 'Network Graph' },
      { id: 'network-intel' as Screen, label: 'Network Intel' },
    ],
  },
]

const SCREEN_TITLES: Record<Screen, [string, string]> = {
  analytics:      ['Narrative', 'Analytics'],
  search:         ['Deep', 'Search'],
  narrative:      ['Narrative', 'Tracker'],
  correlation:    ['Cross-Platform', 'Correlation'],
  alerts:         ['Intelligence', 'Alerts'],
  demographics:   ['Privacy-Safe', 'Demographics'],
  'network-graph':['Network', 'Graph'],
  'network-intel':['Network', 'Intelligence'],
  'youtube-feed': ['Live', 'YouTube Feed'],
}

/* ─── Dashboard Shell ────────────────────────────────────────────────────────*/
export default function Dashboard() {
  const navigate = useNavigate()
  const [screen, setScreen] = useState<Screen>('analytics')
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['INVESTIGATE', 'NETWORK', 'SYSTEM']))
  const title = SCREEN_TITLES[screen]

  const toggleGroup = (label: string) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(label) ? s.delete(label) : s.add(label); return s })

  const renderScreen = () => {
    switch (screen) {
      case 'analytics':      return <ScreenAnalytics />
      case 'search':         return <ScreenSearch />
      case 'narrative':      return <ScreenNarrative />
      case 'correlation':    return <ScreenCorrelation />
      case 'alerts':         return <ScreenAlerts />
      case 'demographics':   return <ScreenDemographics />
      case 'network-graph':  return <ScreenNetworkGraph />
      case 'network-intel':  return <ScreenNetworkIntel />
      case 'youtube-feed':   return <ScreenYouTubeFeed />
    }
  }

  return (
    <div className="page-bg" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column',
        padding: '0 8px', overflowY: 'auto',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 8px 14px', background: 'none', border: 'none', cursor: 'pointer', color: C.text1, textDecoration: 'none' }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'rgba(154,158,232,0.12)', border: '1px solid rgba(154,158,232,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text1, letterSpacing: '-0.01em' }}>NETRA</span>
        </button>

        {/* Groups */}
        <nav style={{ flex: 1 }}>
          {NAV_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <button
                onClick={() => toggleGroup(group.label)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '6px 8px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <span className="label-xs" style={{ color: C.text3 }}>{group.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: collapsed.has(group.label) ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {!collapsed.has(group.label) && group.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setScreen(item.id)}
                  className={`nav-item ${screen === item.id ? 'active' : ''}`}
                >
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {('badge' in item) && item.badge && (
                    <span style={{
                      background: `rgba(192,112,112,0.2)`, color: C.redM,
                      borderRadius: 999, fontSize: 9, fontWeight: 700,
                      padding: '1px 6px', fontFamily: 'JetBrains Mono',
                    }}>{item.badge}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom area */}
        <div style={{ padding: '8px 0 16px' }}>
          <button className="pill" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
            Support
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          {/* Back button */}
          <button onClick={() => navigate('/')} style={{
            width: 30, height: 30, borderRadius: '50%',
            background: C.glass, border: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>

          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TwoToneTitle a={title[0]} b={title[1]} size={14} />
            <Pill style={{ fontSize: 10, padding: '2px 10px' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
              How it works
            </Pill>
          </div>

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 320, margin: '0 8px', position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setScreen('search')}
              placeholder="Search…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999,
                padding: '6px 12px 6px 30px', fontSize: 12,
                color: C.text1, outline: 'none', fontFamily: 'JetBrains Mono',
              }}
            />
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pill style={{ fontSize: 10, color: '#70A888', borderColor: 'rgba(112,168,136,0.3)', background: 'rgba(112,168,136,0.08)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Privacy-Safe · No PII
            </Pill>
            <Pill style={{ fontSize: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#70A888', display: 'inline-block', animation: 'shimmer 2s ease-in-out infinite' }} />
              Live · 2m ago
            </Pill>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 28px' }}>
          <div key={screen} style={{ maxWidth: 1200, margin: '0 auto' }}>
            {renderScreen()}
          </div>
        </main>
      </div>
    </div>
  )
}
