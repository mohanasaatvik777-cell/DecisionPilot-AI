import { Lightbulb, CheckCircle2, Sparkles, AlertCircle, Zap } from 'lucide-react'

export default function InsightsPanel({ insights, industry }) {
  if (!insights) {
    return (
      <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:20, padding:60, textAlign:'center' }}>
        <AlertCircle size={40} color="#334155" style={{ margin:'0 auto 12px', display:'block' }} />
        <p style={{ color:'#475569', fontWeight:500 }}>AI insights unavailable</p>
        <p style={{ color:'#334155', fontSize:'0.82rem', marginTop:6 }}>Add your ANTHROPIC_API_KEY to backend/.env to enable Claude AI insights.</p>
      </div>
    )
  }

  const { insights: insightList = [], recommendations = [], source } = insights

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

      {/* Source badge */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 12px', background: source==='claude' ? 'rgba(167,139,250,0.12)' : 'rgba(245,158,11,0.1)', border:`1px solid ${source==='claude' ? 'rgba(167,139,250,0.3)' : 'rgba(245,158,11,0.25)'}`, borderRadius:99 }}>
          <Sparkles size={12} color={source==='claude' ? '#a78bfa' : '#fbbf24'} />
          <span style={{ fontSize:'0.75rem', fontWeight:600, color: source==='claude' ? '#c4b5fd' : '#fcd34d' }}>
            {source === 'claude' ? 'Claude AI' : 'Rule-based (Claude unavailable)'}
          </span>
        </div>
        <span style={{ color:'#334155', fontSize:'0.78rem', textTransform:'capitalize' }}>{industry}</span>
      </div>

      {/* Insights grid */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={{ width:28, height:28, background:'rgba(99,102,241,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Sparkles size={14} color="#818cf8" />
          </div>
          <span style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>Key Insights</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))', gap:12 }}>
          {insightList.map((insight, i) => (
            <div key={i} style={{ background:'rgba(15,23,42,0.7)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:14, padding:16, display:'flex', gap:12, transition:'all 0.2s', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(99,102,241,0.4)'; e.currentTarget.style.background='rgba(99,102,241,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(99,102,241,0.15)'; e.currentTarget.style.background='rgba(15,23,42,0.7)' }}
            >
              <div style={{ width:28, height:28, background:'rgba(99,102,241,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                <Lightbulb size={13} color="#818cf8" />
              </div>
              <p style={{ color:'#cbd5e1', fontSize:'0.87rem', lineHeight:1.6 }}>{insight}</p>
              <div style={{ position:'absolute', top:0, left:0, width:2, height:'100%', background:'linear-gradient(180deg,#6366f1,transparent)', borderRadius:'2px 0 0 2px', opacity:0.5 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
            <div style={{ width:28, height:28, background:'rgba(52,211,153,0.15)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Zap size={14} color="#34d399" />
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:'1rem' }}>Actionable Recommendations</span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ background:'rgba(15,23,42,0.7)', border:'1px solid rgba(52,211,153,0.15)', borderRadius:14, padding:16, display:'flex', gap:12, transition:'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor='rgba(52,211,153,0.4)'}
                onMouseLeave={e => e.currentTarget.style.borderColor='rgba(52,211,153,0.15)'}
              >
                <div style={{ width:26, height:26, background:'rgba(52,211,153,0.15)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:700, fontSize:'0.75rem', color:'#34d399' }}>
                  {i + 1}
                </div>
                <p style={{ color:'#cbd5e1', fontSize:'0.87rem', lineHeight:1.6 }}>{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
