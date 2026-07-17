export function formatNumber(n, opts = {}) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const { compact = true, decimals = 2 } = opts
  if (compact) {
    if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
    if (Math.abs(n) >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M'
    if (Math.abs(n) >= 1_000)         return (n / 1_000).toFixed(1) + 'K'
  }
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export function formatPercent(n) {
  if (n === null || n === undefined) return '—'
  return `${(n * 100).toFixed(1)}%`
}

export function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return String(d) }
}

export function classifyChange(current, previous) {
  if (!previous || previous === 0) return { pct: null, dir: 'neutral' }
  const pct = ((current - previous) / Math.abs(previous)) * 100
  return { pct: pct.toFixed(1), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral' }
}
