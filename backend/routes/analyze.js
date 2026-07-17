const express = require('express');
const router  = express.Router();
const { computeKPIs, computeChartData, detectAnomalies, buildForecast, assessDataQuality, buildAggregateStats } = require('../utils/analyzer');
const Report  = require('../models/Report');

// POST /api/analyze
// Body: { sessionId, schema (user-confirmed), industry }
router.post('/', async (req, res, next) => {
  try {
    const { sessionId, schema: confirmedSchema, industry } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    const session = global.sessionCache?.[sessionId];
    if (!session) return res.status(404).json({ error: 'Session not found or expired. Please re-upload your file.' });

    const { rows } = session;
    // Use user-confirmed schema if provided, else use detected
    const schema = confirmedSchema || session.schema;
    const resolvedIndustry = industry || session.industry;

    // Filter out identifier and text columns from analysis
    const analysisSchema = schema.filter(c => c.type !== 'identifier');

    const kpis        = computeKPIs(rows, analysisSchema);
    const chartData   = computeChartData(rows, analysisSchema);
    const { anomalies, note: anomalyNote } = detectAnomalies(rows, analysisSchema);
    const { forecast, note: forecastNote } = buildForecast(rows, analysisSchema);
    const qualityNotes = assessDataQuality(rows, analysisSchema);
    const aggregateStats = buildAggregateStats(rows, analysisSchema, kpis, chartData);

    // Save report to DB (best-effort)
    let reportId = null;
    try {
      const report = await Report.create({
        sessionId,
        kpis,
        chartData,
        forecasts: forecast,
        anomalies,
        industry: resolvedIndustry,
        dataQualityNotes: qualityNotes,
      });
      reportId = report._id;
    } catch (dbErr) {
      console.warn('Report DB save skipped:', dbErr.message);
    }

    // Cache for insights & export
    global.reportCache = global.reportCache || {};
    global.reportCache[sessionId] = {
      kpis, chartData, forecast, anomalies, qualityNotes, aggregateStats,
      industry: resolvedIndustry, reportId, insights: [], recommendations: [],
    };
    // Also update sessionCache with confirmed schema so chatbot has correct schema
    if (global.sessionCache?.[sessionId]) {
      global.sessionCache[sessionId].schema = analysisSchema;
      global.sessionCache[sessionId].industry = resolvedIndustry;
    }

    res.json({
      reportId,
      kpis,
      chartData,
      forecast,
      forecastNote,
      anomalies,
      anomalyNote,
      industry: resolvedIndustry,
      dataQualityNotes: qualityNotes,
      aggregateStats,
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
