import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Bot, User, X, Loader2, TrendingUp, BarChart2, PieChart, Activity, Zap, ChevronRight, RefreshCw } from 'lucide-react'
import api from '../api'
import {
  LineChart, Line, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts'

const CHART_COLORS = ['#6366f1','#34d399','#f472b6','#fbbf24','#38bdf8','#a78bfa','#f97316','#10b981','#e879f9','#06b6d4']

const CHIPS = [
  'Show monthly sales trend', 'Compare revenue by category', 'Top 10 customers by value',
  'Distribution of values', 'Find correlations', 'Which category leads?',
  'Show anomalies', 'Forecast next month', 'Average by segment', 'Market share breakdown',
]

const CHART_ICON = { line:'📈', area:'📈', trend:'📈', bar:'📊', horizontalBar:'📊', pie:'🥧', donut:'🥧', scatter:'🔵', histogram:'📊', heatmap:'🔲' }

// ── Smart Chart Renderer ──────────────────────────────────────────────────────
function SmartChart({ chartData, chartType, color }) {
  if (!chartData?.data?.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:240, color:'#475569', fontSize:'0.85rem' }}>
      No chart data available for this query.
    </div>
  )

  const c = color || '#6366f1'
  const data = chartData.data

  // ── Heatmap ───────────────────────────────────────────────────────────────
  if (chartType === 'heatmap' && chartData.cols) {
    const cols = chartData.cols
    const getVal = (x, y) => data.find(d => d.x === x && d.y === y)?.value ?? 0
    const cellSize = Math.min(60, Math.floor(320 / cols.length))
    return (
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', margin:'0 auto', fontSize:'0.7rem' }}>
          <thead>
            <tr>
              <th style={{ width: cellSize }}></th>
              {cols.map(c => <th key={c} style={{ width: cellSize, padding:'4px', color:'#94a3b8', textAlign:'center', fontSize:'0.65rem', maxWidth: cellSize, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {cols.map(row => (
              <tr key={row}>
                <td style={{ padding:'4px', color:'#94a3b8', fontSize:'0.65rem', textAlign:'right', maxWidth: cellSize, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row}</td>
                {cols.map(col => {
                  const v = getVal(row, col)
                  const intensity = Math.abs(v)
                  const bg = v > 0 ? `rgba(52,211,153,${0.15 + intensity * 0.7})` : v < 0 ? `rgba(239,68,68,${0.15 + intensity * 0.7})` : 'rgba(51,65,85,0.2)'
                  return (
                    <td key={col} title={`${row} × ${col}: ${v}`} style={{ width: cellSize, height: cellSize, background: bg, border:'1px solid rgba(51,65,85,0.3)', textAlign:'center', color:'white', fontWeight:600, fontSize:'0.62rem', cursor:'default' }}>
                      {v.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ color:'#475569', fontSize:'0.65rem', textAlign:'center', marginTop:8 }}>Green = positive correlation · Red = negative</p>
      </div>
    )
  }

  // ── Pie / Donut ───────────────────────────────────────────────────────────
  if (['pie', 'donut'].includes(chartType)) {
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <ResponsiveContainer width="100%" height={280}>
        <RPieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
            innerRadius={chartType === 'donut' ? 60 : 0} outerRadius={110}
            paddingAngle={2} label={({ name, value }) => `${name}: ${((value/total)*100).toFixed(1)}%`}
            labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => [v.toLocaleString(), '']} contentStyle={{ background:'rgba(15,23,42,0.95)', border:`1px solid ${c}40`, borderRadius:10, color:'white', fontSize:'0.8rem' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize:'0.72rem', color:'#94a3b8' }} />
        </RPieChart>
      </ResponsiveContainer>
    )
  }

  // ── Scatter ───────────────────────────────────────────────────────────────
  if (chartType === 'scatter') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top:10, right:20, bottom:20, left:10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
          <XAxis dataKey="x" name={chartData.xLabel} tick={{ fill:'#64748b', fontSize:11 }} label={{ value: chartData.xLabel, position:'bottom', fill:'#475569', fontSize:11 }} />
          <YAxis dataKey="y" name={chartData.yLabel} tick={{ fill:'#64748b', fontSize:11 }} />
          <Tooltip cursor={{ stroke:`${c}40` }} contentStyle={{ background:'rgba(15,23,42,0.95)', border:`1px solid ${c}40`, borderRadius:10, color:'white', fontSize:'0.8rem' }} />
          <Scatter data={data} fill={c} fillOpacity={0.7} />
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  // ── Horizontal Bar ─────────────────────────────────────────────────────────
  if (chartType === 'horizontalBar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(260, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ top:5, right:30, bottom:5, left:80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" horizontal={false} />
          <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : v} />
          <YAxis type="category" dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} width={76} />
          <Tooltip contentStyle={{ background:'rgba(15,23,42,0.95)', border:`1px solid ${c}40`, borderRadius:10, color:'white', fontSize:'0.8rem' }} formatter={v => [v.toLocaleString(), chartData.label]} />
          <Bar dataKey="value" radius={[0,6,6,0]}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Line / Area / Trend ───────────────────────────────────────────────────
  if (['line','area','trend'].includes(chartType)) {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top:10, right:20, bottom:20, left:10 }}>
          <defs>
            <linearGradient id="aiAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c} stopOpacity={0.3} />
              <stop offset="95%" stopColor={c} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
          <XAxis dataKey={chartData.xKey} tick={{ fill:'#64748b', fontSize:10 }} tickFormatter={v => v?.slice?.(0, 7) ?? v} />
          <YAxis tick={{ fill:'#64748b', fontSize:10 }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : v} />
          <Tooltip contentStyle={{ background:'rgba(15,23,42,0.95)', border:`1px solid ${c}40`, borderRadius:10, color:'white', fontSize:'0.8rem' }} formatter={v => [v?.toLocaleString?.() ?? v, chartData.label]} />
          <Area type="monotone" dataKey={chartData.yKey} stroke={c} strokeWidth={2.5} fill="url(#aiAreaGrad)" dot={false} activeDot={{ r:5, fill:c }} />
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // ── Default Bar ───────────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top:10, right:20, bottom:40, left:10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
        <XAxis dataKey={chartData.xKey} tick={{ fill:'#64748b', fontSize:10 }} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis tick={{ fill:'#64748b', fontSize:10 }} tickFormatter={v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : v} />
        <Tooltip contentStyle={{ background:'rgba(15,23,42,0.95)', border:`1px solid ${c}40`, borderRadius:10, color:'white', fontSize:'0.8rem' }} formatter={v => [v?.toLocaleString?.() ?? v, chartData.label]} />
        <Bar dataKey={chartData.yKey} radius={[6,6,0,0]}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Result Card ───────────────────────────────────────────────────────────────
function ResultCard({ result, config, onFollowUp }) {
  const c = config?.theme?.primary || '#6366f1'
  const { decision, chartData, source, query } = result
  const chartType = decision?.chart_type || 'bar'
  const chartEmoji = CHART_ICON[chartType] || '📊'

  return (
    <div className="animate-slide-up" style={{ background:'rgba(8,12,28,0.95)', border:`1px solid ${c}25`, borderRadius:20, overflow:'hidden', marginBottom:20, boxShadow:`0 8px 32px ${c}12` }}>

      {/* Card header */}
      <div style={{ padding:'14px 20px', background:`linear-gradient(135deg,${c}15,transparent)`, borderBottom:`1px solid ${c}15`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:`${c}20`, border:`1px solid ${c}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>{chartEmoji}</div>
          <div>
            <p style={{ color:'white', fontWeight:700, fontSize:'0.88rem', margin:0 }}>{query}</p>
            <p style={{ color:'#475569', fontSize:'0.68rem', margin:0 }}>
              {decision?.intent} · {chartType} chart · {source === 'claude' ? '✨ Claude AI' : '⚡ Local Engine'}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <span style={{ padding:'2px 8px', background:`${c}18`, border:`1px solid ${c}30`, borderRadius:99, color:c, fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase' }}>{chartType}</span>
          {decision?.confidence && <span style={{ padding:'2px 8px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.25)', borderRadius:99, color:'#34d399', fontSize:'0.62rem', fontWeight:700 }}>{(decision.confidence * 100).toFixed(0)}% confident</span>}
        </div>
      </div>

      <div style={{ padding:'20px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:16 }}>

          {/* Chart */}
          <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:16, padding:'16px 12px' }}>
            <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>
              {chartEmoji} {chartType.replace(/([A-Z])/g,' $1').toUpperCase()} CHART
            </p>
            <SmartChart chartData={chartData} chartType={chartType} color={c} />
          </div>

          {/* Executive Summary */}
          {decision?.executive_summary && (
            <div style={{ background:`linear-gradient(135deg,${c}10,${c}05)`, border:`1px solid ${c}20`, borderRadius:14, padding:'14px 16px', borderLeft:`3px solid ${c}` }}>
              <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>📋 Executive Summary</p>
              <p style={{ color:'#e2e8f0', fontSize:'0.86rem', lineHeight:1.65, margin:0 }}>{decision.executive_summary}</p>
            </div>
          )}

          {/* Insights + Reason in 2-col on wide, 1-col on small */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>
            {/* Key Insights */}
            {decision?.insights?.length > 0 && (
              <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:14, padding:'14px 16px' }}>
                <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>💡 Key Insights</p>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {decision.insights.map((ins, i) => (
                    <div key={i} style={{ display:'flex', gap:8, padding:'8px 10px', background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.12)', borderRadius:10 }}>
                      <span style={{ color:c, fontWeight:800, fontSize:'0.7rem', flexShrink:0, marginTop:1 }}>0{i+1}</span>
                      <p style={{ color:'#cbd5e1', fontSize:'0.8rem', lineHeight:1.55, margin:0 }}>{ins}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reason + Follow-ups */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {decision?.reason && (
                <div style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:14, padding:'14px 16px' }}>
                  <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>🎯 Why This Chart</p>
                  <p style={{ color:'#fcd34d', fontSize:'0.8rem', lineHeight:1.55, margin:0 }}>{decision.reason}</p>
                </div>
              )}
              {decision?.follow_ups?.length > 0 && (
                <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:14, padding:'14px 16px' }}>
                  <p style={{ color:'#64748b', fontSize:'0.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>🔍 Suggested Follow-ups</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {decision.follow_ups.map((q, i) => (
                      <button key={i} onClick={() => onFollowUp(q)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:`${c}08`, border:`1px solid ${c}18`, borderRadius:9, color:'#94a3b8', fontSize:'0.76rem', cursor:'pointer', textAlign:'left', transition:'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${c}18`; e.currentTarget.style.color='white' }}
                        onMouseLeave={e => { e.currentTarget.style.background=`${c}08`; e.currentTarget.style.color='#94a3b8' }}>
                        <ChevronRight size={11} color={c} style={{ flexShrink:0 }} />{q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIAnalystPanel({ analysisData, uploadData, config }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [history,  setHistory]  = useState([]) // conversation memory
  const inputRef  = useRef(null)
  const bottomRef = useRef(null)
  const c = config?.theme?.primary || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'

  const scrollDown = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100)

  const submitQuery = async (q) => {
    const text = (q || query).trim()
    if (!text || loading || !uploadData?.sessionId) return
    setQuery('')
    setLoading(true)

    const newHistory = [...history, { role:'user', content:text }]
    setHistory(newHistory)
    scrollDown()

    try {
      const { data } = await api.post('/api/ai-query', {
        sessionId: uploadData.sessionId,
        query: text,
        conversationHistory: newHistory.slice(-6),
      }, { timeout: 30000 })

      const resultEntry = { ...data, query: text, id: Date.now() }
      setResults(prev => [resultEntry, ...prev]) // newest first
      setHistory(prev => [...prev, { role:'assistant', content: data.decision?.executive_summary || 'Analysis complete.' }])
    } catch (err) {
      const msg = err.response?.data?.error || 'Analysis failed. Please try again.'
      setResults(prev => [{ id: Date.now(), query: text, error: msg }, ...prev])
    } finally {
      setLoading(false)
      scrollDown()
    }
  }

  const clearAll = () => { setResults([]); setHistory([]) }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20, position:'relative' }}>

      {/* ── Header ── */}
      <div style={{ background:`linear-gradient(135deg,${c}18,${c2}08)`, border:`1px solid ${c}25`, borderRadius:20, padding:'20px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-20, right:-20, width:140, height:140, background:`radial-gradient(circle,${c}20,transparent 65%)`, pointerEvents:'none' }} />
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:16 }}>
          <div style={{ width:44, height:44, borderRadius:14, background:`linear-gradient(135deg,${c},${c2})`, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:`0 8px 24px ${c}50`, flexShrink:0 }}>
            <Bot size={22} color="white" />
          </div>
          <div>
            <h2 style={{ color:'white', fontWeight:800, fontSize:'1.05rem', letterSpacing:'-0.01em', marginBottom:2 }}>AI Data Analyst</h2>
            <p style={{ color:'#475569', fontSize:'0.72rem' }}>
              {uploadData?.fileName} · {analysisData?.aggregateStats?.rowCount?.toLocaleString()} records · Ask anything about your data
            </p>
          </div>
          {results.length > 0 && (
            <button onClick={clearAll} style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5, padding:'5px 12px', background:'rgba(51,65,85,0.4)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:9, color:'#64748b', fontSize:'0.72rem', cursor:'pointer' }}>
              <RefreshCw size={11} /> Clear
            </button>
          )}
        </div>

        {/* Prompt input */}
        <div style={{ display:'flex', gap:10 }}>
          <div style={{ flex:1, position:'relative' }}>
            <textarea
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuery() } }}
              placeholder="Ask anything: 'Show monthly revenue trend', 'Compare sales by region', 'Which product has highest profit?'"
              rows={2}
              style={{ width:'100%', background:'rgba(8,12,28,0.8)', border:`1px solid ${query ? c+'60' : 'rgba(51,65,85,0.5)'}`, borderRadius:14, padding:'12px 16px', color:'white', fontSize:'0.87rem', outline:'none', resize:'none', boxSizing:'border-box', lineHeight:1.5, transition:'all 0.2s', boxShadow:query?`0 0 0 3px ${c}15`:'none' }}
            />
          </div>
          <button onClick={() => submitQuery()} disabled={!query.trim() || loading || !uploadData?.sessionId}
            style={{ width:54, borderRadius:14, background: query.trim()&&!loading ? `linear-gradient(135deg,${c},${c2})` : 'rgba(30,41,59,0.6)', border:'none', cursor: query.trim()&&!loading ? 'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow: query.trim()&&!loading ? `0 6px 20px ${c}40`:'none', transition:'all 0.2s' }}>
            {loading ? <Loader2 size={20} color="#34d399" style={{ animation:'spin 1s linear infinite' }} /> : <Send size={18} color={query.trim()&&!loading?'white':'#334155'} />}
          </button>
        </div>

        {/* Chip suggestions */}
        <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:6 }}>
          {CHIPS.map((chip, i) => (
            <button key={i} onClick={() => { setQuery(chip); inputRef.current?.focus() }}
              style={{ padding:'4px 11px', background:`${c}08`, border:`1px solid ${c}18`, borderRadius:99, color:'#64748b', fontSize:'0.7rem', cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background=`${c}20`; e.currentTarget.style.color='white'; e.currentTarget.style.borderColor=`${c}50` }}
              onMouseLeave={e => { e.currentTarget.style.background=`${c}08`; e.currentTarget.style.color='#64748b'; e.currentTarget.style.borderColor=`${c}18` }}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── No dataset guard ── */}
      {!uploadData?.sessionId && (
        <div style={{ padding:'40px 24px', textAlign:'center', background:'rgba(15,23,42,0.4)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:20 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📂</div>
          <p style={{ color:'#475569', fontWeight:600 }}>No dataset loaded</p>
          <p style={{ color:'#334155', fontSize:'0.82rem', marginTop:4 }}>Upload a CSV file first to start asking questions.</p>
        </div>
      )}

      {/* ── Loading state ── */}
      {loading && (
        <div style={{ display:'flex', gap:12, alignItems:'center', padding:'16px 20px', background:'rgba(8,12,28,0.8)', border:`1px solid ${c}20`, borderRadius:16, animation:'fadeIn 0.3s' }}>
          <div style={{ width:36, height:36, borderRadius:10, background:`${c}20`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Loader2 size={18} color={c} style={{ animation:'spin 1s linear infinite' }} />
          </div>
          <div>
            <p style={{ color:'white', fontWeight:600, fontSize:'0.87rem', margin:0 }}>AI Analyst is thinking…</p>
            <p style={{ color:'#475569', fontSize:'0.72rem', margin:0 }}>Analyzing data, selecting best visualization, generating insights</p>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
            {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:c, animation:`pulse 1.4s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {results.map(result => (
        <div key={result.id}>
          {result.error ? (
            <div style={{ padding:'16px 20px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, color:'#fca5a5', fontSize:'0.85rem' }}>
              ⚠ {result.error}
            </div>
          ) : (
            <ResultCard result={result} config={config} onFollowUp={q => { setQuery(q); submitQuery(q) }} />
          )}
        </div>
      ))}

      {/* ── Empty state ── */}
      {!loading && results.length === 0 && uploadData?.sessionId && (
        <div style={{ padding:'48px 24px', textAlign:'center', background:'rgba(8,12,28,0.6)', border:`1px solid ${c}15`, borderRadius:20 }}>
          <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🤖</div>
          <p style={{ color:'white', fontWeight:700, fontSize:'1rem', marginBottom:6 }}>Ready to analyze your data</p>
          <p style={{ color:'#475569', fontSize:'0.83rem', marginBottom:16 }}>Type a question above or click a suggestion chip to get started.</p>
          <div style={{ display:'flex', justifyContent:'center', gap:10, flexWrap:'wrap' }}>
            {['Show monthly trend', 'Compare by category', 'Distribution analysis'].map(q => (
              <button key={q} onClick={() => submitQuery(q)}
                style={{ padding:'8px 16px', background:`${c}15`, border:`1px solid ${c}30`, borderRadius:10, color:c, fontSize:'0.8rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background=`${c}28` }}
                onMouseLeave={e => { e.currentTarget.style.background=`${c}15` }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
