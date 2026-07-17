import { useState } from 'react'
import { BarChart2, Zap, TrendingUp, Bell, FileText, ArrowRight, Sparkles, Upload, Shield, Globe } from 'lucide-react'
import Logo from '../components/Logo'

const FEATURES = [
  { icon: BarChart2,  color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  title: 'Auto Dashboard',       desc: 'Instant visualizations from any dataset — zero configuration.' },
  { icon: Sparkles,   color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', title: 'Claude AI Insights',   desc: 'Executive-level recommendations powered by Anthropic Claude.' },
  { icon: TrendingUp, color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  title: '30-Day Forecasting',   desc: 'Linear regression with confidence bands and trend analysis.' },
  { icon: Bell,       color: '#f472b6', bg: 'rgba(244,114,182,0.12)', title: 'Anomaly Detection',    desc: 'Statistical outliers flagged automatically with ±2σ detection.' },
  { icon: FileText,   color: '#34d399', bg: 'rgba(52,211,153,0.12)',  title: 'PDF Export',           desc: 'One-click report download with KPIs, insights and alerts.' },
  { icon: Globe,      color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  title: 'Any Industry',         desc: 'Retail, healthcare, finance, manufacturing — all supported.' },
]

const STATS = [
  { value: '8+',    label: 'Industries Supported' },
  { value: '<5s',   label: 'Analysis Speed' },
  { value: '10MB',  label: 'Max File Size' },
  { value: '100%',  label: 'Privacy First' },
]

const INDUSTRIES = ['Retail','Restaurant','Healthcare','Finance','Manufacturing','Education','Marketing','Logistics']

export default function LandingPage({ onStart }) {
  const [hovered, setHovered] = useState(null)

  return (
    <div className="min-h-screen bg-mesh dot-grid relative overflow-hidden">

      {/* ── Orbs ── */}
      <div style={{ position:'absolute', top:'-15%', left:'-5%', width:600, height:600, background:'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'20%', right:'-10%', width:500, height:500, background:'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-10%', left:'40%', width:400, height:400, background:'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

      {/* ── Navbar ── */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, background:'rgba(3,7,18,0.8)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(99,102,241,0.1)', padding:'0 24px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <Logo size={36} />
          <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
            <span style={{ fontWeight:900, fontSize:'1.1rem', color:'white', letterSpacing:'-0.02em' }}>Decision</span>
            <span style={{ fontWeight:900, fontSize:'1.1rem', background:'linear-gradient(90deg,#6366f1,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Pilot</span>
            <span style={{ marginLeft:4, padding:'1px 5px', border:'1.5px solid #6366f1', borderRadius:5, color:'#818cf8', fontWeight:800, fontSize:'0.65rem' }}>AI</span>
          </div>
          <span className="landing-beta-badge" style={{ fontSize:'0.65rem', fontWeight:600, padding:'2px 8px', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:99, color:'#a5b4fc', letterSpacing:'0.05em' }}>BETA</span>
        </div>
        <button onClick={onStart} className="btn-primary landing-nav-cta" style={{ padding:'6px 14px', fontSize:'0.78rem' }}>
          Get Started <ArrowRight size={12} />
        </button>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'100px 24px 80px' }}>

        {/* ── Hero ── */}
        <div className="animate-fade-in" style={{ textAlign:'center', marginBottom:80 }}>

          {/* Badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:99, padding:'6px 16px', marginBottom:28 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', boxShadow:'0 0 8px #6366f1', animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:'0.8rem', fontWeight:500, color:'#a5b4fc', letterSpacing:'0.03em' }}>Powered by Claude AI · Analytics & Decision Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="landing-hero-title" style={{ fontSize:'clamp(2.8rem,7vw,5.5rem)', fontWeight:900, lineHeight:1.05, letterSpacing:'-0.04em', marginBottom:24, fontFamily:'Space Grotesk, Inter, sans-serif' }}>
            <span style={{ color:'white' }}>See. Predict.</span>
            <br />
            <span className="grad-text glow-text">Decide. Grow.</span>
          </h1>

          <p style={{ fontSize:'1.2rem', color:'#94a3b8', maxWidth:580, margin:'0 auto 36px', lineHeight:1.65, fontWeight:400 }}>
            <strong style={{ color:'#c7d2fe' }}>DecisionPilot AI</strong> turns any CSV or Excel file into an interactive dashboard, AI insights, predictive forecasts, and anomaly alerts — in under 5 seconds.
          </p>

          {/* CTAs */}
          <div className="landing-cta-btns" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', marginBottom:20 }}>
            <button onClick={onStart} className="btn-primary" style={{ fontSize:'1rem', padding:'14px 32px' }}>
              <Upload size={18} /> Upload Your Data
            </button>
            <button onClick={onStart} className="btn-secondary" style={{ fontSize:'1rem', padding:'14px 28px' }}>
              <Sparkles size={18} /> Try Sample Dataset
            </button>
          </div>
          <p style={{ color:'#475569', fontSize:'0.8rem' }}>CSV · XLS · XLSX · Max 10MB · No sign-up needed</p>
        </div>

        {/* ── Stats row ── */}
        <div className="animate-slide-up delay-100 landing-stats-grid r-grid-4" style={{ marginBottom:80 }}>
          {STATS.map(({ value, label }) => (
            <div key={label} className="glass" style={{ padding:'20px 16px', textAlign:'center' }}>
              <div style={{ fontSize:'2rem', fontWeight:800, background:'linear-gradient(135deg,#818cf8,#a78bfa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', marginBottom:4 }}>{value}</div>
              <div style={{ fontSize:'0.78rem', color:'#64748b', fontWeight:500, letterSpacing:'0.03em', textTransform:'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Feature grid ── */}
        <div className="animate-slide-up delay-200" style={{ marginBottom:80 }}>
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <h2 style={{ fontSize:'2rem', fontWeight:800, color:'white', letterSpacing:'-0.03em', marginBottom:8 }}>Everything you need</h2>
            <p style={{ color:'#64748b', fontSize:'0.95rem' }}>No BI tool experience required. Just upload and explore.</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>
            {FEATURES.map(({ icon: Icon, color, bg, title, desc }, i) => (
              <div
                key={title}
                className="glass-card-hover"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{ padding:24, position:'relative', overflow:'hidden' }}
              >
                {hovered === i && (
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg, ${color}, transparent)` }} />
                )}
                <div style={{ width:44, height:44, background:bg, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, border:`1px solid ${color}30` }}>
                  <Icon size={22} color={color} />
                </div>
                <h3 style={{ fontWeight:700, color:'white', marginBottom:8, fontSize:'0.95rem' }}>{title}</h3>
                <p style={{ color:'#64748b', fontSize:'0.85rem', lineHeight:1.6 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── How it works ── */}
        <div className="animate-slide-up delay-300" style={{ marginBottom:80 }}>
          <div style={{ textAlign:'center', marginBottom:48 }}>
            <h2 style={{ fontSize:'2rem', fontWeight:800, color:'white', letterSpacing:'-0.03em', marginBottom:8 }}>How it works</h2>
            <p style={{ color:'#64748b', fontSize:'0.95rem' }}>From raw file to actionable insights in 4 simple steps.</p>
          </div>
          <div className="landing-howto-grid r-grid-4" style={{ gap:16, position:'relative' }}>
            {/* Connector line */}
            <div className="landing-howto-line" style={{ position:'absolute', top:28, left:'12.5%', right:'12.5%', height:1, background:'linear-gradient(90deg,transparent,rgba(99,102,241,0.4),rgba(139,92,246,0.4),rgba(6,182,212,0.4),transparent)', pointerEvents:'none' }} />
            {[
              { n:'01', label:'Upload',       desc:'Drop CSV or Excel',    color:'#6366f1' },
              { n:'02', label:'Schema',        desc:'Confirm column types', color:'#8b5cf6' },
              { n:'03', label:'Analyze',       desc:'AI processes data',    color:'#06b6d4' },
              { n:'04', label:'Insights',      desc:'Explore dashboard',    color:'#34d399' },
            ].map(({ n, label, desc, color }) => (
              <div key={n} style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
                <div style={{ width:56, height:56, borderRadius:'50%', background:`linear-gradient(135deg, ${color}30, ${color}15)`, border:`2px solid ${color}50`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, position:'relative', zIndex:1, boxShadow:`0 0 24px ${color}20` }}>
                  <span style={{ fontWeight:800, fontSize:'0.9rem', color }}>{n}</span>
                </div>
                <h4 style={{ color:'white', fontWeight:700, marginBottom:4, fontSize:'0.9rem' }}>{label}</h4>
                <p style={{ color:'#475569', fontSize:'0.8rem' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Industry tags ── */}
        <div className="animate-slide-up delay-400" style={{ textAlign:'center', marginBottom:80 }}>
          <p style={{ color:'#475569', fontSize:'0.8rem', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>Works with any industry</p>
          <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8 }}>
            {INDUSTRIES.map((ind,i) => (
              <span key={ind} style={{
                padding:'6px 16px', borderRadius:99, fontSize:'0.82rem', fontWeight:500,
                background:'rgba(15,23,42,0.8)', border:'1px solid rgba(99,102,241,0.2)',
                color:'#94a3b8', transition:'all 0.2s', cursor:'default',
                animationDelay: `${i * 0.05}s`
              }}
                onMouseEnter={e => { e.target.style.borderColor='rgba(99,102,241,0.6)'; e.target.style.color='#c7d2fe'; e.target.style.background='rgba(99,102,241,0.1)' }}
                onMouseLeave={e => { e.target.style.borderColor='rgba(99,102,241,0.2)'; e.target.style.color='#94a3b8'; e.target.style.background='rgba(15,23,42,0.8)' }}
              >
                {ind}
              </span>
            ))}
          </div>
        </div>

        {/* ── CTA Banner ── */}
        <div className="grad-border animate-slide-up" style={{ padding:48, textAlign:'center' }}>
          <h2 style={{ fontSize:'2rem', fontWeight:800, color:'white', marginBottom:12, letterSpacing:'-0.03em' }}>
            Ready to unlock your data?
          </h2>
          <p style={{ color:'#64748b', marginBottom:28, fontSize:'0.95rem' }}>
            No account needed. Start analyzing in seconds.
          </p>
          <button onClick={onStart} className="btn-primary" style={{ fontSize:'1rem', padding:'14px 36px' }}>
            <Sparkles size={18} /> Start for Free
          </button>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', marginTop:48, color:'#1e293b', fontSize:'0.78rem' }}>
          Built with React · Node.js · Claude AI · Recharts
        </div>
      </div>
    </div>
  )
}
