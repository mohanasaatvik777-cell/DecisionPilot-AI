/**
 * Validates whether a selected industry matches the uploaded dataset.
 * Returns: { isMatch, confidence, detectedIndustry, reason, suggestions }
 */
import { autoDetectIndustry } from './autoDetectIndustry'

// What columns / values MUST exist for each industry to be valid
const INDUSTRY_REQUIREMENTS = {
  retail: {
    mustHaveOneOf: [['sku','barcode','upc','product','inventory','order','cart','checkout','coupon'],
                    ['brand','store','retail','ecommerce','purchase','refund']],
    description: 'Product sales, inventory, orders, customers',
    exampleColumns: 'Product, SKU, Sales, Revenue, Customer, Store',
  },
  restaurant: {
    mustHaveOneOf: [['menu','dish','food','beverage','kitchen','chef','recipe','waiter','dine','restaurant'],
                    ['table','covers','tip','reservation','buffet','cuisine']],
    description: 'Food items, tables, orders, staff, reservations',
    exampleColumns: 'Dish, Menu, Table, Waiter, Revenue, Orders',
  },
  healthcare: {
    mustHaveOneOf: [['patient','diagnosis','doctor','hospital','nurse','medication','prescription','icu','ward'],
                    ['disease','condition','treatment','admission','discharge','symptom','icd']],
    description: 'Patients, diagnoses, doctors, treatments, beds',
    exampleColumns: 'Patient_ID, Diagnosis, Doctor, Department, Admission_Date',
  },
  manufacturing: {
    mustHaveOneOf: [['machine','defect','downtime','assembly','factory','plant','operator','shift','batch'],
                    ['production','yield','efficiency','maintenance','sensor','weld','cnc']],
    description: 'Machines, production, defects, shifts, downtime',
    exampleColumns: 'Machine_ID, Production, Defects, Shift, Downtime',
  },
  education: {
    mustHaveOneOf: [['student','grade','class','teacher','course','subject','enrollment','attendance','gpa'],
                    ['exam','assignment','quiz','score','mark','semester','school','college']],
    description: 'Students, grades, courses, attendance, teachers',
    exampleColumns: 'Student_ID, Grade, Subject, Attendance, Score',
  },
  marketing: {
    mustHaveOneOf: [['campaign','ctr','roas','impression','conversion','cpc','cpa','seo','ppc','ad'],
                    ['click','lead','spend','channel','instagram','facebook','google','traffic','bounce']],
    description: 'Campaigns, clicks, conversions, ad spend, ROI',
    exampleColumns: 'Campaign, Platform, Clicks, Conversions, Spend',
  },
  finance: {
    mustHaveOneOf: [['debit','credit','liability','equity','dividend','asset','ledger','invoice','payroll'],
                    ['profit','expense','cash','income','balance','budget','investment','tax','loan']],
    description: 'Revenue, expenses, profit, cash flow, investments',
    exampleColumns: 'Account, Revenue, Expenses, Profit, Cash_Flow',
  },
  logistics: {
    mustHaveOneOf: [['shipment','freight','carrier','dispatch','fleet','container','waybill','customs'],
                    ['delivery','warehouse','tracking','route','driver','package','origin','destination']],
    description: 'Shipments, deliveries, routes, warehouses, tracking',
    exampleColumns: 'Shipment_ID, Origin, Destination, Carrier, Status',
  },
  general: {
    mustHaveOneOf: [[]],
    description: 'Any general dataset',
    exampleColumns: 'Any columns',
  },
}

export function validateIndustryMatch(selectedIndustry, schema, preview = []) {
  if (selectedIndustry === 'general') {
    return { isMatch: true, confidence: 'auto', detectedIndustry: 'general', reason: '', suggestions: [] }
  }

  // 1. Auto-detect what industry the data actually belongs to
  const detectedIndustry = autoDetectIndustry(schema, preview)

  // 2. Check if selected industry requirements are met
  const req = INDUSTRY_REQUIREMENTS[selectedIndustry]
  if (!req) return { isMatch: true, confidence: 'unknown', detectedIndustry, reason: '', suggestions: [] }

  const colText = schema.map(c => c.name.toLowerCase()).join(' ')
  const sampleText = schema.map(c => (c.sampleValues||[]).join(' ').toLowerCase()).join(' ')
  const fullText = `${colText} ${sampleText}`

  // Check if at least ONE group of must-have keywords has any hit
  const groupMatches = req.mustHaveOneOf.map(group =>
    group.filter(kw => fullText.includes(kw)).length
  )
  const maxGroupMatch = Math.max(...groupMatches)
  const hasAnyDomainKeyword = maxGroupMatch >= 1

  // 3. Determine confidence
  let confidence = 'none'
  if (maxGroupMatch >= 3) confidence = 'high'
  else if (maxGroupMatch >= 1) confidence = 'low'

  const isMatch = hasAnyDomainKeyword || detectedIndustry === selectedIndustry

  // 4. Build reason message
  let reason = ''
  let suggestions = []

  if (!isMatch) {
    reason = `Your dataset columns (${schema.slice(0,5).map(c=>c.name).join(', ')}${schema.length>5?'...':''}) don't appear to match **${selectedIndustry}** data.`

    if (detectedIndustry !== 'general' && detectedIndustry !== selectedIndustry) {
      reason += ` The data looks more like **${detectedIndustry}** data.`
      suggestions.push(detectedIndustry)
    } else {
      reason += ` No strong domain keywords were found.`
    }
    suggestions.push('general')
  } else if (confidence === 'low') {
    reason = `Weak match — only a few ${selectedIndustry} keywords found. If results look wrong, try switching to "${detectedIndustry !== selectedIndustry && detectedIndustry !== 'general' ? detectedIndustry : 'general'}".`
  }

  return { isMatch, confidence, detectedIndustry, reason, suggestions }
}
