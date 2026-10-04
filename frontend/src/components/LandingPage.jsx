import { useState, useEffect, useRef } from 'react';
import {
  Share2, MessageSquare, Video, Globe, ArrowRight, ShieldCheck,
  Activity, AlertTriangle, TrendingUp, GitMerge, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Badge, Button, GlassCard } from './ui/primitives';
import { useInView, Reveal } from './ui/useInView.jsx';
import { AnimatedLine } from './ui/AnimatedLine';

const HERO_TIMESERIES = [
  { time: '00:00', positive: 120, negative: 340 },
  { time: '04:00', positive: 180, negative: 420 },
  { time: '08:00', positive: 320, negative: 680 },
  { time: '12:00', positive: 490, negative: 890 },
  { time: '16:00', positive: 410, negative: 760 },
  { time: '20:00', positive: 290, negative: 540 }
];

export default function LandingPage({ onOpenDashboard }) {
  // Header scroll detection (>40px gains glass)
  const [isScrolled, setIsScrolled] = useState(false);

  // Hero 3D tilt state
  const heroCardRef = useRef(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, px: 0, py: 0 });

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
            {/* Ambient Pulsing Live Dot */}
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
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
                      <span className="label-xs text-[9px]">TOTAL POSTS</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value text-xl">52,841</span>
                        <span className="text-[10px] font-mono text-emerald-400">+14%</span>
                      </div>
                    </div>
                    <div className="glass p-3.5">
                      <span className="label-xs text-[9px]">AVG SENTIMENT</span>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="kpi-value text-xl">−0.14</span>
                        <span className="text-[10px] font-mono text-rose-400">Negative</span>
                      </div>
                    </div>
                  </div>

                  {/* Cropped Timeseries Chart Card */}
                  <div className="glass p-4 relative min-h-[200px]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-light text-white">
                        Narrative <span className="text-[#9A9EE8]">Volume Timeseries</span>
                      </span>
                      <div className="flex gap-1">
                        <span className="pill text-[10px] py-0.5 px-2">𝕏</span>
                        <span className="pill text-[10px] py-0.5 px-2">R</span>
                        <span className="pill pill-active text-[10px] py-0.5 px-2">Filters ▾</span>
                      </div>
                    </div>

                    {/* Front Parallax Layer Floating Overlay Card */}
                    <div
                      className="glass-float absolute bottom-3 left-3 p-2.5 rounded-lg z-20 max-w-[180px] transition-transform duration-200 ease-out shadow-2xl"
                      style={{
                        transform: `translate3d(${tilt.px * 1.5}px, ${tilt.py * 1.5}px, 20px)`
                      }}
                    >
                      <span className="label-xs text-[8px] block">Median Time between platforms</span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="font-mono text-sm font-light text-white">2.4D</span>
                        <span className="text-[9px] font-mono text-emerald-400">−0.4D</span>
                      </div>
                    </div>

                    {/* Chart Container with Draw Effect */}
                    <div className="h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={HERO_TIMESERIES}>
                          <defs>
                            <linearGradient id="heroPos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#9A9EE8" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#9A9EE8" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" horizontal={true} vertical={false} />
                          <XAxis dataKey="time" stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                          <YAxis stroke="#5B5F7A" tick={{ fill: '#5B5F7A', fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                          <Area type="monotone" dataKey="positive" stroke="#9A9EE8" fill="url(#heroPos)" strokeWidth={1.5} />
                          <Area type="monotone" dataKey="negative" stroke="#C07070" fill="none" strokeWidth={1.5} />
                        </AreaChart>
                      </ResponsiveContainer>
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
                Automatically map how narrative shifts originate on X, expand to Reddit discussions, and reach video audiences on YouTube.
              </p>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-xs font-mono text-indigo-300">
                Median gap between X and Reddit: <strong>2.4 days</strong>
              </div>
            </Reveal>

            <Reveal direction="left" duration={400} className="lg:col-span-7">
              <GlassCard className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-[#8E92B0]">
                  <span className="font-semibold text-white">Platform Trajectory</span>
                  <Badge variant="accent">Topic: Cisco Breach</Badge>
                </div>

                {/* Sequenced Nodes lit up 150ms apart */}
                <div className="grid grid-cols-3 gap-3 relative">
                  <div
                    className="p-3 rounded-lg border border-white/10 bg-white/[0.02] transition-all duration-300"
                    style={{
                      opacity: crossPlatformInView ? 1 : 0.3,
                      transform: crossPlatformInView ? 'scale(1)' : 'scale(0.95)',
                      transitionDelay: '100ms'
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 mb-1">
                      <Share2 className="w-3.5 h-3.5" /> 𝕏 Platform
                    </div>
                    <div className="text-[10px] font-mono text-[#5B5F7A]">First seen: Oct 1</div>
                    <div className="text-xs text-gray-300 mt-1">Initial exploit vector post</div>
                  </div>

                  <div
                    className="p-3 rounded-lg border border-white/10 bg-white/[0.02] transition-all duration-300"
                    style={{
                      opacity: crossPlatformInView ? 1 : 0.3,
                      transform: crossPlatformInView ? 'scale(1)' : 'scale(0.95)',
                      transitionDelay: '250ms'
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-400 mb-1">
                      <MessageSquare className="w-3.5 h-3.5" /> Reddit
                    </div>
                    <div className="text-[10px] font-mono text-[#5B5F7A]">+2.4 days</div>
                    <div className="text-xs text-gray-300 mt-1">Deep community analysis</div>
                  </div>

                  <div
                    className="p-3 rounded-lg border border-white/10 bg-white/[0.02] transition-all duration-300"
                    style={{
                      opacity: crossPlatformInView ? 1 : 0.3,
                      transform: crossPlatformInView ? 'scale(1)' : 'scale(0.95)',
                      transitionDelay: '400ms'
                    }}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-1">
                      <Video className="w-3.5 h-3.5" /> YouTube
                    </div>
                    <div className="text-[10px] font-mono text-[#5B5F7A]">+4.1 days</div>
                    <div className="text-xs text-gray-300 mt-1">Video breakdown stream</div>
                  </div>
                </div>
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
                <div className="space-y-2">
                  <div
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between transition-all duration-300"
                    style={{
                      opacity: networkInView ? 1 : 0,
                      transform: networkInView ? 'translateY(0)' : 'translateY(10px)',
                      transitionDelay: '100ms'
                    }}
                  >
                    <span className="text-xs text-gray-200 font-medium">@CyberSecAlert (Top Influencer)</span>
                    <span className="text-xs font-mono text-[#9A9EE8]">20 links</span>
                  </div>

                  <div
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between transition-all duration-300"
                    style={{
                      opacity: networkInView ? 1 : 0,
                      transform: networkInView ? 'translateY(0)' : 'translateY(10px)',
                      transitionDelay: '250ms'
                    }}
                  >
                    <span className="text-xs text-gray-200 font-medium">Cybersecurity (Bridge Topic)</span>
                    <span className="text-xs font-mono text-amber-400">3 bridges</span>
                  </div>
                </div>
              </GlassCard>
            </Reveal>

            <Reveal direction="left" duration={400} className="lg:col-span-5 order-1 lg:order-2 space-y-4">
              <span className="label-xs text-[#9A9EE8]">NETWORK TOPOLOGY</span>
              <h2 className="text-2xl font-light text-white leading-tight">
                Identify key influencers <br /><span className="text-[#9A9EE8] font-normal">and bridge entities.</span>
              </h2>
              <p className="text-sm text-[#8E92B0] leading-relaxed">
                Uncover hidden coordination vectors and central hubs with real-time force-directed topology algorithms.
              </p>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-xs font-mono text-indigo-300">
                Degree centrality & bridge node detection running in real-time
              </div>
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
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-xs font-mono text-indigo-300">
                Sub-second evaluation on all incoming posts
              </div>
            </Reveal>

            <div className="lg:col-span-7 space-y-3">
              {/* Sequential Alert Slide Up & Severity Line Draw */}
              <GlassCard
                className="p-4 border-l-4 border-l-rose-500 flex items-center justify-between transition-all duration-400"
                style={{
                  opacity: alertsInView ? 1 : 0,
                  transform: alertsInView ? 'translateY(0)' : 'translateY(16px)',
                  transitionDelay: '100ms'
                }}
              >
                <div>
                  <Badge variant="danger" className="mb-1">CRITICAL</Badge>
                  <div className="text-xs font-medium text-white">Ransomware threat vector spike detected</div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Just now</span>
              </GlassCard>

              <GlassCard
                className="p-4 border-l-4 border-l-amber-500 flex items-center justify-between transition-all duration-400"
                style={{
                  opacity: alertsInView ? 1 : 0,
                  transform: alertsInView ? 'translateY(0)' : 'translateY(16px)',
                  transitionDelay: '250ms'
                }}
              >
                <div>
                  <Badge variant="warning" className="mb-1">WARNING</Badge>
                  <div className="text-xs font-medium text-white">Unusual cross-post velocity on #CyberAttack</div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">12m ago</span>
              </GlassCard>
            </div>
          </div>

          {/* Quiet Inline Feature List */}
          <div className="pt-6 border-t border-white/5 text-center text-xs text-[#5B5F7A] font-mono">
            Also: Deep search · Narrative mutation · Demographics · Network intel · Live YouTube feed
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
                <p className="text-[11px] font-mono text-[#5B5F7A]">X, Reddit, YouTube, Telegram</p>
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
                <p>All network intelligence algorithms operate solely on public open-source data streams.</p>
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
