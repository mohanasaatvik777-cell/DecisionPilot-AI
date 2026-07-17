import { useMemo, useState } from 'react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine
} from 'recharts'

// Gaussian KDE implementation in pure JS
function gaussianKDE(values, bandwidth, points = 80) {
  if (!values || values.length < 2) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min
  const h = bandwidth || (1.06 * stdDev(values) * Math.pow(values.length, -0.2))
  const step = range / points

  const result = []
  for (let i = 0; i <= points; i++) {
    const x = min + i * step
    let density = 0
    for (const v of values) {
      const u = (x - v) / h
      density += Math.exp(-0.5 * u * u) / (Math.sqrt(2 * Math.PI))
    }
    density = density / (values.length * h)
    result.push({ x: parseFloat(x.toFixed(3)), density: parseFloat(density.toFixed(6)) })
  }
  return result
}

function stdDev(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }

const fmt = n => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Number(n).toFixed(2)
}

const CustomTooltip = ({ active, payload, color }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(15,23,42,0.98)', border: `1px solid ${color}40`, borderRadius: 12, padding: '10px 14px' }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: 4 }}>Value: <span style={{ color: 'white', fontWeight: 600 }}>{payload[0]?.payload?.x}</span></p>
      <p style={{ color: '#64748b', fontSize: '0.72rem' }}>Density: <span style={{ color, fontWeight: 700 }}>{(payload[0]?.value * 100).toFixed(3)}%</span></p>
    </div>
  )
}

export default function KDEChart({ data, color = '#a78bfa', isExpanded = false }) {
  const [bandwidth, setBandwidth] = useState('auto')

  const values = useMemo(() => {
    if (!data?.data?.length) return []
    // Extract numeric values from distribution data or raw
    if (data.rawValues) return data.rawValues
    // Reconstruct from histogram
    const vals = []
    data.data.forEach(bucket => {
      // parse range center
      const parts = bucket.range?.split('-')
      if (parts?.length >= 2) {
        const center = (parseFloat(parts[0]) + parseFloat(parts[1])) / 2
        if (!isNaN(center)) {
          for (let i = 0; i < Math.min(bucket.count, 20); i++) vals.push(center + (Math.random() - 0.5) * (parseFloat(parts[1]) - parseFloat(parts[0])))
        }
      }
    })
    return vals
  }, [data])

  const kdeData = useMemo(() => {
    if (values.length < 3) return []
    const bw = bandwidth === 'auto' ? undefined : parseFloat(bandwidth)
    return gaussianKDE(values, bw)
  }, [values, bandwidth])

  const avg = useMemo(() => values.length ? mean(values) : 0, [values])
  const sd  = useMemo(() => values.length ? stdDev(values) : 0, [values])

  if (!kdeData.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.85rem' }}>
      Insufficient data for KDE plot (need 3+ values)
    </div>
  )

  const height = isExpanded ? 400 : 230

  return (
    <div>
      {/* Controls + Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['auto', '0.5', '1', '2'].map(bw => (
            <button key={bw} onClick={() => setBandwidth(bw)}
              style={{ padding: '3px 9px', borderRadius: 7, border: `1px solid ${bandwidth === bw ? color : 'rgba(51,65,85,0.5)'}`, background: bandwidth === bw ? `${color}15` : 'transparent', color: bandwidth === bw ? color : '#64748b', fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
              bw={bw}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: '0.72rem' }}>
          <span style={{ color: '#64748b' }}>μ=<span style={{ color: 'white', fontWeight: 600 }}>{fmt(avg)}</span></span>
          <span style={{ color: '#64748b' }}>σ=<span style={{ color: 'white', fontWeight: 600 }}>{fmt(sd)}</span></span>
          <span style={{ color: '#64748b' }}>n=<span style={{ color: 'white', fontWeight: 600 }}>{values.length}</span></span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={kdeData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <defs>
            <linearGradient id="kdeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
          <XAxis dataKey="x" tickFormatter={fmt}
            tick={{ fill: '#475569', fontSize: isExpanded ? 11 : 9 }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#475569', fontSize: 9 }} axisLine={false} tickLine={false} width={40}
            tickFormatter={v => (v * 100).toFixed(2) + '%'} />
          <Tooltip content={<CustomTooltip color={color} />} />
          {/* Mean line */}
          <ReferenceLine x={avg} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: 'μ', position: 'top', fill: '#f59e0b', fontSize: 11, fontWeight: 700 }} />
          {/* ±1σ lines */}
          <ReferenceLine x={avg - sd} stroke={`${color}50`} strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceLine x={avg + sd} stroke={`${color}50`} strokeDasharray="3 3" strokeWidth={1}
            label={{ value: '±1σ', position: 'insideTopRight', fill: `${color}80`, fontSize: 9 }} />
          <Area
            type="monotone" dataKey="density"
            stroke={color} strokeWidth={isExpanded ? 3 : 2.5}
            fill="url(#kdeGrad)"
            dot={false}
            activeDot={{ r: 5, fill: color, stroke: 'rgba(15,23,42,0.8)', strokeWidth: 2 }}
            style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.7rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 16, height: 2, background: '#f59e0b' }} />
          <span style={{ color: '#64748b' }}>Mean (μ)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 16, height: 2, background: `${color}50`, borderTop: `2px dashed ${color}50` }} />
          <span style={{ color: '#64748b' }}>±1 Std Dev</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 16, height: 8, background: `${color}30`, borderRadius: 2 }} />
          <span style={{ color: '#64748b' }}>Density Curve</span>
        </div>
      </div>
    </div>
  )
}
