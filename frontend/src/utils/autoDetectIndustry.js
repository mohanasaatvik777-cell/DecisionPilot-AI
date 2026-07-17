/**
 * Auto-detect industry from schema column names + sample values.
 * Uses weighted scoring — generic words (price, cost) score LOW,
 * domain-specific words score HIGH.
 * Falls back to 'general' unless confidence is strong.
 */

const INDUSTRY_RULES = {
  retail: {
    strong:  ['sku', 'barcode', 'upc', 'checkout', 'cart', 'refund', 'coupon', 'storefront', 'pos', 'retail', 'ecommerce', 'wishlist', 'merchandis'],
    medium:  ['product', 'inventory', 'stock', 'order', 'customer', 'purchase', 'store', 'supplier', 'vendor', 'category', 'discount', 'brand', 'quantity'],
    weak:    ['price', 'sale', 'revenue', 'item', 'units'],
  },
  restaurant: {
    strong:  ['menu', 'dish', 'waiter', 'reservation', 'kitchen', 'chef', 'recipe', 'dine', 'restaurant', 'covers', 'buffet', 'cuisine', 'appetizer', 'entree'],
    medium:  ['food', 'beverage', 'drink', 'table', 'tip', 'bill', 'meal', 'ingredient', 'breakfast', 'lunch', 'dinner', 'course'],
    weak:    ['order', 'customer', 'staff'],
  },
  healthcare: {
    strong:  ['patient', 'diagnosis', 'icd', 'medication', 'prescription', 'ward', 'icu', 'surgery', 'clinical', 'discharge', 'admission', 'bmi', 'dosage', 'symptom', 'pathology'],
    medium:  ['doctor', 'hospital', 'nurse', 'treatment', 'disease', 'condition', 'appointment', 'bed', 'lab', 'test', 'visit', 'health'],
    weak:    ['age', 'gender', 'date', 'status'],
  },
  manufacturing: {
    strong:  ['defect', 'downtime', 'assembly', 'yield', 'factory', 'plant', 'manufacturing', 'operator', 'batch', 'sensor', 'conveyor', 'cnc', 'lathe', 'weld'],
    medium:  ['machine', 'production', 'shift', 'efficiency', 'quality', 'maintenance', 'output', 'process', 'equipment', 'line', 'unit'],
    weak:    ['cost', 'quantity', 'units', 'time'],
  },
  education: {
    strong:  ['student', 'enrollment', 'gpa', 'curriculum', 'syllabus', 'semester', 'attendance', 'homework', 'quiz', 'lecture', 'faculty', 'scholarship'],
    medium:  ['grade', 'class', 'teacher', 'course', 'score', 'mark', 'subject', 'exam', 'assignment', 'school', 'college', 'pass', 'fail'],
    weak:    ['test', 'name', 'date', 'year'],
  },
  marketing: {
    strong:  ['campaign', 'ctr', 'roas', 'impression', 'conversion', 'funnel', 'cpc', 'cpa', 'seo', 'ppc', 'influencer', 'retargeting', 'lookalike'],
    medium:  ['click', 'lead', 'ad', 'spend', 'channel', 'email', 'social', 'instagram', 'facebook', 'google', 'traffic', 'bounce', 'roi', 'audience', 'segment'],
    weak:    ['platform', 'date', 'revenue', 'cost'],
  },
  finance: {
    strong:  ['debit', 'credit', 'liability', 'equity', 'dividend', 'asset', 'ledger', 'invoice', 'payroll', 'amortization', 'depreciation', 'gaap', 'p&l', 'ebitda'],
    medium:  ['profit', 'expense', 'cash', 'income', 'balance', 'budget', 'investment', 'tax', 'account', 'transaction', 'loan', 'interest'],
    weak:    ['revenue', 'cost', 'amount', 'total', 'date'],
  },
  logistics: {
    strong:  ['shipment', 'freight', 'carrier', 'dispatch', 'fleet', 'container', 'eta', 'consignment', 'tracking', 'waybill', 'customs', 'manifest'],
    medium:  ['delivery', 'warehouse', 'route', 'driver', 'package', 'origin', 'destination', 'transit', 'logistics', 'supply', 'chain', 'weight'],
    weak:    ['status', 'date', 'location', 'time'],
  },
}

// Words that look like industry-specific but are actually generic — penalize false matches
const FALSE_POSITIVE_GUARDS = {
  restaurant: ['order', 'course', 'tip', 'bill', 'table'],  // "bill" could be finance, "order" could be retail
  retail:     ['price', 'category', 'brand', 'quantity', 'item'],  // too generic
  finance:    ['revenue', 'cost', 'total', 'amount'],  // too generic
}

export function autoDetectIndustry(schema, preview = []) {
  if (!schema || schema.length === 0) return 'general'

  // Build search corpus from column names (highest weight) + sample values
  const colNames = schema.map(c => c.name.toLowerCase()).join(' ')
  const samples  = schema.map(c => (c.sampleValues || []).join(' ').toLowerCase()).join(' ')
  const previewText = preview.slice(0, 10)
    .flatMap(row => Object.values(row).map(v => String(v||'').toLowerCase()))
    .join(' ')

  const fullText = `${colNames} ${colNames} ${colNames} ${samples} ${previewText}` // triple-weight column names

  const scores = {}

  for (const [industry, rules] of Object.entries(INDUSTRY_RULES)) {
    let s = 0
    // Strong matches = 4 points
    s += rules.strong.filter(kw => fullText.includes(kw)).length * 4
    // Medium matches = 2 points
    s += rules.medium.filter(kw => fullText.includes(kw)).length * 2
    // Weak matches = 1 point (but only count if already have some score)
    const weakHits = rules.weak.filter(kw => colNames.includes(kw)).length
    if (s > 0) s += weakHits * 1

    // Penalty: if only generic words matched, reduce score
    const guards = FALSE_POSITIVE_GUARDS[industry] || []
    const guardHits = guards.filter(kw => colNames.includes(kw)).length
    const strongHits = rules.strong.filter(kw => fullText.includes(kw)).length
    if (strongHits === 0 && guardHits >= 2) s = Math.max(0, s - 4) // penalize generic-only match

    scores[industry] = s
  }

  // Sort by score
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [bestIndustry, bestScore] = ranked[0]
  const [, secondScore]           = ranked[1] || ['', 0]

  // Require strong confidence:
  // - At least 6 points (means 1-2 strong domain keywords, OR 3 medium keywords)
  // - Must beat second place by at least 3 points (clear winner)
  if (bestScore >= 6 && (bestScore - secondScore) >= 3) {
    return bestIndustry
  }

  // Borderline: 4+ points with clear lead
  if (bestScore >= 4 && (bestScore - secondScore) >= 4) {
    return bestIndustry
  }

  return 'general'
}
