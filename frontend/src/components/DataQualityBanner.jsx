import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

export default function DataQualityBanner({ notes }) {
  const [expanded, setExpanded] = useState(false)
  if (!notes || notes.length === 0) return null
  return (
    <div style={{ background:'rgba(245,158,11,0.07)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:14, padding:'12px 16px', marginBottom:20 }}>
      <button onClick={() => setExpanded(p => !p)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Info size={14} color="#fbbf24" />
          <span style={{ color:'#fcd34d', fontSize:'0.82rem', fontWeight:600 }}>{notes.length} data quality note{notes.length!==1?'s':''}</span>
        </div>
        {expanded ? <ChevronUp size={13} color="#fbbf24" /> : <ChevronDown size={13} color="#fbbf24" />}
      </button>
      {expanded && (
        <ul style={{ marginTop:10, paddingLeft:4, display:'flex', flexDirection:'column', gap:6 }}>
          {notes.map((n, i) => (
            <li key={i} style={{ color:'#fde68a', fontSize:'0.78rem', display:'flex', gap:6 }}>
              <span style={{ flexShrink:0, marginTop:1 }}>•</span> {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
