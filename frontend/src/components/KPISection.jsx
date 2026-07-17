import { TrendingUp, Hash, Calendar, Target, DollarSign, Activity } from 'lucide-react'

function fmt(n) {
  if (n === undefined || n === null) return '—'
  if (typeof n !== 'number') return String(n)
  if (Math.abs(n) >= 1_000_000_000) return (n/1_000_000_000).toFixed(1)+'B'
  if (Math.abs(n) >= 1_000_000)     return (n/1_000_000).toFixed(2)+'M'
  if (Math.abs(n) >= 1_000)         return (n/1_000).toFixed(1)+'K'
  return n.toLocaleString(undefined, { maximumFractionDigits:2 })
}

const CARD_THEMES = [
  { icon:TrendingUp, color:'#6366f1', grad:'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(99,102,241,0.05))' },
  { icon:Activity,   color:'#34d399', grad:'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(52,211,153,0.05))' },
  { icon:Target,     color:'#a78bfa', grad:'linear-gradient(135deg,rgba(167,139,250,0.2),rgba(167,139,250,0.05))' },
  { icon:DollarSign, color:'#f472b6', grad:'linear-gradient(135deg,rgba(244,114,182,0.2),rgba(244,114,182,0.05))' },
]

export default function KPISection({ kpis }) {
  if (!kpis) return null
  const { totalRows, dateRange, dateDays, ...metrics } = kpis
  const metricEntries = Object.entries(metrics).filter(([,v]) => typeof v === 'object' && v !== null && !Array.isArray(v))

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:14, marginBottom:24 }}>

      {/* Records card */}
      <div className="kpi-card" style={{ background:'linear-gradient(135deg,rgba(30,41,59,0.7),rgba(15,23,42,0.5))' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{ width:28, height:28, background:'rgba(251,191,36,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Hash size={14} color="#fbbf24" />
          </div>
          <span style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Records</span>
        </div>
        <div style={{ fontSize:'1.9rem', fontWeight:800, color:'white', lineHeight:1, letterSpacing:'-0.02em' }}>{fmt(totalRows)}</div>
        <div style={{ color:'#334155', fontSize:'0.72rem', marginTop:4 }}>Total rows</div>
      </div>

      {/* Date range */}
      {dateRange && (
        <div className="kpi-card" style={{ background:'linear-gradient(135deg,rgba(30,41,59,0.7),rgba(15,23,42,0.5))' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <div style={{ width:28, height:28, background:'rgba(56,189,248,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Calendar size={14} color="#38bdf8" />
            </div>
            <span style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>Date Range</span>
          </div>
          <div style={{ fontSize:'1.6rem', fontWeight:800, color:'white', lineHeight:1, letterSpacing:'-0.02em' }}>{dateDays}d</div>
          <div style={{ color:'#475569', fontSize:'0.7rem', marginTop:4 }}>{dateRange.from} → {dateRange.to}</div>
        </div>
      )}

      {/* Metric cards */}
      {metricEntries.slice(0,4).map(([key, val], i) => {
        const { icon:Icon, color, grad } = CARD_THEMES[i % CARD_THEMES.length]
        return (
          <div key={key} className="kpi-card" style={{ background:grad }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <div style={{ width:28, height:28, background:`${color}20`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={14} color={color} />
              </div>
              <span style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:100 }}>{key}</span>
            </div>
            <div style={{ fontSize:'1.9rem', fontWeight:800, color:'white', lineHeight:1, letterSpacing:'-0.02em' }}>{fmt(val.total)}</div>
            <div style={{ display:'flex', gap:12, marginTop:6 }}>
              <span style={{ color:'#475569', fontSize:'0.7rem' }}>avg <span style={{ color:'#94a3b8' }}>{fmt(val.avg)}</span></span>
              <span style={{ color:'#475569', fontSize:'0.7rem' }}>max <span style={{ color:'#94a3b8' }}>{fmt(val.max)}</span></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
