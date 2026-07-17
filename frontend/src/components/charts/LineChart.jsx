import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Brush, Legend
} from 'recharts'

const fmt = n => {
  if (n === null || n === undefined) return ''
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Number(n).toLocaleString()
}
const sd = d => { try { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}` } catch { return d } }

const CustomTooltip = ({ active, payload, label, color }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(15,23,42,0.98)', border: `1px solid ${color}40`, borderRadius: 14, padding: '12px 16px', boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px ${color}20` }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{p.name}:</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.88rem' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

const CustomDot = ({ cx, cy, color }) => (
  <circle cx={cx} cy={cy} r={4} fill={color} stroke="rgba(15,23,42,0.8)" strokeWidth={2} />
)

export default function AdvancedLineChart({ data, color = '#6366f1', isExpanded = false }) {
  const [showBrush, setShowBrush] = useState(false)
  const [showAvg, setShowAvg] = useState(true)

  if (!data?.data?.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.85rem' }}>
      No trend data available
    </div>
  )

  const cleaned = data.data.filter(d => !d.gap && d.date)
  const vals = cleaned.map(d => d.value).filter(v => v != null)
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const height = isExpanded ? 420 : 250

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setShowBrush(p => !p)}
          style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${showBrush ? color : 'rgba(51,65,85,0.5)'}`, background: showBrush ? `${color}15` : 'transparent', color: showBrush ? color : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          🔍 Zoom Brush
        </button>
        <button onClick={() => setShowAvg(p => !p)}
          style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${showAvg ? '#f59e0b' : 'rgba(51,65,85,0.5)'}`, background: showAvg ? 'rgba(245,158,11,0.1)' : 'transparent', color: showAvg ? '#f59e0b' : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          📊 Avg Line
        </button>
        <span style={{ color: '#334155', fontSize: '0.72rem', marginLeft: 'auto', alignSelf: 'center' }}>
          {cleaned.length} data points
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={cleaned} margin={{ top: 8, right: 16, left: 0, bottom: showBrush ? 40 : 8 }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.35)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={sd}
            tick={{ fill: '#475569', fontSize: isExpanded ? 12 : 10 }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt}
            tick={{ fill: '#475569', fontSize: isExpanded ? 12 : 10 }}
            axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<CustomTooltip color={color} />} />
          {showAvg && avg > 0 && (
            <ReferenceLine y={avg} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
              label={{ value: `Avg: ${fmt(avg)}`, position: 'right', fill: '#f59e0b', fontSize: 10 }} />
          )}
          {showBrush && <Brush dataKey="date" height={24} stroke={`${color}40`} fill="rgba(15,23,42,0.8)" travellerWidth={6} />}
          <Line
            type="monotone" dataKey="value" stroke={color} strokeWidth={isExpanded ? 3 : 2.5}
            dot={cleaned.length < 60 ? <CustomDot color={color} /> : false}
            activeDot={{ r: 6, fill: color, stroke: 'rgba(15,23,42,0.8)', strokeWidth: 2, filter: 'url(#glow)' }}
            name={data.label || 'Value'}
            style={{ filter: isExpanded ? 'drop-shadow(0 0 6px ' + color + '80)' : 'none' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
