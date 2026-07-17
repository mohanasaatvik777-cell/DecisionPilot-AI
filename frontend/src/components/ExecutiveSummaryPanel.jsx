/**
 * ExecutiveSummaryPanel.jsx
 * Intelligence tab — plain human-readable format.
 * Five sections: Summary | Health | Alerts | Insights | Stats
 */
import { useState, useEffect } from 'react'
import { Loader2, TrendingUp, TrendingDown, ShieldCheck, AlertTriangle, CheckCircle, XCircle, BarChart2, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import api from '../api'

const fmtNum = v => {
  if (v == null || isNaN(Number(v))) return 'N/A'
  const n = Number(v)
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// Animated score ring
function ScoreRing({ score, size = 88 }) {
  const [anim, setAnim] = useState(0)
  useEffect(() => { const t = setTimeout(() => setAnim(score), 300); return () => clearTimeout(t) }, [score])
  const r = size * 0.38, sw = size * 0.1
  const circ = 2 * Math.PI * r
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#6366f1' : score >= 40 ? '#fbbf24' : '#f87171'
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Average' : 'Poor'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={circ} strokeDashoffset={circ - (anim/100)*circ} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.2s ease', filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: size * 0.22 }}>{score}</span>
          <span style={{ color: '#64748b', fontSize: size * 0.1 }}>/100</span>
        </div>
      </div>
      <span style={{ padding: '3px 12px', background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 99, color, fontWeight: 700, fontSize: '0.72rem' }}>{label}</span>
    </div>
  )
}

export default function ExecutiveSummaryPanel({ uploadData, analysisData, config }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [tab,     setTab]     = useState('summary')

  const c  = config?.theme?.primary   || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'

  useEffect(() => {
    if (!uploadData?.sessionId) return
    setLoading(true); setError(null)
    api.post('/api/executive', { sessionId: uploadData.sessionId })
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.error || 'Could not generate summary.'))
      .finally(() => setLoading(false))
  }, [uploadData?.sessionId])

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', background: 'rgba(15,23,42,0.5)', borderRadius: 20 }}>
      <Loader2 size={36} color={c} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px', display: 'block' }} />
      <p style={{ color: '#64748b' }}>Analysing your dataset…</p>
    </div>
  )
  if (error) return <div style={{ padding: 20, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, color: '#fca5a5' }}>⚠ {error}</div>
  if (!data) return null

  const { executiveSummary, dataHealth, bizHealth, smartAlerts = [], autoInsights = [], advancedStats, rankedInsights = [] } = data

  const TABS = [
    { id: 'summary',  label: '📋 Summary'   },
    { id: 'health',   label: '🛡️ Health'    },
    { id: 'alerts',   label: `🚨 Alerts${smartAlerts.length ? ` (${smartAlerts.length})` : ''}` },
    { id: 'insights', label: '💡 Insights'  },
    { id: 'stats',    label: '📊 Statistics' },
  ]

  return (
    <div style={{ borderRadius: 22, overflow: 'hidden', background: 'rgba(8,12,26,0.97)', border: `1px solid ${c}25`, boxShadow: `0 20px 60px ${c}12` }}>

      {/* ── Header ── */}
      <div style={{ padding: '18px 24px 14px', background: `linear-gradient(135deg,${c}18,${c2}08)`, borderBottom: `1px solid ${c}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg,${c},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: `0 6px 20px ${c}40` }}>📋</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.05rem', marginBottom: 3 }}>Intelligence Report</h2>
            <p style={{ color: '#475569', fontSize: '0.72rem' }}>{uploadData?.fileName} · {analysisData?.aggregateStats?.rowCount?.toLocaleString()} records</p>
          </div>
          {/* Score pills */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Data Quality', score: dataHealth?.score, good: dataHealth?.score >= 70 },
              { label: 'Biz Health',   score: bizHealth?.score,  good: bizHealth?.score  >= 65 },
            ].map(p => p.score != null && (
              <div key={p.label} style={{ textAlign: 'center', padding: '6px 14px', background: p.good ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', border: `1px solid ${p.good ? 'rgba(52,211,153,0.35)' : 'rgba(251,191,36,0.3)'}`, borderRadius: 12 }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', lineHeight: 1 }}>{p.score}</div>
                <div style={{ color: '#64748b', fontSize: '0.6rem', marginTop: 2 }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(15,23,42,0.6)', borderRadius: 11, padding: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: tab === t.id ? `1px solid ${c}40` : '1px solid transparent', background: tab === t.id ? `${c}20` : 'transparent', color: tab === t.id ? 'white' : '#64748b', fontSize: '0.74rem', fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ═══════════ SUMMARY ═══════════ */}
        {tab === 'summary' && (
          <>
            {/* Quick-glance cards */}
            {autoInsights.length > 0 && (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>At a Glance</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                  {autoInsights.map((card, i) => (
                    <div key={i} style={{ padding: '14px', background: `${card.color}0f`, border: `1px solid ${card.color}30`, borderRadius: 14 }}>
                      <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{card.icon}</div>
                      <div style={{ color: card.color, fontWeight: 800, fontSize: '1rem', marginBottom: 2 }}>{card.context}</div>
                      <div style={{ color: '#64748b', fontSize: '0.68rem' }}>{card.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Executive narrative — plain English */}
            <div style={{ padding: '18px 20px', background: `${c}08`, border: `1px solid ${c}20`, borderLeft: `4px solid ${c}`, borderRadius: 14 }}>
              <p style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>What Your Data Is Telling You</p>
              <div style={{ color: '#e2e8f0', fontSize: '0.88rem', lineHeight: 1.8 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{executiveSummary}</ReactMarkdown>
              </div>
            </div>
          </>
        )}

        {/* ═══════════ HEALTH ═══════════ */}
        {tab === 'health' && dataHealth && bizHealth && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>

            {/* Data Quality */}
            <div style={{ padding: '20px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${c}20`, borderRadius: 18 }}>
              <p style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>🛡️ Data Quality</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <ScoreRing score={dataHealth.score} />
                <div>
                  <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>
                    {dataHealth.score >= 80 ? 'Your data is in great shape.' : dataHealth.score >= 60 ? 'Your data is mostly clean.' : 'Your data needs some attention.'}
                  </p>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Missing: <b style={{ color: dataHealth.missingPct > 5 ? '#fcd34d' : '#34d399' }}>{dataHealth.missingPct}%</b></span>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Duplicates: <b style={{ color: dataHealth.dupCount > 0 ? '#fcd34d' : '#34d399' }}>{dataHealth.dupCount}</b></span>
                    <span style={{ color: '#64748b', fontSize: '0.72rem' }}>Outliers: <b style={{ color: dataHealth.outlierCount > 0 ? '#fcd34d' : '#34d399' }}>{dataHealth.outlierCount}</b></span>
                  </div>
                </div>
              </div>
              {dataHealth.issues?.length > 0
                ? dataHealth.issues.map((iss, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '8px 12px', background: iss.type === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.07)', border: `1px solid ${iss.type === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.2)'}`, borderRadius: 9, marginBottom: 6 }}>
                      <span>{iss.type === 'critical' ? '🚨' : '⚠️'}</span>
                      <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{iss.msg}</span>
                    </div>
                  ))
                : <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle size={14} color="#34d399" /><span style={{ color: '#34d399', fontSize: '0.78rem' }}>No data quality issues found — good to go!</span></div>
              }
            </div>

            {/* Business Health */}
            <div style={{ padding: '20px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${c}20`, borderRadius: 18 }}>
              <p style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>📈 Business Health</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                <ScoreRing score={bizHealth.score} />
                <p style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                  {bizHealth.score >= 80 ? 'Business is performing well.' : bizHealth.score >= 65 ? 'Business is on a stable track.' : bizHealth.score >= 45 ? 'Some areas need attention.' : 'Business metrics need review.'}
                </p>
              </div>
              {bizHealth.signals?.map((sig, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, padding: '8px 12px', background: 'rgba(15,23,42,0.4)', borderRadius: 9 }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{sig.type === 'positive' ? '✅' : sig.type === 'negative' ? '📉' : '⚠️'}</span>
                  <span style={{ color: sig.type === 'positive' ? '#34d399' : sig.type === 'negative' ? '#f87171' : '#fcd34d', fontSize: '0.78rem', lineHeight: 1.5 }}>{sig.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════════ ALERTS ═══════════ */}
        {tab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!smartAlerts.length
              ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <CheckCircle size={36} color="#34d399" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ color: '#34d399', fontWeight: 700, fontSize: '1rem' }}>All clear — no alerts detected</p>
                  <p style={{ color: '#475569', fontSize: '0.8rem', marginTop: 6 }}>Your data shows no unusual patterns or issues.</p>
                </div>
              )
              : smartAlerts.map((alert, i) => {
                const isCrit = alert.severity === 'critical'
                const borderColor = isCrit ? '#f87171' : '#fcd34d'
                const bg = isCrit ? 'rgba(239,68,68,0.07)' : 'rgba(251,191,36,0.07)'
                return (
                  <div key={i} style={{ padding: '14px 18px', background: bg, border: `1px solid ${borderColor}40`, borderLeft: `4px solid ${borderColor}`, borderRadius: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{isCrit ? '🚨' : '⚠️'}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: borderColor, fontWeight: 700, fontSize: '0.88rem', marginBottom: 4 }}>{alert.title}</p>
                        <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.6 }}>{alert.message}</p>
                        {alert.date && <p style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4 }}>Detected on {alert.date}</p>}
                      </div>
                      <span style={{ padding: '3px 10px', background: `${borderColor}15`, border: `1px solid ${borderColor}30`, borderRadius: 99, color: borderColor, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>
                        {isCrit ? 'Critical' : 'Warning'}
                      </span>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ═══════════ INSIGHTS ═══════════ */}
        {tab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginBottom: 4 }}>
              Here are the most important findings from your data, ranked by priority:
            </p>
            {!rankedInsights.length
              ? <p style={{ color: '#475569', padding: 24, textAlign: 'center' }}>No insights generated yet.</p>
              : rankedInsights.map((ins, i) => {
                const isHigh = ins.priority === 'HIGH'
                const isMed  = ins.priority === 'MEDIUM'
                const dotColor = isHigh ? '#f87171' : isMed ? '#fcd34d' : '#34d399'
                const bg       = isHigh ? 'rgba(239,68,68,0.07)' : isMed ? 'rgba(251,191,36,0.06)' : 'rgba(52,211,153,0.06)'
                const border   = isHigh ? 'rgba(239,68,68,0.25)' : isMed ? 'rgba(251,191,36,0.2)' : 'rgba(52,211,153,0.18)'
                return (
                  <div key={i} style={{ padding: '14px 16px', background: bg, border: `1px solid ${border}`, borderRadius: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0, marginTop: 6, boxShadow: `0 0 8px ${dotColor}` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1rem' }}>{ins.icon}</span>
                        <span style={{ color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>{ins.title}</span>
                        <span style={{ padding: '2px 8px', background: `${dotColor}15`, border: `1px solid ${dotColor}30`, borderRadius: 99, color: dotColor, fontSize: '0.62rem', fontWeight: 700 }}>
                          {isHigh ? 'High Priority' : isMed ? 'Medium Priority' : 'Low Priority'}
                        </span>
                      </div>
                      <p style={{ color: '#cbd5e1', fontSize: '0.82rem', lineHeight: 1.65 }}>{ins.detail}</p>
                      <span style={{ padding: '2px 8px', background: 'rgba(51,65,85,0.4)', borderRadius: 99, color: '#64748b', fontSize: '0.65rem' }}>{ins.category}</span>
                    </div>
                  </div>
                )
              })
            }
          </div>
        )}

        {/* ═══════════ STATS ═══════════ */}
        {tab === 'stats' && advancedStats && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Column stats in plain cards instead of raw table */}
            {Object.keys(advancedStats.columnStats || {}).length > 0 && (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Column Breakdown</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
                  {Object.entries(advancedStats.columnStats).map(([col, s]) => (
                    <div key={col} style={{ padding: '14px 16px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${c}18`, borderRadius: 14 }}>
                      <p style={{ color: c, fontWeight: 700, fontSize: '0.82rem', marginBottom: 10, fontFamily: 'monospace' }}>{col}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {[
                          ['Average',  fmtNum(s.mean)],
                          ['Median',   fmtNum(s.median)],
                          ['Lowest',   fmtNum(s.min)],
                          ['Highest',  fmtNum(s.max)],
                          ['Std Dev',  fmtNum(s.std)],
                          ['Records',  s.count],
                        ].map(([k, v]) => (
                          <div key={k}>
                            <div style={{ color: '#475569', fontSize: '0.62rem' }}>{k}</div>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>{v}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correlations in plain English */}
            {advancedStats.correlations?.length > 0 && (
              <div>
                <p style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Relationships Between Columns</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {advancedStats.correlations.slice(0, 6).map((cor, i) => {
                    const isStrong = Math.abs(cor.r) > 0.7
                    const isMod    = Math.abs(cor.r) > 0.4
                    const barColor = isStrong ? (cor.r > 0 ? '#34d399' : '#f87171') : isMod ? '#6366f1' : '#64748b'
                    const label    = isStrong ? (cor.r > 0 ? 'Strongly rise together' : 'Move in opposite directions') : isMod ? (cor.r > 0 ? 'Tend to move together' : 'Slightly opposing') : 'Weak or no relationship'
                    return (
                      <div key={i} style={{ padding: '12px 16px', background: 'rgba(15,23,42,0.5)', border: `1px solid ${barColor}20`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: 'white', fontWeight: 600, fontSize: '0.82rem' }}>{cor.c1}</span>
                          <span style={{ color: '#475569', margin: '0 8px' }}>and</span>
                          <span style={{ color: 'white', fontWeight: 600, fontSize: '0.82rem' }}>{cor.c2}</span>
                          <p style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: 3 }}>{label}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <div style={{ width: 70, height: 6, background: 'rgba(51,65,85,0.5)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.abs(cor.r)*100}%`, background: barColor, borderRadius: 99 }} />
                          </div>
                          <span style={{ color: barColor, fontWeight: 800, fontSize: '0.8rem' }}>r = {cor.r}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
