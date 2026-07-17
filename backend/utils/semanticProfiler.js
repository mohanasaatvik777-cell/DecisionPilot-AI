/**
 * semanticProfiler.js
 *
 * Profiles every column in an uploaded dataset and classifies it into one of
 * the following semantic roles:
 *
 *   MEASURE      — additive numeric quantity  (Revenue, Sales, Profit, Quantity)
 *   CONTINUOUS   — non-additive numeric rate  (CGPA, Attendance, Age, Temperature)
 *   IDENTIFIER   — surrogate key / ID         (StudentID, OrderID, RollNo)
 *   ORDINAL      — ordered categorical/numeric (Semester, Level, Grade, Rank)
 *   TEMPORAL     — date or time value          (Year, Month, Date)
 *   DIMENSION    — categorical grouping field  (Department, Region, Gender)
 *   BOOLEAN      — binary flag                 (IsActive, HasPaid)
 *   TEXT         — free-form text              (Description, Notes)
 *
 * The engine is FULLY GENERIC — it never hardcodes dataset names.
 * It uses: column name patterns, data distribution, cardinality, and
 * statistical properties to infer semantic role.
 *
 * Usage:
 *   const { profileColumns } = require('./semanticProfiler')
 *   const profiles = profileColumns(rows, schema)
 *   // profiles[i].semanticType  → 'MEASURE' | 'CONTINUOUS' | 'IDENTIFIER' | ...
 *   // profiles[i].recommendedAgg → 'sum' | 'avg' | 'count' | null
 *   // profiles[i].aggConfidence  → 'high' | 'medium' | 'low'
 */

'use strict'

// ── Pattern libraries ─────────────────────────────────────────────────────────

// Strong signals → MEASURE (additive, can be SUMmed meaningfully)
const MEASURE_PATTERNS = [
  /revenue/i, /sales/i, /profit/i, /loss/i, /income/i, /expense/i,
  /cost/i, /price/i, /amount/i, /total/i, /fee/i, /spend/i, /budget/i,
  /earnings/i, /salary/i, /wage/i, /quantity/i, /\bqty\b/i, /units/i,
  /volume/i, /count/i, /hours/i, /marks/i, /points/i, /score\s*total/i,
  /population/i, /weight/i, /distance/i, /duration/i, /clicks/i,
  /impressions/i, /conversions/i, /transactions/i, /payments/i,
  /downloads/i, /installs/i, /views/i, /purchases/i,
]

// Strong signals → CONTINUOUS (rate/ratio, should be AVGed not SUMmed)
const CONTINUOUS_PATTERNS = [
  /\brate\b/i, /\bratio\b/i, /\bpct\b/i, /percent/i, /\bindex\b/i,
  /\brank\b/i, /\bage\b/i, /\bavg\b/i, /average/i, /\bmean\b/i,
  /\bcgpa\b/i, /\bgpa\b/i, /\bgrade\b(?!s)/i, /attendance/i,
  /temperature/i, /\bheight\b/i, /\bweight\b(?!\s*total)/i,
  /\bbmi\b/i, /rating/i, /satisfaction/i, /efficiency/i,
  /\blatitude\b/i, /\blongitude\b/i, /\bspeed\b/i, /\bdensity\b/i,
  /pressure/i, /humidity/i, /probability/i, /likelihood/i,
]

// Strong signals → IDENTIFIER (surrogate key, never meaningful to aggregate)
const IDENTIFIER_PATTERNS = [
  /\bid\b/i, /\buuid\b/i, /\bsku\b/i, /\bcode\b/i, /\bref\b/i,
  /\bnumber\b/i, /\bnum\b/i, /\bno\b\.?$/i, /serial/i,
  /invoice/i, /order[_\s]*id/i, /transaction[_\s]*id/i,
  /student[_\s]*id/i, /employee[_\s]*id/i, /roll[_\s]*no/i,
  /customer[_\s]*id/i, /user[_\s]*id/i, /product[_\s]*id/i,
  /record[_\s]*id/i, /row[_\s]*id/i, /\bpin\b/i, /\bzip\b/i,
  /postal/i, /phone/i, /mobile/i,
]

// Strong signals → ORDINAL (ordered, use COUNT or AVG contextually — never SUM)
const ORDINAL_PATTERNS = [
  /semester/i, /\bterm\b/i, /\blevel\b/i, /\bstage\b/i, /\bphase\b/i,
  /\bround\b/i, /\bquarter\b(?!ly)/i, /\bgrade\b/i, /\bclass\b/i,
  /\brank\b/i, /priority/i, /severity/i, /difficulty/i,
  /\bstep\b/i, /\border\b/i, /sequence/i, /position/i,
  /\btier\b/i, /\blayer\b/i, /\bband\b/i,
]

// Strong signals → TEMPORAL
const TEMPORAL_PATTERNS = [
  /\bdate\b/i, /\btime\b/i, /\byear\b/i, /\bmonth\b/i, /\bweek\b/i,
  /\bday\b/i, /\bhour\b/i, /\bminute\b/i, /\bperiod\b/i,
  /timestamp/i, /created/i, /updated/i, /modified/i,
  /\bfiscal\b/i, /quarter(?:ly)?/i,
]

// Strong signals → DIMENSION (grouping/categorical field)
const DIMENSION_PATTERNS = [
  /\bname\b/i, /\btype\b/i, /category/i, /region/i, /\bcity\b/i,
  /country/i, /\bstate\b/i, /department/i, /division/i, /\bsex\b/i,
  /gender/i, /industry/i, /segment/i, /channel/i, /source/i,
  /\bbrand\b/i, /product/i, /\bgroup\b/i, /\bteam\b/i, /\bunit\b(?!\s*s)/i,
  /\brole\b/i, /\bjob\b/i, /\btitle\b/i, /\bstatus\b/i, /\bflag\b/i,
  /\blabel\b/i, /\btag\b/i, /\bclass\b/i, /\bsector\b/i,
]

// ── Math helpers ──────────────────────────────────────────────────────────────
function toNum(v) {
  const n = parseFloat(String(v).replace(/[$,%\s]/g, ''))
  return isNaN(n) ? null : n
}

function computeStats(nums) {
  if (!nums.length) return {}
  const sorted = [...nums].sort((a, b) => a - b)
  const n = nums.length
  const sum = nums.reduce((a, b) => a + b, 0)
  const mean = sum / n
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Math.round(mean * 1000) / 1000,
    median: sorted[Math.floor(n / 2)],
    std: Math.round(std * 1000) / 1000,
    sum,
    count: n,
    uniqueCount: new Set(nums).size,
    uniqueRatio: new Set(nums).size / n,
    coefficientOfVariation: mean !== 0 ? std / Math.abs(mean) : Infinity,
  }
}

// ── Pattern match helpers ─────────────────────────────────────────────────────
function matchesAny(name, patterns) {
  return patterns.some(p => p.test(name))
}

function matchScore(name, patterns) {
  return patterns.filter(p => p.test(name)).length
}

// ── Core: classify a single column ───────────────────────────────────────────
/**
 * Classify one column into a semantic type.
 *
 * @param {string} colName       - column header name
 * @param {string} detectedType  - schema type: 'numeric'|'categorical'|'date'|'identifier'|'text'
 * @param {any[]}  samples       - up to 100 sample values from the column
 * @param {object} stats         - precomputed stats (min, max, mean, std, uniqueCount, uniqueRatio, count)
 * @returns {{ semanticType, confidence, reasoning }}
 */
function classifyColumn(colName, detectedType, samples, stats) {
  const name = colName.trim()

  // ── Already identified as identifier by schema detector ──────────────────
  if (detectedType === 'identifier') {
    return { semanticType: 'IDENTIFIER', confidence: 'high', reasoning: 'Schema detector flagged as identifier (high unique ratio + ID keyword).' }
  }

  // ── Date types ────────────────────────────────────────────────────────────
  if (detectedType === 'date') {
    return { semanticType: 'TEMPORAL', confidence: 'high', reasoning: 'Column contains date/time values.' }
  }

  // ── Text types ────────────────────────────────────────────────────────────
  if (detectedType === 'text') {
    return { semanticType: 'TEXT', confidence: 'high', reasoning: 'Column contains long free-form text.' }
  }

  // ── Numeric columns ───────────────────────────────────────────────────────
  if (detectedType === 'numeric') {
    // 1. Check for temporal numeric (Year, Month, etc.)
    if (matchesAny(name, TEMPORAL_PATTERNS)) {
      // Further check: year-like values (1900–2100)
      if (/\byear\b/i.test(name) && stats.min >= 1900 && stats.max <= 2200) {
        return { semanticType: 'TEMPORAL', confidence: 'high', reasoning: 'Numeric year values — temporal field, not measurable.' }
      }
      if (/\bmonth\b/i.test(name) && stats.min >= 1 && stats.max <= 12) {
        return { semanticType: 'TEMPORAL', confidence: 'high', reasoning: 'Numeric month values (1–12) — temporal field, not measurable.' }
      }
    }

    // 2. Check for ORDINAL numeric (Semester, Level, Rank, etc.)
    if (matchesAny(name, ORDINAL_PATTERNS)) {
      return { semanticType: 'ORDINAL', confidence: 'high', reasoning: `"${name}" pattern matches ordinal field (ordered categorical). SUM is meaningless.` }
    }

    // 3. Check for IDENTIFIER by name pattern
    if (matchesAny(name, IDENTIFIER_PATTERNS)) {
      // Confirm with high unique ratio
      if (stats.uniqueRatio > 0.7) {
        return { semanticType: 'IDENTIFIER', confidence: 'high', reasoning: `"${name}" matches identifier pattern with high cardinality (${Math.round(stats.uniqueRatio * 100)}% unique).` }
      }
    }

    // 4. Check for CONTINUOUS (rate/ratio) — before MEASURE check
    if (matchesAny(name, CONTINUOUS_PATTERNS)) {
      return { semanticType: 'CONTINUOUS', confidence: 'high', reasoning: `"${name}" is a rate/ratio/average — use AVG, not SUM.` }
    }

    // 5. Distribution-based heuristics for numeric
    //    High uniqueRatio + integer-like values with small range → possibly ORDINAL
    if (stats.uniqueCount <= 20 && stats.uniqueRatio < 0.15 && stats.min >= 1 && stats.max <= 20) {
      // Small integer range with very low cardinality → likely ordinal (semester 1-8, level 1-5)
      return {
        semanticType: 'ORDINAL',
        confidence: 'medium',
        reasoning: `Low unique count (${stats.uniqueCount}) in range [${stats.min}–${stats.max}] suggests ordinal values, not a measurable quantity.`,
      }
    }

    // 6. Check for MEASURE — additive by name
    if (matchesAny(name, MEASURE_PATTERNS)) {
      return { semanticType: 'MEASURE', confidence: 'high', reasoning: `"${name}" matches additive measure pattern — SUM is appropriate.` }
    }

    // 7. Distribution-based: if values look like percentages (0–100 with float decimals) → CONTINUOUS
    if (stats.min >= 0 && stats.max <= 100 && stats.std > 0 && stats.uniqueCount > 10) {
      if (stats.mean < 100 && stats.coefficientOfVariation < 1.5) {
        return {
          semanticType: 'CONTINUOUS',
          confidence: 'medium',
          reasoning: `Values in range [${stats.min}–${stats.max}] with mean ${stats.mean} appear to be a rate/percentage — AVG is more meaningful than SUM.`,
        }
      }
    }

    // 8. High cardinality numeric with no clear identity → could be MEASURE (additive)
    //    but with low confidence — prefer AVG as the safer default
    if (stats.uniqueRatio > 0.8) {
      return {
        semanticType: 'CONTINUOUS',
        confidence: 'low',
        reasoning: `High-cardinality numeric with no matching keyword pattern — defaulting to CONTINUOUS (AVG). User should verify.`,
      }
    }

    // 9. Default for numeric without any signal → MEASURE with low confidence
    return {
      semanticType: 'MEASURE',
      confidence: 'low',
      reasoning: `No strong signals found for "${name}". Treating as MEASURE, but please verify the aggregation.`,
    }
  }

  // ── Categorical columns ───────────────────────────────────────────────────
  if (detectedType === 'categorical') {
    // Boolean check
    const uniqueVals = [...new Set(samples.map(v => String(v).toLowerCase().trim()))]
    const BOOL_VALS  = new Set(['true','false','yes','no','y','n','1','0','active','inactive','enabled','disabled'])
    if (uniqueVals.length === 2 && uniqueVals.every(v => BOOL_VALS.has(v))) {
      return { semanticType: 'BOOLEAN', confidence: 'high', reasoning: 'Two-value categorical matching boolean pattern.' }
    }

    // Temporal name on categorical (e.g. "Month" stored as "January" strings)
    if (matchesAny(name, TEMPORAL_PATTERNS)) {
      return { semanticType: 'TEMPORAL', confidence: 'medium', reasoning: `"${name}" suggests temporal values stored as categories.` }
    }

    // Ordinal categorical (e.g. "Grade" = A/B/C/D, "Level" = Junior/Senior)
    if (matchesAny(name, ORDINAL_PATTERNS)) {
      return { semanticType: 'ORDINAL', confidence: 'medium', reasoning: `"${name}" matches ordinal pattern.` }
    }

    // Standard grouping dimension
    return { semanticType: 'DIMENSION', confidence: 'high', reasoning: `"${name}" is a categorical grouping column.` }
  }

  // Fallback
  return { semanticType: 'DIMENSION', confidence: 'low', reasoning: 'Could not determine semantic type. Defaulting to DIMENSION.' }
}

// ── Main export: profile all columns ─────────────────────────────────────────
/**
 * Profile every column in the dataset.
 *
 * @param {object[]} rows   - parsed CSV rows
 * @param {object[]} schema - detected schema (name, originalName, type)
 * @returns {object[]}      - enriched column profiles with semanticType, recommendedAgg, etc.
 */
function profileColumns(rows, schema) {
  return schema.map(col => {
    const vals = rows
      .map(r => r[col.originalName])
      .filter(v => v !== null && v !== undefined && v !== '')

    const nullCount  = rows.length - vals.length
    const sampleVals = vals.slice(0, 100)

    // Numeric stats (only for numeric columns)
    let stats = {}
    if (col.type === 'numeric') {
      const nums = sampleVals.map(toNum).filter(v => v !== null)
      stats = computeStats(nums)
    } else if (col.type === 'categorical' || col.type === 'identifier') {
      const unique = [...new Set(vals.map(String))]
      stats = {
        uniqueCount: unique.length,
        uniqueRatio: unique.length / vals.length,
        topValues:   unique.slice(0, 6),
      }
    }

    const { semanticType, confidence, reasoning } = classifyColumn(col.name, col.type, sampleVals, stats)

    // Derive recommended aggregation from semantic type
    const { recommendedAgg, aggAlternatives, aggWarning } = deriveAggregation(semanticType, col.name, stats, confidence)

    return {
      name:         col.name,
      originalName: col.originalName,
      detectedType: col.type,
      semanticType,
      confidence,
      reasoning,
      stats,
      nullCount,
      nullPct: +(nullCount / rows.length * 100).toFixed(1),
      sampleValues: [...new Set(sampleVals.slice(0, 20).map(v => String(v)))].slice(0, 5),
      recommendedAgg,
      aggAlternatives,
      aggWarning,
    }
  })
}

// ── Aggregation derivation ────────────────────────────────────────────────────
/**
 * Given semantic type and supporting context, return:
 *   recommendedAgg  — the best default aggregation
 *   aggAlternatives — other valid aggregations the user might want
 *   aggWarning      — human-readable warning if SUM would be misleading
 */
function deriveAggregation(semanticType, colName, stats, confidence) {
  switch (semanticType) {
    case 'MEASURE':
      return {
        recommendedAgg: 'sum',
        aggAlternatives: ['avg', 'count', 'max', 'min'],
        aggWarning: null,
      }

    case 'CONTINUOUS':
      return {
        recommendedAgg: 'avg',
        aggAlternatives: ['min', 'max', 'count'],
        aggWarning: `"${colName}" is a rate or continuous metric — SUM would give a meaningless total. Using AVG.`,
      }

    case 'IDENTIFIER':
      return {
        recommendedAgg: 'count',
        aggAlternatives: [],
        aggWarning: `"${colName}" is an identifier (ID/key) — SUM or AVG have no meaning. Using COUNT.`,
      }

    case 'ORDINAL':
      return {
        recommendedAgg: 'count',
        aggAlternatives: ['avg'],
        aggWarning: `"${colName}" is an ordinal field — SUM is analytically meaningless (e.g. SUM of Semesters). Using COUNT. AVG may be used to show typical value.`,
      }

    case 'TEMPORAL':
      return {
        recommendedAgg: 'count',
        aggAlternatives: [],
        aggWarning: `"${colName}" is a temporal field — SUM of years or months is meaningless. Using COUNT or use as X-axis dimension.`,
      }

    case 'DIMENSION':
      return {
        recommendedAgg: 'count',
        aggAlternatives: [],
        aggWarning: `"${colName}" is a categorical dimension — it should be used as the X-axis, not as a Y-axis value.`,
      }

    case 'BOOLEAN':
      return {
        recommendedAgg: 'count',
        aggAlternatives: [],
        aggWarning: null,
      }

    default:
      return {
        recommendedAgg: 'count',
        aggAlternatives: [],
        aggWarning: `Semantic type unknown for "${colName}" — defaulting to COUNT as the safe option.`,
      }
  }
}

// ── Validation: is a given aggregation meaningful for a semantic type? ────────
/**
 * Returns { valid, reason } for a proposed (semanticType, agg) combination.
 * This is used to BLOCK analytically meaningless aggregations before chart render.
 */
function validateAggregation(semanticType, agg, colName) {
  const col = `"${colName}"`

  const INVALID = {
    IDENTIFIER: {
      sum:   `SUM(${col}) is invalid — ${col} is an identifier, not a quantity.`,
      avg:   `AVG(${col}) is invalid — ${col} is an identifier, not a quantity.`,
      min:   `MIN(${col}) has limited meaning for an identifier column.`,
      max:   `MAX(${col}) has limited meaning for an identifier column.`,
    },
    ORDINAL: {
      sum:   `SUM(${col}) is analytically meaningless — ${col} is ordinal (ordered categories), not additive.`,
    },
    TEMPORAL: {
      sum:   `SUM(${col}) is meaningless — ${col} is a temporal field. Use COUNT or as X-axis grouping.`,
      avg:   `AVG(${col}) is rarely meaningful for temporal fields. Use COUNT or GROUP BY.`,
    },
    DIMENSION: {
      sum:   `SUM(${col}) is invalid — ${col} is a categorical dimension, not a numeric measure.`,
      avg:   `AVG(${col}) is invalid — ${col} is a categorical dimension.`,
      min:   `MIN(${col}) is invalid — ${col} is a categorical dimension.`,
      max:   `MAX(${col}) is invalid — ${col} is a categorical dimension.`,
    },
  }

  const entry = INVALID[semanticType]?.[agg]
  if (entry) {
    return { valid: false, reason: entry }
  }
  return { valid: true, reason: null }
}

module.exports = { profileColumns, classifyColumn, deriveAggregation, validateAggregation }
