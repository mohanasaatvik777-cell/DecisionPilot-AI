import { useEffect } from 'react'
import { X, ZoomIn, Download } from 'lucide-react'

export default function ChartModal({ title, subtitle, color, children, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(3,7,18,0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="chart-modal-inner"
        style={{
          width: '100%', maxWidth: 1100,
          background: 'rgba(15,23,42,0.98)',
          border: `1px solid ${color}40`,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: `0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px ${color}20`,
          animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '92vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: `1px solid rgba(51,65,85,0.5)`,
          background: `linear-gradient(135deg, ${color}12, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
            <div>
              <h3 style={{ color: 'white', fontWeight: 700, fontSize: '1.05rem' }}>{title}</h3>
              {subtitle && <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: 2 }}>{subtitle}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', transition: 'all 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Top accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${color}, ${color}80, transparent)` }} />

        {/* Chart content - full size */}
        <div className="chart-modal-padding" style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {children}
        </div>

        {/* Footer hint */}
        <div style={{ padding: '10px 24px', borderTop: '1px solid rgba(51,65,85,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: '#334155', fontSize: '0.72rem' }}>Press ESC or click outside to close</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ZoomIn size={12} color="#334155" />
            <span style={{ color: '#334155', fontSize: '0.72rem' }}>Expanded view</span>
          </div>
        </div>
      </div>
    </div>
  )
}
