import { AlertTriangle, CheckCircle2, ChevronRight, X } from 'lucide-react'
import { INDUSTRY_CONFIGS } from '../config/industryConfigs'

export default function IndustryMismatchBanner({ validation, onSwitch, onDismiss }) {
  if (!validation || validation.isMatch === true && validation.confidence !== 'low') return null

  const isMismatch = !validation.isMatch
  const isWeakMatch = validation.isMatch && validation.confidence === 'low'

  const color   = isMismatch ? '#ef4444' : '#f59e0b'
  const bg      = isMismatch ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)'
  const border  = isMismatch ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.25)'
  const icon    = isMismatch ? '⚠️' : '💡'

  return (
    <div style={{ background:bg, border:`1px solid ${border}`, borderRadius:14, padding:'14px 16px', marginBottom:16, position:'relative', borderLeft:`4px solid ${color}` }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
        <span style={{ fontSize:'1.1rem', flexShrink:0 }}>{icon}</span>
        <div style={{ flex:1 }}>
          <p style={{ color: isMismatch ? '#fca5a5':'#fcd34d', fontWeight:700, fontSize:'0.88rem', margin:'0 0 4px' }}>
            {isMismatch ? 'Industry Mismatch Detected' : 'Weak Industry Match'}
          </p>
          <p style={{ color:'#94a3b8', fontSize:'0.8rem', lineHeight:1.6, margin:0 }}>
            {validation.reason}
          </p>

          {/* Suggested alternatives */}
          {validation.suggestions?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:10 }}>
              <span style={{ color:'#64748b', fontSize:'0.75rem', alignSelf:'center' }}>Switch to:</span>
              {validation.suggestions.map(ind => {
                const cfg = INDUSTRY_CONFIGS[ind]
                if (!cfg) return null
                return (
                  <button key={ind} onClick={() => onSwitch?.(ind)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', background:`${cfg.color1}15`, border:`1px solid ${cfg.color1}40`, borderRadius:99, cursor:'pointer', transition:'all 0.2s' }}
                    onMouseEnter={e=>{ e.currentTarget.style.background=`${cfg.color1}25`; e.currentTarget.style.borderColor=`${cfg.color1}70` }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=`${cfg.color1}15`; e.currentTarget.style.borderColor=`${cfg.color1}40` }}
                  >
                    <span style={{ fontSize:'0.9rem' }}>{cfg.emoji}</span>
                    <span style={{ color:'white', fontSize:'0.78rem', fontWeight:600 }}>
                      {cfg.label.replace(' Analytics','').replace(' Dashboard','')}
                    </span>
                    <ChevronRight size={11} color="#64748b"/>
                  </button>
                )
              })}
            </div>
          )}

          {/* Detected industry hint */}
          {validation.detectedIndustry && validation.detectedIndustry !== 'general' && (
            <div style={{ marginTop:8, padding:'6px 12px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:8, display:'inline-flex', alignItems:'center', gap:6 }}>
              <CheckCircle2 size={12} color="#34d399"/>
              <span style={{ color:'#6ee7b7', fontSize:'0.75rem' }}>
                Auto-detected: <strong style={{ textTransform:'capitalize' }}>{validation.detectedIndustry}</strong>
              </span>
            </div>
          )}
        </div>

        {onDismiss && (
          <button onClick={onDismiss} style={{ background:'none', border:'none', cursor:'pointer', color:'#475569', padding:2, flexShrink:0 }}>
            <X size={14}/>
          </button>
        )}
      </div>
    </div>
  )
}
