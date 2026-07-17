/**
 * aggregationEngine.js
 *
 * Smart aggregation selection pipeline.
 *
 * Priority order (highest → lowest):
 *   1. Explicit user intent  (user typed "average", "total", "count", etc.)
 *   2. Semantic column type  (MEASURE → SUM, CONTINUOUS → AVG, ORDINAL → COUNT, etc.)
 *   3. Aggregation validation (reject meaningless combos — SUM(Semester), SUM(StudentID))
 *   4. Low-confidence fallback (COUNT — never silently SUM unknown columns)
 *
 * The engine integrates with semanticProfiler.js and replaces the old
 * naive detectAggregation() that did:  numeric → SUM, else → COUNT
 */

'use strict'

const { validateAggregation } = require('./semanticProfiler')

// ── Priority 1: Parse explicit user intent from natural language ───────────────
/**
 * Scan a natural language query for explicit aggregation keywords.
 * Returns the aggregation string if found, otherwise null.
 */
function extractUserIntent(query) {
  if (!query) return null
  const q = query.toLowerCase()

  if (/\b(total|sum|add up|summ(ed|ation))\b/.test(q))           return 'sum'
  if (/\b(average|avg|mean|typical|per unit|per record)\b/.test(q)) return 'avg'
  if (/\b(median)\b/.test(q))                                     return 'avg'  // proxy
  if (/\b(count|how many|number of|frequency|how often|occurrences|instances)\b/.test(q)) return 'count'
  if (/\b(minimum|min|lowest|least|smallest|cheapest|earliest)\b/.test(q))    return 'min'
  if (/\b(maximum|max|highest|largest|biggest|most|expensive|latest)\b/.test(q)) return 'max'
  return null
}

// ── Priority 2: Semantic type → aggregation mapping ───────────────────────────
/**
 * Derive the best aggregation purely from semantic type.
 * This is the core of the redesign: type-driven, not data-type-driven.
 */
function aggFromSemanticType(semanticType) {
  switch (semanticType) {
    case 'MEASURE':     return 'sum'    // Revenue, Sales, Quantity → SUM
    case 'CONTINUOUS':  return 'avg'    // CGPA, Attendance, Age → AVG
    case 'IDENTIFIER':  return 'count'  // StudentID, OrderID → COUNT (never SUM)
    case 'ORDINAL':     return 'count'  // Semester, Level, Rank → COUNT (never SUM)
    case 'TEMPORAL':    return 'count'  // Year, Month → COUNT
    case 'DIMENSION':   return 'count'  // Department, Gender → COUNT
    case 'BOOLEAN':     return 'count'  // IsActive → COUNT
    default:            return null     // unknown → require explicit choice
  }
}

// ── Friendly labels for the UI ────────────────────────────────────────────────
const AGG_LABELS = {
  sum:   'SUM (Total)',
  avg:   'AVG (Average)',
  count: 'COUNT',
  min:   'MIN',
  max:   'MAX',
}

// ── Main decision function ────────────────────────────────────────────────────
/**
 * Decide the best aggregation for a (metric column, user query, forced override)
 * combination, using the full priority stack.
 *
 * @param {object} columnProfile  - from semanticProfiler.profileColumns() for this column
 * @param {string} userQuery      - raw user query string (may be empty)
 * @param {string|null} forcedAgg - aggregation forced by user dropdown (may be null)
 *
 * @returns {{
 *   agg:            string,   — final chosen aggregation
 *   source:         string,   — 'user_override'|'user_intent'|'semantic'|'fallback'
 *   warning:        string|null,
 *   label:          string,
 *   blocked:        boolean,  — true if the chosen agg was invalid and we substituted
 *   originalAgg:    string|null, — the agg before we overrode it (if blocked)
 *   recommendation: string,   — human-readable recommendation for UI
 * }}
 */
function decideAggregation(columnProfile, userQuery, forcedAgg) {
  const { semanticType, confidence, colName, name, aggWarning, recommendedAgg, aggAlternatives } = columnProfile
  const colLabel = name || colName || '?'

  // ── Step 1: Honour explicit user dropdown override (highest priority) ────
  if (forcedAgg && ['sum','avg','count','min','max'].includes(forcedAgg.toLowerCase())) {
    const requestedAgg = forcedAgg.toLowerCase()
    const validation = validateAggregation(semanticType, requestedAgg, colLabel)

    if (!validation.valid) {
      // The user explicitly chose a meaningless aggregation — warn + substitute
      const safeAgg = aggFromSemanticType(semanticType) || 'count'
      return {
        agg:            safeAgg,
        source:         'user_override_blocked',
        warning:        `⚠ ${validation.reason} Substituted with ${AGG_LABELS[safeAgg]}.`,
        label:          AGG_LABELS[safeAgg],
        blocked:        true,
        originalAgg:    requestedAgg,
        recommendation: buildRecommendation(semanticType, safeAgg, colLabel, confidence),
      }
    }

    return {
      agg:            requestedAgg,
      source:         'user_override',
      warning:        null,
      label:          AGG_LABELS[requestedAgg],
      blocked:        false,
      originalAgg:    null,
      recommendation: buildRecommendation(semanticType, requestedAgg, colLabel, confidence),
    }
  }

  // ── Step 2: Parse explicit natural language intent ────────────────────────
  const intentAgg = extractUserIntent(userQuery)
  if (intentAgg) {
    const validation = validateAggregation(semanticType, intentAgg, colLabel)

    if (!validation.valid) {
      // User said "total" but column is an ID — still block it
      const safeAgg = aggFromSemanticType(semanticType) || 'count'
      return {
        agg:            safeAgg,
        source:         'intent_blocked',
        warning:        `⚠ You requested ${intentAgg.toUpperCase()} but ${validation.reason} Using ${AGG_LABELS[safeAgg]} instead.`,
        label:          AGG_LABELS[safeAgg],
        blocked:        true,
        originalAgg:    intentAgg,
        recommendation: buildRecommendation(semanticType, safeAgg, colLabel, confidence),
      }
    }

    return {
      agg:            intentAgg,
      source:         'user_intent',
      warning:        null,
      label:          AGG_LABELS[intentAgg],
      blocked:        false,
      originalAgg:    null,
      recommendation: buildRecommendation(semanticType, intentAgg, colLabel, confidence),
    }
  }

  // ── Step 3: Semantic type decides ─────────────────────────────────────────
  const semanticAgg = aggFromSemanticType(semanticType)
  if (semanticAgg) {
    return {
      agg:            semanticAgg,
      source:         'semantic',
      warning:        aggWarning || null,
      label:          AGG_LABELS[semanticAgg],
      blocked:        false,
      originalAgg:    null,
      recommendation: buildRecommendation(semanticType, semanticAgg, colLabel, confidence),
    }
  }

  // ── Step 4: Low-confidence fallback — never silently SUM ─────────────────
  return {
    agg:            'count',
    source:         'fallback',
    warning:        `⚠ Could not determine the right aggregation for "${colLabel}" — defaulting to COUNT. Please choose manually if needed.`,
    label:          AGG_LABELS['count'],
    blocked:        false,
    originalAgg:    null,
    recommendation: `COUNT (default — aggregation unclear for "${colLabel}")`,
  }
}

// ── Build UI recommendation string ───────────────────────────────────────────
function buildRecommendation(semanticType, agg, colName, confidence) {
  const conf = confidence === 'high' ? '' : confidence === 'medium' ? ' (medium confidence)' : ' (low confidence — verify)'

  const descriptions = {
    MEASURE:    `${colName} is an additive measure — Recommended ${AGG_LABELS[agg]}${conf}`,
    CONTINUOUS: `${colName} is a rate/average — Recommended ${AGG_LABELS[agg]}${conf}`,
    IDENTIFIER: `${colName} is an identifier — Recommended ${AGG_LABELS[agg]} (SUM/AVG not meaningful)`,
    ORDINAL:    `${colName} is ordinal — Recommended ${AGG_LABELS[agg]} (SUM is misleading for ordered values)`,
    TEMPORAL:   `${colName} is temporal — Recommended ${AGG_LABELS[agg]} (or use as X-axis)`,
    DIMENSION:  `${colName} is a dimension — use as X-axis, not Y-axis`,
    BOOLEAN:    `${colName} is boolean — Recommended ${AGG_LABELS[agg]}`,
  }
  return descriptions[semanticType] || `${AGG_LABELS[agg]} (default)${conf}`
}

// ── Batch: get aggregation for a metric column ─────────────────────────────────
/**
 * Convenience wrapper when you only have column name and schema (no full profile).
 * Looks up the profile from the session's cached semantic profiles.
 *
 * @param {string}   metricColName  - column name user selected as Y-axis
 * @param {object[]} semanticProfiles - output of profileColumns()
 * @param {string}   userQuery
 * @param {string}   forcedAgg
 */
function resolveAggregation(metricColName, semanticProfiles, userQuery, forcedAgg) {
  if (!metricColName) {
    // No metric selected — COUNT mode
    return {
      agg: 'count', source: 'no_metric', warning: null,
      label: AGG_LABELS['count'], blocked: false, originalAgg: null,
      recommendation: 'COUNT (no Y-axis column — counting records)',
    }
  }

  const profile = semanticProfiles
    ? semanticProfiles.find(p => p.name === metricColName || p.originalName === metricColName)
    : null

  if (!profile) {
    // Profile not found — safe fallback
    return {
      agg: 'count', source: 'profile_missing', warning: `Column profile for "${metricColName}" not found — using COUNT.`,
      label: AGG_LABELS['count'], blocked: false, originalAgg: null,
      recommendation: `COUNT (profile unavailable for "${metricColName}")`,
    }
  }

  return decideAggregation(profile, userQuery, forcedAgg)
}

module.exports = { decideAggregation, resolveAggregation, extractUserIntent, validateAggregation, AGG_LABELS }
