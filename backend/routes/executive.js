/**
 * executive.js — POST /api/executive
 * Generates Executive Summary, Dataset Health Score, Business Health Score,
 * Smart Alerts, Ranked Insights, Auto Insight Cards, and Advanced Statistics.
 * All numbers come from backend math. Gemini only writes the narrative.
 */
'use strict'
const express = require('express')
const router  = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')

const toNum = v => { const n = parseFloat(String(v).replace(/[$,%\s]/g,'')); return isNaN(n)?null:n }
const mean  = arr => arr.reduce((a,b)=>a+b,0)/arr.length
const std   = arr => { const m=mean(arr); return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length) }
const pct   = (a,b) => b>0?Math.round(a/b*1000)/10:0

// ── Dataset Health Score ──────────────────────────────────────────────────────
function computeDatasetHealth(rows, schema) {
  const total = rows.length
  let score = 100
  const issues = []

  // Missing values penalty
  let totalMissing = 0
  schema.forEach(col => {
    const missing = rows.filter(r => r[col.originalName]===null||r[col.originalName]===undefined||r[col.originalName]==='').length
    totalMissing += missing
  })
  const missingPct = pct(totalMissing, total * schema.length)
  if (missingPct > 20) { score -= 25; issues.push({ type:'critical', msg:`${missingPct.toFixed(1)}% missing values across all columns` }) }
  else if (missingPct > 5) { score -= 10; issues.push({ type:'warning', msg:`${missingPct.toFixed(1)}% missing values detected` }) }

  // Duplicate rows penalty
  const rowStrings = rows.map(r => JSON.stringify(r))
  const uniqueCount = new Set(rowStrings).size
  const dupCount = total - uniqueCount
  const dupPct = pct(dupCount, total)
  if (dupPct > 10) { score -= 15; issues.push({ type:'critical', msg:`${dupCount} duplicate rows (${dupPct.toFixed(1)}%)` }) }
  else if (dupPct > 2) { score -= 5; issues.push({ type:'warning', msg:`${dupCount} possible duplicate rows` }) }

  // Low row count penalty
  if (total < 10) { score -= 20; issues.push({ type:'critical', msg:'Very few records — analysis may be unreliable' }) }
  else if (total < 50) { score -= 10; issues.push({ type:'warning', msg:'Limited dataset size — consider collecting more data' }) }

  // No numeric columns penalty
  const numCols = schema.filter(c=>c.type==='numeric')
  if (numCols.length === 0) { score -= 15; issues.push({ type:'warning', msg:'No numeric columns — limited analytical depth' }) }

  // Outlier ratio
  let outlierCount = 0
  numCols.slice(0,3).forEach(col => {
    const vals = rows.map(r=>toNum(r[col.originalName])).filter(v=>v!==null)
    if (vals.length < 4) return
    const s=[...vals].sort((a,b)=>a-b)
    const q1=s[Math.floor(s.length*0.25)], q3=s[Math.floor(s.length*0.75)]
    const iqr=q3-q1
    outlierCount += vals.filter(v=>v<q1-1.5*iqr||v>q3+1.5*iqr).length
  })
  const outlierPct = pct(outlierCount, total)
  if (outlierPct > 15) { score -= 10; issues.push({ type:'warning', msg:`High outlier density: ${outlierCount} outliers detected` }) }

  score = Math.max(0, Math.min(100, score))
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Average' : 'Poor'
  return { score, label, missingPct: Math.round(missingPct*10)/10, dupCount, dupPct: Math.round(dupPct*10)/10, outlierCount, issues }
}

// ── Business Health Score ─────────────────────────────────────────────────────
function computeBusinessHealth(rows, schema, anomalies) {
  let score = 60
  const signals = []
  const numCols = schema.filter(c=>c.type==='numeric')
  const dateCols = schema.filter(c=>c.type==='date')

  // Growth signal: check if later rows have higher values than earlier rows
  if (dateCols.length > 0 && numCols.length > 0) {
    const dateCol = dateCols[0].originalName
    const numCol  = numCols[0].originalName
    const sorted  = [...rows].sort((a,b)=>new Date(a[dateCol])-new Date(b[dateCol]))
    const half    = Math.floor(sorted.length/2)
    const firstHalf = sorted.slice(0,half).map(r=>toNum(r[numCol])).filter(v=>v!==null)
    const secondHalf= sorted.slice(half).map(r=>toNum(r[numCol])).filter(v=>v!==null)
    if (firstHalf.length && secondHalf.length) {
      const avgFirst = mean(firstHalf), avgSecond = mean(secondHalf)
      const growthPct = avgFirst>0 ? (avgSecond-avgFirst)/avgFirst*100 : 0
      if (growthPct > 10)  { score += 15; signals.push({ type:'positive', msg:`${growthPct.toFixed(1)}% growth trend detected in ${numCols[0].name}` }) }
      else if (growthPct > 0) { score += 5; signals.push({ type:'positive', msg:`Modest positive trend in ${numCols[0].name}` }) }
      else if (growthPct < -10) { score -= 15; signals.push({ type:'negative', msg:`${Math.abs(growthPct).toFixed(1)}% decline trend in ${numCols[0].name}` }) }
      else if (growthPct < 0)   { score -= 5; signals.push({ type:'negative', msg:`Slight downward trend in ${numCols[0].name}` }) }
    }
  }

  // Variance health: low CV is stable business
  numCols.slice(0,2).forEach(col => {
    const vals = rows.map(r=>toNum(r[col.originalName])).filter(v=>v!==null)
    if (vals.length < 5) return
    const m = mean(vals), s = std(vals)
    const cv = m !== 0 ? s / Math.abs(m) : 0
    if (cv > 1) { score -= 8; signals.push({ type:'warning', msg:`High volatility in ${col.name} (CV=${cv.toFixed(2)})` }) }
    else if (cv < 0.2) { score += 5; signals.push({ type:'positive', msg:`${col.name} is stable and consistent` }) }
  })

  // Anomaly penalty
  if (anomalies && anomalies.length > 5)  { score -= 10; signals.push({ type:'negative', msg:`${anomalies.length} anomalies detected — review recommended` }) }
  else if (anomalies && anomalies.length > 0) { score -= 5; signals.push({ type:'warning', msg:`${anomalies.length} anomaly detected` }) }
  else { score += 5; signals.push({ type:'positive', msg:'No anomalies detected — data is consistent' }) }

  // Data richness bonus
  if (numCols.length >= 3) { score += 5; signals.push({ type:'positive', msg:`${numCols.length} numeric metrics available for analysis` }) }

  score = Math.max(0, Math.min(100, score))
  const label  = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Average' : 'Critical'
  return { score, label, signals }
}

// ── Smart Alerts ─────────────────────────────────────────────────────────────
function computeSmartAlerts(rows, schema, anomalies) {
  const alerts = []
  const numCols = schema.filter(c=>c.type==='numeric')
  const dateCols= schema.filter(c=>c.type==='date')

  // Anomaly-based alerts
  if (anomalies) {
    anomalies.slice(0,5).forEach(a => {
      alerts.push({
        severity: a.zScore > 3 ? 'critical' : 'warning',
        type: 'anomaly',
        title: `${a.direction==='spike'?'Unusual spike':'Unusual drop'} in ${a.column}`,
        message: a.message,
        value: a.value,
        date: a.date,
      })
    })
  }

  // Missing data alert
  numCols.forEach(col => {
    const missing = rows.filter(r=>r[col.originalName]===null||r[col.originalName]===undefined||r[col.originalName]==='').length
    const missingPct = pct(missing, rows.length)
    if (missingPct > 20) alerts.push({ severity:'critical', type:'data_quality', title:`High missing data in ${col.name}`, message:`${missing} records (${missingPct.toFixed(1)}%) have missing values in ${col.name}` })
  })

  // Trend reversal alert
  if (dateCols.length > 0 && numCols.length > 0) {
    const dateCol = dateCols[0].originalName
    const numCol  = numCols[0].originalName
    const sorted  = [...rows].sort((a,b)=>new Date(a[dateCol])-new Date(b[dateCol]))
    const recent  = sorted.slice(-Math.min(10,Math.floor(sorted.length*0.2)))
    const earlier = sorted.slice(0, Math.min(10,Math.floor(sorted.length*0.2)))
    const avgRecent  = mean(recent.map(r=>toNum(r[numCol])).filter(v=>v!==null)||[0])
    const avgEarlier = mean(earlier.map(r=>toNum(r[numCol])).filter(v=>v!==null)||[1])
    if (avgEarlier > 0 && avgRecent < avgEarlier * 0.8) {
      alerts.push({ severity:'warning', type:'trend', title:`Declining trend in ${numCols[0].name}`, message:`Recent values are ${((1-avgRecent/avgEarlier)*100).toFixed(1)}% below earlier period average` })
    }
  }

  return alerts.slice(0, 8)
}

// ── Auto Insight Cards ────────────────────────────────────────────────────────
function computeAutoInsights(rows, schema) {
  const cards = []
  const numCols = schema.filter(c=>c.type==='numeric')
  const catCols = schema.filter(c=>c.type==='categorical')

  numCols.slice(0,2).forEach(col => {
    const vals = rows.map(r=>({ val:toNum(r[col.originalName]), row:r })).filter(x=>x.val!==null)
    if (!vals.length) return
    const sorted = [...vals].sort((a,b)=>b.val-a.val)
    const topRow = sorted[0]
    const botRow = sorted[sorted.length-1]
    const avgVal = mean(vals.map(x=>x.val))

    // Find category label for the top/bottom row
    const catLabel = catCols.length > 0 ? String(topRow.row[catCols[0].originalName]||'') : ''
    const botLabel = catCols.length > 0 ? String(botRow.row[catCols[0].originalName]||'') : ''

    const fmt = v => Math.abs(v)>=1e6?(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(1)+'K':Number(v).toLocaleString(undefined,{maximumFractionDigits:2})

    cards.push({ type:'highest', col:col.name, value:topRow.val, label:`Highest ${col.name}`, context:catLabel?`${catLabel}: ${fmt(topRow.val)}`:`${fmt(topRow.val)}`, icon:'🏆', color:'#34d399' })
    cards.push({ type:'lowest',  col:col.name, value:botRow.val, label:`Lowest ${col.name}`,  context:botLabel?`${botLabel}: ${fmt(botRow.val)}`:`${fmt(botRow.val)}`, icon:'📉', color:'#f87171' })
    cards.push({ type:'average', col:col.name, value:avgVal,     label:`Avg ${col.name}`,      context:fmt(avgVal), icon:'📊', color:'#38bdf8' })
  })

  // Most frequent category
  catCols.slice(0,1).forEach(col => {
    const freq = {}
    rows.forEach(r=>{ const v=String(r[col.originalName]||'').trim(); if(v) freq[v]=(freq[v]||0)+1 })
    const sorted = Object.entries(freq).sort(([,a],[,b])=>b-a)
    if (sorted.length) {
      cards.push({ type:'most_frequent', col:col.name, value:sorted[0][1], label:`Most Frequent ${col.name}`, context:`${sorted[0][0]} (${sorted[0][1]} times)`, icon:'🔁', color:'#a78bfa' })
      if (sorted.length > 1) {
        const least = sorted[sorted.length-1]
        cards.push({ type:'least_frequent', col:col.name, value:least[1], label:`Least Frequent ${col.name}`, context:`${least[0]} (${least[1]} times)`, icon:'🔽', color:'#fbbf24' })
      }
    }
  })

  return cards.slice(0,6)
}

// ── Advanced Statistics ───────────────────────────────────────────────────────
function computeAdvancedStats(rows, schema) {
  const numCols = schema.filter(c=>c.type==='numeric')
  const stats = {}

  numCols.slice(0,6).forEach(col => {
    const vals = rows.map(r=>toNum(r[col.originalName])).filter(v=>v!==null)
    if (vals.length < 2) return
    const s   = [...vals].sort((a,b)=>a-b)
    const n   = s.length
    const m   = mean(vals)
    const sd  = std(vals)
    const q1  = s[Math.floor(n*0.25)]
    const q3  = s[Math.floor(n*0.75)]
    const iqr = q3 - q1
    stats[col.name] = {
      count: n, mean: Math.round(m*100)/100, median: s[Math.floor(n/2)],
      std: Math.round(sd*100)/100, variance: Math.round(sd*sd*100)/100,
      min: s[0], max: s[n-1],
      q1: Math.round(q1*100)/100, q3: Math.round(q3*100)/100, iqr: Math.round(iqr*100)/100,
      p10: s[Math.floor(n*0.10)], p90: s[Math.floor(n*0.90)],
      cv: m!==0?Math.round(sd/Math.abs(m)*1000)/10:null,
      skewness: Math.round(vals.reduce((a,b)=>a+((b-m)/sd)**3,0)/n*100)/100,
    }
  })

  // Correlation matrix
  const correlations = []
  numCols.slice(0,5).forEach((c1,i) => {
    numCols.slice(i+1,5).forEach(c2 => {
      const v1=rows.map(r=>toNum(r[c1.originalName])).filter(v=>v!==null)
      const v2=rows.map(r=>toNum(r[c2.originalName])).filter(v=>v!==null)
      const len=Math.min(v1.length,v2.length)
      if(len<3) return
      const m1=mean(v1.slice(0,len)),m2=mean(v2.slice(0,len))
      const num=v1.slice(0,len).reduce((s,v,k)=>s+(v-m1)*(v2[k]-m2),0)
      const d1=Math.sqrt(v1.slice(0,len).reduce((s,v)=>s+(v-m1)**2,0))
      const d2=Math.sqrt(v2.slice(0,len).reduce((s,v)=>s+(v-m2)**2,0))
      const r=d1&&d2?Math.round(num/(d1*d2)*100)/100:0
      correlations.push({ c1:c1.name,c2:c2.name,r,
        strength:Math.abs(r)>0.7?'Strong':Math.abs(r)>0.4?'Moderate':'Weak',
        direction:r>0?'Positive':'Negative' })
    })
  })

  return { columnStats: stats, correlations: correlations.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r)) }
}

// ── Ranked Insights ───────────────────────────────────────────────────────────
function rankInsights(autoInsights, smartAlerts, advStats, dataHealth, bizHealth) {
  const ranked = []

  // Critical alerts → HIGH
  smartAlerts.filter(a=>a.severity==='critical').forEach(a => {
    ranked.push({ priority:'HIGH', category:'Alert', title:a.title, detail:a.message, icon:'🚨' })
  })
  // Warning alerts → MEDIUM
  smartAlerts.filter(a=>a.severity==='warning').forEach(a => {
    ranked.push({ priority:'MEDIUM', category:'Alert', title:a.title, detail:a.message, icon:'⚠️' })
  })
  // Strong correlations → HIGH
  advStats.correlations.filter(c=>Math.abs(c.r)>0.7).forEach(c => {
    ranked.push({ priority:'HIGH', category:'Correlation', title:`Strong ${c.direction} correlation`, detail:`${c.c1} and ${c.c2} have r=${c.r} (${c.strength})`, icon:'🔗' })
  })
  // Top/bottom performers → MEDIUM
  autoInsights.filter(c=>c.type==='highest'||c.type==='lowest').slice(0,2).forEach(c => {
    ranked.push({ priority:'MEDIUM', category:'Performance', title:c.label, detail:c.context, icon:c.icon })
  })
  // Data quality issues → based on score
  if (dataHealth.score < 70) {
    ranked.push({ priority: dataHealth.score<50?'HIGH':'MEDIUM', category:'Data Quality', title:`Data Health Score: ${dataHealth.score}/100 (${dataHealth.label})`, detail:dataHealth.issues.map(i=>i.msg).join('; ')||'Review data quality', icon:'🛡️' })
  }
  // Business health → LOW for good, HIGH for critical
  if (bizHealth.score < 50) {
    ranked.push({ priority:'HIGH', category:'Business', title:`Business Health: ${bizHealth.score}/100 (${bizHealth.label})`, detail:bizHealth.signals.filter(s=>s.type==='negative').map(s=>s.msg).join('; ')||'Review business metrics', icon:'📉' })
  }
  // Moderate correlations → LOW
  advStats.correlations.filter(c=>Math.abs(c.r)>0.4&&Math.abs(c.r)<=0.7).slice(0,2).forEach(c => {
    ranked.push({ priority:'LOW', category:'Correlation', title:`Moderate ${c.direction} relationship`, detail:`${c.c1} and ${c.c2}: r=${c.r}`, icon:'📊' })
  })

  return ranked.slice(0,10)
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

    const session = global.sessionCache?.[sessionId]
    if (!session) return res.status(404).json({ error: 'Session not found. Re-upload your file.' })

    const { rows, schema } = session
    const reportCache = global.reportCache?.[sessionId] || {}
    const anomalies   = reportCache.anomalies || []

    // Compute all metrics from real data
    const dataHealth  = computeDatasetHealth(rows, schema)
    const bizHealth   = computeBusinessHealth(rows, schema, anomalies)
    const smartAlerts = computeSmartAlerts(rows, schema, anomalies)
    const autoInsights= computeAutoInsights(rows, schema)
    const advStats    = computeAdvancedStats(rows, schema)
    const rankedInsights = rankInsights(autoInsights, smartAlerts, advStats, dataHealth, bizHealth)

    // Build structured summary for Gemini
    const numCols = schema.filter(c=>c.type==='numeric')
    const catCols = schema.filter(c=>c.type==='categorical')
    const dateCols= schema.filter(c=>c.type==='date')
    const idCols  = schema.filter(c=>c.type==='identifier')
    const dupCount= rows.length - new Set(rows.map(r=>JSON.stringify(r))).size

    const summaryFacts = {
      rows: rows.length, columns: schema.length,
      numericCols: numCols.map(c=>c.name), categoricalCols: catCols.map(c=>c.name),
      dateCols: dateCols.map(c=>c.name), identifierCols: idCols.map(c=>c.name),
      missingPct: dataHealth.missingPct, duplicates: dupCount,
      dataHealthScore: dataHealth.score, dataHealthLabel: dataHealth.label,
      bizHealthScore: bizHealth.score, bizHealthLabel: bizHealth.label,
      topInsights: rankedInsights.filter(i=>i.priority==='HIGH').map(i=>i.detail),
      topAlerts: smartAlerts.filter(a=>a.severity==='critical').map(a=>a.message),
      topCorrelations: advStats.correlations.slice(0,3).map(c=>`${c.c1} vs ${c.c2}: r=${c.r} (${c.strength})`),
      colStats: Object.entries(advStats.columnStats).slice(0,3).map(([k,v])=>`${k}: mean=${v.mean}, std=${v.std}, range=[${v.min},${v.max}]`),
    }

    let executiveSummary = null

    if (isAvailable()) {
      try {
        const prompt = `You are an expert data analyst. Write a concise Executive Summary for a business user who just uploaded a dataset.

DATASET FACTS (computed from real data — do NOT invent numbers):
${JSON.stringify(summaryFacts, null, 2)}

Write the summary in this format:
1. Dataset Overview (2 sentences: what the data contains, size, and time span if applicable)
2. Key Findings (3 bullet points using ONLY the numbers above)
3. Data Quality (1 sentence using the health score)
4. Top Risks or Opportunities (2 bullet points based on alerts and correlations)
5. Suggested Next Steps (2 bullet points)

Keep it under 200 words. Be specific, use actual numbers. No generic fluff.`

        const text = await askGemini('You are a senior business analyst writing an executive summary. Be concise and specific.', prompt)
        if (text?.trim()) executiveSummary = text.trim()
      } catch(e) {
        console.warn('[EXECUTIVE] Gemini failed, using fallback:', e.message?.slice(0,60))
      }
    }

    // Fallback summary
    if (!executiveSummary) {
      const fmt = v => Math.abs(v)>=1e6?(v/1e6).toFixed(2)+'M':Math.abs(v)>=1e3?(v/1e3).toFixed(1)+'K':Number(v).toLocaleString(undefined,{maximumFractionDigits:2})
      const firstStat = Object.entries(advStats.columnStats)[0]
      executiveSummary = `**Dataset Overview:** ${rows.length.toLocaleString()} records across ${schema.length} columns` +
        (dateCols.length ? ` with date information.` : `.`) +
        `\n\n**Key Findings:**\n` +
        (firstStat ? `• ${firstStat[0]}: mean=${fmt(firstStat[1].mean)}, range [${fmt(firstStat[1].min)}–${fmt(firstStat[1].max)}]\n` : '') +
        (catCols.length ? `• ${catCols.length} categorical dimension${catCols.length>1?'s':''}: ${catCols.slice(0,3).map(c=>c.name).join(', ')}\n` : '') +
        (anomalies.length ? `• ${anomalies.length} statistical anomaly detected\n` : '• No anomalies detected\n') +
        `\n**Data Quality:** ${dataHealth.label} (${dataHealth.score}/100)` +
        (dataHealth.missingPct > 0 ? ` — ${dataHealth.missingPct}% missing values` : '') + `.` +
        (smartAlerts.length ? `\n\n**Key Alert:** ${smartAlerts[0].message}` : '')
    }

    res.json({
      executiveSummary,
      dataHealth,
      bizHealth,
      smartAlerts,
      autoInsights,
      advancedStats: advStats,
      rankedInsights,
    })
  } catch(err) { next(err) }
})

module.exports = router
