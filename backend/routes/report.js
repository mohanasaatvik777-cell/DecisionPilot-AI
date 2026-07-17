const express = require('express')
const router  = express.Router()
const PDFDocument = require('pdfkit')
const Report  = require('../models/Report')

// GET /api/report/:id — fetch saved report
router.get('/:id', async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id)
    if (!report) return res.status(404).json({ error: 'Report not found.' })
    res.json(report)
  } catch (err) {
    const cached = global.reportCache?.[req.params.id]
    if (cached) return res.json(cached)
    next(err)
  }
})

// GET /api/report/:sessionId/export — comprehensive PDF
router.get('/:sessionId/export', (req, res, next) => {
  try {
    const cached = global.reportCache?.[req.params.sessionId]
    if (!cached) return res.status(404).json({ error: 'Report not found. Please run analysis first.' })

    const { kpis, anomalies, qualityNotes, industry, aggregateStats } = cached
    const fileName = `ai-copilot-${industry || 'report'}-${Date.now()}.pdf`

    const doc = new PDFDocument({ margin: 48, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    doc.pipe(res)

    // ── Color palette ──────────────────────────────────────────────────────
    const COLORS = {
      primary:  '#6366f1',
      success:  '#10b981',
      warning:  '#f59e0b',
      danger:   '#ef4444',
      text:     '#1e293b',
      subtext:  '#64748b',
      border:   '#e2e8f0',
      bg:       '#f8fafc',
    }

    const fmt = n => {
      if (n === null || n === undefined || isNaN(n)) return 'N/A'
      if (Math.abs(n) >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B'
      if (Math.abs(n) >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'
      if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K'
      return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
    }

    const W = doc.page.width - 96  // usable width

    // ── Helper: section header ─────────────────────────────────────────────
    const sectionHeader = (title, color = COLORS.primary) => {
      doc.moveDown(0.5)
      doc.rect(48, doc.y, W, 28).fillAndStroke(color + '18', color + '30')
      doc.fillColor(color).fontSize(12).font('Helvetica-Bold')
         .text(title, 60, doc.y - 22, { lineBreak: false })
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
      doc.moveDown(1.2)
    }

    // ── Helper: horizontal rule ────────────────────────────────────────────
    const hr = (color = COLORS.border) => {
      doc.moveDown(0.3)
      doc.moveTo(48, doc.y).lineTo(W + 48, doc.y).strokeColor(color).lineWidth(0.5).stroke()
      doc.moveDown(0.5)
    }

    // ── Helper: KPI box ────────────────────────────────────────────────────
    const kpiBox = (label, value, sub, x, y, boxW, color) => {
      doc.rect(x, y, boxW, 56).fillAndStroke(color + '12', color + '30')
      doc.fillColor(color).font('Helvetica-Bold').fontSize(16)
         .text(value, x + 8, y + 10, { width: boxW - 16, lineBreak: false })
      doc.fillColor(COLORS.subtext).font('Helvetica').fontSize(8)
         .text(label.toUpperCase(), x + 8, y + 30, { width: boxW - 16, lineBreak: false })
      if (sub) {
        doc.fillColor(COLORS.subtext).fontSize(7).text(sub, x + 8, y + 42, { width: boxW - 16, lineBreak: false })
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1: Cover + Executive Summary
    // ─────────────────────────────────────────────────────────────────────

    // Cover gradient bar
    doc.rect(0, 0, doc.page.width, 90).fill('#0f172a')
    doc.rect(0, 0, doc.page.width, 6).fill(COLORS.primary)

    // Title
    doc.fillColor('white').font('Helvetica-Bold').fontSize(24)
       .text('AI Business Co-Pilot', 48, 20, { lineBreak: false })
    doc.fillColor('#818cf8').font('Helvetica').fontSize(12)
       .text('Automated Analytics Report', 48, 50, { lineBreak: false })
    doc.fillColor('#475569').font('Helvetica').fontSize(9)
       .text(`Generated: ${new Date().toLocaleString()}  ·  Industry: ${(industry || 'General').charAt(0).toUpperCase() + (industry||'general').slice(1)}`, 48, 68)

    doc.fillColor(COLORS.text).font('Helvetica').fontSize(10)
    doc.moveDown(5)

    // Dataset info box
    doc.rect(48, doc.y, W, 44).fillAndStroke('#f8fafc', COLORS.border)
    const infoY = doc.y + 8
    doc.fillColor(COLORS.subtext).fontSize(8).font('Helvetica-Bold')
       .text('DATASET OVERVIEW', 60, infoY)
    const totalRows = kpis?.totalRows || aggregateStats?.rowCount || 0
    const dateRange = kpis?.dateRange || aggregateStats?.dateRange
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9)
       .text(`Records: ${totalRows.toLocaleString()}`, 60, infoY + 14, { lineBreak: false })
    if (dateRange) {
      doc.text(`  ·  Date Range: ${dateRange.from} → ${dateRange.to}`, { continued: true })
    }
    doc.text(`  ·  Anomalies: ${anomalies?.length || 0}`, { lineBreak: false })
    doc.moveDown(3)

    // ── KPI Cards ──────────────────────────────────────────────────────────
    sectionHeader('KEY PERFORMANCE INDICATORS')

    const metricEntries = Object.entries(kpis || {}).filter(([k,v]) => v && typeof v === 'object' && !Array.isArray(v))
    const boxW   = (W - 15) / 4
    const boxColors = [COLORS.primary, '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#84cc16']

    // Records + date range
    const specialBoxY = doc.y
    kpiBox('Total Records', totalRows.toLocaleString(), 'Dataset size', 48, specialBoxY, boxW, '#6366f1')
    if (dateRange) {
      kpiBox('Date Range', `${kpis?.dateDays || '—'}d`, `${dateRange.from} → ${dateRange.to}`, 48 + boxW + 5, specialBoxY, boxW, '#38bdf8')
    }
    doc.moveDown(4.2)

    // Metric KPIs in rows of 4
    let mIdx = 0
    while (mIdx < metricEntries.length) {
      const rowY = doc.y
      const rowItems = metricEntries.slice(mIdx, mIdx + 4)
      rowItems.forEach(([ key, val ], j) => {
        kpiBox(key, fmt(val.total), `avg ${fmt(val.avg)} · max ${fmt(val.max)}`, 48 + j * (boxW + 5), rowY, boxW, boxColors[mIdx + j] || COLORS.primary)
      })
      doc.moveDown(rowItems.length > 0 ? 4.8 : 0)
      mIdx += 4
    }

    doc.moveDown(0.5)
    hr()

    // ── Top Categories ─────────────────────────────────────────────────────
    const topCats = aggregateStats?.topCategories || []
    if (topCats.length > 0) {
      sectionHeader('TOP CATEGORIES', '#8b5cf6')
      const catTotal = topCats.reduce((s, c) => s + c.value, 0)
      topCats.slice(0, 8).forEach((cat, i) => {
        const pct  = catTotal > 0 ? ((cat.value / catTotal) * 100).toFixed(1) : 0
        const barW = Math.min((cat.value / catTotal) * (W - 160), W - 160)
        const rowY = doc.y
        doc.fillColor(COLORS.text).fontSize(9).text(`${i + 1}. ${cat.name}`, 48, rowY, { lineBreak: false })
        doc.fillColor(COLORS.subtext).fontSize(9).text(fmt(cat.value), 240, rowY, { lineBreak: false })
        doc.fillColor(COLORS.subtext).text(`${pct}%`, 310, rowY, { lineBreak: false })
        // Bar
        doc.rect(350, rowY + 1, barW, 10).fill(boxColors[i % boxColors.length] + '60')
        doc.rect(350, rowY + 1, barW, 10).stroke(boxColors[i % boxColors.length])
        doc.moveDown(1.1)
      })
      doc.moveDown(0.5)
      hr()
    }

    // ── Anomalies ──────────────────────────────────────────────────────────
    sectionHeader('ANOMALIES & ALERTS', anomalies?.length > 0 ? COLORS.danger : COLORS.success)
    if (!anomalies?.length) {
      doc.fillColor(COLORS.success).fontSize(10).text('✓ No anomalies detected — all values within normal statistical range (±2σ)')
    } else {
      anomalies.slice(0, 8).forEach((a, i) => {
        const aColor = a.direction === 'spike' ? COLORS.danger : COLORS.warning
        doc.rect(48, doc.y, W, 32).fillAndStroke(aColor + '08', aColor + '20')
        const aY = doc.y + 5
        doc.fillColor(aColor).font('Helvetica-Bold').fontSize(9)
           .text(`${a.direction === 'spike' ? '↑' : '↓'} ${a.column}${a.date ? ` — ${a.date}` : ''}`, 56, aY, { lineBreak: false })
        doc.fillColor(COLORS.subtext).font('Helvetica').fontSize(8)
           .text(a.message, 56, aY + 13, { width: W - 20 })
        doc.moveDown(2.2)
      })
    }
    hr()

    // ── Data Quality ───────────────────────────────────────────────────────
    if (qualityNotes?.length > 0) {
      sectionHeader('DATA QUALITY NOTES', COLORS.warning)
      qualityNotes.forEach(note => {
        doc.fillColor(COLORS.subtext).fontSize(9).text(`• ${note}`, { width: W })
        doc.moveDown(0.4)
      })
      hr()
    }

    // ── Add new page for insights ──────────────────────────────────────────
    doc.addPage()
    doc.rect(0, 0, doc.page.width, 6).fill(COLORS.primary)
    doc.moveDown(1)

    // ── AI Insights ────────────────────────────────────────────────────────
    sectionHeader('AI-GENERATED INSIGHTS', COLORS.primary)
    const savedInsights = cached.insights || []
    if (savedInsights.length > 0) {
      savedInsights.forEach((insight, i) => {
        doc.rect(48, doc.y, W, 28).fillAndStroke(COLORS.primary + '06', COLORS.primary + '15')
        doc.fillColor(COLORS.text).fontSize(9)
           .text(`${i + 1}. ${insight}`, 58, doc.y - 22, { width: W - 20 })
        doc.moveDown(2)
      })
    } else {
      doc.fillColor(COLORS.subtext).fontSize(9).text('AI insights not generated. Add ANTHROPIC_API_KEY to enable Claude AI analysis.')
    }
    hr()

    // ── Recommendations ────────────────────────────────────────────────────
    sectionHeader('RECOMMENDATIONS', '#10b981')
    const savedRecs = cached.recommendations || []
    if (savedRecs.length > 0) {
      savedRecs.forEach((rec, i) => {
        doc.rect(48, doc.y, 4, 24).fill('#10b981')
        doc.fillColor(COLORS.text).fontSize(9)
           .text(`${rec}`, 60, doc.y - 20, { width: W - 20 })
        doc.moveDown(1.8)
      })
    } else {
      const defaultRecs = [
        'Review top-performing categories and replicate success patterns across underperforming segments.',
        'Investigate anomalies flagged in the Alerts section to determine data errors or business events.',
        'Set up regular monitoring for key metrics to track trends over time.',
      ]
      defaultRecs.forEach((rec, i) => {
        doc.rect(48, doc.y, 4, 24).fill('#10b981')
        doc.fillColor(COLORS.text).fontSize(9).text(rec, 60, doc.y - 20, { width: W - 20 })
        doc.moveDown(1.8)
      })
    }
    hr()

    // ── Summary Stats ──────────────────────────────────────────────────────
    sectionHeader('SUMMARY STATISTICS', '#06b6d4')
    const summaryRows = [
      ['Metric', 'Total', 'Average', 'Min', 'Max', 'Count'],
      ...metricEntries.slice(0, 6).map(([key, val]) => [
        key, fmt(val.total), fmt(val.avg), fmt(val.min), fmt(val.max), val.count?.toLocaleString() || '—'
      ])
    ]
    const colW = W / 6
    summaryRows.forEach((row, ri) => {
      const rowY = doc.y
      const isHeader = ri === 0
      if (isHeader) doc.rect(48, rowY - 2, W, 16).fill('#e2e8f0')
      row.forEach((cell, ci) => {
        doc.fillColor(isHeader ? COLORS.text : COLORS.subtext)
           .font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8)
           .text(cell, 48 + ci * colW, rowY, { width: colW - 4, lineBreak: false })
      })
      if (ri > 0) doc.moveTo(48, doc.y + 2).lineTo(W + 48, doc.y + 2).strokeColor('#f1f5f9').lineWidth(0.3).stroke()
      doc.moveDown(1.1)
    })

    // ── Footer ─────────────────────────────────────────────────────────────
    doc.moveDown(2)
    hr('#cbd5e1')
    doc.fillColor(COLORS.subtext).fontSize(8)
       .text(`AI Business Co-Pilot  ·  ${new Date().toLocaleString()}  ·  Industry: ${industry || 'General'}  ·  Powered by Claude AI`, { align: 'center' })

    doc.end()
  } catch (err) {
    next(err)
  }
})

module.exports = router
