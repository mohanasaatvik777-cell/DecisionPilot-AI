const express  = require('express')
const router   = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')
const { validateCharts } = require('../utils/chartValidator')
const { profileColumns }  = require('../utils/semanticProfiler')
const { resolveAggregation } = require('../utils/aggregationEngine')

// ── Chart type definitions — what fields each chart needs ─────────────────────
const CHART_DEFINITIONS = {
  bar: {
    label: 'Bar Chart', emoji: '📊',
    desc: 'Compare values across categories',
    fields: [
      { key: 'dimension', label: 'X-Axis (Category)', required: true,  types: ['categorical','date'] },
      { key: 'metric',    label: 'Y-Axis (Value)',    required: true,  types: ['numeric'] },
      { key: 'limit',     label: 'Max Bars',          required: false, static: ['5','10','15','20','All'] },
    ],
  },
  horizontalBar: {
    label: 'Horizontal Bar', emoji: '📊',
    desc: 'Rank many categories side by side',
    fields: [
      { key: 'dimension', label: 'Category (Y-Axis)', required: true,  types: ['categorical'] },
      { key: 'metric',    label: 'Value (X-Axis)',    required: true,  types: ['numeric'] },
      { key: 'limit',     label: 'Max Bars',          required: false, static: ['10','15','20','All'] },
    ],
  },
  line: {
    label: 'Line Chart', emoji: '📈',
    desc: 'Show trends over time',
    fields: [
      { key: 'dimension',        label: 'X-Axis (Time)',     required: true,  types: ['date','categorical'] },
      { key: 'metric',           label: 'Y-Axis (Value)',    required: true,  types: ['numeric'] },
      { key: 'time_granularity', label: 'Time Grouping',     required: false, static: ['day','week','month','year'] },
    ],
  },
  area: {
    label: 'Area Chart', emoji: '📈',
    desc: 'Show volume trends over time',
    fields: [
      { key: 'dimension',        label: 'X-Axis (Time)',     required: true,  types: ['date','categorical'] },
      { key: 'metric',           label: 'Y-Axis (Value)',    required: true,  types: ['numeric'] },
      { key: 'time_granularity', label: 'Time Grouping',     required: false, static: ['day','week','month','year'] },
    ],
  },
  pie: {
    label: 'Pie Chart', emoji: '🥧',
    desc: 'Show part-to-whole proportions',
    fields: [
      { key: 'dimension', label: 'Slice (Category)',   required: true, types: ['categorical'] },
      { key: 'metric',    label: 'Slice Size (Value)', required: true, types: ['numeric'] },
    ],
  },
  donut: {
    label: 'Donut Chart', emoji: '🍩',
    desc: 'Pie with a hole — market share',
    fields: [
      { key: 'dimension', label: 'Slice (Category)',   required: true, types: ['categorical'] },
      { key: 'metric',    label: 'Slice Size (Value)', required: true, types: ['numeric'] },
    ],
  },
  scatter: {
    label: 'Scatter Plot', emoji: '🔵',
    desc: 'Relationship between two numeric values',
    fields: [
      { key: 'metric',    label: 'X-Axis (Numeric)', required: true, types: ['numeric'] },
      { key: 'metric2',   label: 'Y-Axis (Numeric)', required: true, types: ['numeric'] },
      { key: 'dimension', label: 'Color / Group By',  required: false, types: ['categorical'] },
    ],
  },
  histogram: {
    label: 'Histogram', emoji: '📊',
    desc: 'Distribution / frequency of values',
    fields: [
      { key: 'metric', label: 'Value Column', required: true, types: ['numeric'] },
      { key: 'bins',   label: 'Number of Bins', required: false, static: ['5','8','10','15','20'] },
    ],
  },
  kde: {
    label: 'KDE Density', emoji: '〽️',
    desc: 'Smooth density curve of a distribution',
    fields: [
      { key: 'metric', label: 'Value Column', required: true, types: ['numeric'] },
    ],
  },
  heatmap: {
    label: 'Heatmap', emoji: '🔲',
    desc: 'Correlation between all numeric columns',
    fields: [
      { key: 'note', label: 'Note', required: false, static: ['Uses all numeric columns automatically'] },
    ],
  },
  multiLine: {
    label: 'Multi-Line Chart', emoji: '📉',
    desc: 'Compare multiple metrics over time',
    fields: [
      { key: 'dimension', label: 'X-Axis (Time)',      required: true,  types: ['date'] },
      { key: 'metrics',   label: 'Y-Axis (Metrics)',   required: true,  types: ['numeric'], multi: true },
    ],
  },
}

// ── Local fallback: suggest columns per field based on types ──────────────────
function localSuggestFields(schema, aggregateStats) {
  const profiles  = aggregateStats.columnProfiles || []
  const numCols   = schema.filter(c => c.type === 'numeric')
  const catCols   = schema.filter(c => c.type === 'categorical')
  const dateCols  = schema.filter(c => c.type === 'date')

  // Score columns: financial totals > count metrics > rates
  // IMPORTANT: exclude columns that are semantically not suitable as metrics (IDs, ordinals, etc.)
  const scoreNumeric = (col) => {
    const p = profiles.find(p => p.name === col.name)
    if (p?.isLikelyMoney) return 3
    if (col.name.match(/count|qty|quantity|units/i)) return 2
    if (p?.isLikelyRate) return 1
    return 2
  }

  const sortedNum = [...numCols].sort((a,b) => scoreNumeric(b) - scoreNumeric(a))
  const sortedCat = [...catCols].sort((a,b) => {
    const pa = profiles.find(p => p.name === a.name)
    const pb = profiles.find(p => p.name === b.name)
    const ua = pa?.uniqueCount || 999, ub = pb?.uniqueCount || 999
    // Prefer grouping columns with moderate unique count (not IDs)
    return Math.abs(ua - 8) - Math.abs(ub - 8)
  })

  const suggestions = {}
  Object.entries(CHART_DEFINITIONS).forEach(([chartKey, def]) => {
    suggestions[chartKey] = {}
    def.fields.forEach(field => {
      if (field.static) { suggestions[chartKey][field.key] = field.static; return }
      if (field.key === 'note') { suggestions[chartKey][field.key] = []; return }

      const relevantTypes = field.types || []
      let options = []

      if (relevantTypes.includes('numeric'))      options.push(...sortedNum.map(c => c.name))
      if (relevantTypes.includes('categorical'))  options.push(...sortedCat.map(c => c.name))
      if (relevantTypes.includes('date'))         options.push(...dateCols.map(c => c.name))

      // Remove dupes
      suggestions[chartKey][field.key] = [...new Set(options)].slice(0, 8)
    })
  })

  return {
    suggestions,
    defaultSelections: buildDefaults(sortedNum, sortedCat, dateCols),
    source: 'local',
  }
}

function buildDefaults(sortedNum, sortedCat, dateCols) {
  return {
    metric:    sortedNum[0]?.name || null,
    metric2:   sortedNum[1]?.name || null,
    dimension: dateCols[0]?.name || sortedCat[0]?.name || null,
    metrics:   sortedNum.slice(0, 3).map(c => c.name),
  }
}

// ── Claude-powered field suggestions ─────────────────────────────────────────
async function claudeSuggestFields(schema, aggregateStats) {
  if (!isAvailable()) return null

  const profiles  = aggregateStats.columnProfiles || []
  const colGuide  = profiles.map(p => {
    let d = `  "${p.name}" [${p.type}]`
    if (p.type === 'numeric')      d += ` — min:${p.min}, max:${p.max}, mean:${p.mean}${p.isLikelyMoney?' (financial total)':p.isLikelyRate?' (rate/ratio)':''}`
    if (p.type === 'categorical')  d += ` — ${p.uniqueCount} unique: [${(p.topValues||[]).join(', ')}]${p.isLikelyGroup?' (grouping col)':''}`
    if (p.type === 'date')         d += ` — ${p.from} to ${p.to}, best granularity: ${p.bestGranularity}`
    return d
  }).join('\n')

  const systemPrompt = `You are a data visualization expert. Given a dataset's column profiles, suggest the best column options for each field of each chart type. Only use column names that ACTUALLY EXIST in the profiles.`

  const chartList = Object.keys(CHART_DEFINITIONS)
  const userMsg = `Dataset columns:\n${colGuide}\n\nFor chart types: ${chartList.join(', ')}\n\nRespond with ONLY valid JSON:\n{"suggestions":{"bar":{"dimension":["col"],"metric":["col"],"limit":["5","10","15","20","All"]},"horizontalBar":{"dimension":["col"],"metric":["col"],"limit":["10","15","20","All"]},"line":{"dimension":["dateCol"],"metric":["col"],"time_granularity":["month","year","day","week"]},"area":{"dimension":["dateCol"],"metric":["col"],"time_granularity":["month","year","day","week"]},"pie":{"dimension":["catCol"],"metric":["numCol"]},"donut":{"dimension":["catCol"],"metric":["numCol"]},"scatter":{"metric":["numCol1"],"metric2":["numCol2"],"dimension":["catCol"]},"histogram":{"metric":["numCol"],"bins":["5","8","10","15","20"]},"kde":{"metric":["numCol"]},"heatmap":{"note":[]},"multiLine":{"dimension":["dateCol"],"metrics":["col1","col2"]}},"defaultSelections":{"metric":"bestNumericCol","metric2":"secondNumericCol","dimension":"bestDateOrCatCol","metrics":["col1","col2"]},"source":"gemini"}`

  const text = await askGemini(systemPrompt, userMsg)
  if (!text) return null
  // Robust JSON extraction — handle markdown fences and trailing commas
  let jsonStr = text
  // Remove markdown fences
  jsonStr = jsonStr.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
  // Extract first valid JSON object
  const match = jsonStr.match(/\{[\s\S]*\}/)
  if (!match) return null
  // Fix common Gemini JSON issues: trailing commas before } or ]
  const cleaned = match[0]
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // remove control chars
  return JSON.parse(cleaned)
}

// ── Build minimal stats directly from raw rows (when analyze hasn't run yet) ──
function buildMinimalStats(rows, schema) {
  const toNum = v => { const n = parseFloat(String(v).replace(/[$,%]/g,'')); return isNaN(n) ? null : n }

  const columnProfiles = schema.map(col => {
    const vals = rows.map(r => r[col.originalName]).filter(v => v !== null && v !== undefined && v !== '')
    const nullCount = rows.length - vals.length
    const profile = {
      name: col.name, originalName: col.originalName, type: col.type,
      nullCount, nullPct: +(nullCount / rows.length * 100).toFixed(1),
      sampleValues: [...new Set(vals.slice(0,20).map(v=>String(v)))].slice(0,5),
    }
    if (col.type === 'numeric') {
      const nums = vals.map(v => toNum(v)).filter(v => v !== null)
      if (nums.length) {
        const sorted = [...nums].sort((a,b)=>a-b)
        const m = nums.reduce((a,b)=>a+b,0)/nums.length
        profile.min    = sorted[0]
        profile.max    = sorted[sorted.length-1]
        profile.mean   = Math.round(m*100)/100
        profile.median = sorted[Math.floor(sorted.length/2)]
        profile.uniqueCount = new Set(nums).size
        profile.isLikelyMoney = /revenue|sales|profit|cost|price|amount|income|spend|fee|salary|wage/i.test(col.name)
        profile.isLikelyRate  = /rate|ratio|pct|percent|score|index|rank/i.test(col.name)
      }
    }
    if (col.type === 'categorical') {
      const unique = [...new Set(vals.map(v=>String(v)))]
      profile.uniqueCount   = unique.length
      profile.topValues     = unique.slice(0,6)
      profile.isLikelyGroup = /region|country|city|department|category|segment|type|group|channel|product|brand/i.test(col.name)
    }
    if (col.type === 'date') {
      const dates = vals.map(v => new Date(v)).filter(d => !isNaN(d)).sort((a,b)=>a-b)
      if (dates.length) {
        const span = Math.round((dates[dates.length-1]-dates[0])/(1000*60*60*24))
        profile.from = dates[0].toISOString().slice(0,10)
        profile.to   = dates[dates.length-1].toISOString().slice(0,10)
        profile.spanDays = span
        profile.bestGranularity = span > 730 ? 'year' : span > 60 ? 'month' : span > 14 ? 'week' : 'day'
        profile.isTimeDimension = true
      }
    }
    return profile
  })

  return {
    rowCount: rows.length, columnCount: schema.length,
    columns: schema.map(c => ({ name: c.name, type: c.type })),
    columnProfiles, kpis: {}, topCategories: [], dateRange: null,
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' })

    const session = global.sessionCache?.[sessionId]
    if (!session)   return res.status(404).json({ error: 'Session not found. Please re-upload your dataset.' })

    const { schema, rows } = session
    const cache            = global.reportCache?.[sessionId] || {}

    // Build aggregateStats — use from reportCache if available, else build minimal from session
    let aggregateStats = cache.aggregateStats || {}

    // If columnProfiles not yet built (analyze hasn't run yet), build them now from raw rows
    if (!aggregateStats.columnProfiles?.length) {
      aggregateStats = buildMinimalStats(rows, schema)
    }

    // ── Build semantic profiles (cached on session) ───────────────────────
    if (!session.semanticProfiles) {
      session.semanticProfiles = profileColumns(rows, schema)
    }
    const semanticProfiles = session.semanticProfiles

    // ── Build per-column aggregation recommendations ──────────────────────
    const columnAggRecommendations = {}
    schema.forEach(col => {
      const decision = resolveAggregation(col.name, semanticProfiles, '', null)
      columnAggRecommendations[col.name] = {
        semanticType:    semanticProfiles.find(p => p.name === col.name)?.semanticType || null,
        confidence:      semanticProfiles.find(p => p.name === col.name)?.confidence  || null,
        recommendedAgg:  decision.agg,
        alternatives:    semanticProfiles.find(p => p.name === col.name)?.aggAlternatives || [],
        recommendation:  decision.recommendation,
        warning:         decision.warning,
      }
    })

    let result = null
    if (isAvailable()) {
      try {
        result = await claudeSuggestFields(schema, aggregateStats)
      } catch (e) {
        console.warn('Gemini field suggestion failed, using local:', e.message)
      }
    }
    if (!result) result = localSuggestFields(schema, aggregateStats)

    res.json({
      chartDefinitions: CHART_DEFINITIONS,
      suggestions:      result.suggestions,
      defaultSelections:result.defaultSelections,
      source:           result.source,
      columns: schema.map(c => ({ name: c.name, type: c.type })),
      // Semantic profiles — used by frontend for context-aware aggregation UI
      semanticProfiles: semanticProfiles.map(p => ({
        name:            p.name,
        semanticType:    p.semanticType,
        confidence:      p.confidence,
        recommendedAgg:  p.recommendedAgg,
        aggAlternatives: p.aggAlternatives,
        recommendation:  resolveAggregation(p.name, semanticProfiles, '', null).recommendation,
        warning:         p.aggWarning,
      })),
      columnAggRecommendations,
      // Validated chart availability
      chartAvailability: validateCharts(schema),
    })
  } catch (err) {
    next(err)
  }
})

module.exports = router
