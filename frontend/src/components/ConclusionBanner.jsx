import { useState, useEffect } from 'react'
import { Target, TrendingUp, AlertTriangle, Zap, Crown, ArrowRight, Sparkles, CheckCircle2, Clock, Flame } from 'lucide-react'

const fmt = (n) => {
  if (!n && n !== 0) return 'N/A'
  const num = Number(n)
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K'
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ── Industry-specific growth decisions ────────────────────────────────────────
const INDUSTRY_DECISIONS = {
  retail: (stats, metrics, cats, anomalies) => {
    const m = metrics[0]
    const top = cats[0]
    const bottom = cats[cats.length - 1]
    return [
      { priority: 'HIGH', label: 'Scale Top Performer', icon: Crown, color: '#fbbf24',
        decision: top ? `Double down on "${top.name}" — it holds the highest revenue share. Increase stock, run targeted promotions, and expand its product line to capitalise on proven demand.` : 'Identify and scale your highest-revenue product category through targeted promotions.' },
      { priority: 'HIGH', label: 'Recover Weak Segment', icon: TrendingUp, color: '#6366f1',
        decision: bottom ? `"${bottom.name}" is underperforming. Either revamp its offering with bundled deals and discounts, or reallocate shelf space and budget to higher-performing categories.` : 'Analyse your lowest-performing segments and either revamp or retire them to free up resources.' },
      { priority: 'MEDIUM', label: 'Boost Average Order Value', icon: Flame, color: '#f472b6',
        decision: m ? `Your average order is ${fmt(m[1].avg)}. Introduce upsell prompts at checkout, bundle complementary products, and set a free-shipping threshold above current average to nudge customers higher.` : 'Implement upsell strategies and bundled offers to increase average order value.' },
      { priority: anomalies.length > 0 ? 'HIGH' : 'LOW', label: 'Anomaly Response Plan', icon: AlertTriangle, color: '#f87171',
        decision: anomalies.length > 0 ? `${anomalies.length} sales spikes or drops detected. Audit those dates for supplier issues, competitor promotions, or demand shifts — then build contingency stock buffers around those periods.` : 'No anomalies found. Maintain current inventory cadence and schedule a quarterly audit.' },
    ]
  },
  restaurant: (stats, metrics, cats, anomalies) => {
    const top = cats[0]; const bottom = cats[cats.length - 1]
    return [
      { priority: 'HIGH', label: 'Menu Optimisation', icon: Crown, color: '#f97316',
        decision: top ? `"${top.name}" is your best-selling item. Feature it prominently on menus and train staff to recommend it. Create combo deals around it to boost per-table spend.` : 'Feature top-selling dishes prominently and train staff to recommend them proactively.' },
      { priority: 'HIGH', label: 'Eliminate Dead Weight', icon: Zap, color: '#ef4444',
        decision: bottom ? `"${bottom.name}" has the lowest sales. Remove it from the menu or reinvent it — freeing kitchen resources and reducing ingredient wastage directly improves margins.` : 'Audit and remove or reinvent your lowest-ordered dishes to reduce kitchen complexity and wastage.' },
      { priority: 'MEDIUM', label: 'Increase Table Turnover', icon: Clock, color: '#fbbf24',
        decision: 'Introduce pre-ordering and streamlined payment options. Target 15-minute reduction in average dining time during peak hours to serve 20-30% more covers per shift.' },
      { priority: 'MEDIUM', label: 'Staff & Shift Scheduling', icon: TrendingUp, color: '#34d399',
        decision: 'Cross-reference peak-hour data with current staff rosters. Add cover during the top 3 busiest periods and reduce staff during confirmed slow slots to cut labour costs.' },
    ]
  },
  healthcare: (stats, metrics, cats, anomalies) => {
    const top = cats[0]
    return [
      { priority: 'HIGH', label: 'Capacity Expansion', icon: TrendingUp, color: '#0ea5e9',
        decision: top ? `"${top.name}" has the highest patient volume. Allocate additional beds, staff, and equipment to this department before the next peak cycle to prevent care-quality deterioration.` : 'Identify the highest-load departments and pre-position resources to prevent capacity bottlenecks.' },
      { priority: 'HIGH', label: 'Preventive Care Drive', icon: Flame, color: '#34d399',
        decision: 'High recurring conditions in your data signal preventable cases. Launch targeted wellness screenings and outreach programmes to reduce repeat admissions by an estimated 15-25%.' },
      { priority: 'MEDIUM', label: 'Discharge Optimisation', icon: Clock, color: '#fbbf24',
        decision: 'Review average length of stay per condition. Introduce structured discharge checklists and post-care follow-up protocols to free beds 10-20% faster without affecting patient outcomes.' },
      { priority: anomalies.length > 0 ? 'HIGH' : 'LOW', label: 'Anomaly Audit', icon: AlertTriangle, color: '#f87171',
        decision: anomalies.length > 0 ? `${anomalies.length} statistical outliers detected in patient data. Trigger a clinical audit on those records immediately — unusual spikes or drops may indicate data entry errors or a sudden outbreak requiring response.` : 'All patient metrics are within normal range. Maintain current care protocols and schedule routine data quality reviews.' },
    ]
  },
  manufacturing: (stats, metrics, cats, anomalies) => {
    const m = metrics[0]
    return [
      { priority: 'HIGH', label: 'Predictive Maintenance', icon: Zap, color: '#64748b',
        decision: anomalies.length > 0 ? `${anomalies.length} anomalies found in production data — likely signalling machine wear before failure. Implement a predictive maintenance schedule based on these patterns to cut unplanned downtime by 30-50%.` : 'Introduce condition-based monitoring sensors on your highest-utilisation machines to transition from reactive to predictive maintenance.' },
      { priority: 'HIGH', label: 'Throughput Increase', icon: TrendingUp, color: '#06b6d4',
        decision: m ? `Production average is ${fmt(m[1].avg)} units. Identify your top bottleneck process — the single constraint limiting the entire line — and focus Lean/Six-Sigma efforts there. A 10% improvement at the bottleneck lifts total output.` : 'Apply Theory of Constraints — identify and eliminate the single biggest production bottleneck first.' },
      { priority: 'MEDIUM', label: 'Defect Rate Reduction', icon: AlertTriangle, color: '#f87171',
        decision: 'Implement Statistical Process Control (SPC) on your highest-defect product lines. A 1% reduction in defect rate typically saves 3-5% of production cost through reduced scrap, rework, and warranty claims.' },
      { priority: 'MEDIUM', label: 'Shift Efficiency', icon: Crown, color: '#fbbf24',
        decision: 'Compare output and quality metrics across shifts. Standardise best-shift practices into SOPs, cross-train underperforming shift workers, and introduce micro-incentives tied to quality targets.' },
    ]
  },
  education: (stats, metrics, cats, anomalies) => {
    const bottom = cats[cats.length - 1]
    return [
      { priority: 'HIGH', label: 'At-Risk Student Intervention', icon: AlertTriangle, color: '#f87171',
        decision: 'Students with attendance below 75% or marks below the passing threshold need immediate intervention. Assign dedicated mentors, schedule parent meetings, and create personalised catch-up plans before the next assessment cycle.' },
      { priority: 'HIGH', label: 'Subject Curriculum Review', icon: Target, color: '#8b5cf6',
        decision: bottom ? `"${bottom.name}" shows the lowest performance metrics. Review its teaching methodology, assessment structure, and resource allocation. Consider peer-learning groups or additional tutorial sessions.` : 'Review and strengthen the curriculum of the lowest-performing subjects with updated teaching methods and resources.' },
      { priority: 'MEDIUM', label: 'Attendance Improvement', icon: Clock, color: '#34d399',
        decision: 'Introduce gamified attendance tracking, early-absence SMS alerts to parents, and attendance-linked participation in extracurricular activities to drive consistent school attendance above 90%.' },
      { priority: 'MEDIUM', label: 'Top Performer Development', icon: Crown, color: '#fbbf24',
        decision: 'Identify top 10% students and enrol them in advanced learning tracks, inter-school competitions, and mentorship programmes. Top performers create a culture of excellence that lifts peer standards.' },
    ]
  },
  marketing: (stats, metrics, cats, anomalies) => {
    const top = cats[0]; const bottom = cats[cats.length - 1]; const m = metrics[0]
    return [
      { priority: 'HIGH', label: 'Scale Winning Campaigns', icon: Crown, color: '#f472b6',
        decision: top ? `"${top.name}" delivers the highest results. Increase its budget by 30-50% immediately. Replicate its targeting, creative style, and messaging across other campaigns to systematically lift overall ROI.` : 'Identify and double down on your highest-converting campaigns — shift budget from poor performers immediately.' },
      { priority: 'HIGH', label: 'Cut or Optimise Losers', icon: Zap, color: '#ef4444',
        decision: bottom ? `"${bottom.name}" is your worst performer. Pause it, A/B test new creatives and audiences, and only reinstate once it hits your target ROAS. Reallocate freed budget to proven channels immediately.` : 'Pause underperforming campaigns, run A/B tests with fresh creatives, and reinstate only once performance meets targets.' },
      { priority: 'MEDIUM', label: 'Conversion Rate Optimisation', icon: TrendingUp, color: '#fbbf24',
        decision: m ? `With a conversion average of ${fmt(m[1].avg)}, focus on landing page speed, form friction reduction, and retargeting sequences. A 1% CRO improvement compounds significantly — even small lifts multiply total revenue.` : 'Optimise landing pages, reduce form friction, and build retargeting sequences to extract more value from existing traffic.' },
      { priority: 'MEDIUM', label: 'Audience Segmentation', icon: Target, color: '#a78bfa',
        decision: 'Segment your audience by value tier (high/mid/low spenders) and craft personalised messaging for each. High-value segments deserve premium nurture sequences; low-value get reactivation campaigns.' },
    ]
  },
  finance: (stats, metrics, cats, anomalies) => {
    const m = metrics[0]; const top = cats[0]
    return [
      { priority: 'HIGH', label: 'Revenue Concentration Risk', icon: AlertTriangle, color: '#34d399',
        decision: top ? `"${top.name}" dominates revenue. Heavy concentration in one stream is a risk — if it drops, the impact is severe. Actively develop the next 2-3 revenue sources to build resilience and reduce dependency.` : 'Diversify revenue streams to reduce concentration risk. A balanced portfolio of income sources provides stability during downturns.' },
      { priority: 'HIGH', label: 'Cost Structure Optimisation', icon: Zap, color: '#f87171',
        decision: 'Audit the top 3 expense categories for discretionary vs. non-discretionary spend. Negotiate supplier contracts, automate manual processes, and eliminate duplicate subscriptions. Target a 10-15% cost reduction within 90 days.' },
      { priority: 'MEDIUM', label: 'Cash Flow Improvement', icon: Clock, color: '#06b6d4',
        decision: m ? `With an average of ${fmt(m[1].avg)} per period, focus on shortening payment collection cycles, offering early-payment discounts to debtors, and extending payables terms with key suppliers to maximise working capital.` : 'Shorten receivable cycles, offer early-payment incentives, and optimise payable terms to strengthen working capital.' },
      { priority: 'MEDIUM', label: 'High-ROI Reinvestment', icon: Crown, color: '#fbbf24',
        decision: 'Identify the top-performing revenue lines and reinvest a portion of profits there. Apply the 80/20 rule — 80% of results come from 20% of activities. Double investment in that 20%.' },
    ]
  },
  general: (stats, metrics, cats, anomalies) => {
    const m = metrics[0]; const top = cats[0]; const bottom = cats[cats.length - 1]
    return [
      { priority: 'HIGH', label: 'Capitalise on Leader', icon: Crown, color: '#6366f1',
        decision: top ? `"${top.name}" is your top-performing segment. Allocate more resources, attention, and budget to it. Understand what's driving its success and systematically replicate those drivers across other segments.` : 'Identify and invest in your highest-performing segment to accelerate its growth trajectory.' },
      { priority: m ? 'HIGH' : 'MEDIUM', label: 'Metric Improvement', icon: TrendingUp, color: '#34d399',
        decision: m ? `Your primary metric "${m[0]}" averages ${fmt(m[1].avg)} with a peak of ${fmt(m[1].max)}. The gap between average and peak shows clear upside potential. Investigate what conditions drive peak performance and make them standard operating procedure.` : 'Track your primary metric consistently and set incremental improvement targets of 5-10% per period.' },
      { priority: anomalies.length > 0 ? 'HIGH' : 'LOW', label: 'Address Anomalies', icon: AlertTriangle, color: '#f87171',
        decision: anomalies.length > 0 ? `${anomalies.length} data anomalies detected. Each represents either a risk or an opportunity. Investigate root causes systematically — anomalies that are risks need mitigation plans; those that are positive outliers need to be understood and replicated.` : 'No anomalies detected — your data is consistent. Focus on steady optimisation rather than firefighting.' },
      { priority: bottom ? 'MEDIUM' : 'LOW', label: 'Elevate Underperformer', icon: Zap, color: '#fbbf24',
        decision: bottom ? `"${bottom.name}" is trailing behind. Decide: invest to improve it, or reallocate those resources elsewhere. Apply a time-boxed 30-day improvement sprint — if it doesn't respond, divert resources to higher-yield activities.` : 'Keep monitoring all segments and apply continuous improvement principles to prevent drift.' },
    ]
  },
}

const PRIORITY_META = {
  HIGH:   { color: '#f87171', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  label: '🔴 High Priority',   glow: 'rgba(239,68,68,0.25)' },
  MEDIUM: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)', label: '🟡 Medium Priority', glow: 'rgba(251,191,36,0.2)' },
  LOW:    { color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)',  label: '🟢 Routine',         glow: 'rgba(52,211,153,0.15)' },
}

function TypeWriter({ text, delay = 0, speed = 30 }) {
  const [displayed, setDisplayed] = useState('')
  const [started,   setStarted]   = useState(false)
  useEffect(() => { const t = setTimeout(() => setStarted(true), delay); return () => clearTimeout(t) }, [delay])
  useEffect(() => {
    if (!started) return
    let i = 0; setDisplayed('')
    const iv = setInterval(() => { i++; setDisplayed(text.slice(0, i)); if (i >= text.length) clearInterval(iv) }, speed)
    return () => clearInterval(iv)
  }, [started, text])
  return <span>{displayed}<span style={{ opacity: displayed.length < text.length ? 1 : 0 }}>|</span></span>
}

export default function ConclusionBanner({ analysisData, hasData, config }) {
  const [visible,      setVisible]      = useState(false)
  const [activeCard,   setActiveCard]   = useState(null)

  const c  = config?.theme?.primary   || '#6366f1'
  const c2 = config?.theme?.secondary || '#8b5cf6'
  const industry = config?.label?.toLowerCase().split(' ')[0] || 'general'

  const stats   = analysisData?.aggregateStats || {}
  const kpis    = stats.kpis || {}
  const cats    = stats.topCategories || []
  const anomalies = analysisData?.anomalies || []
  const metrics = Object.entries(kpis).filter(([k, v]) => v && typeof v === 'object' && k !== 'totalRows')

  const decisionFn = INDUSTRY_DECISIONS[industry] || INDUSTRY_DECISIONS.general
  const decisions  = decisionFn(stats, metrics, cats, anomalies)

  const highCount   = decisions.filter(d => d.priority === 'HIGH').length
  const medCount    = decisions.filter(d => d.priority === 'MEDIUM').length

  useEffect(() => { const t = setTimeout(() => setVisible(true), 300); return () => clearTimeout(t) }, [])

  return (
    <div style={{
      borderRadius: 28, overflow: 'hidden', marginTop: 12,
      background: 'linear-gradient(160deg, rgba(6,9,24,0.99) 0%, rgba(10,15,35,0.99) 100%)',
      boxShadow: `0 0 0 1px ${c}35, 0 32px 100px ${c}20, 0 8px 32px rgba(0,0,0,0.6)`,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(40px)',
      transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.34,1.56,0.64,1)',
      position: 'relative',
    }}>
      {/* Ambient glow orbs */}
      <div style={{ position:'absolute', top:-60, right:-60, width:280, height:280, background:`radial-gradient(circle,${c}22,transparent 60%)`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:-40, left:-40, width:200, height:200, background:`radial-gradient(circle,${c2}18,transparent 65%)`, pointerEvents:'none' }} />
      <div style={{ position:'absolute', top:'40%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:200, background:`radial-gradient(ellipse,${c}08,transparent 70%)`, pointerEvents:'none' }} />

      {/* ── HERO HEADER ── */}
      <div style={{
        padding: '28px 32px 24px',
        background: `linear-gradient(135deg, ${c}20 0%, ${c2}10 50%, transparent 100%)`,
        borderBottom: `1px solid ${c}25`,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Animated icon */}
            <div style={{
              width: 56, height: 56, borderRadius: 18, flexShrink: 0,
              background: `linear-gradient(135deg, ${c}, ${c2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 12px 36px ${c}55, 0 0 0 1px ${c}40`,
              animation: 'float 3s ease-in-out infinite',
            }}>
              <Target size={26} color="white" />
            </div>
            <div>
              {/* Eyebrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ padding: '2px 10px', background: `${c}20`, border: `1px solid ${c}40`, borderRadius: 99, color: c, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {config?.emoji} {config?.label}
                </span>
                <span style={{ padding: '2px 10px', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 99, color: '#fbbf24', fontSize: '0.62rem', fontWeight: 700 }}>
                  {highCount} Critical Action{highCount !== 1 ? 's' : ''}
                </span>
              </div>
              {/* Title with typewriter */}
              <h2 style={{ color: 'white', fontWeight: 900, fontSize: 'clamp(1.2rem,3vw,1.65rem)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4 }}>
                <TypeWriter text="Strategic Growth Decisions" delay={400} speed={35} />
              </h2>
              <p style={{ color: '#475569', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Based on your {stats.rowCount?.toLocaleString() || 0} records — prioritised actions to drive growth in {config?.label?.replace(' Analytics','').replace(' Dashboard','')}
              </p>
            </div>
          </div>

          {/* Summary counters */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {[
              { count: highCount,   label: 'Critical', color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.25)' },
              { count: medCount,    label: 'Medium',   color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
              { count: decisions.length - highCount - medCount, label: 'Routine', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)' },
            ].map(({ count, label, color, bg, border }) => (
              <div key={label} style={{ textAlign: 'center', padding: '8px 14px', background: bg, border: `1px solid ${border}`, borderRadius: 12, minWidth: 64 }}>
                <div style={{ color, fontWeight: 800, fontSize: '1.3rem', lineHeight: 1 }}>{count}</div>
                <div style={{ color: '#475569', fontSize: '0.62rem', fontWeight: 600, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gradient separator line */}
        <div style={{ marginTop: 20, height: 2, background: `linear-gradient(90deg, ${c}, ${c2}, transparent)`, borderRadius: 99, opacity: 0.6 }} />
      </div>

      {/* ── DECISION CARDS ── */}
      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, position: 'relative', zIndex: 1 }}>
        {decisions.map((d, i) => {
          const Icon     = d.icon
          const meta     = PRIORITY_META[d.priority]
          const isActive = activeCard === i

          return (
            <div key={i}
              className="animate-slide-up"
              style={{ animationDelay: `${500 + i * 120}ms` }}
              onMouseEnter={() => setActiveCard(i)}
              onMouseLeave={() => setActiveCard(null)}
            >
              <div style={{
                borderRadius: 20, overflow: 'hidden',
                background: isActive
                  ? `linear-gradient(135deg, ${d.color}15 0%, ${d.color}06 100%)`
                  : 'rgba(10,15,30,0.7)',
                border: `1px solid ${isActive ? d.color + '50' : d.color + '20'}`,
                borderLeft: `4px solid ${d.color}`,
                boxShadow: isActive ? `0 8px 40px ${d.color}20, 0 0 0 1px ${d.color}15` : 'none',
                transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                transform: isActive ? 'translateX(6px)' : 'none',
              }}>

                {/* Card header */}
                <div style={{
                  padding: '14px 20px 10px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: `1px solid ${d.color}15`,
                  background: isActive ? `${d.color}08` : 'transparent',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                    background: `linear-gradient(135deg, ${d.color}30, ${d.color}15)`,
                    border: `1px solid ${d.color}45`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: isActive ? `0 0 20px ${d.color}40` : 'none',
                    transition: 'box-shadow 0.3s',
                  }}>
                    <Icon size={18} color={d.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <h3 style={{ color: 'white', fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>{d.label}</h3>
                      <span style={{
                        padding: '2px 9px', borderRadius: 99, fontSize: '0.6rem', fontWeight: 700,
                        background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color,
                      }}>{meta.label}</span>
                    </div>
                  </div>
                  <ArrowRight size={16} color={isActive ? d.color : '#334155'} style={{ flexShrink: 0, transition: 'color 0.2s, transform 0.2s', transform: isActive ? 'translateX(4px)' : 'none' }} />
                </div>

                {/* Decision text */}
                <div style={{ padding: '14px 20px 16px' }}>
                  <p style={{ color: isActive ? '#e2e8f0' : '#94a3b8', fontSize: '0.86rem', lineHeight: 1.7, margin: 0, transition: 'color 0.3s' }}>
                    {d.decision}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        padding: '14px 32px',
        borderTop: `1px solid ${c}15`,
        background: `linear-gradient(135deg, ${c}08, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={13} color="#34d399" />
          <span style={{ color: '#475569', fontSize: '0.72rem' }}>
            {decisions.length} strategic decisions · Powered by {stats.rowCount?.toLocaleString()} records of {config?.label} data
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={11} color={c} />
          <span style={{ color: '#334155', fontSize: '0.7rem' }}>Go to <strong style={{ color: '#64748b' }}>AI Panel</strong> for Claude-powered deep analysis</span>
        </div>
      </div>
    </div>
  )
}
