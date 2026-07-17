import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import ChartModal from './ChartModal'

export default function ExpandableChartCard({ title, subtitle, color = '#6366f1', children, fullWidth, compact }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div
        style={{
          background: 'rgba(15,23,42,0.65)',
          border: '1px solid rgba(51,65,85,0.4)',
          borderRadius: 20,
          padding: compact ? '14px 16px' : '18px 20px',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          overflow: 'hidden',
          gridColumn: fullWidth ? '1 / -1' : undefined,
          transition: 'border-color 0.3s, box-shadow 0.3s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = `${color}50`
          e.currentTarget.style.boxShadow = `0 8px 32px ${color}15`
          e.currentTarget.style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(51,65,85,0.4)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.transform = 'translateY(0)'
        }}
      >
        {/* Top accent */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />

        {/* Header */}
        {title && (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <p style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '0.88rem' }}>{title}</p>
              {subtitle && <p style={{ color: '#475569', fontSize: '0.72rem', marginTop: 2 }}>{subtitle}</p>}
            </div>
            <button
              onClick={() => setExpanded(true)}
              title="Expand chart"
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: `${color}15`, border: `1px solid ${color}30`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: color, transition: 'all 0.2s', flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; e.stopPropagation() }}
              onMouseLeave={e => { e.currentTarget.style.background = `${color}15`; e.stopPropagation() }}
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )}

        {/* Click overlay to expand */}
        <div onClick={() => setExpanded(true)} style={{ position: 'relative' }}>
          {children}
        </div>

        {/* Hover hint */}
        <div style={{ position: 'absolute', bottom: 8, right: 12, opacity: 0.3, display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
          <Maximize2 size={10} color="#64748b" />
          <span style={{ color: '#64748b', fontSize: '0.6rem' }}>click to expand</span>
        </div>
      </div>

      {/* Modal */}
      {expanded && (
        <ChartModal title={title} subtitle={subtitle} color={color} onClose={() => setExpanded(false)}>
          {/* Render the full-size version */}
          <div style={{ minHeight: 480 }}>
            {children}
          </div>
        </ChartModal>
      )}
    </>
  )
}
