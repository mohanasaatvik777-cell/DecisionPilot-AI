import { useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts'

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(15,23,42,0.98)', border:'1px solid rgba(56,189,248,0.35)', borderRadius:12, padding:'10px 14px', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
      <p style={{ color:'#64748b', fontSize:'0.72rem', marginBottom:4 }}>Range: <span style={{ color:'white', fontWeight:600 }}>{payload[0]?.payload?.range}</span></p>
      <p style={{ color:'#38bdf8', fontWeight:700, fontSize:'0.9rem' }}>{payload[0]?.value} records</p>
    </div>
  )
}

export default function DistributionChart({ data, isExpanded = false }) {
  const [highlight, setHighlight] = useState(null)

  if (!data?.data?.length) return (
    <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#334155' }}>No distribution data</div>
  )

  const max = Math.max(...data.data.map(d => d.count))
  const maxBucket = data.data.find(d => d.count === max)
  const total = data.data.reduce((s,d)=>s+d.count,0)
  const height = isExpanded ? 390 : 220

  return (
    <div>
      <div style={{ display:'flex', gap:16, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
        <p style={{ color:'#475569', fontSize:'0.75rem' }}>
          Metric: <span style={{ color:'#7dd3fc', fontWeight:600 }}>{data.label}</span>
        </p>
        <p style={{ color:'#334155', fontSize:'0.72rem' }}>Total: <span style={{ color:'#94a3b8' }}>{total}</span></p>
        <p style={{ color:'#334155', fontSize:'0.72rem' }}>Peak bucket: <span style={{ color:'#38bdf8', fontWeight:600 }}>{maxBucket?.range}</span></p>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data.data} margin={{ top:8, right:8, left:0, bottom:isExpanded?36:32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
          <XAxis dataKey="range"
            tick={{ fill:'#475569', fontSize:isExpanded?10:8 }}
            axisLine={false} tickLine={false}
            angle={-38} textAnchor="end" interval={0} />
          <YAxis tick={{ fill:'#475569', fontSize:isExpanded?11:9 }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[6,6,0,0]}
            onMouseEnter={(_, idx) => setHighlight(idx)}
            onMouseLeave={() => setHighlight(null)}>
            {data.data.map((entry, i) => {
              const intensity = 0.2 + 0.78 * (entry.count / (max || 1))
              return (
                <Cell key={i}
                  fill={`rgba(56,189,248,${intensity})`}
                  stroke={highlight === i ? '#38bdf8' : 'transparent'}
                  strokeWidth={2}
                  style={{ filter: highlight === i ? 'drop-shadow(0 0 8px rgba(56,189,248,0.7))' : 'none', transition:'filter 0.2s' }}
                />
              )
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
