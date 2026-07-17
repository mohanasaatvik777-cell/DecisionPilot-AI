import { useState, useEffect } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Database, ChevronDown, Info, Sparkles, Zap } from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import IndustrySelector from '../components/IndustrySelector'
import IndustryMismatchBanner from '../components/IndustryMismatchBanner'
import { getIndustryConfig } from '../config/industryConfigs'
import { autoDetectIndustry } from '../utils/autoDetectIndustry'
import { validateIndustryMatch } from '../utils/validateIndustryMatch'

const TYPE_OPTIONS = ['date', 'numeric', 'categorical', 'identifier', 'text']
const TYPE_META = {
  date:        { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',   label: 'Date/Time' },
  numeric:     { color: '#34d399', bg: 'rgba(52,211,153,0.12)',   label: 'Numeric'   },
  categorical: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  label: 'Category'  },
  identifier:  { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   label: 'ID / Key'  },
  text:        { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)',  label: 'Text'      },
}

// ── Wrong Field Warning Modal ─────────────────────────────────────────────────
function WrongFieldWarningModal({ issues, schema, onFix, onIgnore, onClose, color }) {
  const c = color || '#f59e0b'
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(3,7,18,0.88)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      animation:'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        background:'rgba(15,20,40,0.99)', border:`1px solid ${c}50`,
        borderRadius:24, padding:32, maxWidth:580, width:'100%',
        boxShadow:`0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px ${c}20`,
        animation:'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:16,background:`${c}18`,border:`2px solid ${c}40`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.5rem',flexShrink:0}}>
            ⚠️
          </div>
          <div>
            <h2 style={{color:'white',fontWeight:800,fontSize:'1.1rem',margin:0}}>Wrong Field Types Detected</h2>
            <p style={{color:'#94a3b8',fontSize:'0.78rem',margin:'3px 0 0'}}>
              {issues.length} column{issues.length>1?'s are':'is'} assigned to the wrong type. This may cause incorrect charts and statistics.
            </p>
          </div>
        </div>

        {/* Issues list */}
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
          {issues.map((issue, i) => (
            <div key={i} style={{
              background:`${c}08`, border:`1px solid ${c}25`,
              borderRadius:14, padding:'14px 16px',
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <span style={{
                  padding:'3px 10px',background:`${c}20`,border:`1px solid ${c}40`,
                  borderRadius:99,color:c,fontSize:'0.7rem',fontWeight:700
                }}>
                  {issue.col}
                </span>
                <span style={{color:'#f87171',fontSize:'0.72rem',fontWeight:700}}>
                  {issue.current}
                </span>
                <span style={{color:'#475569',fontSize:'0.7rem'}}>→</span>
                <span style={{color:'#34d399',fontSize:'0.72rem',fontWeight:700}}>
                  should be {issue.suggested}
                </span>
              </div>
              <p style={{color:'#94a3b8',fontSize:'0.78rem',margin:'0 0 8px',lineHeight:1.5}}>
                {issue.reason}
              </p>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:'#475569',fontSize:'0.68rem'}}>Sample values:</span>
                {issue.samples.map((s,j)=>(
                  <span key={j} style={{padding:'2px 7px',background:'rgba(51,65,85,0.5)',borderRadius:5,color:'#64748b',fontSize:'0.68rem',fontFamily:'monospace'}}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button
            onClick={() => { onFix(issues); onClose() }}
            style={{
              flex:1,padding:'11px 20px',borderRadius:12,border:'none',cursor:'pointer',
              background:`linear-gradient(135deg,${c},#f97316)`,color:'white',
              fontWeight:700,fontSize:'0.88rem',
              boxShadow:`0 6px 20px ${c}40`,transition:'all 0.2s',
            }}
            onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e=>e.currentTarget.style.transform='none'}
          >
            ✨ Auto-Fix All Issues
          </button>
          <button
            onClick={onIgnore}
            style={{
              padding:'11px 20px',borderRadius:12,cursor:'pointer',
              background:'rgba(51,65,85,0.4)',border:'1px solid rgba(51,65,85,0.5)',
              color:'#94a3b8',fontWeight:600,fontSize:'0.88rem',transition:'all 0.2s',
            }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(51,65,85,0.7)';e.currentTarget.style.color='white'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(51,65,85,0.4)';e.currentTarget.style.color='#94a3b8'}}
          >
            Ignore & Continue Anyway
          </button>
          <button
            onClick={onClose}
            style={{
              padding:'11px 14px',borderRadius:12,cursor:'pointer',
              background:'transparent',border:'1px solid rgba(51,65,85,0.4)',
              color:'#475569',fontWeight:500,fontSize:'0.88rem',
            }}
          >
            Go Back & Fix Manually
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Animated type selector ────────────────────────────────────────────────────
function SchemaTypeSelect({ value, onChange, meta, idx }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position:'relative', display:'inline-block', minWidth:118 }}
      onBlur={()=>setTimeout(()=>setOpen(false),150)}>
      <style>{`@keyframes stDrop{from{opacity:0;transform:translateY(-6px) scale(0.97)}to{opacity:1;transform:none}}`}</style>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:8, cursor:'pointer', outline:'none',
          background:meta.bg, border:`1px solid ${meta.color}50`,
          transition:'all 0.2s', boxShadow:open?`0 0 0 2px ${meta.color}30`:'none' }}
        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${meta.color}30`}
        onMouseLeave={e=>{ if(!open) e.currentTarget.style.boxShadow='none' }}>
        <span style={{ color:meta.color, fontSize:'0.76rem', fontWeight:700 }}>{TYPE_META[value]?.label||value}</span>
        <ChevronDown size={10} color={meta.color} style={{ transition:'transform 0.2s', transform:open?'rotate(180deg)':'none', flexShrink:0 }}/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:999, minWidth:130,
          background:'rgba(8,12,26,0.99)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:10,
          boxShadow:'0 12px 36px rgba(0,0,0,0.6)', overflow:'hidden', animation:'stDrop 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {TYPE_OPTIONS.map((t,i)=>{
            const m=TYPE_META[t]||{color:'#94a3b8',bg:'transparent',label:t}
            const sel=value===t
            return (
              <button key={t} type="button" onClick={()=>{onChange(t);setOpen(false)}}
                style={{ width:'100%', textAlign:'left', padding:'8px 12px', border:'none', cursor:'pointer',
                  background:sel?`${m.color}18`:'transparent', transition:'all 0.12s',
                  borderBottom:i<TYPE_OPTIONS.length-1?'1px solid rgba(51,65,85,0.15)':'none',
                  display:'flex', alignItems:'center', gap:8 }}
                onMouseEnter={e=>{if(!sel)e.currentTarget.style.background=`${m.color}10`}}
                onMouseLeave={e=>{if(!sel)e.currentTarget.style.background='transparent'}}>
                <span style={{ width:8,height:8,borderRadius:'50%',background:m.color,flexShrink:0,boxShadow:sel?`0 0 6px ${m.color}`:'none' }}/>
                <span style={{ color:sel?'white':m.color, fontSize:'0.76rem', fontWeight:sel?700:500 }}>{m.label||t}</span>
                {sel && <span style={{ marginLeft:'auto', fontSize:'0.6rem', color:m.color }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SchemaPage({ uploadData, onAnalysisDone }) {
  const [schema,    setSchema]    = useState(uploadData.schema)
  const [analyzing, setAnalyzing] = useState(false)

  // Auto-detect industry from schema + preview
  const autoDetected = autoDetectIndustry(uploadData.schema, uploadData.preview || [])
  const initialIndustry = uploadData.industry && uploadData.industry !== 'general'
    ? uploadData.industry
    : autoDetected
  const [industry, setIndustry] = useState(initialIndustry)
  const [wasAutoDetected] = useState(autoDetected !== 'general' && autoDetected === initialIndustry)
  const [validation, setValidation] = useState(null)
  const [dismissedWarning, setDismissedWarning] = useState(false)

  // Re-validate whenever user changes industry
  const handleIndustryChange = (ind) => {
    setIndustry(ind)
    setDismissedWarning(false)
    if (ind === 'general') { setValidation(null); return }
    const v = validateIndustryMatch(ind, uploadData.schema, uploadData.preview || [])
    setValidation(v)
  }

  // Validate initial selection on mount
  useEffect(() => {
    if (initialIndustry && initialIndustry !== 'general') {
      const v = validateIndustryMatch(initialIndustry, uploadData.schema, uploadData.preview || [])
      setValidation(v)
    }
  }, [])

  const cfg = getIndustryConfig(industry)
  const c   = cfg?.theme?.primary || '#6366f1'

  const [wrongFieldWarning, setWrongFieldWarning] = useState(null)

  const updateColType = (idx, newType) =>
    setSchema(prev => prev.map((col, i) => i === idx ? { ...col, type: newType, userConfirmed: true } : col))

  // ── Detect wrong field assignments ────────────────────────────────────────
  function detectWrongFields(schema, preview) {
    const issues = []
    schema.forEach((col, idx) => {
      if (col.type === 'identifier') return
      const sampleVals = (preview || []).map(row => row[col.originalName || col.name]).filter(v => v !== null && v !== undefined && v !== '')
      const numericCount = sampleVals.filter(v => !isNaN(parseFloat(String(v).replace(/[$,%]/g,'')))).length
      const numericRatio = sampleVals.length > 0 ? numericCount / sampleVals.length : 0

      // Marked categorical but >80% values are numeric
      if (col.type === 'categorical' && numericRatio > 0.8 && sampleVals.length >= 3) {
        issues.push({
          idx, col: col.name, current: 'categorical', suggested: 'numeric',
          reason: `"${col.name}" has mostly numeric values (${(numericRatio*100).toFixed(0)}% numbers) but is marked as Categorical. This will prevent charts and statistics from working.`,
          samples: sampleVals.slice(0,4).map(String),
        })
      }
      // Marked numeric but >70% values are non-numeric text
      if (col.type === 'numeric' && numericRatio < 0.3 && sampleVals.length >= 3) {
        issues.push({
          idx, col: col.name, current: 'numeric', suggested: 'categorical',
          reason: `"${col.name}" has mostly text values but is marked as Numeric. Analysis results may be inaccurate.`,
          samples: sampleVals.slice(0,4).map(String),
        })
      }
    })
    return issues
  }

  const runAnalysis = async () => {
    setAnalyzing(true)
    try {
      const { data: analysisData } = await api.post('/api/analyze', {
        sessionId: uploadData.sessionId, schema, industry,
      })
      let insightsData = null
      try {
        const { data: ins } = await api.post('/api/insights', {
          sessionId: uploadData.sessionId,
          aggregateStats: analysisData.aggregateStats,
          industry,
          anomalies: analysisData.anomalies,
        })
        insightsData = ins
      } catch {}
      toast.success(`${cfg?.emoji || '🎉'} ${cfg?.label || 'Dashboard'} ready!`)
      onAnalysisDone(analysisData, insightsData)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Analysis failed.')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleLaunch = () => {
    // Check for wrong field type assignments before analysing
    const issues = detectWrongFields(schema, uploadData.preview || [])
    if (issues.length > 0) {
      setWrongFieldWarning(issues)
    } else {
      runAnalysis()
    }
  }

  const dateCount = schema.filter(col => col.type === 'date').length
  const numCount  = schema.filter(col => col.type === 'numeric').length

  return (
    <div style={{ minHeight: '100vh', background: '#030712', padding: '70px 24px 60px', position: 'relative', overflow: 'hidden' }} className="schema-container">

      {/* Wrong Field Warning Modal */}
      {wrongFieldWarning && (
        <WrongFieldWarningModal
          issues={wrongFieldWarning}
          schema={schema}
          color={c}
          onFix={(issues) => {
            // Auto-fix: apply suggested type for each issue
            setSchema(prev => {
              const next = [...prev]
              issues.forEach(issue => {
                next[issue.idx] = { ...next[issue.idx], type: issue.suggested, userConfirmed: true }
              })
              return next
            })
            setWrongFieldWarning(null)
          }}
          onIgnore={() => {
            setWrongFieldWarning(null)
            runAnalysis()
          }}
          onClose={() => setWrongFieldWarning(null)}
        />
      )}

      {/* BG glow changes with industry */}
      <div style={{ position: 'absolute', top: '5%', right: '5%', width: 400, height: 400, background: `radial-gradient(circle, ${c}15 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 0.5s' }} />
      <div style={{ position: 'absolute', bottom: '10%', left: '2%', width: 300, height: 300, background: `radial-gradient(circle, ${c}08 0%, transparent 70%)`, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }} className="animate-fade-in">

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `${c}12`, border: `1px solid ${c}30`, borderRadius: 99, padding: '5px 16px', marginBottom: 16, transition: 'all 0.4s' }}>
            <Database size={13} color={c} />
            <span style={{ fontSize: '0.78rem', color: c, fontWeight: 600 }}>Step 2 of 3 — Configure Dashboard</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', marginBottom: 8 }}>
            Choose Industry & Confirm Schema
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Select your industry to get a tailored dashboard. Then confirm column types below.
          </p>
          {wasAutoDetected && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:10, padding:'5px 14px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:99 }}>
              <Zap size={12} color="#34d399" />
              <span style={{ color:'#6ee7b7', fontSize:'0.75rem', fontWeight:600 }}>
                ✨ Industry auto-detected: <strong style={{ textTransform:'capitalize' }}>{autoDetected}</strong> — confirm or change below
              </span>
            </div>
          )}
        </div>

        {/* ── Industry Selector ── */}
        <IndustrySelector selected={industry} onChange={handleIndustryChange} />

        {/* ── Mismatch Warning ── */}
        {!dismissedWarning && validation && (
          <IndustryMismatchBanner
            validation={validation}
            onSwitch={(ind) => handleIndustryChange(ind)}
            onDismiss={() => setDismissedWarning(true)}
          />
        )}

        {/* ── Selected industry preview ── */}
        {cfg && industry !== 'general' && (
          <div style={{ marginBottom: 24, padding: '14px 20px', background: `${c}10`, border: `1px solid ${c}25`, borderRadius: 16, display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', animation: 'fadeIn 0.3s ease-out' }}>
            <div style={{ fontSize: '1.5rem' }}>{cfg.emoji}</div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{cfg.label} Dashboard Selected</p>
              <p style={{ color: '#64748b', fontSize: '0.75rem' }}>
                {cfg.kpis.length} KPIs · {cfg.charts.length} chart types · {cfg.filters.length} filters · AI-powered insights
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cfg.kpis.slice(0, 4).map(k => (
                <span key={k.key} style={{ padding: '3px 10px', background: `${k.color}15`, border: `1px solid ${k.color}30`, borderRadius: 99, color: k.color, fontSize: '0.7rem', fontWeight: 600 }}>
                  {k.icon} {k.label}
                </span>
              ))}
              {cfg.kpis.length > 4 && <span style={{ padding: '3px 10px', background: 'rgba(51,65,85,0.4)', borderRadius: 99, color: '#64748b', fontSize: '0.7rem' }}>+{cfg.kpis.length - 4} more</span>}
            </div>
          </div>
        )}

        {/* ── Schema stats row ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ color: '#334155', fontSize: '0.75rem', marginRight: 4 }}>{schema.length} columns</span>
          <span style={{ padding: '4px 12px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, color: '#7dd3fc', fontSize: '0.75rem', fontWeight: 600 }}>
            {dateCount} date{dateCount !== 1 ? 's' : ''}
          </span>
          <span style={{ padding: '4px 12px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 10, color: '#6ee7b7', fontSize: '0.75rem', fontWeight: 600 }}>
            {numCount} numeric{numCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Schema Table ── */}
        <div style={{ background: 'rgba(15,23,42,0.65)', border: '1px solid rgba(51,65,85,0.4)', borderRadius: 20, overflow: 'hidden', marginBottom: 20, backdropFilter: 'blur(16px)' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(51,65,85,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Column Schema</span>
            <span style={{ color: '#334155', fontSize: '0.75rem' }}>{uploadData.rowCount?.toLocaleString()} total rows</span>
          </div>
          <div style={{ overflowX: 'auto' }} className="schema-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
                  {['Column Name', 'Sample Values', 'Missing', 'Detected Type'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#475569', fontWeight: 600, fontSize: '0.72rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schema.map((col, idx) => {
                  const meta = TYPE_META[col.type] || TYPE_META.text
                  return (
                    <tr key={col.name}
                      style={{ borderBottom: '1px solid rgba(15,23,42,0.8)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <code style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 6, padding: '2px 8px', color: '#e2e8f0', fontSize: '0.78rem' }}>{col.name}</code>
                          {col.userConfirmed && <span style={{ fontSize: '0.65rem', color: c, fontWeight: 700 }}>✓</span>}
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', color: '#475569', fontSize: '0.75rem', maxWidth: 180 }} className="schema-sample-col">
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {col.sampleValues?.join(', ') || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ color: col.nullCount > 0 ? '#fbbf24' : '#334155', fontSize: '0.8rem', fontWeight: col.nullCount > 0 ? 600 : 400 }}>
                          {col.nullCount}
                        </span>
                      </td>
                      <td style={{ padding: '11px 16px' }}>
                        <SchemaTypeSelect
                          value={col.type}
                          onChange={v => updateColType(idx, v)}
                          meta={meta}
                          idx={idx}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Warnings ── */}
        {dateCount === 0 && (
          <div style={{ display: 'flex', gap: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
            <Info size={15} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: '#fcd34d', fontSize: '0.82rem' }}>No date column — time-series charts and forecasting will be skipped.</p>
          </div>
        )}
        {numCount === 0 && (
          <div style={{ display: 'flex', gap: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
            <Info size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ color: '#fca5a5', fontSize: '0.82rem' }}>No numeric columns detected. Mark at least one column as "Numeric" to enable analysis.</p>
          </div>
        )}

        {/* ── Run Button ── */}
        <div style={{ textAlign: 'center', paddingTop: 12 }}>
          <button
            onClick={handleLaunch}
            disabled={analyzing || numCount === 0}
            className="btn-primary"
            style={{ fontSize: '1rem', padding: '14px 40px', background: `linear-gradient(135deg, ${c}, ${cfg?.theme?.secondary || '#8b5cf6'})`, boxShadow: `0 8px 24px ${c}40` }}
          >
            {analyzing
              ? <><LoadingSpinner size={18} /> Generating {cfg?.label || 'Dashboard'}…</>
              : <><Sparkles size={18} /> {cfg?.emoji || '🚀'} Launch {cfg?.label || 'Dashboard'}</>
            }
          </button>
          {numCount === 0 && (
            <p style={{ color: '#f87171', fontSize: '0.78rem', marginTop: 8 }}>Mark at least one column as Numeric to proceed.</p>
          )}
        </div>

      </div>
    </div>
  )
}
