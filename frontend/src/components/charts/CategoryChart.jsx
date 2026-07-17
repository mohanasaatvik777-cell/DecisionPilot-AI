import { useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell
} from 'recharts'
import AdvancedPieChart from './PieChart'

const COLORS = ['#6366f1','#8b5cf6','#06b6d4','#34d399','#f59e0b','#ef4444','#ec4899','#84cc16','#f97316','#64748b']

const fmt = n => {
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1)+'M'
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1)+'K'
  return Number(n).toLocaleString()
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const color = COLORS[d?.payload?._idx % COLORS.length] || '#6366f1'
  return (
    <div style={{ background: 'rgba(15,23,42,0.98)', border: `1px solid ${color}40`, borderRadius: 12, padding: '10px 14px' }}>
      <p style={{ color: 'white', fontWeight: 700, marginBottom: 4, fontSize: '0.88rem' }}>{d?.payload?.name}</p>
      <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
        {data?.label || 'Value'}: <span style={{ color: 'white', fontWeight: 600 }}>{fmt(d?.value)}</span>
      </p>
    </div>
  )
}

let data = null  // module-level to access in tooltip

export default function CategoryChart({ data: chartData, isExpanded = false }) {
  const [view, setView] = useState('bar')
  data = chartData

  if (!chartData?.data?.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.85rem' }}>No data</div>
  )

  const indexed = chartData.data.map((d, i) => ({ ...d, _idx: i }))
  const height = isExpanded ? 420 : 240

  if (view === 'pie') return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['bar', '📊 Bar'], ['pie', '🥧 Pie']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${view === v ? '#6366f1' : 'rgba(51,65,85,0.5)'}`, background: view === v ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === v ? '#818cf8' : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {l}
          </button>
        ))}
      </div>
      <AdvancedPieChart data={chartData} isExpanded={isExpanded} />
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        {[['bar', '📊 Bar'], ['pie', '🥧 Pie']].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ padding: '3px 10px', borderRadius: 7, border: `1px solid ${view === v ? '#6366f1' : 'rgba(51,65,85,0.5)'}`, background: view === v ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === v ? '#818cf8' : '#64748b', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>
            {l}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: '#334155', fontSize: '0.7rem' }}>{chartData.data.length} categories</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={indexed} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.35)" horizontal={false} />
          <XAxis type="number" tickFormatter={fmt}
            tick={{ fill: '#475569', fontSize: isExpanded ? 11 : 9 }}
            axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: isExpanded ? 11 : 9 }}
            axisLine={false} tickLine={false} width={isExpanded ? 110 : 90}
            tickFormatter={v => v.length > (isExpanded ? 18 : 12) ? v.slice(0, isExpanded ? 18 : 12) + '…' : v} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {indexed.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
