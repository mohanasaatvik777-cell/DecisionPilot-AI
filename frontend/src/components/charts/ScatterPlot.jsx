import { useState } from 'react'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ZAxis, ReferenceLine } from 'recharts'

const fmt = n => { if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M'; if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+'K'; return Number(n).toLocaleString() }

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(15,23,42,0.98)', border:'1px solid rgba(52,211,153,0.35)', borderRadius:12, padding:'10px 14px', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background:p.color||'#34d399' }} />
          <span style={{ color:'#94a3b8', fontSize:'0.78rem' }}>{p.name}:</span>
          <span style={{ color:'white', fontWeight:700, fontSize:'0.88rem' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ScatterPlot({ data, isExpanded = false }) {
  const [showTrend, setShowTrend] = useState(false)

  if (!data?.data?.length) return (
    <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'#334155', fontSize:'0.85rem' }}>
      Insufficient data for correlation view
    </div>
  )

  // Simple linear regression for trend line
  const pts = data.data
  const n = pts.length
  const sumX = pts.reduce((s,p)=>s+p.x,0)
  const sumY = pts.reduce((s,p)=>s+p.y,0)
  const sumXY = pts.reduce((s,p)=>s+p.x*p.y,0)
  const sumX2 = pts.reduce((s,p)=>s+p.x*p.x,0)
  const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX) || 0
  const intercept = (sumY - slope*sumX) / n || 0
  const minX = Math.min(...pts.map(p=>p.x))
  const maxX = Math.max(...pts.map(p=>p.x))
  const trendLine = [
    { x: minX, y: slope*minX + intercept },
    { x: maxX, y: slope*maxX + intercept },
  ]

  const height = isExpanded ? 400 : 230

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:10, alignItems:'center' }}>
        <span style={{ color:'#475569', fontSize:'0.75rem' }}>X: <span style={{ color:'#6ee7b7', fontWeight:600 }}>{data.xLabel}</span></span>
        <span style={{ color:'#334155' }}>·</span>
        <span style={{ color:'#475569', fontSize:'0.75rem' }}>Y: <span style={{ color:'#6ee7b7', fontWeight:600 }}>{data.yLabel}</span></span>
        <span style={{ color:'#334155', fontSize:'0.72rem' }}>({data.data.length} pts)</span>
        <button onClick={() => setShowTrend(p=>!p)}
          style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:7, border:`1px solid ${showTrend?'#f472b6':'rgba(51,65,85,0.5)'}`, background:showTrend?'rgba(244,114,182,0.1)':'transparent', color:showTrend?'#f472b6':'#64748b', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
          📉 Trend Line
        </button>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top:8, right:16, left:0, bottom:8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
          <XAxis dataKey="x" type="number" name={data.xLabel} tickFormatter={fmt}
            tick={{ fill:'#475569', fontSize:isExpanded?11:9 }} axisLine={false} tickLine={false} />
          <YAxis dataKey="y" type="number" name={data.yLabel} tickFormatter={fmt}
            tick={{ fill:'#475569', fontSize:isExpanded?11:9 }} axisLine={false} tickLine={false} width={52} />
          <ZAxis range={[isExpanded?30:20, isExpanded?30:20]} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke:'rgba(52,211,153,0.3)', strokeDasharray:'3 3' }} />
          <Scatter data={data.data} fill="#34d399" fillOpacity={0.65}
            style={{ filter:'drop-shadow(0 0 4px rgba(52,211,153,0.5))' }} />
          {showTrend && (
            <Scatter data={trendLine} fill="none" line={{ stroke:'#f472b6', strokeWidth:2, strokeDasharray:'5 3' }} shape={() => null} />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
