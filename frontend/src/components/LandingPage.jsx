import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ArrowRight, ShieldCheck, Activity, TrendingUp, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Badge, Button, GlassCard } from './ui/primitives';
import { useInView, Reveal } from './ui/useInView.jsx';
import { AnimatedLine } from './ui/AnimatedLine';
import { API_URL } from '../config';

export default function LandingPage({ onOpenDashboard }) {
  // Header scroll detection (>40px gains glass)
  const [isScrolled, setIsScrolled] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);
  const [summaryState, setSummaryState] = useState('loading');

  // Hero 3D tilt state
  const heroCardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 0, py: 0 });

  useEffect(() => {
    axios.get(`${API_URL}/live/summary`)
      .then(result => { setLiveSummary(result.data || null); setSummaryState('ready'); })
      .catch(() => setSummaryState('error'));
  }, []);

  const heroSeries = (liveSummary?.ingest_rate_per_minute || []).map(point => ({
    time: point.minute ? new Date(point.minute).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    count: point.count || 0,
  }));
  const heroHasVolume = heroSeries.some(point => point.count > 0);
  const heroTotal = liveSummary?.totals_by_source_mode
    ? Object.values(liveSummary.totals_by_source_mode).reduce((sum, count) => sum + (Number(count) || 0), 0)
    : null;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleHeroMouseMove = (e) => {
    if (!heroCardRef.current) return;
    const rect = heroCardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({
      rx: -dy * 3, // max 3 deg
      ry: dx * 3,
      px: dx * 6, // max 6px parallax
      py: dy * 6
    });
  };

  const handleHeroMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, px: 0, py: 0 });
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // In-view hooks for specific scroll sequences
  const [crossPlatformRef, crossPlatformInView] = useInView({ threshold: 0.2 });
  const [networkRef, networkInView] = useInView({ threshold: 0.2 });
  const [alertsRef, alertsInView] = useInView({ threshold: 0.2 });
  const [pipelineRef, pipelineInView] = useInView({ threshold: 0.3 });
  const [privacyRef, privacyInView] = useInView({ threshold: 0.3 });

  return (
    <div className="min-h-screen bg-[#08091A] text-[#F2F3FA] selection:bg-[#9A9EE8]/30 selection:text-white font-sans overflow-x-hidden relative">

      {/* Background Layering & Ambient Motion Sweep */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft, low-opacity periwinkle and silver light shapes drifting 20-30px */}
        <div className="absolute -top-[100px] right-[5%] w-[800px] h-[600px] rounded-full bg-[#9A9EE8]/[0.08] blur-[140px] bg-sweep" />
        <div className="absolute top-[40%] -left-[100px] w-[600px] h-[500px] rounded-full bg-[#9BA0B8]/[0.06] blur-[120px] bg-sweep" style={{ animationDelay: '-10s' }} />
        <div className="absolute bottom-[5%] right-[10%] w-[700px] h-[500px] rounded-full bg-[#7B7FC4]/[0.07] blur-[130px] bg-sweep" style={{ animationDelay: '-5s' }} />
      </div>

      {/* SECTION 1: HEADER */}
      <header
        className={`w-full h-16 fixed top-0 z-50 transition-all duration-200 px-6 flex items-center justify-between ${
          isScrolled
            ? 'bg-[#08091A]/85 backdrop-blur-md border-b border-white/10 shadow-lg'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{
          transition: 'background-color 200ms ease, border-color 200ms ease, backdrop-filter 200ms ease'
        }}
      >
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#E6E8F2] via-[#9BA0B8] to-[#5A5E78] text-[#08091A] font-extrabold text-xs flex items-center justify-center shadow-md">
            N
          </div>
          <span className="font-bold text-sm tracking-wider text-white flex items-center gap-2">
            NETRA
          </span>
        </div>

        {/* 3 Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-xs text-[#8E92B0] font-medium">
          <button onClick={() => scrollToSection('product')} className="link-underline hover:text-white transition-colors">
            Product
          </button>
          <button onClick={() => scrollToSection('how-it-works')} className="link-underline hover:text-white transition-colors">
            How it works
          </button>
          <button onClick={() => scrollToSection('privacy')} className="link-underline hover:text-white transition-colors">
            Privacy
          </button>
        </nav>

        {/* Action Button */}
        <Button variant="primary" onClick={onOpenDashboard} className="btn-metal text-xs">
          Open dashboard <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </header>

      {/* MAIN LANDING BODY */}
      <main className="max-w-[1200px] mx-auto px-6 space-y-28 pt-24 pb-24 relative z-10">

        {/* SECTION 2: HERO (Asymmetric, left-aligned) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pt-4">

          {/* Left Column (5/12) - Staggered Load Animations */}
          <div className="lg:col-span-5 space-y-6">
            <Reveal delay={0} duration={400} direction="up">
              <span className="label-xs text-[#9A9EE8]">SOCIAL MEDIA INTELLIGENCE</span>
            </Reveal>

            <Reveal delay={80} duration={400} direction="up">
              <h1 className="text-4xl lg:text-5xl font-light text-white tracking-tight leading-[1.15]">
                Track how a narrative <span className="text-[#9A9EE8] font-normal">moves across platforms.</span>
              </h1>
            </Reveal>

            <Reveal delay={160} duration={400} direction="up">
              <p className="text-sm text-[#8E92B0] leading-relaxed max-w-lg">
                NETRA ingests, analyzes, and correlates public threat signals across social channels into actionable network graph intelligence.
              </p>
            </Reveal>

            <Reveal delay={240} duration={400} direction="up">
              <div className="flex items-center gap-4 pt-2">
                <Button variant="primary" onClick={onOpenDashboard} className="btn-metal text-xs">
                  Open dashboard <ArrowRight className="w-3.5 h-3.5" />
                </Button>
                <button
                  onClick={() => scrollToSection('how-it-works')}
                  className="link-underline text-xs text-[#8E92B0] hover:text-white font-medium transition-colors"
                >
                  How it works →
                </button>
              </div>
            </Reveal>
          </div>

          {/* Right Column (7/12): 3D Tilted Hero Preview with Parallax Layers */}
          <div className="lg:col-span-7 relative">
            <Reveal delay={200} duration={600} direction="left">
              <div
                ref={heroCardRef}
                onMouseMove={handleHeroMouseMove}
                onMouseLeave={handleHeroMouseLeave}
                className="perspective-1000 transition-transform duration-300 ease-out"
                style={{
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Back Layer Glass Card */}
                <GlassCard className="p-5 space-y-4 [mask-image:linear-gradient(to_bottom,black_85%,transparent_100%)]">
                  {/* Cropped KPI Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass p-3.5">
                      <span className="label-xs">Collected posts</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value text-xl">{summaryState === 'loading' ? '…' : summaryState === 'error' ? '—' : (heroTotal ?? 0).toLocaleString()}</span>
                        <span className="text-sm font-mono text-slate-400">{summaryState === 'error' ? 'API down' : 'from API'}</span>
                      </div>
                    </div>
                    <div className="glass p-3.5">
                      <span className="label-xs">Newest item</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value text-xl">{summaryState !== 'ready' ? '—' : liveSummary?.newest_item_age_seconds != null ? `${Math.round(liveSummary.newest_item_age_seconds)}s` : 'none'}</span>
                        <span className="text-sm font-mono text-slate-400">age</span>
                      </div>
                    </div>
                  </div>

                  {/* Cropped Timeseries Chart Card */}
                  <div className="glass p-4 relative min-h-[200px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-light text-white">
                        Collected <span className="text-[#9A9EE8]">volume, last hour</span>
                      </span>
                      <span className="pill">From /live/summary</span>
                    </div>

                    {/* Front Parallax Layer Floating Overlay Card */}
                    <div className="h-[140px] w-full">
                      {summaryState === 'error' ? (
                        <p className="text-sm text-amber-200 h-full flex items-center">Can't reach the NETRA API. The chart stays empty until it responds.</p>
                      ) : !heroHasVolume ? (
                        <p className="text-sm text-slate-300 h-full flex items-center">{summaryState === 'loading' ? 'Loading collected volume.' : 'No collected volume in the last hour.'}</p>
                      ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={heroSeries}>
                          <defs>
                            <linearGradient id="heroPos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9A9EE8" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#9A9EE8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                          <XAxis dataKey="time" stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 13, fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 13, fontFamily: 'JetBrains Mono' }} />
                          <Area type="monotone" dataKey="count" stroke="#9A9EE8" fill="url(#heroPos)" strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </div>
            </Reveal>
          </div>
        </section>

        {/* SECTION 3: PRODUCT IN USE (3 Alternating Rows with Slide-in & Sequenced Nodes) */}
        <section id="product" className="space-y-24 pt-8">

          {/* Row A: Cross-platform spread */}
          <div ref={crossPlatformRef} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <Reveal direction="right" duration={400} className="lg:col-span-5 space-y-4">
              <span className="label-xs text-[#9A9EE8]">CROSS-PLATFORM SPREAD</span>
              <h2 className="text-2xl font-light text-white leading-tight">
                Trace propagation <br /><span className="text-[#9A9EE8] font-normal">across social networks.</span>
              </h2>
              <p className="text-sm text-[#8E92B0] leading-relaxed">
                The dashboard maps a story only across sources the API reports as enabled. Disabled sources stay in a collapsed list and are not shown as active here.
              </p>
            </Reveal>

            <Reveal direction="left" duration={400} className="lg:col-span-7">
              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between text-sm text-[#8E92B0]">
                  <span className="font-semibold text-white">What this page does not invent</span>
                </div>
                <p className="text-sm text-slate-300">Platform order, gaps, and example topics are not shown here. Open the dashboard cross-platform view to query collected posts.</p>
              </GlassCard>
            </Reveal>
          </div>

          {/* Row B: Network Structure (Alternating - Component Left) */}
          <div ref={networkRef} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <Reveal direction="right" duration={400} className="lg:col-span-7 order-2 lg:order-1">
              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Topology Centrality</span>
                  <Badge variant="neutral">Degree Centrality</Badge>
                </div>

                {/* Staggered Outward Node Fade */}
                <p className="text-sm text-slate-300" style={{ opacity: networkInView ? 1 : 0.4 }}>
                  Influencer and bridge counts are calculated in the dashboard from the graph API. This preview does not list entities.
                </p>
              </GlassCard>
            </Reveal>

            <Reveal direction="left" duration={400} className="lg:col-span-5 order-1 lg:order-2 space-y-4">
              <span className="label-xs text-[#9A9EE8]">NETWORK TOPOLOGY</span>
              <h2 className="text-2xl font-light text-white leading-tight">
                Identify key influencers <br /><span className="text-[#9A9EE8] font-normal">and bridge entities.</span>
              </h2>
              <p className="text-sm text-[#8E92B0] leading-relaxed">
                The network screen ranks entities that exist in the collected graph. It does not claim a live ranking on this page.
              </p>
            </Reveal>
          </div>

          {/* Row C: Threat Alerts */}
          <div ref={alertsRef} className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <Reveal direction="right" duration={400} className="lg:col-span-5 space-y-4">
              <span className="label-xs text-[#9A9EE8]">THREAT ALERTS</span>
              <h2 className="text-2xl font-light text-white leading-tight">
                Instant notifications <br /><span className="text-[#9A9EE8] font-normal">on narrative spikes.</span>
              </h2>
              <p className="text-sm text-[#8E92B0] leading-relaxed">
                Receive automated alerts when sentiment drops sharply or keyword velocity exceeds safety thresholds.
              </p>
              <p className="text-sm text-slate-400">Alerts listed in the dashboard come from the alerts API. None are previewed here.</p>
            </Reveal>

            <div className="lg:col-span-7">
              <GlassCard className="p-4" style={{ opacity: alertsInView ? 1 : 0.4 }}>
                <p className="text-sm text-slate-300">Open the alerts screen to see whatever the API currently returns. This landing page does not display sample alerts.</p>
              </GlassCard>
            </div>
          </div>

          {/* Quiet Inline Feature List */}
          <div className="pt-6 border-t border-white/5 text-center text-xs text-[#5B5F7A] font-mono">
            Also: Deep search · Narrative mutation · Demographics · Network intel · YouTube feed
          </div>
        </section>

        {/* SECTION 4: HOW IT WORKS (One horizontal pipeline with 1s line draw & node pulses) */}
        <section id="how-it-works" className="space-y-8 pt-8">
          <div className="text-center space-y-2">
            <span className="label-xs text-[#9A9EE8]">ARCHITECTURE PIPELINE</span>
            <h2 className="text-2xl font-light text-white">How it works</h2>
          </div>

          <GlassCard className="p-8" ref={pipelineRef}>
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Connector Line Drawing Across */}
              <div
                className="hidden md:block absolute top-1/2 left-8 right-8 h-0.5 bg-gradient-to-r from-indigo-500/20 via-indigo-400/50 to-indigo-500/20 -translate-y-1/2 z-0 transition-all duration-1000 ease-out origin-left"
                style={{
                  transform: pipelineInView ? 'scaleX(1)' : 'scaleX(0)'
                }}
              />

              {/* Node 1 */}
              <div
                className="relative z-10 flex flex-col items-center text-center space-y-2 max-w-[200px] transition-all duration-300"
                style={{
                  opacity: pipelineInView ? 1 : 0,
                  transform: pipelineInView ? 'scale(1)' : 'scale(0.8)',
                  transitionDelay: '150ms'
                }}
              >
                <div className="w-10 h-10 rounded-full bg-[#08091A] border-2 border-[#9A9EE8] flex items-center justify-center text-xs font-mono text-white shadow-lg">
                  01
                </div>
                <h3 className="text-xs font-semibold text-white">Ingest</h3>
                <p className="text-sm font-mono text-[#5B5F7A]">Collectors reported by the API</p>
              </div>

              {/* Node 2 */}
              <div
                className="relative z-10 flex flex-col items-center text-center space-y-2 max-w-[200px] transition-all duration-300"
                style={{
                  opacity: pipelineInView ? 1 : 0,
                  transform: pipelineInView ? 'scale(1)' : 'scale(0.8)',
                  transitionDelay: '400ms'
                }}
              >
                <div className="w-10 h-10 rounded-full bg-[#08091A] border-2 border-[#9A9EE8] flex items-center justify-center text-xs font-mono text-white shadow-lg">
                  02
                </div>
                <h3 className="text-xs font-semibold text-white">Analyze</h3>
                <p className="text-[11px] font-mono text-[#5B5F7A]">Entities + sentiment</p>
              </div>

              {/* Node 3 */}
              <div
                className="relative z-10 flex flex-col items-center text-center space-y-2 max-w-[200px] transition-all duration-300"
                style={{
                  opacity: pipelineInView ? 1 : 0,
                  transform: pipelineInView ? 'scale(1)' : 'scale(0.8)',
                  transitionDelay: '650ms'
                }}
              >
                <div className="w-10 h-10 rounded-full bg-[#08091A] border-2 border-[#9A9EE8] flex items-center justify-center text-xs font-mono text-white shadow-lg">
                  03
                </div>
                <h3 className="text-xs font-semibold text-white">Connect</h3>
                <p className="text-[11px] font-mono text-[#5B5F7A]">Graph relationships</p>
              </div>

              {/* Node 4 */}
              <div
                className="relative z-10 flex flex-col items-center text-center space-y-2 max-w-[200px] transition-all duration-300"
                style={{
                  opacity: pipelineInView ? 1 : 0,
                  transform: pipelineInView ? 'scale(1)' : 'scale(0.8)',
                  transitionDelay: '900ms'
                }}
              >
                <div className="w-10 h-10 rounded-full bg-[#08091A] border-2 border-[#9A9EE8] flex items-center justify-center text-xs font-mono text-white shadow-lg">
                  04
                </div>
                <h3 className="text-xs font-semibold text-white">Alert</h3>
                <p className="text-[11px] font-mono text-[#5B5F7A]">Volume, sentiment, rules</p>
              </div>
            </div>
          </GlassCard>
        </section>

        {/* SECTION 5: PRIVACY (One quiet glass panel with single shimmer pass) */}
        <section id="privacy" className="pt-8" ref={privacyRef}>
          <GlassCard className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-5 space-y-2">
                <Badge
                  variant="success"
                  className={`mb-2 shimmer-pill ${privacyInView ? 'is-shimmering' : ''}`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" /> Aggregated • No PII
                </Badge>
                <h2 className="text-2xl font-light text-white">
                  Aggregated, <span className="text-[#9A9EE8] font-normal">never personal.</span>
                </h2>
              </div>

              <div className="md:col-span-7 space-y-2 text-xs text-[#8E92B0] leading-relaxed">
                <p>Audience demographics and sentiment metrics are derived using privacy-safe statistical inference.</p>
                <p>No personally identifiable information (PII) is stored, tracked, or displayed anywhere in the platform.</p>
                <p>Counts and charts on this page come from the live summary endpoint, or they stay empty when that endpoint has nothing to report.</p>
              </div>
            </div>
          </GlassCard>
        </section>
      </main>

      {/* SECTION 6: FOOTER */}
      <footer className="w-full border-t border-white/10 bg-[#08091A] py-6 px-6 relative z-10">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5B5F7A]">
          <div className="flex items-center gap-2 font-semibold text-white">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#E6E8F2] to-[#5A5E78] text-[#08091A] font-extrabold text-[10px] flex items-center justify-center">
              N
            </div>
            <span>NETRA</span>
          </div>

          <div>Built for Smart India Hackathon 2026</div>

          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-underline hover:text-white transition-colors"
          >
            GitHub Repository →
          </a>
        </div>
      </footer>
    </div>
  );
}
