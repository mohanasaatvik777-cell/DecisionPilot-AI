/**
 * controllers/decisionController.js
 * Handles POST /api/decision
 * Validates request, retrieves session, calls the Decision Copilot service.
 */
'use strict'

const { analyzeDecision } = require('../services/decisionCopilot')

async function handleDecision(req, res, next) {
  try {
    const { sessionId, decision, conversationHistory = [] } = req.body

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' })
    if (!decision?.trim()) return res.status(400).json({ error: 'decision is required.' })

    const session = global.sessionCache?.[sessionId]
    if (!session) return res.status(404).json({ error: 'Session not found. Please re-upload your file.' })

    // Ensure analysis has been run (report cache must exist for meaningful decisions)
    const reportCache = global.reportCache?.[sessionId] || {}

    console.log(`[DECISION] "${decision.slice(0, 80)}" | session=${sessionId} | industry=${session.industry}`)

    const result = await analyzeDecision(decision, session, reportCache, conversationHistory)

    res.json({
      decision: result.decision,
      intent:   result.intent,
      currentSituation:     result.currentSituation,
      potentialBenefits:    result.potentialBenefits,
      potentialRisks:       result.potentialRisks,
      riskAnalysis:         result.riskAnalysis,
      recommendation:       result.recommendation,
      recommendationReason: result.recommendationReason,
      priority:             result.priority,
      confidence:           result.confidence,
      alternativePlan:      result.alternativePlan,
      followUpQuestions:    result.followUpQuestions,
      implementationSteps:  result.implementationSteps,
      source:               result.source,
      // Include analytics context for UI transparency
      analyticsSnapshot: {
        rowCount:    result.analyticsContext?.rowCount,
        industry:    result.analyticsContext?.industry,
        metricCount: Object.keys(result.analyticsContext?.metrics || {}).length,
        hasGrowth:   (result.analyticsContext?.growthSignals?.length || 0) > 0,
        hasForecast: !!result.analyticsContext?.forecastSummary,
      },
    })
  } catch (err) {
    next(err)
  }
}

module.exports = { handleDecision }
