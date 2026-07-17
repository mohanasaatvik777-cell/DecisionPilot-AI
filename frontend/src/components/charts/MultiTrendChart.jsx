import { useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Brush } from 'recharts'

const COLORS = ['#6366f1','#34d399','#f59e0b','#f472b6','#38bdf8','#a78bfa']
const fmt = n => { if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M'; if(Math.abs(n)>=1e3)return(n/1e3).toFixed(1)+'K'; return Number(n).toLocaleString() }
const sd  = d => { try{ const dt=new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}` }catch{return d} }

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'rgba(15,23,42,0.98)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:14, padding:'12px 16px', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
      <p style={{ color:'#64748b', fontSize:'0.72rem', marginBottom:8, fontWeight:600 }}>{sd(label)}</p>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:p.color }} />
          <span style={{ color:'#94a3b8', fontSize:'0.78rem' }}>{p.name}:</span>
          <span style={{ color:'white', fontWeight:700, fontSize:'0.88rem' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function MultiTrendChart({ data, isExpanded = false }) {
  const [showBrush, setShowBrush] = useState(false)
  const [hiddenKeys, setHiddenKeys] = useState({})

  if (!data?.data?.length) return null
  const height = isExpanded ? 420 : 270

  const toggleKey = (key) => setHiddenKeys(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div>
      {/* Legend toggles */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {data.keys.map((key, i) => (
          <button key={key} onClick={() => toggleKey(key)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 10px', borderRadius:7, border:`1px solid ${hiddenKeys[key] ? 'rgba(51,65,85,0.4)' : COLORS[i%COLORS.length]+'50'}`, background:hiddenKeys[key] ? 'transparent' : `${COLORS[i%COLORS.length]}12`, color:hiddenKeys[key] ? '#334155' : 'white', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:hiddenKeys[key] ? '#334155' : COLORS[i%COLORS.length] }} />
            {key}
          </button>
        ))}
        <button onClick={() => setShowBrush(p=>!p)}
          style={{ marginLeft:'auto', padding:'3px 10px', borderRadius:7, border:`1px solid ${showBrush?'#34d399':'rgba(51,65,85,0.5)'}`, background:showBrush?'rgba(52,211,153,0.1)':'transparent', color:showBrush?'#34d399':'#64748b', fontSize:'0.72rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
          🔍 Zoom
        </button>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data.data} margin={{ top:8, right:16, left:0, bottom:showBrush?40:8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={sd}
            tick={{ fill:'#475569', fontSize:isExpanded?12:10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={fmt}
            tick={{ fill:'#475569', fontSize:isExpanded?12:10 }} axisLine={false} tickLine={false} width={56} />
          <Tooltip content={<CustomTooltip />} />
          {showBrush && <Brush dataKey="date" height={24} stroke="rgba(99,102,241,0.4)" fill="rgba(15,23,42,0.8)" />}
          {data.keys.map((key, i) => !hiddenKeys[key] && (
            <Line key={key} type="monotone" dataKey={key}
              stroke={COLORS[i % COLORS.length]} strokeWidth={isExpanded?3:2.5}
              dot={false} activeDot={{ r:5, fill:COLORS[i%COLORS.length], strokeWidth:0 }} connectNulls
              style={{ filter:`drop-shadow(0 0 4px ${COLORS[i%COLORS.length]}60)` }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
