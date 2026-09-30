import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis } from 'recharts'

/* ─── Design tokens ──────────────────────────────────────────────────────────*/
const C = {
  accent:       '#9A9EE8',
  accentDim:    '#7B7FC4',
  accentBright: '#B8BBEE',
  text1:        '#F2F3FA',
  text2:        '#8E92B0',
  text3:        '#5B5F7A',
  border:       'rgba(255,255,255,0.09)',
  glass:        'rgba(255,255,255,0.04)',
  greenM:       '#70A888',
  redM:         '#C07070',
}

/* ─── Animated counter ───────────────────────────────────────────────────────*/
function useCounter(target: number, duration = 2000, start = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    const step = target / (duration / 16)
    let cur = 0
    const t = setInterval(() => { cur = Math.min(cur + step, target); setVal(Math.floor(cur)); if (cur >= target) clearInterval(t) }, 16)
    return () => clearInterval(t)
  }, [target, duration, start])
  return val
}

function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

/* ─── Shared primitives ──────────────────────────────────────────────────────*/
function GlassCard({ children, className = '', style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`glass ${className}`} style={style}>{children}</div>
  )
}

function FloatCard({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="glass-float" style={style}>{children}</div>
}

function Pill({ children, style = {}, href }: { children: React.ReactNode; style?: React.CSSProperties; href?: string }) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    borderRadius: 999, border: `1px solid ${C.border}`,
    background: C.glass, padding: '5px 14px',
    fontSize: 12, color: C.text2,
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
    textDecoration: 'none', fontFamily: 'Space Grotesk',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.15s',
    ...style,
  }
  if (href) return <a href={href} style={base}>{children}</a>
  return <span style={base}>{children}</span>
}

function TwoTone({ a, b, size = 48, style = {} }: { a: string; b: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span style={{ fontWeight: 300, fontSize: size, lineHeight: 1.1, ...style }}>
      <span style={{ color: C.text1 }}>{a} </span>
      <span style={{ color: C.accent }}>{b}</span>
    </span>
  )
}

function LabelXs({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.text3, ...style }}>{children}</p>
  )
}

/* ─── Mini chart (for hero preview) ─────────────────────────────────────────*/
const miniData = [
  { t: 'Aug', a: 22, b: 18 }, { t: 'Oct', a: 35, b: 28 },
  { t: 'Dec', a: 28, b: 35 }, { t: 'Feb', a: 48, b: 32 }, { t: 'Apr', a: 42, b: 28 },
]

const miniFeed = [
  { p: '𝕏', text: 'AI bill could reshape data sovereignty rules globally.', s: '→', sc: C.text3 },
  { p: 'R', text: '40k credentials exposed in forum dump. Verify sources.', s: '↓', sc: C.redM },
  { p: '▶', text: 'BREAKING: New exploit on live stream. No patch yet.', s: '↓', sc: C.redM },
]

function DashboardPreview() {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Main card */}
      <GlassCard style={{
        padding: 0, overflow: 'hidden',
        boxShadow: `0 0 80px rgba(139,143,216,0.06), 0 0 160px rgba(139,143,216,0.03)`,
        animation: 'float 7s ease-in-out infinite',
      }}>
        {/* Top bar mock */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: 'rgba(154,158,232,0.12)', border: '1px solid rgba(154,158,232,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /><line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.text1 }}>NETRA</span>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: C.glass, margin: '0 8px' }} />
          <Pill style={{ fontSize: 9, padding: '2px 10px', color: C.greenM, borderColor: `rgba(112,168,136,0.3)`, background: 'rgba(112,168,136,0.08)' }}>Live</Pill>
        </div>

        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[['52,841', 'Posts', C.accent], ['−0.14', 'Sentiment', C.text1], ['23', 'Narratives', C.text1], ['5', 'Alerts', C.redM]].map(([v, l, c]) => (
              <div key={l} className="glass" style={{ padding: '8px 8px' }}>
                <p style={{ fontSize: 7, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text3, marginBottom: 3 }}>{l}</p>
                <p style={{ fontSize: 16, fontWeight: 300, color: c as string, fontFamily: 'JetBrains Mono' }}>{v}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="glass" style={{ padding: '10px 10px 6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: C.text2, fontWeight: 500 }}>Narrative Volume</span>
              <span style={{ fontSize: 10, color: C.accent }}>Timeseries</span>
            </div>
            <ResponsiveContainer width="100%" height={70}>
              <AreaChart data={miniData} margin={{ top: 2, right: 4, left: -32, bottom: 0 }}>
                <defs>
                  <linearGradient id="hgA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.accent} stopOpacity={0.35} /><stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="hgB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.redM} stopOpacity={0.3} /><stop offset="100%" stopColor={C.redM} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 8, fill: C.text3 }} tickLine={false} axisLine={false} />
                <YAxis hide />
                <Area type="monotone" dataKey="a" stroke={C.accent} strokeWidth={1.5} fill="url(#hgA)" dot={false} />
                <Area type="monotone" dataKey="b" stroke={C.redM} strokeWidth={1.5} fill="url(#hgB)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Feed */}
          <div className="glass" style={{ padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.text3 }}>Live Feed</span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.greenM, display: 'inline-block', marginLeft: 'auto' }} />
            </div>
            {miniFeed.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: i < miniFeed.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(154,158,232,0.1)', border: `1px solid rgba(154,158,232,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: C.accent, flexShrink: 0 }}>{item.p}</div>
                <p style={{ fontSize: 9, color: C.text3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.text}</p>
                <span style={{ fontSize: 10, color: item.sc, flexShrink: 0 }}>{item.s}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* Floating overlay cards */}
      <FloatCard style={{
        position: 'absolute', bottom: -20, left: -20,
        padding: '10px 14px', width: 130,
        zIndex: 10,
      }}>
        <LabelXs style={{ marginBottom: 4 }}>Median time</LabelXs>
        <p style={{ fontSize: 22, fontWeight: 300, color: C.text1, fontFamily: 'JetBrains Mono' }}>2.4D</p>
        <p style={{ fontSize: 9, color: C.greenM, marginTop: 2 }}>↓ 0.3 Days</p>
      </FloatCard>

      <FloatCard style={{
        position: 'absolute', top: 20, right: -20,
        padding: '10px 14px', width: 130,
        zIndex: 10,
      }}>
        <LabelXs style={{ marginBottom: 4 }}>Neg. Sentiment</LabelXs>
        <p style={{ fontSize: 22, fontWeight: 300, color: C.text1, fontFamily: 'JetBrains Mono' }}>61.2%</p>
        <div style={{ marginTop: 6, position: 'relative' }}>
          <svg width={60} height={60} viewBox="0 0 60 60" style={{ display: 'block', margin: '0 auto' }}>
            <circle cx="30" cy="30" r="22" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
            <circle cx="30" cy="30" r="22" fill="none" stroke={C.redM} strokeWidth="6"
              strokeDasharray={`${0.612 * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
              strokeDashoffset={2 * Math.PI * 22 * 0.25}
              strokeLinecap="round" transform="rotate(-90 30 30)" />
          </svg>
        </div>
      </FloatCard>
    </div>
  )
}

/* ─── Feature cards ──────────────────────────────────────────────────────────*/
const features = [
  { title: 'Real-Time Analytics', desc: 'Live KPIs, sentiment trends, and narrative volume across all platforms.' },
  { title: 'Deep Search', desc: 'Trace any keyword to its origin with a full provenance trail.' },
  { title: 'Narrative Mutation', desc: 'Watch how a story\'s framing and entities shift across 4 lifecycle phases.' },
  { title: 'Cross-Platform Spread', desc: 'Visualize the exact moment X → Reddit → YouTube, with time gaps.' },
  { title: 'Automated Alerts', desc: 'Severity-coded alerts for volume spikes, sentiment shifts and keywords.' },
  { title: 'Privacy-Safe Demographics', desc: 'Aggregated audience insights. Zero personal data stored or displayed.' },
  { title: 'Network Graph', desc: 'Force-directed graph with zoom, pan, and hover tooltips.' },
  { title: 'Network Intelligence', desc: 'Identify influencers, bridge nodes, and community clusters.' },
  { title: 'YouTube Integration', desc: 'Video cards with topic tags and freshness indicators, every 3 hours.' },
]

const steps = [
  { n: 1, label: 'Ingest', desc: 'Pulls posts from X, Reddit and YouTube continuously.' },
  { n: 2, label: 'Analyze', desc: 'Extracts entities, sentiment, and narrative clusters.' },
  { n: 3, label: 'Connect', desc: 'Builds relationship graph across accounts and communities.' },
  { n: 4, label: 'Alert', desc: 'Flags volume spikes, sentiment shifts and high-risk keywords.' },
]

/* ─── Home ───────────────────────────────────────────────────────────────────*/
export default function Home() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const { ref: statsRef, inView: statsInView } = useInView()
  const { ref: featRef, inView: featInView } = useInView()
  const { ref: stepsRef, inView: stepsInView } = useInView()

  const posts = useCounter(2847391, 2200, statsInView)
  const narratives = useCounter(23, 1800, statsInView)
  const comms = useCounter(47, 2000, statsInView)

  const go = () => navigate('/dashboard')

  return (
    <div className="page-bg" style={{ minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', gap: 32, height: 52,
        padding: '0 32px',
        background: scrolled ? 'rgba(11,12,20,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(154,158,232,0.12)', border: '1px solid rgba(154,158,232,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /><line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22 8.5 12 15.5 2 8.5" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>NETRA</span>
        </div>

        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          <div className="glass" style={{ display: 'flex', borderRadius: 999, padding: '2px 4px', gap: 2, backdropFilter: 'blur(20px)' }}>
            {[['Features', '#features'], ['How it Works', '#how-it-works'], ['Platforms', '#platforms'], ['Privacy', '#privacy']].map(([label, href]) => (
              <a key={label} href={href} style={{ padding: '4px 12px', borderRadius: 999, fontSize: 11.5, color: C.text2, textDecoration: 'none', transition: 'all 0.15s' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = C.text1; (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = C.text2; (e.target as HTMLElement).style.background = 'transparent' }}>
                {label}
              </a>
            ))}
          </div>
        </div>

        <button onClick={go} className="btn-metal" style={{ padding: '7px 18px', fontSize: 12 }}>
          Launch Dashboard
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ paddingTop: 100, paddingBottom: 80, padding: '100px 32px 80px', position: 'relative', overflow: 'hidden' }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(154,158,232,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(154,158,232,0.03) 1px, transparent 1px)`,
          backgroundSize: '56px 56px',
        }} />
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          {/* Left */}
          <div className="animate-fade-up">
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              borderRadius: 999, border: `1px solid rgba(154,158,232,0.25)`,
              background: 'rgba(154,158,232,0.07)', padding: '5px 14px',
              fontSize: 11, color: C.accent, marginBottom: 28,
              fontFamily: 'JetBrains Mono',
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, display: 'inline-block', animation: 'shimmer 2s ease-in-out infinite' }} />
              Smart India Hackathon 2026
            </div>

            <div style={{ marginBottom: 20 }}>
              <TwoTone a="See how narratives spread," b="before they trend." size={40} />
            </div>

            <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.7, marginBottom: 32, maxWidth: 480 }}>
              NETRA is a real-time, multi-platform social media intelligence dashboard that tracks narrative evolution, cross-platform spread and network influence across X, Reddit and YouTube.
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
              <button onClick={go} className="btn-metal">
                Launch Dashboard
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
              </button>
              <a href="#how-it-works" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                borderRadius: 999, padding: '12px 24px', fontSize: 13, fontWeight: 500,
                border: `1px solid ${C.border}`, color: C.text2,
                textDecoration: 'none', transition: 'all 0.15s',
                background: C.glass, backdropFilter: 'blur(20px)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>
                Watch 3-min Demo
              </a>
            </div>

            {/* Trust badges */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: '🛡 Privacy-Safe · No PII', color: C.greenM },
                { label: '⚡ Live Data',           color: C.accent },
                { label: '◈ Graph-Powered',        color: C.accentDim },
              ].map(({ label, color }) => (
                <Pill key={label} style={{ fontSize: 11, color, borderColor: `${color}35`, background: `${color}0a` }}>{label}</Pill>
              ))}
            </div>
          </div>

          {/* Right: dashboard preview */}
          <div style={{ position: 'relative', paddingRight: 24, paddingBottom: 24 }}>
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <div ref={statsRef}>
        <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 32px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0 }}>
              {[
                { val: posts.toLocaleString(), label: 'Posts Analyzed', color: C.accent },
                { val: '3',                   label: 'Platforms Monitored', color: C.accent },
                { val: narratives.toString(),  label: 'Active Narratives',   color: C.accentDim },
                { val: comms.toString(),       label: 'Communities Detected', color: '#6B6FAA' },
              ].map(({ val, label, color }, i) => (
                <div key={label} style={{ textAlign: 'center', padding: '0 16px', borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
                  <p style={{ fontSize: 30, fontWeight: 300, color, fontFamily: 'JetBrains Mono', marginBottom: 4 }}>{val}</p>
                  <LabelXs>{label}</LabelXs>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.greenM, display: 'inline-block', animation: 'shimmer 2s ease-in-out infinite' }} />
              <LabelXs style={{ color: C.greenM }}>Live · Updated 2 min ago</LabelXs>
            </div>
          </div>
        </section>
      </div>

      {/* ── Platforms ── */}
      <section id="platforms" style={{ padding: '72px 32px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <LabelXs style={{ marginBottom: 10, color: C.accent }}>Data Sources</LabelXs>
          <TwoTone a="Three platforms." b="One unified view." size={28} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 40 }}>
            {[
              { icon: '𝕏',  name: 'X (Twitter)', desc: 'Real-time posts and threads. First-mover for breaking narratives.' },
              { icon: 'R',  name: 'Reddit',       desc: 'Subreddit discourse. Rich long-form discussion and community context.' },
              { icon: '▶', name: 'YouTube',       desc: 'Video titles and channels. Signals mainstream narrative amplification.' },
            ].map(({ icon, name, desc }) => (
              <GlassCard key={name} style={{ padding: '20px', display: 'flex', gap: 14, alignItems: 'flex-start', cursor: 'default' }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(154,158,232,0.1)', border: '1px solid rgba(154,158,232,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: C.accentBright, fontWeight: 600,
                }}>{icon}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text1, marginBottom: 4 }}>{name}</p>
                  <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.5 }}>{desc}</p>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" ref={featRef} style={{ padding: '72px 32px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <LabelXs style={{ marginBottom: 10, color: C.accent }}>Capabilities</LabelXs>
            <TwoTone a="Everything an" b="analyst needs." size={28} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {features.map((f, i) => (
              <GlassCard
                key={f.title}
                style={{
                  padding: '18px 20px', cursor: 'default',
                  opacity: featInView ? 1 : 0,
                  transform: featInView ? 'translateY(0)' : 'translateY(16px)',
                  transition: `opacity 0.35s ease ${i * 35}ms, transform 0.35s ease ${i * 35}ms, border-color 0.2s, box-shadow 0.2s`,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = 'rgba(154,158,232,0.3)'
                  el.style.boxShadow = '0 4px 20px rgba(154,158,232,0.07)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = ''
                  el.style.boxShadow = ''
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 9, marginBottom: 12,
                  background: 'rgba(154,158,232,0.08)', border: `1px solid rgba(154,158,232,0.15)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: C.accent,
                }}>◆</div>
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text1, marginBottom: 4 }}>{f.title}</p>
                <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.55 }}>{f.desc}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ── */}
      <section id="how-it-works" ref={stepsRef} style={{ padding: '72px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <LabelXs style={{ marginBottom: 10, color: C.accent }}>Process</LabelXs>
            <TwoTone a="From post to" b="insight in seconds." size={28} />
          </div>
          <div style={{ position: 'relative' }}>
            {/* Connecting line */}
            <div style={{
              position: 'absolute', top: 28, left: '8%', right: '8%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(154,158,232,0.25) 15%, rgba(154,158,232,0.25) 85%, transparent)',
            }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
              {steps.map((step, i) => (
                <div key={step.n} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  opacity: stepsInView ? 1 : 0,
                  transform: stepsInView ? 'translateY(0)' : 'translateY(20px)',
                  transition: `opacity 0.4s ease ${i * 80}ms, transform 0.4s ease ${i * 80}ms`,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', marginBottom: 16,
                    background: 'rgba(11,12,20,0.8)',
                    border: `1.5px solid rgba(154,158,232,${0.2 + i * 0.15})`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1, position: 'relative',
                    boxShadow: `0 0 20px rgba(154,158,232,${0.05 + i * 0.04})`,
                  }}>
                    <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono', color: C.text3 }}>0{step.n}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>{step.label}</span>
                  </div>
                  <p style={{ fontSize: 12, color: C.text3, lineHeight: 1.55, maxWidth: 140 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Privacy ── */}
      <section id="privacy" style={{ padding: '72px 32px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 20px',
            background: 'rgba(112,168,136,0.1)', border: '1px solid rgba(112,168,136,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.greenM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <Pill style={{ fontSize: 11, color: C.greenM, borderColor: 'rgba(112,168,136,0.3)', background: 'rgba(112,168,136,0.08)', marginBottom: 16 }}>
            Aggregated · No PII
          </Pill>
          <TwoTone a="Privacy is" b="non-negotiable." size={26} />
          <p style={{ fontSize: 13, color: C.text3, lineHeight: 1.7, marginTop: 16 }}>
            NETRA infers demographics from aggregate public signals — account metadata, posting patterns, language and timezone. No individual user is tracked, profiled or stored. All displayed data is statistically aggregated and anonymized.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 24 }}>
            {[
              { label: 'No personal data stored', icon: '✗', color: C.redM },
              { label: 'No individual tracking',  icon: '✗', color: C.redM },
              { label: 'Aggregate-only display',  icon: '✓', color: C.greenM },
            ].map(({ label, icon, color }) => (
              <GlassCard key={label} style={{ padding: '14px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, color, marginBottom: 6 }}>{icon}</p>
                <p style={{ fontSize: 11, color: C.text3, lineHeight: 1.4 }}>{label}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ padding: '88px 32px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 600px 400px at center, rgba(154,158,232,0.06) 0%, transparent 65%)' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <TwoTone a="Ready to see" b="the network?" size={34} />
          <p style={{ fontSize: 14, color: C.text3, marginTop: 12, marginBottom: 32 }}>Open the live dashboard and explore narratives, networks and intelligence in real time.</p>
          <button onClick={go} className="btn-metal" style={{ padding: '14px 36px', fontSize: 14 }}>
            Launch Dashboard
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${C.border}`, padding: '28px 32px', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(154,158,232,0.12)', border: '1px solid rgba(154,158,232,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /><line x1="12" y1="22" x2="12" y2="15.5" /><polyline points="22 8.5 12 15.5 2 8.5" />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text1 }}>NETRA</span>
            </div>
            <LabelXs>Built for Smart India Hackathon 2026</LabelXs>
            <LabelXs style={{ marginTop: 2 }}>Team Placeholder · v1.0.0-alpha</LabelXs>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[['Features', '#features'], ['How it Works', '#how-it-works'], ['GitHub', '#']].map(([l, h]) => (
              <a key={l} href={h} style={{ fontSize: 12, color: C.text3, textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = C.text2}
                onMouseLeave={e => (e.target as HTMLElement).style.color = C.text3}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .platforms-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .features-grid, .steps-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
