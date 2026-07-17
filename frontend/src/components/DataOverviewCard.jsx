import { useState, useEffect } from 'react'
import { Database, TrendingUp, AlertTriangle, BarChart2, Calendar, Layers, Zap, Activity, ChevronDown, Sparkles, Shield } from 'lucide-react'

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return 'N/A'
  const num = Number(n)
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}
const pct = (part, total) => total > 0 ? ((part / total) * 100).toFixed(1) + '%' : '0%'

// Animated counter
function Counter({ value, duration = 1200 }) {
  const [display, setDisplay] = useState(0)
  const isNumber = typeof value === 'number' && !isNaN(value)
  useEffect(() => {
    if (!isNumber) return
    let start = 0
    const steps = 40
    const increment = value / steps
    const interval = duration / steps
    const timer = setInterval(() => {
      start += increment
      if (start >= value) { setDisplay(value); clearInterval(timer) }
      else setDisplay(Math.floor(start))
    }, interval)
    return () => clearInterval(timer)
  }, [value])
  if (!isNumber) return <span>{value}</span>
  return <span>{display >= 1000 ? display.toLocaleString() : display}</span>
}

function StatCard({ icon: Icon, label, value, color, delay = 0, suffix = '' }) {
  return (
    <div className="animate-slide-up" style={{ animationDelay: `${delay}ms`, flex: 1, minWidth: 130,
      background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`,
      border: `1px solid ${color}35`, borderRadius: 20, padding: '18px 16px',
      position: 'relative', overflow: 'hidden', cursor: 'default',
      transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 16px 40px ${color}25` }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      {/* Glow blob */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, background: `radial-gradient(circle, ${color}30, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg,${color}40,${color}20)`, border: `1px solid ${color}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, boxShadow: `0 4px 16px ${color}30` }}>
        <Icon size={17} color={color} />
      </div>
      <p style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</p>
      <p style={{ color: 'white', fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
        {typeof value === 'number' ? <Counter value={value} /> : value}{suffix}
      </p>
    </div>
  )
}

function GlowBar({ label, value, total, color, rank, delay = 0 }) {
  const [width, setWidth] = useState(0)
  useEffect(() => { setTimeout(() => setWidth(total > 0 ? Math.max(6, (value / total) * 100) : 6), 200 + delay) }, [value, total])
  return (
    <div className="animate-fade-in" style={{ marginBottom: 14, animationDelay: `${delay}ms` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 7, background: `linear-gradient(135deg,${color},${color}80)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: 800, color: 'white', boxShadow: `0 2px 8px ${color}50`, flexShrink: 0 }}>{rank}</div>
          <span style={{ color: '#e2e8f0', fontSize: '0.83rem', fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.88rem' }}>{fmt(value)}</span>
          <span style={{ padding: '2px 7px', background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 99, color, fontSize: '0.65rem', fontWeight: 700 }}>{pct(value, total)}</span>
        </div>
      </div>
      <div style={{ height: 8, background: 'rgba(15,23,42,0.8)', borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(51,65,85,0.3)' }}>
        <div style={{ height: '100%', width: `${width}%`, background: `linear-gradient(90deg,${color},${color}aa)`, borderRadius: 99, transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)', boxShadow: `0 0 12px ${color}60` }} />
      </div>
    </div>
  )
}

function HealthRing({ score }) {
  const [animated, setAnimated] = useState(0)
  useEffect(() => { setTimeout(() => setAnimated(score), 400) }, [score])
  const radius = 44, stroke = 8
  const circ = 2 * Math.PI * radius
  const offset = circ - (animated / 100) * circ
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#6366f1' : score >= 40 ? '#fbbf24' : '#f87171'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Poor'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 110, height: 110 }}>
        {/* Glow behind ring */}
        <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: `radial-gradient(circle,${color}20,transparent 70%)` }} />
        <svg width={110} height={110} style={{ transform: 'rotate(-90deg)', position: 'absolute', top: 0, left: 0 }}>
          <circle cx={55} cy={55} r={radius} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={stroke} />
          <circle cx={55} cy={55} r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 8px ${color})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1.5rem', lineHeight: 1, letterSpacing: '-0.03em' }}>{score}</span>
          <span style={{ color: '#475569', fontSize: '0.6rem', fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <div style={{ marginTop: 10, padding: '4px 14px', background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 99, boxShadow: `0 0 16px ${color}30` }}>
        <span style={{ color, fontWeight: 700, fontSize: '0.75rem' }}>{label}</span>
      </div>
    </div>
  )
}

export default function DataOverviewCard({ analysisData, insights, config, uploadData }) {
  const [expanded, setExpanded] = useState(true)
  const { aggregateStats, kpis, anomalies = [], dataQualityNotes = [] } = analysisData
  const { rowCount = 0, columnCount = 0, columns = [], topCategories = [], dateRange } = aggregateStats || {}
  const c = config?.theme?.primary || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'

  const numCols  = columns.filter(col => col.type === 'numeric')
  const catCols  = columns.filter(col => col.type === 'categorical')
  const dateCols = columns.filter(col => col.type === 'date')
  const metrics  = Object.entries(kpis || {}).filter(([k, v]) => v && typeof v === 'object' && k !== 'totalRows' && k !== 'dateRange' && k !== 'dateDays')

  const healthScore = Math.min(100, Math.max(0,
    60 + (rowCount > 1000 ? 10 : rowCount > 100 ? 5 : 0)
    + (numCols.length > 0 ? 5 : 0) + (catCols.length > 0 ? 5 : 0)
    + (dateCols.length > 0 ? 10 : 0) + (dataQualityNotes.length === 0 ? 5 : 0)
    + (anomalies.length === 0 ? 5 : anomalies.length > 5 ? -10 : 0)
  ))

  const catTotal = topCategories.reduce((s, cat) => s + cat.value, 0)
  const catColors = [c, c2, '#34d399', '#f472b6', '#fbbf24']

  return (
    <div style={{ borderRadius: 28, overflow: 'hidden', marginBottom: 28, position: 'relative',
      background: 'linear-gradient(135deg, rgba(10,14,28,0.97) 0%, rgba(15,20,40,0.97) 100%)',
      boxShadow: `0 0 0 1px ${c}25, 0 24px 80px ${c}20, 0 8px 32px rgba(0,0,0,0.5)`,
    }}>

      {/* Ambient background orbs */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 300, height: 300, background: `radial-gradient(circle, ${c}18 0%, transparent 65%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -40, left: -40, width: 220, height: 220, background: `radial-gradient(circle, ${c2}12 0%, transparent 65%)`, pointerEvents: 'none' }} />

      {/* ── Header ── */}
      <div onClick={() => setExpanded(e => !e)} style={{ position: 'relative', zIndex: 1, cursor: 'pointer',
        padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${c}18 0%, ${c2}08 100%)`,
        borderBottom: expanded ? `1px solid ${c}20` : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Animated icon */}
          <div style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(135deg,${c},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 28px ${c}50, 0 0 0 1px ${c}40`, flexShrink: 0 }}>
            <Activity size={22} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>Data Overview</h2>
              <span style={{ padding: '3px 10px', background: `${c}20`, border: `1px solid ${c}40`, borderRadius: 99, color: c, fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.06em' }}>{config?.emoji} {config?.label?.replace(' Analytics','').replace(' Dashboard','') || 'General'}</span>
              {anomalies.length > 0
                ? <span style={{ padding: '3px 10px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 99, color: '#f87171', fontSize: '0.65rem', fontWeight: 700 }}>⚠ {anomalies.length} Alerts</span>
                : <span style={{ padding: '3px 10px', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 99, color: '#34d399', fontSize: '0.65rem', fontWeight: 700 }}>✓ Clean</span>
              }
            </div>
            <p style={{ color: '#475569', fontSize: '0.75rem' }}>{uploadData?.fileName} · {rowCount.toLocaleString()} records · Complete dataset analysis</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 10, color: '#64748b', fontSize: '0.75rem', fontWeight: 500, userSelect: 'none' }}>
          <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} />
          {expanded ? 'Collapse' : 'Expand'}
        </div>
      </div>

      {expanded && (
        <div style={{ position: 'relative', zIndex: 1, padding: '28px' }}>

          {/* ── Stat Cards Row ── */}
          <div className="ov-stat-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
            <StatCard icon={Database}      label="Total Records"  value={rowCount}         color={c}        delay={0} />
            <StatCard icon={Layers}        label="Columns"        value={columnCount}      color={c2}       delay={60} />
            <StatCard icon={BarChart2}     label="Numeric"        value={numCols.length}   color="#34d399"  delay={120} />
            <StatCard icon={TrendingUp}    label="Categories"     value={catCols.length}   color="#f472b6"  delay={180} />
            {dateRange && <StatCard icon={Calendar} label="Days Covered"
              value={Math.round((new Date(dateRange.to) - new Date(dateRange.from)) / 86400000)}
              color="#38bdf8" delay={240} suffix="d" />}
            <StatCard icon={AlertTriangle} label="Anomalies" value={anomalies.length} color={anomalies.length > 0 ? '#f87171' : '#34d399'} delay={300} />
          </div>

          {/* ── Middle section ── */}
          <div className="ov-middle-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr', gap: 20, marginBottom: 20 }}>

            {/* Health Ring */}
            <div className="ov-health" style={{ background: 'rgba(8,12,28,0.8)', border: `1px solid ${c}20`, borderRadius: 22, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, boxShadow: `inset 0 1px 0 ${c}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Shield size={12} color={c} />
                <span style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Health</span>
              </div>
              <HealthRing score={healthScore} />
            </div>

            {/* Metrics panel */}
            <div style={{ background: 'rgba(8,12,28,0.8)', border: `1px solid ${c}20`, borderRadius: 22, padding: '22px 22px', boxShadow: `inset 0 1px 0 ${c}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: `${c}25`, border: `1px solid ${c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={13} color={c} />
                </div>
                <span style={{ color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>Key Metrics</span>
              </div>
              {metrics.length === 0
                ? <p style={{ color: '#334155', fontSize: '0.82rem' }}>No numeric columns.</p>
                : metrics.slice(0, 4).map(([key, val], i) => {
                  // Smart label: avoid technical jargon
                  const isAvg = /rate|ratio|pct|percent|score|index|avg|average|stay|days|age|price|unit/i.test(key)
                  const displayVal = isAvg ? val.avg : val.total
                  const displayLabel = isAvg ? 'Average' : 'Total'
                  return (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < Math.min(metrics.length,4)-1 ? '1px solid rgba(30,41,59,0.8)' : 'none' }}>
                      <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 500, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Avg: <b style={{ color: '#a5b4fc' }}>{fmt(val.avg)}</b></span>
                        <span style={{ fontSize: '0.7rem', color: '#475569' }}>Best: <b style={{ color: '#34d399' }}>{fmt(val.max)}</b></span>
                        <span style={{ padding: '3px 10px', background: `${c}20`, border: `1px solid ${c}35`, borderRadius: 8, color: 'white', fontWeight: 700, fontSize: '0.82rem', boxShadow: `0 0 12px ${c}20` }}>{displayLabel}: {fmt(displayVal)}</span>
                      </div>
                    </div>
                  )
                })
              }
            </div>

            {/* Top Categories */}
            <div style={{ background: 'rgba(8,12,28,0.8)', border: `1px solid ${c2}20`, borderRadius: 22, padding: '22px 22px', boxShadow: `inset 0 1px 0 ${c2}15` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: `${c2}25`, border: `1px solid ${c2}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BarChart2 size={13} color={c2} />
                </div>
                <span style={{ color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>Top Categories</span>
              </div>
              {topCategories.length === 0
                ? <p style={{ color: '#334155', fontSize: '0.82rem' }}>No categorical columns.</p>
                : topCategories.slice(0,5).map((cat, i) => (
                    <GlowBar key={cat.name} rank={i+1} label={cat.name} value={cat.value} total={catTotal} color={catColors[i % catColors.length]} delay={i * 100} />
                  ))
              }
            </div>
          </div>

          {/* ── Bottom Row: Column Map + AI ── */}
          <div className="ov-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: anomalies.length > 0 ? 20 : 0 }}>

            {/* Column Map */}
            <div style={{ background: 'rgba(8,12,28,0.8)', border: '1px solid rgba(51,65,85,0.35)', borderRadius: 22, padding: '22px 22px' }}>
              <p style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Column Map</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { type: 'numeric',     cols: numCols,  color: '#34d399', emoji: '📊', label: 'Numeric' },
                  { type: 'categorical', cols: catCols,  color: '#a78bfa', emoji: '🏷️', label: 'Categorical' },
                  { type: 'date',        cols: dateCols, color: '#38bdf8', emoji: '📅', label: 'Date / Time' },
                ].filter(g => g.cols.length > 0).map(({ type, cols, color, emoji, label }) => (
                  <div key={type} style={{ padding: '10px 14px', background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 14, transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.borderColor = `${color}45` }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${color}08`; e.currentTarget.style.borderColor = `${color}22` }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '0.9rem' }}>{emoji}</span>
                      <span style={{ color, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                      <span style={{ marginLeft: 'auto', padding: '1px 7px', background: `${color}25`, borderRadius: 99, color, fontSize: '0.65rem', fontWeight: 700 }}>{cols.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {cols.map(col => (
                        <span key={col.name} style={{ padding: '3px 9px', background: `${color}12`, border: `1px solid ${color}25`, borderRadius: 7, color: '#94a3b8', fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 500 }}>{col.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Highlights */}
            <div style={{ background: 'rgba(8,12,28,0.8)', border: `1px solid ${insights?.source === 'claude' ? 'rgba(167,139,250,0.3)' : 'rgba(245,158,11,0.25)'}`, borderRadius: 22, padding: '22px 22px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, background: `radial-gradient(circle, ${insights?.source === 'claude' ? 'rgba(167,139,250,0.12)' : 'rgba(245,158,11,0.1)'}, transparent 70%)`, pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: insights?.source === 'claude' ? 'rgba(167,139,250,0.2)' : 'rgba(245,158,11,0.15)', border: `1px solid ${insights?.source === 'claude' ? 'rgba(167,139,250,0.4)' : 'rgba(245,158,11,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={13} color={insights?.source === 'claude' ? '#a78bfa' : '#fbbf24'} />
                </div>
                <span style={{ color: 'white', fontSize: '0.82rem', fontWeight: 700 }}>AI Highlights</span>
                {insights?.source && (
                  <span style={{ marginLeft: 'auto', padding: '2px 9px', background: insights.source === 'claude' ? 'rgba(167,139,250,0.15)' : 'rgba(245,158,11,0.12)', border: `1px solid ${insights.source === 'claude' ? 'rgba(167,139,250,0.35)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 99, color: insights.source === 'claude' ? '#c4b5fd' : '#fcd34d', fontSize: '0.62rem', fontWeight: 700 }}>
                    {insights.source === 'claude' ? '✨ Claude AI' : '⚡ Auto-generated'}
                  </span>
                )}
              </div>
              {!insights?.insights?.length
                ? <div style={{ padding: '16px', background: 'rgba(51,65,85,0.2)', borderRadius: 12, textAlign: 'center' }}>
                    <p style={{ color: '#475569', fontSize: '0.8rem' }}>Add ANTHROPIC_API_KEY to enable Claude AI insights</p>
                  </div>
                : insights.insights.slice(0, 3).map((ins, i) => (
                    <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms`, display: 'flex', gap: 10, marginBottom: 10, padding: '10px 12px',
                      background: `linear-gradient(135deg,${c}10,${c}05)`, border: `1px solid ${c}20`, borderRadius: 12, transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = `linear-gradient(135deg,${c}18,${c}08)`; e.currentTarget.style.borderColor = `${c}40` }}
                      onMouseLeave={e => { e.currentTarget.style.background = `linear-gradient(135deg,${c}10,${c}05)`; e.currentTarget.style.borderColor = `${c}20` }}
                    >
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: `${c}30`, border: `1px solid ${c}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800, fontSize: '0.65rem', color: c }}>0{i+1}</div>
                      <p style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.6 }}>{ins}</p>
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── Unusual Values Alert ── */}
          {anomalies.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(251,191,36,0.04))', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 18, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 9, background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>
                  ⚠️
                </div>
                <div>
                  <p style={{ color: '#fcd34d', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                    {anomalies.length} unusual value{anomalies.length > 1 ? 's' : ''} found in your data
                  </p>
                  <p style={{ color: '#92400e', fontSize: '0.72rem', margin: 0 }}>These may be data entry errors or genuinely exceptional records — worth reviewing</p>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {anomalies.slice(0, 6).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 10 }}>
                    <span style={{ fontSize: '0.8rem' }}>{a.direction === 'spike' ? '📈' : '📉'}</span>
                    <div>
                      <span style={{ color: '#fcd34d', fontSize: '0.78rem', fontWeight: 700 }}>
                        {a.direction === 'spike' ? 'Unusually high' : 'Unusually low'} {a.column}
                      </span>
                      {a.date && <span style={{ color: '#92400e', fontSize: '0.68rem', marginLeft: 6 }}>on {a.date}</span>}
                      <div style={{ color: '#78716c', fontSize: '0.65rem', marginTop: 1 }}>
                        Value: {fmt(a.value)} — about {a.direction === 'spike' ? 'much higher' : 'much lower'} than usual ({fmt(a.mean)} typically)
                      </div>
                    </div>
                  </div>
                ))}
                {anomalies.length > 6 && <span style={{ padding: '6px 12px', color: '#92400e', fontSize: '0.72rem' }}>+{anomalies.length - 6} more</span>}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
