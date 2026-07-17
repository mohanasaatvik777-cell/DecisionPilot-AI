import { useState, useEffect } from 'react'
import { Download, RefreshCw, BarChart2, TrendingUp, LayoutDashboard, Settings, Sparkles, FlaskConical } from 'lucide-react'
import OverviewTab          from '../components/OverviewTab'
import ExecutiveSummaryPanel from '../components/ExecutiveSummaryPanel'
import WhatIfPanel          from '../components/WhatIfPanel'
import AdaptiveKPISection   from '../components/AdaptiveKPISection'
import DashboardFilters     from '../components/DashboardFilters'
import DataQualityBanner    from '../components/DataQualityBanner'
import ExpandableChartCard  from '../components/ExpandableChartCard'
import TrendChart           from '../components/charts/TrendChart'
import CategoryChart        from '../components/charts/CategoryChart'
import ScatterChart         from '../components/charts/ScatterPlot'
import DistributionChart    from '../components/charts/DistributionChart'
import ForecastChart        from '../components/charts/ForecastChart'
import MultiTrendChart      from '../components/charts/MultiTrendChart'
import AdvancedLineChart    from '../components/charts/LineChart'
import AdvancedPieChart     from '../components/charts/PieChart'
import KDEChart             from '../components/charts/KDEChart'
import { getIndustryConfig, INDUSTRY_CONFIGS } from '../config/industryConfigs'

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: LayoutDashboard },
  { id: 'intelligence', label: 'Intelligence', icon: Sparkles       },
  { id: 'whatif',       label: 'What-If',      icon: FlaskConical   },
  { id: 'charts',       label: 'Deep Dive',    icon: BarChart2      },
  { id: 'forecast',     label: 'Forecast',     icon: TrendingUp     },
]

function IndustrySwitcher({ current, onSelect, onClose, primaryColor }) {
  const industries = Object.entries(INDUSTRY_CONFIGS).filter(([k]) => k !== 'general')
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(3,7,18,0.88)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'rgba(15,23,42,0.98)', border:`1px solid ${primaryColor}30`, borderRadius:24, padding:28, maxWidth:700, width:'100%', boxShadow:'0 32px 80px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h2 style={{ color:'white', fontWeight:800, fontSize:'1.2rem' }}>Switch Industry</h2>
            <p style={{ color:'#475569', fontSize:'0.8rem', marginTop:2 }}>Dashboard adapts instantly to the selected industry</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(51,65,85,0.5)', border:'none', borderRadius:8, padding:'6px 12px', color:'#64748b', cursor:'pointer', fontSize:'0.8rem' }}>✕ Close</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
          {industries.map(([key, cfg]) => (
            <button key={key} onClick={() => { onSelect(key); onClose() }}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'16px 8px', borderRadius:14, border:`2px solid ${current===key ? cfg.color1+'80':'rgba(51,65,85,0.4)'}`, background: current===key ? `${cfg.color1}15`:'rgba(15,23,42,0.5)', cursor:'pointer', transition:'all 0.25s' }}
              onMouseEnter={e=>{ e.currentTarget.style.borderColor=cfg.color1+'60'; e.currentTarget.style.background=`${cfg.color1}10`; e.currentTarget.style.transform='scale(1.04)' }}
              onMouseLeave={e=>{ if(current!==key){e.currentTarget.style.borderColor='rgba(51,65,85,0.4)'; e.currentTarget.style.background='rgba(15,23,42,0.5)'; e.currentTarget.style.transform='scale(1)'} }}>
              <span style={{ fontSize:'1.8rem' }}>{cfg.emoji}</span>
              <span style={{ color: current===key ? 'white':'#64748b', fontSize:'0.72rem', fontWeight:current===key?700:500, textAlign:'center', lineHeight:1.3 }}>
                {cfg.label.replace(' Analytics','').replace(' Dashboard','')}
              </span>
              {current===key && <div style={{ width:6, height:6, borderRadius:'50%', background:cfg.color1, boxShadow:`0 0 8px ${cfg.color1}` }}/>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage({ analysisData, insights, uploadData, onReset, onExport }) {
  const [activeTab,   setActiveTab]   = useState('overview')
  const [industry,    setIndustry]    = useState(analysisData?.industry || 'general')
  const [config,      setConfig]      = useState(null)
  const [animKey,     setAnimKey]     = useState(0)
  const [showSwitcher,setShowSwitcher]= useState(false)

  const { kpis, chartData, forecast, forecastNote, dataQualityNotes } = analysisData

  useEffect(() => { setConfig(getIndustryConfig(industry)); setAnimKey(k => k+1) }, [industry])

  if (!config) return null
  const { theme, label, emoji } = config
  const c = theme.primary, c2 = theme.secondary

  const hasData = {
    trend:      !!(chartData?.trend?.data?.filter(d => !d.gap).length > 0),
    category:   !!(chartData?.categoryBreakdown?.data?.length > 0),
    scatter:    !!(chartData?.scatter?.data?.length > 0),
    dist:       !!(chartData?.distribution?.data?.length > 0),
    multiTrend: !!(chartData?.multiTrend?.keys?.length >= 2),
    forecast:   !!forecast,
  }

  return (
    <div style={{ minHeight:'100vh', background:'#030712' }}>
      {showSwitcher && <IndustrySwitcher current={industry} primaryColor={c} onSelect={setIndustry} onClose={() => setShowSwitcher(false)} />}
      <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, background:`radial-gradient(ellipse 70% 35% at 50% 0%, ${c}10 0%, transparent 60%)` }} />

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'20px 20px 60px', position:'relative', zIndex:1 }} key={animKey} className="animate-fade-in">

        {/* Header */}
        <div style={{ display:'flex', flexWrap:'wrap', alignItems:'flex-start', justifyContent:'space-between', gap:14, marginBottom:24, padding:'18px 22px', background:`linear-gradient(135deg,${c}10,rgba(15,23,42,0.5))`, border:`1px solid ${c}20`, borderRadius:20, backdropFilter:'blur(16px)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:52, height:52, background:`linear-gradient(135deg,${c},${c2})`, borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', boxShadow:`0 8px 24px ${c}40` }}>{emoji}</div>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                <h1 style={{ fontSize:'1.4rem', fontWeight:800, color:'white', letterSpacing:'-0.02em' }}>{label}</h1>
                <span style={{ padding:'2px 10px', background:`${c}20`, border:`1px solid ${c}40`, borderRadius:99, color:c, fontSize:'0.67rem', fontWeight:700, textTransform:'uppercase' }}>LIVE</span>
              </div>
              <p style={{ color:'#475569', fontSize:'0.78rem' }}>
                {uploadData?.fileName} · {kpis?.totalRows?.toLocaleString()} records
                {kpis?.dateRange ? ` · ${kpis.dateRange.from} → ${kpis.dateRange.to}` : ''}
              </p>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => setShowSwitcher(true)} className="btn-secondary" style={{ fontSize:'0.8rem', padding:'8px 14px' }}><Settings size={13}/> Switch Industry</button>
            <button onClick={() => onExport ? onExport() : window.open(`/api/report/${uploadData.sessionId}/export`,'_blank')} className="btn-secondary" style={{ fontSize:'0.8rem', padding:'8px 14px' }}><Download size={13}/> Export PDF</button>
            <button onClick={onReset} className="btn-ghost" style={{ fontSize:'0.8rem' }}><RefreshCw size={13}/> New Upload</button>
          </div>
        </div>

        {dataQualityNotes?.length > 0 && <DataQualityBanner notes={dataQualityNotes} />}
        <AdaptiveKPISection config={config} kpis={kpis} analysisData={analysisData} />
        <DashboardFilters filterKeys={config.filters} primaryColor={c} />

        {/* Tab bar */}
        <div style={{ display:'flex', gap:4, marginBottom:24, background:'rgba(15,23,42,0.7)', borderRadius:14, padding:4, border:'1px solid rgba(51,65,85,0.4)', overflowX:'auto' }}>
          {TABS.map(({ id, label:tl, icon:Icon }) => {
            const active = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:7, padding:'9px 14px', borderRadius:10, border:active?`1px solid ${c}40`:'1px solid transparent', cursor:'pointer', fontSize:'0.82rem', fontWeight:active?600:400, whiteSpace:'nowrap', background:active?`linear-gradient(135deg,${c}25,${c}10)`:'transparent', color:active?'white':'#64748b', boxShadow:active?`0 4px 16px ${c}20`:'none', transition:'all 0.2s' }}>
                <Icon size={14} color={active?c:'#64748b'}/>{tl}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div key={activeTab} className="animate-fade-in">

          {activeTab === 'overview' && (
            <OverviewTab analysisData={analysisData} insights={insights} config={config} uploadData={uploadData} hasData={hasData} chartData={chartData} c={c} c2={c2} />
          )}

          {activeTab === 'intelligence' && (
            <ExecutiveSummaryPanel uploadData={uploadData} analysisData={analysisData} config={config} />
          )}

          {activeTab === 'whatif' && (
            <WhatIfPanel uploadData={uploadData} config={config} />
          )}

          {activeTab === 'charts' && (
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div style={{ padding:'12px 16px', background:`${c}08`, border:`1px solid ${c}15`, borderRadius:14 }}>
                <p style={{ color:'#475569', fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{config.label} — Available Charts</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
                  {Object.entries(hasData).filter(([,v])=>v).map(([k])=>(
                    <span key={k} style={{ padding:'3px 10px', background:`${c}10`, border:`1px solid ${c}20`, borderRadius:99, color:'#94a3b8', fontSize:'0.72rem' }}>
                      {k.replace(/([A-Z])/g,' $1').replace(/^./,s=>s.toUpperCase())}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,400px),1fr))', gap:20 }}>
                {hasData.trend      && <ExpandableChartCard title="📈 Area Trend"    color={c}><TrendChart data={chartData.trend} color={c}/></ExpandableChartCard>}
                {hasData.trend      && <ExpandableChartCard title="〰️ Line Trend"    color="#38bdf8"><AdvancedLineChart data={chartData.trend} color="#38bdf8"/></ExpandableChartCard>}
                {hasData.category   && <ExpandableChartCard title="🗂️ Category Bar" color={c2}><CategoryChart data={chartData.categoryBreakdown}/></ExpandableChartCard>}
                {hasData.category   && <ExpandableChartCard title="🥧 Donut Chart"  color="#a78bfa"><AdvancedPieChart data={chartData.categoryBreakdown}/></ExpandableChartCard>}
                {hasData.dist       && <ExpandableChartCard title="📊 Distribution" color="#34d399"><DistributionChart data={chartData.distribution}/></ExpandableChartCard>}
                {hasData.dist       && <ExpandableChartCard title="〽️ KDE Density"  color="#f472b6"><KDEChart data={chartData.distribution} color="#f472b6"/></ExpandableChartCard>}
                {hasData.scatter    && <ExpandableChartCard title="🔵 Scatter"       color="#34d399"><ScatterChart data={chartData.scatter}/></ExpandableChartCard>}
                {hasData.multiTrend && <ExpandableChartCard title="📉 Multi-Metric" color={c} fullWidth><MultiTrendChart data={chartData.multiTrend}/></ExpandableChartCard>}
              </div>
            </div>
          )}

          {activeTab === 'forecast' && (
            hasData.forecast
              ? <ExpandableChartCard title="🔮 30-Day Forecast" subtitle="Confidence band + zoom controls" color={theme.accent||'#38bdf8'}>
                  <ForecastChart forecast={forecast}/>
                  {forecastNote && <p style={{ color:'#fbbf24', fontSize:'0.75rem', marginTop:12 }}>⚠ {forecastNote}</p>}
                </ExpandableChartCard>
              : <div style={{ background:'rgba(15,23,42,0.6)', border:'1px solid rgba(51,65,85,0.4)', borderRadius:20, padding:60, textAlign:'center' }}>
                  <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔮</div>
                  <p style={{ color:'#475569', fontWeight:500 }}>{forecastNote || 'Forecasting needs both a date column and a numeric column.'}</p>
                </div>
          )}

        </div>
      </div>
    </div>
  )
}
