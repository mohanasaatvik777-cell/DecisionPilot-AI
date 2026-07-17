/**
 * Sample datasets for demo purposes.
 * Generates synthetic CSV data in-browser — no external file needed.
 */

export const SAMPLE_DATASETS = {
  retail:     { label: 'Retail Sales',     industry: 'retail'     },
  healthcare: { label: 'Patient Records',  industry: 'healthcare' },
  marketing:  { label: 'Campaign Metrics', industry: 'marketing'  },
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')]
  rows.forEach(row => lines.push(row.map(v => `"${v}"`).join(',')))
  return lines.join('\n')
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function generateRetail() {
  const headers = ['Date', 'Product', 'Region', 'Sales', 'Units', 'Discount']
  const products = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Keyboard', 'Mouse', 'Headphones', 'Webcam']
  const regions  = ['North', 'South', 'East', 'West', 'Central']
  const rows = []
  let date = '2024-01-01'
  for (let i = 0; i < 180; i++) {
    const product = products[i % products.length]
    const region  = regions[i % regions.length]
    const units   = randomBetween(1, 50)
    const price   = randomBetween(50, 2000)
    const sales   = units * price
    const disc    = (randomBetween(0, 20) / 100).toFixed(2)
    // Add an anomaly
    const finalSales = i === 90 ? sales * 5 : sales
    rows.push([date, product, region, finalSales, units, disc])
    if (i % 2 === 0) date = addDays(date, 1)
  }
  return toCsv(headers, rows)
}

function generateHealthcare() {
  const headers = ['Date', 'Department', 'Patients', 'Avg_Wait_Minutes', 'Satisfaction_Score', 'Bed_Occupancy']
  const depts = ['Emergency', 'Cardiology', 'Orthopedics', 'Pediatrics', 'Neurology', 'Oncology']
  const rows = []
  let date = '2024-01-01'
  for (let i = 0; i < 150; i++) {
    const dept = depts[i % depts.length]
    rows.push([
      date,
      dept,
      randomBetween(10, 120),
      randomBetween(5, 180),
      (randomBetween(60, 100) / 10).toFixed(1),
      (randomBetween(50, 100) / 100).toFixed(2),
    ])
    if (i % 3 === 0) date = addDays(date, 1)
  }
  return toCsv(headers, rows)
}

function generateMarketing() {
  const headers = ['Date', 'Campaign', 'Channel', 'Impressions', 'Clicks', 'Conversions', 'Spend']
  const campaigns = ['Summer Sale', 'Brand Awareness', 'Product Launch', 'Retargeting', 'Email Blast']
  const channels  = ['Google', 'Facebook', 'Instagram', 'Email', 'LinkedIn', 'YouTube']
  const rows = []
  let date = '2024-01-01'
  for (let i = 0; i < 160; i++) {
    const impressions = randomBetween(1000, 50000)
    const clicks = Math.floor(impressions * (randomBetween(1, 8) / 100))
    const convs  = Math.floor(clicks * (randomBetween(1, 15) / 100))
    const spend  = randomBetween(50, 5000)
    rows.push([date, campaigns[i%campaigns.length], channels[i%channels.length], impressions, clicks, convs, spend])
    if (i % 2 === 0) date = addDays(date, 1)
  }
  return toCsv(headers, rows)
}

const GENERATORS = { retail: generateRetail, healthcare: generateHealthcare, marketing: generateMarketing }

export async function loadSampleDataset(key) {
  const generator = GENERATORS[key]
  if (!generator) throw new Error('Unknown sample dataset')
  const csv = generator()
  const blob = new Blob([csv], { type: 'text/csv' })
  const { label } = SAMPLE_DATASETS[key]
  return new File([blob], `${label.replace(/ /g, '_')}_sample.csv`, { type: 'text/csv' })
}
