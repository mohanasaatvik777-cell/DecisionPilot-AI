import { BarChart2, Upload, Database, LayoutDashboard, ChevronRight, Plus, Brain, ChevronLeft } from 'lucide-react'
import { STEPS } from '../constants'
import Logo from './Logo'

const STEP_LIST = [
  { id: STEPS.UPLOAD,       label: 'Upload',    icon: Upload,          color: '#6366f1' },
  { id: STEPS.SCHEMA,       label: 'Schema',    icon: Database,        color: '#a78bfa' },
  { id: STEPS.GRAPH_CONFIG, label: 'Analyse',   icon: Brain,           color: '#f472b6' },
  { id: STEPS.DASHBOARD,    label: 'Dashboard', icon: LayoutDashboard, color: '#38bdf8' },
]

export default function Navbar({ step, onReset, onNavigate }) {
  const currentIdx = STEP_LIST.findIndex(s => s.id === step)

  const canGoBack = currentIdx > 0
  const canGoForward = currentIdx < STEP_LIST.length - 1

  const goBack = () => {
    if (canGoBack && onNavigate) onNavigate(STEP_LIST[currentIdx - 1].id)
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(3,7,18,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(99,102,241,0.12)',
      height: 60, display: 'flex', alignItems: 'center',
      padding: '0 20px', justifyContent: 'space-between',
    }}>

      {/* Logo */}
      <button onClick={onReset} style={{ display:'flex', alignItems:'center', gap:9, background:'none', border:'none', cursor:'pointer' }}>
        <Logo size={32} />
        <div style={{ display:'flex', alignItems:'baseline', gap:2 }}>
          <span style={{ color:'white', fontWeight:800, fontSize:'0.9rem', letterSpacing:'-0.01em' }}>Decision</span>
          <span style={{ fontWeight:800, fontSize:'0.9rem', background:'linear-gradient(90deg,#6366f1,#a855f7)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>Pilot</span>
          <span style={{ marginLeft:3, padding:'1px 4px', border:'1.5px solid #6366f1', borderRadius:4, color:'#818cf8', fontWeight:800, fontSize:'0.6rem' }}>AI</span>
        </div>
      </button>

      {/* Steps — clickable for completed steps */}
      <div style={{ display:'flex', alignItems:'center', gap:2 }}>
        {/* Back button */}
        {canGoBack && onNavigate && (
          <button onClick={goBack} style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:8, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', color:'#818cf8', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', marginRight:6, transition:'all 0.2s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='rgba(99,102,241,0.2)'}}
            onMouseLeave={e=>{e.currentTarget.style.background='rgba(99,102,241,0.1)'}}>
            <ChevronLeft size={12}/> Back
          </button>
        )}

        {STEP_LIST.map(({ id, label, icon: Icon, color }, idx) => {
          const done    = idx < currentIdx
          const current = idx === currentIdx
          const clickable = done && onNavigate
          return (
            <div key={id} style={{ display:'flex', alignItems:'center' }}>
              <button
                onClick={() => clickable && onNavigate(id)}
                disabled={!clickable && !current}
                style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'5px 12px', borderRadius:8,
                  background: current ? `${color}18` : clickable ? `${color}08` : 'transparent',
                  border: `1px solid ${current ? color+'40' : clickable ? color+'20' : 'transparent'}`,
                  color: current ? 'white' : done ? '#64748b' : '#334155',
                  fontSize:'0.8rem', fontWeight: current ? 600 : 400,
                  cursor: clickable ? 'pointer' : 'default',
                  transition:'all 0.2s',
                  outline: 'none',
                }}
                onMouseEnter={e => { if (clickable) { e.currentTarget.style.background=`${color}18`; e.currentTarget.style.color='white' }}}
                onMouseLeave={e => { if (clickable) { e.currentTarget.style.background=`${color}08`; e.currentTarget.style.color='#64748b' }}}
              >
                <Icon size={12} color={current ? color : done ? '#475569' : '#334155'} />
                <span className="nav-step-label">{label}</span>
                {done && <span style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', display:'inline-block' }} />}
              </button>
              {idx < STEP_LIST.length - 1 && (
                <ChevronRight size={11} color="#1e293b" style={{ margin:'0 1px' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* New Upload */}
      <button onClick={onReset} className="btn-ghost" style={{ fontSize:'0.78rem', padding:'6px 12px' }}>
        <Plus size={13} /> New Upload
      </button>
    </nav>
  )
}
