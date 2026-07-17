import { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Brush, ReferenceLine, Legend
} from 'recharts'

const fmt = n => {
  if (n === null || n === undefined) return ''
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Number(n).toLocaleString()
}
const sd = d => { try { const dt = new Date(d); return `${dt.getMonth() + 1}/${dt.getDate()}` } catch { return d } }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 14, padding: '12px 16px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <p style={{ color: '#64748b', fontSize: '0.72rem', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{p.name}:</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TrendChart({ data, color = '#6366f1', isExpanded = false }) {
  const [chartType, setChartType] = useState('area')
  const [showBrush, setShowBrush] = useState(false)
  const [showAvg, setShowAvg] = useState(false)

  if (!data?.data?.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['area', '📈 Area'], ['line', '〰️ Line'], ['bar', '📊 Bar']].map(([type, label]) => (
          <button key={type} onClick={() => setChartType(type)}
            style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${chartType === type ? color : 'rgba(51,65,85,0.5)'}`, background: chartType === type ? `${color}18` : 'transparent', color: chartType === type ? color : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {label}
          </button>
        ))}
        <button onClick={() => setShowBrush(p => !p)}
          style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${showBrush ? '#34d399' : 'rgba(51,65,85,0.5)'}`, background: showBrush ? 'rgba(52,211,153,0.1)' : 'transparent', color: showBrush ? '#34d399' : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          🔍 Zoom
        </button>
        <button onClick={() => setShowAvg(p => !p)}
          style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${showAvg ? '#f59e0b' : 'rgba(51,65,85,0.5)'}`, background: showAvg ? 'rgba(245,158,11,0.1)' : 'transparent', color: showAvg ? '#f59e0b' : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
          📏 Avg
        </button>
        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: '0.7rem' }}>{cleaned.length} pts · {data.label}</span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={cleaned} margin={{ top: 8, right: 16, left: 0, bottom: showBrush ? 40 : 8 }}>
          <defs>
            <linearGradient id={`tg_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={sd}
            tick={{ fill: '#475569', fontSize: isExpanded ? 12 : 10 }}
            axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt}
            tick={{ fill: '#475569', fontSize: isExpanded ? 12 : 10 }}
            axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} />
          {showAvg && <ReferenceLine y={avg} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
            label={{ value: `Avg ${fmt(avg)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />}
          {showBrush && <Brush dataKey="date" height={24} stroke={`${color}50`} fill="rgba(15,23,42,0.8)" />}

          {chartType === 'area' && (
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5}
              fill={`url(#tg_${color.replace('#', '')})`}
              dot={cleaned.length < 40 ? { r: 3, fill: color, strokeWidth: 0 } : false}
              activeDot={{ r: 6, fill: color, stroke: 'rgba(15,23,42,0.8)', strokeWidth: 2 }}
              name={data.label || 'Value'} />
          )}
          {chartType === 'line' && (
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={isExpanded ? 3 : 2.5}
              dot={cleaned.length < 40 ? { r: 3, fill: color, strokeWidth: 0 } : false}
              activeDot={{ r: 6, fill: color, stroke: 'rgba(15,23,42,0.8)', strokeWidth: 2 }}
              name={data.label || 'Value'}
              style={{ filter: `drop-shadow(0 0 6px ${color}80)` }} />
          )}
          {chartType === 'bar' && (
            <Bar dataKey="value" fill={color} fillOpacity={0.75} radius={[3, 3, 0, 0]}
              name={data.label || 'Value'} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
