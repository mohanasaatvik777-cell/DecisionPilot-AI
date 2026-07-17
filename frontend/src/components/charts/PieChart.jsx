import { useState } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, Sector } from 'recharts'

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#34d399', '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#f97316', '#64748b']

const fmt = n => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return Number(n).toLocaleString()
}

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props
  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="white" style={{ fontSize: 13, fontWeight: 700 }}>
        {payload.name?.length > 12 ? payload.name.slice(0, 12) + '…' : payload.name}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#818cf8" style={{ fontSize: 15, fontWeight: 800 }}>
        {fmt(value)}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="#64748b" style={{ fontSize: 11 }}>
        {(percent * 100).toFixed(1)}%
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 14} outerRadius={outerRadius + 18}
        startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.4} />
    </g>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div style={{ background: 'rgba(15,23,42,0.98)', border: `1px solid ${d.payload.fill || '#6366f1'}50`, borderRadius: 12, padding: '10px 14px' }}>
      <p style={{ color: 'white', fontWeight: 700, marginBottom: 4, fontSize: '0.88rem' }}>{d.name}</p>
      <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Value: <span style={{ color: 'white', fontWeight: 600 }}>{fmt(d.value)}</span></p>
      <p style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Share: <span style={{ color: '#818cf8', fontWeight: 600 }}>{(d.payload.percent * 100).toFixed(1)}%</span></p>
    </div>
  )
}

export default function AdvancedPieChart({ data, isExpanded = false }) {
  const [activeIndex, setActiveIndex] = useState(0)

  if (!data?.data?.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: '0.85rem' }}>No data</div>
  )

  const total = data.data.reduce((s, d) => s + d.value, 0)
  const height = isExpanded ? 420 : 260

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, fontSize: '0.72rem', color: '#475569' }}>
        <span>Total: <span style={{ color: 'white', fontWeight: 700 }}>{fmt(total)}</span></span>
        <span>·</span>
        <span>{data.data.length} categories</span>
        <span>·</span>
        <span style={{ color: '#818cf8' }}>Hover slices to explore</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={data.data}
            dataKey="value"
            nameKey="name"
            cx="50%" cy="50%"
            innerRadius={isExpanded ? 90 : 65}
            outerRadius={isExpanded ? 150 : 105}
            paddingAngle={3}
            onMouseEnter={(_, idx) => setActiveIndex(idx)}
          >
            {data.data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="rgba(15,23,42,0.5)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle" iconSize={8}
            wrapperStyle={{ fontSize: '0.75rem', color: '#64748b', paddingTop: 12 }}
            formatter={(value) => value.length > 15 ? value.slice(0, 15) + '…' : value}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
