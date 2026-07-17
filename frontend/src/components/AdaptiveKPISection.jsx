import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

function formatValue(val, format) {
  // val must be a plain number — never an object
  const n = (val !== null && val !== undefined && typeof val === 'object')
    ? (val.total ?? val.avg ?? 0)   // safety fallback if object slips through
    : val
  if (n === null || n === undefined || isNaN(Number(n))) return '—'
  const num = Number(n)
  switch (format) {
    case 'currency':
      if (Math.abs(num) >= 1e9) return '$' + (num/1e9).toFixed(2)+'B'
      if (Math.abs(num) >= 1e6) return '$' + (num/1e6).toFixed(2)+'M'
      if (Math.abs(num) >= 1e3) return '$' + (num/1e3).toFixed(1)+'K'
      return '$' + Number(num).toLocaleString(undefined, { maximumFractionDigits:0 })
    case 'percent':
      return (num > 1 ? num.toFixed(1) : (num*100).toFixed(1)) + '%'
    case 'decimal': return Number(num).toFixed(2)
    default:
      if (Math.abs(num) >= 1e9) return (num/1e9).toFixed(1)+'B'
      if (Math.abs(num) >= 1e6) return (num/1e6).toFixed(1)+'M'
      if (Math.abs(num) >= 1e3) return (num/1e3).toFixed(1)+'K'
      return Number(num).toLocaleString(undefined, { maximumFractionDigits:2 })
  }
}

export default function AdaptiveKPISection({ config, kpis, analysisData }) {
  const [hovered, setHovered] = useState(null)
  if (!config || !kpis) return null

  const { totalRows, dateRange, dateDays, ...metrics } = kpis

  // Only show KPI cards for columns that ACTUALLY EXIST in the dataset
  // Use real metric entries from backend — NOT the industry config template
  const realMetrics = Object.entries(metrics).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v))

  // Build KPI cards purely from real data
  const kpiCards = []

  // Card 1: Total rows
  kpiCards.push({ key:'totalRows', label:'Total Records', icon:'📋', color:'#6366f1', value: formatValue(totalRows,'number'), sub:'Dataset size' })

  // Card 2: Date range if exists
  if (dateRange) {
    kpiCards.push({ key:'dateRange', label:'Date Range', icon:'📅', color:'#38bdf8', value: dateDays ? `${dateDays}d` : '—', sub:`${dateRange.from?.slice(0,7)} → ${dateRange.to?.slice(0,7)}` })
  }

  // Cards for every real numeric column
  realMetrics.forEach(([colName, val]) => {
    // Decide which value to show: avg for rate/score/days cols, sum for everything else
    const isAvgCol = /rate|ratio|pct|percent|score|index|avg|average|stay|days|age|price|unit|duration|hour|minute/i.test(colName)
    const displayNum = isAvgCol ? val.avg : val.total   // ← raw number, not the object

    // Choose format
    const isCurrency = /revenue|sales|profit|cost|price|amount|income|spend|fee|salary|wage|pay/i.test(colName)
    const format = isCurrency ? 'currency' : 'number'

    const icon = /revenue|sales|profit|income/i.test(colName)     ? '💰'
               : /cost|spend|expense/i.test(colName)              ? '💸'
               : /qty|quantity|count|units|orders/i.test(colName) ? '📦'
               : /age|stay|days|duration|hour/i.test(colName)     ? '📅'
               : /score|rate|ratio|pct|index/i.test(colName)      ? '📊'
               : /patient|admission|discharge/i.test(colName)     ? '🏥'
               : /student|attend|grade/i.test(colName)            ? '🎓'
               : /salary|wage|pay/i.test(colName)                 ? '💵'
               : '📈'

    const colors = ['#6366f1','#34d399','#f472b6','#fbbf24','#38bdf8','#a78bfa','#f97316','#10b981']
    const color  = colors[kpiCards.length % colors.length]

    // Sub label: show what we're displaying and the count
    const subLabel = isAvgCol
      ? `avg of ${val.count?.toLocaleString()} records`
      : `total · avg ${formatValue(val.avg, format)}`

    kpiCards.push({
      key:   colName,
      label: colName,
      icon,
      color,
      value: formatValue(displayNum, format),   // ← pass NUMBER not object
      sub:   subLabel,
    })
  })

  // Anomalies card
  kpiCards.push({
    key:'anomalies', label:'Anomalies', icon:'⚠️',
    color: analysisData?.anomalies?.length > 0 ? '#f87171' : '#34d399',
    value: String(analysisData?.anomalies?.length ?? 0),
    sub: analysisData?.anomalies?.length > 0 ? 'Issues detected' : 'All clear',
  })

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:14, marginBottom:24 }} className="kpi-grid">
      {kpiCards.map((card, i) => {
        const isHov = hovered === i
        return (
          <div key={card.key}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              background: isHov ? `linear-gradient(135deg,${card.color}18,${card.color}08)` : 'rgba(15,23,42,0.7)',
              border: `1px solid ${isHov ? card.color+'60' : card.color+'20'}`,
              borderRadius:18, padding:'18px 16px', position:'relative',
              overflow:'hidden', transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              transform: isHov ? 'translateY(-4px) scale(1.02)' : 'scale(1)',
              boxShadow: isHov ? `0 16px 40px ${card.color}25` : 'none',
              backdropFilter:'blur(16px)', cursor:'default',
            }}
          >
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${card.color},${card.color}60,transparent)`, transform: isHov ? 'scaleX(1)' : 'scaleX(0.3)', transformOrigin:'left', transition:'transform 0.4s ease', borderRadius:'18px 18px 0 0' }} />
            <div style={{ position:'absolute', top:-24, right:-24, width:80, height:80, background:`radial-gradient(circle,${card.color}20,transparent 70%)`, pointerEvents:'none', opacity: isHov ? 1 : 0.5 }} />
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ width:36, height:36, background:`${card.color}18`, border:`1px solid ${card.color}30`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>
                {card.icon}
              </div>
            </div>
            <div style={{ fontSize:'1.8rem', fontWeight:800, lineHeight:1, letterSpacing:'-0.03em', marginBottom:4, color: isHov ? card.color : 'white' }}>
              {card.value}
            </div>
            <div style={{ color:'#64748b', fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
              {card.label}
            </div>
            {card.sub && <div style={{ color:'#475569', fontSize:'0.7rem' }}>{card.sub}</div>}
            <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:3, padding:'2px 7px', borderRadius:99, background:'rgba(100,116,139,0.12)', border:'1px solid rgba(100,116,139,0.2)', width:'fit-content' }}>
              <Minus size={9} color="#64748b" />
              <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#64748b' }}>From dataset</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
