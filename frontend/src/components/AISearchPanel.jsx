import { useState, useRef } from 'react'
import api from '../api'
import { Send, Sparkles, User, Bot, X, Loader2 } from 'lucide-react'

// ── Suggested questions per industry ─────────────────────────────────────────
const SUGGESTED = {
  retail:        ['What are my top 5 selling products?','What is the total revenue?','Which region performs best?','What is the average order value?','Show anomalies in sales'],
  restaurant:    ['What are the most popular dishes?','What is the average bill amount?','Which category earns the most?','Show revenue summary','What anomalies exist?'],
  healthcare:    ['Which department has the most patients?','What is the average patient stay?','Show most common conditions','What are the anomalies?','Give me a full summary'],
  manufacturing: ['Which machine has the highest defect rate?','What is the overall efficiency?','Show production summary','When does downtime occur?','List anomalies detected'],
  education:     ['What is the average score?','Which subject performs best?','What is the attendance rate?','Show grade distribution','Give me a full summary'],
  marketing:     ['Which campaign has the best ROI?','What is the total spend?','Show conversion summary','Which platform performs best?','List anomalies'],
  finance:       ['What is the total revenue vs expenses?','What is the profit margin?','Show expense breakdown','List anomalies detected','Give me a full summary'],
  general:       ['Give me a summary of this data','What are the top categories?','What anomalies were detected?','What are the key trends?','Show all metrics'],
}

// ── Main smart answer engine ──────────────────────────────────────────────────
function buildAnswer(query, analysisData, industry, anomalies) {
  const q = query.toLowerCase().trim()
  const stats   = analysisData?.aggregateStats || {}
  const kpis    = stats.kpis || {}
  const cats    = stats.topCategories || []
  const columns = stats.columns || []
  const dateRange = stats.dateRange
  const rowCount  = stats.rowCount || 0

  // All numeric metrics with full stats
  const metrics = Object.entries(kpis).filter(([, v]) => v && typeof v === 'object')

  // ── Formatting helpers ─────────────────────────────────────────────────────
  const fmt = (n, currency = false) => {
    if (n === null || n === undefined || isNaN(n)) return 'N/A'
    const num = Number(n)
    const prefix = currency ? '$' : ''
    if (Math.abs(num) >= 1e9) return prefix + (num / 1e9).toFixed(2) + 'B'
    if (Math.abs(num) >= 1e6) return prefix + (num / 1e6).toFixed(2) + 'M'
    if (Math.abs(num) >= 1e3) return prefix + (num / 1e3).toFixed(1) + 'K'
    return prefix + num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  const pct = (part, total) => total > 0 ? ((part / total) * 100).toFixed(1) + '%' : 'N/A'

  // ── Intent detection ───────────────────────────────────────────────────────

  // SUMMARY / OVERVIEW
  if (q.match(/\b(summar|overview|tell me about|describe|what.*data|everything|all metric|full report)\b/)) {
    const lines = [`📋 **Dataset Summary — ${industry} data**\n`]
    lines.push(`• **Records:** ${rowCount.toLocaleString()}`)
    lines.push(`• **Columns:** ${columns.length} (${columns.filter(c=>c.type==='numeric').length} numeric, ${columns.filter(c=>c.type==='categorical').length} categorical)`)
    if (dateRange) lines.push(`• **Date range:** ${dateRange.from} → ${dateRange.to}`)
    lines.push('')
    metrics.slice(0, 5).forEach(([k, v]) => {
      lines.push(`• **${k}:** Total ${fmt(v.total)} | Avg ${fmt(v.avg)} | Max ${fmt(v.max)} | Min ${fmt(v.min)}`)
    })
    if (cats.length > 0) {
      lines.push('')
      lines.push(`• **Top category:** ${cats[0].name} (${fmt(cats[0].value)})`)
    }
    lines.push('')
    lines.push(anomalies?.length > 0
      ? `• ⚠️ **${anomalies.length} anomalies detected** — check the Alerts tab`
      : `• ✅ **No anomalies** — all values within normal range`)
    return lines.join('\n')
  }

  // TOP / BEST / HIGHEST
  if (q.match(/\b(top|best|highest|most|leading|number one|rank|popular|performing)\b/)) {
    const results = []
    // Top categories
    if (cats.length > 0) {
      const total = cats.reduce((s, c) => s + c.value, 0)
      results.push(`🏆 **Top Categories by Value:**\n`)
      cats.slice(0, 5).forEach((c, i) => {
        results.push(`  ${i + 1}. **${c.name}** — ${fmt(c.value)} (${pct(c.value, total)})`)
      })
    }
    // Top metric
    if (metrics.length > 0) {
      const [key, val] = metrics[0]
      results.push(`\n📈 **${key}:**`)
      results.push(`  • Total: **${fmt(val.total)}**`)
      results.push(`  • Highest single value: **${fmt(val.max)}**`)
      results.push(`  • Average: ${fmt(val.avg)}`)
    }
    return results.length > 0 ? results.join('\n') : `No category or metric data available to rank.`
  }

  // TOTAL / SUM / REVENUE / SALES / AMOUNT
  if (q.match(/\b(total|sum|revenue|sales|income|earn|profit|how much|amount|value)\b/)) {
    if (metrics.length === 0) return `No numeric metrics found in this dataset.`
    const lines = [`💰 **Totals & Sums:**\n`]
    metrics.forEach(([k, v]) => {
      lines.push(`• **${k}:** ${fmt(v.total)} total | ${fmt(v.avg)} avg per record`)
    })
    if (dateRange) lines.push(`\n📅 Across ${rowCount.toLocaleString()} records from ${dateRange.from} to ${dateRange.to}`)
    return lines.join('\n')
  }

  // AVERAGE / MEAN
  if (q.match(/\b(average|avg|mean|typical|per order|per customer|per day)\b/)) {
    if (metrics.length === 0) return `No numeric metrics found.`
    const lines = [`📊 **Averages:**\n`]
    metrics.forEach(([k, v]) => {
      lines.push(`• **${k}:** ${fmt(v.avg)} (across ${rowCount.toLocaleString()} records)`)
    })
    return lines.join('\n')
  }

  // MIN / MAX / RANGE / EXTREME
  if (q.match(/\b(min|max|maximum|minimum|range|extreme|highest value|lowest value|peak|floor)\b/)) {
    if (metrics.length === 0) return `No numeric metrics found.`
    const lines = [`📐 **Min / Max Ranges:**\n`]
    metrics.forEach(([k, v]) => {
      lines.push(`• **${k}:** Min ${fmt(v.min)} — Max ${fmt(v.max)} (range: ${fmt(v.max - v.min)})`)
    })
    return lines.join('\n')
  }

  // ANOMALY / ALERT / UNUSUAL / SPIKE / OUTLIER
  if (q.match(/\b(anomal|alert|unusual|spike|drop|outlier|weird|issue|problem|concern|flag)\b/)) {
    if (!anomalies?.length) {
      return `✅ **No anomalies detected.**\n\nAll ${rowCount.toLocaleString()} records are within ±2 standard deviations of the mean. Your data looks consistent.`
    }
    const lines = [`⚠️ **${anomalies.length} Anomaly(ies) Detected:**\n`]
    anomalies.slice(0, 5).forEach((a, i) => {
      lines.push(`${i + 1}. **${a.column}** — ${a.direction === 'spike' ? '⬆️ Spike' : '⬇️ Drop'}${a.date ? ` on ${a.date}` : ''}`)
      lines.push(`   Value: ${fmt(a.value)} | Mean: ${fmt(a.mean)} | Z-score: ${a.zScore}σ`)
    })
    if (anomalies.length > 5) lines.push(`\n...and ${anomalies.length - 5} more. Check the Alerts tab for all details.`)
    return lines.join('\n')
  }

  // TREND / GROWTH / OVER TIME / CHANGE
  if (q.match(/\b(trend|grow|decreas|increas|over time|period|change|month|week|day|time|pattern)\b/)) {
    if (!dateRange) return `⚠️ No date column detected in this dataset — time-series analysis is not available.\n\nAvailable metrics: ${metrics.map(([k])=>k).join(', ') || 'none'}`
    const days = Math.round((new Date(dateRange.to) - new Date(dateRange.from)) / (1000 * 60 * 60 * 24))
    const lines = [`📈 **Trend Analysis:**\n`]
    lines.push(`• **Period:** ${dateRange.from} → ${dateRange.to} (${days} days)`)
    lines.push(`• **Records:** ${rowCount.toLocaleString()}`)
    if (days > 0) lines.push(`• **Daily avg records:** ${(rowCount / days).toFixed(1)}`)
    metrics.slice(0, 2).forEach(([k, v]) => {
      lines.push(`• **${k}:** Total ${fmt(v.total)} | Daily avg ${fmt(v.total / Math.max(days, 1))}`)
    })
    lines.push(`\n💡 For the full trend visualization, see the **Trend Chart** in the Overview tab.`)
    return lines.join('\n')
  }

  // COUNT / HOW MANY / NUMBER
  if (q.match(/\b(how many|count|number of|total records|rows|entries|observations)\b/)) {
    const lines = [`🔢 **Record Counts:**\n`]
    lines.push(`• **Total records:** ${rowCount.toLocaleString()}`)
    lines.push(`• **Columns:** ${columns.length}`)
    lines.push(`• **Numeric columns:** ${columns.filter(c=>c.type==='numeric').map(c=>c.name).join(', ') || 'none'}`)
    lines.push(`• **Category columns:** ${columns.filter(c=>c.type==='categorical').map(c=>c.name).join(', ') || 'none'}`)
    if (dateRange) lines.push(`• **Date column present:** Yes (${dateRange.from} → ${dateRange.to})`)
    return lines.join('\n')
  }

  // CATEGORY / SEGMENT / BREAKDOWN / DISTRIBUTION
  if (q.match(/\b(categor|segment|group|breakdown|split|distribut|by type|by region|by product)\b/)) {
    if (cats.length === 0) return `No categorical breakdown available. Ensure your dataset has a text/label column.`
    const total = cats.reduce((s, c) => s + c.value, 0)
    const lines = [`🗂️ **Category Breakdown (Top ${cats.length}):**\n`]
    cats.forEach((c, i) => {
      const bar = '█'.repeat(Math.round((c.value / (cats[0].value || 1)) * 10))
      lines.push(`${i + 1}. **${c.name}**\n   ${bar} ${fmt(c.value)} (${pct(c.value, total)})`)
    })
    lines.push(`\n📊 Total across all categories: **${fmt(total)}**`)
    return lines.join('\n')
  }

  // RECOMMEND / SUGGEST / IMPROVE / ACTION
  if (q.match(/\b(recommend|suggest|improve|focus|action|next step|what to do|how to|strategy|opportun)\b/)) {
    const lines = [`💡 **Recommendations for your ${industry} data:**\n`]
    if (cats.length > 1) {
      const ratio = cats[0].value / (cats[cats.length - 1].value || 1)
      if (ratio > 3) lines.push(`1. **Scale top performer:** "${cats[0].name}" outperforms "${cats[cats.length-1].name}" by ${ratio.toFixed(1)}x. Investigate what drives it.`)
      else lines.push(`1. **Balanced performance:** Top categories are within ${ratio.toFixed(1)}x of each other — consider A/B testing to improve the gap.`)
    }
    if (anomalies?.length > 0) lines.push(`${lines.length}. **Fix anomalies:** ${anomalies.length} unusual values detected — review to confirm data accuracy.`)
    if (metrics.length > 0) {
      const [k, v] = metrics[0]
      const cv = v.avg > 0 ? ((v.max - v.min) / v.avg * 100).toFixed(0) : 0
      if (cv > 100) lines.push(`${lines.length}. **High variability in ${k}** (${cv}% range) — segment analysis may reveal different sub-groups.`)
    }
    if (dateRange) lines.push(`${lines.length}. **Monitor trends:** Check the Forecast tab for predicted future performance.`)
    lines.push(`${lines.length}. **Use filters:** Drill down by category or date range to find segment-specific opportunities.`)
    return lines.join('\n')
  }

  // COLUMN / FIELD / WHAT COLUMNS
  if (q.match(/\b(column|field|variable|feature|attribute|what data|dataset contain|data type)\b/)) {
    const lines = [`📋 **Dataset Columns (${columns.length} total):**\n`]
    const grouped = { numeric:[], categorical:[], date:[], identifier:[], text:[] }
    columns.forEach(c => { (grouped[c.type] || grouped.text).push(c.name) })
    if (grouped.numeric.length)     lines.push(`📊 **Numeric:** ${grouped.numeric.join(', ')}`)
    if (grouped.categorical.length) lines.push(`🏷️ **Categorical:** ${grouped.categorical.join(', ')}`)
    if (grouped.date.length)        lines.push(`📅 **Date:** ${grouped.date.join(', ')}`)
    if (grouped.identifier.length)  lines.push(`🔑 **Identifier:** ${grouped.identifier.join(', ')}`)
    return lines.join('\n')
  }

  // COMPARE / VS / VERSUS / DIFFERENCE
  if (q.match(/\b(compar|vs|versus|difference|gap|ratio|against|higher|lower than)\b/)) {
    if (metrics.length < 2) {
      if (cats.length >= 2) {
        const total = cats.reduce((s,c)=>s+c.value,0)
        return `📊 **Comparison — Top 2 categories:**\n\n1. **${cats[0].name}:** ${fmt(cats[0].value)} (${pct(cats[0].value,total)})\n2. **${cats[1].name}:** ${fmt(cats[1].value)} (${pct(cats[1].value,total)})\n\nRatio: ${cats[0].name} is ${(cats[0].value/Math.max(cats[1].value,1)).toFixed(1)}x larger than ${cats[1].name}.`
      }
      return `Only one metric available for comparison.`
    }
    const lines = [`⚖️ **Metric Comparison:**\n`]
    metrics.slice(0, 4).forEach(([k, v]) => {
      lines.push(`• **${k}:** ${fmt(v.total)} total | ${fmt(v.avg)} avg`)
    })
    return lines.join('\n')
  }

  // SPECIFIC METRIC NAME MATCH
  for (const [key, val] of metrics) {
    if (q.includes(key.toLowerCase())) {
      return `📊 **${key} — Full Breakdown:**\n\n• **Total:** ${fmt(val.total)}\n• **Average:** ${fmt(val.avg)}\n• **Maximum:** ${fmt(val.max)}\n• **Minimum:** ${fmt(val.min)}\n• **Records with data:** ${val.count?.toLocaleString() || rowCount.toLocaleString()}${dateRange ? `\n• **Period:** ${dateRange.from} → ${dateRange.to}` : ''}`
    }
  }

  // SPECIFIC CATEGORY NAME MATCH
  for (const cat of cats) {
    if (q.includes(cat.name.toLowerCase())) {
      const total = cats.reduce((s,c)=>s+c.value,0)
      const rank  = cats.findIndex(c=>c.name===cat.name)+1
      return `🗂️ **${cat.name}:**\n\n• **Value:** ${fmt(cat.value)}\n• **Share:** ${pct(cat.value,total)} of total\n• **Rank:** #${rank} out of ${cats.length} categories\n• **Total (all categories):** ${fmt(total)}`
    }
  }

  // DEFAULT — comprehensive fallback
  const lines = [`🔍 I searched your **${industry}** dataset for "${query.slice(0,50)}${query.length>50?'...':''}".\n`]
  if (metrics.length > 0) {
    const [k, v] = metrics[0]
    lines.push(`**Primary metric (${k}):** Total ${fmt(v.total)} | Avg ${fmt(v.avg)} | across ${rowCount.toLocaleString()} records`)
  }
  if (cats.length > 0) lines.push(`**Top category:** ${cats[0].name} (${fmt(cats[0].value)})`)
  lines.push(`\nTry asking:`)
  lines.push(`  • "Give me a summary"`)
  lines.push(`  • "What are the top categories?"`)
  lines.push(`  • "Show me all metrics"`)
  lines.push(`  • "What anomalies were detected?"`)
  return lines.join('\n')
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AISearchPanel({ analysisData, industry, anomalies, config }) {
  const [query,    setQuery]    = useState('')
  const [messages, setMessages] = useState([])
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)
  const c = config?.theme?.primary || '#6366f1'

  const industryKey = industry || 'general'
  const suggested   = SUGGESTED[industryKey] || SUGGESTED.general

  const scrollDown = () => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 80)

  const sendQuery = async (q) => {
    const text = (q || query).trim()
    if (!text || loading) return

    setMessages(prev => [...prev, { role:'user', content:text, time:new Date().toLocaleTimeString() }])
    setQuery('')
    setLoading(true)
    scrollDown()

    // Small delay for natural feel
    await new Promise(r => setTimeout(r, 300))

    let answer = ''
    let source = 'local'

    // Try backend Claude first (if API key configured)
    try {
      const { data } = await api.post('/api/insights/query', {
        query: text,
        aggregateStats: analysisData?.aggregateStats,
        industry: industryKey,
        anomalies,
      }, { timeout: 10000 })
      if (data.answer) { answer = data.answer; source = data.source }
    } catch {}

    // Always use local engine if Claude not available or fails
    if (!answer) {
      answer = buildAnswer(text, analysisData, industryKey, anomalies)
      source = 'local'
    }

    setMessages(prev => [...prev, { role:'assistant', content:answer, time:new Date().toLocaleTimeString(), source }])
    setLoading(false)
    scrollDown()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:480 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <p style={{ color:'white', fontWeight:700, fontSize:'0.9rem', margin:0 }}>💬 Ask About Your Data</p>
          <p style={{ color:'#475569', fontSize:'0.72rem', margin:'2px 0 0' }}>
            {analysisData?.aggregateStats?.rowCount?.toLocaleString() || 0} records · {industryKey} · {Object.keys(analysisData?.aggregateStats?.kpis||{}).length} metrics available
          </p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'rgba(51,65,85,0.4)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:8, color:'#64748b', fontSize:'0.72rem', cursor:'pointer' }}>
            <X size={10}/> Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', maxHeight:360, marginBottom:14, display:'flex', flexDirection:'column', gap:12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ fontSize:'2rem', marginBottom:6 }}>🤖</div>
            <p style={{ color:'#64748b', fontSize:'0.82rem', margin:0 }}>Ask me anything about your {industryKey} data</p>
            <p style={{ color:'#334155', fontSize:'0.72rem', margin:'4px 0 0' }}>I analyze your actual dataset values, not generic templates</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display:'flex', gap:8, flexDirection:msg.role==='user'?'row-reverse':'row', alignItems:'flex-start', animation:'slideUp 0.25s ease-out' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:msg.role==='user'?`${c}20`:'rgba(52,211,153,0.12)', border:`1px solid ${msg.role==='user'?c+'40':'rgba(52,211,153,0.25)'}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              {msg.role==='user' ? <User size={12} color={c}/> : <Bot size={12} color="#34d399"/>}
            </div>
            <div style={{ maxWidth:'84%' }}>
              <div style={{ padding:'10px 14px', borderRadius:msg.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px', background:msg.role==='user'?`${c}15`:'rgba(15,23,42,0.85)', border:`1px solid ${msg.role==='user'?c+'30':'rgba(51,65,85,0.4)'}` }}>
                <p style={{ color:'#e2e8f0', fontSize:'0.82rem', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0,
                  fontFamily:'inherit' }}>
                  {msg.content}
                </p>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:3, justifyContent:msg.role==='user'?'flex-end':'flex-start', alignItems:'center' }}>
                <span style={{ color:'#1e293b', fontSize:'0.62rem' }}>{msg.time}</span>
                {msg.source && (
                  <span style={{ padding:'1px 6px', background:msg.source==='claude'?'rgba(167,139,250,0.15)':'rgba(52,211,153,0.1)', border:`1px solid ${msg.source==='claude'?'rgba(167,139,250,0.3)':'rgba(52,211,153,0.2)'}`, borderRadius:99, color:msg.source==='claude'?'#a78bfa':'#34d399', fontSize:'0.6rem', fontWeight:600 }}>
                    {msg.source === 'claude' ? '✨ Claude AI' : '⚡ Data Engine'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(52,211,153,0.12)', border:'1px solid rgba(52,211,153,0.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Loader2 size={12} color="#34d399" style={{ animation:'spin 1s linear infinite' }}/>
            </div>
            <div style={{ padding:'10px 14px', background:'rgba(15,23,42,0.8)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:'14px 14px 14px 4px' }}>
              <div style={{ display:'flex', gap:4 }}>
                {[0,1,2].map(j=>(
                  <div key={j} style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', animation:`pulse 1.4s ease-in-out ${j*0.2}s infinite` }}/>
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div style={{ marginBottom:12 }}>
          <p style={{ color:'#334155', fontSize:'0.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Try asking:</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {suggested.map((s, i) => (
              <button key={i} onClick={() => sendQuery(s)}
                style={{ padding:'5px 11px', background:`${c}08`, border:`1px solid ${c}18`, borderRadius:99, color:'#94a3b8', fontSize:'0.72rem', cursor:'pointer', transition:'all 0.2s' }}
                onMouseEnter={e=>{ e.currentTarget.style.background=`${c}18`; e.currentTarget.style.color='white'; e.currentTarget.style.borderColor=`${c}50` }}
                onMouseLeave={e=>{ e.currentTarget.style.background=`${c}08`; e.currentTarget.style.color='#94a3b8'; e.currentTarget.style.borderColor=`${c}18` }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ display:'flex', gap:8 }}>
        <div style={{ flex:1, position:'relative' }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key==='Enter' && !e.shiftKey && sendQuery()}
            placeholder={`Ask about your ${industryKey} data...`}
            style={{ width:'100%', background:'rgba(15,23,42,0.8)', border:`1px solid ${query ? c+'50':'rgba(51,65,85,0.5)'}`, borderRadius:12, padding:'11px 42px 11px 14px', color:'white', fontSize:'0.85rem', outline:'none', transition:'all 0.2s', boxSizing:'border-box', boxShadow:query?`0 0 0 3px ${c}15`:'none' }}
          />
          <Sparkles size={13} color={query ? c : '#334155'} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
        </div>
        <button onClick={() => sendQuery()} disabled={!query.trim() || loading}
          style={{ width:44, height:44, borderRadius:12, background:query.trim()&&!loading?`linear-gradient(135deg,${c},${config?.theme?.secondary||'#8b5cf6'})`:'rgba(30,41,59,0.6)', border:'none', cursor:query.trim()&&!loading?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', boxShadow:query.trim()&&!loading?`0 4px 16px ${c}40`:'none', flexShrink:0 }}>
          <Send size={15} color={query.trim()&&!loading?'white':'#334155'}/>
        </button>
      </div>
    </div>
  )
}
