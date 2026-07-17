import { useState, useEffect, useRef } from 'react'
import { ArrowRight, Sparkles, Loader2, ChevronDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import api from '../api'
import { validateIndustryMatch } from '../utils/validateIndustryMatch'
import { INDUSTRY_CONFIGS } from '../config/industryConfigs'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Sector,
  ScatterChart, Scatter, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'

const COLORS = ['#6366f1','#34d399','#f472b6','#fbbf24','#38bdf8','#a78bfa','#f97316','#10b981','#e879f9','#06b6d4']
const fmt = v => {
  if (v == null) return ''
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(1)+'M'
  if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(1)+'K'
  return Number(v).toLocaleString(undefined,{maximumFractionDigits:2})
}

// ── Bright white tooltip for all charts ───────────────────────────────────────
const BRIGHT_TOOLTIP = {
  background: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)',
  border: '2px solid #6366f1',
  borderRadius: 16,
  color: '#0f172a',
  fontSize: '0.95rem',
  fontWeight: 800,
  boxShadow: '0 20px 60px rgba(99,102,241,0.35), 0 4px 20px rgba(0,0,0,0.15)',
  padding: '12px 20px',
  letterSpacing: '-0.01em',
}
const brightFormatter = (value, name) => [fmt(value), name]

// ── Error / not-possible display ──────────────────────────────────────────────
function ChartError({ chartType, reason }) {
  const reasons = {
    multiLine: 'Multi-Line chart requires a Date column. Your dataset has no date column.',
    kde:       'KDE Density requires at least 5 numeric values.',
    scatter:   'Scatter plot requires at least 2 numeric columns.',
    heatmap:   'Heatmap requires at least 2 numeric columns.',
    line:      'Line chart requires a Date or time column.',
    area:      'Area chart requires a Date or time column.',
    default:   `Cannot generate ${chartType} chart with the selected fields.`,
  }
  return (
    <div style={{ padding:'32px 24px', textAlign:'center', background:'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:16, margin:'8px' }}>
      <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
        <AlertTriangle size={24} color="#f87171" />
      </div>
      <p style={{ color:'#fca5a5', fontWeight:700, fontSize:'0.95rem', marginBottom:8 }}>Chart Not Available</p>
      <p style={{ color:'#64748b', fontSize:'0.82rem', lineHeight:1.6 }}>{reason || reasons[chartType] || reasons.default}</p>
    </div>
  )
}

// ── Smart chart renderer ──────────────────────────────────────────────────────
function ChartPreview({ chartData, chartType, color, notGenerated }) {
  const c = color || '#6366f1'

  if (notGenerated) return (
    <div style={{ padding:'40px 24px', textAlign:'center' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:12 }}>📊</div>
      <p style={{ color:'#475569', fontSize:'0.85rem' }}>Configure fields and click <strong style={{color:'#94a3b8'}}>Generate Chart</strong></p>
    </div>
  )

  if (!chartData || chartData.error) return <ChartError chartType={chartType} reason={chartData?.error} />
  if (!chartData.data?.length) return <ChartError chartType={chartType} />

  const data = chartData.data

  // ── Heatmap ────────────────────────────────────────────────────────────────
  if (chartType === 'heatmap' && chartData.cols) {
    const cols = chartData.cols
    const getV = (x,y) => data.find(d=>d.x===x&&d.y===y)?.value ?? 0
    return (
      <div style={{ overflowX:'auto', padding:'8px 4px' }}>
        <table style={{ borderCollapse:'collapse', margin:'0 auto', fontSize:'0.7rem' }}>
          <thead><tr>
            <th style={{width:80,padding:'4px 8px'}}/>
            {cols.map(col=><th key={col} style={{padding:'6px',color:'#64748b',textAlign:'center',maxWidth:72,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{col}</th>)}
          </tr></thead>
          <tbody>{cols.map(row=>(
            <tr key={row}>
              <td style={{padding:'4px 8px',color:'#64748b',textAlign:'right',fontWeight:600,fontSize:'0.65rem'}}>{row}</td>
              {cols.map(col=>{
                const v=getV(row,col)
                const bg=v>0.6?`rgba(52,211,153,${0.2+v*0.75})`:v>0?`rgba(99,102,241,${0.1+v*0.6})`:v<-0.6?`rgba(239,68,68,${0.2+Math.abs(v)*0.75})`:'rgba(51,65,85,0.15)'
                return <td key={col} title={`${row} × ${col} = ${v}`} style={{width:60,height:44,background:bg,border:'1px solid rgba(15,23,42,0.4)',textAlign:'center',color:'white',fontWeight:700,fontSize:'0.62rem',transition:'all 0.2s',cursor:'default'}}>{v.toFixed(2)}</td>
              })}
            </tr>
          ))}</tbody>
        </table>
        <div style={{textAlign:'center',marginTop:10,display:'flex',justifyContent:'center',gap:16}}>
          {[['🟢','Strong +ve (>0.6)'],['🔵','Weak +ve (0–0.6)'],['🔴','Negative (<0)']].map(([e,l])=>(
            <span key={l} style={{color:'#475569',fontSize:'0.65rem'}}>{e} {l}</span>
          ))}
        </div>
      </div>
    )
  }

  // ── Multi-line ─────────────────────────────────────────────────────────────
  if (chartType === 'multiLine' && chartData.keys?.length) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{top:10,right:16,bottom:40,left:10}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
          <XAxis dataKey="date" tick={{fill:'#64748b',fontSize:9}} tickFormatter={v=>v?.slice?.(0,7)??v} angle={-25} textAnchor="end" height={50}/>
          <YAxis tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}/>
          <Tooltip contentStyle={BRIGHT_TOOLTIP} formatter={v=>[fmt(v)]}/>
          <Legend wrapperStyle={{fontSize:'0.72rem',color:'#64748b',paddingTop:8}}/>
          {chartData.keys.map((key,i)=>(
            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i%COLORS.length]} strokeWidth={2} dot={false} activeDot={{r:4}}/>
          ))}
        </LineChart>
      </ResponsiveContainer>
    )
  }
  if (chartType === 'multiLine') return <ChartError chartType="multiLine" />

  // ── KDE smooth curve ───────────────────────────────────────────────────────
  if (chartType === 'kde') {
    return (
      <div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{top:10,right:16,bottom:40,left:10}}>
            <defs>
              <linearGradient id="kdeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={c} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={c} stopOpacity={0.02}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
            <XAxis dataKey="x" tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
              label={{value:chartData.label,position:'insideBottom',offset:-28,fill:'#475569',fontSize:11}}/>
            <YAxis tick={{fill:'#64748b',fontSize:9}}
              label={{value:'Density',angle:-90,position:'insideLeft',fill:'#475569',fontSize:10,dy:30}}/>
            <Tooltip contentStyle={{background:'rgba(8,12,28,0.97)',border:`1px solid ${c}40`,borderRadius:12,color:'white',fontSize:'0.78rem'}}
              formatter={v=>[v.toFixed(6),'Density']} labelFormatter={v=>`Value: ${fmt(v)}`}/>
            <Area type="monotone" dataKey="density" stroke={c} strokeWidth={2.5} fill="url(#kdeGrad)" dot={false} activeDot={{r:5,fill:c}}/>
          </AreaChart>
        </ResponsiveContainer>
        {chartData.mean != null && (
          <div style={{display:'flex',gap:16,justifyContent:'center',marginTop:8,flexWrap:'wrap'}}>
            <span style={{color:'#64748b',fontSize:'0.7rem'}}>Mean: <b style={{color:'#34d399'}}>{fmt(chartData.mean)}</b></span>
            <span style={{color:'#64748b',fontSize:'0.7rem'}}>Bandwidth: <b style={{color:'#a78bfa'}}>{chartData.bandwidth}</b></span>
          </div>
        )}
      </div>
    )
  }

  // ── Pie / Donut ────────────────────────────────────────────────────────────
  if (['pie','donut'].includes(chartType)) {
    const total = data.reduce((s,d)=>s+d.value,0)
    const RADIAN = Math.PI/180
    const [activeIdx, setActiveIdx] = useState(-1)

    // Show labels for slices > 5% — others shown in tooltip on hover
    const renderLabel = ({cx,cy,midAngle,innerRadius,outerRadius,name,percent}) => {
      const pct = (percent*100).toFixed(1)
      if (percent < 0.05) return null
      const r = innerRadius+(outerRadius-innerRadius)*1.45
      const x = cx+r*Math.cos(-midAngle*RADIAN)
      const y = cy+r*Math.sin(-midAngle*RADIAN)
      return (
        <text x={x} y={y} fill="#e2e8f0" fontSize={11} fontWeight={600}
          textAnchor={x>cx?'start':'end'} dominantBaseline="central">
          {name.length>10?name.slice(0,10)+'…':name} {pct}%
        </text>
      )
    }

    // Active shape — expands the hovered slice
    const renderActiveShape = (props) => {
      const { cx,cy,innerRadius,outerRadius,startAngle,endAngle,fill,name,value,percent } = props
      return (
        <g>
          <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius+10}
            startAngle={startAngle} endAngle={endAngle} fill={fill}
            style={{filter:`drop-shadow(0 0 12px ${fill}80)`,cursor:'pointer'}}/>
          {chartType==='donut' && (
            <text x={cx} y={cy-8} textAnchor="middle" fill="white" fontSize={13} fontWeight={800}>{name}</text>
          )}
          {chartType==='donut' && (
            <text x={cx} y={cy+12} textAnchor="middle" fill="#94a3b8" fontSize={11}>{fmt(value)} ({(percent*100).toFixed(1)}%)</text>
          )}
        </g>
      )
    }

    const CustomTooltip = ({active,payload}) => {
      if (!active||!payload?.length) return null
      const d = payload[0]
      return (
        <div style={{background:'white',border:`2px solid ${d.payload.fill||'#6366f1'}`,borderRadius:14,padding:'12px 18px',boxShadow:'0 8px 32px rgba(0,0,0,0.2)',minWidth:160}}>
          <div style={{color:d.payload.fill||'#6366f1',fontWeight:800,fontSize:'0.85rem',marginBottom:4}}>{d.name}</div>
          <div style={{color:'#0f172a',fontWeight:900,fontSize:'1.3rem',lineHeight:1}}>{fmt(d.value)}</div>
          <div style={{color:'#475569',fontWeight:700,fontSize:'0.85rem',marginTop:4}}>
            {((d.value/total)*100).toFixed(1)}% of total
          </div>
          <div style={{color:'#94a3b8',fontSize:'0.72rem',marginTop:2}}>Total: {fmt(total)}</div>
        </div>
      )
    }

    return (
      <div>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value" nameKey="name"
              cx="50%" cy="48%"
              innerRadius={chartType==='donut'?72:0}
              outerRadius={115}
              paddingAngle={2}
              label={renderLabel}
              labelLine={false}
              activeIndex={activeIdx}
              activeShape={renderActiveShape}
              onMouseEnter={(_,idx)=>setActiveIdx(idx)}
              onMouseLeave={()=>setActiveIdx(-1)}
            >
              {data.map((_,i)=>(
                <Cell key={i} fill={COLORS[i%COLORS.length]}
                  stroke="rgba(255,255,255,0.15)" strokeWidth={1}
                  style={{cursor:'pointer',transition:'all 0.2s'}}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip/>}/>
            <Legend
              iconType="circle" iconSize={10}
              layout="horizontal" verticalAlign="bottom" align="center"
              wrapperStyle={{fontSize:'0.72rem',color:'#94a3b8',paddingTop:10,lineHeight:'1.8rem'}}
              formatter={(value) => (
                <span style={{color:'#94a3b8',fontSize:'0.72rem',marginRight:8}}>
                  {value.length>14?value.slice(0,14)+'…':value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    )
  }

  // ── Scatter ────────────────────────────────────────────────────────────────
  if (chartType==='scatter') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{top:10,right:16,bottom:40,left:16}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
          <XAxis dataKey="x" name={chartData.xLabel} tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
            label={{value:chartData.xLabel,position:'insideBottom',offset:-26,fill:'#475569',fontSize:11}}/>
          <YAxis dataKey="y" name={chartData.yLabel} tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
            label={{value:chartData.yLabel,angle:-90,position:'insideLeft',fill:'#475569',fontSize:11,dy:50}}/>
          <Tooltip contentStyle={BRIGHT_TOOLTIP}/>
          <Scatter data={data} fill={c} fillOpacity={0.75}/>
        </ScatterChart>
      </ResponsiveContainer>
    )
  }

  // ── Histogram ─────────────────────────────────────────────────────────────
  if (chartType==='histogram') {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{top:10,right:16,bottom:50,left:16}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
          <XAxis dataKey="range" tick={{fill:'#64748b',fontSize:8}} angle={-35} textAnchor="end" height={58}
            label={{value:chartData.label,position:'insideBottom',offset:-44,fill:'#475569',fontSize:11}}/>
          <YAxis tick={{fill:'#64748b',fontSize:10}}
            label={{value:'Frequency',angle:-90,position:'insideLeft',fill:'#475569',fontSize:10,dy:38}}/>
          <Tooltip contentStyle={BRIGHT_TOOLTIP} formatter={v=>[v,'Count']}
            itemStyle={{color:'#6366f1',fontWeight:800,fontSize:'1rem'}} labelStyle={{color:'#475569',fontWeight:600}}/>
          <Bar dataKey="count" radius={[4,4,0,0]}>{data.map((_,i)=><Cell key={i} fill={`${c}`} fillOpacity={0.5+i/data.length*0.5}/>)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Horizontal Bar ─────────────────────────────────────────────────────────
  if (chartType==='horizontalBar') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(220,data.length*34)}>
        <BarChart data={data} layout="vertical" margin={{top:5,right:64,bottom:5,left:90}}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)" horizontal={false}/>
          <XAxis type="number" tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
            label={{value:chartData.label,position:'insideBottom',offset:-4,fill:'#475569',fontSize:11}}/>
          <YAxis type="category" dataKey="name" tick={{fill:'#94a3b8',fontSize:9}} width={86}/>
          <Tooltip contentStyle={BRIGHT_TOOLTIP} formatter={v=>[fmt(v),chartData.label]}
            itemStyle={{color:'#6366f1',fontWeight:800,fontSize:'1rem'}} labelStyle={{color:'#475569',fontWeight:600}}/>
          <Bar dataKey="value" radius={[0,8,8,0]}>
            {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
            <LabelList dataKey="value" position="right" style={{fill:'#94a3b8',fontSize:9}} formatter={fmt}/>
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Line / Area ────────────────────────────────────────────────────────────
  if (['line','area','trend'].includes(chartType)) {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{top:10,right:16,bottom:44,left:16}}>
          <defs><linearGradient id="gcLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={c} stopOpacity={0.35}/>
            <stop offset="95%" stopColor={c} stopOpacity={0.02}/>
          </linearGradient></defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
          <XAxis dataKey={chartData.xKey} tick={{fill:'#64748b',fontSize:9}} tickFormatter={v=>v?.slice?.(0,7)??v} angle={-25} textAnchor="end" height={52}
            label={{value:chartData.xKey?.replace('_',' '),position:'insideBottom',offset:-40,fill:'#475569',fontSize:11}}/>
          <YAxis tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
            label={{value:chartData.label,angle:-90,position:'insideLeft',fill:'#475569',fontSize:11,dy:50}}/>
          <Tooltip contentStyle={BRIGHT_TOOLTIP}
            formatter={v=>[fmt(v),chartData.label]} labelFormatter={l=>`📅 ${l}`}
            itemStyle={{color:'#6366f1',fontWeight:800,fontSize:'1rem'}} labelStyle={{color:'#475569',fontWeight:600}}/>
          <Area type="monotone" dataKey={chartData.yKey} stroke={c} strokeWidth={2.5} fill="url(#gcLine)" dot={false} activeDot={{r:6,fill:c,stroke:'white',strokeWidth:2}}/>
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  // ── Default Bar ────────────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{top:10,right:16,bottom:54,left:16}}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.3)"/>
        <XAxis dataKey={chartData.xKey} tick={{fill:'#64748b',fontSize:9}} angle={-35} textAnchor="end" height={62}
          label={{value:chartData.xKey?.replace('_',' '),position:'insideBottom',offset:-48,fill:'#475569',fontSize:11}}/>
        <YAxis tick={{fill:'#64748b',fontSize:10}} tickFormatter={fmt}
          label={{value:chartData.label,angle:-90,position:'insideLeft',fill:'#475569',fontSize:11,dy:50}}/>
        <Tooltip contentStyle={BRIGHT_TOOLTIP} formatter={v=>[fmt(v),chartData.label]}/>
        <Bar dataKey={chartData.yKey} radius={[6,6,0,0]} maxBarSize={52}>
          {data.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Field select — reliable native select with custom styling ─────────────────
function FieldSelect({ field, options, value, onChange, color }) {
  const c = color || '#6366f1'

  if (field.key === 'note') return (
    <div style={{ padding:'10px 14px', background:`${c}10`, border:`1px solid ${c}20`, borderRadius:10, color:'#94a3b8', fontSize:'0.78rem' }}>
      ℹ️ {options[0] || 'Auto-configured from all numeric columns'}
    </div>
  )

  // Multi-select chips (unchanged)
  if (field.multi) {
    const sel = Array.isArray(value) ? value : []
    return (
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {options.map(opt => {
          const on = sel.includes(opt)
          return (
            <button key={opt} onClick={() => onChange(on ? sel.filter(s=>s!==opt) : [...sel,opt])}
              style={{ padding:'6px 14px', borderRadius:99, fontSize:'0.76rem', fontWeight:600, cursor:'pointer', transition:'all 0.2s',
                background:on?`${c}22`:'rgba(15,23,42,0.7)', border:`1px solid ${on?c+'60':'rgba(51,65,85,0.5)'}`, color:on?'white':'#64748b',
                boxShadow:on?`0 0 12px ${c}30`:'none' }}>
              {on && '✓ '}{opt}
            </button>
          )
        })}
        {sel.length > 0 && <span style={{color:'#64748b',fontSize:'0.68rem',alignSelf:'center'}}>{sel.length} selected</span>}
      </div>
    )
  }

  // Native select — works reliably on all devices
  return (
    <div style={{ position:'relative' }}>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width:'100%',
          background: value ? 'rgba(5,8,20,0.95)' : 'rgba(5,8,20,0.7)',
          border: `1.5px solid ${value ? c+'70' : 'rgba(51,65,85,0.5)'}`,
          borderRadius: 11,
          padding: '11px 38px 11px 14px',
          color: value ? 'white' : '#475569',
          fontSize: '0.83rem',
          fontWeight: value ? 600 : 400,
          appearance: 'none',
          WebkitAppearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.2s',
          boxShadow: value ? `0 0 0 2px ${c}20` : 'none',
        }}
        onFocus={e => { e.target.style.boxShadow = `0 0 0 3px ${c}30`; e.target.style.borderColor = `${c}80` }}
        onBlur={e  => { e.target.style.boxShadow = value ? `0 0 0 2px ${c}20` : 'none'; e.target.style.borderColor = value ? `${c}70` : 'rgba(51,65,85,0.5)' }}
      >
        <option value="" style={{ background:'#0d1220', color:'#475569' }}>
          — Select {field.label} —
        </option>
        {options.map(opt => (
          <option key={opt} value={opt} style={{ background:'#0d1220', color:'white', fontWeight: opt === value ? 700 : 400 }}>
            {opt}
          </option>
        ))}
      </select>
      {/* Custom chevron */}
      <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', display:'flex', alignItems:'center' }}>
        <ChevronDown size={15} color={value ? c : '#475569'} />
      </div>
    </div>
  )
}

// ── Chart type pill ───────────────────────────────────────────────────────────
function ChartPill({ chartKey, def, isSelected, onSelect, color }) {
  const c = color || '#6366f1'
  return (
    <button onClick={() => onSelect(chartKey)} style={{
      display:'flex', alignItems:'center', gap:9, padding:'10px 16px',
      borderRadius:12, cursor:'pointer', transition:'all 0.22s', width:'100%',
      background: isSelected ? `linear-gradient(135deg,${c}22,${c}0a)` : 'rgba(8,12,26,0.6)',
      border: `1.5px solid ${isSelected ? c+'70' : 'rgba(51,65,85,0.4)'}`,
      boxShadow: isSelected ? `0 4px 18px ${c}25` : 'none',
      transform: isSelected ? 'translateX(4px)' : 'none',
    }}>
      <span style={{fontSize:'1.3rem',lineHeight:1,flexShrink:0}}>{def.emoji}</span>
      <div style={{textAlign:'left',flex:1,minWidth:0}}>
        <p style={{color:isSelected?'white':'#94a3b8',fontWeight:isSelected?700:500,fontSize:'0.8rem',margin:0,lineHeight:1.2}}>{def.label}</p>
        <p style={{color:isSelected?`${c}cc`:'#334155',fontSize:'0.65rem',margin:'2px 0 0',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{def.desc}</p>
      </div>
      {isSelected && <div style={{width:8,height:8,borderRadius:'50%',background:c,boxShadow:`0 0 10px ${c}`,flexShrink:0}}/>}
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GraphConfigPage({ uploadData, analysisData, config, onProceed, onBack }) {
  const [fieldsData,    setFieldsData]    = useState(null)
  const [loadingFields, setLoadingFields] = useState(true)
  const [selectedChart, setSelectedChart] = useState('bar')
  const [fieldValues,   setFieldValues]   = useState({})
  const [generating,    setGenerating]    = useState(false)
  const [chartResult,   setChartResult]   = useState(null)
  const [genError,      setGenError]      = useState('')
  const [dismissedFieldWarning, setDismissedFieldWarning] = useState(false)
  const [dismissedIndustryWarning, setDismissedIndustryWarning] = useState(false)

  const c  = config?.theme?.primary   || '#6366f1'

  // ── Semantic profile lookup helpers ─────────────────────────────────────────
  const getSemanticProfile = (colName) => {
    if (!fieldsData?.semanticProfiles || !colName) return null
    return fieldsData.semanticProfiles.find(p => p.name === colName) || null
  }

  const getAggRecommendation = (colName) => {
    if (!fieldsData?.columnAggRecommendations || !colName) return null
    return fieldsData.columnAggRecommendations[colName] || null
  }

  const SEMANTIC_COLORS = {
    MEASURE:    '#34d399',
    CONTINUOUS: '#38bdf8',
    IDENTIFIER: '#f87171',
    ORDINAL:    '#fbbf24',
    TEMPORAL:   '#a78bfa',
    DIMENSION:  '#94a3b8',
    BOOLEAN:    '#64748b',
    TEXT:       '#475569',
  }

  const SEMANTIC_ICONS = {
    MEASURE:    '📊',
    CONTINUOUS: '〽️',
    IDENTIFIER: '🔑',
    ORDINAL:    '🔢',
    TEMPORAL:   '📅',
    DIMENSION:  '🗂️',
    BOOLEAN:    '✅',
    TEXT:       '📝',
  }

  const AGG_BADGE_COLOR = {
    sum:   '#34d399',
    avg:   '#38bdf8',
    count: '#a78bfa',
    min:   '#fbbf24',
    max:   '#f97316',
  }

  // ── Detect wrong field type assignments from analysisData schema ──────────
  const wrongFields = (() => {
    const cols = analysisData?.aggregateStats?.columns || []
    const issues = []

    // Get numeric stats to cross-check — if a col has numeric stats but is categorical, it's wrong
    const numericStats = analysisData?.kpis || {}

    cols.forEach(col => {
      // Case 1: Column has numeric KPI stats (total/avg/min/max) but typed as categorical
      if (col.type === 'categorical' && numericStats[col.name] && typeof numericStats[col.name] === 'object') {
        const stat = numericStats[col.name]
        if (stat.total !== undefined && stat.avg !== undefined) {
          issues.push({
            col: col.name,
            current: 'Categorical',
            suggested: 'Numeric',
            icon: '🔢',
            reason: `"${col.name}" contains numeric data (total: ${stat.total?.toLocaleString?.() ?? stat.total}, avg: ${typeof stat.avg === 'number' ? stat.avg.toFixed(2) : stat.avg}) but is assigned as Categorical. This prevents charts and statistics from working correctly.`
          })
        }
      }
    })
    return issues
  })()

  // ── Detect wrong industry selection ──────────────────────────────────────
  const industryMismatch = (() => {
    const ind = analysisData?.industry
    if (!ind || ind === 'general') return null
    const cols = analysisData?.aggregateStats?.columns || []
    const fakeSchema = cols.map(c => ({ name:c.name, type:c.type, sampleValues:[] }))
    const v = validateIndustryMatch(ind, fakeSchema, [])
    return (v && !v.isMatch) ? v : null
  })()
  const c2 = config?.theme?.secondary || '#8b5cf6'

  useEffect(() => {
    const load = async () => {
      setLoadingFields(true)
      try {
        const { data } = await api.post('/api/graph-fields', { sessionId: uploadData?.sessionId })
        setFieldsData(data)
        if (data.defaultSelections) {
          setFieldValues({ metric:data.defaultSelections.metric||'', metric2:data.defaultSelections.metric2||'', dimension:data.defaultSelections.dimension||'', metrics:data.defaultSelections.metrics||[] })
        }
      } catch (e) { console.error(e) }
      finally { setLoadingFields(false) }
    }
    if (uploadData?.sessionId) load()
  }, [uploadData?.sessionId])

  // Reset chart result when chart type changes
  const handleSelectChart = (key) => {
    // Only allow selecting available charts
    const avail = fieldsData?.chartAvailability?.available || []
    if (!avail.find(a => a.key === key)) return // blocked
    setSelectedChart(key); setChartResult(null); setGenError('')
  }

  // Get availability info for a chart key
  const getChartStatus = (key) => {
    const avail = fieldsData?.chartAvailability?.available || []
    const disab = fieldsData?.chartAvailability?.disabled  || []
    if (avail.find(a => a.key === key)) return { available: true }
    const d = disab.find(d => d.key === key)
    return { available: false, reason: d?.reason, alternatives: d?.alternatives }
  }

  const currentDef  = fieldsData?.chartDefinitions?.[selectedChart]
  const currentSugg = fieldsData?.suggestions?.[selectedChart] || {}
  const setField    = (k,v) => setFieldValues(p=>({...p,[k]:v}))

  const canGenerate = (fv) => {
    if (!currentDef) return false
    const vals = fv || fieldValues
    return currentDef.fields.filter(f=>f.required&&f.key!=='note').every(f=>{
      const v = vals[f.key]
      return f.multi ? (Array.isArray(v)&&v.length>0) : !!v
    })
  }

  // ── Generate function (defined before useEffect) ──────────────────────────
  const generateRef = useRef(null)

  const generate = async (overrideValues) => {
    const fv = overrideValues || fieldValues
    console.log('[CHART] Generating with fields:', fv, 'chart:', selectedChart)
    setGenerating(true); setGenError(''); setChartResult(null)
    try {
      const parts = []
      if (fv.metric)    parts.push(fv.metric)
      if (fv.dimension) parts.push(`by ${fv.dimension}`)
      if (fv.metric2)   parts.push(`vs ${fv.metric2}`)
      const query = `Show ${selectedChart} chart: ${parts.join(' ')}`

      // Use the recommended aggregation from semantic profile (not hardcoded 'sum')
      let autoAgg = fv.aggregation || null
      if (!autoAgg && fv.metric && fieldsData?.columnAggRecommendations) {
        const rec = fieldsData.columnAggRecommendations[fv.metric]
        autoAgg = rec?.recommendedAgg || null
      }
      // Histograms and KDE always use count
      if (['histogram','kde'].includes(selectedChart)) autoAgg = 'count'

      const { data } = await api.post('/api/ai-query', {
        sessionId: uploadData?.sessionId, query,
        forcedConfig: {
          chart_type:  selectedChart,
          metric:      fv.metric    || null,
          metric2:     fv.metric2   || null,
          dimension:   fv.dimension || null,
          metrics:     fv.metrics   || null,
          aggregation: autoAgg,
          limit:       fv.limit && fv.limit !== 'All' ? parseInt(fv.limit) : null,
          bins:        fv.bins ? parseInt(fv.bins) : 10,
        },
      }, { timeout: 30000 })
      setChartResult(data)
    } catch (err) {
      setGenError(err.response?.data?.error || 'Failed to generate chart. Please try again.')
    } finally { setGenerating(false) }
  }

  generateRef.current = generate

  // ── Auto-generate: fires 350ms after any field value change ──────────────
  useEffect(() => {
    if (!fieldsData || loadingFields) return
    if (!canGenerate(fieldValues)) return
    const timer = setTimeout(() => {
      generateRef.current(fieldValues)
    }, 350)
    return () => clearTimeout(timer)
  }, [JSON.stringify(fieldValues), selectedChart, !!fieldsData]) // eslint-disable-line

  const insights = chartResult?.decision

  return (
    <div style={{ minHeight:'100vh', background:'#030712', padding:'72px 20px 60px', position:'relative', overflow:'hidden' }}>
      {/* Ambient blobs */}
      <div style={{position:'absolute',top:'-8%',left:'-5%',width:500,height:500,background:`radial-gradient(circle,${c}10,transparent 60%)`,pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:'5%',right:'-5%',width:380,height:380,background:`radial-gradient(circle,${c2}08,transparent 60%)`,pointerEvents:'none'}}/>

      <div style={{ maxWidth:1160, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* ── Page header ── */}
        <div style={{ textAlign:'center', marginBottom:32 }} className="animate-fade-in">
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:`${c}12`, border:`1px solid ${c}30`, borderRadius:99, padding:'5px 18px', marginBottom:14 }}>
            <Sparkles size={13} color={c} />
            <span style={{ fontSize:'0.78rem', color:c, fontWeight:600 }}>Step 3 of 4 — AI Chart Builder</span>
          </div>
          <h1 style={{ fontSize:'clamp(1.6rem,4vw,2.1rem)', fontWeight:800, color:'white', letterSpacing:'-0.03em', marginBottom:8 }}>
            Build Your Chart
          </h1>
          <p style={{ color:'#64748b', fontSize:'0.88rem', maxWidth:500, margin:'0 auto 14px' }}>
            Pick a chart type, choose your fields — the AI suggests the best columns from your dataset.
          </p>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'6px 16px', background:'rgba(15,23,42,0.7)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:99 }}>
            <span style={{fontSize:'0.9rem'}}>{config?.emoji}</span>
            <span style={{color:'#94a3b8',fontSize:'0.75rem'}}>{uploadData?.fileName}</span>
            <span style={{color:'#334155'}}>·</span>
            <span style={{color:'#64748b',fontSize:'0.73rem'}}>{uploadData?.rowCount?.toLocaleString()} rows · {uploadData?.columnCount} cols</span>
            {fieldsData?.source && (
              <span style={{ padding:'2px 8px', background:fieldsData.source==='claude'?'rgba(167,139,250,0.15)':'rgba(245,158,11,0.1)', border:`1px solid ${fieldsData.source==='claude'?'rgba(167,139,250,0.3)':'rgba(245,158,11,0.25)'}`, borderRadius:99, color:fieldsData.source==='claude'?'#c4b5fd':'#fcd34d', fontSize:'0.6rem', fontWeight:700 }}>
                {fieldsData.source==='claude'?'✨ Claude':'⚡ Auto'}
              </span>
            )}
          </div>
        </div>

        {loadingFields ? (
          <div style={{ padding:80, textAlign:'center' }}>
            <Loader2 size={40} color={c} style={{animation:'spin 1s linear infinite',margin:'0 auto 18px',display:'block'}}/>
            <p style={{color:'#64748b',fontSize:'0.88rem'}}>AI is analysing your dataset columns…</p>
          </div>
        ) : industryMismatch && !dismissedIndustryWarning ? (
          // ── WRONG INDUSTRY WARNING — shown in Analyse step before Dashboard ──
          <div style={{ animation:'fadeIn 0.4s ease-out' }}>
            <div style={{ background:'rgba(239,68,68,0.06)', border:'2px solid rgba(239,68,68,0.35)', borderRadius:20, padding:'48px 40px', textAlign:'center', position:'relative', overflow:'hidden', maxWidth:720, margin:'0 auto' }}>
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:400, background:'radial-gradient(circle,rgba(239,68,68,0.08),transparent 70%)', pointerEvents:'none' }}/>
              <div style={{ width:72, height:72, background:'rgba(239,68,68,0.12)', border:'2px solid rgba(239,68,68,0.3)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:'2rem' }}>⚠️</div>
              <h2 style={{ color:'#fca5a5', fontWeight:800, fontSize:'1.4rem', marginBottom:8 }}>Wrong Industry Selected</h2>
              <p style={{ color:'#94a3b8', fontSize:'0.95rem', maxWidth:520, margin:'0 auto 12px', lineHeight:1.65 }}>{industryMismatch.reason}</p>
              <p style={{ color:'#64748b', fontSize:'0.82rem', marginBottom:28 }}>Charts and analysis will not be accurate until you select the correct industry.</p>
              {industryMismatch.detectedIndustry && industryMismatch.detectedIndustry !== 'general' && (
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 18px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.3)', borderRadius:12, marginBottom:24 }}>
                  <span style={{ color:'#34d399', fontSize:'0.82rem' }}>✅ Suggested:</span>
                  <span style={{ color:'white', fontWeight:700, fontSize:'0.88rem' }}>
                    {INDUSTRY_CONFIGS[industryMismatch.detectedIndustry]?.emoji} {industryMismatch.detectedIndustry}
                  </span>
                </div>
              )}
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={onBack}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 26px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:12, color:'white', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', boxShadow:'0 6px 20px rgba(99,102,241,0.4)', transition:'all 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  ← Go Back & Fix Industry
                </button>
                <button onClick={() => setDismissedIndustryWarning(true)}
                  style={{ padding:'12px 22px', background:'rgba(51,65,85,0.5)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:12, color:'#94a3b8', fontWeight:600, fontSize:'0.88rem', cursor:'pointer', transition:'all 0.2s' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='rgba(51,65,85,0.8)';e.currentTarget.style.color='white'}}
                  onMouseLeave={e=>{e.currentTarget.style.background='rgba(51,65,85,0.5)';e.currentTarget.style.color='#94a3b8'}}>
                  Ignore & Continue Anyway
                </button>
              </div>
            </div>
          </div>
        ) : wrongFields.length > 0 && !dismissedFieldWarning ? (
          // ── WRONG FIELD TYPE WARNING (full-page block, same style as Wrong Industry) ──
          <div style={{ animation:'fadeIn 0.4s ease-out' }}>
            <div style={{ background:'rgba(239,68,68,0.06)', border:'2px solid rgba(239,68,68,0.35)', borderRadius:20, padding:'48px 40px', textAlign:'center', position:'relative', overflow:'hidden', maxWidth:720, margin:'0 auto' }}>
              {/* BG glow */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:400, background:'radial-gradient(circle,rgba(239,68,68,0.08),transparent 70%)', pointerEvents:'none' }}/>
              {/* Icon */}
              <div style={{ width:80, height:80, background:'rgba(239,68,68,0.12)', border:'2px solid rgba(239,68,68,0.35)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', fontSize:'2.2rem', boxShadow:'0 8px 32px rgba(239,68,68,0.2)' }}>
                ⚠️
              </div>
              <h2 style={{ color:'#fca5a5', fontWeight:800, fontSize:'1.5rem', marginBottom:10, letterSpacing:'-0.02em' }}>
                Wrong Field Types Detected
              </h2>
              <p style={{ color:'#94a3b8', fontSize:'0.95rem', maxWidth:520, margin:'0 auto 12px', lineHeight:1.65 }}>
                The following column{wrongFields.length>1?'s are':'is'} assigned to the wrong data type. Charts and statistics will not work correctly until this is fixed.
              </p>
              <p style={{ color:'#64748b', fontSize:'0.82rem', marginBottom:28 }}>
                Go back to the Schema step to fix the column types, or use Auto-Fix below.
              </p>

              {/* Issue cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:28, textAlign:'left' }}>
                {wrongFields.map((issue, i) => (
                  <div key={i} style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:14, padding:'14px 18px', display:'flex', alignItems:'flex-start', gap:12 }}>
                    <span style={{ fontSize:'1.4rem', flexShrink:0, marginTop:2 }}>{issue.icon}</span>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                        <span style={{ padding:'3px 10px', background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:99, color:'#fca5a5', fontSize:'0.72rem', fontWeight:700 }}>
                          {issue.col}
                        </span>
                        <span style={{ color:'#f87171', fontSize:'0.72rem', fontWeight:700 }}>currently: {issue.current}</span>
                        <span style={{ color:'#475569', fontSize:'0.7rem' }}>→ should be:</span>
                        <span style={{ color:'#34d399', fontSize:'0.72rem', fontWeight:700 }}>{issue.suggested}</span>
                      </div>
                      <p style={{ color:'#94a3b8', fontSize:'0.78rem', lineHeight:1.55, margin:0 }}>{issue.reason}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={onBack}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 26px', background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:12, color:'white', fontWeight:700, fontSize:'0.9rem', cursor:'pointer', boxShadow:'0 6px 20px rgba(99,102,241,0.4)', transition:'all 0.2s' }}
                  onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                  ← Go Back & Fix Schema
                </button>
                <button onClick={() => setDismissedFieldWarning(true)}
                  style={{ padding:'12px 22px', background:'rgba(51,65,85,0.5)', border:'1px solid rgba(51,65,85,0.5)', borderRadius:12, color:'#94a3b8', fontWeight:600, fontSize:'0.88rem', cursor:'pointer', transition:'all 0.2s' }}
                  onMouseEnter={e=>{ e.currentTarget.style.background='rgba(51,65,85,0.8)'; e.currentTarget.style.color='white' }}
                  onMouseLeave={e=>{ e.currentTarget.style.background='rgba(51,65,85,0.5)'; e.currentTarget.style.color='#94a3b8' }}>
                  Ignore & Continue Anyway
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'240px 1fr', gap:24, alignItems:'start' }}>

            {/* ── LEFT: chart type list ── */}
            <div style={{ background:'rgba(6,9,22,0.92)', border:`1px solid ${c}18`, borderRadius:20, padding:'18px 14px', display:'flex', flexDirection:'column', gap:4, maxHeight:'75vh', overflowY:'auto' }}>
              <p style={{ color:'#475569', fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:6, paddingLeft:4 }}>
                Chart Types
                {fieldsData?.chartAvailability && (
                  <span style={{ marginLeft:8, color:'#34d399', fontSize:'0.6rem' }}>
                    {fieldsData.chartAvailability.summary?.availableCount} available
                  </span>
                )}
              </p>
              {fieldsData?.chartDefinitions && Object.entries(fieldsData.chartDefinitions).map(([key, def]) => {
                const status = getChartStatus(key)
                const isSelected = selectedChart === key
                return (
                  <div key={key}>
                    <button
                      onClick={() => status.available && handleSelectChart(key)}
                      title={!status.available ? status.reason : ''}
                      style={{
                        display:'flex', alignItems:'center', gap:9, padding:'9px 14px',
                        borderRadius:11, cursor: status.available ? 'pointer' : 'not-allowed',
                        transition:'all 0.2s', width:'100%',
                        background: !status.available ? 'rgba(30,41,59,0.3)'
                          : isSelected ? `linear-gradient(135deg,${c}22,${c}0a)` : 'rgba(8,12,26,0.6)',
                        border: `1.5px solid ${!status.available ? 'rgba(51,65,85,0.2)' : isSelected ? c+'70' : 'rgba(51,65,85,0.4)'}`,
                        opacity: status.available ? 1 : 0.45,
                        boxShadow: isSelected ? `0 4px 18px ${c}25` : 'none',
                        transform: isSelected ? 'translateX(4px)' : 'none',
                      }}>
                      <span style={{fontSize:'1.1rem',lineHeight:1,flexShrink:0,filter:!status.available?'grayscale(1)':'none'}}>{def.emoji}</span>
                      <div style={{textAlign:'left',flex:1,minWidth:0}}>
                        <p style={{color:!status.available?'#334155':isSelected?'white':'#94a3b8',fontWeight:isSelected?700:500,fontSize:'0.78rem',margin:0,lineHeight:1.2}}>{def.label}</p>
                        {!status.available && status.reason && (
                          <p style={{color:'#f87171',fontSize:'0.6rem',margin:'2px 0 0',lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>⚠ {status.reason.slice(0,45)}{status.reason.length>45?'…':''}</p>
                        )}
                        {status.available && <p style={{color:isSelected?`${c}cc`:'#334155',fontSize:'0.6rem',margin:'2px 0 0'}}>{def.desc}</p>}
                      </div>
                      {isSelected && <div style={{width:7,height:7,borderRadius:'50%',background:c,boxShadow:`0 0 8px ${c}`,flexShrink:0}}/>}
                      {!status.available && <span style={{fontSize:'0.6rem',color:'#475569',flexShrink:0}}>🔒</span>}
                    </button>
                    {/* Alternatives hint */}
                    {!status.available && status.alternatives?.length > 0 && (
                      <p style={{color:'#334155',fontSize:'0.6rem',padding:'2px 14px 4px',margin:0}}>
                        Try: {status.alternatives.slice(0,2).join(', ')}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── RIGHT: fields + preview ── */}
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

              {/* Fields panel */}
              {currentDef && (
                <div style={{ background:'rgba(6,9,22,0.92)', border:`1px solid ${c}18`, borderRadius:20, padding:'22px 24px' }}>
                  {/* Header */}
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                    <div style={{ width:42, height:42, borderRadius:13, background:`linear-gradient(135deg,${c},${c2})`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.3rem', boxShadow:`0 6px 20px ${c}40` }}>
                      {currentDef.emoji}
                    </div>
                    <div>
                      <h2 style={{ color:'white', fontWeight:800, fontSize:'1rem', margin:0, letterSpacing:'-0.01em' }}>{currentDef.label}</h2>
                      <p style={{ color:'#475569', fontSize:'0.73rem', margin:0 }}>{currentDef.desc}</p>
                    </div>
                    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                      {canGenerate() && <CheckCircle2 size={14} color="#34d399"/>}
                      <span style={{ color:canGenerate()?'#34d399':'#475569', fontSize:'0.7rem', fontWeight:600 }}>
                        {canGenerate() ? 'Ready to generate' : 'Fill required fields'}
                      </span>
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:16, marginBottom:20 }}>
                    {currentDef.fields.map(field => {
                      const options = currentSugg[field.key] || []
                      const val     = fieldValues[field.key]
                      const hasVal  = field.multi ? (Array.isArray(val)&&val.length>0) : !!val

                      // Aggregation recommendation for metric (Y-axis) fields
                      const isMetricField = field.key === 'metric'
                      const aggRec = isMetricField && val ? getAggRecommendation(val) : null
                      const semProfile = isMetricField && val ? getSemanticProfile(val) : null
                      const semColor  = semProfile ? (SEMANTIC_COLORS[semProfile.semanticType] || '#64748b') : null
                      const semIcon   = semProfile ? (SEMANTIC_ICONS[semProfile.semanticType]  || '❓') : null

                      return (
                        <div key={field.key} style={{ background:'rgba(15,23,42,0.5)', border:`1px solid ${hasVal?c+'30':'rgba(51,65,85,0.3)'}`, borderRadius:14, padding:'14px 16px', transition:'border-color 0.2s' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                            <span style={{ width:18, height:18, borderRadius:'50%', background:hasVal?'#34d399':'rgba(51,65,85,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.6rem', color:'white', fontWeight:800, flexShrink:0 }}>
                              {hasVal ? '✓' : '?'}
                            </span>
                            <span style={{ color:hasVal?'#e2e8f0':'#64748b', fontWeight:700, fontSize:'0.75rem' }}>
                              {field.label}
                              {field.required && <span style={{ color:'#f87171', marginLeft:3 }}>*</span>}
                            </span>
                            {options.length > 0 && !field.static && (
                              <span style={{ marginLeft:'auto', padding:'1px 7px', background:`${c}10`, border:`1px solid ${c}20`, borderRadius:99, color:c, fontSize:'0.6rem', fontWeight:600 }}>
                                {options.length} options
                              </span>
                            )}
                          </div>
                          <FieldSelect field={field} options={options} value={val} onChange={v=>setField(field.key,v)} color={c} />

                          {/* ── Semantic type + aggregation recommendation badge ── */}
                          {isMetricField && val && aggRec && (
                            <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                              {/* Semantic type pill */}
                              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                                <span style={{ padding:'2px 8px', background:`${semColor}15`, border:`1px solid ${semColor}40`, borderRadius:99, color:semColor, fontSize:'0.62rem', fontWeight:700 }}>
                                  {semIcon} {aggRec.semanticType}
                                </span>
                                <span style={{ padding:'2px 8px', background:`${AGG_BADGE_COLOR[aggRec.recommendedAgg] || '#64748b'}15`, border:`1px solid ${AGG_BADGE_COLOR[aggRec.recommendedAgg] || '#64748b'}40`, borderRadius:99, color:AGG_BADGE_COLOR[aggRec.recommendedAgg] || '#64748b', fontSize:'0.62rem', fontWeight:700 }}>
                                  Recommended: {aggRec.recommendedAgg?.toUpperCase()}
                                </span>
                              </div>
                              {/* Recommendation text */}
                              <p style={{ color:'#64748b', fontSize:'0.68rem', lineHeight:1.5, margin:0 }}>
                                {aggRec.recommendation}
                              </p>
                              {/* Warning if applicable */}
                              {aggRec.warning && (
                                <div style={{ display:'flex', gap:6, padding:'6px 10px', background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:8 }}>
                                  <span style={{ fontSize:'0.65rem', flexShrink:0 }}>⚠</span>
                                  <p style={{ color:'#fcd34d', fontSize:'0.65rem', lineHeight:1.5, margin:0 }}>{aggRec.warning}</p>
                                </div>
                              )}
                              {/* Alternatives */}
                              {aggRec.alternatives?.length > 0 && (
                                <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                                  <span style={{ color:'#475569', fontSize:'0.6rem' }}>Also valid:</span>
                                  {aggRec.alternatives.map(alt => (
                                    <span key={alt} style={{ padding:'1px 6px', background:'rgba(51,65,85,0.3)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:99, color:'#64748b', fontSize:'0.6rem' }}>
                                      {alt.toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Generate button */}
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <button onClick={() => generateRef.current(fieldValues)} disabled={!canGenerate()||generating}
                      style={{ flex:1, padding:'13px 24px', borderRadius:14, background:canGenerate()&&!generating?`linear-gradient(135deg,${c},${c2})`:'rgba(30,41,59,0.5)', border:'none', cursor:canGenerate()&&!generating?'pointer':'not-allowed', color:canGenerate()&&!generating?'white':'#334155', fontWeight:700, fontSize:'0.9rem', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:canGenerate()&&!generating?`0 8px 24px ${c}40`:'none', transition:'all 0.25s' }}>
                      {generating ? <><Loader2 size={16} style={{animation:'spin 1s linear infinite'}}/> Generating…</> : <><Sparkles size={15}/> Generate Chart</>}
                    </button>
                    {chartResult && (
                      <button onClick={() => {setChartResult(null);setGenError('')}} style={{ padding:'13px 16px', borderRadius:14, background:'rgba(51,65,85,0.3)', border:'1px solid rgba(51,65,85,0.4)', color:'#64748b', fontSize:'0.82rem', cursor:'pointer', fontWeight:500, transition:'all 0.2s' }}
                        onMouseEnter={e=>{e.currentTarget.style.color='white'}} onMouseLeave={e=>{e.currentTarget.style.color='#64748b'}}>
                        Clear
                      </button>
                    )}
                  </div>

                  {genError && (
                    <div style={{ marginTop:12, padding:'10px 14px', background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:11, display:'flex', gap:8, alignItems:'flex-start' }}>
                      <AlertTriangle size={14} color="#f87171" style={{flexShrink:0,marginTop:2}}/>
                      <p style={{color:'#fca5a5',fontSize:'0.78rem',margin:0}}>{genError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Chart preview panel */}
              <div style={{ background:'rgba(6,9,22,0.95)', border:`1px solid ${chartResult?c+'30':'rgba(51,65,85,0.25)'}`, borderRadius:22, overflow:'hidden', transition:'all 0.4s', boxShadow:chartResult?`0 16px 60px ${c}18, 0 0 0 1px ${c}15`:'none' }}>
                {/* Preview header */}
                <div style={{ padding:'16px 22px', background:chartResult?`linear-gradient(135deg,${c}18,${c2}08)`:'rgba(8,12,26,0.4)', borderBottom:`1px solid ${chartResult?c+'20':'rgba(51,65,85,0.2)'}`, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                  <div style={{ width:38, height:38, borderRadius:12, background:chartResult?`linear-gradient(135deg,${c},${c2})`:'rgba(51,65,85,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', boxShadow:chartResult?`0 6px 18px ${c}40`:'none', transition:'all 0.3s' }}>
                    {currentDef?.emoji || '📊'}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ color:chartResult?'white':'#475569', fontWeight:700, fontSize:'0.9rem', margin:0 }}>
                      {chartResult ? `${currentDef?.label}` : 'Chart Preview'}
                    </p>
                    <p style={{ color:'#475569', fontSize:'0.68rem', margin:0 }}>
                      {chartResult
                        ? `${chartResult.chartData?.rowsUsed?.toLocaleString() || 0} rows analysed · ${chartResult.chartData?.data?.length || 0} data points · ${chartResult.source === 'gemini' ? '✨ Gemini AI' : '⚡ Local'}`
                        : 'Configure fields and click Generate Chart'
                      }
                    </p>
                  </div>
                  {generating && (
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <Loader2 size={14} color={c} style={{ animation:'spin 1s linear infinite' }} />
                      <span style={{ color:'#64748b', fontSize:'0.72rem' }}>Building…</span>
                    </div>
                  )}
                  {chartResult?.chartData?.data?.length > 0 && (
                    <div style={{ padding:'3px 10px', background:`${c}18`, border:`1px solid ${c}30`, borderRadius:99, color:c, fontSize:'0.65rem', fontWeight:700 }}>
                      {chartResult.chartData.data.length} points
                    </div>
                  )}
                </div>

                {/* Stats bar when chart is shown */}
                {chartResult?.chartData?.stats && (
                  <div style={{ display:'flex', gap:20, padding:'10px 22px', background:`${c}06`, borderBottom:`1px solid ${c}12`, flexWrap:'wrap' }}>
                    {Object.entries(chartResult.chartData.stats).map(([k,v]) => (
                      <span key={k} style={{ color:'#64748b', fontSize:'0.68rem' }}>
                        {k}: <b style={{ color:'#94a3b8' }}>{Number(v).toLocaleString(undefined,{maximumFractionDigits:2})}</b>
                      </span>
                    ))}
                  </div>
                )}

                {/* Chart area */}
                <div style={{ padding:'20px 16px' }}>
                  <ChartPreview chartData={chartResult?.chartData} chartType={selectedChart} color={c} notGenerated={!chartResult && !generating} />
                  {/* Axis info */}
                  {chartResult?.chartData && !['heatmap','kde'].includes(selectedChart) && (
                    <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:14, padding:'10px 14px', background:'rgba(10,15,30,0.6)', border:`1px solid ${c}12`, borderRadius:12 }}>
                      {fieldValues.dimension && (
                        <span style={{ color:'#475569', fontSize:'0.7rem', display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ display:'inline-block', width:20, height:3, background:'#64748b', borderRadius:99 }}/>
                          X-axis: <b style={{ color:'#e2e8f0', marginLeft:4 }}>{fieldValues.dimension}</b>
                        </span>
                      )}
                      {fieldValues.metric && (
                        <span style={{ color:'#475569', fontSize:'0.7rem', display:'flex', alignItems:'center', gap:5 }}>
                          <span style={{ display:'inline-block', width:3, height:16, background:'#64748b', borderRadius:99 }}/>
                          Y-axis: <b style={{ color:'#e2e8f0', marginLeft:4 }}>{fieldValues.metric}</b>
                        </span>
                      )}
                      {fieldValues.metric2 && (
                        <span style={{ color:'#475569', fontSize:'0.7rem' }}>Y2: <b style={{ color:'#a78bfa' }}>{fieldValues.metric2}</b></span>
                      )}
                    </div>
                  )}
                </div>

                {/* Insights section */}
                {insights && (
                  <div style={{ borderTop:`1px solid ${c}15`, padding:'18px 22px', background:`${c}04` }}>
                    {insights.executive_summary && (
                      <div style={{ padding:'12px 16px', background:`${c}09`, border:`1px solid ${c}20`, borderLeft:`4px solid ${c}`, borderRadius:12, marginBottom:14 }}>
                        <p style={{ color:'#64748b', fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:5 }}>📋 Summary</p>
                        <p style={{ color:'#e2e8f0', fontSize:'0.83rem', lineHeight:1.65, margin:0 }}>{insights.executive_summary}</p>
                      </div>
                    )}
                    {insights.insights?.length > 0 && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:8, marginBottom:insights.reason?12:0 }}>
                        {insights.insights.map((ins,i) => (
                          <div key={i} style={{ display:'flex', gap:9, padding:'9px 12px', background:`${c}06`, border:`1px solid ${c}12`, borderRadius:11 }}>
                            <span style={{ color:c, fontWeight:800, fontSize:'0.62rem', flexShrink:0, marginTop:2 }}>0{i+1}</span>
                            <p style={{ color:'#cbd5e1', fontSize:'0.78rem', lineHeight:1.6, margin:0 }}>{ins}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {insights.reason && (
                      <div style={{ padding:'9px 12px', background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.15)', borderRadius:10 }}>
                        <p style={{ color:'#64748b', fontSize:'0.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:4 }}>🎯 Why This Chart</p>
                        <p style={{ color:'#fcd34d', fontSize:'0.78rem', lineHeight:1.55, margin:0 }}>{insights.reason}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, paddingTop:28, marginTop:8 }}>
          <button onClick={onBack} className="btn-secondary" style={{fontSize:'0.85rem'}}>← Back</button>
          <button onClick={onProceed} className="btn-primary"
            style={{ fontSize:'0.9rem', padding:'12px 28px', background:`linear-gradient(135deg,${c},${c2})`, boxShadow:`0 8px 24px ${c}40` }}>
            {chartResult ? 'Continue to Dashboard →' : 'Skip — Show All Charts →'}
          </button>
        </div>

      </div>
    </div>
  )
}

