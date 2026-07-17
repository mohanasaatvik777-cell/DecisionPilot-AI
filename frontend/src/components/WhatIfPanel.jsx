/**
 * WhatIfPanel.jsx — What-If Analysis / Scenario Simulator
 * Simulates the impact of changing any numeric column by % or absolute amount.
 * Works with any uploaded CSV — fully dynamic, zero hardcoded columns.
 */
import { useState, useEffect } from 'react'
import { Loader2, Play, RotateCcw, TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'
import api from '../api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const COLORS = ['#6366f1', '#34d399', '#f472b6', '#fbbf24', '#38bdf8', '#a78bfa']

const fmt = v => {
  if (v === null || v === undefined || isNaN(Number(v))) return 'N/A'
  const n = Number(v)
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const IMPACT_STYLE = {
  positive: { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', dot: '🟢' },
  warning:  { color: '#fcd34d', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', dot: '🟡' },
  negative: { color: '#f87171', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  dot: '🔴' },
}

// ── Stat comparison block ─────────────────────────────────────────────────────
function StatCompare({ label, current, simulated, delta, pct, color }) {
  const isPositive = delta >= 0
  const Arrow = isPositive ? TrendingUp : TrendingDown
  const arrowColor = isPositive ? '#34d399' : '#f87171'
  return (
    <div style={{ flex: 1, minWidth: 180, padding: '16px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${color}20`, borderRadius: 16 }}>
      <p style={{ color: '#64748b', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <p style={{ color: '#475569', fontSize: '0.68rem', marginBottom: 2 }}>Current</p>
          <p style={{ color: 'white', fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>{fmt(current)}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
          <Arrow size={14} color={arrowColor} />
          <span style={{ color: arrowColor, fontSize: '0.75rem', fontWeight: 700 }}>
            {isPositive ? '+' : ''}{fmt(delta)} ({isPositive ? '+' : ''}{pct?.toFixed(1)}%)
          </span>
        </div>
        <div>
          <p style={{ color: '#475569', fontSize: '0.68rem', marginBottom: 2 }}>Simulated</p>
          <p style={{ color: color, fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>{fmt(simulated)}</p>
        </div>
      </div>
    </div>
  )
}

export default function WhatIfPanel({ uploadData, config }) {
  const [columns,     setColumns]     = useState([])
  const [catColumns,  setCatColumns]  = useState([])
  const [loadingCols, setLoadingCols] = useState(true)

  // Form state
  const [column,      setColumn]      = useState('')
  const [changeType,  setChangeType]  = useState('percent')
  const [changeValue, setChangeValue] = useState(10)
  const [groupBy,     setGroupBy]     = useState('')

  // Result state
  const [result,   setResult]   = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const c  = config?.theme?.primary   || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'

  // Load available columns on mount
  useEffect(() => {
    if (!uploadData?.sessionId) return
    const load = async () => {
      setLoadingCols(true)
      try {
        const { data } = await api.get(`/api/whatif/columns/${uploadData.sessionId}`)
        setColumns(data.columns || [])
        setCatColumns(data.categoricalColumns || [])
        if (data.columns?.length) setColumn(data.columns[0].name)
      } catch (e) {
        console.error('[WHATIF] columns load failed', e)
      } finally { setLoadingCols(false) }
    }
    load()
  }, [uploadData?.sessionId])

  const runSimulation = async () => {
    if (!column || changeValue === '' || isNaN(Number(changeValue))) return
    setLoading(true); setError(''); setResult(null)
    try {
      const { data } = await api.post('/api/whatif', {
        sessionId: uploadData.sessionId,
        column,
        changeType,
        changeValue: Number(changeValue),
        groupBy: groupBy || undefined,
      })
      setResult(data)
    } catch (e) {
      setError(e.response?.data?.error || 'Simulation failed. Please try again.')
    } finally { setLoading(false) }
  }

  const reset = () => { setResult(null); setError('') }

  const selectedColInfo = columns.find(c => c.name === column)

  return (
    <div style={{ borderRadius: 24, overflow: 'hidden', background: 'rgba(8,12,26,0.97)', border: `1px solid ${c}25`, boxShadow: `0 24px 80px ${c}15` }}>

      {/* ── Header ── */}
      <div style={{ padding: '20px 24px 16px', background: `linear-gradient(135deg,${c}18,${c2}08)`, borderBottom: `1px solid ${c}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg,${c},${c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', boxShadow: `0 8px 24px ${c}40` }}>🔮</div>
          <div>
            <h2 style={{ color: 'white', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', marginBottom: 2 }}>What-If Scenario Simulator</h2>
            <p style={{ color: '#475569', fontSize: '0.72rem' }}>Simulate any change and instantly see the projected business impact</p>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Controls ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, padding: '18px 20px', background: 'rgba(15,23,42,0.6)', border: `1px solid ${c}15`, borderRadius: 18 }}>

          {/* Column picker */}
          <div>
            <label style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Column to Change
            </label>
            {loadingCols ? (
              <div style={{ color: '#475569', fontSize: '0.8rem', padding: '10px 0' }}>Loading columns…</div>
            ) : (
              <div style={{ position: 'relative' }}>
                <select value={column} onChange={e => setColumn(e.target.value)} style={{ width: '100%', background: 'rgba(5,8,20,0.9)', border: `1.5px solid ${c}50`, borderRadius: 10, padding: '10px 34px 10px 12px', color: 'white', fontSize: '0.83rem', fontWeight: 600, appearance: 'none', cursor: 'pointer', outline: 'none' }}>
                  {columns.map(col => (
                    <option key={col.name} value={col.name} style={{ background: '#0d1220' }}>
                      {col.name} ({col.semanticType})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color={c} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              </div>
            )}
            {selectedColInfo && (
              <p style={{ color: '#475569', fontSize: '0.65rem', marginTop: 5 }}>
                Current avg: {fmt(selectedColInfo.stats?.mean)}
              </p>
            )}
          </div>

          {/* Change type */}
          <div>
            <label style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>Change Type</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['percent', '% Percent'], ['absolute', '± Absolute']].map(([val, lbl]) => (
                <button key={val} onClick={() => setChangeType(val)} style={{
                  flex: 1, padding: '10px 8px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  background: changeType === val ? `linear-gradient(135deg,${c},${c2})` : 'rgba(15,23,42,0.7)',
                  border: `1px solid ${changeType === val ? 'transparent' : 'rgba(51,65,85,0.5)'}`,
                  color: changeType === val ? 'white' : '#64748b',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* Change value */}
          <div>
            <label style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Change Value {changeType === 'percent' ? '(%)' : '(amount)'}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* Quick presets */}
              {(changeType === 'percent' ? [-20, -10, 10, 20] : []).map(v => (
                <button key={v} onClick={() => setChangeValue(v)} style={{
                  padding: '6px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
                  background: changeValue === v ? `${c}30` : 'rgba(15,23,42,0.6)',
                  border: `1px solid ${changeValue === v ? c + '60' : 'rgba(51,65,85,0.4)'}`,
                  color: changeValue === v ? c : '#64748b',
                }}>{v > 0 ? '+' : ''}{v}%</button>
              ))}
            </div>
            <input type="number" value={changeValue} onChange={e => setChangeValue(e.target.value)}
              style={{ marginTop: 8, width: '100%', background: 'rgba(5,8,20,0.9)', border: `1.5px solid ${c}40`, borderRadius: 10, padding: '10px 12px', color: 'white', fontSize: '0.9rem', fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
              placeholder={changeType === 'percent' ? 'e.g. 10 for +10%' : 'e.g. 5000'} />
          </div>

          {/* Group by (optional) */}
          <div>
            <label style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 8 }}>
              Break Down By <span style={{ color: '#334155', fontWeight: 400 }}>(optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ width: '100%', background: 'rgba(5,8,20,0.9)', border: `1.5px solid rgba(51,65,85,0.5)`, borderRadius: 10, padding: '10px 34px 10px 12px', color: groupBy ? 'white' : '#475569', fontSize: '0.83rem', appearance: 'none', cursor: 'pointer', outline: 'none' }}>
                <option value="" style={{ background: '#0d1220' }}>— None —</option>
                {catColumns.map(col => (
                  <option key={col} value={col} style={{ background: '#0d1220' }}>{col}</option>
                ))}
              </select>
              <ChevronDown size={14} color="#475569" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* Run button */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={runSimulation} disabled={loading || !column || loadingCols} style={{
            flex: 1, padding: '13px 24px', borderRadius: 14, border: 'none', cursor: loading || !column ? 'not-allowed' : 'pointer',
            background: !loading && column ? `linear-gradient(135deg,${c},${c2})` : 'rgba(30,41,59,0.5)',
            color: !loading && column ? 'white' : '#334155', fontWeight: 700, fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: !loading && column ? `0 8px 24px ${c}40` : 'none', transition: 'all 0.25s',
          }}>
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Running simulation…</> : <><Play size={15} /> Run Simulation</>}
          </button>
          {result && (
            <button onClick={reset} style={{ padding: '13px 16px', borderRadius: 14, background: 'rgba(51,65,85,0.3)', border: '1px solid rgba(51,65,85,0.4)', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'white' }} onMouseLeave={e => { e.currentTarget.style.color = '#64748b' }}>
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, color: '#fca5a5', fontSize: '0.82rem' }}>
            ⚠ {error}
          </div>
        )}

        {/* ── Results ── */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.4s ease-out' }}>

            {/* Scenario title */}
            <div style={{ padding: '12px 18px', background: `linear-gradient(135deg,${c}15,${c2}08)`, border: `1px solid ${c}30`, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.3rem' }}>📊</span>
              <div>
                <p style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Scenario</p>
                <p style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>{result.scenario}</p>
              </div>
            </div>

            {/* Stat comparisons */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatCompare
                label={`Average ${result.column}`}
                current={result.currentStats.avg}
                simulated={result.simulatedStats.avg}
                delta={result.delta.avg}
                pct={result.delta.pct}
                color={c}
              />
              <StatCompare
                label={`Total ${result.column}`}
                current={result.currentStats.total}
                simulated={result.simulatedStats.total}
                delta={result.delta.total}
                pct={result.delta.pct}
                color={c2}
              />
            </div>

            {/* Chart */}
            <div style={{ padding: '16px', background: 'rgba(5,8,20,0.7)', border: `1px solid ${c}15`, borderRadius: 16 }}>
              <p style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                {result.chartData.type === 'grouped' ? `📊 Breakdown by ${result.chartData.groupBy}` : '📊 Current vs Simulated'}
              </p>
              {result.chartData.type === 'comparison' ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={result.chartData.data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={fmt} />
                    <Tooltip contentStyle={{ background: 'rgba(8,12,28,0.97)', border: `1px solid ${c}40`, borderRadius: 12, color: 'white', fontSize: '0.8rem' }}
                      formatter={v => [fmt(v), result.column]} />
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={80}>
                      <Cell fill={c} />
                      <Cell fill={c2} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, result.chartData.data.length * 36)}>
                  <BarChart data={result.chartData.data} layout="vertical" margin={{ top: 5, right: 80, bottom: 5, left: 90 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={fmt} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={86} />
                    <Tooltip contentStyle={{ background: 'rgba(8,12,28,0.97)', border: `1px solid ${c}40`, borderRadius: 12, color: 'white', fontSize: '0.8rem' }}
                      formatter={(v, name) => [fmt(v), name]} />
                    <Legend wrapperStyle={{ fontSize: '0.72rem', color: '#64748b' }} />
                    <Bar dataKey="current"   name="Current"   fill={c}  fillOpacity={0.7} radius={[0,4,4,0]} />
                    <Bar dataKey="simulated" name="Simulated" fill={c2} fillOpacity={0.9} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* AI Insight */}
            <div style={{ padding: '14px 18px', background: `${c}08`, border: `1px solid ${c}25`, borderLeft: `4px solid ${c}`, borderRadius: 14 }}>
              <p style={{ color: '#64748b', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 8 }}>💡 AI Insight</p>
              <p style={{ color: '#e2e8f0', fontSize: '0.86rem', lineHeight: 1.7 }}>{result.aiInsight}</p>
            </div>

            {/* Business Impacts */}
            <div>
              <p style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>🏢 Business Impact</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.businessImpacts?.map((impact, i) => {
                  const s = IMPACT_STYLE[impact.status] || IMPACT_STYLE.warning
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12 }}>
                      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{s.dot}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: s.color, fontWeight: 700, fontSize: '0.83rem' }}>{impact.label}: </span>
                        <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{impact.reason}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Group breakdown table */}
            {result.groupBreakdown?.length > 0 && (
              <div>
                <p style={{ color: '#475569', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                  📋 Breakdown by {result.chartData.groupBy}
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15,23,42,0.8)' }}>
                        {['Category', 'Current', 'Simulated', 'Δ Change'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', color: '#64748b', fontWeight: 700, textAlign: 'left', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.groupBreakdown.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(51,65,85,0.2)', background: i % 2 === 0 ? 'rgba(15,23,42,0.3)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', color: 'white', fontWeight: 600 }}>{row.name}</td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{fmt(row.current)}</td>
                          <td style={{ padding: '8px 12px', color: c2, fontWeight: 700 }}>{fmt(row.simulated)}</td>
                          <td style={{ padding: '8px 12px', color: row.delta >= 0 ? '#34d399' : '#f87171', fontWeight: 700 }}>
                            {row.delta >= 0 ? '+' : ''}{fmt(row.delta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div style={{ padding: '40px 24px', textAlign: 'center', background: 'rgba(15,23,42,0.4)', border: `1px solid ${c}10`, borderRadius: 16 }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔮</div>
            <p style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', marginBottom: 6 }}>Ready to simulate</p>
            <p style={{ color: '#475569', fontSize: '0.8rem' }}>Select a column, set the change amount, and click Run Simulation.</p>
          </div>
        )}

      </div>
    </div>
  )
}
