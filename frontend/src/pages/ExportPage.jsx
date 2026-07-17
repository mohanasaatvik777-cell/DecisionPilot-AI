import { useRef } from 'react'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ZAxis
} from 'recharts'

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#34d399','#f59e0b','#ef4444','#ec4899','#84cc16','#f97316','#64748b']

const fmt = n => {
  if (!n && n!==0) return 'N/A'
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2)+'B'
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2)+'M'
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1)+'K'
  return Number(n).toLocaleString(undefined,{maximumFractionDigits:2})
}
const sd = d => { try{ const dt=new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}` }catch{return d} }

function SectionTitle({ icon, title, color = '#6366f1' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'32px 0 16px', paddingBottom:8, borderBottom:`2px solid ${color}30` }}>
      <div style={{ width:32, height:32, background:`${color}15`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>{icon}</div>
      <h2 style={{ margin:0, fontSize:'1.1rem', fontWeight:700, color:'#1e293b', letterSpacing:'-0.01em' }}>{title}</h2>
    </div>
  )
}

function KPICard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background:'white', border:`1px solid ${color}30`, borderRadius:12, padding:'16px 18px', borderTop:`3px solid ${color}` }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <span style={{ fontSize:'1.2rem' }}>{icon}</span>
        <span style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize:'1.8rem', fontWeight:800, color:'#1e293b', lineHeight:1, marginBottom:4 }}>{value}</div>
      {sub && <div style={{ color:'#94a3b8', fontSize:'0.72rem' }}>{sub}</div>}
    </div>
  )
}

function ChartBox({ title, subtitle, children, span = 1 }) {
  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding:'16px 18px', gridColumn:`span ${span}`, breakInside:'avoid' }}>
      <div style={{ marginBottom:12 }}>
        <p style={{ margin:0, fontWeight:700, fontSize:'0.9rem', color:'#1e293b' }}>{title}</p>
        {subtitle && <p style={{ margin:'2px 0 0', fontSize:'0.72rem', color:'#94a3b8' }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// KDE calculation
function gaussianKDE(data, points=60) {
  if (!data?.length || data.length < 3) return []
  const vals = data.flatMap(b => {
    const parts = b.range?.split('-')
    if (parts?.length >= 2) {
      const c = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2
      return isNaN(c) ? [] : Array(Math.min(b.count,15)).fill(null).map(()=> c + (Math.random()-0.5)*(parseFloat(parts[1])-parseFloat(parts[0])))
    }
    return []
  })
  if (vals.length < 3) return []
  const mean = vals.reduce((a,b)=>a+b,0)/vals.length
  const std  = Math.sqrt(vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length)
  const h    = 1.06 * std * Math.pow(vals.length,-0.2) || 1
  const min  = Math.min(...vals), max = Math.max(...vals)
  const step = (max-min)/points
  return Array.from({length:points+1},(_,i)=>{
    const x = min+i*step
    const density = vals.reduce((s,v)=>s+Math.exp(-0.5*((x-v)/h)**2)/(Math.sqrt(2*Math.PI)),0)/(vals.length*h)
    return { x:parseFloat(x.toFixed(2)), density:parseFloat(density.toFixed(6)) }
  })
}

export default function ExportPage({ analysisData, insights, uploadData, config, onClose }) {
  const printRef = useRef(null)
  if (!analysisData || !config) return null

  const { kpis, chartData, forecast, anomalies, dataQualityNotes } = analysisData
  const { theme, label, emoji, kpis: kpiDefs } = config
  const c = theme.primary
  const { totalRows, dateRange, dateDays, ...metrics } = kpis || {}
  const metricEntries = Object.entries(metrics||{}).filter(([,v])=>v&&typeof v==='object')
  const kdeData = chartData?.distribution ? gaussianKDE(chartData.distribution.data) : []
  const aiInsights = insights?.insights || []
  const aiRecs = insights?.recommendations || []

  const handlePrint = () => window.print()

  return (
    <div>
      {/* Print controls — hidden when printing */}
      <div className="no-print" style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background:'#1e293b', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>📊</div>
          <div>
            <p style={{ color:'white', fontWeight:700, fontSize:'0.9rem', margin:0 }}>Export Report</p>
            <p style={{ color:'#64748b', fontSize:'0.72rem', margin:0 }}>{uploadData?.fileName} · {totalRows?.toLocaleString()} records</p>
          </div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={handlePrint} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', border:'none', borderRadius:10, padding:'9px 20px', fontWeight:700, fontSize:'0.85rem', cursor:'pointer', boxShadow:'0 4px 16px rgba(99,102,241,0.4)' }}>
            🖨️ Print / Save as PDF
          </button>
          <button onClick={onClose} style={{ background:'rgba(51,65,85,0.6)', color:'#94a3b8', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10, padding:'9px 18px', fontSize:'0.82rem', cursor:'pointer' }}>
            ✕ Close
          </button>
        </div>
      </div>

      {/* Print instructions */}
      <div className="no-print" style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:10, padding:'10px 16px', margin:'70px 32px 0', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:'1rem' }}>💡</span>
        <p style={{ margin:0, color:'#818cf8', fontSize:'0.78rem' }}>
          Click <strong>Print / Save as PDF</strong> → In the print dialog, set <strong>Destination → Save as PDF</strong>, enable <strong>Background graphics</strong> for colors.
        </p>
      </div>

      {/* ── PRINTABLE REPORT ── */}
      <div ref={printRef} style={{ maxWidth:1000, margin:'16px auto 60px', padding:'0 32px', fontFamily:'Inter,system-ui,sans-serif', color:'#1e293b' }}>

        {/* ── COVER ── */}
        <div style={{ background:`linear-gradient(135deg,#0f172a,#1e293b)`, borderRadius:16, padding:'40px 44px', marginBottom:32, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, background:`radial-gradient(circle,${c}30,transparent 70%)`, pointerEvents:'none' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
            <div style={{ width:56, height:56, background:`linear-gradient(135deg,${c},${theme.secondary})`, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem' }}>{emoji}</div>
            <div>
              <h1 style={{ margin:0, fontSize:'1.8rem', fontWeight:900, color:'white', letterSpacing:'-0.03em' }}>AI Business Co-Pilot</h1>
              <p style={{ margin:'4px 0 0', color:'#64748b', fontSize:'0.85rem' }}>Analytics Report — {label}</p>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {[
              ['📁 File', uploadData?.fileName || 'Dataset'],
              ['📋 Records', totalRows?.toLocaleString() || '—'],
              ['📅 Date Range', dateRange ? `${dateRange.from} → ${dateRange.to}` : 'N/A'],
              ['🕐 Generated', new Date().toLocaleDateString()],
            ].map(([k,v])=>(
              <div key={k} style={{ background:'rgba(255,255,255,0.05)', borderRadius:10, padding:'12px 14px' }}>
                <p style={{ margin:0, color:'#475569', fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>{k}</p>
                <p style={{ margin:'4px 0 0', color:'white', fontWeight:700, fontSize:'0.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── KPIs ── */}
        <SectionTitle icon="📊" title="Key Performance Indicators" color={c} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:8 }}>
          <KPICard label="Total Records" value={fmt(totalRows)} sub="Dataset size" color="#6366f1" icon="📋" />
          {dateRange && <KPICard label="Date Range" value={`${dateDays || '—'}d`} sub={`${dateRange.from} → ${dateRange.to}`} color="#38bdf8" icon="📅" />}
          {metricEntries.slice(0,4).map(([key,val],i)=>(
            <KPICard key={key} label={key} value={fmt(val.total)}
              sub={`avg ${fmt(val.avg)} · max ${fmt(val.max)}`}
              color={COLORS[i]} icon={kpiDefs[i]?.icon || '📈'} />
          ))}
        </div>

        {/* ── TREND CHARTS ── */}
        {chartData?.trend?.data?.filter(d=>!d.gap).length > 0 && (
          <>
            <SectionTitle icon="📈" title="Trend Analysis" color={c} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <ChartBox title="Area Trend" subtitle="Metric over time">
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData.trend.data.filter(d=>!d.gap)} margin={{top:5,right:10,left:0,bottom:5}}>
                    <defs>
                      <linearGradient id="eg1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={0.4}/>
                        <stop offset="100%" stopColor={c} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="date" tickFormatter={sd} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                    <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={48}/>
                    <Tooltip formatter={v=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:11}}/>
                    <Area type="monotone" dataKey="value" stroke={c} strokeWidth={2.5} fill="url(#eg1)" dot={false} activeDot={{r:4}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="Line Chart" subtitle="Trend with data points">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData.trend.data.filter(d=>!d.gap)} margin={{top:5,right:10,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                    <XAxis dataKey="date" tickFormatter={sd} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                    <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={48}/>
                    <Tooltip formatter={v=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:11}}/>
                    <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2.5} dot={{r:2,fill:'#38bdf8'}} activeDot={{r:5}}/>
                  </LineChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          </>
        )}

        {/* ── CATEGORY CHARTS ── */}
        {chartData?.categoryBreakdown?.data?.length > 0 && (
          <>
            <SectionTitle icon="🗂️" title="Category Breakdown" color={theme.secondary||'#8b5cf6'} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <ChartBox title="Category Bar Chart" subtitle="Top categories by value">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData.categoryBreakdown.data} layout="vertical" margin={{top:0,right:16,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                    <XAxis type="number" tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:'#64748b'}} axisLine={false} tickLine={false} width={80} tickFormatter={v=>v.length>11?v.slice(0,11)+'…':v}/>
                    <Tooltip formatter={v=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:11}}/>
                    <Bar dataKey="value" radius={[0,5,5,0]}>
                      {chartData.categoryBreakdown.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="Donut / Pie Chart" subtitle="Category share distribution">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData.categoryBreakdown.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={2}
                      label={({name,percent})=>`${name.slice(0,8)} ${(percent*100).toFixed(0)}%`} labelLine={{stroke:'#cbd5e1',strokeWidth:1}}>
                      {chartData.categoryBreakdown.data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={v=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </ChartBox>
            </div>
          </>
        )}

        {/* ── DISTRIBUTION + KDE ── */}
        {chartData?.distribution?.data?.length > 0 && (
          <>
            <SectionTitle icon="〽️" title="Distribution & Density Analysis" color="#34d399" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
              <ChartBox title="Distribution Histogram" subtitle={`Value frequency — ${chartData.distribution.label}`}>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData.distribution.data} margin={{top:5,right:10,left:0,bottom:28}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                    <XAxis dataKey="range" tick={{fontSize:8,fill:'#94a3b8'}} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0}/>
                    <YAxis tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{borderRadius:8,fontSize:11}}/>
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {chartData.distribution.data.map((e,i)=>{
                        const max=Math.max(...chartData.distribution.data.map(d=>d.count))
                        return <Cell key={i} fill={`rgba(56,189,248,${0.25+0.7*(e.count/max)})`}/>
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartBox>
              <ChartBox title="KDE Density Plot" subtitle="Kernel density with mean (μ) and σ bands">
                {kdeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={kdeData} margin={{top:5,right:10,left:0,bottom:5}}>
                      <defs>
                        <linearGradient id="kdeg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f472b6" stopOpacity={0.5}/>
                          <stop offset="100%" stopColor="#f472b6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="x" tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={v=>fmt(v)} interval="preserveStartEnd"/>
                      <YAxis tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} tickFormatter={v=>(v*100).toFixed(2)+'%'} width={44}/>
                      <Tooltip formatter={v=>[(v*100).toFixed(3)+'%','Density']} contentStyle={{borderRadius:8,fontSize:11}}/>
                      <Area type="monotone" dataKey="density" stroke="#f472b6" strokeWidth={2.5} fill="url(#kdeg)" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <div style={{height:200,display:'flex',alignItems:'center',justifyContent:'center',color:'#94a3b8',fontSize:'0.82rem'}}>Insufficient data for KDE</div>}
              </ChartBox>
            </div>
          </>
        )}

        {/* ── SCATTER ── */}
        {chartData?.scatter?.data?.length > 0 && (
          <>
            <SectionTitle icon="🔵" title="Correlation Analysis" color="#34d399" />
            <ChartBox title="Scatter Plot" subtitle={`${chartData.scatter.xLabel} vs ${chartData.scatter.yLabel}`}>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{top:5,right:16,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                  <XAxis dataKey="x" type="number" tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} name={chartData.scatter.xLabel}/>
                  <YAxis dataKey="y" type="number" tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={48} name={chartData.scatter.yLabel}/>
                  <ZAxis range={[20,20]}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:11}} formatter={v=>[fmt(v)]}/>
                  <Scatter data={chartData.scatter.data} fill="#34d399" fillOpacity={0.7}/>
                </ScatterChart>
              </ResponsiveContainer>
            </ChartBox>
          </>
        )}

        {/* ── MULTI TREND ── */}
        {chartData?.multiTrend?.keys?.length >= 2 && (
          <>
            <SectionTitle icon="📉" title="Multi-Metric Comparison" color={c} />
            <ChartBox title="Multiple Metrics Over Time" subtitle="All numeric columns compared">
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={chartData.multiTrend.data} margin={{top:5,right:16,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                  <XAxis dataKey="date" tickFormatter={sd} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={48}/>
                  <Tooltip contentStyle={{borderRadius:8,fontSize:11}} formatter={v=>[fmt(v)]}/>
                  <Legend wrapperStyle={{fontSize:'0.75rem',paddingTop:8}}/>
                  {chartData.multiTrend.keys.map((key,i)=>(
                    <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={false} activeDot={{r:4}}/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          </>
        )}

        {/* ── FORECAST ── */}
        {forecast && (
          <>
            <SectionTitle icon="🔮" title="30-Day Forecast" color="#38bdf8" />
            <ChartBox title="Predictive Forecast" subtitle="Linear regression with 95% confidence band">
              {(() => {
                const hist = forecast.historical || []
                const fut  = forecast.future || []
                const bridge = hist.length > 0 ? [{ ...hist[hist.length-1], predicted: hist[hist.length-1].smoothed }] : []
                const all = [
                  ...hist.map(d=>({date:d.date, actual:d.actual, isForecast:false})),
                  ...bridge,
                  ...fut.map(d=>({date:d.date, predicted:d.predicted, upper:d.upper, lower:d.lower, isForecast:true}))
                ]
                return (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={all} margin={{top:5,right:16,left:0,bottom:5}}>
                      <defs>
                        <linearGradient id="fag" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="fcg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#34d399" stopOpacity={0.15}/>
                          <stop offset="100%" stopColor="#34d399" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="date" tickFormatter={sd} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                      <YAxis tickFormatter={fmt} tick={{fontSize:9,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={52}/>
                      <Tooltip contentStyle={{borderRadius:8,fontSize:11}} formatter={v=>[fmt(v)]}/>
                      <Area dataKey="upper" fill="url(#fcg)" stroke="none" connectNulls/>
                      <Area dataKey="lower" fill="white" stroke="none" connectNulls/>
                      <Area dataKey="actual" stroke="#6366f1" strokeWidth={2.5} fill="url(#fag)" dot={false} name="Actual" connectNulls/>
                      <Line dataKey="predicted" stroke="#34d399" strokeWidth={2.5} strokeDasharray="6 3" dot={false} name="Forecast" connectNulls/>
                    </AreaChart>
                  </ResponsiveContainer>
                )
              })()}
            </ChartBox>
          </>
        )}

        {/* ── ANOMALIES ── */}
        <SectionTitle icon="⚠️" title="Anomalies & Alerts" color={anomalies?.length ? '#ef4444':'#10b981'} />
        {!anomalies?.length ? (
          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
            <span style={{ fontSize:'1.4rem' }}>✅</span>
            <div>
              <p style={{ margin:0, fontWeight:700, color:'#15803d' }}>No Anomalies Detected</p>
              <p style={{ margin:'2px 0 0', color:'#4ade80', fontSize:'0.78rem' }}>All values within normal statistical range (±2 standard deviations)</p>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {anomalies.map((a,i)=>(
              <div key={i} style={{ background: a.direction==='spike'?'#fef2f2':'#fffbeb', border:`1px solid ${a.direction==='spike'?'#fecaca':'#fde68a'}`, borderRadius:12, padding:'12px 16px', borderLeft:`4px solid ${a.direction==='spike'?'#ef4444':'#f59e0b'}`, display:'flex', gap:12 }}>
                <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{a.direction==='spike'?'⬆️':'⬇️'}</span>
                <div>
                  <p style={{ margin:0, fontWeight:700, color: a.direction==='spike'?'#dc2626':'#d97706', fontSize:'0.85rem' }}>
                    {a.column} — {a.direction==='spike'?'Spike':'Drop'}{a.date?` on ${a.date}`:''}
                  </p>
                  <p style={{ margin:'3px 0 0', color:'#64748b', fontSize:'0.78rem' }}>{a.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── AI INSIGHTS ── */}
        <SectionTitle icon="✨" title="AI-Generated Insights" color="#6366f1" />
        {aiInsights.length > 0 ? (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {aiInsights.map((txt,i)=>(
              <div key={i} style={{ background:'#fafafa', border:'1px solid #e2e8f0', borderRadius:10, padding:'12px 14px', borderLeft:'3px solid #6366f1', display:'flex', gap:10 }}>
                <span style={{ color:'#6366f1', fontWeight:700, fontSize:'0.75rem', minWidth:20 }}>{i+1}.</span>
                <p style={{ margin:0, color:'#475569', fontSize:'0.8rem', lineHeight:1.6 }}>{txt}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'14px 18px', marginBottom:16, color:'#94a3b8', fontSize:'0.82rem' }}>
            No AI insights generated. Add ANTHROPIC_API_KEY to enable Claude AI analysis.
          </div>
        )}

        {/* ── RECOMMENDATIONS ── */}
        <SectionTitle icon="💡" title="Actionable Recommendations" color="#10b981" />
        {aiRecs.length > 0 ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {aiRecs.map((rec,i)=>(
              <div key={i} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:24, height:24, background:'#10b981', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:'0.72rem', flexShrink:0 }}>{i+1}</div>
                <p style={{ margin:0, color:'#166534', fontSize:'0.82rem', lineHeight:1.6 }}>{rec}</p>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
            {['Review top-performing categories and replicate their success patterns.','Investigate anomalies flagged above to identify data issues or business events.','Set up regular data reviews to track key metrics over time.'].map((r,i)=>(
              <div key={i} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 16px', display:'flex', gap:12 }}>
                <div style={{ width:24, height:24, background:'#10b981', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:'0.72rem', flexShrink:0 }}>{i+1}</div>
                <p style={{ margin:0, color:'#166534', fontSize:'0.82rem', lineHeight:1.6 }}>{r}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── STATS TABLE ── */}
        <SectionTitle icon="📐" title="Summary Statistics" color="#06b6d4" />
        {metricEntries.length > 0 && (
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                  {['Metric','Total','Average','Min','Max','Count'].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'#475569', fontWeight:700, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricEntries.map(([key,val],i)=>(
                  <tr key={key} style={{ borderBottom:'1px solid #f1f5f9', background: i%2===0?'white':'#fafafa' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#1e293b' }}>{key}</td>
                    <td style={{ padding:'10px 14px', color:'#6366f1', fontWeight:700 }}>{fmt(val.total)}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{fmt(val.avg)}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{fmt(val.min)}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{fmt(val.max)}</td>
                    <td style={{ padding:'10px 14px', color:'#475569' }}>{val.count?.toLocaleString() || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TOP CATEGORIES TABLE ── */}
        {analysisData?.aggregateStats?.topCategories?.length > 0 && (
          <>
            <SectionTitle icon="🏆" title="Top Categories" color={theme.secondary||'#8b5cf6'} />
            <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden', marginBottom:24 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.82rem' }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}>
                    {['#','Category','Value','Share'].map(h=>(
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:'#475569', fontWeight:700, fontSize:'0.72rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const cats = analysisData.aggregateStats.topCategories
                    const total = cats.reduce((s,c)=>s+c.value,0)
                    return cats.map((cat,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #f1f5f9', background:i%2===0?'white':'#fafafa' }}>
                        <td style={{ padding:'10px 14px', color:'#94a3b8', fontWeight:700 }}>#{i+1}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#1e293b' }}>{cat.name}</td>
                        <td style={{ padding:'10px 14px', color:COLORS[i%COLORS.length], fontWeight:700 }}>{fmt(cat.value)}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:8, background:'#f1f5f9', borderRadius:99, overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${Math.min(100,(cat.value/total)*100).toFixed(1)}%`, background:COLORS[i%COLORS.length], borderRadius:99 }}/>
                            </div>
                            <span style={{ color:'#64748b', fontSize:'0.75rem', width:36 }}>{((cat.value/total)*100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── FOOTER ── */}
        <div style={{ marginTop:40, paddingTop:20, borderTop:'2px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, background:`linear-gradient(135deg,${c},${theme.secondary})`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.9rem' }}>📊</div>
            <div>
              <p style={{ margin:0, fontWeight:700, color:'#1e293b', fontSize:'0.82rem' }}>AI Business Co-Pilot</p>
              <p style={{ margin:0, color:'#94a3b8', fontSize:'0.7rem' }}>Powered by Claude AI · {label}</p>
            </div>
          </div>
          <p style={{ color:'#94a3b8', fontSize:'0.72rem' }}>Generated {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { margin: 12mm; size: A4; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; }
      `}</style>
    </div>
  )
}
