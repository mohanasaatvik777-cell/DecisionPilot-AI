const express  = require('express')
const router   = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')

// ── Industry-specific prompt templates ──────────────────────────────────────
const INDUSTRY_PROMPTS = {
  retail: {
    context: 'You are a senior retail analytics expert analyzing sales, inventory, and customer behavior data.',
    insightFocus: ['best selling products', 'low performing categories', 'seasonal demand', 'customer buying behavior', 'high profit products', 'inventory turnover'],
    recFocus:     ['restock recommendations', 'discount and promotional suggestions', 'marketing opportunities', 'upselling strategies', 'customer retention'],
  },
  restaurant: {
    context: 'You are a restaurant business analytics expert analyzing food sales, customer traffic, and operational efficiency.',
    insightFocus: ['best selling dishes', 'least ordered items', 'peak hours and busy days', 'high profit menu items', 'customer preferences', 'food cost efficiency'],
    recFocus:     ['stock popular ingredients', 'combo offer suggestions', 'menu optimization', 'reduce food wastage', 'staff scheduling'],
  },
  healthcare: {
    context: 'You are a healthcare analytics specialist analyzing patient data, hospital operations, and medical resource utilization.',
    insightFocus: ['most common conditions', 'high risk patient groups', 'department workload', 'peak admission times', 'bed occupancy trends', 'recovery rate patterns'],
    recFocus:     ['staffing recommendations', 'medicine restock priorities', 'doctor schedule optimization', 'capacity planning', 'preventive care opportunities'],
  },
  manufacturing: {
    context: 'You are a manufacturing analytics expert analyzing production efficiency, machine performance, and quality control.',
    insightFocus: ['production bottlenecks', 'high defect machines or shifts', 'downtime patterns', 'material shortages', 'efficiency opportunities', 'energy consumption'],
    recFocus:     ['preventive maintenance schedule', 'production flow optimization', 'wastage reduction', 'shift efficiency improvements', 'inventory management'],
  },
  education: {
    context: 'You are an education analytics specialist analyzing student performance, attendance, and learning outcomes.',
    insightFocus: ['students at risk of failing', 'best performing subjects', 'attendance issues', 'learning progress trends', 'teacher effectiveness', 'grade distribution'],
    recFocus:     ['extra classes for weak students', 'attendance improvement strategies', 'personalized study plans', 'teacher support recommendations', 'curriculum adjustments'],
  },
  marketing: {
    context: 'You are a digital marketing analytics expert analyzing campaign performance, lead generation, and ROI.',
    insightFocus: ['best performing campaigns', 'worst performing channels', 'high converting segments', 'customer acquisition costs', 'ROI by platform', 'audience demographics'],
    recFocus:     ['scale winning campaigns', 'pause or optimize poor performers', 'budget reallocation', 'audience targeting improvements', 'content strategy suggestions'],
  },
  finance: {
    context: 'You are a financial analytics expert analyzing revenue, expenses, cash flow, and profitability.',
    insightFocus: ['high expense categories', 'profit growth trends', 'cash flow risks', 'revenue concentration', 'budget variance', 'investment performance'],
    recFocus:     ['cost reduction opportunities', 'high ROI investments', 'cash flow management', 'budget optimization', 'risk mitigation strategies'],
  },
  general: {
    context: 'You are a senior business analyst providing data-driven insights.',
    insightFocus: ['key trends', 'top performers', 'outliers', 'pattern analysis', 'growth opportunities'],
    recFocus:     ['focus on top performers', 'investigate anomalies', 'optimize underperformers', 'monitor key metrics'],
  },
}

// ── Fallback rule-based insights ─────────────────────────────────────────────
function generateFallbackInsights(aggregateStats, industry, anomalies) {
  const { kpis, topCategories, rowCount, dateRange } = aggregateStats
  const prompt = INDUSTRY_PROMPTS[industry] || INDUSTRY_PROMPTS.general
  const insights = []
  const recommendations = []

  if (dateRange) {
    insights.push(`Dataset spans from ${dateRange.from} to ${dateRange.to} with ${rowCount?.toLocaleString()} ${industry} records.`)
  } else {
    insights.push(`Dataset contains ${rowCount?.toLocaleString()} records across ${aggregateStats.columnCount} columns.`)
  }

  const metricKeys = Object.keys(kpis || {})
  if (metricKeys.length > 0) {
    const key = metricKeys[0]
    const m = kpis[key]
    insights.push(`${key}: Total ${m.total?.toLocaleString()}, Average ${m.avg?.toLocaleString()}, Peak ${m.max?.toLocaleString()}.`)
  }

  if (topCategories?.length > 0) {
    const top = topCategories[0]
    insights.push(`Top category "${top.name}" leads with a value of ${top.value?.toLocaleString()}.`)
  }

  if (anomalies?.length > 0) {
    insights.push(`${anomalies.length} statistical anomaly(ies) detected — review the Alerts tab for details.`)
  }

  insights.push(`Based on the ${industry} context: Focus on ${prompt.insightFocus[0]} and ${prompt.insightFocus[1]}.`)
  insights.push(`Data quality is ${rowCount > 100 ? 'sufficient' : 'limited'} for ${rowCount > 100 ? 'reliable' : 'preliminary'} analysis.`)

  recommendations.push(`${prompt.recFocus[0].charAt(0).toUpperCase() + prompt.recFocus[0].slice(1)}: Review top-performing categories and replicate success patterns.`)
  recommendations.push(`${prompt.recFocus[1].charAt(0).toUpperCase() + prompt.recFocus[1].slice(1)}: Analyze anomalies in the alerts panel to identify actionable opportunities.`)
  recommendations.push(`${prompt.recFocus[2] ? prompt.recFocus[2].charAt(0).toUpperCase() + prompt.recFocus[2].slice(1) : 'Monitor trends'}: Set up regular data reviews to track key ${industry} metrics.`)

  return { insights, recommendations, source: 'rule-based' }
}

// ── Build industry-specific Claude prompt ────────────────────────────────────
function buildPrompt(aggregateStats, industry, anomalies) {
  const prompt = INDUSTRY_PROMPTS[industry] || INDUSTRY_PROMPTS.general

  return `${prompt.context}

CRITICAL RULES:
- Only reference numbers and trends explicitly present in the provided stats
- Do NOT invent numbers, percentages, or trends not supported by the data
- Be specific and executive-level — avoid generic statements
- If data is sparse, say so honestly rather than fabricating insights
- Tailor ALL insights and recommendations specifically to ${industry} business context

DATASET STATISTICS:
${JSON.stringify(aggregateStats, null, 2)}

${anomalies?.length > 0 ? `ANOMALIES DETECTED:\n${anomalies.slice(0, 5).map(a => `- ${a.message}`).join('\n')}` : ''}

FOCUS AREAS FOR INSIGHTS (${industry}):
${prompt.insightFocus.map((f, i) => `${i + 1}. ${f}`).join('\n')}

FOCUS AREAS FOR RECOMMENDATIONS (${industry}):
${prompt.recFocus.map((r, i) => `${i + 1}. ${r}`).join('\n')}

Respond in this EXACT JSON format only:
{
  "insights": [
    "Specific insight 1 grounded in the data above",
    "Specific insight 2",
    "Specific insight 3",
    "Specific insight 4",
    "Specific insight 5"
  ],
  "recommendations": [
    "Actionable recommendation 1 specific to ${industry}",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ]
}

Return ONLY the JSON object. No markdown, no explanation.`
}

function parseClaudeResponse(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return { insights: parsed.insights || [], recommendations: parsed.recommendations || [] }
    }
  } catch {}
  const lines = text.split('\n').filter(l => l.trim().match(/^[-•\d]/))
  return {
    insights:        lines.slice(0, 5).map(l => l.replace(/^[-•\d.]\s*/, '').trim()).filter(Boolean),
    recommendations: lines.slice(5, 8).map(l => l.replace(/^[-•\d.]\s*/, '').trim()).filter(Boolean),
  }
}

// ── Route ────────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { aggregateStats, industry = 'general', anomalies } = req.body

    if (!aggregateStats) {
      return res.status(400).json({ error: 'aggregateStats is required.' })
    }

    if (isAvailable()) {
      try {
        const prompt  = buildPrompt(aggregateStats, industry, anomalies)
        const text    = await askGemini('You are an expert business analyst. Respond with ONLY valid JSON.', prompt)
        if (text) {
          const parsed = parseClaudeResponse(text)
          return res.json({ ...parsed, source: 'gemini' })
        }
      } catch (geminiErr) {
        console.warn('Gemini API error, falling back:', geminiErr.message)
      }
    }

    const fallback = generateFallbackInsights(aggregateStats, industry, anomalies)
    // Save to report cache
    if (global.reportCache) {
      const cacheKeys = Object.keys(global.reportCache)
      if (cacheKeys.length > 0) {
        const lastKey = cacheKeys[cacheKeys.length - 1]
        global.reportCache[lastKey].insights = fallback.insights
        global.reportCache[lastKey].recommendations = fallback.recommendations
      }
    }
    res.json(fallback)
  } catch (err) {
    next(err)
  }
})

module.exports = router

// ── Natural Language Query Route ─────────────────────────────────────────────
router.post('/query', async (req, res, next) => {
  try {
    const { query, aggregateStats, industry = 'general', anomalies } = req.body
    if (!query) return res.status(400).json({ error: 'query is required.' })

    if (isAvailable()) {
      try {
        const prompt = INDUSTRY_PROMPTS[industry] || INDUSTRY_PROMPTS.general
        const systemPrompt = `${prompt.context}
You are answering a specific user question about their ${industry} dataset.

DATASET STATS:
${JSON.stringify(aggregateStats, null, 2)}

${anomalies?.length ? `ANOMALIES:\n${anomalies.slice(0,5).map(a => `- ${a.message}`).join('\n')}` : 'No anomalies detected.'}

RULES:
- Answer ONLY based on the data provided above
- Be concise, specific, and actionable
- Use numbers from the stats when relevant
- If the question cannot be answered from the data, say so clearly
- Format your response clearly with line breaks for readability
- Do NOT invent numbers or trends not present in the data`

        const text = await askGemini(systemPrompt, query)
        if (text) return res.json({ answer: text, source: 'gemini' })
      } catch (e) {
        console.warn('Gemini query failed:', e.message)
      }
    }
    // Fallback — client handles local answer
    res.json({ answer: null, source: 'local' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
