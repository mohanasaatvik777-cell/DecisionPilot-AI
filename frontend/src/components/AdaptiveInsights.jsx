import { useState } from 'react'
import { Sparkles, Zap, TrendingUp, AlertTriangle, ChevronRight, Brain, Search, RefreshCw } from 'lucide-react'
import AISearchPanel from './AISearchPanel'

export default function AdaptiveInsights({ config, insights, anomalies, forecastNote, analysisData }) {
  const [activeTab, setActiveTab] = useState('insights')
  if (!config) return null

  const { theme, insights: insightTemplates, recommendations, forecast } = config
  const c = theme.primary

  const aiInsights = insights?.insights || []
  const aiRecs     = insights?.recommendations || []
  const displayInsights = aiInsights.length > 0
    ? aiInsights
    : insightTemplates.map(t => `📌 ${t}`)
  const displayRecs = aiRecs.length > 0
    ? aiRecs
    : recommendations.map(r => `💡 ${r}`)

  // Real forecast from analysisData — use actual linear regression data
  const realForecast = analysisData?.forecast
  const displayForecast = realForecast?.future
    ? realForecast.future.slice(0, forecast.length).map((f, i) => ({
        label: forecast[i] || f.date,
        value: f.predicted?.toFixed(0),
        up: (f.predicted - (realForecast.historical?.slice(-1)[0]?.actual || f.predicted)) >= 0,
        pct: realForecast.historical?.slice(-1)[0]?.actual > 0
          ? Math.abs(((f.predicted - realForecast.historical.slice(-1)[0].actual) / realForecast.historical.slice(-1)[0].actual) * 100).toFixed(1)
          : '0.0',
        isReal: true,
      }))
    : forecast.map((label) => ({
        label,
        value: null,
        up: false,
        pct: null,
        isReal: false,
      }))

  const TABS = [
    { id:'insights',        label:'Insights',    icon:Sparkles,     count: displayInsights.length },
    { id:'recommendations', label:'Actions',     icon:Zap,          count: displayRecs.length     },
    { id:'forecast',        label:'Forecast',    icon:TrendingUp,   count: displayForecast.length },
    { id:'anomalies',       label:'Alerts',      icon:AlertTriangle,count: anomalies?.length||0   },
    { id:'search',          label:'Ask AI',      icon:Search,       count: 0                      },
  ]

  const fmt = n => { if(!n&&n!==0)return'N/A'; if(Math.abs(n)>=1e9)return(n/1e9).toFixed(2)+'B'; if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M'; if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+'K'; return Number(n).toLocaleString(undefined,{maximumFractionDigits:0}) }

  // ── Build ONE highlighted summary statement from real data ────────────────
  const buildSummary = () => {
    const stats   = analysisData?.aggregateStats || {}
    const kpis    = stats.kpis || {}
    const cats    = stats.topCategories || []
    const rows    = stats.rowCount || 0
    const dateRange = stats.dateRange
    const metrics = Object.entries(kpis).filter(([,v])=>v&&typeof v==='object')

    const parts = []
    if (rows > 0) parts.push(`${rows.toLocaleString()} records analyzed`)
    if (metrics.length > 0) {
      const [key, val] = metrics[0]
      parts.push(`${key} totals ${fmt(val.total)} (avg ${fmt(val.avg)})`)
    }
    if (cats.length > 0) {
      const total = cats.reduce((s,c)=>s+c.value,0)
      const pct = total > 0 ? ((cats[0].value/total)*100).toFixed(0) : 0
      parts.push(`top segment "${cats[0].name}" holds ${pct}% share`)
    }
    if (anomalies?.length > 0) parts.push(`${anomalies.length} anomaly(ies) flagged`)
    else parts.push('no anomalies detected')
    if (dateRange) parts.push(`data spans ${dateRange.from} → ${dateRange.to}`)

    return parts.length > 0
      ? parts.join(' · ')
      : `${config.label} data loaded — ${rows.toLocaleString()} records ready for analysis`
  }

  const summaryStatement = buildSummary()

  return (
    <div style={{ background:'rgba(15,23,42,0.7)', border:`1px solid ${c}20`, borderRadius:20, overflow:'hidden', backdropFilter:'blur(16px)' }}>

      {/* Header */}
      <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(51,65,85,0.4)', background:`linear-gradient(135deg,${c}10,transparent)`, display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, background:`${c}20`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <Brain size={16} color={c}/>
        </div>
        <div>
          <h3 style={{ color:'white', fontWeight:700, fontSize:'0.95rem' }}>AI Intelligence Panel</h3>
          <p style={{ color:'#475569', fontSize:'0.72rem' }}>{config.label} · {insights?.source==='claude' ? '✨ Claude AI' : '⚡ Smart Analysis'}</p>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', animation:'pulse 2s infinite' }}/>
          <span style={{ color:'#34d399', fontSize:'0.7rem', fontWeight:600 }}>Live</span>
        </div>
      </div>

      {/* ── HIGHLIGHTED SUMMARY STATEMENT — main point ── */}
      <div style={{ margin:'0', padding:'14px 20px', background:`linear-gradient(135deg,${c}18,rgba(15,23,42,0.9))`, borderBottom:'1px solid rgba(51,65,85,0.4)', position:'relative', overflow:'hidden' }}>
        {/* Animated left accent */}
        <div style={{ position:'absolute', left:0, top:0, bottom:0, width:4, background:`linear-gradient(180deg,${c},${theme.secondary||'#8b5cf6'})` }}/>
        {/* Glow bg */}
        <div style={{ position:'absolute', right:-20, top:'50%', transform:'translateY(-50%)', width:120, height:120, background:`radial-gradient(circle,${c}15,transparent 70%)`, pointerEvents:'none' }}/>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, paddingLeft:8 }}>
          <div style={{ width:28, height:28, background:`${c}25`, border:`1px solid ${c}50`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
            <span style={{ fontSize:'0.85rem' }}>📌</span>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:4 }}>Executive Summary</p>
            <p style={{ color:'white', fontWeight:700, fontSize:'0.92rem', lineHeight:1.55, margin:0, letterSpacing:'-0.01em' }} className="ai-panel-summary">
              {summaryStatement}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid rgba(51,65,85,0.4)', overflowX:'auto' }} className="ai-panel-tabs">
        {TABS.map(({ id, label, icon:Icon, count }) => {
          const active = activeTab === id
          return (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:5, padding:'11px 8px', border:'none', cursor:'pointer', background: active ? `${c}12` : 'transparent', borderBottom: active ? `2px solid ${c}` : '2px solid transparent', color: active ? 'white' : '#475569', fontSize:'0.78rem', fontWeight: active ? 600:400, transition:'all 0.2s', minWidth:70, whiteSpace:'nowrap' }}>
              <Icon size={13} color={active ? c : '#475569'}/>
              <span>{label}</span>
              {count > 0 && <span className="ai-tab-count" style={{ background: active ? c : 'rgba(51,65,85,0.5)', color: active ? 'white':'#475569', borderRadius:99, padding:'0 5px', fontSize:'0.6rem', fontWeight:700, minWidth:14, textAlign:'center' }}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ padding:'16px 20px', maxHeight: activeTab==='search' ? 560 : 380, overflowY:'auto' }}>

        {/* ── Insights ── */}
        {activeTab === 'insights' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayInsights.map((txt, i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px', background:`${c}08`, border:`1px solid ${c}15`, borderRadius:12, transition:'all 0.2s', cursor:'default' }}
                onMouseEnter={e=>{ e.currentTarget.style.background=`${c}14`; e.currentTarget.style.borderColor=`${c}30`; e.currentTarget.style.transform='translateX(4px)' }}
                onMouseLeave={e=>{ e.currentTarget.style.background=`${c}08`; e.currentTarget.style.borderColor=`${c}15`; e.currentTarget.style.transform='none' }}
              >
                <div style={{ width:26, height:26, background:`${c}20`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Sparkles size={12} color={c}/>
                </div>
                <p style={{ color:'#cbd5e1', fontSize:'0.83rem', lineHeight:1.65 }}>{txt}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Recommendations ── */}
        {activeTab === 'recommendations' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {displayRecs.map((rec, i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px', background:'rgba(52,211,153,0.06)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:12, transition:'all 0.2s', cursor:'default' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(52,211,153,0.4)'; e.currentTarget.style.background='rgba(52,211,153,0.1)'; e.currentTarget.style.transform='translateX(4px)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(52,211,153,0.15)'; e.currentTarget.style.background='rgba(52,211,153,0.06)'; e.currentTarget.style.transform='none' }}
              >
                <div style={{ width:26, height:26, background:'rgba(52,211,153,0.15)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'#34d399', fontWeight:800, fontSize:'0.72rem' }}>{i+1}</div>
                <p style={{ color:'#cbd5e1', fontSize:'0.83rem', lineHeight:1.65, flex:1 }}>{rec}</p>
                <ChevronRight size={13} color="#334155" style={{ flexShrink:0, marginTop:3 }}/>
              </div>
            ))}
          </div>
        )}

        {/* ── Forecast ── */}
        {activeTab === 'forecast' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {!realForecast && (
              <p style={{ color:'#475569', fontSize:'0.8rem', marginBottom:4, padding:'10px 14px', background:'rgba(51,65,85,0.15)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:10 }}>
                📅 No date column detected — forecast requires a date column and at least one numeric column in your dataset.
              </p>
            )}
            {realForecast && (
              <p style={{ color:'#475569', fontSize:'0.74rem', marginBottom:4, padding:'8px 12px', background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)', borderRadius:10 }}>
                ⚠ 30-day linear regression forecast for <strong style={{color:'#fbbf24'}}>{realForecast.column}</strong>. Based on actual trend from your data.
              </p>
            )}
            {displayForecast.map(({ label, value, up, pct, isReal }, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:14, transition:'all 0.25s' }}
                onMouseEnter={e=>{ e.currentTarget.style.borderColor=up?'rgba(52,211,153,0.4)':'rgba(239,68,68,0.3)'; e.currentTarget.style.background='rgba(15,23,42,0.8)' }}
                onMouseLeave={e=>{ e.currentTarget.style.borderColor='rgba(51,65,85,0.4)'; e.currentTarget.style.background='rgba(15,23,42,0.5)' }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: isReal ? (up ? '#34d399':'#ef4444') : '#475569', boxShadow: isReal ? `0 0 8px ${up?'rgba(52,211,153,0.6)':'rgba(239,68,68,0.6)'}` : 'none' }}/>
                  <span style={{ color:'#94a3b8', fontSize:'0.85rem', fontWeight:500 }}>{label}</span>
                </div>
                {isReal && value !== null ? (
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ color:'white', fontWeight:800, fontSize:'1.05rem' }}>{fmt(parseFloat(value))}</span>
                    {pct && <span style={{ padding:'2px 8px', background: up ? 'rgba(52,211,153,0.12)':'rgba(239,68,68,0.12)', border:`1px solid ${up?'rgba(52,211,153,0.3)':'rgba(239,68,68,0.3)'}`, borderRadius:99, color: up ? '#34d399':'#ef4444', fontSize:'0.72rem', fontWeight:700 }}>
                      {up ? '↑':'↓'} {pct}%
                    </span>}
                  </div>
                ) : (
                  <span style={{ color:'#334155', fontSize:'0.78rem', fontStyle:'italic' }}>No forecast data</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Anomalies ── */}
        {activeTab === 'anomalies' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(!anomalies || anomalies.length === 0) ? (
              <div style={{ textAlign:'center', padding:'28px 0' }}>
                <div style={{ fontSize:'2.5rem', marginBottom:10 }}>✅</div>
                <p style={{ color:'#34d399', fontWeight:700, fontSize:'1rem' }}>No Anomalies Detected</p>
                <p style={{ color:'#334155', fontSize:'0.8rem', marginTop:4 }}>All values are within normal statistical range (±2σ)</p>
              </div>
            ) : anomalies.map((a, i) => (
              <div key={i} style={{ display:'flex', gap:12, padding:'12px 14px', background: a.direction==='spike' ? 'rgba(239,68,68,0.07)':'rgba(245,158,11,0.07)', border:`1px solid ${a.direction==='spike'?'rgba(239,68,68,0.2)':'rgba(245,158,11,0.2)'}`, borderRadius:12, borderLeft:`3px solid ${a.direction==='spike'?'#ef4444':'#f59e0b'}` }}>
                <span style={{ fontSize:'1.1rem' }}>{a.direction==='spike'?'⬆️':'⬇️'}</span>
                <div>
                  <p style={{ color: a.direction==='spike'?'#fca5a5':'#fcd34d', fontWeight:700, fontSize:'0.83rem', marginBottom:2 }}>
                    {a.column} — {a.direction==='spike'?'Spike':'Drop'} Detected
                  </p>
                  <p style={{ color:'#64748b', fontSize:'0.75rem', lineHeight:1.5 }}>{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Ask AI ── */}
        {activeTab === 'search' && (
          <AISearchPanel
            analysisData={analysisData}
            industry={['retail','restaurant','healthcare','manufacturing','education','marketing','finance','logistics'].includes(
              config.label.toLowerCase().split(' ')[0]
            ) ? config.label.toLowerCase().split(' ')[0] : 'general'}
            anomalies={anomalies}
            config={config}
          />
        )}
      </div>
    </div>
  )
}
