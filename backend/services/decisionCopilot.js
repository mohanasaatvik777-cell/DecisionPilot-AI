/**
 * services/decisionCopilot.js
 *
 * The AI Decision Copilot service.
 * Responsibility: Assemble pre-computed KPIs from the Analytics Engine,
 * then ask Gemini to reason about the user's decision — never calculate.
 *
 * Architecture:
 *   Analytics Engine  →  computes all numbers
 *   Decision Copilot  →  reasons, recommends, warns (LLM only)
 *
 * The LLM receives a structured context of already-computed facts.
 * It is explicitly forbidden from inventing numbers.
 */
'use strict'

const { askGemini, isAvailable } = require('../utils/gemini')

const fmt = v => {
  if (v === null || v === undefined || isNaN(Number(v))) return 'N/A'
  const n = Number(v)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ── Assemble Analytics Context ─────────────────────────────────────────────
// Pulls all pre-computed facts from the session and report cache.
// This is the ONLY source of numbers the LLM will see.
function assembleAnalyticsContext(session, reportCache) {
  const { rows, schema, fileName, industry } = session
  const kpis          = reportCache?.kpis          || {}
  const anomalies     = reportCache?.anomalies      || []
  const aggregateStats= reportCache?.aggregateStats || {}
  const forecast      = reportCache?.forecast       || null

  const numCols = schema.filter(c => c.type === 'numeric')
  const catCols = schema.filter(c => c.type === 'categorical')
  const dateCols= schema.filter(c => c.type === 'date')

  // Build compact numeric summary
  const metrics = {}
  numCols.slice(0, 8).forEach(col => {
    const stat = kpis[col.name]
    if (!stat) return
    metrics[col.name] = {
      total:  Math.round((stat.total  || 0) * 100) / 100,
      avg:    Math.round((stat.avg    || 0) * 100) / 100,
      min:    stat.min,
      max:    stat.max,
      count:  stat.count,
    }
  })

  // Growth estimate (first numeric vs last 20% of rows)
  const growthSignals = []
  if (dateCols.length > 0 && numCols.length > 0) {
    const toNum = v => { const n = parseFloat(String(v).replace(/[$,%\s]/g,'')); return isNaN(n)?null:n }
    const mean  = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0
    const dateCol = dateCols[0].originalName
    const numCol  = numCols[0].originalName
    const sorted  = [...rows].sort((a,b)=>new Date(a[dateCol])-new Date(b[dateCol]))
    const tail    = Math.max(1, Math.floor(sorted.length * 0.2))
    const early   = sorted.slice(0, tail).map(r=>toNum(r[numCol])).filter(v=>v!==null)
    const recent  = sorted.slice(-tail).map(r=>toNum(r[numCol])).filter(v=>v!==null)
    if (early.length && recent.length) {
      const avgEarly  = mean(early)
      const avgRecent = mean(recent)
      const growthPct = avgEarly > 0 ? ((avgRecent - avgEarly) / avgEarly * 100) : 0
      growthSignals.push({
        column: numCols[0].name,
        recentAvg:  Math.round(avgRecent * 100) / 100,
        earlyAvg:   Math.round(avgEarly  * 100) / 100,
        growthPct:  Math.round(growthPct * 10) / 10,
        direction:  growthPct > 0 ? 'growing' : growthPct < 0 ? 'declining' : 'stable',
      })
    }
  }

  // Top categories
  const topCategories = (aggregateStats.topCategories || []).slice(0, 5)

  // Forecast summary
  const forecastSummary = forecast ? {
    column: forecast.column,
    trend:  forecast.slope > 0 ? 'upward' : forecast.slope < 0 ? 'downward' : 'flat',
    slopePer30Days: forecast.slope ? Math.round(forecast.slope * 30 * 100) / 100 : null,
  } : null

  return {
    fileName,
    industry: industry || 'general',
    rowCount: rows.length,
    columns: {
      numeric:     numCols.map(c => c.name),
      categorical: catCols.map(c => c.name),
      date:        dateCols.map(c => c.name),
    },
    metrics,
    growthSignals,
    topCategories,
    anomalyCount: anomalies.length,
    anomalySummary: anomalies.slice(0, 3).map(a => a.message),
    forecastSummary,
    dateRange: kpis.dateRange || null,
  }
}

// ── Build Gemini Prompt ────────────────────────────────────────────────────
function buildDecisionPrompt(userDecision, analyticsContext, conversationHistory) {
  const ctx = JSON.stringify(analyticsContext, null, 2)

  const historyText = conversationHistory?.length
    ? `\n\nPREVIOUS CONVERSATION:\n${conversationHistory.slice(-4).map(m=>`${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n`
    : ''

  return `You are an elite AI Business Decision Advisor integrated into a data analytics platform.

Your role is to help the user make smart, data-backed business decisions.

=== CRITICAL RULES ===
1. NEVER invent, estimate, or calculate numbers — use ONLY the analytics context below.
2. If a specific number is not in the analytics context, say "data not available" — do NOT guess.
3. Always cite which metric from the context supports your reasoning.
4. Be specific — name the actual columns and their values from the context.
5. Every section is mandatory — do not skip any.
6. Confidence score must be between 50% and 98%.

=== ANALYTICS CONTEXT (pre-computed — treat as ground truth) ===
${ctx}
${historyText}
=== USER'S DECISION QUESTION ===
"${userDecision}"

=== OUTPUT FORMAT ===
Return ONLY a valid JSON object. No markdown fences. No extra text. No explanations outside the JSON.

{
  "decision": "Restate the user's decision clearly in 1 sentence",
  "intent": "One of: hiring | salary | marketing | inventory | pricing | expansion | cost_reduction | general",
  "currentSituation": [
    "Bullet 1: specific KPI from context with actual value",
    "Bullet 2: another KPI or trend",
    "Bullet 3: relevant growth or anomaly signal"
  ],
  "potentialBenefits": [
    "Benefit 1 — grounded in the data",
    "Benefit 2",
    "Benefit 3"
  ],
  "potentialRisks": [
    "Risk 1 — grounded in the data",
    "Risk 2",
    "Risk 3"
  ],
  "riskAnalysis": {
    "operational": { "level": "Low|Medium|High", "reason": "1 sentence" },
    "financial":   { "level": "Low|Medium|High", "reason": "1 sentence" },
    "customer":    { "level": "Low|Medium|High", "reason": "1 sentence" },
    "business":    { "level": "Low|Medium|High", "reason": "1 sentence" },
    "overall":     "Low|Medium|High"
  },
  "recommendation": "Recommended|Not Recommended|Proceed with Caution",
  "recommendationReason": "2-3 sentences citing specific KPIs from the context",
  "priority": "Low|Medium|High|Critical",
  "confidence": {
    "score": 85,
    "reasons": ["Reason 1 e.g. sufficient data", "Reason 2", "Reason 3"]
  },
  "alternativePlan": {
    "title": "Alternative approach title",
    "description": "1-2 sentences describing a safer or smarter alternative",
    "estimatedImpact": "Qualitative impact description"
  },
  "followUpQuestions": [
    "Follow-up question 1 the user should explore",
    "Follow-up question 2",
    "Follow-up question 3"
  ],
  "implementationSteps": [
    "Step 1 — immediate action",
    "Step 2 — short term",
    "Step 3 — monitor"
  ]
}`
}

// ── Fallback rule-based decision ───────────────────────────────────────────
function buildFallbackDecision(userDecision, analyticsContext) {
  const { metrics, growthSignals, anomalyCount, rowCount, columns } = analyticsContext
  const metricKeys   = Object.keys(metrics)
  const firstMetric  = metricKeys[0]
  const firstStat    = firstMetric ? metrics[firstMetric] : null
  const growth       = growthSignals[0]
  const isGrowing    = growth?.direction === 'growing'
  const intent       = detectIntent(userDecision)

  const situation = []
  if (firstStat) situation.push(`${firstMetric}: Total ${fmt(firstStat.total)}, Average ${fmt(firstStat.avg)}`)
  if (growth)    situation.push(`${growth.column} trend: ${growth.direction} (${growth.growthPct > 0 ? '+' : ''}${growth.growthPct}%)`)
  if (anomalyCount > 0) situation.push(`${anomalyCount} anomalies detected — review before major decisions`)
  situation.push(`Dataset: ${rowCount.toLocaleString()} records across ${columns.numeric.length} numeric metrics`)

  const overallRisk = isGrowing ? 'Medium' : 'High'

  return {
    decision: userDecision,
    intent,
    currentSituation: situation,
    potentialBenefits: [
      'May improve operational efficiency if metrics support it',
      'Could create positive business outcomes based on current data trends',
      'Aligns with observed patterns in the dataset',
    ],
    potentialRisks: [
      anomalyCount > 0 ? `${anomalyCount} data anomalies suggest instability — adds execution risk` : 'No major anomalies detected',
      isGrowing ? 'Growth trend is positive but may not sustain under added pressure' : 'Declining trend increases risk of the decision backfiring',
      'Insufficient historical data may limit forecast accuracy',
    ],
    riskAnalysis: {
      operational: { level: 'Medium', reason: 'Operational changes carry moderate execution risk' },
      financial:   { level: overallRisk, reason: isGrowing ? 'Financials trending positively' : 'Declining trend increases financial risk' },
      customer:    { level: 'Low',    reason: 'Customer impact depends on implementation approach' },
      business:    { level: 'Medium', reason: 'Business impact moderate — monitor KPIs post-decision' },
      overall: overallRisk,
    },
    recommendation: isGrowing ? 'Proceed with Caution' : 'Proceed with Caution',
    recommendationReason: `Based on ${rowCount.toLocaleString()} records, the dataset shows ${isGrowing ? 'positive growth trends' : 'mixed or declining signals'}. ${firstStat ? `Key metric "${firstMetric}" averages ${fmt(firstStat.avg)}.` : ''} Proceed carefully and monitor outcomes.`,
    priority: 'Medium',
    confidence: {
      score: Math.min(75, 50 + Math.min(rowCount / 10, 20) + (columns.numeric.length > 2 ? 5 : 0)),
      reasons: [
        `${rowCount.toLocaleString()} records available`,
        `${columns.numeric.length} numeric metrics for analysis`,
        anomalyCount === 0 ? 'No anomalies detected' : `${anomalyCount} anomalies may affect reliability`,
      ],
    },
    alternativePlan: {
      title: 'Phased Approach',
      description: `Instead of a full rollout, pilot the decision on a smaller scale first. Measure impact over 30-60 days before full implementation.`,
      estimatedImpact: 'Lower risk, slower return, more controlled outcome',
    },
    followUpQuestions: [
      `What is the financial impact if ${firstMetric || 'key metrics'} change by 10%?`,
      'Show the trend over the last period',
      'What are the top performing segments?',
    ],
    implementationSteps: [
      'Review current KPIs and set baseline targets',
      'Pilot the decision with a small scope or time window',
      'Monitor key metrics weekly and adjust strategy',
    ],
  }
}

function detectIntent(text) {
  const t = text.toLowerCase()
  if (/hire|employ|staff|headcount|recruit/i.test(t))       return 'hiring'
  if (/salary|wage|pay|compensat|increment/i.test(t))       return 'salary'
  if (/market|advertis|campaign|brand|promot/i.test(t))     return 'marketing'
  if (/inventor|stock|supply|warehouse|restock/i.test(t))   return 'inventory'
  if (/price|pricing|cost|charge|tariff/i.test(t))          return 'pricing'
  if (/expand|branch|location|open|scale/i.test(t))         return 'expansion'
  if (/cut|reduc|optim|trim|lower cost|expense/i.test(t))   return 'cost_reduction'
  return 'general'
}

// ── Main export ────────────────────────────────────────────────────────────
async function analyzeDecision(userDecision, session, reportCache, conversationHistory) {
  const analyticsContext = assembleAnalyticsContext(session, reportCache)
  const prompt           = buildDecisionPrompt(userDecision, analyticsContext, conversationHistory)

  if (isAvailable()) {
    try {
      const raw = await askGemini(
        'You are an expert AI business decision advisor. Respond with ONLY valid JSON — no markdown, no explanation.',
        prompt
      )
      if (raw) {
        // Strip markdown fences if present
        let clean = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
        const match = clean.match(/\{[\s\S]*\}/)
        if (match) {
          clean = match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')
          const parsed = JSON.parse(clean)
          // Validate required fields
          if (parsed.decision && parsed.recommendation && parsed.riskAnalysis) {
            return { ...parsed, source: 'gemini', analyticsContext }
          }
        }
      }
    } catch (e) {
      console.warn('[DECISION] Gemini failed, using fallback:', e.message?.slice(0, 80))
    }
  }

  const fallback = buildFallbackDecision(userDecision, analyticsContext)
  return { ...fallback, source: 'local', analyticsContext }
}

module.exports = { analyzeDecision, assembleAnalyticsContext }
