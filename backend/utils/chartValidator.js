/**
 * chartValidator.js
 * Determines which chart types are available/disabled for a given dataset schema.
 * Works for ANY CSV — never assumes column names.
 */

const CHART_DEFINITIONS = {
  bar:              { label: 'Bar Chart',           emoji: '📊', requires: ['categorical','numeric'] },
  horizontalBar:    { label: 'Horizontal Bar',      emoji: '📊', requires: ['categorical','numeric'] },
  pie:              { label: 'Pie Chart',            emoji: '🥧', requires: ['categorical','numeric'] },
  donut:            { label: 'Donut Chart',          emoji: '🍩', requires: ['categorical','numeric'] },
  histogram:        { label: 'Histogram',            emoji: '📊', requires: ['numeric'] },
  kde:              { label: 'KDE Density',          emoji: '〽️', requires: ['numeric'] },
  scatter:          { label: 'Scatter Plot',         emoji: '🔵', requires: ['numeric','numeric'] },
  bubble:           { label: 'Bubble Chart',         emoji: '⚪', requires: ['numeric','numeric','numeric'] },
  heatmap:          { label: 'Heatmap',              emoji: '🔲', requires: ['numeric','numeric'] },
  line:             { label: 'Line Chart',           emoji: '📈', requires: ['date','numeric'] },
  area:             { label: 'Area Chart',           emoji: '📈', requires: ['date','numeric'] },
  multiLine:        { label: 'Multi-Line Chart',     emoji: '📉', requires: ['date','numeric','numeric'] },
  timeSeries:       { label: 'Time Series',          emoji: '📅', requires: ['date','numeric'] },
  boxPlot:          { label: 'Box Plot',             emoji: '📦', requires: ['numeric'] },
  violinPlot:       { label: 'Violin Plot',          emoji: '🎻', requires: ['numeric'] },
  radar:            { label: 'Radar Chart',          emoji: '🕸️', requires: ['numeric','numeric','numeric'] },
  parallelCoords:   { label: 'Parallel Coordinates', emoji: '📐', requires: ['numeric','numeric','numeric'] },
  calendarHeatmap:  { label: 'Calendar Heatmap',     emoji: '📆', requires: ['date'] },
  candlestick:      { label: 'Candlestick',          emoji: '🕯️', requires: ['date','open','high','low','close'] },
  treemap:          { label: 'Treemap',              emoji: '🟦', requires: ['categorical','numeric'] },
  sankey:           { label: 'Sankey Diagram',       emoji: '🌊', requires: ['categorical','categorical'] },
}

// Detect geographic columns by name heuristic
function hasGeoColumns(schema) {
  return schema.some(c =>
    /country|state|region|city|province|latitude|longitude|lat|lon|lng|geo|location|place/i.test(c.name)
  )
}

// Detect OHLC (candlestick) columns
function hasOHLC(schema) {
  const names = schema.map(c => c.name.toLowerCase())
  return (
    names.some(n => /open|opening/i.test(n)) &&
    names.some(n => /high|highest/i.test(n)) &&
    names.some(n => /low|lowest/i.test(n))   &&
    names.some(n => /close|closing/i.test(n))&&
    schema.some(c => c.type === 'date')
  )
}

/**
 * Main validator — call after CSV upload.
 * Returns { available, disabled } lists with reasons and alternatives.
 */
function validateCharts(schema) {
  const numericCols     = schema.filter(c => c.type === 'numeric')
  const categoricalCols = schema.filter(c => c.type === 'categorical')
  const dateCols        = schema.filter(c => c.type === 'date')

  const available = []
  const disabled  = []

  // ── Bar / Horizontal Bar ──────────────────────────────────────────────────
  if (categoricalCols.length >= 1 && numericCols.length >= 1) {
    available.push({ key:'bar',           ...CHART_DEFINITIONS.bar,           fields: { dimension: categoricalCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'horizontalBar', ...CHART_DEFINITIONS.horizontalBar, fields: { dimension: categoricalCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'pie',           ...CHART_DEFINITIONS.pie,           fields: { dimension: categoricalCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'donut',         ...CHART_DEFINITIONS.donut,         fields: { dimension: categoricalCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'treemap',       ...CHART_DEFINITIONS.treemap,       fields: { dimension: categoricalCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
  } else {
    const missing = []
    if (!categoricalCols.length) missing.push('no categorical column found')
    if (!numericCols.length)     missing.push('no numeric column found')
    const reason = `Requires one categorical + one numeric column. ${missing.join('; ')}.`
    const alts   = numericCols.length ? ['histogram','scatter'] : []
    disabled.push({ key:'bar',           ...CHART_DEFINITIONS.bar,           reason, alternatives: alts })
    disabled.push({ key:'horizontalBar', ...CHART_DEFINITIONS.horizontalBar, reason, alternatives: alts })
    disabled.push({ key:'pie',           ...CHART_DEFINITIONS.pie,           reason, alternatives: alts })
    disabled.push({ key:'donut',         ...CHART_DEFINITIONS.donut,         reason, alternatives: alts })
    disabled.push({ key:'treemap',       ...CHART_DEFINITIONS.treemap,       reason, alternatives: alts })
  }

  // ── Histogram / KDE / Box Plot / Violin ───────────────────────────────────
  if (numericCols.length >= 1) {
    available.push({ key:'histogram',  ...CHART_DEFINITIONS.histogram,  fields: { metric: numericCols.map(c=>c.name) } })
    available.push({ key:'kde',        ...CHART_DEFINITIONS.kde,        fields: { metric: numericCols.map(c=>c.name) } })
    available.push({ key:'boxPlot',    ...CHART_DEFINITIONS.boxPlot,    fields: { metric: numericCols.map(c=>c.name), dimension: categoricalCols.map(c=>c.name) } })
    available.push({ key:'violinPlot', ...CHART_DEFINITIONS.violinPlot, fields: { metric: numericCols.map(c=>c.name) } })
  } else {
    const reason = 'Requires at least one numeric column. None found in this dataset.'
    disabled.push({ key:'histogram',  ...CHART_DEFINITIONS.histogram,  reason, alternatives: ['bar','pie'] })
    disabled.push({ key:'kde',        ...CHART_DEFINITIONS.kde,        reason, alternatives: ['histogram'] })
    disabled.push({ key:'boxPlot',    ...CHART_DEFINITIONS.boxPlot,    reason, alternatives: ['histogram'] })
    disabled.push({ key:'violinPlot', ...CHART_DEFINITIONS.violinPlot, reason, alternatives: ['histogram'] })
  }

  // ── Scatter / Bubble / Heatmap ────────────────────────────────────────────
  if (numericCols.length >= 2) {
    available.push({ key:'scatter',  ...CHART_DEFINITIONS.scatter,  fields: { metric: numericCols.map(c=>c.name), metric2: numericCols.map(c=>c.name), dimension: categoricalCols.map(c=>c.name) } })
    available.push({ key:'heatmap',  ...CHART_DEFINITIONS.heatmap,  fields: { note: ['Uses all numeric columns automatically'] } })
  } else {
    const reason = `Requires at least 2 numeric columns. Only ${numericCols.length} found.`
    disabled.push({ key:'scatter', ...CHART_DEFINITIONS.scatter, reason, alternatives: ['bar','histogram'] })
    disabled.push({ key:'heatmap', ...CHART_DEFINITIONS.heatmap, reason, alternatives: ['bar','histogram'] })
  }

  if (numericCols.length >= 3) {
    available.push({ key:'bubble',         ...CHART_DEFINITIONS.bubble,         fields: { metric: numericCols.map(c=>c.name) } })
    available.push({ key:'radar',          ...CHART_DEFINITIONS.radar,          fields: { metrics: numericCols.map(c=>c.name) } })
    available.push({ key:'parallelCoords', ...CHART_DEFINITIONS.parallelCoords, fields: { metrics: numericCols.map(c=>c.name) } })
  } else {
    const reason = `Requires at least 3 numeric columns. Only ${numericCols.length} found.`
    disabled.push({ key:'bubble',         ...CHART_DEFINITIONS.bubble,         reason, alternatives: ['scatter'] })
    disabled.push({ key:'radar',          ...CHART_DEFINITIONS.radar,          reason, alternatives: ['heatmap','bar'] })
    disabled.push({ key:'parallelCoords', ...CHART_DEFINITIONS.parallelCoords, reason, alternatives: ['scatter','heatmap'] })
  }

  // ── Line / Area / Multi-Line / Time Series / Calendar Heatmap ────────────
  if (dateCols.length >= 1 && numericCols.length >= 1) {
    available.push({ key:'line',           ...CHART_DEFINITIONS.line,           fields: { dimension: dateCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'area',           ...CHART_DEFINITIONS.area,           fields: { dimension: dateCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'timeSeries',     ...CHART_DEFINITIONS.timeSeries,     fields: { dimension: dateCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
    available.push({ key:'calendarHeatmap',...CHART_DEFINITIONS.calendarHeatmap,fields: { dimension: dateCols.map(c=>c.name), metric: numericCols.map(c=>c.name) } })
  } else {
    const reason = dateCols.length === 0
      ? 'No Date/Time column found. Line and time-based charts require a date column. The application will never fabricate dates.'
      : 'No numeric column found for the Y-axis.'
    const alts = categoricalCols.length ? ['bar','histogram'] : ['histogram']
    disabled.push({ key:'line',            ...CHART_DEFINITIONS.line,            reason, alternatives: alts })
    disabled.push({ key:'area',            ...CHART_DEFINITIONS.area,            reason, alternatives: alts })
    disabled.push({ key:'timeSeries',      ...CHART_DEFINITIONS.timeSeries,      reason, alternatives: alts })
    disabled.push({ key:'calendarHeatmap', ...CHART_DEFINITIONS.calendarHeatmap, reason, alternatives: alts })
  }

  if (dateCols.length >= 1 && numericCols.length >= 2) {
    available.push({ key:'multiLine', ...CHART_DEFINITIONS.multiLine, fields: { dimension: dateCols.map(c=>c.name), metrics: numericCols.map(c=>c.name) } })
  } else {
    const reason = dateCols.length === 0
      ? 'No Date/Time column found. Multi-line chart requires a date column.'
      : `Requires 2+ numeric columns. Only ${numericCols.length} found.`
    disabled.push({ key:'multiLine', ...CHART_DEFINITIONS.multiLine, reason, alternatives: ['scatter','heatmap'] })
  }

  // ── Candlestick ───────────────────────────────────────────────────────────
  if (hasOHLC(schema)) {
    const ohlcCols = schema.filter(c => /open|high|low|close/i.test(c.name) && c.type==='numeric').map(c=>c.name)
    available.push({ key:'candlestick', ...CHART_DEFINITIONS.candlestick, fields: { dimension: dateCols.map(c=>c.name), metrics: ohlcCols } })
  } else {
    disabled.push({ key:'candlestick', ...CHART_DEFINITIONS.candlestick, reason: 'Dataset must contain Date, Open, High, Low, and Close columns. Not found in this dataset.', alternatives: ['line','area'] })
  }

  // ── Sankey ────────────────────────────────────────────────────────────────
  if (categoricalCols.length >= 2) {
    available.push({ key:'sankey', ...CHART_DEFINITIONS.sankey, fields: { source: categoricalCols.map(c=>c.name), target: categoricalCols.map(c=>c.name) } })
  } else {
    disabled.push({ key:'sankey', ...CHART_DEFINITIONS.sankey, reason: `Requires 2 categorical columns. Only ${categoricalCols.length} found.`, alternatives: ['bar','pie'] })
  }

  // ── Choropleth Map ────────────────────────────────────────────────────────
  if (hasGeoColumns(schema)) {
    const geoCols = schema.filter(c => /country|state|region|city|lat|lon/i.test(c.name)).map(c=>c.name)
    available.push({ key:'choropleth', label:'Choropleth Map', emoji:'🗺️', fields: { dimension: geoCols, metric: numericCols.map(c=>c.name) } })
  } else {
    disabled.push({ key:'choropleth', label:'Choropleth Map', emoji:'🗺️', reason: 'No geographic columns detected (country, state, region, city, latitude, longitude).', alternatives: ['bar','pie'] })
  }

  return {
    available,
    disabled,
    summary: {
      totalCharts:     available.length + disabled.length,
      availableCount:  available.length,
      disabledCount:   disabled.length,
      hasDate:         dateCols.length > 0,
      hasNumeric:      numericCols.length > 0,
      hasCategorical:  categoricalCols.length > 0,
      numericCount:    numericCols.length,
      categoricalCount:categoricalCols.length,
      dateCount:       dateCols.length,
    }
  }
}

module.exports = { validateCharts }
