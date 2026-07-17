const { looksLikeDate, looksLikeNumeric } = require('./schemaDetector');

/**
 * Full data analysis: KPIs, chart data, anomaly detection, forecasting
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(v) {
  const s = String(v).replace(/[$,%]/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d;
  // Try DD/MM/YYYY
  const parts = String(v).split(/[\/\-]/);
  if (parts.length === 3 && parts[0].length <= 2) {
    const d2 = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────

function computeKPIs(rows, schema) {
  const kpis = {};
  kpis.totalRows = rows.length;

  const numericCols = schema.filter(c => c.type === 'numeric');
  const dateCols    = schema.filter(c => c.type === 'date');

  // Date range
  if (dateCols.length > 0) {
    const dateCol = dateCols[0].originalName;
    const dates = rows.map(r => parseDate(r[dateCol])).filter(Boolean).sort((a,b) => a-b);
    if (dates.length > 0) {
      kpis.dateRange = { from: dates[0].toISOString().split('T')[0], to: dates[dates.length-1].toISOString().split('T')[0] };
      kpis.dateDays = Math.round((dates[dates.length-1] - dates[0]) / (1000*60*60*24));
    }
  }

  // Numeric KPIs — increase to all numeric columns (not just 4)
  numericCols.slice(0, 8).forEach(col => {
    const vals = rows.map(r => toNumber(r[col.originalName])).filter(v => v !== null);
    if (vals.length === 0) return;
    kpis[col.name] = {
      total: vals.reduce((a, b) => a + b, 0),
      avg: mean(vals),
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
      nullCount: rows.length - vals.length,
    };
  });

  return kpis;
}

// ─── Chart Data ───────────────────────────────────────────────────────────────

function computeChartData(rows, schema) {
  const charts = {};
  const dateCols    = schema.filter(c => c.type === 'date');
  const numericCols = schema.filter(c => c.type === 'numeric');
  const catCols     = schema.filter(c => c.type === 'categorical');

  // Trend chart (date × first numeric)
  if (dateCols.length > 0 && numericCols.length > 0) {
    charts.trend = buildTrendChart(rows, dateCols[0], numericCols[0]);
  }

  // Category breakdown (top 10)
  if (catCols.length > 0 && numericCols.length > 0) {
    charts.categoryBreakdown = buildCategoryChart(rows, catCols[0], numericCols[0]);
  }

  // Distribution of first numeric (histogram)
  if (numericCols.length > 0) {
    charts.distribution = buildDistribution(rows, numericCols[0]);
  }

  // Scatter if 2+ numeric cols
  if (numericCols.length >= 2) {
    charts.scatter = buildScatter(rows, numericCols[0], numericCols[1]);
  }

  // Multi-metric trend if 2+ numeric cols with date
  if (dateCols.length > 0 && numericCols.length >= 2) {
    charts.multiTrend = buildMultiTrend(rows, dateCols[0], numericCols.slice(0, 3));
  }

  return charts;
}

function buildTrendChart(rows, dateCol, numCol) {
  const grouped = {};
  rows.forEach(row => {
    const d = parseDate(row[dateCol.originalName]);
    const v = toNumber(row[numCol.originalName]);
    if (!d || v === null) return;
    const key = d.toISOString().split('T')[0];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  });

  const sorted = Object.entries(grouped)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([date, vals]) => ({ date, value: vals.reduce((a, b) => a + b, 0), count: vals.length }));

  // Mark gaps
  const withGaps = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = new Date(sorted[i-1].date);
      const curr = new Date(sorted[i].date);
      const dayGap = (curr - prev) / (1000*60*60*24);
      if (dayGap > 7) {
        withGaps.push({ date: null, value: null, gap: true, gapDays: Math.round(dayGap) });
      }
    }
    withGaps.push(sorted[i]);
  }

  return { data: withGaps, xKey: 'date', yKey: 'value', label: numCol.name };
}

function buildCategoryChart(rows, catCol, numCol) {
  const grouped = {};
  rows.forEach(row => {
    const cat = String(row[catCol.originalName] || 'Unknown').trim();
    const v = toNumber(row[numCol.originalName]);
    if (v === null) return;
    grouped[cat] = (grouped[cat] || 0) + v;
  });

  // Include ALL categories — no artificial cap, no "Others" bucket
  const data = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));

  return { data, xKey: 'name', yKey: 'value', label: numCol.name, categoryLabel: catCol.name };
}

function buildDistribution(rows, numCol) {
  const vals = rows.map(r => toNumber(r[numCol.originalName])).filter(v => v !== null);
  if (vals.length === 0) return null;

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const buckets = 10;
  const step = (max - min) / buckets || 1;

  const hist = Array.from({ length: buckets }, (_, i) => ({
    range: `${(min + i * step).toFixed(1)}-${(min + (i+1) * step).toFixed(1)}`,
    count: 0,
  }));

  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), buckets - 1);
    hist[idx].count++;
  });

  return { data: hist, xKey: 'range', yKey: 'count', label: numCol.name };
}

function buildScatter(rows, col1, col2) {
  const data = rows.map(row => {
    const x = toNumber(row[col1.originalName]);
    const y = toNumber(row[col2.originalName]);
    if (x === null || y === null) return null;
    return { x, y };
  }).filter(Boolean).slice(0, 500); // cap for performance

  return { data, xKey: 'x', yKey: 'y', xLabel: col1.name, yLabel: col2.name };
}

function buildMultiTrend(rows, dateCol, numCols) {
  const grouped = {};
  rows.forEach(row => {
    const d = parseDate(row[dateCol.originalName]);
    if (!d) return;
    const key = d.toISOString().split('T')[0];
    if (!grouped[key]) grouped[key] = { date: key };
    numCols.forEach(col => {
      const v = toNumber(row[col.originalName]);
      if (v !== null) {
        grouped[key][col.name] = (grouped[key][col.name] || 0) + v;
      }
    });
  });

  const data = Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  return { data, keys: numCols.map(c => c.name) };
}

// ─── Anomaly Detection ────────────────────────────────────────────────────────

function detectAnomalies(rows, schema) {
  if (rows.length < 20) {
    return { anomalies: [], note: 'Insufficient data for anomaly detection (< 20 rows).' };
  }

  const numericCols = schema.filter(c => c.type === 'numeric');
  const dateCols    = schema.filter(c => c.type === 'date');
  const anomalies   = [];

  numericCols.slice(0, 3).forEach(col => {
    const pairs = rows.map(r => ({
      date: dateCols.length > 0 ? parseDate(r[dateCols[0].originalName]) : null,
      value: toNumber(r[col.originalName]),
      raw: r,
    })).filter(p => p.value !== null);

    if (pairs.length < 10) return;

    const vals = pairs.map(p => p.value);
    const m = mean(vals);
    const sd = stddev(vals);

    pairs.forEach(({ date, value }) => {
      const zScore = sd > 0 ? Math.abs(value - m) / sd : 0;
      if (zScore > 2) {
        anomalies.push({
          column: col.name,
          date: date ? date.toISOString().split('T')[0] : null,
          value,
          mean: m,
          zScore: zScore.toFixed(2),
          direction: value > m ? 'spike' : 'drop',
          message: `${col.name}: ${value > m ? 'Unusual spike' : 'Unusual drop'} detected — value ${value.toFixed(2)} is ${zScore.toFixed(1)}x std dev from mean (${m.toFixed(2)})`,
        });
      }
    });
  });

  // Sort by z-score
  anomalies.sort((a, b) => b.zScore - a.zScore);

  return { anomalies: anomalies.slice(0, 10), note: null };
}

// ─── Forecasting ──────────────────────────────────────────────────────────────

function buildForecast(rows, schema, daysAhead = 30) {
  const dateCols    = schema.filter(c => c.type === 'date');
  const numericCols = schema.filter(c => c.type === 'numeric');

  if (dateCols.length === 0 || numericCols.length === 0) {
    return { forecast: null, note: 'Forecasting requires both a date column and a numeric metric column.' };
  }

  const dateCol = dateCols[0];
  const numCol  = numericCols[0];

  const pairs = rows.map(r => {
    const d = parseDate(r[dateCol.originalName]);
    const v = toNumber(r[numCol.originalName]);
    if (!d || v === null) return null;
    return { date: d, value: v };
  }).filter(Boolean).sort((a, b) => a.date - b.date);

  if (pairs.length < 10) {
    return { forecast: null, note: 'Not enough historical data for reliable forecasting (minimum 10 data points required).' };
  }

  // Aggregate by day
  const dayMap = {};
  pairs.forEach(({ date, value }) => {
    const key = date.toISOString().split('T')[0];
    dayMap[key] = (dayMap[key] || 0) + value;
  });
  const dailySeries = Object.entries(dayMap).sort(([a], [b]) => new Date(a) - new Date(b));

  if (dailySeries.length < 7) {
    return { forecast: null, note: 'Not enough distinct time periods for forecasting.' };
  }

  // Check variance
  const seriesVals = dailySeries.map(([, v]) => v);
  const allSame = seriesVals.every(v => v === seriesVals[0]);
  if (allSame) {
    return { forecast: null, note: 'All metric values are identical — no trend to forecast.' };
  }

  // Simple linear regression on index
  const n = dailySeries.length;
  const x = dailySeries.map((_, i) => i);
  const y = seriesVals;
  const xMean = mean(x);
  const yMean = mean(y);
  const slope = x.reduce((s, xi, i) => s + (xi - xMean) * (y[i] - yMean), 0) /
                x.reduce((s, xi) => s + (xi - xMean) ** 2, 0);
  const intercept = yMean - slope * xMean;

  // Residuals for confidence interval
  const residuals = y.map((yi, i) => yi - (slope * i + intercept));
  const residualStd = stddev(residuals);

  // Moving average smoothed
  const windowSize = Math.min(7, Math.floor(n / 2));
  const smoothed = dailySeries.map(([date, v], i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = seriesVals.slice(start, i + 1);
    return { date, actual: v, smoothed: mean(window), trend: slope * i + intercept };
  });

  // Future predictions
  const lastDate = new Date(dailySeries[n-1][0]);
  const future = [];
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(lastDate);
    d.setDate(d.getDate() + i);
    const predicted = Math.max(0, slope * (n + i - 1) + intercept);
    future.push({
      date: d.toISOString().split('T')[0],
      predicted,
      lower: Math.max(0, predicted - 1.96 * residualStd),
      upper: predicted + 1.96 * residualStd,
      isForecast: true,
    });
  }

  const highlyVolatile = residualStd > Math.abs(yMean) * 0.5;

  return {
    forecast: {
      historical: smoothed,
      future,
      slope,
      column: numCol.name,
      dateColumn: dateCol.name,
    },
    note: highlyVolatile
      ? 'Data is highly volatile — forecast trend line shown for reference only; actual values may differ significantly.'
      : 'Forecast based on linear trend. Accuracy depends on data consistency and volume.',
  };
}

// ─── Data Quality ─────────────────────────────────────────────────────────────

function assessDataQuality(rows, schema) {
  const notes = [];
  const totalRows = rows.length;

  schema.forEach(col => {
    const vals = rows.map(r => r[col.originalName]);
    const nullCount = vals.filter(v => v === null || v === undefined || v === '').length;
    const nullPct = (nullCount / totalRows * 100).toFixed(1);

    if (nullCount > 0) {
      notes.push(`"${col.name}" has ${nullCount} missing values (${nullPct}%) — rows with missing values are excluded from charts.`);
    }

    if (col.type === 'numeric') {
      const nums = vals.map(v => parseFloat(String(v).replace(/[$,%]/g,''))).filter(v => !isNaN(v));
      const negatives = nums.filter(v => v < 0);
      if (negatives.length > 0) notes.push(`"${col.name}" contains ${negatives.length} negative value(s) — may indicate data entry issues.`);

      const allSame = nums.length > 1 && nums.every(v => v === nums[0]);
      if (allSame) notes.push(`"${col.name}" has no variance (all values identical) — excluded from trend and correlation analysis.`);
    }
  });

  return notes;
}

// ─── Aggregate Stats for AI ───────────────────────────────────────────────────

function buildAggregateStats(rows, schema, kpis, chartData) {
  const stats = {
    rowCount: rows.length,
    columnCount: schema.length,
    columns: schema.map(c => ({ name: c.name, type: c.type, originalName: c.originalName })),
    kpis: {},
    topCategories: [],
    dateRange: kpis.dateRange || null,
    columnProfiles: [],   // ← new: rich per-column metadata for AI reasoning
  };

  // ── Numeric summaries ─────────────────────────────────────────────────────
  schema.filter(c => c.type === 'numeric').slice(0, 6).forEach(col => {
    if (kpis[col.name]) {
      stats.kpis[col.name] = {
        total: Math.round(kpis[col.name].total * 100) / 100,
        avg:   Math.round(kpis[col.name].avg   * 100) / 100,
        min:   kpis[col.name].min,
        max:   kpis[col.name].max,
        count: kpis[col.name].count,
        nullCount: kpis[col.name].nullCount,
      };
    }
  });

  // ── Top categories ────────────────────────────────────────────────────────
  if (chartData.categoryBreakdown) {
    stats.topCategories = chartData.categoryBreakdown.data.slice(0, 8).map(d => ({
      name:  d.name,
      value: Math.round(d.value * 100) / 100,
    }));
  }

  // ── Per-column profiles (used by AI for dataset-agnostic reasoning) ───────
  stats.columnProfiles = schema.map(col => {
    const vals = rows.map(r => r[col.originalName]).filter(v => v !== null && v !== undefined && v !== '')
    const nullCount = rows.length - vals.length
    const profile = {
      name:        col.name,
      originalName:col.originalName,
      type:        col.type,
      nullCount,
      nullPct:     +(nullCount / rows.length * 100).toFixed(1),
      sampleValues: [...new Set(vals.slice(0, 20).map(v => String(v)))].slice(0, 5),
    }

    if (col.type === 'numeric') {
      const nums = vals.map(v => parseFloat(String(v).replace(/[$,%]/g,''))).filter(v => !isNaN(v))
      if (nums.length > 0) {
        const sorted = [...nums].sort((a, b) => a - b)
        const m = nums.reduce((a, b) => a + b, 0) / nums.length
        profile.min    = sorted[0]
        profile.max    = sorted[sorted.length - 1]
        profile.mean   = Math.round(m * 100) / 100
        profile.median = sorted[Math.floor(sorted.length / 2)]
        profile.uniqueCount = new Set(nums).size
        profile.isLikelyMoney = col.name.match(/revenue|sales|profit|cost|price|amount|income|spend|fee|salary|wage/i) ? true : undefined
        profile.isLikelyRate  = col.name.match(/rate|ratio|pct|percent|score|index|rank/i) ? true : undefined
      }
    }

    if (col.type === 'categorical') {
      const unique = [...new Set(vals.map(v => String(v)))]
      profile.uniqueCount   = unique.length
      profile.topValues     = unique.slice(0, 6)
      profile.isLikelyGroup = col.name.match(/region|country|city|department|category|segment|type|group|channel|product|brand/i) ? true : undefined
    }

    if (col.type === 'date') {
      profile.isTimeDimension = true
      if (kpis.dateRange) {
        profile.from = kpis.dateRange.from
        profile.to   = kpis.dateRange.to
        profile.spanDays = kpis.dateDays
        profile.bestGranularity = kpis.dateDays > 730 ? 'year' : kpis.dateDays > 60 ? 'month' : kpis.dateDays > 14 ? 'week' : 'day'
      }
    }

    return profile
  })

  return stats;
}

module.exports = { computeKPIs, computeChartData, detectAnomalies, buildForecast, assessDataQuality, buildAggregateStats };
