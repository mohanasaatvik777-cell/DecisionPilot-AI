import { useState, useRef } from 'react'
import { Send, Sparkles, Loader2, X, ChevronRight, RotateCcw, Info } from 'lucide-react'
import api from '../api'
import ExpandableChartCard from './ExpandableChartCard'
import TrendChart from './charts/TrendChart'
import CategoryChart from './charts/CategoryChart'
import ScatterChart from './charts/ScatterPlot'
import DistributionChart from './charts/DistributionChart'
import MultiTrendChart from './charts/MultiTrendChart'
import AdvancedLineChart from './charts/LineChart'
import AdvancedPieChart from './charts/PieChart'
import KDEChart from './charts/KDEChart'
import DataOverviewCard from './DataOverviewCard'
import ConclusionBanner from './ConclusionBanner'
import {
  LineChart, Line, BarChart, Bar, PieChart as RPieChart, Pie, Cell,
  ScatterChart as RScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, LabelList,
} from 'recharts'

const CHART_COLORS = ['#6366f1','#34d399','#f472b6','#fbbf24','#38bdf8','#a78bfa','#f97316','#10b981','#e879f9','#06b6d4']

const CHIPS = [
  'Show monthly trend', 'Compare by category', 'Top 10 by value',
  'Distribution of data', 'Find correlations', 'Market share breakdown',
  'Show anomalies', 'Average per segment', 'Revenue by region', 'Which performs best?',
]

// ── Detailed axis label helper ────────────────────────────────────────────────
function AxisInfo({ xLabel, yLabel, color }) {
  return (
    <div style={{ display:'flex', gap:16, marginTop:8, padding:'8px 14px', background:'rgba(15,23,42,0.5)', borderRadius:10, border:'1px solid rgba(51,65,85,0.3)', flexWrap:'wrap' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:24, height:3, background:`${color}80`, borderRadius:99 }} />
        <span style={{ color:'#64748b', fontSize:'0.7rem' }}>X-Axis:</span>
        <span style={{ color:'#94a3b8', fontWeight:600, fontSize:'0.75rem' }}>{xLabel || '—'}</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <div style={{ width:3, height:20, background:`${color}80`, borderRadius:99 }} />
        <span style={{ color:'#64748b', fontSize:'0.7rem' }}>Y-Axis:</span>
        <span style={{ color:'#94a3b8', fontWeight:600, fontSize:'0.75rem' }}>{yLabel || '—'}</span>
      </div>
    </div>
  )
}

// ── AI-driven smart chart renderer ────────────────────────────────────────────
function QueryChart({ result, config }) {
  const c = config?.theme?.primary || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'
  const { decision, chartData, query } = result
  const chartType = decision?.chart_type || 'bar'

  if (!chartData?.data?.length) {
    return (
      <div style={{ padding:'32px', textAlign:'center', color:'#475569', fontSize:'0.85rem' }}>
        <div style={{ fontSize:'2rem', marginBottom:8 }}>📭</div>
        No chart data found for this query. Try rephrasing.
      </div>
    )
  }

  const data = chartData.data
  const fmt = v => v >= 1e6 ? (v/1e6).toFixed(2)+'M' : v >= 1e3 ? (v/1e3).toFixed(1)+'K' : Number(v).toLocaleString(undefined,{maximumFractionDigits:2})

  // ── Heatmap ────────────────────────────────────────────────────────────────
  if (chartType === 'heatmap' && chartData.cols) {
    const cols = chartData.cols
    const getVal = (x, y) => data.find(d => d.x === x && d.y === y)?.value ?? 0
    return (
      <div>
        <div style={{ overflowX:'auto', padding:'8px 0' }}>
          <table style={{ borderCollapse:'collapse', margin:'0 auto' }}>
            <thead>
              <tr>
                <th style={{ width:80 }}></th>
                {cols.map(c => <th key={c} style={{ padding:'6px 8px', color:'#94a3b8', fontSize:'0.68rem', textAlign:'center', maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600 }}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {cols.map(row => (
                <tr key={row}>
                  <td style={{ padding:'4px 8px', color:'#94a3b8', fontSize:'0.68rem', textAlign:'right', fontWeight:600 }}>{row}</td>
                  {cols.map(col => {
                    const v = getVal(row, col)
                    const bg = v > 0.5 ? `rgba(52,211,153,${0.2+v*0.7})` : v > 0 ? `rgba(99,102,241,${0.2+v*0.6})` : v < -0.5 ? `rgba(239,68,68,${0.2+Math.abs(v)*0.7})` : 'rgba(51,65,85,0.2)'
                    return (
                      <td key={col} title={`${row} × ${col} = ${v}`} style={{ width:64, height:48, background:bg, border:'1px solid rgba(15,23,42,0.5)', textAlign:'center', color:'white', fontWeight:700, fontSize:'0.68rem', cursor:'default', transition:'all 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.outline = `2px solid ${c}`}
                        onMouseLeave={e => e.currentTarget.style.outline = 'none'}>
                        {v.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ color:'#475569', fontSize:'0.68rem', textAlign:'center', marginTop:10 }}>
          🟢 Strong positive · 🔵 Weak positive · 🔴 Negative correlation
        </p>
        <AxisInfo xLabel="All numeric columns" yLabel="Pearson correlation coefficient" color={c} />
      </div>
    )
  }

  // ── Pie / Donut ────────────────────────────────────────────────────────────
  if (['pie','donut'].includes(chartType)) {
    const total = data.reduce((s,d) => s + d.value, 0)
    const RADIAN = Math.PI / 180
    const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name, value }) => {
      const radius = innerRadius + (outerRadius - innerRadius) * 1.35
      const x = cx + radius * Math.cos(-midAngle * RADIAN)
      const y = cy + radius * Math.sin(-midAngle * RADIAN)
      const pct = ((value/total)*100).toFixed(1)
      return pct > 3 ? <text x={x} y={y} fill="#94a3b8" fontSize={11} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">{name} {pct}%</text> : null
    }
    return (
      <div>
        <ResponsiveContainer width="100%" height={320}>
          <RPieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius={chartType==='donut' ? 70 : 0} outerRadius={120}
              paddingAngle={3} labelLine={false} label={renderLabel}>
              {data.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />)}
            </Pie>
            <Tooltip formatter={(v,n) => [fmt(v), n]} contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem', boxShadow:`0 8px 24px rgba(0,0,0,0.5)` }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize:'0.75rem', color:'#64748b', paddingTop:8 }} />
          </RPieChart>
        </ResponsiveContainer>
        <AxisInfo xLabel={`${data.length} categories`} yLabel={`${chartData.label} — Total: ${fmt(total)}`} color={c} />
      </div>
    )
  }

  // ── Scatter ────────────────────────────────────────────────────────────────
  if (chartType === 'scatter') {
    return (
      <div>
        <ResponsiveContainer width="100%" height={320}>
          <RScatterChart margin={{ top:10, right:24, bottom:40, left:20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
            <XAxis dataKey="x" name={chartData.xLabel} tick={{ fill:'#64748b', fontSize:11 }}
              label={{ value: chartData.xLabel, position:'insideBottom', offset:-20, fill:'#475569', fontSize:11 }} />
            <YAxis dataKey="y" name={chartData.yLabel} tick={{ fill:'#64748b', fontSize:11 }}
              tickFormatter={fmt}
              label={{ value: chartData.yLabel, angle:-90, position:'insideLeft', fill:'#475569', fontSize:11, dy:60 }} />
            <Tooltip cursor={{ stroke:`${c}40`, strokeDasharray:'4 4' }}
              contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem' }}
              formatter={(v, n) => [fmt(v), n]} />
            <Scatter data={data} fill={c} fillOpacity={0.75} stroke={c} strokeWidth={0.5}
              shape={p => <circle {...p} r={5} style={{ cursor:'pointer' }} />} />
          </RScatterChart>
        </ResponsiveContainer>
        <AxisInfo xLabel={chartData.xLabel} yLabel={chartData.yLabel} color={c} />
      </div>
    )
  }

  // ── Histogram ─────────────────────────────────────────────────────────────
  if (chartType === 'histogram') {
    return (
      <div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top:10, right:24, bottom:50, left:20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
            <XAxis dataKey="range" tick={{ fill:'#64748b', fontSize:9 }} angle={-35} textAnchor="end" height={60}
              label={{ value: chartData.label, position:'insideBottom', offset:-38, fill:'#475569', fontSize:11 }} />
            <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={v=>v}
              label={{ value: 'Frequency', angle:-90, position:'insideLeft', fill:'#475569', fontSize:11, dy:40 }} />
            <Tooltip contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem' }} formatter={v=>[v,'Count']} />
            <Bar dataKey="count" radius={[4,4,0,0]} maxBarSize={50}>
              {data.map((_,i) => <Cell key={i} fill={`${c}${60+i*10 > 99 ? '99' : 60+i*10}`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <AxisInfo xLabel={`${chartData.label} range buckets`} yLabel="Number of records in each range" color={c} />
      </div>
    )
  }

  // ── Horizontal Bar (ranking) ────────────────────────────────────────────────
  if (chartType === 'horizontalBar') {
    const maxVal = Math.max(...data.map(d=>d.value))
    return (
      <div>
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 38)}>
          <BarChart data={data} layout="vertical" margin={{ top:5, right:80, bottom:10, left:100 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" horizontal={false} />
            <XAxis type="number" tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmt}
              label={{ value: chartData.label, position:'insideBottom', offset:-4, fill:'#475569', fontSize:11 }} />
            <YAxis type="category" dataKey="name" tick={{ fill:'#94a3b8', fontSize:10 }} width={96} />
            <Tooltip contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem' }}
              formatter={v=>[fmt(v), chartData.label]} />
            <Bar dataKey="value" radius={[0,8,8,0]}>
              {data.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
              <LabelList dataKey="value" position="right" style={{ fill:'#94a3b8', fontSize:10 }} formatter={fmt} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <AxisInfo xLabel={chartData.label} yLabel={`${data.length} categories ranked`} color={c} />
      </div>
    )
  }

  // ── Line / Area / Trend ────────────────────────────────────────────────────
  if (['line','area','trend'].includes(chartType)) {
    return (
      <div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top:10, right:24, bottom:40, left:20 }}>
            <defs>
              <linearGradient id="ovGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c} stopOpacity={0.35} />
                <stop offset="95%" stopColor={c} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
            <XAxis dataKey={chartData.xKey} tick={{ fill:'#64748b', fontSize:10 }}
              tickFormatter={v => v?.slice?.(0,7) ?? v} angle={-25} textAnchor="end" height={50}
              label={{ value: chartData.xKey?.replace('_',' '), position:'insideBottom', offset:-36, fill:'#475569', fontSize:11 }} />
            <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmt}
              label={{ value: chartData.label, angle:-90, position:'insideLeft', fill:'#475569', fontSize:11, dy:50 }} />
            <Tooltip contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem' }}
              formatter={v=>[fmt(v), chartData.label]} labelFormatter={l=>`📅 ${l}`} />
            <Area type="monotone" dataKey={chartData.yKey} stroke={c} strokeWidth={2.5}
              fill="url(#ovGrad)" dot={false} activeDot={{ r:6, fill:c, stroke:'white', strokeWidth:2 }} />
          </AreaChart>
        </ResponsiveContainer>
        <AxisInfo xLabel={`Time period (${chartData.xKey})`} yLabel={`${chartData.label} — aggregated per period`} color={c} />
      </div>
    )
  }

  // ── Default Bar chart ──────────────────────────────────────────────────────
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top:10, right:24, bottom:55, left:20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" />
          <XAxis dataKey={chartData.xKey} tick={{ fill:'#64748b', fontSize:10 }} angle={-35} textAnchor="end" height={65}
            label={{ value: chartData.xKey?.replace('_',' '), position:'insideBottom', offset:-48, fill:'#475569', fontSize:11 }} />
          <YAxis tick={{ fill:'#64748b', fontSize:11 }} tickFormatter={fmt}
            label={{ value: chartData.label, angle:-90, position:'insideLeft', fill:'#475569', fontSize:11, dy:50 }} />
          <Tooltip contentStyle={{ background:'rgba(8,12,28,0.97)', border:`1px solid ${c}40`, borderRadius:12, color:'white', fontSize:'0.8rem' }}
            formatter={v=>[fmt(v), chartData.label]} />
          <Bar dataKey={chartData.yKey} radius={[6,6,0,0]} maxBarSize={52}>
            {data.map((_,i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}
            <LabelList dataKey={chartData.yKey} position="top" style={{ fill:'#64748b', fontSize:9 }} formatter={fmt} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <AxisInfo xLabel={chartData.xKey?.replace('_',' ')} yLabel={`${chartData.label} — ${decision?.aggregation || 'sum'} per category`} color={c} />
    </div>
  )
}

// ── Query Result Card ─────────────────────────────────────────────────────────
function QueryResultCard({ result, config, onFollowUp, onClear }) {
  const c = config?.theme?.primary || '#6366f1'
  const { decision, query } = result
  const chartType = decision?.chart_type || 'bar'

  const CHART_LABEL = {
    line:'📈 Line Chart — Trend Over Time', area:'📈 Area Chart — Trend Over Time',
    trend:'📈 Trend Chart', bar:'📊 Bar Chart — Category Comparison',
    horizontalBar:'📊 Horizontal Bar — Ranked Categories',
    pie:'🥧 Pie Chart — Market Share', donut:'🍩 Donut Chart — Composition',
    scatter:'🔵 Scatter Plot — Correlation', histogram:'📊 Histogram — Distribution',
    heatmap:'🔲 Heatmap — Correlation Matrix',
  }

  return (
    <div className="animate-slide-up" style={{
      background: 'rgba(8,12,28,0.96)', borderRadius: 22, overflow: 'hidden',
      border: `1px solid ${c}30`, boxShadow: `0 12px 48px ${c}15`,
    }}>
      {/* Card header */}
      <div style={{ padding:'16px 22px', background:`linear-gradient(135deg,${c}18,transparent)`, borderBottom:`1px solid ${c}15`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:`linear-gradient(135deg,${c},${config?.theme?.secondary||'#8b5cf6'})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', boxShadow:`0 4px 16px ${c}40` }}>
            {chartType==='line'||chartType==='area'||chartType==='trend' ? '📈' : chartType==='pie'||chartType==='donut' ? '🥧' : chartType==='scatter' ? '🔵' : chartType==='histogram' ? '📊' : chartType==='heatmap' ? '🔲' : chartType==='horizontalBar' ? '📊' : '📊'}
          </div>
          <div>
            <p style={{ color:'white', fontWeight:700, fontSize:'0.9rem', margin:0, letterSpacing:'-0.01em' }}>"{query}"</p>
            <p style={{ color:'#475569', fontSize:'0.68rem', margin:0 }}>
              {CHART_LABEL[chartType] || chartType} ·{' '}
              {decision?.metric && <span>Y: <b style={{color:c}}>{decision.metric}</b></span>}
              {decision?.dimension && <span> · X: <b style={{color:'#94a3b8'}}>{decision.dimension}</b></span>}
              {decision?.aggregation && <span> · {decision.aggregation}</span>}
              · {result.source === 'claude' ? '✨ Claude AI' : '⚡ Smart Engine'}
              {result.forcedChartType && <span style={{color:'#fbbf24'}}> · 📌 User-specified chart</span>}
              {!result.forcedChartType && <span style={{color:'#34d399'}}> · 🤖 Auto-selected</span>}
            </p>
          </div>
        </div>
        <button onClick={onClear} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 11px', background:'rgba(51,65,85,0.4)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:9, color:'#64748b', fontSize:'0.72rem', cursor:'pointer', transition:'all 0.2s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(239,68,68,0.12)';e.currentTarget.style.color='#f87171'}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(51,65,85,0.4)';e.currentTarget.style.color='#64748b'}}>
          <X size={11} /> Clear
        </button>
      </div>

      <div style={{ padding:'20px 22px' }}>

        {/* ── Chart ── */}
        <div style={{ background:'rgba(5,8,20,0.7)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:16, padding:'18px 14px', marginBottom:16 }}>
          <QueryChart result={result} config={config} />
        </div>

        {/* ── Executive Summary ── */}
        {decision?.executive_summary && (
          <div style={{ padding:'14px 18px', background:`${c}0a`, border:`1px solid ${c}20`, borderRadius:14, borderLeft:`4px solid ${c}`, marginBottom:14 }}>
            <p style={{ color:'#64748b', fontSize:'0.63rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:6 }}>📋 Executive Summary</p>
            <p style={{ color:'#e2e8f0', fontSize:'0.86rem', lineHeight:1.7, margin:0 }}>{decision.executive_summary}</p>
          </div>
        )}

        {/* ── Insights + Why + Follow-ups ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:12 }}>

          {/* Insights */}
          {decision?.insights?.length > 0 && (
            <div style={{ background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:14, padding:'14px 16px' }}>
              <p style={{ color:'#64748b', fontSize:'0.63rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:10 }}>💡 Key Insights</p>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {decision.insights.map((ins,i) => (
                  <div key={i} style={{ display:'flex', gap:9, padding:'8px 10px', background:`${c}08`, border:`1px solid ${c}15`, borderRadius:10 }}>
                    <span style={{ color:c, fontWeight:800, fontSize:'0.68rem', flexShrink:0, marginTop:2 }}>0{i+1}</span>
                    <p style={{ color:'#cbd5e1', fontSize:'0.8rem', lineHeight:1.6, margin:0 }}>{ins}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Why this chart */}
            {decision?.reason && (
              <div style={{ padding:'12px 14px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.18)', borderRadius:14 }}>
                <p style={{ color:'#64748b', fontSize:'0.63rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:6 }}>🎯 Why This Chart</p>
                <p style={{ color:'#fcd34d', fontSize:'0.8rem', lineHeight:1.6, margin:0 }}>{decision.reason}</p>
              </div>
            )}

            {/* Follow-up chips */}
            {decision?.follow_ups?.length > 0 && (
              <div style={{ padding:'12px 14px', background:'rgba(15,23,42,0.5)', border:'1px solid rgba(51,65,85,0.3)', borderRadius:14 }}>
                <p style={{ color:'#64748b', fontSize:'0.63rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:8 }}>🔍 Try next</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {decision.follow_ups.map((q,i) => (
                    <button key={i} onClick={() => onFollowUp(q)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 11px', background:`${c}08`, border:`1px solid ${c}18`, borderRadius:9, color:'#94a3b8', fontSize:'0.76rem', cursor:'pointer', textAlign:'left', transition:'all 0.2s' }}
                      onMouseEnter={e=>{e.currentTarget.style.background=`${c}20`;e.currentTarget.style.color='white';e.currentTarget.style.borderColor=`${c}45`}}
                      onMouseLeave={e=>{e.currentTarget.style.background=`${c}08`;e.currentTarget.style.color='#94a3b8';e.currentTarget.style.borderColor=`${c}18`}}>
                      <ChevronRight size={11} color={c} style={{flexShrink:0}} />{q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Default charts (shown when no query entered) ──────────────────────────────
function DefaultCharts({ chartData, hasData, config, insights, analysisData, uploadData }) {
  const c = config?.theme?.primary || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      <DataOverviewCard analysisData={analysisData} insights={insights} config={config} uploadData={uploadData} />

      {(hasData.trend || hasData.category) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap:20 }}>
          {hasData.trend && <ExpandableChartCard title="📈 Trend Over Time" subtitle="How values change over time" color={c}><TrendChart data={chartData.trend} color={c} /></ExpandableChartCard>}
          {hasData.category && <ExpandableChartCard title="🗂️ Category Breakdown" subtitle="Top categories by value" color={c2}><CategoryChart data={chartData.categoryBreakdown} /></ExpandableChartCard>}
        </div>
      )}
      {(hasData.trend || hasData.category) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap:20 }}>
          {hasData.trend && <ExpandableChartCard title="〰️ Line Chart" subtitle="Smooth trend line" color="#38bdf8"><AdvancedLineChart data={chartData.trend} color="#38bdf8" /></ExpandableChartCard>}
          {hasData.category && <ExpandableChartCard title="🥧 Donut Chart" subtitle="Part-to-whole share" color="#a78bfa"><AdvancedPieChart data={chartData.categoryBreakdown} /></ExpandableChartCard>}
        </div>
      )}
      {hasData.dist && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap:20 }}>
          <ExpandableChartCard title="📊 Distribution" subtitle="How values are spread" color="#34d399"><DistributionChart data={chartData.distribution} /></ExpandableChartCard>
          <ExpandableChartCard title="〽️ KDE Density" subtitle="Density with mean & σ bands" color="#f472b6"><KDEChart data={chartData.distribution} color="#f472b6" /></ExpandableChartCard>
        </div>
      )}
      {(hasData.scatter || hasData.multiTrend) && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap:20 }}>
          {hasData.scatter && <ExpandableChartCard title="🔵 Correlation Scatter" subtitle="Relationship between two metrics" color="#34d399"><ScatterChart data={chartData.scatter} /></ExpandableChartCard>}
          {hasData.multiTrend && <ExpandableChartCard title="📉 Multi-Metric Trend" subtitle="Compare multiple metrics over time" color={c}><MultiTrendChart data={chartData.multiTrend} /></ExpandableChartCard>}
        </div>
      )}
      {!hasData.trend && !hasData.category && !hasData.dist && !hasData.scatter && (
        <div style={{ padding:48, textAlign:'center', background:'rgba(15,23,42,0.4)', borderRadius:20, border:'1px solid rgba(51,65,85,0.3)' }}>
          <div style={{ fontSize:'3rem', marginBottom:12 }}>📊</div>
          <p style={{ color:'#475569', fontWeight:500 }}>No chart data available</p>
          <p style={{ color:'#334155', fontSize:'0.82rem', marginTop:6 }}>Dataset needs at least one numeric column.</p>
        </div>
      )}
      <ConclusionBanner analysisData={analysisData} hasData={hasData} config={config} />
    </div>
  )
}

// ── Main OverviewTab export — shows all charts, no query input ────────────────
export default function OverviewTab({ analysisData, insights, config, uploadData, hasData, chartData, c, c2 }) {
  return (
    <DefaultCharts
      chartData={chartData}
      hasData={hasData}
      config={config}
      insights={insights}
      analysisData={analysisData}
      uploadData={uploadData}
    />
  )
}
