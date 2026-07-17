/**
 * AI Query Route — Intelligent Chart Generation Engine
 *
 * Pipeline:
 * 1. Read user selections (chart_type, metric, dimension from forcedConfig)
 * 2. Profile every column semantically (MEASURE / CONTINUOUS / IDENTIFIER / ORDINAL / TEMPORAL / DIMENSION)
 * 3. Decide aggregation using semantic engine — never blindly SUM numeric columns
 * 4. Validate aggregation (block SUM(Semester), SUM(StudentID), etc.)
 * 5. Aggregate data using backend math — never raw values
 * 6. Return chart data + semantic explanation
 */

const express  = require('express')
const router   = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')
const { profileColumns }        = require('../utils/semanticProfiler')
const { resolveAggregation }    = require('../utils/aggregationEngine')

// ── Math helpers ──────────────────────────────────────────────────────────────
const toNum = v => { const n = parseFloat(String(v).replace(/[$,%\s]/g,'')); return isNaN(n)?null:n }
const mean  = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
const median= arr => { const s=[...arr].sort((a,b)=>a-b); const m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2 }
const stddev= arr => { const m=mean(arr); return Math.sqrt(arr.reduce((a,b)=>a+(b-m)**2,0)/arr.length) }

// ── Semantic aggregation (replaces old detectAggregation) ─────────────────────
// The old function blindly returned 'sum' for any numeric column.
// Now we use the full semantic engine: see utils/aggregationEngine.js
// This wrapper is kept for backward compat with inline callers.
function detectAggregation(colName, userQuery, forcedAgg, semanticProfiles) {
  const result = resolveAggregation(colName, semanticProfiles || null, userQuery, forcedAgg)
  return result.agg
}

// ── Step 2: Validate chart type against data ──────────────────────────────────
function validateChartType(chartType, dimCol, metricCol, schema, rows) {
  const dim  = schema.find(c => c.name === dimCol || c.originalName === dimCol)
  const met  = schema.find(c => c.name === metricCol || c.originalName === metricCol)
  const numCats = dim ? [...new Set(rows.map(r => r[dim.originalName]).filter(Boolean))].length : 0

  if (chartType === 'pie' || chartType === 'donut') {
    if (!dim || dim.type !== 'categorical') {
      return { valid: false, reason: 'Pie chart requires a categorical column for slices.', suggest: 'bar' }
    }
    if (!met || met.type !== 'numeric') {
      return { valid: false, reason: 'Pie chart requires a numeric column for slice sizes.', suggest: 'bar' }
    }
    if (numCats > 8) {
      return { valid: false, reason: `Too many categories (${numCats}) for a pie chart. Pie charts work best with 6 or fewer.`, suggest: 'bar' }
    }
    return { valid: true }
  }

  if (chartType === 'line' || chartType === 'area') {
    const dateCol = schema.find(c => c.type === 'date')
    if (!dateCol && (!dim || dim.type !== 'date')) {
      return { valid: false, reason: 'Line chart requires a date/time column for the X-axis. No date column found.', suggest: 'bar' }
    }
    return { valid: true }
  }

  // Scatter — allow when both cols are numeric OR just proceed if user selected them
  if (chartType === 'scatter') {
    const numCols = schema.filter(c => c.type === 'numeric')
    if (numCols.length < 2) {
      return { valid: false, reason: 'Scatter plot requires at least 2 numeric columns.', suggest: 'bar' }
    }
    return { valid: true }
  }

  // Histogram — allow for any numeric column
  if (chartType === 'histogram') {
    const numCols = schema.filter(c => c.type === 'numeric')
    if (numCols.length === 0) {
      return { valid: false, reason: 'Histogram requires a numeric column.', suggest: 'bar' }
    }
    return { valid: true }
  }

  // KDE — allow for any numeric column
  if (chartType === 'kde') {
    const numCols = schema.filter(c => c.type === 'numeric')
    if (numCols.length === 0) {
      return { valid: false, reason: 'KDE Density requires a numeric column.', suggest: 'histogram' }
    }
    return { valid: true }
  }

  // All other charts (bar, horizontalBar, multiLine, heatmap) — allow
  return { valid: true }
}

// ── Step 3: Aggregate data — backend computes all values ──────────────────────
function aggregateData(rows, dimCol, metricCol, agg, schema) {
  const dim = schema.find(c => c.name === dimCol || c.originalName === dimCol)
  const met = schema.find(c => c.name === metricCol || c.originalName === metricCol)

  if (!dim) return { error: `Column "${dimCol}" not found. Available: ${schema.map(c=>c.name).join(', ')}` }

  // GROUP BY dimension
  const groups = {}
  rows.forEach(row => {
    const key = String(row[dim.originalName] || 'Unknown').trim()
    if (!groups[key]) groups[key] = []
    if (met) {
      const v = toNum(row[met.originalName])
      if (v !== null) groups[key].push(v)
    } else {
      groups[key].push(1) // COUNT mode — push 1 per row
    }
  })

  const aggFn = (vals) => {
    if (!vals.length) return 0
    switch(agg) {
      case 'sum':   return Math.round(vals.reduce((a,b)=>a+b,0) * 100) / 100
      case 'avg':   return Math.round(mean(vals) * 100) / 100
      case 'count': return vals.length
      case 'min':   return Math.min(...vals)
      case 'max':   return Math.max(...vals)
      default:      return Math.round(vals.reduce((a,b)=>a+b,0) * 100) / 100
    }
  }

  const result = Object.entries(groups)
    .map(([name, vals]) => ({ name, value: aggFn(vals), count: vals.length }))
    .filter(d => d.value !== null && !isNaN(d.value))
    .sort((a,b) => b.value - a.value)

  const total = result.reduce((s,d) => s + d.value, 0)
  return result.map(d => ({
    ...d,
    pct: total > 0 ? Math.round(d.value / total * 1000) / 10 : 0
  }))
}

// ── Step 4: Build trend data for line/area charts ─────────────────────────────
function buildTrend(rows, dateColName, metricColName, agg, schema) {
  const dateCol = schema.find(c => c.name === dateColName || c.originalName === dateColName || c.type === 'date')
  const metCol  = schema.find(c => c.name === metricColName || c.originalName === metricColName)
  if (!dateCol) return { error: 'No date column found.' }
  if (!metCol)  return { error: `Column "${metricColName}" not found.` }

  const grouped = {}
  rows.forEach(row => {
    const d = new Date(row[dateCol.originalName])
    if (isNaN(d)) return
    const key = d.toISOString().slice(0,7) // YYYY-MM
    const v   = toNum(row[metCol.originalName])
    if (!grouped[key]) grouped[key] = []
    if (v !== null) grouped[key].push(v)
  })

  const aggFn = vals => {
    switch(agg) {
      case 'avg': return Math.round(mean(vals)*100)/100
      case 'min': return Math.min(...vals)
      case 'max': return Math.max(...vals)
      default:    return Math.round(vals.reduce((a,b)=>a+b,0)*100)/100
    }
  }

  return Object.entries(grouped)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, value: aggFn(vals), count: vals.length }))
}

// ── Step 5: Build scatter data ────────────────────────────────────────────────
function buildScatter(rows, xColName, yColName, schema) {
  const xCol = schema.find(c => c.name === xColName || c.originalName === xColName)
  const yCol = schema.find(c => c.name === yColName || c.originalName === yColName)
  if (!xCol || !yCol) return { error: `Column not found.` }
  return rows.map(r => {
    const x = toNum(r[xCol.originalName]), y = toNum(r[yCol.originalName])
    if (x===null||y===null) return null
    return { x, y }
  }).filter(Boolean).slice(0, 500)
}

// ── Step 6: Build histogram ───────────────────────────────────────────────────
function buildHistogram(rows, colName, bins, schema) {  const col = schema.find(c => c.name === colName || c.originalName === colName)
  if (!col) return { error: `Column "${colName}" not found.` }
  const vals = rows.map(r => toNum(r[col.originalName])).filter(v => v !== null)
  if (!vals.length) return { error: 'No numeric values found.' }
  const bkt = Math.max(3, Math.min(30, bins||10))
  const mn = Math.min(...vals), mx = Math.max(...vals)
  const step = (mx - mn) / bkt || 1
  const hist = Array.from({length:bkt}, (_,i) => ({
    range: `${(mn+i*step).toFixed(1)}–${(mn+(i+1)*step).toFixed(1)}`, count: 0
  }))
  vals.forEach(v => { const idx = Math.min(Math.floor((v-mn)/step), bkt-1); hist[idx].count++ })
  return { data: hist, label: col.name, stats: {
    mean: Math.round(mean(vals)*100)/100, median: Math.round(median(vals)*100)/100,
    std: Math.round(stddev(vals)*100)/100, min: mn, max: mx, count: vals.length
  }}
}

// ── Step 6b: Build KDE ───────────────────────────────────────────────────────
function buildKDE(rows, colName, schema) {
  const col = schema.find(c => c.name === colName || c.originalName === colName)
  if (!col) return { error: `Column "${colName}" not found.` }
  const vals = rows.map(r => toNum(r[col.originalName])).filter(v => v !== null)
  if (vals.length < 5) return { error: 'KDE requires at least 5 data points.' }
  const n = vals.length
  const m = mean(vals)
  const variance = vals.reduce((a,b) => a+(b-m)**2, 0) / n
  const bw = 1.06 * Math.sqrt(variance) * Math.pow(n, -0.2) || 1
  const lo = Math.min(...vals), hi = Math.max(...vals), rng = hi - lo || 1
  const pts = 50, stp = rng / pts
  const data = Array.from({length:pts+1}, (_,i) => {
    const x = lo + i * stp
    const d = vals.reduce((s,xi) => { const z=(x-xi)/bw; return s+Math.exp(-0.5*z*z)/(Math.sqrt(2*Math.PI)) }, 0) / (n * bw)
    return { x: Math.round(x*100)/100, density: Math.round(d*10000)/10000 }
  })
  return { data, xKey:'x', yKey:'density', label:col.name, xLabel:col.name, yLabel:'Probability Density', chartType:'kde', mean:Math.round(m*100)/100, bandwidth:Math.round(bw*100)/100, rowsUsed:n }
}

// ── Build explanation text ────────────────────────────────────────────────────
function buildExplanation(chartType, dimCol, metricCol, agg, validation, aggDecision) {
  const aggLabel = { sum:'SUM', avg:'AVERAGE', count:'COUNT', min:'MINIMUM', max:'MAXIMUM' }[agg] || agg.toUpperCase()
  const semanticReason = aggDecision?.recommendation || ''
  const why = aggDecision?.warning
    ? aggDecision.warning
    : {
        sum:   `${metricCol} is an additive measure — SUM gives the correct total per group.`,
        avg:   `${metricCol} is a rate/ratio — AVERAGE gives a meaningful comparison.`,
        count: `Counting records per ${dimCol} to show frequency distribution.`,
        min:   `Showing the minimum ${metricCol} per ${dimCol}.`,
        max:   `Showing the maximum ${metricCol} per ${dimCol}.`,
      }[agg] || ''
  return {
    aggregation_used: aggLabel,
    chart_type: chartType,
    category: dimCol,
    value: metricCol || '(record count)',
    reason: semanticReason || why,
    validation_note: validation?.reason || null,
    suggested_chart: validation?.suggest || null,
  }
}

// ── Gemini natural language → structured query ────────────────────────────────
async function parseNaturalLanguage(query, schema, forcedChartType) {
  if (!isAvailable()) return null
  const cols = schema.map(c => `"${c.name}" [${c.type}]`).join(', ')
  const prompt = `Given this dataset schema: ${cols}
User asks: "${query}"
${forcedChartType ? `Chart type requested: ${forcedChartType}` : ''}

Return ONLY valid JSON (no markdown):
{"chart_type":"bar|pie|line|area|scatter|histogram|donut|horizontalBar","dimension":"<exact column name for grouping/X-axis>","metric":"<exact column name for Y-axis value, or null>","metric2":"<second numeric col for scatter, or null>","aggregation":"sum|avg|count|min|max","query_intent":"<brief description>"}`

  try {
    const text = await askGemini('You are a data analysis query parser. Return only valid JSON.', prompt)
    if (!text) return null
    let jsonStr = text.replace(/```(?:json)?\s*/gi,'').replace(/```/g,'').trim()
    const match = jsonStr.match(/\{[\s\S]*\}/)
    if (!match) return null
    const cleaned = match[0].replace(/,\s*}/g,'}').replace(/,\s*]/g,']')
    return JSON.parse(cleaned)
  } catch(e) {
    console.warn('[AIQUERY] Gemini parse failed:', e.message.slice(0,60))
    return null
  }
}

// ── MAIN ROUTE ────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, query, conversationHistory = [] } = req.body
    const forcedConfig = req.body.forcedConfig

    if (!query?.trim())  return res.status(400).json({ error: 'query is required.' })
    if (!sessionId)      return res.status(400).json({ error: 'sessionId is required.' })

    const session = global.sessionCache?.[sessionId]
    if (!session)        return res.status(404).json({ error: 'Session not found. Please re-upload your dataset.' })

    const { rows, schema } = session

    // ── Step 1: Build semantic profiles (profile every column once per request) ─
    // This is the core change: we classify each column semantically before
    // deciding any aggregation. Profiles are cached on session for efficiency.
    if (!session.semanticProfiles) {
      session.semanticProfiles = profileColumns(rows, schema)
      console.log('[AIQUERY] Built semantic profiles:', session.semanticProfiles.map(p=>`${p.name}→${p.semanticType}`).join(', '))
    }
    const semanticProfiles = session.semanticProfiles

    // ── Step 2: Determine chart config ───────────────────────────────────────
    let chartType, dimCol, metricCol, metric2Col, userAgg, bins, limit

    if (forcedConfig && forcedConfig.chart_type) {
      // User explicitly selected via dropdowns — use exactly as-is
      chartType   = forcedConfig.chart_type
      dimCol      = forcedConfig.dimension || null
      metricCol   = forcedConfig.metric    || null
      metric2Col  = forcedConfig.metric2   || null
      userAgg     = forcedConfig.aggregation || null
      bins        = forcedConfig.bins ? parseInt(forcedConfig.bins) : 10
      limit       = forcedConfig.limit && forcedConfig.limit !== 'All' ? parseInt(forcedConfig.limit) : null
      console.log(`[AIQUERY] ForcedConfig: chart=${chartType} dim=${dimCol} metric=${metricCol} agg=${userAgg}`)
    } else {
      // Natural language — try Gemini, fallback to local
      const numCols  = schema.filter(c=>c.type==='numeric')
      const catCols  = schema.filter(c=>c.type==='categorical')
      const dateCols = schema.filter(c=>c.type==='date')
      let parsed = null
      if (isAvailable()) {
        parsed = await parseNaturalLanguage(query, schema, null)
      }
      if (parsed) {
        chartType  = parsed.chart_type || 'bar'
        dimCol     = parsed.dimension  || catCols[0]?.name
        metricCol  = parsed.metric     || numCols[0]?.name
        metric2Col = parsed.metric2    || null
        userAgg    = parsed.aggregation|| null
      } else {
        // Local fallback
        const q = query.toLowerCase()
        chartType  = /pie|donut/.test(q)?'pie':/line|trend/.test(q)&&dateCols.length?'line':/scatter/.test(q)?'scatter':/histogram|distribut/.test(q)?'histogram':'bar'
        dimCol     = dateCols[0]?.name || catCols[0]?.name
        metricCol  = numCols[0]?.name
      }
    }

    // ── Step 3: Semantic aggregation decision ─────────────────────────────────
    // Use the full pipeline: user intent → semantic type → validation → fallback
    const aggDecision = resolveAggregation(metricCol, semanticProfiles, query, userAgg)
    const agg         = aggDecision.agg
    console.log(`[AIQUERY] chart=${chartType} dim=${dimCol} metric=${metricCol} agg=${agg} source=${aggDecision.source} semantic=${semanticProfiles.find(p=>p.name===metricCol)?.semanticType||'?'}`)

    // ── Step 4: Validate chart type ──────────────────────────────────────────
    const validation = validateChartType(chartType, dimCol, metricCol, schema, rows)
    if (!validation.valid) {
      console.log(`[AIQUERY] Chart invalid: ${validation.reason} → using ${validation.suggest}`)
      chartType = validation.suggest || 'bar'
    }

    // ── Step 5: Build chart data ──────────────────────────────────────────────
    let chartData = null

    if (chartType === 'scatter') {
      // Use metric as X, metric2 as Y — or first two numeric cols
      const numCols = schema.filter(c => c.type === 'numeric')
      const xColName = metricCol || numCols[0]?.name
      const yColName = metric2Col || numCols[1]?.name || numCols[0]?.name
      const raw = buildScatter(rows, xColName, yColName, schema)
      if (raw.error) return res.status(400).json({ error: raw.error })
      chartData = { data: raw, xKey:'x', yKey:'y', xLabel:xColName, yLabel:yColName, chartType:'scatter', rowsUsed:raw.length }

    } else if (chartType === 'histogram') {
      const colForHist = metricCol || schema.filter(c=>c.type==='numeric')[0]?.name
      const r = buildHistogram(rows, colForHist, bins, schema)
      if (r.error) return res.status(400).json({ error: r.error })
      chartData = { data: r.data, xKey:'range', yKey:'count', label:colForHist, chartType:'histogram', stats:r.stats, rowsUsed:r.data.reduce((s,d)=>s+d.count,0) }

    } else if (chartType === 'kde') {
      const colForKde = metricCol || schema.filter(c=>c.type==='numeric')[0]?.name
      const kdeResult = buildKDE(rows, colForKde, schema)
      if (kdeResult.error) return res.status(400).json({ error: kdeResult.error })
      chartData = kdeResult

    } else if (chartType === 'heatmap') {
      // Heatmap = Pearson correlation matrix between all numeric columns
      const numCols = schema.filter(c => c.type === 'numeric').slice(0, 8)
      if (numCols.length < 2) return res.status(400).json({ error: 'Heatmap requires at least 2 numeric columns.' })
      const matrix = []
      for (let i = 0; i < numCols.length; i++) {
        for (let j = 0; j < numCols.length; j++) {
          const v1 = rows.map(r => toNum(r[numCols[i].originalName])).filter(v => v !== null)
          const v2 = rows.map(r => toNum(r[numCols[j].originalName])).filter(v => v !== null)
          const len = Math.min(v1.length, v2.length)
          let corr = 0
          if (len >= 3 && i !== j) {
            const m1 = mean(v1.slice(0,len)), m2 = mean(v2.slice(0,len))
            const num = v1.slice(0,len).reduce((s,v,k) => s+(v-m1)*(v2[k]-m2), 0)
            const d1 = Math.sqrt(v1.slice(0,len).reduce((s,v) => s+(v-m1)**2, 0))
            const d2 = Math.sqrt(v2.slice(0,len).reduce((s,v) => s+(v-m2)**2, 0))
            corr = d1 && d2 ? Math.round(num/(d1*d2)*100)/100 : 0
          } else if (i === j) {
            corr = 1
          }
          matrix.push({ x: numCols[i].name, y: numCols[j].name, value: corr })
        }
      }
      chartData = { data: matrix, cols: numCols.map(c=>c.name), chartType: 'heatmap', rowsUsed: rows.length }

    } else if (['line','area','multiLine'].includes(chartType)) {
      const raw = buildTrend(rows, dimCol, metricCol, agg, schema)
      if (raw.error) {
        // Fallback to bar if no date col
        const aggData = aggregateData(rows, dimCol, metricCol, agg, schema)
        if (aggData.error) return res.status(400).json({ error: aggData.error })
        const applyLimit = limit ? aggData.slice(0, limit) : aggData
        chartData = { data: applyLimit, xKey:'name', yKey:'value', label:metricCol||'count', xLabel:dimCol, yLabel:metricCol||'count', chartType:'bar', rowsUsed:rows.length }
      } else {
        chartData = { data: raw, xKey:'date', yKey:'value', label:metricCol, chartType, rowsUsed:rows.length }
      }

    } else {
      // bar, horizontalBar, pie, donut — all use GROUP BY aggregation
      const aggData = aggregateData(rows, dimCol, metricCol, agg, schema)
      if (aggData.error) return res.status(400).json({ error: aggData.error })
      const applyLimit = limit ? aggData.slice(0, limit) : aggData
      const total = applyLimit.reduce((s,d) => s + d.value, 0)
      chartData = {
        data: applyLimit,
        xKey:'name', yKey:'value',
        label: metricCol ? `${agg.toUpperCase()}(${metricCol})` : 'COUNT',
        xLabel: dimCol, yLabel: metricCol || 'Count',
        chartType, total,
        rowsUsed: rows.length,
      }
    }

    // ── Step 6: Generate explanation ─────────────────────────────────────────
    const metricSemanticProfile = semanticProfiles.find(p => p.name === metricCol || p.originalName === metricCol)
    const explanation = buildExplanation(chartType, dimCol, metricCol, agg, validation.valid ? null : validation, aggDecision)

    // ── Step 7: Generate insights ─────────────────────────────────────────────
    const insights = []
    if (chartData.data?.length > 0 && !['scatter','histogram'].includes(chartType)) {
      const data = chartData.data
      const fmt  = v => v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(1)+'K':Number(v).toLocaleString(undefined,{maximumFractionDigits:2})
      const total = data.reduce((s,d)=>s+d.value,0)
      if (data[0]) insights.push(`"${data[0].name}" has the highest value: ${fmt(data[0].value)} (${data[0].pct||0}% of total).`)
      if (data.length>1) insights.push(`"${data[data.length-1].name}" has the lowest value: ${fmt(data[data.length-1].value)}.`)
      insights.push(`${agg.toUpperCase()} across ${data.length} categories from ${rows.length.toLocaleString()} records.`)
    }

    // Include semantic warning in insights if present
    if (aggDecision.warning) {
      insights.unshift(aggDecision.warning)
    }

    res.json({
      query,
      decision: {
        chart_type: chartType,
        metric: metricCol,
        dimension: dimCol,
        aggregation: agg,
        aggregation_source: aggDecision.source,
        aggregation_recommendation: aggDecision.recommendation,
        aggregation_warning: aggDecision.warning,
        semantic_type: metricSemanticProfile?.semanticType || null,
        semantic_confidence: metricSemanticProfile?.confidence || null,
        executive_summary: `${explanation.aggregation_used} of ${metricCol||'records'} grouped by ${dimCol}. ${explanation.reason}`,
        insights,
        follow_ups: [
          `Show ${metricCol||'records'} by a different category`,
          `Compare as a different chart type`,
          `Filter to a specific subset`,
        ],
        reason: explanation.reason,
        validation_note: explanation.validation_note,
        suggested_chart: explanation.suggested_chart,
        ...explanation,
      },
      chartData,
      source: 'local',
      meta: { rowsAnalyzed: rows.length, columnsUsed: [metricCol, dimCol].filter(Boolean) }
    })

  } catch (err) {
    next(err)
  }
})

module.exports = router
