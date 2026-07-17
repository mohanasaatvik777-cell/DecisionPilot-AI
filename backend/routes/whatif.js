/**
 * whatif.js  —  POST /api/whatif
 *
 * What-If Analysis Engine.
 * Simulates the impact of changing a numeric column by a % or absolute amount.
 * All math is done in the backend. Gemini writes only the narrative.
 *
 * Request body:
 *   { sessionId, column, changeType: 'percent'|'absolute', changeValue: number,
 *     groupBy?: string }   // optional: show breakdown by category
 *
 * Response:
 *   { scenario, currentStats, simulatedStats, delta, groupBreakdown?,
 *     businessImpacts, aiInsight, chartData }
 */
'use strict'
const express = require('express')
const router  = express.Router()
const { askGemini, isAvailable } = require('../utils/gemini')
const { profileColumns }         = require('../utils/semanticProfiler')

const toNum = v => { const n = parseFloat(String(v).replace(/[$,%\s]/g, '')); return isNaN(n) ? null : n }
const mean  = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const fmt   = v => {
  if (v === null || v === undefined) return 'N/A'
  const n = Number(v)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ── Detect business impacts from column semantics ────────────────────────────
function deriveBusinessImpacts(colName, semanticType, changePct) {
  const isIncrease = changePct > 0
  const name = colName.toLowerCase()
  const impacts = []

  // Cost / expense columns
  if (/salary|wage|pay|cost|expense|spend|fee/i.test(name)) {
    impacts.push({ label: 'Employee Satisfaction', status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Higher compensation improves morale' : 'Pay cuts reduce morale' })
    impacts.push({ label: 'Operational Cost',      status: isIncrease ? 'warning'  : 'positive', reason: isIncrease ? 'Increased' : 'Reduced' })
    impacts.push({ label: 'Profit Margin',         status: isIncrease ? 'negative' : 'positive', reason: isIncrease ? 'May decline depending on revenue growth' : 'May improve' })
  }
  // Revenue / sales
  else if (/revenue|sales|income|earning/i.test(name)) {
    impacts.push({ label: 'Business Growth',       status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Revenue increase drives growth' : 'Revenue decline signals risk' })
    impacts.push({ label: 'Profitability',         status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Higher revenue improves margins' : 'Lower revenue pressures margins' })
    impacts.push({ label: 'Market Position',       status: isIncrease ? 'positive' : 'warning',  reason: isIncrease ? 'Positive signal to stakeholders' : 'Monitor market share' })
  }
  // Price columns
  else if (/price|rate|tariff|charge/i.test(name)) {
    impacts.push({ label: 'Customer Demand',       status: isIncrease ? 'warning'  : 'positive', reason: isIncrease ? 'Higher prices may reduce demand' : 'Lower prices may boost volume' })
    impacts.push({ label: 'Revenue per Unit',      status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Higher unit revenue' : 'Lower unit revenue' })
    impacts.push({ label: 'Competitive Position',  status: isIncrease ? 'warning'  : 'positive', reason: isIncrease ? 'May lose price-sensitive customers' : 'More competitive pricing' })
  }
  // Quantity / inventory
  else if (/qty|quantity|stock|inventory|units|volume/i.test(name)) {
    impacts.push({ label: 'Supply Capacity',       status: isIncrease ? 'positive' : 'warning',  reason: isIncrease ? 'More supply available' : 'Risk of shortage' })
    impacts.push({ label: 'Storage Cost',          status: isIncrease ? 'warning'  : 'positive', reason: isIncrease ? 'Higher storage requirements' : 'Reduced holding cost' })
    impacts.push({ label: 'Order Fulfilment',      status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Better fill rate' : 'More stockouts expected' })
  }
  // Score / performance / rate
  else if (/score|rate|grade|mark|attendance|performance/i.test(name)) {
    impacts.push({ label: 'Overall Performance',   status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Improved metrics' : 'Declining metrics — action needed' })
    impacts.push({ label: 'Quality Benchmark',     status: isIncrease ? 'positive' : 'warning',  reason: isIncrease ? 'Above benchmark' : 'May fall below target' })
    impacts.push({ label: 'Stakeholder Confidence',status: isIncrease ? 'positive' : 'negative', reason: isIncrease ? 'Stronger results' : 'May require explanation' })
  }
  // Generic numeric
  else {
    impacts.push({ label: 'Operational Impact',    status: isIncrease ? 'warning'  : 'positive', reason: isIncrease ? `${colName} increases — monitor downstream effects` : `${colName} decreases — review dependency chain` })
    impacts.push({ label: 'Resource Planning',     status: 'warning',  reason: `Adjust plans to account for ${Math.abs(changePct).toFixed(1)}% ${isIncrease ? 'increase' : 'decrease'} in ${colName}` })
    impacts.push({ label: 'Budget Alignment',      status: isIncrease ? 'warning' : 'positive', reason: isIncrease ? 'Revised budget may be needed' : 'Budget headroom created' })
  }
  return impacts
}

// ── Main route ────────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, column, changeType = 'percent', changeValue, groupBy } = req.body

    if (!sessionId)   return res.status(400).json({ error: 'sessionId is required.' })
    if (!column)      return res.status(400).json({ error: 'column is required.' })
    if (changeValue === undefined || changeValue === null) return res.status(400).json({ error: 'changeValue is required.' })

    const session = global.sessionCache?.[sessionId]
    if (!session) return res.status(404).json({ error: 'Session not found. Re-upload your file.' })

    const { rows, schema } = session

    // Find the column in schema
    const colDef = schema.find(c => c.name === column || c.originalName === column)
    if (!colDef) return res.status(400).json({ error: `Column "${column}" not found. Available: ${schema.map(c => c.name).join(', ')}` })

    // Extract current numeric values
    const currentVals = rows.map(r => toNum(r[colDef.originalName])).filter(v => v !== null)
    if (!currentVals.length) return res.status(400).json({ error: `No numeric data found in column "${column}".` })

    // Compute current stats
    const currentTotal = currentVals.reduce((a, b) => a + b, 0)
    const currentAvg   = currentTotal / currentVals.length
    const currentMin   = Math.min(...currentVals)
    const currentMax   = Math.max(...currentVals)

    // Compute simulated values
    let multiplier, absoluteDelta
    if (changeType === 'percent') {
      multiplier    = 1 + changeValue / 100
      absoluteDelta = changeValue / 100
    } else {
      // absolute: add changeValue to each value
      multiplier    = null
      absoluteDelta = changeValue
    }

    const simulatedVals = currentVals.map(v =>
      changeType === 'percent' ? v * multiplier : v + absoluteDelta
    )

    const simulatedTotal = simulatedVals.reduce((a, b) => a + b, 0)
    const simulatedAvg   = simulatedTotal / simulatedVals.length
    const simulatedMin   = Math.min(...simulatedVals)
    const simulatedMax   = Math.max(...simulatedVals)

    const deltaTotal = simulatedTotal - currentTotal
    const deltaAvg   = simulatedAvg   - currentAvg
    const actualPct  = changeType === 'percent' ? changeValue : (currentAvg !== 0 ? deltaAvg / Math.abs(currentAvg) * 100 : 0)

    // Group breakdown (optional)
    let groupBreakdown = null
    if (groupBy) {
      const groupCol = schema.find(c => c.name === groupBy || c.originalName === groupBy)
      if (groupCol) {
        const groups = {}
        rows.forEach(r => {
          const key = String(r[groupCol.originalName] || 'Unknown').trim()
          const v   = toNum(r[colDef.originalName])
          if (v === null) return
          if (!groups[key]) groups[key] = []
          groups[key].push(v)
        })
        groupBreakdown = Object.entries(groups).map(([name, vals]) => {
          const curr = vals.reduce((a, b) => a + b, 0)
          const sim  = changeType === 'percent' ? curr * multiplier : curr + absoluteDelta * vals.length
          return { name, current: Math.round(curr * 100) / 100, simulated: Math.round(sim * 100) / 100, delta: Math.round((sim - curr) * 100) / 100 }
        }).sort((a, b) => b.current - a.current)
      }
    }

    // Get semantic type
    if (!session.semanticProfiles) session.semanticProfiles = profileColumns(rows, schema)
    const profile  = session.semanticProfiles.find(p => p.name === column || p.originalName === column)
    const semType  = profile?.semanticType || 'MEASURE'

    // Business impacts
    const businessImpacts = deriveBusinessImpacts(column, semType, actualPct)

    // Scenario label
    const direction = actualPct >= 0 ? 'Increase' : 'Decrease'
    const scenario  = `${direction} ${column} by ${Math.abs(changeType === 'percent' ? changeValue : actualPct).toFixed(1)}%`

    // Chart data (before vs after per group, or a simple 2-bar comparison)
    const chartData = groupBreakdown
      ? { type: 'grouped', data: groupBreakdown.slice(0, 10), column, groupBy }
      : {
          type: 'comparison',
          data: [
            { name: 'Current',   total: Math.round(currentTotal * 100) / 100,   avg: Math.round(currentAvg * 100) / 100 },
            { name: 'Simulated', total: Math.round(simulatedTotal * 100) / 100, avg: Math.round(simulatedAvg * 100) / 100 },
          ],
          column,
        }

    // Gemini insight
    let aiInsight = null
    if (isAvailable()) {
      try {
        const prompt = `You are a business analyst. A user ran a what-if simulation.

Scenario: ${scenario}
Column: ${column} (semantic type: ${semType})
Current Total: ${fmt(currentTotal)} | Current Average: ${fmt(currentAvg)}
Simulated Total: ${fmt(simulatedTotal)} | Simulated Average: ${fmt(simulatedAvg)}
Delta: ${deltaTotal >= 0 ? '+' : ''}${fmt(deltaTotal)} total, ${deltaAvg >= 0 ? '+' : ''}${fmt(deltaAvg)} average

Business Impacts:
${businessImpacts.map(i => `- ${i.label}: ${i.status.toUpperCase()} — ${i.reason}`).join('\n')}

Write a 2-sentence executive insight about this change. Be specific with the numbers above. End with one actionable recommendation. Keep it under 60 words.`

        const text = await askGemini('You are a concise business analyst.', prompt)
        if (text?.trim()) aiInsight = text.trim()
      } catch (e) {
        console.warn('[WHATIF] Gemini failed:', e.message?.slice(0, 60))
      }
    }

    // Fallback insight
    if (!aiInsight) {
      aiInsight = `${direction}ing ${column} by ${Math.abs(actualPct).toFixed(1)}% ${actualPct >= 0 ? 'raises' : 'reduces'} the total by ${fmt(Math.abs(deltaTotal))} ` +
        `(from ${fmt(currentTotal)} to ${fmt(simulatedTotal)}). ` +
        `${businessImpacts[0]?.reason || 'Review downstream effects before implementation.'}`
    }

    res.json({
      scenario,
      column,
      changeType,
      changeValue,
      currentStats:   { total: Math.round(currentTotal * 100) / 100,   avg: Math.round(currentAvg * 100) / 100,   min: currentMin,   max: currentMax,   count: currentVals.length },
      simulatedStats: { total: Math.round(simulatedTotal * 100) / 100, avg: Math.round(simulatedAvg * 100) / 100, min: simulatedMin, max: simulatedMax, count: simulatedVals.length },
      delta: { total: Math.round(deltaTotal * 100) / 100, avg: Math.round(deltaAvg * 100) / 100, pct: Math.round(actualPct * 10) / 10 },
      groupBreakdown,
      businessImpacts,
      aiInsight,
      chartData,
      semanticType: semType,
    })
  } catch (err) { next(err) }
})

// ── GET available columns for what-if ─────────────────────────────────────────
router.get('/columns/:sessionId', (req, res) => {
  const session = global.sessionCache?.[req.params.sessionId]
  if (!session) return res.status(404).json({ error: 'Session not found.' })
  const { schema, rows } = session
  if (!session.semanticProfiles) session.semanticProfiles = profileColumns(rows, schema)
  const cols = session.semanticProfiles
    .filter(p => ['MEASURE', 'CONTINUOUS'].includes(p.semanticType))
    .map(p => ({
      name: p.name, semanticType: p.semanticType,
      recommendedAgg: p.recommendedAgg,
      stats: p.stats ? { mean: p.stats.mean, min: p.stats.min, max: p.stats.max } : {}
    }))
  const catCols = schema.filter(c => c.type === 'categorical').map(c => c.name)
  res.json({ columns: cols, categoricalColumns: catCols })
})

module.exports = router
