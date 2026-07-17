import { useState } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Brush
} from 'recharts'

const fmt = n => { if(n===null||n===undefined)return''; if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M'; if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+'K'; return Number(n).toLocaleString() }
const sd  = d => { try{ const dt=new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}` }catch{return d} }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const isForecast = payload[0]?.payload?.isForecast
  const c = isForecast ? '#34d399' : '#6366f1'
  return (
    <div style={{ background:'rgba(15,23,42,0.98)', border:`1px solid ${c}40`, borderRadius:14, padding:'12px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.6)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background:c }} />
        <p style={{ color:'#64748b', fontSize:'0.72rem', fontWeight:600 }}>{sd(label)} {isForecast ? '· Forecast' : '· Actual'}</p>
      </div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <span style={{ color:'#94a3b8', fontSize:'0.78rem' }}>{p.name}:</span>
          <span style={{ color:'white', fontWeight:700, fontSize:'0.9rem' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ForecastChart({ forecast, isExpanded = false }) {
  const [showBrush, setShowBrush] = useState(false)
  const [showCI, setShowCI] = useState(true)

  if (!forecast) return null
  const { historical, future, column } = forecast
  const historicalData = historical.map(d => ({ date:d.date, actual:d.actual, smoothed:d.smoothed, isForecast:false }))
  const futureData = future.map(d => ({ date:d.date, predicted:d.predicted, lower:d.lower, upper:d.upper, isForecast:true }))
  const bridge = historicalData.length > 0 ? { ...historicalData[historicalData.length-1], predicted:historicalData[historicalData.length-1].smoothed } : null
  const combined = [...historicalData, ...(bridge?[bridge]:[]), ...futureData]
  const splitDate = historicalData[historicalData.length-1]?.date
  const height = isExpanded ? 420 : 290

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:16, height:2, background:'#6366f1' }} />
            <span style={{ color:'#64748b', fontSize:'0.72rem' }}>Actual ({column})</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginLeft:12 }}>
            <div style={{ width:16, height:0, border:'2px dashed #34d399' }} />
            <span style={{ color:'#64748b', fontSize:'0.72rem' }}>Forecast</span>
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={() => setShowCI(p=>!p)}
            style={{ padding:'3px 10px', borderRadius:7, border:`1px solid ${showCI?'#34d399':'rgba(51,65,85,0.5)'}`, background:showCI?'rgba(52,211,153,0.1)':'transparent', color:showCI?'#34d399':'#64748b', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
            📐 Confidence Band
          </button>
          <button onClick={() => setShowBrush(p=>!p)}
            style={{ padding:'3px 10px', borderRadius:7, border:`1px solid ${showBrush?'#6366f1':'rgba(51,65,85,0.5)'}`, background:showBrush?'rgba(99,102,241,0.1)':'transparent', color:showBrush?'#818cf8':'#64748b', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
            🔍 Zoom
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={combined} margin={{ top:8, right:16, left:0, bottom:showBrush?40:8 }}>
          <defs>
            <linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={sd}
            tick={{ fill:'#475569', fontSize:isExpanded?12:10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt}
            tick={{ fill:'#475569', fontSize:isExpanded?12:10 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} />
          {splitDate && (
            <ReferenceLine x={splitDate} stroke="rgba(99,102,241,0.5)" strokeDasharray="4 2"
              label={{ value:'Now', position:'top', fill:'#475569', fontSize:10 }} />
          )}
          {showCI && <Area dataKey="upper" fill="url(#fg2)" stroke="none" legendType="none" connectNulls />}
          {showCI && <Area dataKey="lower" fill="#030712" stroke="none" legendType="none" connectNulls />}
          {showBrush && <Brush dataKey="date" height={24} stroke="rgba(99,102,241,0.4)" fill="rgba(15,23,42,0.8)" />}
          <Area dataKey="actual" stroke="#6366f1" strokeWidth={isExpanded?3:2.5} fill="url(#ag2)"
            dot={false} activeDot={{ r:5, fill:'#818cf8', strokeWidth:0 }} connectNulls name="Actual"
            style={{ filter:'drop-shadow(0 0 6px rgba(99,102,241,0.5))' }} />
          <Line dataKey="predicted" stroke="#34d399" strokeWidth={isExpanded?3:2.5} strokeDasharray="6 3"
            dot={false} activeDot={{ r:5, fill:'#6ee7b7', strokeWidth:0 }} connectNulls name="Forecast"
            style={{ filter:'drop-shadow(0 0 6px rgba(52,211,153,0.5))' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
