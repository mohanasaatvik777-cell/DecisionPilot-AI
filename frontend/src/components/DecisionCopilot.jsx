/**
 * DecisionCopilot.jsx
 * AI Decision Copilot — premium decision intelligence panel
 */
import { useState, useRef } from 'react'
import { Send, Loader2, RotateCcw, ChevronRight, Sparkles, Shield, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api'

// ── Helpers ───────────────────────────────────────────────────────────────────
const RISK_STYLE = {
  Low:    { color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  dot: '🟢' },
  Medium: { color: '#fcd34d', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)', dot: '🟡' },
  High:   { color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   dot: '🔴' },
}
const REC_STYLE = {
  'Recommended':           { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.4)',  icon: CheckCircle2,  label: 'Recommended' },
  'Not Recommended':       { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.4)',   icon: XCircle,       label: 'Not Recommended' },
  'Proceed with Caution':  { color: '#fcd34d', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.4)',  icon: AlertTriangle, label: 'Proceed with Caution' },
}
const PRIORITY_STYLE = {
  Low:      { color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
  Medium:   { color: '#fcd34d', bg: 'rgba(251,191,36,0.1)' },
  High:     { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  Critical: { color: '#f87171', bg: 'rgba(239,68,68,0.12)' },
}
const INTENT_EMOJI = {
  hiring:'👥', salary:'💰', marketing:'📢', inventory:'📦',
  pricing:'🏷️', expansion:'🏗️', cost_reduction:'✂️', general:'🧭',
}
const EXAMPLE_DECISIONS = [
  'Should I hire more employees?',
  'Should I increase salaries?',
  'Should I expand marketing budget?',
  'Should I reduce inventory?',
  'Should I open a new branch?',
  'Can I reduce operational costs?',
  'Should I increase product price?',
  'Should I launch a new product line?',
]

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, iconColor, children, accent }) {
  return (
    <div style={{ background: 'rgba(10,15,30,0.8)', border: `1px solid ${accent || 'rgba(51,65,85,0.4)'}`, borderRadius: 18, overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: `1px solid ${accent || 'rgba(51,65,85,0.3)'}`, background: accent ? `${accent}10` : 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && <Icon size={15} color={iconColor || '#64748b'} />}
        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

// ── Bullet list ───────────────────────────────────────────────────────────────
function BulletList({ items, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {(items || []).map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color || '#6366f1', flexShrink: 0, marginTop: 6, boxShadow: `0 0 6px ${color || '#6366f1'}` }} />
          <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65, margin: 0 }}>{item}</p>
        </div>
      ))}
    </div>
  )
}

// ── Confidence ring ───────────────────────────────────────────────────────────
function ConfidenceRing({ score, reasons, c }) {
  const r = 40, stroke = 8
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? '#34d399' : score >= 65 ? '#6366f1' : '#fbbf24'
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: `radial-gradient(circle,${color}20,transparent 70%)` }} />
        <svg width={96} height={96} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={stroke} />
          <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', lineHeight: 1 }}>{score}</span>
          <span style={{ color: '#475569', fontSize: '0.58rem', fontWeight: 600 }}>%</span>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Why this confidence?</p>
        {(reasons || []).map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 7, marginBottom: 5 }}>
            <CheckCircle2 size={11} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: '#94a3b8', fontSize: '0.76rem' }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Risk analysis grid ────────────────────────────────────────────────────────
function RiskGrid({ riskAnalysis }) {
  if (!riskAnalysis) return null
  const dims = [
    { key: 'operational', label: 'Operational' },
    { key: 'financial',   label: 'Financial' },
    { key: 'customer',    label: 'Customer' },
    { key: 'business',    label: 'Business' },
  ]
  const overall = riskAnalysis.overall || 'Medium'
  const os = RISK_STYLE[overall] || RISK_STYLE.Medium
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {dims.map(({ key, label }) => {
        const risk = riskAnalysis[key]
        if (!risk) return null
        const s = RISK_STYLE[risk.level] || RISK_STYLE.Medium
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12 }}>
            <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{s.dot}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                <span style={{ color: 'white', fontWeight: 700, fontSize: '0.8rem' }}>{label} Risk</span>
                <span style={{ padding: '1px 8px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 99, color: s.color, fontSize: '0.6rem', fontWeight: 700 }}>{risk.level}</span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.76rem', margin: 0 }}>{risk.reason}</p>
            </div>
          </div>
        )
      })}
      <div style={{ padding: '10px 14px', background: os.bg, border: `2px solid ${os.border}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Shield size={15} color={os.color} />
        <span style={{ color: os.color, fontWeight: 800, fontSize: '0.85rem' }}>Overall Risk: {overall}</span>
      </div>
    </div>
  )
}

// ── Full Decision Report ──────────────────────────────────────────────────────
function DecisionReport({ report, c, c2, onFollowUp }) {
  const rec  = REC_STYLE[report.recommendation] || REC_STYLE['Proceed with Caution']
  const pri  = PRIORITY_STYLE[report.priority]  || PRIORITY_STYLE.Medium
  const RecIcon = rec.icon

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="animate-fade-in">

      {/* ── Decision + Recommendation hero ── */}
      <div style={{ padding: '20px 22px', background: `linear-gradient(135deg,${c}15,${c2}08)`, border: `1px solid ${c}30`, borderRadius: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '1.4rem' }}>{INTENT_EMOJI[report.intent] || '🧭'}</span>
              <span style={{ padding: '2px 10px', background: `${c}20`, border: `1px solid ${c}35`, borderRadius: 99, color: c, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' }}>
                Decision Report
              </span>
              <span style={{ padding: '2px 10px', background: pri.bg, borderRadius: 99, color: pri.color, fontSize: '0.62rem', fontWeight: 700 }}>
                {report.priority} Priority
              </span>
              {report.source === 'gemini' && (
                <span style={{ padding: '2px 8px', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 99, color: '#a78bfa', fontSize: '0.6rem', fontWeight: 700 }}>✨ Gemini AI</span>
              )}
            </div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '1rem', lineHeight: 1.5, marginBottom: 12 }}>{report.decision}</p>
          </div>
          {/* Recommendation verdict */}
          <div style={{ padding: '14px 20px', background: rec.bg, border: `2px solid ${rec.border}`, borderRadius: 16, textAlign: 'center', flexShrink: 0 }}>
            <RecIcon size={22} color={rec.color} style={{ margin: '0 auto 6px', display: 'block' }} />
            <p style={{ color: rec.color, fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{rec.label}</p>
          </div>
        </div>
        {/* Recommendation reason */}
        <div style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: 12, borderLeft: `3px solid ${c}` }}>
          <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65, margin: 0 }}>{report.recommendationReason}</p>
        </div>
      </div>

      {/* ── 3-column grid: Situation | Benefits | Risks ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <Card title="📍 Current Situation" icon={Info} iconColor="#38bdf8" accent="rgba(56,189,248,0.3)">
          <BulletList items={report.currentSituation} color="#38bdf8" />
        </Card>
        <Card title="✅ Potential Benefits" icon={TrendingUp} iconColor="#34d399" accent="rgba(52,211,153,0.3)">
          <BulletList items={report.potentialBenefits} color="#34d399" />
        </Card>
        <Card title="⚠️ Potential Risks" icon={AlertTriangle} iconColor="#f87171" accent="rgba(239,68,68,0.3)">
          <BulletList items={report.potentialRisks} color="#f87171" />
        </Card>
      </div>

      {/* ── Risk Analysis + Confidence ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <Card title="🛡️ Risk Analysis" icon={Shield} iconColor="#fbbf24" accent="rgba(251,191,36,0.25)">
          <RiskGrid riskAnalysis={report.riskAnalysis} />
        </Card>
        <Card title="🎯 Confidence Score" icon={Sparkles} iconColor={c} accent={`${c}40`}>
          <ConfidenceRing score={report.confidence?.score || 70} reasons={report.confidence?.reasons} c={c} />
        </Card>
      </div>

      {/* ── Alternative Plan ── */}
      {report.alternativePlan && (
        <Card title="💡 Alternative Plan" icon={Sparkles} iconColor="#a78bfa" accent="rgba(167,139,250,0.3)">
          <div style={{ padding: '12px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 12 }}>
            <p style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem', marginBottom: 6 }}>{report.alternativePlan.title}</p>
            <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65, marginBottom: 8 }}>{report.alternativePlan.description}</p>
            {report.alternativePlan.estimatedImpact && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <TrendingUp size={12} color="#a78bfa" />
                <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Estimated Impact: </span>
                <span style={{ color: '#94a3b8', fontSize: '0.72rem', fontWeight: 600 }}>{report.alternativePlan.estimatedImpact}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ── Implementation Steps ── */}
      {report.implementationSteps?.length > 0 && (
        <Card title="🗺️ Implementation Roadmap" iconColor="#38bdf8" accent="rgba(56,189,248,0.25)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {report.implementationSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(15,23,42,0.5)', borderRadius: 10 }}>
                <div style={{ width: 24, height: 24, borderRadius: 8, background: `linear-gradient(135deg,${c},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: '0.7rem', flexShrink: 0 }}>{i + 1}</div>
                <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.6, margin: 0 }}>{step}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Follow-up Questions ── */}
      {report.followUpQuestions?.length > 0 && (
        <Card title="🔍 Explore Further" iconColor={c2} accent={`${c2}30`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {report.followUpQuestions.map((q, i) => (
              <button key={i} onClick={() => onFollowUp(q)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: `${c}08`, border: `1px solid ${c}18`, borderRadius: 10, color: '#94a3b8', fontSize: '0.79rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${c}20`; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = `${c}40` }}
                onMouseLeave={e => { e.currentTarget.style.background = `${c}08`; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = `${c}18` }}>
                <ChevronRight size={12} color={c} style={{ flexShrink: 0 }} />{q}
              </button>
            ))}
          </div>
        </Card>
      )}

    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DecisionCopilot({ uploadData, analysisData, config }) {
  const [input,   setInput]   = useState('')
  const [reports, setReports] = useState([])   // history of reports
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [history, setHistory] = useState([])   // conversation memory
  const inputRef = useRef(null)
  const c  = config?.theme?.primary   || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'

  const submit = async (text) => {
    const q = (text || input).trim()
    if (!q || loading || !uploadData?.sessionId) return
    setInput('')
    setLoading(true)
    setError('')

    const newHistory = [...history, { role: 'user', content: q }]
    setHistory(newHistory)

    try {
      const { data } = await api.post('/api/decision', {
        sessionId: uploadData.sessionId,
        decision: q,
        conversationHistory: newHistory.slice(-6),
      })
      setReports(prev => [{ ...data, id: Date.now(), query: q }, ...prev])
      setHistory(prev => [...prev, { role: 'assistant', content: data.recommendationReason || data.recommendation }])
    } catch (e) {
      setError(e.response?.data?.error || 'Decision analysis failed. Please try again.')
    } finally { setLoading(false) }
  }

  const clearAll = () => { setReports([]); setHistory([]); setError('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Header ── */}
      <div style={{ padding: '22px 26px', background: `linear-gradient(135deg,${c}18,${c2}08)`, border: `1px solid ${c}25`, borderRadius: 22, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 200, height: 200, background: `radial-gradient(circle,${c}18,transparent 65%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
          <div style={{ width: 50, height: 50, borderRadius: 16, background: `linear-gradient(135deg,${c},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', boxShadow: `0 8px 28px ${c}50`, flexShrink: 0 }}>🧭</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>AI Decision Copilot</h2>
              <span style={{ padding: '2px 10px', background: `${c}20`, border: `1px solid ${c}35`, borderRadius: 99, color: c, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase' }}>Decision Intelligence</span>
            </div>
            <p style={{ color: '#475569', fontSize: '0.75rem' }}>
              {uploadData?.fileName} · {analysisData?.aggregateStats?.rowCount?.toLocaleString()} records · Ask any business decision
            </p>
          </div>
          {reports.length > 0 && (
            <button onClick={clearAll} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(51,65,85,0.4)', border: '1px solid rgba(51,65,85,0.5)', borderRadius: 9, color: '#64748b', fontSize: '0.72rem', cursor: 'pointer', flexShrink: 0 }}>
              <RotateCcw size={11} /> Clear
            </button>
          )}
        </div>

        {/* Input box */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
              placeholder="e.g. Should I hire more employees? Should I increase marketing budget? Can I reduce operational costs?"
              rows={2}
              style={{ width: '100%', background: 'rgba(5,8,20,0.85)', border: `1.5px solid ${input ? c + '60' : 'rgba(51,65,85,0.5)'}`, borderRadius: 14, padding: '12px 16px', color: 'white', fontSize: '0.87rem', outline: 'none', resize: 'none', boxSizing: 'border-box', lineHeight: 1.55, transition: 'all 0.2s', boxShadow: input ? `0 0 0 3px ${c}15` : 'none' }}
            />
          </div>
          <button onClick={() => submit()} disabled={!input.trim() || loading}
            style={{ width: 54, borderRadius: 14, border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', background: input.trim() && !loading ? `linear-gradient(135deg,${c},${c2})` : 'rgba(30,41,59,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: input.trim() && !loading ? `0 6px 20px ${c}40` : 'none', transition: 'all 0.2s' }}>
            {loading ? <Loader2 size={20} color="#34d399" style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} color={input.trim() && !loading ? 'white' : '#334155'} />}
          </button>
        </div>

        {/* Example chips */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EXAMPLE_DECISIONS.map((ex, i) => (
            <button key={i} onClick={() => { setInput(ex); inputRef.current?.focus() }}
              style={{ padding: '4px 12px', background: `${c}08`, border: `1px solid ${c}18`, borderRadius: 99, color: '#64748b', fontSize: '0.7rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = `${c}20`; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = `${c}50` }}
              onMouseLeave={e => { e.currentTarget.style.background = `${c}08`; e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = `${c}18` }}>
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#fca5a5', fontSize: '0.82rem' }}>⚠ {error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '18px 22px', background: 'rgba(8,12,28,0.85)', border: `1px solid ${c}20`, borderRadius: 18 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `${c}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={20} color={c} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
          <div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '0.88rem', margin: 0 }}>Copilot is analyzing your decision…</p>
            <p style={{ color: '#475569', fontSize: '0.72rem', margin: 0 }}>Gathering KPIs · Evaluating risks · Generating recommendation</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: c, animation: `pulse 1.4s ease-in-out ${i*0.2}s infinite` }} />)}
          </div>
        </div>
      )}

      {/* Decision Reports */}
      {reports.map(report => (
        <div key={report.id}>
          <DecisionReport report={report} c={c} c2={c2} onFollowUp={q => { setInput(q); submit(q) }} />
        </div>
      ))}

      {/* Empty state */}
      {!loading && reports.length === 0 && !error && (
        <div style={{ padding: '56px 24px', textAlign: 'center', background: 'rgba(8,12,28,0.6)', border: `1px solid ${c}15`, borderRadius: 22 }}>
          <div style={{ fontSize: '3rem', marginBottom: 14 }}>🧭</div>
          <p style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}>Your AI Decision Copilot is ready</p>
          <p style={{ color: '#475569', fontSize: '0.83rem', maxWidth: 440, margin: '0 auto 20px' }}>
            Ask any business decision. The copilot analyzes your actual data, evaluates risks and benefits, and gives you a structured recommendation.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {EXAMPLE_DECISIONS.slice(0, 3).map(q => (
              <button key={q} onClick={() => submit(q)}
                style={{ padding: '9px 16px', background: `${c}15`, border: `1px solid ${c}30`, borderRadius: 10, color: c, fontSize: '0.79rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = `${c}28`}
                onMouseLeave={e => e.currentTarget.style.background = `${c}15`}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
