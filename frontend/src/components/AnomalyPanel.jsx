import { AlertTriangle, TrendingDown, TrendingUp, Info, CheckCircle } from 'lucide-react'

export default function AnomalyPanel({ anomalies, note }) {
  if (note && (!anomalies || anomalies.length === 0)) {
    return (
      <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:20, padding:60, textAlign:'center' }}>
        <Info size={40} color="#334155" style={{ margin:'0 auto 12px', display:'block' }} />
        <p style={{ color:'#475569' }}>{note}</p>
      </div>
    )
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:20, padding:60, textAlign:'center' }}>
        <CheckCircle size={44} color="#34d399" style={{ margin:'0 auto 12px', display:'block' }} />
        <p style={{ color:'#34d399', fontWeight:600, fontSize:'1.1rem' }}>All Clear</p>
        <p style={{ color:'#475569', fontSize:'0.85rem', marginTop:6 }}>No anomalies detected — all values within normal range (±2σ)</p>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
        <div style={{ width:36, height:36, background:'rgba(245,158,11,0.12)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <AlertTriangle size={18} color="#fbbf24" />
        </div>
        <div>
          <h2 style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>{anomalies.length} Anomal{anomalies.length===1?'y':'ies'} Detected</h2>
          <p style={{ color:'#475569', fontSize:'0.78rem' }}>Values beyond ±2 standard deviations from mean</p>
        </div>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {anomalies.map((a, i) => {
          const isSpike = a.direction === 'spike'
          const color = isSpike ? '#ef4444' : '#f59e0b'
          const bg    = isSpike ? 'rgba(239,68,68,0.06)'  : 'rgba(245,158,11,0.06)'
          const border= isSpike ? 'rgba(239,68,68,0.2)'   : 'rgba(245,158,11,0.2)'
          return (
            <div key={i} style={{ background:bg, border:`1px solid ${border}`, borderRadius:16, padding:16, display:'flex', gap:14, position:'relative', overflow:'hidden', transition:'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = isSpike ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = bg}
            >
              <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background:color, borderRadius:'3px 0 0 3px' }} />
              <div style={{ width:36, height:36, background:`${color}20`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {isSpike ? <TrendingUp size={18} color={color} /> : <TrendingDown size={18} color={color} />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:8, marginBottom:4 }}>
                  <span style={{ color:'white', fontWeight:700, fontSize:'0.9rem' }}>{a.column}</span>
                  {a.date && <span style={{ padding:'1px 8px', background:'rgba(255,255,255,0.06)', borderRadius:6, color:'#94a3b8', fontSize:'0.75rem' }}>{a.date}</span>}
                  <span style={{ padding:'1px 8px', background:`${color}20`, borderRadius:6, color, fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase' }}>
                    {isSpike ? '↑ Spike' : '↓ Drop'}
                  </span>
                  <span style={{ color:'#475569', fontSize:'0.75rem' }}>{a.zScore}σ from mean</span>
                </div>
                <p style={{ color:'#94a3b8', fontSize:'0.83rem', lineHeight:1.5 }}>{a.message}</p>
                <div style={{ display:'flex', gap:16, marginTop:8 }}>
                  <span style={{ color:'#475569', fontSize:'0.75rem' }}>Value: <span style={{ color:'#e2e8f0', fontWeight:600 }}>{Number(a.value).toLocaleString()}</span></span>
                  <span style={{ color:'#475569', fontSize:'0.75rem' }}>Mean: <span style={{ color:'#e2e8f0', fontWeight:600 }}>{Number(a.mean).toFixed(2)}</span></span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
